import * as THREE from 'three';
import { TUNING, VISUAL, LAYOUT_PC, LAYOUT_MOBILE, TEAMS, COURT, IS_TOUCH } from './config.js';
import { Court } from './court.js';
import { Effects } from './effects.js';
import { GameAudio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { Match } from './match.js';
import { cutinTexture } from './textures.js';
import { PortraitStudio } from './portrait.js';

// 遊戲主體：渲染、鏡頭、狀態流程（選單示範賽 → 比賽 → 節間 → 終場）

const SETTINGS_KEY = 'hoopjam_settings_v1';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const _v = new THREE.Vector3();

export class Game {
  constructor(canvas, models, faceDB = {}) {
    this.canvas = canvas;
    this.models = models;
    this.faceDB = faceDB; // assets/faces/faces.json：每位球員的臉部貼圖與頭型資料
    this._headKey = '';
    this.app = document.getElementById('app');
    this.state = 'menu'; // menu | playing | paused | break | over
    this.forcedProfile = null;
    this.devTimeScale = 1;
    this.slowT = 0;
    this.shakeT = 0;
    this.shakeAmp = 0;
    this.camF = new THREE.Vector3(0, 0, 0);
    this.settings = { team: Math.max(0, TEAMS.findIndex((t) => t.abbr === 'LAL')), opp: -1, difficulty: 'normal', quarter: 60 };
    try { Object.assign(this.settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch (e) { /* 忽略 */ }
    if (!TEAMS[this.settings.team]) this.settings.team = 0;

    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    this.portraits = new PortraitStudio(r, faceDB); // 選隊卡片用的球員頭像
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#05080f');
    this.scene.fog = new THREE.Fog('#05080f', 45, 95);
    this.camera = new THREE.PerspectiveCamera(50, 0.5625, 0.5, 200);

    this.hemi = new THREE.HemisphereLight('#dfe9ff', '#5a4634', 1);
    this.sun = new THREE.DirectionalLight('#fff4e0', 1);
    this.sun.position.set(4, 14, 9);
    this.scene.add(this.hemi, this.sun);
    // 蓋板特寫用的第二鏡頭：只看 layer 1（球員、球、粒子），燈光也要在該 layer
    this.hemi.layers.enable(1);
    this.sun.layers.enable(1);
    this.cam2 = new THREE.PerspectiveCamera(30, 2, 0.1, 60);
    this.cam2.layers.set(1);
    this.ci = null;
    this.ciBg = null;
    this.ciWin = document.getElementById('ciWindow');

    this.court = new Court(this.scene);
    this.fx = new Effects(this.scene);
    this.audio = new GameAudio();
    this.input = new Input((cmd) => this.onCommand(cmd));
    this.ui = new UI(this);
    if (IS_TOUCH) document.body.classList.add('touch');

    this.applyVisual();
    this.onResize();
    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.onResize(), 200));
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'playing') this.pause(); });

    this.match = null;
    this.toMenu();
    this._last = performance.now();
    r.setAnimationLoop((now) => this._frame(now));
  }

  saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch (e) { /* 忽略 */ }
  }

  // ───────── 版面 / 視覺 ─────────
  get profile() { return this.forcedProfile || (IS_TOUCH || innerWidth < innerHeight ? 'mobile' : 'pc'); }
  get layout() { return this.profile === 'mobile' ? LAYOUT_MOBILE : LAYOUT_PC; }

  onResize() {
    const W = innerWidth;
    const H = innerHeight;
    // DEV 在 PC 上強制預覽手機版面時，用手機常見比例
    const aspect = this.forcedProfile === 'mobile' && !IS_TOUCH ? 0.462 : this.layout.stage.aspect;
    const sw = W / H > aspect ? Math.round(H * aspect) : W;
    this.stageW = sw;
    this.stageH = H;
    this.app.style.width = sw + 'px';
    this.app.style.height = H + 'px';
    this.pixelRatio = Math.min(devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(sw, H, false);
    this.camera.aspect = sw / H;
    this.fx.setViewport(H * this.pixelRatio);
    this.applyCamera();
    this.ui.applyLayout(this.layout, sw, H);
  }

  // 以水平視角為準換算垂直 FOV，讓不同長寬比的手機看到一樣寬的球場
  applyCamera() {
    const L = this.layout.camera;
    const h = THREE.MathUtils.degToRad(L.hfov);
    this.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(h / 2) / this.camera.aspect));
    this.camera.updateProjectionMatrix();
  }

  applyVisual() {
    this.renderer.toneMappingExposure = VISUAL.exposure;
    this.hemi.intensity = VISUAL.hemi;
    this.sun.intensity = VISUAL.sun;
    this.court.applyVisual();
    // 頭部立體參數有變才重建
    const headKey = [VISUAL.headDepth, VISUAL.faceNose, VISUAL.faceBrow, VISUAL.faceEye, VISUAL.faceLip].join();
    const rebuild = this._headKey && headKey !== this._headKey;
    this._headKey = headKey;
    if (this.match) for (const p of this.match.players) {
      if (rebuild) p.vis.rebuildHead();
      p.vis.applyNumbers();
      p.vis.setHeadScale(TUNING.headScale);
      if (p.team === 1 || this.match.demo) p.speedMul = this.match.diff.speed;
    }
  }

  shake(amp) {
    this.shakeAmp = Math.max(this.shakeAmp, amp);
    this.shakeT = 0.4;
  }

  slowmo() {
    this.slowT = TUNING.slowmoTime;
  }

  // 蓋板特寫：帶狀視窗裡用第二鏡頭拍球員的臉，期間遊戲放慢
  cutin(player, title, sub, time, slow) {
    if (this.match.demo || this.state !== 'playing') return;
    const team = player.teamDef;
    this.ci = { p: player, t: 0, T: time, slow, side: Math.random() < 0.5 ? 1 : -1 };
    this.ciBg?.dispose();
    this.ciBg = cutinTexture(team.color || team.jersey, team.trim);
    this.ui.cutin(title, sub, team, time);
    this.audio.cutin();
  }

  endCutin() {
    if (!this.ci) return;
    this.ci = null;
    this.ui.cutinEnd();
  }

  _renderCutin() {
    const ci = this.ci;
    const r = this.ciWin.getBoundingClientRect();
    const c = this.canvas.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const x = r.left - c.left;
    const y = c.bottom - r.bottom;
    const p = ci.p;
    // 鏡頭放在球員臉的正前方略偏一側
    _v.setFromMatrixPosition(p.vis.headQ.group.matrixWorld);
    const sh = Math.sin(p.heading);
    const ch = Math.cos(p.heading);
    const dist = 1.75 + ci.t * 0.25;
    const side = ci.side * 0.6;
    const cam = this.cam2;
    cam.position.set(_v.x + sh * dist + ch * side, _v.y + 0.05, _v.z + ch * dist - sh * side);
    cam.lookAt(_v.x, _v.y - 0.1, _v.z);
    cam.aspect = r.width / r.height;
    cam.updateProjectionMatrix();
    const R = this.renderer;
    const scene = this.scene;
    const bg = scene.background;
    const fog = scene.fog;
    scene.background = this.ciBg;
    scene.fog = null;
    R.setScissorTest(true);
    R.setViewport(x, y, r.width, r.height);
    R.setScissor(x, y, r.width, r.height);
    R.render(scene, cam);
    R.setScissorTest(false);
    R.setViewport(0, 0, this.stageW, this.stageH);
    scene.background = bg;
    scene.fog = fog;
  }

  // ───────── 狀態流程 ─────────
  _newMatch(opts) {
    this.endCutin();
    this.match?.dispose();
    this.match = new Match(this, opts);
    this.ui.setTeams(opts.teams[0], opts.teams[1]);
    this.applyVisual();
    this.camF.set(0, 0, 0);
    this.slowT = 0;
  }

  // 主選單：背景跑一場 AI 對 AI 的示範賽
  toMenu() {
    const a = (Math.random() * TEAMS.length) | 0;
    const b = (a + 1 + ((Math.random() * (TEAMS.length - 1)) | 0)) % TEAMS.length;
    this._newMatch({ teams: [TEAMS[a], TEAMS[b]], difficulty: 'normal', quarterSeconds: 9999, demo: true });
    this.state = 'menu';
    this.ui.show('menu');
  }

  startGame() {
    const S = this.settings;
    let opp = S.opp;
    if (opp < 0 || opp === S.team) opp = (S.team + 1 + ((Math.random() * (TEAMS.length - 1)) | 0)) % TEAMS.length;
    this._newMatch({ teams: [TEAMS[S.team], TEAMS[opp]], difficulty: S.difficulty, quarterSeconds: S.quarter, demo: false });
    this.state = 'playing';
    this.ui.show(null);
    this.ui.banner('第 1 節', '#ffffff');
  }

  pause() {
    if (this.state !== 'playing') return;
    this.endCutin();
    this.state = 'paused';
    this.ui.show('pause');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.ui.show(null);
  }

  onCommand(cmd) {
    if (cmd === 'pause') {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
    } else if (cmd === 'confirm') {
      if (this.state === 'menu') this.startGame();
      else if (this.state === 'break') this.nextQuarter();
      else if (this.state === 'paused') this.resume();
    }
  }

  // 由 Match 在節末呼叫
  onQuarterEnd() {
    const m = this.match;
    if (m.demo) { m.nextQuarter(); return; }
    this.audio.buzzer();
    this.state = 'break';
    const last = m.quarter >= TUNING.quarters;
    const tie = m.score[0] === m.score[1];
    setTimeout(() => {
      if (this.state !== 'break' || this.match !== m) return;
      if (last && !tie) {
        this.state = 'over';
        if (m.score[0] > m.score[1]) { this.audio.fanfare(); this.audio.cheer(1.5); }
        this.ui.showOver(m);
      } else if (last) this.ui.showBreak(m, '平手！進入延長賽', '延長賽');
      else this.ui.showBreak(m, m.quarter === 2 ? '中場休息' : `第 ${m.quarter} 節結束`, `第 ${m.quarter + 1} 節`);
    }, 1300);
  }

  nextQuarter() {
    if (this.state !== 'break') return;
    const m = this.match;
    m.nextQuarter();
    this.state = 'playing';
    this.ui.show(null);
    this.ui.banner(m.quarter > TUNING.quarters ? '延長賽' : `第 ${m.quarter} 節`, '#ffffff');
  }

  // ───────── 主迴圈 ─────────
  _frame(now) {
    const raw = Math.min(0.05, (now - this._last) / 1000);
    this._last = now;
    let scale = this.devTimeScale;
    if (this.slowT > 0) {
      this.slowT -= raw;
      scale *= TUNING.slowmo;
    }
    if (this.ci) {
      this.ci.t += raw;
      scale *= this.ci.slow;
      if (this.ci.t >= this.ci.T) this.endCutin();
    }
    const dt = this.state === 'paused' ? 0 : raw * scale;
    this.input.poll();
    const m = this.match;
    if (dt > 0) {
      m.update(dt, this.input);
      this.court.update(dt);
      this.fx.update(dt);
    }
    this._camera(raw);
    if (this.state !== 'menu') this.ui.update(m);
    this.renderer.render(this.scene, this.camera);
    if (this.ci) this._renderCutin();
  }

  _camera(dt) {
    const L = this.layout.camera;
    const m = this.match;
    const b = m.ball.pos;
    const a = 1 - Math.exp(-L.smooth * dt);
    // 往進攻方向多看一點
    const tz = clamp(b.z + m.dir(m.poss) * L.lead, L.zMin, L.zMax);
    this.camF.z += (tz - this.camF.z) * a;
    this.camF.x += (clamp(b.x, -COURT.halfW, COURT.halfW) * L.followX - this.camF.x) * a;
    const cam = this.camera;
    cam.position.set(this.camF.x, L.height, this.camF.z + L.distance);
    cam.lookAt(this.camF.x, L.lookHeight, this.camF.z - L.lookAhead);
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const k = this.shakeAmp * (this.shakeT / 0.4) * VISUAL.shake;
      cam.position.x += (Math.random() - 0.5) * k;
      cam.position.y += (Math.random() - 0.5) * k;
      if (this.shakeT <= 0) this.shakeAmp = 0;
    }
  }
}
