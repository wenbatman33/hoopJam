import * as THREE from 'three';
import { VISUAL } from './config.js';
import { faceTexture, MOODS, FALLBACK_EYE, FALLBACK_IPD } from './faces.js';

// 球員的頭：依「臉部資料」建模
// - 頭型輪廓直接取自 AI 臉部圖的外框（scripts/process_faces.py 量出的 profile）
// - 臉部貼圖從正面投影到前半顆頭；鼻子、眉骨、眼窩、嘴唇依偵測到的眼睛位置做出立體起伏
// - 沒有 AI 圖的球員退回程式繪製的臉（faces.js）與預設頭型
// 座標：+Y 上、+Z 臉的正面、原點在兩眼之間。頭頂到眼睛固定為 CROWN，其餘照圖的比例

const TAU = Math.PI * 2;
const CROWN = 0.9;
const NS = 34; // 正面橫向格數
const NT = 46; // 縱向格數（頭頂 → 下巴）
const NB = 16; // 後半圈格數
const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// 共用幾何（髮型零件）
let G = null;
function geos() {
  if (!G) {
    G = {
      ball: new THREE.SphereGeometry(1, 14, 10),
      lock: new THREE.CapsuleGeometry(1, 4, 3, 8), // 總長 6
      band: new THREE.TorusGeometry(1.03, 0.09, 8, 30),
      flat: new THREE.CylinderGeometry(0.8, 0.86, 0.34, 20),
      neck: new THREE.CylinderGeometry(1, 1.08, 1, 14),
    };
  }
  return G;
}

// ───────── 髮型（以單位球為基準，外層再縮放成顱骨大小）─────────
function cap(mat, r, thetaLen, tilt = -0.38) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 26, 12, 0, TAU, 0, thetaLen), mat);
  m.rotation.x = tilt;
  m.userData.ownGeo = true;
  return m;
}

function blob(mat, x, y, z, sx, sy = sx, sz = sx) {
  const m = new THREE.Mesh(geos().ball, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  return m;
}

// 垂下的髮辮 / 髒辮：尾端略往外翹
function lock(mat, ang, y0, len, r, out = 1.0) {
  const m = new THREE.Mesh(geos().lock, mat);
  m.scale.set(r, len / 6, r);
  m.position.set(Math.sin(ang) * out, y0 - len * 0.5, Math.cos(ang) * out);
  m.rotation.set(-Math.cos(ang) * 0.16, 0, Math.sin(ang) * 0.16);
  return m;
}

function buildHair(style, mat, add) {
  switch (style) {
    case 'bald':
      break;
    case 'buzz':
      add(cap(mat, 1.035, 1.2));
      break;
    case 'short':
      add(cap(mat, 1.08, 1.26, -0.42));
      break;
    case 'flat': // 平頭高聳
      add(cap(mat, 1.06, 1.1, -0.32));
      { const f = new THREE.Mesh(geos().flat, mat); f.position.set(0, 0.92, -0.06); add(f); }
      break;
    case 'curly': // 短捲髮
      add(cap(mat, 1.06, 1.18));
      for (let i = 0; i < 11; i++) {
        const a = (i / 11) * TAU;
        const r = i % 2 ? 0.52 : 0.26;
        add(blob(mat, Math.sin(a) * r, 0.9 - r * 0.25, Math.cos(a) * r - 0.12, 0.33));
      }
      add(blob(mat, 0, 1.0, -0.1, 0.36));
      break;
    case 'afro':
      add(cap(mat, 1.06, 1.22));
      add(blob(mat, 0, 0.42, -0.14, 1.26, 1.08, 1.2));
      break;
    case 'braids': // 貼頭辮子 + 後腦垂辮
      add(cap(mat, 1.055, 1.28));
      for (let i = 0; i < 9; i++) add(lock(mat, Math.PI + (i - 4) * 0.3, 0.3, 1.25, 0.085, 0.98));
      break;
    case 'dreads': // 髒辮：整圈垂落
      add(cap(mat, 1.07, 1.16));
      for (let i = 0; i < 14; i++) {
        const a = Math.PI + (i - 6.5) * 0.36;
        add(lock(mat, a, 0.55 + (i % 2) * 0.12, 0.95 + (i % 3) * 0.14, 0.115, 0.98));
      }
      break;
    case 'long': // 及肩長髮
      add(cap(mat, 1.08, 1.32, -0.44));
      add(blob(mat, 0, -0.32, -0.42, 1.0, 1.05, 0.72));
      break;
    case 'bun': // 丸子頭
      add(cap(mat, 1.055, 1.28));
      add(blob(mat, 0, 1.02, -0.42, 0.36));
      break;
    case 'mohawk':
      add(cap(mat, 1.035, 1.08));
      for (let i = 0; i < 6; i++) add(blob(mat, 0, 1.0 - i * 0.03 - Math.abs(i - 2) * 0.05, 0.5 - i * 0.26, 0.2, 0.3, 0.22));
      break;
    default:
      add(cap(mat, 1.06, 1.22));
  }
}

// 沒有 AI 圖時的預設頭型資料
function fallbackFace(look) {
  const n = 41;
  const eye = FALLBACK_EYE;
  const profile = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const v = t < eye ? (eye - t) / eye : (t - eye) / (1 - eye); // 0 眼睛 → 1 頭頂 / 下巴
    profile.push(0.86 * Math.sqrt(Math.max(0.02, 1 - Math.pow(v, t < eye ? 2 : 2.6))));
  }
  return { skin: look.skin, aspect: 0.8, eye, ipd: FALLBACK_IPD, profile };
}

