// 遊戲全域設定：DEV 工具會即時修改這些物件，匯出後再 bake 回此檔

export const GAME_TITLE = 'HOOP JAM';

// 球場尺寸（公尺）。隊伍 0 進攻 -Z（畫面上方），隊伍 1 進攻 +Z（畫面下方）
export const COURT = {
  halfW: 6,
  halfL: 12,
  hoopZ: 10.4, // 籃框中心距中線
  boardZ: 10.82, // 籃板平面
  rimH: 3.05,
  rimR: 0.26,
  threeR: 5.7, // 三分線半徑
  cornerX: 5.5, // 底角三分直線
  keyHalfW: 1.9,
  keyLen: 4.8,
  margin: 0.7, // 球員可踩出界外的距離
  apron: 2.6, // 界外木地板外圈
};

// 遊戲手感參數
export const TUNING = {
  // 移動
  runSpeed: 5.6,
  turboMul: 1.42,
  accel: 10, // 速度追隨銳利度
  turnRate: 14,
  ballCarryMul: 0.95, // 持球速度倍率
  // 跳躍
  gravity: 24,
  jumpVel: 8.2,
  // 渦輪
  turboDrain: 0.3, // 每秒消耗
  turboRegen: 0.2, // 每秒回復
  shoveCost: 0.22,
  // 投籃命中率
  pLayup: 0.86,
  pClose: 0.64,
  pMid: 0.5,
  pThree: 0.4,
  contestPenalty: 0.3, // 被貼防的最大扣減
  perfectBonus: 0.1, // 最高點出手加成
  fireBonus: 0.28, // 著火加成
  shotArc: 1, // 拋物線高度倍率
  shotTime: 1, // 球飛行時間倍率
  // 灌籃
  dunkRange: 3.5,
  layupRange: 2.6,
  dunkTime: 0.72,
  dunkArc: 0.75, // 飛行弧線額外高度
  dunkReach: 2.0, // 灌籃時手的高度（相對腳底）
  dunkBlockChance: 0.4,
  // 防守
  stealRange: 1.45,
  stealChance: 0.28,
  stealCooldown: 0.55,
  shoveRange: 1.25,
  shoveSpeed: 9,
  downTime: 1.15, // 被推倒秒數
  blockRadius: 0.7,
  // 傳球 / 球
  passSpeed: 17,
  interceptRadius: 0.7,
  pickupRadius: 0.9,
  ballBounce: 0.62,
  // 規則
  quarterSeconds: 60,
  quarters: 4,
  shotClock: 24,
  fireStreak: 3, // 連進幾球著火
  // 角色
  playerHeight: 2.0,
  headScale: 1.35, // 大頭比例
  // 節奏演出
  slowmo: 0.3, // 灌籃慢動作倍率
  slowmoTime: 0.5,
};

// 視覺參數
export const VISUAL = {
  exposure: 1.05,
  hemi: 1.15,
  sun: 1.9,
  shake: 1,
  ringOpacity: 0.85,
  nearHoopOpacity: 0.22, // 近端籃架透明度（避免擋住畫面）
  // 球衣號碼（角色空間，公尺）
  numSize: 0.34,
  numBackY: 1.27,
  numBackZ: -0.19,
  numFrontY: 1.28,
  numFrontZ: 0.2,
};

// AI 難度（只影響對手）
// think 決策間隔 / steal 每秒抄截意願 / block 跟跳機率 / shotIQ 出手選擇 / shove 推人機率 / speed 跑速倍率
// dunk 灌籃意願 / turbo 每波進攻開渦輪的機率 / acc 命中率倍率 / setup 拿球後先組織的秒數 / gap 貼防距離
export const DIFFICULTY = {
  easy: { label: '簡單', think: 0.5, steal: 0.14, block: 0.15, shotIQ: 0.6, shove: 0.02, speed: 0.9, dunk: 0.4, turbo: 0.4, acc: 0.8, setup: 0.9, gap: 1.6 },
  normal: { label: '普通', think: 0.36, steal: 0.3, block: 0.3, shotIQ: 0.8, shove: 0.06, speed: 0.96, dunk: 0.6, turbo: 0.7, acc: 0.92, setup: 0.45, gap: 1.3 },
  hard: { label: '困難', think: 0.22, steal: 0.7, block: 0.75, shotIQ: 1, shove: 0.16, speed: 1.03, dunk: 0.8, turbo: 1, acc: 1, setup: 0, gap: 1.1 },
};

