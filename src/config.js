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
  headScale: 1.6, // 大頭比例
  // 節奏演出
  slowmo: 0.3, // 灌籃慢動作倍率
  slowmoTime: 0.5,
  // 蓋板特寫動畫
  cutinDunkChance: 0.5, // 灌籃起跳時出現的機率（空翻 / 著火灌籃必出）
  cutinTime: 0.85, // 灌籃特寫秒數（真實時間）
  cutinSlow: 0.12, // 特寫期間的遊戲時間倍率
  cutinFireTime: 1.4, // 著火特寫秒數
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
  numSize: 0.28,
  numBackY: 1.27,
  numBackZ: -0.19,
  numFrontY: 1.33,
  numFrontZ: 0.21,
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

// ───────── 隊伍與球員 ─────────
// 2026–27 球季陣容（2026-10-05 依 ESPN 各隊名單整理，每隊取兩名代表球員）
// 非官方同人作品：僅使用隊名文字與配色，不含官方隊徽

const SKIN = ['', '#f2c9a6', '#dba77c', '#bf8558', '#96623e', '#734628', '#573320'];
const HAIR_BLACK = '#17110e';

export function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return '#' + ((f(n >> 16) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).padStart(6, '0');
}
// 亮度 0–255
export function luma(hex) {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
}
// 放在該底色上的文字顏色
export const inkOn = (hex) => (luma(hex) > 150 ? '#101828' : '#ffffff');
// 隊伍在深色背景上的代表色（主色太暗就改用配色）
export const accentOf = (t) => (luma(t.color) < 62 ? (luma(t.trim) < 62 ? '#ffffff' : t.trim) : t.color);

// 球員：P(中文名, 英文名, 背號, 身高倍率, [速度, 投籃, 灌籃, 防守], 膚色 1–6, 髮型, 鬍型, 其他)
// 髮型：bald buzz short flat curly afro braids dreads long bun mohawk；鬍型：none stubble goatee mustache full big
const P = (name, en, num, h, [spd, sht, dnk, def], skin, hair, beard = 'none', x = {}) => ({
  name, en, num, h, spd, sht, dnk, def, skin: SKIN[skin], hair, beard,
  hairColor: x.hairColor || HAIR_BLACK, band: x.band || null, unibrow: !!x.unibrow,
});
// 隊伍：T(縮寫, 分區, 城市, 隊名, 英文隊名, 球衣色, 配色, 球員)
const T = (abbr, conf, city, name, en, jersey, trim, players) => ({
  id: abbr.toLowerCase(), abbr, conf, city, name, en, color: jersey, jersey, shorts: shade(jersey, 0.8), trim, players,
});
const W = '#ffffff';