// 依臉部資料產生頭部網格（正面有立體五官）
function headGeometry(face) {
  const prof = face.profile;
  const n = prof.length;
  const H = CROWN / face.eye; // 整顆頭（含鬍子）的高度
  const halfW = (face.aspect * H) / 2; // 圖寬的一半
  const at = (t) => {
    const f = Math.max(0, Math.min(1, t)) * (n - 1);
    const i = Math.min(n - 2, Math.floor(f));
    return (prof[i] + (prof[i + 1] - prof[i]) * (f - i)) * halfW;
  };
  let maxX = 0;
  for (let i = 0; i < n; i++) maxX = Math.max(maxX, prof[i] * halfW);
  const D = maxX * VISUAL.headDepth;
  const chin = (1 - face.eye) * H; // 眼睛到最底端
  const top = CROWN + 0.03;
  const yOf = (t) => (face.eye - t) * H;
  const zFront = (y) => {
    if (y >= 0) return D * Math.sqrt(Math.max(0, 1 - Math.pow(y / top, 2.2)));
    const k = Math.min(1, -y / chin);
    return D * (1 - 0.2 * k * k) * Math.sqrt(Math.max(0, 1 - Math.pow(k, 5)));
  };
  const zBack = (y) => {
    if (y >= 0) return D * 1.05 * Math.sqrt(Math.max(0, 1 - Math.pow(y / top, 2)));
    const k = Math.min(1, (-y / Math.min(chin, 1.3)) * 1.12);
    return D * 1.05 * Math.sqrt(Math.max(0, 1 - k * k));
  };

  // 立體五官：位置由眼睛高度（y=0）與兩眼間距推算
  const ipd = face.ipd * 2 * halfW;
  const eyeX = ipd / 2;
  const bridge = 0.06 * ipd;
  const noseTip = -0.7 * ipd;
  const mouthY = -1.12 * ipd;
  const browY = 0.3 * ipd;
  const relief = (x, y) => {
    let r = 0;
    const tn = (bridge - y) / (bridge - noseTip); // 0 鼻樑 → 1 鼻頭
    if (tn > -0.25 && tn < 1.32) {
      const h = tn <= 1 ? 0.2 + 0.8 * Math.pow(Math.max(0, tn), 1.6) : Math.max(0, 1 - (tn - 1) / 0.3);
      const w = ipd * (0.15 + 0.15 * Math.max(0, Math.min(1, tn)));
      r += VISUAL.faceNose * h * Math.exp(-(x * x) / (w * w)) * smooth(-0.25, 0.05, tn);
    }
    r += VISUAL.faceBrow * Math.exp(-Math.pow((y - browY) / (0.17 * ipd), 2)) * Math.exp(-Math.pow(x / (1.15 * ipd), 4));
    r -= VISUAL.faceEye * Math.exp(-Math.pow(y / (0.2 * ipd), 2) - Math.pow((Math.abs(x) - eyeX) / (0.34 * ipd), 2));
    r += VISUAL.faceLip * Math.exp(-Math.pow((y - mouthY) / (0.14 * ipd), 2) - Math.pow(x / (0.5 * ipd), 2));
    return r;
  };

  const pos = [];
  const uv = [];
  const idx = [];
  const cols = NS + 1 + NB + 1; // 正面 NS+1 點 + 後半圈 NB+1 點（背面中央重複一點，讓左右各自取樣圖的左右邊）
  for (let j = 0; j <= NT; j++) {
    const t = j / NT;
    const y = yOf(t);
    const X = at(t);
    const zf = zFront(y);
    const zb = zBack(y);
    // 正面：s 由 +1（角色左側）到 -1
    for (let i = 0; i <= NS; i++) {
      const s = 1 - (2 * i) / NS;
      const x = s * X;
      const z = zf * Math.sqrt(Math.max(0, 1 - s * s)) + relief(x, y) * Math.sqrt(Math.max(0, 1 - s * s * s * s));
      pos.push(x, y, z);
      // 略往內取樣，避開圖上的墨線外框與耳朵，側面才能接上後腦的顏色
      uv.push(0.5 + (x * 0.93) / (2 * halfW), 1 - t);
    }
    // 後半圈：從右側（-X）繞到左側（+X）；貼圖取該列的邊緣顏色
    for (let i = 0; i <= NB; i++) {
      const half = i <= NB / 2 ? 0 : 1; // 0 右半、1 左半
      const k = i <= NB / 2 ? i : i - 1;
      const a = -Math.PI / 2 - (k / (NB - 1)) * Math.PI; // -90° → -270°
      pos.push(Math.sin(a) * X, y, Math.cos(a) * zb);
      uv.push(half ? 1 : 0, 1 - t);
    }
  }
  for (let j = 0; j < NT; j++) {
    for (let i = 0; i < cols; i++) {
      if (i === NS + 1 + NB / 2) continue; // 背面中央的接縫不連
      const a = j * cols + i;
      const b = j * cols + ((i + 1) % cols);
      const c = a + cols;
      const d = b + cols;
      idx.push(a, b, c, b, d, c);
    }
  }
  // 頭頂與底部封口
  const topI = pos.length / 3;
  pos.push(0, top, -0.02 * D);
  uv.push(0.5, 0.995);
  const botI = topI + 1;
  pos.push(0, yOf(1) - 0.02, 0);
  uv.push(0.5, 0.005);
  for (let i = 0; i < cols; i++) {
    if (i === NS + 1 + NB / 2) continue;
    const i2 = (i + 1) % cols;
    idx.push(topI, i2, i);
    idx.push(botI, NT * cols + i, NT * cols + i2);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return { geometry: g, maxX, D, chin, earX: at(face.eye + 0.07), top };
}

// look: { skin, hair（髮型）, hairColor, beard, band, face（臉部資料或 null）}
// tex: AI 臉部貼圖（可稍後用 setTexture 補上）
export function buildHead(look, tex = null) {
  const g = geos();
  const ai = !!look.face;
  const face = look.face || fallbackFace(look);
  const group = new THREE.Group();
  const mats = [];
  const std = (color, rough = 0.78) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });
    mats.push(m);
    return m;
  };
  const skinMat = std(face.skin || look.skin);
  const hairMat = std(look.hairColor || '#15100e', 0.9);

  // 沒有 AI 圖：用程式畫的四種表情；有 AI 圖：貼圖載入前先用膚色
  const textures = {};
  if (!ai) for (const mood of MOODS) textures[mood] = faceTexture(look, mood);
  const faceMat = new THREE.MeshStandardMaterial({ map: ai ? tex : textures.normal, color: ai && !tex ? face.skin : '#ffffff', roughness: 0.78, metalness: 0 });
  mats.push(faceMat);

  const built = headGeometry(face);
  const skull = new THREE.Mesh(built.geometry, faceMat);
  group.add(skull);

  // 耳朵
  for (const sx of [-1, 1]) group.add(blob(skinMat, sx * built.earX * 0.99, -0.16, -0.1 * built.D, 0.085, 0.2, 0.15));
  // 脖子
  const neck = new THREE.Mesh(g.neck, skinMat);
  const anchorY = -Math.min(built.chin, 1.22) + 0.05;
  neck.scale.set(0.3, 0.95, 0.3);
  neck.position.set(0, anchorY - 0.28, -0.3 * built.D);
  group.add(neck);

  // 頭髮與頭帶：縮放成顱骨的橢球
  const cranium = new THREE.Group();
  cranium.position.set(0, 0.08, -0.03 * built.D);
  cranium.scale.set(built.maxX * 1.03, 0.86, built.D * 1.04);
  group.add(cranium);
  buildHair(look.hair || 'short', hairMat, (m) => cranium.add(m));
  if (look.band) {
    const band = new THREE.Mesh(g.band, std(look.band, 0.85));
    band.rotation.x = Math.PI / 2 - 0.2;
    band.position.y = 0.42;
    cranium.add(band);
  }

  group.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });

  let mood = 'normal';
  return {
    group,
    mats,
    // Head 骨頭原點對應的頭部座標（下巴高度、偏後腦）
    anchor: new THREE.Vector3(0, anchorY, -0.3 * built.D),
    setTexture(t) {
      if (!ai) return;
      faceMat.map = t;
      faceMat.color.set('#ffffff');
      faceMat.needsUpdate = true;
    },
    setMood(next) {
      if (ai || next === mood || !textures[next]) return;
      mood = next;
      faceMat.map = textures[next];
    },
    dispose() {
      for (const t of Object.values(textures)) t.dispose();
      for (const m of mats) m.dispose();
      built.geometry.dispose();
      group.traverse((o) => { if (o.userData.ownGeo) o.geometry.dispose(); });
    },
  };
}