// 玩家隊友的 AI 水準（固定，不隨難度變弱）
export const MATE_AI = { think: 0.3, steal: 0.45, block: 0.6, shotIQ: 0.9, shove: 0.08, speed: 1, dunk: 0.7, turbo: 0.9, acc: 1, setup: 0, gap: 1.15 };

// 原創隊伍（能力值 0–10：spd 速度 / sht 投籃 / dnk 灌籃 / def 防守；h 身高倍率）
export const TEAMS = [
  {
    id: 'dragons', name: '火龍', en: 'DRAGONS', abbr: 'DRG', jersey: '#e3312f', shorts: '#8e1616', trim: '#ffd23f',
    players: [
      { name: '烈焰', num: 7, skin: '#c98a5e', hair: '#1c1310', h: 0.98, spd: 8, sht: 7, dnk: 6, def: 5 },
      { name: '鐵塔', num: 33, skin: '#7a4a2e', hair: '#0c0c0c', h: 1.08, spd: 4, sht: 4, dnk: 9, def: 8 },
    ],
  },
  {
    id: 'waves', name: '海浪', en: 'WAVES', abbr: 'WAV', jersey: '#19b3c8', shorts: '#0b6480', trim: '#ffffff',
    players: [
      { name: '浪花', num: 3, skin: '#e2b48c', hair: '#d9b25a', h: 0.96, spd: 7, sht: 9, dnk: 4, def: 4 },
      { name: '暗流', num: 21, skin: '#8a5a3a', hair: '#141414', h: 1.04, spd: 6, sht: 6, dnk: 7, def: 7 },
    ],
  },
  {
    id: 'neons', name: '霓虹', en: 'NEONS', abbr: 'NEO', jersey: '#b23cf0', shorts: '#551a86', trim: '#42ffd9',
    players: [
      { name: '閃電', num: 1, skin: '#d9a47a', hair: '#ff4fa3', h: 0.95, spd: 10, sht: 6, dnk: 6, def: 3 },
      { name: '脈衝', num: 88, skin: '#5f3a26', hair: '#42ffd9', h: 1.03, spd: 6, sht: 7, dnk: 7, def: 6 },
    ],
  },
  {
    id: 'comets', name: '彗星', en: 'COMETS', abbr: 'CMT', jersey: '#f2a51a', shorts: '#27324f', trim: '#ffffff',
    players: [
      { name: '流星', num: 11, skin: '#f0c8a0', hair: '#5a3418', h: 1.0, spd: 7, sht: 8, dnk: 5, def: 6 },
      { name: '隕石', num: 50, skin: '#6b4028', hair: '#0e0e0e', h: 1.1, spd: 3, sht: 3, dnk: 10, def: 9 },
    ],
  },
  {
    id: 'rhinos', name: '犀牛', en: 'RHINOS', abbr: 'RHN', jersey: '#e8edf2', shorts: '#5a6b7a', trim: '#1c2733',
    players: [
      { name: '鋼角', num: 44, skin: '#9a6a44', hair: '#2a1a10', h: 1.09, spd: 4, sht: 5, dnk: 9, def: 9 },
      { name: '塵暴', num: 9, skin: '#e8c09a', hair: '#8a8a8a', h: 1.0, spd: 7, sht: 7, dnk: 6, def: 6 },
    ],
  },
  {
    id: 'vipers', name: '毒蛇', en: 'VIPERS', abbr: 'VPR', jersey: '#35b34a', shorts: '#123f1c', trim: '#f4f000',
    players: [
      { name: '毒牙', num: 13, skin: '#b87a50', hair: '#0e0e0e', h: 0.97, spd: 9, sht: 8, dnk: 5, def: 4 },
      { name: '蟒王', num: 24, skin: '#d9a47a', hair: '#3a2a1a', h: 1.05, spd: 6, sht: 6, dnk: 8, def: 7 },
    ],
  },
];