export const TEAMS = [
  // ── 東區 ──
  T('ATL', 'E', '亞特蘭大', '老鷹', 'HAWKS', '#e03a3e', '#fdb927', [
    P('強森', 'Jalen Johnson', 1, 1.04, [7, 6, 9, 6], 4, 'short', 'stubble'),
    P('麥考倫', 'CJ McCollum', 3, 0.96, [7, 9, 3, 4], 4, 'buzz', 'goatee'),
  ]),
  T('BOS', 'E', '波士頓', '塞爾提克', 'CELTICS', '#007a33', W, [
    P('塔圖姆', 'Jayson Tatum', 0, 1.04, [7, 8, 7, 7], 3, 'short', 'goatee'),
    P('懷特', 'Derrick White', 9, 0.97, [7, 8, 5, 9], 3, 'buzz', 'stubble', { band: W }),
  ]),
  T('BKN', 'E', '布魯克林', '籃網', 'NETS', '#1b1b1b', W, [
    P('小波特', 'Michael Porter Jr.', 17, 1.07, [5, 9, 6, 4], 3, 'curly'),
    P('藍道', 'Julius Randle', 30, 1.04, [5, 6, 8, 5], 4, 'buzz', 'full', { band: W }),
  ]),
  T('CHA', 'E', '夏洛特', '黃蜂', 'HORNETS', '#00788c', W, [
    P('米勒', 'Brandon Miller', 24, 1.04, [7, 8, 7, 5], 4, 'curly'),
    P('克努佩爾', 'Kon Knueppel', 7, 1.0, [5, 9, 4, 5], 1, 'short', 'none', { hairColor: '#6b4a2e' }),
  ]),
  T('CHI', 'E', '芝加哥', '公牛', 'BULLS', '#ce1141', '#111111', [
    P('吉迪', 'Josh Giddey', 3, 1.04, [6, 6, 5, 5], 1, 'curly', 'none', { hairColor: '#6a4a2c' }),
    P('布澤利斯', 'Matas Buzelis', 14, 1.06, [7, 6, 9, 6], 1, 'short', 'none', { hairColor: '#5a4028' }),
  ]),
  T('CLE', 'E', '克里夫蘭', '騎士', 'CAVALIERS', '#860038', '#fdbb30', [
    P('米契爾', 'Donovan Mitchell', 45, 0.96, [9, 8, 8, 5], 4, 'short', 'goatee'),
    P('哈登', 'James Harden', 1, 1.0, [6, 9, 5, 4], 4, 'short', 'big'),
  ]),
  T('DET', 'E', '底特律', '活塞', 'PISTONS', '#1d42ba', '#c8102e', [
    P('康寧漢', 'Cade Cunningham', 2, 1.02, [7, 8, 6, 6], 3, 'curly', 'stubble'),
    P('杜倫', 'Jalen Duren', 0, 1.07, [5, 2, 10, 8], 5, 'short'),
  ]),
  T('IND', 'E', '印第安納', '溜馬', 'PACERS', '#fdbb30', '#002d62', [
    P('哈利伯頓', 'Tyrese Haliburton', 0, 1.0, [8, 9, 5, 5], 3, 'short'),
    P('西亞卡姆', 'Pascal Siakam', 43, 1.05, [7, 6, 8, 7], 5, 'buzz', 'goatee'),
  ]),
  T('MIA', 'E', '邁阿密', '熱火', 'HEAT', '#98002e', '#f9a01b', [
    P('字母哥', 'Giannis Antetokounmpo', 7, 1.1, [8, 4, 10, 9], 5, 'buzz', 'stubble'),
    P('阿德巴約', 'Bam Adebayo', 13, 1.06, [6, 4, 9, 10], 5, 'dreads', 'stubble'),
  ]),
  T('MIL', 'E', '密爾瓦基', '公鹿', 'BUCKS', '#00471b', '#eee1c6', [
    P('希洛', 'Tyler Herro', 11, 0.98, [7, 9, 5, 3], 1, 'short', 'none', { hairColor: '#8a6a3a' }),
    P('透納', 'Myles Turner', 3, 1.1, [4, 7, 7, 9], 4, 'buzz', 'full'),
  ]),
  T('NYK', 'E', '紐約', '尼克', 'KNICKS', '#006bb6', '#f58426', [
    P('布朗森', 'Jalen Brunson', 11, 0.94, [7, 9, 3, 4], 3, 'buzz', 'full'),
    P('唐斯', 'Karl-Anthony Towns', 32, 1.1, [4, 9, 7, 5], 3, 'short', 'goatee'),
  ]),
  T('ORL', 'E', '奧蘭多', '魔術', 'MAGIC', '#0077c0', '#c4ced4', [
    P('班切羅', 'Paolo Banchero', 5, 1.06, [6, 6, 8, 5], 3, 'curly'),
    P('華格納', 'Franz Wagner', 22, 1.06, [7, 7, 7, 6], 1, 'curly', 'none', { hairColor: '#5a4028' }),
  ]),
  T('PHI', 'E', '費城', '七六人', '76ERS', '#1d428a', '#ed174c', [
    P('詹姆斯', 'LeBron James', 23, 1.06, [7, 7, 10, 7], 5, 'buzz', 'full', { band: W }),
    P('恩比德', 'Joel Embiid', 21, 1.12, [3, 7, 8, 9], 5, 'short', 'full'),
  ]),
  T('TOR', 'E', '多倫多', '暴龍', 'RAPTORS', '#1b1b1b', '#ce1141', [
    P('雷納德', 'Kawhi Leonard', 2, 1.03, [6, 8, 7, 10], 4, 'braids', 'stubble'),
    P('巴恩斯', 'Scottie Barnes', 4, 1.05, [7, 5, 8, 8], 4, 'dreads', 'none', { band: W }),
  ]),
  T('WAS', 'E', '華盛頓', '巫師', 'WIZARDS', '#002b5c', '#e31837', [
    P('特雷楊', 'Trae Young', 3, 0.93, [9, 9, 2, 2], 3, 'curly', 'none', { hairColor: '#2a1c14' }),
    P('戴維斯', 'Anthony Davis', 23, 1.1, [5, 5, 9, 10], 4, 'short', 'goatee', { unibrow: true }),
  ]),
  // ── 西區 ──
  T('DAL', 'W', '達拉斯', '獨行俠', 'MAVERICKS', '#00538c', '#b8c4ca', [
    P('弗拉格', 'Cooper Flagg', 32, 1.06, [7, 6, 9, 8], 1, 'short', 'none', { hairColor: '#3a2a1c' }),
    P('厄文', 'Kyrie Irving', 11, 0.95, [9, 9, 4, 4], 4, 'short', 'full', { band: W }),
  ]),
  T('DEN', 'W', '丹佛', '金塊', 'NUGGETS', '#0e2240', '#fec524', [
    P('約基奇', 'Nikola Jokic', 15, 1.11, [2, 8, 3, 6], 1, 'buzz', 'stubble', { hairColor: '#4a3524' }),
    P('莫瑞', 'Jamal Murray', 27, 0.98, [7, 9, 5, 4], 3, 'short', 'goatee'),
  ]),
  T('GSW', 'W', '金州', '勇士', 'WARRIORS', '#1d428a', '#ffc72c', [
    P('柯瑞', 'Stephen Curry', 30, 0.95, [8, 10, 2, 4], 2, 'short', 'goatee'),
    P('巴特勒', 'Jimmy Butler', 10, 1.02, [6, 6, 7, 9], 4, 'short', 'stubble'),
  ]),
  T('HOU', 'W', '休士頓', '火箭', 'ROCKETS', '#ce1141', '#c4ced4', [
    P('杜蘭特', 'Kevin Durant', 7, 1.1, [6, 10, 7, 6], 4, 'short', 'goatee'),
    P('申京', 'Alperen Sengun', 28, 1.09, [4, 5, 6, 6], 1, 'short', 'stubble'),
  ]),
  T('LAC', 'W', '洛杉磯', '快艇', 'CLIPPERS', '#c8102e', '#0c2340', [
    P('英格拉姆', 'Brandon Ingram', 7, 1.05, [6, 8, 6, 4], 4, 'curly', 'goatee'),
    P('賈蘭德', 'Darius Garland', 10, 0.93, [9, 9, 3, 3], 4, 'curly'),
  ]),
  T('LAL', 'W', '洛杉磯', '湖人', 'LAKERS', '#fdb927', '#552583', [
    P('唐西奇', 'Luka Doncic', 77, 1.02, [5, 9, 4, 4], 1, 'short', 'stubble', { hairColor: '#6a4a2c' }),
    P('里夫斯', 'Austin Reaves', 15, 0.98, [6, 8, 4, 4], 1, 'short', 'stubble', { hairColor: '#5a4630', band: W }),
  ]),
  T('MEM', 'W', '曼菲斯', '灰熊', 'GRIZZLIES', '#5d76a9', '#12173f', [
    P('布瑟', 'Cameron Boozer', 27, 1.07, [5, 6, 7, 7], 3, 'curly'),
    P('伊迪', 'Zach Edey', 14, 1.16, [2, 2, 8, 8], 2, 'short'),
  ]),
  T('MIN', 'W', '明尼蘇達', '灰狼', 'TIMBERWOLVES', '#0c2340', '#78be20', [
    P('愛德華茲', 'Anthony Edwards', 5, 1.0, [9, 8, 10, 7], 5, 'curly', 'stubble'),
    P('鮑爾', 'LaMelo Ball', 1, 1.03, [8, 8, 5, 3], 3, 'curly', 'none', { hairColor: '#2a1c14' }),
  ]),
  T('NOP', 'W', '紐奧良', '鵜鶘', 'PELICANS', '#0c2340', '#b4975a', [
    P('錫安', 'Zion Williamson', 1, 1.03, [7, 3, 10, 5], 4, 'buzz', 'stubble'),
    P('墨菲', 'Trey Murphy III', 25, 1.05, [7, 9, 8, 6], 3, 'short'),
  ]),
  T('OKC', 'W', '奧克拉荷馬', '雷霆', 'THUNDER', '#007ac1', '#ef3b24', [
    P('亞歷山大', 'Shai Gilgeous-Alexander', 2, 1.01, [8, 8, 6, 7], 4, 'braids', 'stubble'),
    P('威廉斯', 'Jalen Williams', 8, 1.02, [7, 7, 8, 8], 4, 'curly'),
  ]),
  T('PHX', 'W', '鳳凰城', '太陽', 'SUNS', '#1d1160', '#e56020', [
    P('布克', 'Devin Booker', 15, 1.0, [7, 9, 5, 4], 3, 'short', 'stubble'),
    P('格林', 'Jalen Green', 4, 0.98, [9, 7, 10, 3], 3, 'curly'),
  ]),
  T('POR', 'W', '波特蘭', '拓荒者', 'TRAIL BLAZERS', '#e03a3e', '#111111', [
    P('莫蘭特', 'Ja Morant', 1, 0.95, [10, 5, 10, 3], 4, 'dreads'),
    P('里拉德', 'Damian Lillard', 0, 0.95, [7, 10, 4, 3], 4, 'short', 'full'),
  ]),
  T('SAC', 'W', '沙加緬度', '國王', 'KINGS', '#5a2d81', '#c4ced4', [
    P('沙波尼斯', 'Domantas Sabonis', 11, 1.08, [4, 5, 6, 6], 1, 'short', 'full', { hairColor: '#5a4630' }),
    P('拉文', 'Zach LaVine', 8, 1.0, [8, 8, 10, 3], 3, 'short', 'stubble'),
  ]),
  T('SAS', 'W', '聖安東尼奧', '馬刺', 'SPURS', '#c4ced4', '#111111', [
    P('文班亞馬', 'Victor Wembanyama', 1, 1.18, [6, 7, 9, 10], 3, 'buzz'),
    P('福克斯', "De'Aaron Fox", 4, 0.96, [10, 6, 6, 5], 4, 'curly'),
  ]),
  T('UTA', 'W', '猶他', '爵士', 'JAZZ', '#4b2a8a', '#f9a01b', [
    P('馬卡南', 'Lauri Markkanen', 23, 1.1, [5, 9, 7, 5], 1, 'short', 'none', { hairColor: '#d9b46a' }),
    P('小傑克森', 'Jaren Jackson Jr.', 20, 1.08, [5, 7, 7, 10], 4, 'short', 'goatee'),
  ]),
];

