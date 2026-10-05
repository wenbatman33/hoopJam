import GUI from 'lil-gui';
import { TUNING, VISUAL, DIFFICULTY, LAYOUT_PC, LAYOUT_MOBILE, saveOverrides, clearOverrides, exportAll } from './config.js';

// DEV 開發者微調工具：` 或 F2 或右下角 ⚙ 開啟
// - 即時調整鏡頭、HUD、觸控按鍵、遊戲手感、視覺
// - HUD 元件與觸控按鍵可直接滑鼠 / 手指拖曳
// - PC / Mobile 版面分開調整、分開匯出
// - 可手動觸發各種狀態（著火、灌籃、節末、終場…）

export class DevTools {
  constructor(game) {
    this.game = game;
    this.open = false;
    this.gui = null;
    this.editProfile = 'pc';
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Backquote' || e.code === 'F2') { e.preventDefault(); this.toggle(); }
    });
    document.getElementById('devBtn').addEventListener('click', (e) => { e.stopPropagation(); this.toggle(); });
    this._initDrag();
  }

  toggle() {
    this.open = !this.open;
    document.body.classList.toggle('dev', this.open);
    document.getElementById('devHint').classList.toggle('hidden', !this.open);
    if (this.open) {
      this.editProfile = this.game.profile;
      this._build();
    } else {
      this.gui?.destroy();
      this.gui = null;
      this.game.forcedProfile = null;
      this.game.onResize();
    }
  }

  get layout() { return this.editProfile === 'mobile' ? LAYOUT_MOBILE : LAYOUT_PC; }

  _changed() {
    saveOverrides();
    this.game.applyVisual();
    this.game.onResize();
  }

  _build() {
    this.gui?.destroy();
    const gui = (this.gui = new GUI({ title: '🛠 DEV 微調工具' }));
    const g = this.game;
    const ch = () => this._changed();

    // 版面切換
    const prof = { profile: this.editProfile, preview: g.forcedProfile != null };
    const fp = gui.addFolder('版面 Profile');
    fp.add(prof, 'profile', { 'PC（置中直式舞台）': 'pc', 'Mobile（直向滿版）': 'mobile' }).name('編輯版面').onChange((v) => {
      this.editProfile = v;
      g.forcedProfile = v;
      g.onResize();
      this._build();
    });
    fp.add(this.layout.stage, 'aspect', 0.42, 0.8, 0.005).name('舞台寬高比上限').onChange(ch);

    // 鏡頭
    const L = this.layout;
    const fc = gui.addFolder(`鏡頭 Camera（${this.editProfile}）`);
    fc.add(L.camera, 'height', 4, 30, 0.1).name('高度').onChange(ch);
    fc.add(L.camera, 'distance', 2, 30, 0.1).name('後方距離').onChange(ch);
    fc.add(L.camera, 'lookAhead', -4, 10, 0.1).name('前瞻距離').onChange(ch);
    fc.add(L.camera, 'lookHeight', -2, 6, 0.05).name('注視高度').onChange(ch);
    fc.add(L.camera, 'hfov', 15, 80, 0.5).name('水平 FOV').onChange(ch);
    fc.add(L.camera, 'followX', 0, 1, 0.01).name('左右跟隨').onChange(ch);
    fc.add(L.camera, 'lead', 0, 6, 0.1).name('進攻方向提前量').onChange(ch);
    fc.add(L.camera, 'smooth', 0.5, 15, 0.1).name('跟隨銳利度').onChange(ch);
    fc.add(L.camera, 'zMin', -14, 0, 0.1).name('遠端極限 z').onChange(ch);
    fc.add(L.camera, 'zMax', 0, 14, 0.1).name('近端極限 z').onChange(ch);

    // 蓋板特寫
    const fci = gui.addFolder(`🎬 蓋板特寫（${this.editProfile}）`);
    fci.add(L.cutin, 'y', 10, 90, 0.5).name('中心高度 %').onChange(ch);
    fci.add(L.cutin, 'h', 8, 60, 0.5).name('帶狀高度 %').onChange(ch);
    fci.add(TUNING, 'cutinDunkChance', 0, 1, 0.05).name('灌籃出現機率').onChange(ch);
    fci.add(TUNING, 'cutinTime', 0.3, 3, 0.05).name('灌籃特寫秒數').onChange(ch);
    fci.add(TUNING, 'cutinSlow', 0.02, 1, 0.01).name('特寫時遊戲速度').onChange(ch);
    fci.add(TUNING, 'cutinFireTime', 0.3, 4, 0.05).name('著火特寫秒數').onChange(ch);
    fci.add({ play: () => { if (this._play()) { const u = g.match.user || g.match.players[0]; g.cutin(u, u.info.name, 'SLAM DUNK!', 3, 0.3); } } }, 'play').name('▶ 預覽 3 秒');
    fci.close();

    // HUD
    const fh = gui.addFolder(`HUD / 按鍵（${this.editProfile}）— 可直接拖曳`);
    const names = {
      scoreboard: '計分板', turbo: '渦輪條', banner: '中央橫幅', pause: '暫停鈕', stick: '搖桿',
      btnA: 'A 投籃 / 跳', btnB: 'B 傳球 / 抄截', btnC: 'C 渦輪', btnSw: '換人鈕', hint: '鍵盤提示',
    };
    for (const [k, cfg] of Object.entries(L.hud)) {
      const f = fh.addFolder(names[k] || k);
      f.add(cfg, 'x', 0, 100, 0.1).name('x %').onChange(ch).listen();
      f.add(cfg, 'y', 0, 100, 0.1).name('y %').onChange(ch).listen();
      const px = k === 'banner' || k === 'hint';
      f.add(cfg, 'size', px ? 6 : 0.3, px ? 120 : 2.5, px ? 0.5 : 0.01).name(px ? '字級 px' : '縮放').onChange(ch);
      if ('color' in cfg) f.addColor(cfg, 'color').name('顏色').onChange(ch);
      f.close();
    }
    fh.close();

    // 遊戲手感
    const ft = gui.addFolder('遊戲參數 Tuning');
    const groups = {
      '移動 / 跳躍': [
        ['runSpeed', 2, 12, '跑速'], ['turboMul', 1, 2.5, '渦輪倍率'], ['accel', 2, 30, '加速銳利度'], ['turnRate', 3, 30, '轉身速度'],
        ['ballCarryMul', 0.6, 1.1, '持球速度倍率'], ['gravity', 8, 50, '重力'], ['jumpVel', 4, 16, '跳躍初速'],
        ['turboDrain', 0, 1, '渦輪消耗 / 秒'], ['turboRegen', 0, 1, '渦輪回復 / 秒'], ['shoveCost', 0, 1, '推人消耗'],
      ],
      '投籃': [
        ['pLayup', 0, 1, '上籃命中率'], ['pClose', 0, 1, '近距離命中率'], ['pMid', 0, 1, '中距離命中率'], ['pThree', 0, 1, '三分命中率'],
        ['contestPenalty', 0, 0.8, '被干擾扣減'], ['perfectBonus', 0, 0.4, '完美出手加成'], ['fireBonus', 0, 0.6, '著火加成'],
        ['shotArc', 0.3, 2.5, '拋物線高度'], ['shotTime', 0.4, 2, '飛行時間'],
      ],
      '灌籃': [
        ['dunkRange', 1.5, 8, '灌籃距離'], ['layupRange', 1, 5, '上籃距離'], ['dunkTime', 0.3, 2, '飛行時間'], ['dunkArc', 0, 3, '弧線高度'],
        ['dunkReach', 1.5, 3, '手的高度'], ['dunkBlockChance', 0, 1, '被蓋機率'], ['slowmo', 0.05, 1, '慢動作倍率'], ['slowmoTime', 0, 2, '慢動作秒數'],
      ],
      '防守 / 球': [
        ['stealRange', 0.5, 3, '抄截距離'], ['stealChance', 0, 1, '抄截機率'], ['stealCooldown', 0, 2, '抄截冷卻'], ['shoveRange', 0.5, 3, '推人距離'],
        ['shoveSpeed', 2, 20, '推人衝刺速度'], ['downTime', 0.3, 3, '倒地秒數'], ['blockRadius', 0.3, 2, '蓋火鍋判定半徑'],
        ['passSpeed', 6, 40, '傳球速度'], ['interceptRadius', 0.2, 2, '攔截半徑'], ['pickupRadius', 0.4, 2, '撿球半徑'], ['ballBounce', 0.1, 0.95, '球彈性'],
      ],
      '規則 / 角色': [
        ['quarters', 1, 4, '節數', 1], ['shotClock', 5, 40, '進攻時間', 1], ['fireStreak', 1, 6, '連進幾球著火', 1],
        ['headScale', 0.8, 2.2, '大頭比例'],
      ],
    };
    for (const [title, list] of Object.entries(groups)) {
      const f = ft.addFolder(title);
      for (const [k, a, b, n, step] of list) f.add(TUNING, k, a, b, step).name(n).onChange(ch);
      f.close();
    }
    ft.close();

    // AI 難度（對手強度）
    const fa = gui.addFolder('🤖 對手 AI 難度');
    const AI = [
      ['think', 0.1, 1, '決策間隔（越大越遲鈍）'], ['setup', 0, 3, '拿球後組織秒數'], ['turbo', 0, 1, '開渦輪機率'], ['dunk', 0, 1, '灌籃意願'],
      ['acc', 0.4, 1.2, '命中率倍率'], ['shotIQ', 0.3, 1.2, '出手選擇'], ['steal', 0, 1.5, '抄截頻率 / 秒'], ['shove', 0, 0.5, '推人機率'],
      ['block', 0, 1, '跟跳封蓋機率'], ['gap', 0.8, 3, '貼防距離'], ['speed', 0.6, 1.2, '跑速倍率'],
    ];
    for (const [key, cfg] of Object.entries(DIFFICULTY)) {
      const f = fa.addFolder(cfg.label + (g.settings.difficulty === key ? '（目前）' : ''));
      for (const [k, a, b, n] of AI) f.add(cfg, k, a, b, 0.01).name(n).onChange(ch);
      if (g.settings.difficulty !== key) f.close();
    }
    fa.close();

    // 視覺
    const fv = gui.addFolder('視覺 Visual');
    fv.add(VISUAL, 'exposure', 0.3, 2.5, 0.01).name('曝光').onChange(ch);
    fv.add(VISUAL, 'hemi', 0, 4, 0.05).name('環境光').onChange(ch);
    fv.add(VISUAL, 'sun', 0, 6, 0.05).name('主光').onChange(ch);
    fv.add(VISUAL, 'shake', 0, 3, 0.05).name('震動強度').onChange(ch);
    fv.add(VISUAL, 'ringOpacity', 0, 1, 0.01).name('腳下圓環透明度').onChange(ch);
    fv.add(VISUAL, 'nearHoopOpacity', 0, 1, 0.01).name('近端籃架透明度').onChange(ch);
    fv.add(VISUAL, 'numSize', 0.1, 0.8, 0.01).name('號碼大小').onChange(ch);
    fv.add(VISUAL, 'numBackY', 0.8, 1.8, 0.005).name('背號高度').onChange(ch);
    fv.add(VISUAL, 'numBackZ', -0.4, 0, 0.005).name('背號前後').onChange(ch);
    fv.add(VISUAL, 'numFrontY', 0.8, 1.8, 0.005).name('胸前號高度').onChange(ch);
    fv.add(VISUAL, 'numFrontZ', 0, 0.4, 0.005).name('胸前號前後').onChange(ch);
    fv.close();

    // 狀態觸發
    const fs = gui.addFolder('狀態觸發');
    const user = () => g.match.user || g.match.players[0];
    const act = {
      start: () => g.startGame(),
      giveBall: () => this._play() && g.match.ball.give(user()),
      fire: () => { if (this._play()) { const u = user(); u.onFire = true; u.fireShots = 0; g.ui.banner(`${u.info.name} 著火了！`, '#ff7a1a', true); g.audio.fire(); } },
      dunk: () => {
        if (!this._play()) return;
        const m = g.match;
        const u = user();
        const hoop = m.hoops[u.team];
        u.place(hoop.x + 1.2, hoop.z - m.dir(u.team) * 2.8, u.heading);
        m.ball.give(u);
        u.startDunk(3);
      },
      shot: () => { if (this._play()) { const u = user(); g.match.ball.give(u); u.startShot(); u.quick = true; } },
      down: () => this._play() && user().knockDown(0, 1, 5),
      score: () => { if (this._play()) g.match.onBasket(user(), 3, 'jump'); },
      oppScore: () => { if (this._play()) g.match.onBasket(g.match.players[2], 2, 'jump'); },
      endQ: () => { if (this._play()) g.match.clock = 0.5; },
      final: () => { if (this._play()) { g.match.quarter = TUNING.quarters; g.match.score[0] += 1; g.match.clock = 0.5; } },
      banner: () => g.ui.banner('MONSTER JAM!', null, true),
      menu: () => g.toMenu(),
    };
    fs.add(act, 'start').name('▶ 開始比賽');
    fs.add(act, 'giveBall').name('🏀 把球給我');
    fs.add(act, 'fire').name('🔥 著火');
    fs.add(act, 'dunk').name('💥 立刻灌籃');
    fs.add(act, 'shot').name('🎯 立刻跳投');
    fs.add(act, 'down').name('😵 被推倒');
    fs.add(act, 'score').name('➕ 我方 +3');
    fs.add(act, 'oppScore').name('➖ 對手 +2');
    fs.add(act, 'endQ').name('⏱ 本節結束');
    fs.add(act, 'final').name('🏁 終場結算');
    fs.add(act, 'banner').name('📣 預覽橫幅');
    fs.add(act, 'menu').name('🏠 回主選單');
    fs.add(g, 'devTimeScale', 0.05, 2, 0.05).name('時間倍率');

    // 匯出
    const fe = gui.addFolder('💾 匯出 / 鎖定');
    const ex = {
      copy: async () => {
        const json = exportAll();
        console.log('[DEV EXPORT]\n' + json);
        try { await navigator.clipboard.writeText(json); alert('已複製設定 JSON 到剪貼簿！\n貼給 Claude 並說「我調好了，鎖定」即可寫入原始碼。'); }
        catch (e) { prompt('複製以下 JSON：', json); }
      },
      download: () => {
        const blob = new Blob([exportAll()], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'hoopjam-layout-export.json';
        a.click();
      },
      reset: () => { if (confirm('重置所有調整回預設值？')) { clearOverrides(); this._changed(); this._build(); } },
    };
    fe.add(ex, 'copy').name('📋 匯出 JSON（複製）');
    fe.add(ex, 'download').name('⬇ 下載 JSON 檔');
    fe.add(ex, 'reset').name('↺ 重置為預設');
  }

  // 確保在比賽中（狀態觸發用）
  _play() {
    const g = this.game;
    if (g.state === 'menu' || g.state === 'over') g.startGame();
    if (g.state === 'paused') g.resume();
    if (g.state === 'break') g.nextQuarter();
    if (g.match.phase === 'ready') { g.match.phase = 'live'; }
    return g.state === 'playing';
  }

  // HUD 元件拖曳（位置以舞台百分比計）
  _initDrag() {
    let drag = null;
    const app = document.getElementById('app');
    document.addEventListener('pointerdown', (e) => {
      if (!this.open) return;
      const el = e.target.closest?.('[data-hud]');
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      const cfg = this.layout.hud[el.dataset.hud];
      if (!cfg) return;
      drag = { cfg, sx: e.clientX, sy: e.clientY, ox: cfg.x, oy: cfg.y };
    }, true);
    document.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const r = app.getBoundingClientRect();
      drag.cfg.x = +(drag.ox + ((e.clientX - drag.sx) / r.width) * 100).toFixed(1);
      drag.cfg.y = +(drag.oy + ((e.clientY - drag.sy) / r.height) * 100).toFixed(1);
      this._changed();
    });
    document.addEventListener('pointerup', () => { drag = null; });
    // 拖曳時避免觸發按鈕
    document.addEventListener('click', (e) => {
      if (this.open && e.target.closest?.('[data-hud]')) { e.stopPropagation(); e.preventDefault(); }
    }, true);
  }
}