// PC 版面（視窗內置中的直式舞台）
export const LAYOUT_PC = {
  stage: { aspect: 0.5625 }, // 舞台寬高比上限（9:16）
  camera: { height: 11, distance: 10.5, lookAhead: 1.5, lookHeight: 1.2, hfov: 36, followX: 0.75, lead: 1.8, smooth: 4.5, zMin: -7.5, zMax: 9 },
  hud: {
    scoreboard: { x: 50, y: 5.2, size: 1 },
    turbo: { x: 50, y: 13.4, size: 1 },
    banner: { x: 50, y: 27, size: 46, color: '#ffe14a' },
    pause: { x: 92, y: 13.4, size: 1 },
    stick: { x: 22, y: 84, size: 1 },
    btnA: { x: 82, y: 79, size: 1 },
    btnB: { x: 62, y: 88, size: 1 },
    btnC: { x: 85, y: 92, size: 1 },
    btnSw: { x: 90, y: 66, size: 1 },
    hint: { x: 50, y: 97.4, size: 11.5 },
  },
};

// Mobile 版面（直向滿版）
export const LAYOUT_MOBILE = {
  stage: { aspect: 0.62 },
  camera: { height: 11.5, distance: 10.5, lookAhead: 1.5, lookHeight: 1.2, hfov: 36, followX: 0.75, lead: 1.8, smooth: 4.5, zMin: -7.5, zMax: 9 },
  hud: {
    scoreboard: { x: 50, y: 6, size: 1 },
    turbo: { x: 50, y: 13.4, size: 1 },
    banner: { x: 50, y: 27, size: 42, color: '#ffe14a' },
    pause: { x: 91.5, y: 13.4, size: 1 },
    stick: { x: 23, y: 84, size: 1 },
    btnA: { x: 81, y: 78.5, size: 1 },
    btnB: { x: 60, y: 87.5, size: 1 },
    btnC: { x: 84, y: 91.5, size: 1 },
    btnSw: { x: 89, y: 66.5, size: 1 },
    hint: { x: 50, y: 97.4, size: 11 },
  },
};

// 深拷貝預設值，供 DEV 工具「重置」使用
export const DEFAULTS = JSON.parse(JSON.stringify({ TUNING, VISUAL, DIFFICULTY, LAYOUT_PC, LAYOUT_MOBILE }));

const OVERRIDE_KEY = 'hoopjam_dev_overrides_v1';

// 讀取 DEV 工具暫存的覆寫值（尚未 bake 進原始碼前）
export function loadOverrides() {
  try {
    const raw = localStorage.getItem(OVERRIDE_KEY);
    if (!raw) return;
    const o = JSON.parse(raw);
    deepAssign(TUNING, o.TUNING);
    deepAssign(VISUAL, o.VISUAL);
    deepAssign(DIFFICULTY, o.DIFFICULTY);
    deepAssign(LAYOUT_PC, o.LAYOUT_PC);
    deepAssign(LAYOUT_MOBILE, o.LAYOUT_MOBILE);
  } catch (e) { /* 忽略 */ }
}

export function saveOverrides() {
  try {
    localStorage.setItem(OVERRIDE_KEY, JSON.stringify({ TUNING, VISUAL, DIFFICULTY, LAYOUT_PC, LAYOUT_MOBILE }));
  } catch (e) { /* 忽略 */ }
}

export function clearOverrides() {
  try { localStorage.removeItem(OVERRIDE_KEY); } catch (e) { /* 忽略 */ }
  deepAssign(TUNING, DEFAULTS.TUNING);
  deepAssign(VISUAL, DEFAULTS.VISUAL);
  deepAssign(DIFFICULTY, DEFAULTS.DIFFICULTY);
  deepAssign(LAYOUT_PC, DEFAULTS.LAYOUT_PC);
  deepAssign(LAYOUT_MOBILE, DEFAULTS.LAYOUT_MOBILE);
}

export function exportAll() {
  return JSON.stringify({ TUNING, VISUAL, DIFFICULTY, LAYOUT_PC, LAYOUT_MOBILE }, null, 2);
}

function deepAssign(target, src) {
  if (!src) return;
  for (const k of Object.keys(src)) {
    if (!(k in target)) continue;
    if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k])) deepAssign(target[k], src[k]);
    else target[k] = src[k];
  }
}

export const IS_TOUCH = (() => {
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
})();