// 兩隊球衣顏色太接近時，客隊改穿白色（或黑色）客場球衣
function colorDist(a, b) {
  const x = parseInt(a.slice(1), 16);
  const y = parseInt(b.slice(1), 16);
  return Math.hypot((x >> 16) - (y >> 16), ((x >> 8) & 255) - ((y >> 8) & 255), (x & 255) - (y & 255));
}
export function resolveKits(home, away) {
  const mark = luma(away.color) > 200 ? away.trim : away.color;
  const kits = [
    { jersey: away.jersey, shorts: away.shorts, trim: away.trim },
    { jersey: '#f2f2f2', shorts: '#d9d9d9', trim: mark },
    { jersey: '#1b1b1b', shorts: '#101010', trim: luma(mark) < 62 ? '#ffffff' : mark },
  ];
  const kit = kits.find((k) => colorDist(k.jersey, home.jersey) >= 125) || kits[1];
  return [home, { ...away, ...kit }];
}

// PC 版面（視窗內置中的直式舞台）
export const LAYOUT_PC = {
  stage: { aspect: 0.5625 }, // 舞台寬高比上限（9:16）
  cutin: { y: 41, h: 26 }, // 蓋板特寫：中心高度 % / 帶狀高度 %
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
  cutin: { y: 40, h: 24 },
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
