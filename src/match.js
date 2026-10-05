import * as THREE from 'three';
import { TUNING, COURT, DIFFICULTY, MATE_AI, resolveKits, accentOf } from './config.js';
import { Baller } from './models.js';
import { Player } from './player.js';
import { Ball } from './ball.js';
import { aiControl } from './ai.js';

// 一場比賽：四名球員 + 球 + 規則（計分、著火、進攻時間、節次）

const _v = new THREE.Vector3();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export class Match {
  // opts: { teams: [主隊, 客隊], difficulty, quarterSeconds, demo }
  constructor(game, opts) {
    this.g = game;
    this.scene = game.scene;
    this.audio = game.audio;
    this.fx = game.fx;
    this.ui = game.ui;
    this.court = game.court;
    this.teams = resolveKits(opts.teams[0], opts.teams[1]); // 撞色時客隊換客場球衣
    this.diff = DIFFICULTY[opts.difficulty] || DIFFICULTY.normal;
    this.demo = !!opts.demo;
    this.quarterSeconds = opts.quarterSeconds || TUNING.quarterSeconds;
    this.time = 0;
    // hoops[i] = 隊伍 i 進攻的籃框
    this.hoops = [new THREE.Vector3(0, COURT.rimH, -COURT.hoopZ), new THREE.Vector3(0, COURT.rimH, COURT.hoopZ)];

    this.players = [];
    for (let team = 0; team < 2; team++) {
      for (let idx = 0; idx < 2; idx++) {
        const def = this.teams[team];
        const info = def.players[idx];
        // 有 AI 臉部圖的球員：膚色跟著圖走，頭型照圖的輪廓
        const face = game.faceDB[info.id] || null;
        const look = { ...info, jersey: def.jersey, shorts: def.shorts, trim: def.trim, face };
        if (face) {
          look.skin = face.skin;
          look.faceUrl = `./assets/faces/${face.file}`;
        }
        const baller = new Baller(game.models, look);
        const p = new Player(this, team, idx, info, def, baller);
        // 示範賽雙方都吃難度；正式比賽只有對手吃難度
        if (team === 1 || this.demo) p.speedMul = this.diff.speed;
        this.players.push(p);
      }
    }
    this.ball = new Ball(this);
    this.score = [0, 0];
    this.quarter = 1;
    this.clock = this.quarterSeconds;
    this.shotClock = TUNING.shotClock;
    this.poss = 0;
    this.phase = 'ready';
    this.phaseT = 0;
    this.lastTick = 99;
    this.holdCount = 0; // 每次換人持球 +1（AI 用來重新決定打法）
    this.user = null;
    if (!this.demo) this.setUser(this.players[0]);
    this.court.setTeams(this.teams[0], this.teams[1]);
    this.setup(0);
  }

  dir(team) { return team === 0 ? -1 : 1; }
  // 對手（與示範賽雙方）吃難度設定；玩家隊友用固定水準
  diffOf(p) { return this.demo || p.team === 1 ? this.diff : MATE_AI; }
  mate(p) { return this.players[p.team * 2 + (1 - p.idx)]; }
  teamPlayers(team) { return [this.players[team * 2], this.players[team * 2 + 1]]; }
  opponents(p) { return this.teamPlayers(1 - p.team); }

  teamHasBall(team) {
    const b = this.ball;
    if (b.holder) return b.holder.team === team;
    if (b.state === 'shot') return b.shooter.team === team;
    if (b.state === 'pass') return b.passer.team === team;
    return false;
  }

  setUser(p) {
    if (this.user) this.user.isUser = false;
    this.user = p;
    p.isUser = true;
  }

  switchUser() {
    if (!this.user || this.ball.holder === this.user) return;
    const mate = this.mate(this.user);
    if (mate.state === 'down') return;
    this.setUser(mate);
    this.audio.click();
  }

  // 開球站位
  setup(possTeam) {
    const d = this.dir(possTeam);
    const off = this.teamPlayers(possTeam);
    const def = this.teamPlayers(1 - possTeam);
    const hOff = possTeam === 0 ? Math.PI : 0;
    off[0].place(0, -d * 1.4, hOff);
    off[1].place(3.4, d * 1.6, hOff);
    def[0].place(-0.5, d * 4.4, hOff + Math.PI);
    def[1].place(2.8, d * 5.8, hOff + Math.PI);
    for (const p of this.players) {
      const c = p.ctrl;
      c.mx = c.mz = 0;
      c.a = c.aDown = c.bDown = c.turbo = false;
      p.turbo = 1;
    }
    this.poss = possTeam;
    this.shotClock = TUNING.shotClock;
    this.ball.give(off[0], true);
    this.holdCount++;
    this.ball.shotReset = false;
    if (this.user && possTeam === this.user.team) this.setUser(off[0]);
    this.phase = 'ready';
    this.phaseT = 0;
    this.lastTick = 99;
  }

  nextQuarter() {
    this.quarter++;
    this.clock = this.quarter > TUNING.quarters ? Math.min(30, this.quarterSeconds) : this.quarterSeconds;
    this.setup((this.quarter - 1) % 2);
  }

  // ───────── 每幀更新 ─────────
  update(dt, input) {
    this.time += dt;
    this.phaseT += dt;
    const live = this.phase === 'live';
    for (const p of this.players) {
      const c = p.ctrl;
      if (!live) {
        c.mx = c.mz = 0;
        c.a = c.aDown = c.bDown = c.turbo = false;
      } else if (p === this.user) {
        c.mx = input.mx;
        c.mz = input.mz;
        c.turbo = input.turbo;
        c.a = input.a;
        c.aDown = input.aDown;
        c.bDown = input.bDown;
      } else aiControl(p, this, dt);
    }
    if (live && this.user && input.swDown) this.switchUser();
    for (const p of this.players) p.update(dt);
    this._separate();
    for (const p of this.players) p.updateVisual(dt);
    this.ball.update(dt);
    if (live) {
      this._checkBlocks();
      this._clock(dt);
    } else if (this.phase === 'ready' && this.phaseT >= 1.3) {
      this.phase = 'live';
      if (!this.demo) this.audio.whistle();
    }
  }

  _clock(dt) {
    this.clock = Math.max(0, this.clock - dt);
    const sec = Math.ceil(this.clock);
    if (!this.demo && sec <= 5 && sec > 0 && sec !== this.lastTick) {
      this.lastTick = sec;
      this.audio.beep();
    }
    if (this.ball.holder) {
      this.shotClock -= dt;
      if (this.shotClock <= 0) this._violation();
    }
    // 時間到：等空中的球與灌籃結束（壓哨球算）
    if (this.clock <= 0 && this.ball.state !== 'shot' && !this.players.some((p) => p.state === 'dunk')) {
      this.phase = 'buzzer';
      this.g.onQuarterEnd();
    }
  }

  _violation() {
    const h = this.ball.holder;
    this.audio.whistle();
    this.ui.banner('24 秒違例', '#ff5d5d');
    this.ball.knockLoose(0, 1.5, 0, h);
    this.ball.reservedTeam = 1 - h.team;
    this.ball.reservedT = 6;
    this.poss = 1 - h.team;
    this.shotClock = TUNING.shotClock;
  }

  // 球員互相推擠
  _separate() {
    const ps = this.players;
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i];
        const b = ps[j];
        if (a.state === 'down' || b.state === 'down' || Math.abs(a.y - b.y) > 1.2) continue;
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        const min = 0.74;
        if (d >= min || d < 1e-4) continue;
        const push = (min - d) / d;
        let wa = 0.5;
        let wb = 0.5;
        if (a.state === 'dunk') { wa = 0; wb = 1; }
        else if (b.state === 'dunk') { wa = 1; wb = 0; }
        a.pos.x -= dx * push * wa;
        a.pos.z -= dz * push * wa;
        b.pos.x += dx * push * wb;
        b.pos.z += dz * push * wb;
      }
    }
  }

  // ───────── 事件 ─────────
  onHold(p) {
    this.holdCount++;
    if (p.team !== this.poss || this.ball.shotReset) this.shotClock = TUNING.shotClock;
    this.ball.shotReset = false;
    this.poss = p.team;
    // 進攻時操控權跟著持球者
    if (this.user && p.team === this.user.team && p !== this.user) this.setUser(p);
  }

  isThree(pos, hoop) {
    return Math.hypot(pos.x - hoop.x, pos.z - hoop.z) > COURT.threeR || Math.abs(pos.x) > COURT.cornerX;
  }

  // 出手：計算命中率並擲骰
  releaseShot(p, timing, perfect) {
    const T = TUNING;
    const hoop = this.hoops[p.team];
    const d = dist(p.pos, hoop);
    const three = this.isThree(p.pos, hoop);
    let pr;
    if (p.shotKind === 'layup') pr = T.pLayup;
    else if (!three) pr = lerp(T.pClose, T.pMid, clamp((d - 2) / (COURT.threeR - 2), 0, 1));
    else pr = T.pThree - Math.max(0, d - (COURT.threeR + 1)) * 0.06;
    pr *= 0.82 + p.info.sht * 0.036;
    let contest = 0;
    for (const o of this.opponents(p)) {
      if (o.state === 'down') continue;
      const dd = dist(o.pos, p.pos);
      if (dd < 2.1) contest = Math.max(contest, (1 - dd / 2.1) * (o.state === 'block' ? 1 : 0.55));
    }
    pr -= contest * T.contestPenalty;
    if (!p.isUser) pr *= this.diffOf(p).acc;
    pr += timing;
    if (p.onFire) pr += T.fireBonus;
    pr = clamp(pr, 0.03, 0.97);
    p.ballAnchor(this.ball.pos);
    this.ball.shoot(p, p.team, Math.random() < pr, three ? 3 : 2, p.shotKind);
    this.audio.pass();
    if (perfect && p.isUser) {
      this.ui.popup('PERFECT!', this.ball.pos, '#7dff8a');
      this.audio.perfect();
    }
  }

  onBasket(shooter, points, kind) {
    const team = shooter.team;
    const demo = this.demo;
    this.score[team] += points;
    shooter.stats.pts += points;
    if (points === 3) shooter.stats.three++;
    if (kind === 'dunk') shooter.stats.dunk++;
    // 對方得分 → 我方手感歸零
    for (const o of this.opponents(shooter)) {
      o.streak = 0;
      o.onFire = false;
    }
    let fire = 0;
    if (shooter.onFire) {
      if (++shooter.fireShots >= 4) { shooter.onFire = false; shooter.streak = 0; }
    } else {
      shooter.streak++;
      if (shooter.streak >= TUNING.fireStreak) { shooter.onFire = true; shooter.fireShots = 0; fire = 2; }
      else if (shooter.streak === TUNING.fireStreak - 1) fire = 1;
    }
    this.court.swish(team);
    this.shotClock = TUNING.shotClock;
    this.poss = 1 - team;
    if (kind !== 'dunk') this.audio.swish();
    this.audio.cheer(kind === 'dunk' || points === 3 ? 1 : 0.5);
    if (demo) return;
    this.ui.popup(`+${points}`, this.hoops[team], accentOf(this.teams[team]), true);
    if (fire === 2) {
      this.g.cutin(shooter, `${shooter.info.name} 著火了！`, 'ON FIRE!', TUNING.cutinFireTime, 0.45);
      this.audio.fire();
    } else if (kind === 'dunk') this.ui.banner(pick(['SLAM!', 'KABOOM!', '灌籃！', 'MONSTER JAM!', 'THROW IT DOWN!']), '#ffe14a', true);
    else if (points === 3) this.ui.banner(pick(['三分球！', 'FROM DOWNTOWN!', 'SPLASH!']), '#6fe3ff');
    else if (fire === 1) this.ui.banner('手感發燙！', '#ffb347');
    this.ui.pulseScore(team);
  }

  // 灌籃起跳：有機率出現蓋板特寫（空翻 / 著火灌籃必出）
  onDunkStart(p) {
    if (this.demo) return;
    if (p.dk.flip || p.onFire || Math.random() < TUNING.cutinDunkChance) {
      this.g.cutin(p, p.info.name, pick(['SLAM DUNK!', 'JAM TIME!', 'POSTER!', 'TAKE FLIGHT!']), TUNING.cutinTime, TUNING.cutinSlow);
    }
  }

  onMiss(hoopIdx) {
    this.court.rattle(hoopIdx, 0.7);
    this.audio.clank();
  }

  dunkScore(p) {
    const hoop = this.hoops[p.team];
    this.ball.dunked(p);
    this.onBasket(p, 2, 'dunk');
    this.court.rattle(p.team, 1.8);
    this.audio.dunk();
    this.fx.burst(hoop, '#ffd23f', 36, 6);
    this.g.shake(0.6);
    if (!this.demo) this.g.slowmo();
  }

  // 灌籃被蓋：籃下有人起跳就有機會
  tryDunkBlock(p) {
    const hoop = this.hoops[p.team];
    for (const o of this.opponents(p)) {
      if (o.state !== 'block' || o.y < 0.45 || dist(o.pos, hoop) > 1.6) continue;
      if (Math.random() > TUNING.dunkBlockChance * (0.6 + o.info.def * 0.08)) continue;
      this._blocked(o, p, hoop);
      return true;
    }
    return false;
  }

  // 投籃剛出手時，碰到起跳防守者高舉的手 → 蓋火鍋
  _checkBlocks() {
    const b = this.ball;
    if (b.state !== 'shot' || b.shot.phase !== 'fly' || b.shot.t > 0.42) return;
    for (const o of this.opponents(b.shooter)) {
      if (o.state !== 'block' || o.y < 0.25) continue;
      _v.set(o.pos.x + Math.sin(o.heading) * 0.22, o.y + 2.45 * o.scaleH, o.pos.z + Math.cos(o.heading) * 0.22);
      if (_v.distanceTo(b.pos) > TUNING.blockRadius) continue;
      this._blocked(o, b.shooter, this.hoops[b.shot.hoop]);
      return;
    }
  }

  _blocked(blocker, shooter, hoop) {
    const b = this.ball;
    if (b.holder === shooter) shooter.ballAnchor(b.pos);
    let ax = b.pos.x - hoop.x;
    let az = b.pos.z - hoop.z;
    const l = Math.hypot(ax, az) || 1;
    ax /= l;
    az /= l;
    b.knockLoose(ax * 5 + (Math.random() - 0.5) * 3, 2.6, az * 5 + (Math.random() - 0.5) * 3, shooter);
    blocker.stats.blk++;
    this.audio.block();
    this.fx.burst(b.pos, '#ffffff', 16, 4);
    this.g.shake(0.3);
    if (this.demo) return;
    this.ui.banner(pick(['REJECTED!', '蓋火鍋！', 'GET THAT OUT!']), '#ff5d5d');
  }

  trySteal(p) {
    const b = this.ball;
    const h = b.holder;
    if (!h || h.team === p.team || h.state === 'dunk' || h.state === 'down') { this.audio.slap(); return false; }
    const dx = h.pos.x - p.pos.x;
    const dz = h.pos.z - p.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > TUNING.stealRange || Math.abs(h.y - p.y) > 0.8) return false;
    if (d > 0.3 && (dx * Math.sin(p.heading) + dz * Math.cos(p.heading)) / d < 0.2) return false;
    this.audio.slap();
    let ch = TUNING.stealChance * (0.7 + p.info.def * 0.06);
    if (h.turboOn) ch *= 0.75;
    if (h.onFire) ch *= 0.6;
    if (p.isUser) ch *= 1.15;
    if (Math.random() > ch) return false;
    p.stats.stl++;
    if (Math.random() < 0.6) b.give(p);
    else b.knockLoose(-dx * 2 + (Math.random() - 0.5) * 2, 2.8, -dz * 2 + (Math.random() - 0.5) * 2, h);
    if (!this.demo) this.ui.popup('抄截！', _v.set(p.pos.x, 2.4, p.pos.z), p.team === 0 ? '#7dff8a' : '#ff8a8a');
    return true;
  }

  onIntercept(p) {
    p.stats.stl++;
    this.audio.slap();
    if (!this.demo) this.ui.popup('攔截！', _v.set(p.pos.x, 2.4, p.pos.z), p.team === 0 ? '#7dff8a' : '#ff8a8a');
  }

  onShove(p, victim) {
    this.audio.thud();
    this.g.shake(0.22);
    this.fx.burst(_v.set(victim.pos.x, victim.y + 1.2, victim.pos.z), '#ffffff', 10, 3);
  }

  dispose() {
    for (const p of this.players) p.dispose();
    this.ball.dispose();
  }
}
