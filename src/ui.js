import * as THREE from 'three';
import { TEAMS, DIFFICULTY, TUNING } from './config.js';

// HUD 與選單（DOM）。版面位置由 LAYOUT_PC / LAYOUT_MOBILE 決定，可在 DEV 工具拖曳

const $ = (id) => document.getElementById(id);
const _v = new THREE.Vector3();

const HUD_IDS = {
  scoreboard: 'scoreboard', turbo: 'turboBox', banner: 'banner', pause: 'btnPause',
  stick: 'stick', btnA: 'btnA', btnB: 'btnB', btnC: 'btnC', btnSw: 'btnSw', hint: 'hint',
};
const SCREENS = { menu: 'menu', pause: 'pauseScreen', break: 'breakScreen', over: 'overScreen' };

export class UI {
  constructor(game) {
    this.g = game;
    this.uiScale = 1;
    this.el = {};
    for (const [k, id] of Object.entries(HUD_IDS)) this.el[k] = $(id);
    this.last = {};
    this.bannerT = 0;

    const click = (id, fn) => $(id).addEventListener('click', (e) => {
      if (document.body.classList.contains('dev') && e.target.closest('[data-hud]')) return;
      game.audio.click();
      fn();
    });
    click('btnPlay', () => game.startGame());
    click('btnPause', () => game.pause());
    click('btnResume', () => game.resume());
    click('btnRestart', () => game.startGame());
    click('btnHome', () => game.toMenu());
    click('btnAgain', () => game.startGame());
    click('btnMenu', () => game.toMenu());
    click('btnNext', () => game.nextQuarter());
    for (const id of ['btnSound', 'btnSound2']) click(id, () => { game.audio.setEnabled(!game.audio.enabled); this._soundLabel(); });
    this._soundLabel();

    // 選隊
    const S = game.settings;
    const n = TEAMS.length;
    click('homePrev', () => { S.team = (S.team + n - 1) % n; this._menu(); });
    click('homeNext', () => { S.team = (S.team + 1) % n; this._menu(); });
    // 對手：-1 = 隨機
    click('awayPrev', () => { S.opp = S.opp <= -1 ? n - 1 : S.opp - 1; this._menu(); });
    click('awayNext', () => { S.opp = S.opp >= n - 1 ? -1 : S.opp + 1; this._menu(); });
    this._opts('optDiff', Object.entries(DIFFICULTY).map(([k, d]) => [k, d.label]), 'difficulty');
    this._opts('optTime', [[45, '每節 45 秒'], [60, '每節 60 秒'], [90, '每節 90 秒']], 'quarter');
    this._menu();
  }

  _soundLabel() {
    const t = this.g.audio.enabled ? '🔊 音效：開' : '🔇 音效：關';
    $('btnSound').textContent = t;
    $('btnSound2').textContent = t;
  }

  _opts(id, list, key) {
    const box = $(id);
    const S = this.g.settings;
    const render = () => {
      box.innerHTML = '';
      for (const [val, label] of list) {
        const b = document.createElement('button');
        b.className = 'opt' + (S[key] === val ? ' on' : '');
        b.textContent = label;
        b.addEventListener('click', () => { S[key] = val; this.g.saveSettings(); this.g.audio.click(); render(); });
        box.appendChild(b);
      }
    };
    render();
  }

  _card(el, team, small) {
    el.classList.toggle('random', !team);
    if (!team) {
      el.style.removeProperty('--c');
      el.style.removeProperty('--t');
      el.innerHTML = '<div class="tc-name">RANDOM<small>隨機對手</small></div>';
      return;
    }
    el.style.setProperty('--c', team.jersey);
    el.style.setProperty('--t', team.trim);
    const stat = (label, v) => `<div class="stat"><span>${label}</span><div class="sbar"><b style="width:${v * 10}%"></b></div></div>`;
    const players = small ? '' : `<div class="tc-players">${team.players.map((p) => `
      <div class="tc-player">
        <div class="nm"><span>${p.name}</span><i>#${p.num}</i></div>
        ${stat('速度', p.spd)}${stat('投籃', p.sht)}${stat('灌籃', p.dnk)}${stat('防守', p.def)}
      </div>`).join('')}</div>`;
    el.innerHTML = `<div class="tc-name">${team.en}<small>${team.name}</small></div>${players}`;
  }

  _menu() {
    const S = this.g.settings;
    if (S.opp === S.team) S.opp = -1;
    this._card($('homeCard'), TEAMS[S.team], false);
    this._card($('awayCard'), S.opp < 0 ? null : TEAMS[S.opp], true);
    this.g.saveSettings();
  }

  // 顯示指定畫面（null = 只有 HUD）
  show(name) {
    for (const [k, id] of Object.entries(SCREENS)) $(id).classList.toggle('hidden', k !== name);
    $('hud').classList.toggle('hidden', name === 'menu');
  }

  setTeams(home, away) {
    $('sbHomeAbbr').textContent = home.abbr;
    $('sbAwayAbbr').textContent = away.abbr;
    $('sbHomeBox').style.setProperty('--c', home.jersey);
    $('sbAwayBox').style.setProperty('--c', away.jersey);
    this.last = {};
  }

