import { TUNING, COURT } from './config.js';

// AI：每幀把「意圖」寫進 player.ctrl（與玩家輸入同一介面）
// 分成四種情境：持球進攻 / 無球跑位 / 防守盯人 / 搶自由球

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function go(p, x, z, stop = 0.25) {
  const dx = x - p.pos.x;
  const dz = z - p.pos.z;
  const d = Math.hypot(dx, dz);
  if (d < stop) { p.ctrl.mx = p.ctrl.mz = 0; return d; }
  const k = Math.min(1, d / 0.9) / d;
  p.ctrl.mx = dx * k;
  p.ctrl.mz = dz * k;
  return d;
}

function nearestOpp(p, m) {
  let best = null;
  let bd = 1e9;
  for (const o of m.opponents(p)) {
    if (o.state === 'down') continue;
    const d = dist(p.pos, o.pos);
    if (d < bd) { bd = d; best = o; }
  }
  return [best, bd];
}

// 點 o 到線段 a→b 的距離
function segDist(a, b, o) {
  const vx = b.x - a.x;
  const vz = b.z - a.z;
  const l2 = vx * vx + vz * vz || 1;
  const t = Math.max(0, Math.min(1, ((o.x - a.x) * vx + (o.z - a.z) * vz) / l2));
  return Math.hypot(a.x + vx * t - o.x, a.z + vz * t - o.z);
}

export function aiControl(p, m, dt) {
  const c = p.ctrl;
  c.mx = c.mz = 0;
  c.a = c.aDown = c.bDown = c.turbo = false;
  if (p.state !== 'free') return;
  const ball = m.ball;
  p.ai.think -= dt;
  if (ball.holder === p) handler(p, m, dt);
  else if (ball.state === 'loose') loose(p, m, dt);
  else if (m.teamHasBall(p.team)) offBall(p, m, dt);
  else defend(p, m, dt);
}

// ───────── 持球進攻 ─────────
// 每次拿到球先決定打法：drive 切入 / spot 走到外線定點出手
function handler(p, m, dt) {
  const c = p.ctrl;
  const ai = p.ai;
  const D = m.diffOf(p);
  const hoop = m.hoops[p.team];
  const dir = m.dir(p.team);
  const d = dist(p.pos, hoop);
  const [opp, dn] = nearestOpp(p, m);
  const front = (p.pos.z - hoop.z) * -dir > 0.3;
  const dunkR = TUNING.dunkRange + (p.info.dnk - 5) * 0.08 - 0.35;
  const laneBlocked = !!opp && dn < 2.4 && segDist(p.pos, hoop, opp.pos) < 0.9;
  const openK = !opp ? 1 : Math.max(0.12, Math.min(1, (dn - 0.9) / 1.3));

  if (ai.planId !== m.holdCount) {
    ai.planId = m.holdCount;
    ai.planT = 0;
    ai.useTurbo = p.onFire || Math.random() < D.turbo;
    const pSpot = p.onFire ? 0.65 : 0.12 + p.info.sht * 0.04;
    ai.plan = d > dunkR + 1 && Math.random() < pSpot ? 'spot' : 'drive';
    if (ai.plan === 'spot') {
      // 射手站三分線、其他人站中距離
      const list = p.info.sht >= 7 ? [[4.6, 4.3], [-4.6, 4.3], [0, 6.2], [5.6, 1.2], [-5.6, 1.2]] : [[2.4, 3.8], [-2.4, 3.8], [0, 4.6], [3.6, 2.2], [-3.6, 2.2]];
      let best = list[0];
      let bs = 1e9;
      for (const sp of list) {
        const sc = Math.hypot(hoop.x + sp[0] - p.pos.x, hoop.z - dir * sp[1] - p.pos.z) + Math.random() * 3;
        if (sc < bs) { bs = sc; best = sp; }
      }
      ai.spot.set(hoop.x + best[0], 0, hoop.z - dir * best[1]);
    }
  }
  ai.planT += dt;

  let arrived = false;
  if (ai.plan === 'spot') {
    const ds = go(p, ai.spot.x, ai.spot.z, 0.45);
    arrived = ds < 0.6;
    c.turbo = ai.useTurbo && ds > 5 && p.turbo > 0.4;
    if (ai.planT > 3.2) ai.plan = 'drive';
  } else {
    // 目標：籃框前；路上有人就繞
    let tx = hoop.x;
    let tz = hoop.z - dir * 1.0;
    ai.sideT -= dt;
    if (laneBlocked) {
      if (ai.sideT <= 0) {
        ai.side = (p.pos.x - opp.pos.x >= 0 ? 1 : -1) * (Math.random() < 0.8 ? 1 : -1);
        if (Math.abs(p.pos.x) > COURT.halfW - 1.2) ai.side = -Math.sign(p.pos.x);
        ai.sideT = 0.8 + Math.random() * 0.8;
      }
      tx = p.pos.x + ((hoop.x - p.pos.x) / (d || 1)) * 1.6 + ai.side * 2.4;
      tz = p.pos.z + ((hoop.z - p.pos.z) / (d || 1)) * 1.6;
    }
    go(p, tx, tz, 0.3);
    c.turbo = ai.useTurbo && p.turbo > 0.35 && d < 9 && d > 1.2;
  }
  // 剛拿到球：先慢慢運球組織，不急著進攻（難度越低拖越久）
  const setup = ai.planT < D.setup && d > TUNING.layupRange;
  if (setup) {
    c.mx *= 0.55;
    c.mz *= 0.55;
    c.turbo = false;
  }

  if (ai.think > 0) return;
  ai.think = D.think * (0.7 + Math.random() * 0.6);
  if (setup && m.shotClock > 4) return;
  const skill = (p.info.sht / 6) * D.shotIQ;

  // 定點出手
  if (ai.plan === 'spot' && (arrived || ai.planT > 2.2)) {
    if (Math.random() < 0.8 * Math.max(openK, 0.45)) { c.aDown = true; return; }
  }
  if (front && d < dunkR && d > 0.7 && p.info.dnk >= 3 && (p.turbo > 0.15 || p.onFire) && Math.random() < (laneBlocked ? 0.35 : 1) * D.dunk) {
    c.turbo = true;
    c.aDown = true;
    return;
  }
  if (front && d < TUNING.layupRange && Math.random() < 0.7) { c.aDown = true; return; }
  if (m.shotClock < 3.5 || m.clock < 1.2) { c.aDown = true; return; }

  const three = d > COURT.threeR && d < COURT.threeR + 1.4;
  const mid = d >= TUNING.layupRange && d <= COURT.threeR;
  if (three && Math.random() < 0.22 * skill * openK) { c.aDown = true; return; }
  if (mid && Math.random() < (laneBlocked ? 0.3 : 0.12) * skill * Math.max(openK, 0.35)) { c.aDown = true; return; }

  // 傳球：被貼防、或隊友位置更好
  const mate = m.mate(p);
  if (mate.state === 'free') {
    let lane = true;
    for (const o of m.opponents(p)) if (o.state !== 'down' && segDist(p.pos, mate.pos, o.pos) < 0.9) lane = false;
    if (lane) {
      const [, mdn] = nearestOpp(mate, m);
      const md = dist(mate.pos, hoop);
      if ((openK < 0.5 && Math.random() < 0.35) || (mdn > 2.2 && md < d - 2 && Math.random() < 0.5)) c.bDown = true;
    }
  }
}

