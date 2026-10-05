import * as THREE from 'three';

// 手臂姿勢表：每根骨頭給一個「角色空間」方向，骨頭會沿此方向伸展
// 角色空間：x 正 = 角色左側、y = 上、z = 前
// 鍵值：ua 上臂 / fa 前臂 / h 手掌，L 左 R 右。未列出的骨頭維持原動畫

const v = (x, y, z) => new THREE.Vector3(x, y, z).normalize();

export const POSES = {
  // 運球（右手）：球在最高點 / 手往下壓
  dribbleHi: { uaR: v(-0.32, -0.88, 0.28), faR: v(-0.1, -0.22, 1), hR: v(0, -0.45, 0.9) },
  dribbleLo: { uaR: v(-0.28, -0.9, 0.36), faR: v(-0.06, -0.78, 0.62), hR: v(0, -0.9, 0.4) },
  // 雙手持球於腰前
  hold: {
    uaR: v(-0.34, -0.82, 0.42), faR: v(0.32, -0.12, 0.92), hR: v(0.4, 0, 0.9),
    uaL: v(0.34, -0.82, 0.42), faL: v(-0.32, -0.12, 0.92), hL: v(-0.4, 0, 0.9),
  },
  // 跳投：收球到額頭 → 出手
  shootSet: {
    uaR: v(-0.22, 0.3, 0.92), faR: v(0.14, 0.95, 0.12), hR: v(0.1, 0.9, -0.3),
    uaL: v(0.3, 0.12, 0.94), faL: v(-0.2, 0.92, 0.22), hL: v(-0.3, 0.9, 0),
  },
  shootRelease: {
    uaR: v(-0.1, 0.86, 0.5), faR: v(-0.02, 0.84, 0.54), hR: v(0, 0.1, 1),
    uaL: v(0.26, 0.6, 0.72), faL: v(0.02, 0.92, 0.36), hL: v(0, 0.9, 0.4),
  },
  // 蓋火鍋 / 搶籃板：雙手高舉
  block: {
    uaR: v(-0.26, 0.95, 0.14), faR: v(-0.08, 1, 0.12), hR: v(0, 1, 0.2),
    uaL: v(0.26, 0.95, 0.14), faL: v(0.08, 1, 0.12), hL: v(0, 1, 0.2),
  },
  // 單手戰斧灌籃：後拉 → 砸下 → 掛框
  dunkWind: {
    uaR: v(-0.32, 0.82, -0.36), faR: v(-0.1, 0.62, -0.78), hR: v(0, 0.5, -0.86),
    uaL: v(0.8, 0.2, 0.42), faL: v(0.7, 0.5, 0.5),
  },
  dunkSlam: {
    uaR: v(-0.12, 0.82, 0.58), faR: v(0, 0.38, 0.92), hR: v(0, -0.5, 0.86),
    uaL: v(0.82, -0.1, 0.3), faL: v(0.8, 0.3, 0.3),
  },
  // 雙手灌籃
  dunk2Wind: {
    uaR: v(-0.24, 0.92, -0.2), faR: v(-0.06, 0.8, -0.6), hR: v(0, 0.6, -0.8),
    uaL: v(0.24, 0.92, -0.2), faL: v(0.06, 0.8, -0.6), hL: v(0, 0.6, -0.8),
  },
  dunk2Slam: {
    uaR: v(-0.16, 0.8, 0.6), faR: v(0.06, 0.36, 0.93), hR: v(0, -0.5, 0.86),
    uaL: v(0.16, 0.8, 0.6), faL: v(-0.06, 0.36, 0.93), hL: v(0, -0.5, 0.86),
  },
  // 胸前傳球
  passWind: {
    uaR: v(-0.4, -0.7, 0.3), faR: v(0.3, 0.25, 0.92), hR: v(0.2, 0.3, 0.9),
    uaL: v(0.4, -0.7, 0.3), faL: v(-0.3, 0.25, 0.92), hL: v(-0.2, 0.3, 0.9),
  },
  passThrow: {
    uaR: v(-0.16, -0.08, 1), faR: v(-0.04, 0, 1), hR: v(0, 0, 1),
    uaL: v(0.16, -0.08, 1), faL: v(0.04, 0, 1), hL: v(0, 0, 1),
  },
  // 抄截：右手由外往內掃
  stealA: { uaR: v(-0.7, -0.3, 0.65), faR: v(-0.6, -0.2, 0.78), hR: v(-0.4, -0.2, 0.9) },
  stealB: { uaR: v(0.05, -0.35, 0.94), faR: v(0.7, -0.25, 0.66), hR: v(0.9, -0.2, 0.4) },
  // 推人
  shove: {
    uaR: v(-0.2, 0.02, 1), faR: v(-0.06, 0.08, 1), hR: v(0, 0.5, 0.86),
    uaL: v(0.2, 0.02, 1), faL: v(0.06, 0.08, 1), hL: v(0, 0.5, 0.86),
  },
  // 防守站姿：雙手張開
  defend: {
    uaR: v(-0.88, -0.28, 0.38), faR: v(-0.6, 0.62, 0.5), hR: v(-0.3, 0.9, 0.3),
    uaL: v(0.88, -0.28, 0.38), faL: v(0.6, 0.62, 0.5), hL: v(0.3, 0.9, 0.3),
  },
  // 慶祝
  cheer: {
    uaR: v(-0.5, 0.86, 0.06), faR: v(-0.2, 0.98, 0), hR: v(0, 1, 0),
    uaL: v(0.5, 0.86, 0.06), faL: v(0.2, 0.98, 0), hL: v(0, 1, 0),
  },
};

export const POSE_KEYS = ['uaL', 'faL', 'hL', 'uaR', 'faR', 'hR'];

// 兩姿勢內插；缺少的骨頭沿用另一邊
export function mixPose(a, b, t, out) {
  for (const k of POSE_KEYS) {
    const pa = a[k];
    const pb = b[k];
    if (!pa && !pb) { delete out[k]; continue; }
    const o = out[k] || (out[k] = new THREE.Vector3());
    if (pa && pb) o.copy(pa).lerp(pb, t).normalize();
    else o.copy(pa || pb);
  }
  return out;
}

// 左右鏡射（右手姿勢 → 左手）
const SWAP = { uaL: 'uaR', faL: 'faR', hL: 'hR', uaR: 'uaL', faR: 'faL', hR: 'hL' };
export function mirrorPose(a, out) {
  for (const k of POSE_KEYS) {
    const src = a[SWAP[k]];
    if (!src) { delete out[k]; continue; }
    const o = out[k] || (out[k] = new THREE.Vector3());
    o.set(-src.x, src.y, src.z);
  }
  return out;
}