  // 套用版面：位置為舞台百分比，大小乘上舞台縮放
  applyLayout(layout, stageW, stageH) {
    this.uiScale = Math.max(0.6, Math.min(1.5, stageW / 400));
    this.g.app.style.setProperty('--zoom', Math.min(stageW / 400, stageH / 780).toFixed(3));
    const s = this.uiScale;
    for (const [k, cfg] of Object.entries(layout.hud)) {
      const el = this.el[k];
      if (!el) continue;
      el.style.left = cfg.x + '%';
      el.style.top = cfg.y + '%';
      if (k === 'banner') {
        el.style.fontSize = cfg.size * s + 'px';
        el.style.color = cfg.color;
      } else if (k === 'hint') el.style.fontSize = cfg.size * s + 'px';
      else el.style.scale = String(cfg.size * s);
    }
  }

  banner(text, color, big = false) {
    const el = this.el.banner;
    el.textContent = text;
    el.style.color = color || this.g.layout.hud.banner.color;
    el.classList.remove('show', 'big');
    void el.offsetWidth; // 重新觸發動畫
    el.classList.add('show');
    if (big) el.classList.add('big');
  }

  // 世界座標飄字
  popup(text, pos, color = '#fff', big = false) {
    const cam = this.g.camera;
    _v.copy(pos).project(cam);
    if (_v.z > 1) return;
    const d = document.createElement('div');
    d.className = 'popup' + (big ? ' big' : '');
    d.textContent = text;
    d.style.color = color;
    d.style.left = (_v.x * 0.5 + 0.5) * 100 + '%';
    d.style.top = (-_v.y * 0.5 + 0.5) * 100 + '%';
    d.style.fontSize = (big ? 34 : 20) * this.uiScale + 'px';
    $('popups').appendChild(d);
    setTimeout(() => d.remove(), 1000);
  }

  pulseScore(team) {
    const el = $(team === 0 ? 'sbHomeBox' : 'sbAwayBox');
    el.classList.remove('pulse');
    void el.offsetWidth;
    el.classList.add('pulse');
  }

  _set(key, id, value) {
    if (this.last[key] === value) return;
    this.last[key] = value;
    $(id).textContent = value;
  }

  // 每幀同步 HUD 數值
  update(m) {
    this._set('h', 'sbHome', m.score[0]);
    this._set('a', 'sbAway', m.score[1]);
    this._set('q', 'sbQuarter', m.quarter > TUNING.quarters ? 'OT' : 'Q' + m.quarter);
    const c = Math.ceil(m.clock);
    const clock = m.clock < 10 ? m.clock.toFixed(1) : `${(c / 60) | 0}:${String(c % 60).padStart(2, '0')}`;
    this._set('c', 'sbClock', clock);
    const sc = Math.max(0, Math.ceil(m.shotClock));
    this._set('s', 'sbShot', sc);
    if (this.last.cl !== c <= 10) { this.last.cl = c <= 10; $('sbClock').classList.toggle('low', c <= 10); }
    if (this.last.sl !== sc <= 5) { this.last.sl = sc <= 5; $('sbShot').classList.toggle('low', sc <= 5); }

    const u = m.user;
    if (!u) return;
    $('turboFill').style.transform = `scaleX(${u.turbo.toFixed(3)})`;
    if (this.last.fire !== u.onFire) { this.last.fire = u.onFire; $('turboBox').classList.toggle('fire', u.onFire); }
    this._set('tn', 'turboName', u.onFire ? `${u.info.name} 🔥` : u.info.name);
    // 按鍵文字依攻守切換
    const off = m.teamHasBall(u.team);
    if (this.last.off !== off) {
      this.last.off = off;
      $('lblA').textContent = off ? '投籃' : '跳';
      $('lblB').textContent = off ? '傳球' : '抄截';
    }
  }

  scoreHTML(m) {
    const t = m.teams;
    return `<div class="fs-team" style="--c:${t[0].jersey}"><small>${t[0].en}</small><b>${m.score[0]}</b></div>
      <div class="vs">VS</div>
      <div class="fs-team" style="--c:${t[1].jersey}"><small>${t[1].en}</small><b>${m.score[1]}</b></div>`;
  }

  showBreak(m, title, btn) {
    $('breakTitle').textContent = title;
    $('breakScore').innerHTML = this.scoreHTML(m);
    $('btnNext').textContent = btn;
    this.show('break');
  }

  showOver(m) {
    const win = m.score[0] > m.score[1];
    const t = $('overTitle');
    t.textContent = win ? '勝利！' : '落敗…';
    t.classList.toggle('lose', !win);
    $('overScore').innerHTML = this.scoreHTML(m);
    const rows = m.players.map((p) => `<tr>
      <td class="nm"><i style="background:${p.teamDef.jersey}"></i>${p.info.name}</td>
      <td class="pts">${p.stats.pts}</td><td>${p.stats.three}</td><td>${p.stats.dunk}</td>
      <td>${p.stats.reb}</td><td>${p.stats.stl}</td><td>${p.stats.blk}</td></tr>`).join('');
    $('overStats').innerHTML = `<table><tr><th></th><th>得分</th><th>三分</th><th>灌籃</th><th>籃板</th><th>抄截</th><th>火鍋</th></tr>${rows}</table>`;
    this.show('over');
  }
}