// ───────── 無球跑位 ─────────
const SPOTS = [
  [5.1, 0.9], [-5.1, 0.9], // 底角
  [4.4, 4.4], [-4.4, 4.4], // 側翼
  [0, 6.3], // 弧頂
  [2.3, 3.6], [-2.3, 3.6], // 肘區
  [1.7, 0.9], [-1.7, 0.9], // 籃下
];

function offBall(p, m, dt) {
  const c = p.ctrl;
  const ai = p.ai;
  const ball = m.ball;
  const hoop = m.hoops[p.team];
  const dir = m.dir(p.team);

  // 投籃在空中：衝搶籃板
  if (ball.state === 'shot') {
    const d = go(p, hoop.x + (p.idx ? 1.1 : -1.1), hoop.z - dir * 1.5, 0.4);
    c.turbo = d > 2.5 && p.turbo > 0.3;
    return;
  }

  ai.spotT -= dt;
  if (ai.spotT <= 0) {
    ai.spotT = 2 + Math.random() * 2.2;
    const h = ball.holder || ball.target || p;
    let best = null;
    let bs = -1e9;
    for (const [sx, sz] of SPOTS) {
      const x = hoop.x + sx;
      const z = hoop.z - dir * sz;
      let s = Math.min(6, Math.hypot(x - h.pos.x, z - h.pos.z)) * 1.2 + Math.random() * 4;
      for (const o of m.opponents(p)) s += Math.min(3, Math.hypot(x - o.pos.x, z - o.pos.z)) * 0.6;
      s -= Math.hypot(x - p.pos.x, z - p.pos.z) * 0.25;
      if (s > bs) { bs = s; best = [x, z]; }
    }
    ai.spot.set(best[0], 0, best[1]);
  }
  const d = go(p, ai.spot.x, ai.spot.z, 0.35);
  c.turbo = d > 4 && p.turbo > 0.4;
}

