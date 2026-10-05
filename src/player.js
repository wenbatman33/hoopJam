import * as THREE from 'three';
import { TUNING, COURT, VISUAL } from './config.js';
import { POSES, mixPose, mirrorPose } from './poses.js';
import { blobTexture, ringTexture, arrowTexture } from './textures.js';
import { BALL_R } from './ball.js';

// 球員實體：移動、動作狀態機（投籃 / 灌籃 / 傳球 / 抄截 / 推人 / 起跳 / 倒地）與動畫選擇
// 控制意圖寫在 ctrl（由玩家輸入或 AI 填入），這裡只負責執行

const TAU = Math.PI * 2;
const _a = new THREE.Vector3();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
export function angDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

let shared = null;
function getShared() {
  if (!shared) shared = { blob: blobTexture(), ring: ringTexture(), arrow: arrowTexture(), plane: new THREE.PlaneGeometry(1, 1) };
  return shared;
}

export class Player {
  constructor(match, team, idx, info, teamDef, baller) {
    this.m = match;
    this.team = team;
    this.idx = idx;
    this.info = info;
    this.teamDef = teamDef;
    this.vis = baller;
    this.scaleH = info.h || 1;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.y = 0;
    this.vy = 0;
    this.heading = team === 0 ? Math.PI : 0;
    this.state = 'free';
    this.t = 0;
    this.turbo = 1;
    this.turboOn = false;
    this.streak = 0;
    this.onFire = false;
    this.fireShots = 0;
    this.isUser = false;
    this.speedMul = 1;
    this.cd = { steal: 0, shove: 0, jump: 0 };
    this.ctrl = { mx: 0, mz: 0, turbo: false, a: false, aDown: false, bDown: false };
    this.stats = { pts: 0, three: 0, dunk: 0, stl: 0, blk: 0, reb: 0 };
    this.ai = { think: Math.random() * 0.3, spot: new THREE.Vector3(), spotT: 0, side: 1, sideT: 0, react: 0, rolled: false, will: false, mark: null, markT: 0, plan: 'drive', planId: -1, planT: 0, useTurbo: true };
    // 動作暫存
    this.released = false;
    this.shotKind = 'jump';
    this.quick = false;
    this.vy0 = 0;
    this.aiRel = 0;
    this.dk = null;
    this.hit = false;
    this.passed = false;
    this.cheerT = 0;
    this.lean = 0;
    this.dribU = Math.random();
    this.dribSide = -1; // -1 右手、+1 左手
    this.dribSideT = 0;
    this._p1 = {};
    this._p2 = {};

    const sh = getShared();
    const flat = (map, color) => {
      const mesh = new THREE.Mesh(sh.plane, new THREE.MeshBasicMaterial({ map, color, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      mesh.rotation.x = -Math.PI / 2;
      return mesh;
    };
    this.shadow = flat(sh.blob, '#ffffff');
    this.shadow.renderOrder = 1;
    this.ring = flat(sh.ring, teamDef.jersey);
    this.ring.renderOrder = 2;
    this.arrow = new THREE.Sprite(new THREE.SpriteMaterial({ map: sh.arrow, depthTest: false, transparent: true }));
    this.arrow.renderOrder = 30;
    this.arrow.scale.set(0.6, 0.6, 1);
    this.arrow.visible = false;
    match.scene.add(baller.root, this.shadow, this.ring, this.arrow);
  }

  place(x, z, heading) {
    this.pos.set(x, 0, z);
    this.vel.set(0, 0, 0);
    this.y = 0;
    this.vy = 0;
    this.heading = heading;
    this.state = 'free';
    this.t = 0;
    this.lean = 0;
  }

  get speed() { return Math.hypot(this.vel.x, this.vel.z); }
  get maxSpeed() { return TUNING.runSpeed * (0.9 + this.info.spd * 0.02) * this.speedMul; }

  // 可以接 / 撿球的狀態
  canGrab() {
    return this.state === 'free' || this.state === 'block' || this.state === 'steal';
  }

  // ───────── 邏輯更新 ─────────
  update(dt) {
    const T = TUNING;
    this.t += dt;
    this.cd.steal = Math.max(0, this.cd.steal - dt);
    this.cd.shove = Math.max(0, this.cd.shove - dt);
    this.cd.jump = Math.max(0, this.cd.jump - dt);
    this.cheerT = Math.max(0, this.cheerT - dt);
    const has = this.m.ball.holder === this;
    this.turboOn = false;
    switch (this.state) {
      case 'free': this._free(dt, has); break;
      case 'shoot': this._shoot(dt); break;
      case 'dunk': this._dunk(dt); break;
      case 'pass': this._pass(dt, has); break;
      case 'steal': this._steal(dt); break;
      case 'shove': this._shove(dt); break;
      case 'block': this._air(dt); break;
      case 'fall': this._air(dt); break;
      case 'down': this._down(dt); break;
    }
    if (this.onFire) this.turbo = 1;
    else if (!this.turboOn) this.turbo = Math.min(1, this.turbo + T.turboRegen * dt);

    if (this.state !== 'dunk') {
      this.pos.x += this.vel.x * dt;
      this.pos.z += this.vel.z * dt;
    }
    const bx = COURT.halfW + COURT.margin;
    const bz = COURT.halfL + COURT.margin;
    this.pos.x = clamp(this.pos.x, -bx, bx);
    this.pos.z = clamp(this.pos.z, -bz, bz);
  }

  _move(dt, has, mul = 1) {
    const c = this.ctrl;
    let mx = c.mx;
    let mz = c.mz;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    const turbo = c.turbo && len > 0.1 && (this.turbo > 0.02 || this.onFire);
    this.turboOn = turbo;
    let sp = this.maxSpeed * mul;
    if (turbo) sp *= TUNING.turboMul;
    if (has) sp *= TUNING.ballCarryMul;
    const a = 1 - Math.exp(-TUNING.accel * dt);
    this.vel.x += (mx * sp - this.vel.x) * a;
    this.vel.z += (mz * sp - this.vel.z) * a;
    if (turbo && !this.onFire) this.turbo = Math.max(0, this.turbo - TUNING.turboDrain * dt);
  }

  _turn(want, dt, rate = TUNING.turnRate) {
    this.heading += angDiff(this.heading, want) * (1 - Math.exp(-rate * dt));
  }

  _face(dt, has) {
    const m = this.m;
    const ball = m.ball;
    const sp = this.speed;
    let want = this.heading;
    if (has) {
      if (sp > 0.8) want = Math.atan2(this.vel.x, this.vel.z);
      else {
        const h = m.hoops[this.team];
        want = Math.atan2(h.x - this.pos.x, h.z - this.pos.z);
      }
    } else if (m.teamHasBall(this.team) || ball.state === 'loose') {
      if (sp > 0.8) want = Math.atan2(this.vel.x, this.vel.z);
      else want = Math.atan2(ball.pos.x - this.pos.x, ball.pos.z - this.pos.z);
    } else {
      // 防守：面向球
      const dx = ball.pos.x - this.pos.x;
      const dz = ball.pos.z - this.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 100 && d2 > 0.1) want = Math.atan2(dx, dz);
      else if (sp > 0.8) want = Math.atan2(this.vel.x, this.vel.z);
    }
    this._turn(want, dt);
  }

  _faceHoop(dt, rate = 16) {
    const h = this.m.hoops[this.team];
    this._turn(Math.atan2(h.x - this.pos.x, h.z - this.pos.z), dt, rate);
  }

  _free(dt, has) {
    const c = this.ctrl;
    const m = this.m;
    this._move(dt, has);
    this._face(dt, has);
    if (has) {
      if (c.aDown) this.startShot();
      else if (c.bDown) this.startPass();
      return;
    }
    if (c.aDown && this.cd.jump <= 0) { this.startJump(); return; }
    if (c.bDown && !m.teamHasBall(this.team)) {
      if (c.turbo && this.cd.shove <= 0 && (this.turbo >= TUNING.shoveCost || this.onFire)) this.startShove();
      else if (this.cd.steal <= 0) this.startSteal();
    }
  }

  // ───────── 投籃 / 上籃 ─────────
  startShot() {
    const m = this.m;
    const hoop = m.hoops[this.team];
    const dir = m.dir(this.team);
    const d = Math.hypot(hoop.x - this.pos.x, hoop.z - this.pos.z);
    const front = (this.pos.z - hoop.z) * -dir > -0.3; // 在籃板前方
    const range = TUNING.dunkRange + (this.info.dnk - 5) * 0.08;
    if (this.ctrl.turbo && front && d < range && d > 0.5 && this.info.dnk >= 2 && (this.turbo > 0.06 || this.onFire)) {
      this.startDunk(d);
      return;
    }
    this.state = 'shoot';
    this.t = 0;
    this.released = false;
    this.quick = false;
    this.shotKind = d < TUNING.layupRange && front ? 'layup' : 'jump';
    this.vy0 = this.vy = TUNING.jumpVel * (this.shotKind === 'layup' ? 0.85 : 0.95);
    if (this.shotKind === 'jump') this.vel.multiplyScalar(0.35);
    else {
      // 上籃：往籃框滑行
      const k = Math.min(this.maxSpeed, d * 1.6) / (d || 1);
      this.vel.set((hoop.x - this.pos.x) * k * 0.7, 0, (hoop.z - this.pos.z) * k * 0.7);
    }
    const apexT = this.vy0 / TUNING.gravity;
    this.aiRel = apexT * (0.9 + Math.random() * 0.14);
  }

  _shoot(dt) {
    const c = this.ctrl;
    const g = TUNING.gravity;
    const apexT = this.vy0 / g;
    this.vy -= g * dt;
    this.y += this.vy * dt;
    this.vel.multiplyScalar(Math.exp(-(this.shotKind === 'layup' ? 1.4 : 3.5) * dt));
    this._faceHoop(dt);
    if (!this.released) {
      let rel = false;
      if (this.shotKind === 'layup') rel = this.t >= apexT * 0.85;
      else if (!this.isUser) rel = this.t >= this.aiRel;
      else {
        if (!c.a && this.t < 0.15) this.quick = true; // 點一下 → 自動在最高點出手
        if (this.quick) rel = this.t >= apexT * 0.97;
        else if (!c.a) rel = true; // 放開出手
        else rel = this.t >= apexT + 0.16; // 按太久
      }
      if (rel) this._release(apexT);
    }
    if (this.y <= 0 && this.vy < 0) {
      this.y = 0;
      this.vy = 0;
      if (!this.released) this._release(apexT);
      this.state = 'free';
      this.cd.jump = 0.12;
    }
  }

  _release(apexT) {
    const delta = this.t - apexT;
    let timing = 0;
    let perfect = false;
    if (this.shotKind === 'jump' && this.isUser && !this.quick) {
      if (Math.abs(delta) < 0.075) { timing = TUNING.perfectBonus; perfect = true; }
      else timing = -Math.min(0.12, Math.abs(delta) * 0.45);
    } else if (this.shotKind === 'jump' && !this.isUser) timing = (this.m.diffOf(this).shotIQ - 0.8) * 0.15;
    this.released = true;
    this.m.releaseShot(this, timing, perfect);
  }

  // ───────── 灌籃 ─────────
  startDunk(d) {
    const m = this.m;
    const hoop = m.hoops[this.team];
    const court = -m.dir(this.team); // 球場側的 z 方向
    let ax = this.pos.x - hoop.x;
    let az = this.pos.z - hoop.z;
    const l = Math.hypot(ax, az) || 1;
    ax /= l;
    az /= l;
    if (az * court < 0.45) {
      az = 0.45 * court;
      const n = Math.hypot(ax, az);
      ax /= n;
      az /= n;
    }
    const far = d > 2.5;
    this.dk = {
      x0: this.pos.x, z0: this.pos.z,
      x1: hoop.x + ax * 0.55, z1: hoop.z + az * 0.55,
      T: TUNING.dunkTime * (0.72 + d * 0.12),
      flip: this.onFire || (far && this.info.dnk >= 7 && Math.random() < 0.5),
      two: Math.random() < 0.4,
      face: Math.atan2(-ax, -az),
      checked: false, done: false, hang: 0,
    };
    this.state = 'dunk';
    this.t = 0;
    this.vel.set(0, 0, 0);
    this.vy = 0;
    if (!this.onFire) this.turbo = Math.max(0, this.turbo - 0.12);
    m.onDunkStart(this);
  }

  _dunk(dt) {
    const k = this.dk;
    const m = this.m;
    const s = Math.min(1, this.t / k.T);
    const e = s * s * (3 - 2 * s);
    this.pos.x = lerp(k.x0, k.x1, e);
    this.pos.z = lerp(k.z0, k.z1, e);
    const yEnd = Math.max(0.35, COURT.rimH - TUNING.dunkReach * this.scaleH);
    this.y = yEnd * s + TUNING.dunkArc * Math.sin(Math.PI * s);
    this._turn(k.face, dt, 18);
    if (!k.checked && s >= 0.8) {
      k.checked = true;
      if (m.tryDunkBlock(this)) {
        this.state = 'fall';
        this.vy = 0;
        return;
      }
    }
    if (s >= 1 && !k.done) {
      k.done = true;
      k.hang = 0.26;
      m.dunkScore(this);
    }
    if (k.done) {
      k.hang -= dt;
      if (k.hang <= 0) {
        this.state = 'fall';
        this.vy = 0;
        this.cheerT = 1.3;
      }
    }
  }

  // ───────── 傳球 ─────────
  startPass() {
    this.state = 'pass';
    this.t = 0;
    this.passed = false;
  }

  _pass(dt, has) {
    const mate = this.m.mate(this);
    this._move(dt, has, 0.5);
    this._turn(Math.atan2(mate.pos.x - this.pos.x, mate.pos.z - this.pos.z), dt, 24);
    if (!this.passed && this.t >= 0.09) {
      this.passed = true;
      if (has) this.m.ball.pass(this, mate);
    }
    if (this.t >= 0.26) this.state = 'free';
  }

  // ───────── 抄截 ─────────
  startSteal() {
    const h = this.m.ball.holder;
    this.state = 'steal';
    this.t = 0;
    this.hit = false;
    this.cd.steal = TUNING.stealCooldown;
    if (h && h.team !== this.team && this.pos.distanceTo(h.pos) < 3) this.heading = Math.atan2(h.pos.x - this.pos.x, h.pos.z - this.pos.z);
    this.vel.x += Math.sin(this.heading) * 2.2;
    this.vel.z += Math.cos(this.heading) * 2.2;
  }

  _steal(dt) {
    this.vel.multiplyScalar(Math.exp(-5 * dt));
    if (!this.hit && this.t >= 0.1) {
      this.hit = true;
      this.m.trySteal(this);
    }
    if (this.t >= 0.32) this.state = 'free';
  }

  // ───────── 推人 ─────────
  startShove() {
    this.state = 'shove';
    this.t = 0;
    this.hit = false;
    this.cd.shove = 0.55;
    if (!this.onFire) this.turbo = Math.max(0, this.turbo - TUNING.shoveCost);
    // 對準最近的對手
    let best = null;
    let bd = 3.2;
    for (const o of this.m.opponents(this)) {
      const d = this.pos.distanceTo(o.pos);
      if (o.state !== 'down' && d < bd) { bd = d; best = o; }
    }
    if (best) this.heading = Math.atan2(best.pos.x - this.pos.x, best.pos.z - this.pos.z);
  }

  _shove(dt) {
    const sh = Math.sin(this.heading);
    const ch = Math.cos(this.heading);
    const f = this.t < 0.2 ? TUNING.shoveSpeed : 0;
    const a = 1 - Math.exp(-18 * dt);
    this.vel.x += (sh * f - this.vel.x) * a;
    this.vel.z += (ch * f - this.vel.z) * a;
    if (!this.hit && this.t > 0.04 && this.t < 0.3) {
      for (const o of this.m.opponents(this)) {
        if (o.state === 'down') continue;
        if (o.state === 'dunk' && o.t / o.dk.T > 0.45) continue; // 灌籃後半段無敵
        const dx = o.pos.x - this.pos.x;
        const dz = o.pos.z - this.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > TUNING.shoveRange || Math.abs(o.y - this.y) > 1.3) continue;
        if (d > 0.3 && (dx * sh + dz * ch) / d < 0.25) continue;
        this.hit = true;
        o.knockDown(sh, ch, 5.5);
        this.m.onShove(this, o);
        break;
      }
    }
    if (this.t >= 0.42) this.state = 'free';
  }

  knockDown(dx, dz, force) {
    if (this.state === 'down') return;
    const ball = this.m.ball;
    if (ball.holder === this) ball.knockLoose(dx * 2.6 + (Math.random() - 0.5) * 2, 3.6, dz * 2.6 + (Math.random() - 0.5) * 2, this);
    this.state = 'down';
    this.t = 0;
    this.vel.set(dx * force, 0, dz * force);
    this.vy = 0;
  }

  _down(dt) {
    this.vel.multiplyScalar(Math.exp(-4.5 * dt));
    this.y = Math.max(0, this.y - 7 * dt);
    if (this.t >= TUNING.downTime) this.state = 'free';
  }

  // ───────── 起跳（蓋火鍋 / 搶籃板）與落地 ─────────
  startJump() {
    this.state = 'block';
    this.t = 0;
    this.vy = TUNING.jumpVel * (0.95 + this.info.def * 0.012);
    this.vel.multiplyScalar(0.55);
  }

  _air(dt) {
    this.vy -= TUNING.gravity * dt;
    this.y += this.vy * dt;
    this.vel.multiplyScalar(Math.exp(-1.2 * dt));
    if (this.y <= 0 && this.vy <= 0) {
      this.y = 0;
      this.vy = 0;
      this.state = 'free';
      this.cd.jump = 0.22;
    }
  }

  // ───────── 持球位置 ─────────
  ballAnchor(out) {
    const v = this.vis;
    const st = this.state;
    const sh = Math.sin(this.heading);
    const ch = Math.cos(this.heading);
    if ((st === 'dunk' && !this.dk.two) || (st === 'shoot' && this.shotKind === 'layup')) {
      v.hand('R', out);
      out.x += sh * 0.06;
      out.z += ch * 0.06;
      out.y += 0.05;
    } else if (st === 'shoot' || st === 'pass' || st === 'dunk') {
      v.hand('L', _a);
      v.hand('R', out);
      out.add(_a).multiplyScalar(0.5);
      out.x += sh * 0.1;
      out.z += ch * 0.1;
      out.y += 0.06;
    } else {
      // 運球
      const side = this.dribSide;
      const lx = side * 0.36;
      const fz = 0.4 + this.speed * 0.025;
      v.hand(side > 0 ? 'L' : 'R', _a);
      const top = clamp(_a.y - 0.13, this.y + 0.55, this.y + 1.2 * this.scaleH);
      const u = this.dribU * 2 - 1;
      out.set(this.pos.x + ch * lx + sh * fz, BALL_R + (top - BALL_R) * u * u, this.pos.z - sh * lx + ch * fz);
    }
    return out;
  }

  // ───────── 視覺更新（動畫、姿勢、標記）─────────
  updateVisual(dt) {
    const v = this.vis;
    const m = this.m;
    const ball = m.ball;
    const has = ball.holder === this;
    const sp = this.speed;
    const P = POSES;
    v.root.position.set(this.pos.x, this.y, this.pos.z);
    v.root.rotation.y = this.heading;

    let pose = null;
    let sharp = 14;
    let lean = 0;
    let flip = 0;

    switch (this.state) {
      case 'down':
        v.setBase('Death', 1.15, 0.08);
        break;
      case 'dunk': {
        const k = this.dk;
        const s = Math.min(1, this.t / k.T);
        v.setBase('Run', 0, 0.1, 0.2);
        const wind = k.two ? P.dunk2Wind : P.dunkWind;
        const slam = k.two ? P.dunk2Slam : P.dunkSlam;
        if (s < 0.72) pose = mixPose(P.hold, wind, smooth(0.02, 0.4, s), this._p1);
        else pose = mixPose(wind, slam, smooth(0.72, 0.97, s), this._p1);
        sharp = 26;
        lean = lerp(-0.3, 0.32, smooth(0.6, 1, s));
        if (k.flip) flip = smooth(0.08, 0.78, s) * TAU;
        break;
      }
      case 'shoot': {
        v.setBase('Idle', 1, 0.12);
        const apexT = this.vy0 / TUNING.gravity;
        if (this.shotKind === 'layup') {
          pose = this.released ? P.shootRelease : mixPose(P.hold, P.shootRelease, smooth(0, apexT * 0.8, this.t), this._p1);
        } else if (this.released) pose = P.shootRelease;
        else pose = mixPose(P.shootSet, P.shootRelease, smooth(apexT * 0.45, apexT * 1.05, this.t) * 0.55, this._p1);
        sharp = this.released ? 26 : 20;
        break;
      }
      case 'block':
        v.setBase('Idle', 1, 0.12);
        pose = P.block;
        sharp = 22;
        break;
      case 'fall':
        v.setBase('Idle', 1, 0.15);
        break;
      case 'pass':
        this._loco(v, sp);
        pose = this.t < 0.08 ? P.passWind : P.passThrow;
        sharp = 30;
        break;
      case 'steal':
        this._loco(v, sp);
        pose = mixPose(P.stealA, P.stealB, smooth(0.03, 0.2, this.t), this._p1);
        sharp = 30;
        lean = 0.22;
        break;
      case 'shove':
        this._loco(v, sp);
        pose = P.shove;
        sharp = 30;
        lean = 0.42;
        break;
      default: {
        this._loco(v, sp);
        lean = (sp / (TUNING.runSpeed * TUNING.turboMul)) * (this.turboOn ? 0.2 : 0.08);
        if (has) {
          // 運球：手跟著球上下
          const prev = this.dribU;
          this.dribU = (this.dribU + dt * (2.0 + sp * 0.22)) % 1;
          if (prev < 0.5 && this.dribU >= 0.5) m.audio.bounce(0.45);
          this._pickDribbleSide(dt);
          const u = this.dribU * 2 - 1;
          pose = mixPose(P.dribbleLo, P.dribbleHi, smooth(0.25, 0.95, u * u), this._p1);
          if (this.dribSide > 0) pose = mirrorPose(pose, this._p2);
          sharp = 24;
        } else if (this.cheerT > 0) {
          pose = P.cheer;
        } else if (ball.holder && ball.holder.team !== this.team && this.pos.distanceTo(ball.holder.pos) < 4.5) {
          pose = P.defend;
          sharp = 10;
        }
      }
    }

    this.lean += (lean - this.lean) * (1 - Math.exp(-12 * dt));
    v.rig.rotation.x = this.lean + flip;
    v.pose(pose, sharp);
    v.update(dt);

    // 表情
    const st = this.state;
    let mood = 'normal';
    if (st === 'down') mood = 'dizzy';
    else if (st === 'shoot' || st === 'dunk' || st === 'steal' || st === 'shove' || st === 'block') mood = 'effort';
    else if (this.cheerT > 0 || this.onFire) mood = 'happy';
    v.setFace(mood);

    // 著火
    if (this.onFire) {
      v.setGlow(0.16 + Math.sin(m.time * 12) * 0.07);
      _a.set(this.pos.x, this.y + 0.15, this.pos.z);
      m.fx.flame(_a, 0.5, 1);
    } else if (this._glow) v.setGlow(0);
    this._glow = this.onFire;

    // 影子、圓環、箭頭
    const k = Math.min(1, this.y / 2);
    this.shadow.position.set(this.pos.x, 0.012, this.pos.z);
    this.shadow.scale.setScalar(1.25 * this.scaleH * (1 - k * 0.4));
    this.shadow.material.opacity = 0.9 - k * 0.45;
    this.ring.position.set(this.pos.x, 0.018, this.pos.z);
    const pulse = this.isUser ? 1 + Math.sin(m.time * 7) * 0.06 : 1;
    this.ring.scale.setScalar(1.3 * pulse);
    this.ring.material.opacity = VISUAL.ringOpacity * (this.isUser ? 1 : 0.55);
    this.ring.material.color.set(this.isUser ? '#ffffff' : this.teamDef.jersey);
    this.arrow.visible = this.isUser;
    if (this.isUser) this.arrow.position.set(this.pos.x, this.y + this.vis.height * (0.92 + TUNING.headScale * 0.2) + 0.5 + Math.sin(m.time * 6) * 0.07, this.pos.z);
  }

  // 依移動方向選跑步動畫（前 / 後 / 左 / 右）
  _loco(v, sp) {
    if (sp < 0.7) { v.setBase('Idle', 1, 0.2); return; }
    const sh = Math.sin(this.heading);
    const ch = Math.cos(this.heading);
    const fwd = this.vel.x * sh + this.vel.z * ch;
    const left = this.vel.x * ch - this.vel.z * sh;
    const cand = { Run: fwd, Run_Back: -fwd, Run_Left: left, Run_Right: -left };
    let best = 'Run';
    let bv = -1e9;
    for (const k in cand) {
      const s = cand[k] * (k === v.base ? 1.3 : 1);
      if (s > bv) { bv = s; best = k; }
    }
    v.setBase(best, clamp(sp / 5.4, 0.75, 1.8), 0.16);
  }

  // 用遠離防守者的那隻手運球
  _pickDribbleSide(dt) {
    this.dribSideT -= dt;
    if (this.dribSideT > 0) return;
    this.dribSideT = 0.5;
    let best = null;
    let bd = 3;
    for (const o of this.m.opponents(this)) {
      const d = this.pos.distanceTo(o.pos);
      if (d < bd) { bd = d; best = o; }
    }
    if (!best) return;
    const leftDot = (best.pos.x - this.pos.x) * Math.cos(this.heading) - (best.pos.z - this.pos.z) * Math.sin(this.heading);
    if (leftDot > 0.25) this.dribSide = -1;
    else if (leftDot < -0.25) this.dribSide = 1;
  }

  dispose() {
    this.vis.dispose();
    this.shadow.removeFromParent();
    this.ring.removeFromParent();
    this.arrow.removeFromParent();
    this.shadow.material.dispose();
    this.ring.material.dispose();
    this.arrow.material.dispose();
  }
}
