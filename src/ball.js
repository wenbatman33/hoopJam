import * as THREE from 'three';
import { TUNING, COURT } from './config.js';
import { ballTexture, blobTexture } from './textures.js';

// 籃球：held 持球 / shot 投籃飛行 / pass 傳球 / loose 自由球

export const BALL_R = 0.19;
const BALL_G = 20;
const lerp = (a, b, t) => a + (b - a) * t;

export class Ball {
  constructor(match) {
    this.m = match;
    this.pos = new THREE.Vector3(0, 1.2, 0);
    this.vel = new THREE.Vector3();
    this.state = 'loose';
    this.holder = null;
    this.shooter = null;
    this.passer = null;
    this.target = null;
    this.reservedTeam = null; // 進球後只有被得分方能撿球
    this.reservedT = 0;
    this.looseT = 0;
    this.ignore = null; // 剛掉球的人短時間內不能再撿
    this.ignoreT = 0;
    this.rebound = false; // 投籃不進後的自由球
    this.shotReset = false; // 出手過 → 下次持球重置進攻時間
    this.onFire = false;
    this.shot = { p0: new THREE.Vector3(), p1: new THREE.Vector3(), t: 0, T: 1, h: 1, made: false, points: 2, kind: 'jump', hoop: 0, phase: 'fly' };
    this.pp = { p0: new THREE.Vector3(), t: 0, T: 0.3, h: 0 };

    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_R, 20, 14),
      new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.75 }),
    );
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.renderOrder = 1;
    this.mesh.layers.enable(1);
    match.scene.add(this.mesh, this.shadow);
  }

  give(p, silent = false) {
    this.state = 'held';
    this.holder = p;
    this.vel.set(0, 0, 0);
    if (!silent) this.m.onHold(p);
    this.reservedTeam = null;
    this.rebound = false;
  }

  // 出手：命中與否已由 Match 擲骰決定
  shoot(shooter, hoopIdx, made, points, kind) {
    const hoop = this.m.hoops[hoopIdx];
    const s = this.shot;
    this.state = 'shot';
    this.holder = null;
    this.shooter = shooter;
    this.shotReset = true;
    this.onFire = shooter.onFire;
    s.p0.copy(this.pos);
    s.made = made;
    s.points = points;
    s.kind = kind;
    s.hoop = hoopIdx;
    s.t = 0;
    s.phase = 'fly';
    const d = Math.hypot(hoop.x - s.p0.x, hoop.z - s.p0.z);
    s.T = Math.min(1.6, 0.48 + d * 0.078) * TUNING.shotTime;
    s.h = (0.55 + d * 0.21) * TUNING.shotArc;
    if (made) s.p1.copy(hoop);
    else {
      const a = Math.random() * Math.PI * 2;
      const r = COURT.rimR * (0.9 + Math.random() * 0.35);
      s.p1.set(hoop.x + Math.cos(a) * r, hoop.y + 0.07, hoop.z + Math.sin(a) * r);
    }
  }

  pass(from, to) {
    this.state = 'pass';
    this.holder = null;
    this.passer = from;
    this.target = to;
    this.pp.p0.copy(this.pos);
    this.pp.t = 0;
    const d = from.pos.distanceTo(to.pos);
    this.pp.T = Math.max(0.16, d / TUNING.passSpeed);
    this.pp.h = d * 0.03;
    this.m.audio.pass();
  }

  knockLoose(vx, vy, vz, ignore = null) {
    this.state = 'loose';
    this.holder = null;
    this.vel.set(vx, vy, vz);
    this.looseT = 0;
    this.ignore = ignore;
    this.ignoreT = 0.5;
    this.onFire = false;
  }

  update(dt) {
    const m = this.m;
    this.ignoreT -= dt;
    if (this.reservedTeam != null) {
      this.reservedT -= dt;
      if (this.reservedT <= 0) this.reservedTeam = null;
    }
    switch (this.state) {
      case 'held':
        this.holder.ballAnchor(this.pos);
        this.onFire = this.holder.onFire;
        break;
      case 'shot': this._shot(dt); break;
      case 'pass': this._pass(dt); break;
      default: this._loose(dt);
    }
    if (this.onFire && this.state !== 'loose') m.fx.flame(this.pos, 0.7);

    // 視覺
    this.mesh.position.copy(this.pos);
    const spin = this.state === 'held' ? 6 : this.state === 'loose' ? this.vel.length() * 1.5 : 11;
    this.mesh.rotation.x -= spin * dt;
    const k = Math.min(1, this.pos.y / 6);
    this.shadow.position.set(this.pos.x, 0.014, this.pos.z);
    this.shadow.scale.setScalar(0.62 * (1 - k * 0.45));
    this.shadow.material.opacity = 0.85 * (1 - k * 0.6);
  }

  _shot(dt) {
    const s = this.shot;
    const m = this.m;
    s.t += dt;
    if (s.phase === 'fly') {
      const k = Math.min(1, s.t / s.T);
      this.pos.x = lerp(s.p0.x, s.p1.x, k);
      this.pos.z = lerp(s.p0.z, s.p1.z, k);
      this.pos.y = s.p0.y + (s.p1.y - s.p0.y) * k + s.h * 4 * k * (1 - k);
      if (k >= 1) {
        if (s.made) {
          s.phase = 'net';
          s.t = 0;
          m.onBasket(this.shooter, s.points, s.kind);
        } else {
          // 打鐵彈出
          const hoop = m.hoops[s.hoop];
          const out = Math.atan2(this.pos.x - hoop.x, this.pos.z - hoop.z) + (Math.random() - 0.5) * 1.6;
          const sp = 1.4 + Math.random() * 3;
          this.knockLoose(Math.sin(out) * sp, 2.6 + Math.random() * 2.6, Math.cos(out) * sp - m.dir(s.hoop) * 1.2);
          this.rebound = true;
          this.ignoreT = 0;
          m.onMiss(s.hoop);
        }
      }
    } else {
      // 穿過籃網
      this.pos.y -= 3.4 * dt;
      if (s.t > 0.16) {
        this.knockLoose((Math.random() - 0.5) * 0.8, -3, (Math.random() - 0.5) * 0.8 - m.dir(s.hoop) * 0.6);
        this.ignoreT = 0;
        this.reservedTeam = 1 - this.shooter.team;
        this.reservedT = 6;
      }
    }
  }

  // 灌籃進球：球直接從框落下
  dunked(p) {
    const hoop = this.m.hoops[p.team];
    this.pos.set(hoop.x, hoop.y - 0.15, hoop.z);
    this.knockLoose(0, -6, -this.m.dir(p.team) * 0.5);
    this.ignoreT = 0;
    this.shotReset = true;
    this.reservedTeam = 1 - p.team;
    this.reservedT = 6;
  }

  _pass(dt) {
    const pp = this.pp;
    const m = this.m;
    const to = this.target;
    pp.t += dt;
    const k = Math.min(1, pp.t / pp.T);
    const ty = to.y + 1.2 * to.scaleH;
    this.pos.x = lerp(pp.p0.x, to.pos.x, k);
    this.pos.z = lerp(pp.p0.z, to.pos.z, k);
    this.pos.y = lerp(pp.p0.y, ty, k) + pp.h * 4 * k * (1 - k);
    // 攔截
    if (k > 0.2 && k < 0.95) {
      for (const o of m.opponents(this.passer)) {
        if (o.state === 'down' || o.state === 'dunk') continue;
        const d = Math.hypot(o.pos.x - this.pos.x, o.pos.z - this.pos.z);
        if (d < TUNING.interceptRadius && this.pos.y < o.y + 2.3 * o.scaleH) {
          this.give(o);
          m.onIntercept(o);
          return;
        }
      }
    }
    if (k >= 1) {
      if (to.state === 'down') this.knockLoose((to.pos.x - pp.p0.x) * 0.6, 1.5, (to.pos.z - pp.p0.z) * 0.6);
      else this.give(to);
    }
  }

  _loose(dt) {
    const m = this.m;
    const v = this.vel;
    this.looseT += dt;
    const prevZ = this.pos.z;
    v.y -= BALL_G * dt;
    this.pos.addScaledVector(v, dt);

    // 地板
    if (this.pos.y < BALL_R) {
      this.pos.y = BALL_R;
      if (v.y < -1.4) {
        m.audio.bounce(Math.min(1, -v.y / 7));
        v.y = -v.y * TUNING.ballBounce;
        v.x *= 0.84;
        v.z *= 0.84;
      } else {
        v.y = 0;
        const f = Math.exp(-1.8 * dt);
        v.x *= f;
        v.z *= f;
      }
    }
    // 隱形牆：球不會滾出場外
    const bx = COURT.halfW + COURT.margin + 0.3;
    const bz = COURT.halfL + COURT.margin + 0.2;
    if (Math.abs(this.pos.x) > bx) { this.pos.x = Math.sign(this.pos.x) * bx; v.x *= -0.55; }
    if (Math.abs(this.pos.z) > bz) { this.pos.z = Math.sign(this.pos.z) * bz; v.z *= -0.55; }
    // 籃板
    for (const sign of [-1, 1]) {
      const pz = sign * COURT.boardZ;
      if ((prevZ - pz) * (this.pos.z - pz) < 0 && Math.abs(this.pos.x) < 0.92 && this.pos.y > COURT.rimH - 0.2 && this.pos.y < COURT.rimH + 0.95) {
        this.pos.z = pz - Math.sign(this.pos.z - pz) * 0.02;
        v.z *= -0.6;
      }
    }

    // 撿球
    let best = null;
    let bd = 1e9;
    for (const p of m.players) {
      if (!p.canGrab()) continue;
      if (this.ignore === p && this.ignoreT > 0) continue;
      if (this.reservedTeam != null && p.team !== this.reservedTeam) continue;
      const d = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
      const reach = (p.y > 0.1 ? 2.5 : 2.15) * p.scaleH;
      if (d < TUNING.pickupRadius + (p.y > 0.1 ? 0.12 : 0) && this.pos.y > p.y - 0.15 && this.pos.y < p.y + reach && d < bd) {
        best = p;
        bd = d;
      }
    }
    if (best) {
      const wasRebound = this.rebound;
      this.give(best);
      if (wasRebound) best.stats.reb++;
    }
  }

  dispose() {
    this.mesh.removeFromParent();
    this.shadow.removeFromParent();
  }
}