// ───────── 防守盯人 ─────────
function defend(p, m, dt) {
  const c = p.ctrl;
  const ai = p.ai;
  const D = m.diffOf(p);
  const ball = m.ball;
  const own = m.hoops[1 - p.team];
  const opps = m.opponents(p);
  const mate = m.mate(p);

  // 盯人分配：直接或交叉，取總距離較短者（含遲滯避免來回換）
  ai.markT -= dt;
  if (!ai.mark || ai.markT <= 0) {
    ai.markT = 0.6;
    const straight = dist(p.pos, opps[p.idx].pos) + dist(mate.pos, opps[1 - p.idx].pos);
    const cross = dist(p.pos, opps[1 - p.idx].pos) + dist(mate.pos, opps[p.idx].pos);
    const cur = ai.mark || opps[p.idx];
    const want = straight <= cross ? opps[p.idx] : opps[1 - p.idx];
    ai.mark = Math.abs(straight - cross) > 1.5 ? want : cur;
    // 隊友是玩家時，補防玩家沒顧到的人
    if (mate.isUser) {
      const userNear = dist(mate.pos, opps[0].pos) < dist(mate.pos, opps[1].pos) ? opps[0] : opps[1];
      ai.mark = userNear === opps[0] ? opps[1] : opps[0];
    }
  }
  const mark = ai.mark;
  const carrier = ball.holder && ball.holder.team !== p.team ? ball.holder : null;
  const onBall = carrier === mark;

  // 站在對手與本方籃框之間
  let ux = own.x - mark.pos.x;
  let uz = own.z - mark.pos.z;
  const ul = Math.hypot(ux, uz) || 1;
  ux /= ul;
  uz /= ul;
  const gap = onBall ? D.gap : Math.min(2.4, ul * 0.4);
  let tx = mark.pos.x + ux * gap;
  let tz = mark.pos.z + uz * gap;

  // 協防：持球者已甩開隊友，往籃下補位
  if (carrier && !onBall && dist(carrier.pos, own) < dist(mate.pos, own) - 1 && dist(carrier.pos, own) < 6) {
    tx = (carrier.pos.x + own.x) / 2;
    tz = (carrier.pos.z + own.z) / 2;
  }
  // 投籃在空中：卡位搶籃板
  if (ball.state === 'shot') {
    tx = own.x + (p.idx ? 0.9 : -0.9);
    tz = own.z + m.dir(p.team) * 1.3;
  }
  const d = go(p, tx, tz, 0.18);
  c.turbo = d > 2.6 && p.turbo > 0.3;

  // 對手飛向籃框：籃下的人抓時機起跳（不限盯防者）
  if (carrier && carrier.state === 'dunk' && dist(p.pos, own) < 2.8) {
    if (!ai.rolled) {
      ai.rolled = true;
      ai.will = Math.random() < D.block * (0.7 + p.info.def * 0.06);
    }
    if (ai.will && carrier.t >= carrier.dk.T * 0.8 - 0.4 && p.cd.jump <= 0) c.aDown = true;
    return;
  }
  if (!onBall) { ai.rolled = false; return; }
  const dm = dist(p.pos, mark.pos);

  // 封蓋：對手起跳後依難度機率與反應時間跟跳
  if (mark.state === 'shoot' && !mark.released && dm < 2.4) {
    if (!ai.rolled) {
      ai.rolled = true;
      ai.will = Math.random() < D.block * (0.7 + p.info.def * 0.06);
      ai.react = 0.05 + (1 - D.block) * 0.22 + Math.random() * 0.08;
    }
    ai.react -= dt;
    if (ai.will && ai.react <= 0 && p.cd.jump <= 0) c.aDown = true;
    return;
  }
  ai.rolled = false;

  // 抄截 / 推人
  if (mark.state === 'free' && dm < TUNING.stealRange * 0.92 && p.cd.steal <= 0 && Math.random() < D.steal * dt) {
    if (p.turbo > 0.5 && Math.random() < D.shove) c.turbo = true;
    c.bDown = true;
  }
}

// ───────── 自由球 ─────────
function loose(p, m, dt) {
  const c = p.ctrl;
  const ball = m.ball;
  const mate = m.mate(p);
  const dir = m.dir(p.team);
  const reserved = ball.reservedTeam;

  // 對方發球：退防
  if (reserved != null && reserved !== p.team) {
    const own = m.hoops[1 - p.team];
    const d = go(p, own.x + (p.idx ? 2.2 : -2.2), own.z + dir * (4.5 + p.idx * 1.5), 0.4);
    c.turbo = d > 6 && p.turbo > 0.5;
    return;
  }

  const myD = dist(p.pos, ball.pos);
  const mateD = dist(mate.pos, ball.pos);
  let chase = myD <= mateD || mate.state === 'down';
  // 隊友是玩家：玩家比較近就讓玩家撿，拖太久再幫忙
  if (mate.isUser && mateD < myD) chase = ball.looseT > 1.3 && reserved === p.team;

  if (chase) {
    go(p, ball.pos.x + ball.vel.x * 0.15, ball.pos.z + ball.vel.z * 0.15, 0.1);
    c.turbo = myD > 2 && p.turbo > 0.2;
    // 高球：起跳搶
    if (ball.pos.y > 2.5 && ball.pos.y < 3.7 && myD < 1.1 && ball.vel.y < 0 && p.cd.jump <= 0 && Math.random() < 6 * dt) c.aDown = true;
  } else if (reserved === p.team) {
    // 我方發球：先往前場跑
    const hoop = m.hoops[p.team];
    const d = go(p, hoop.x + (p.idx ? 3.6 : -3.6), hoop.z - dir * 6.5, 0.5);
    c.turbo = d > 6 && p.turbo > 0.5;
  } else {
    // 守在球與本方籃框之間
    const own = m.hoops[1 - p.team];
    go(p, (ball.pos.x + own.x) / 2, (ball.pos.z + own.z) / 2, 0.5);
  }
}
