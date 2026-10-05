import * as THREE from 'three';
import { faceTexture, MOODS } from './faces.js';

// Q 版大頭：單位半徑的球形頭 + 臉部貼片 + 耳朵 + 髮型 + 頭帶 + 鬍子
// 座標：+Y 上、+Z 臉的正面。由 models.js 掛到 Head 骨頭上並縮放

const TAU = Math.PI * 2;

// 共用幾何（所有球員共用，不釋放）
let G = null;
function geos() {
  if (G) return G;
  // 臉部貼片：正面 ±57°、額頭到下巴
  const W = 1.0;
  G = {
    skull: new THREE.SphereGeometry(1, 28, 20),
    face: new THREE.SphereGeometry(1.012, 22, 16, Math.PI / 2 - W, W * 2, 0.82, 1.6),
    ball: new THREE.SphereGeometry(1, 14, 10),
    lock: new THREE.CapsuleGeometry(1, 4, 3, 8), // 總長 6
    band: new THREE.TorusGeometry(1.015, 0.09, 8, 30),
    flat: new THREE.CylinderGeometry(0.8, 0.86, 0.34, 20),
  };
  return G;
}

// 頭頂髮蓋：球冠往後傾，前額髮際線較高、後腦較低
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

// 垂下的髮辮 / 髒辮：從頭皮某點往下垂
function lock(mat, ang, y0, len, r, out = 1.0) {
  const m = new THREE.Mesh(geos().lock, mat);
  m.scale.set(r, len / 6, r);
  m.position.set(Math.sin(ang) * out, y0 - len * 0.5, Math.cos(ang) * out);
  // 尾端略往外翹
  m.rotation.set(-Math.cos(ang) * 0.16, 0, Math.sin(ang) * 0.16);
  return m;
}

function buildHair(style, mat, add) {
  switch (style) {
    case 'bald':
      break;
    case 'buzz':
      add(cap(mat, 1.028, 1.22));
      break;
    case 'short':
      add(cap(mat, 1.07, 1.28, -0.42));
      break;
    case 'flat': // 平頭高聳
      add(cap(mat, 1.05, 1.12, -0.32));
      { const f = new THREE.Mesh(geos().flat, mat); f.position.set(0, 0.92, -0.06); add(f); }
      break;
    case 'curly': // 短捲髮
      add(cap(mat, 1.05, 1.2));
      for (let i = 0; i < 11; i++) {
        const a = (i / 11) * TAU;
        const r = i % 2 ? 0.52 : 0.26;
        add(blob(mat, Math.sin(a) * r, 0.9 - r * 0.25, Math.cos(a) * r - 0.12, 0.33));
      }
      add(blob(mat, 0, 1.0, -0.1, 0.36));
      break;
    case 'afro':
      add(cap(mat, 1.05, 1.25));
      add(blob(mat, 0, 0.42, -0.14, 1.26, 1.08, 1.2));
      break;
    case 'braids': // 貼頭辮子 + 後腦垂辮
      add(cap(mat, 1.045, 1.3));
      for (let i = 0; i < 9; i++) add(lock(mat, Math.PI + (i - 4) * 0.3, 0.3, 1.25, 0.085, 0.98));
      break;
    case 'dreads': // 髒辮：整圈垂落
      add(cap(mat, 1.06, 1.18));
      for (let i = 0; i < 14; i++) {
        const a = Math.PI + (i - 6.5) * 0.36;
        add(lock(mat, a, 0.55 + (i % 2) * 0.12, 0.95 + (i % 3) * 0.14, 0.115, 0.96));
      }
      break;
    case 'long': // 及肩長髮
      add(cap(mat, 1.07, 1.34, -0.44));
      add(blob(mat, 0, -0.32, -0.42, 1.0, 1.05, 0.72));
      break;
    case 'bun': // 丸子頭
      add(cap(mat, 1.045, 1.3));
      add(blob(mat, 0, 1.02, -0.42, 0.36));
      break;
    case 'mohawk':
      add(cap(mat, 1.028, 1.1));
      for (let i = 0; i < 6; i++) add(blob(mat, 0, 1.0 - i * 0.03 - Math.abs(i - 2) * 0.05, 0.5 - i * 0.26, 0.2, 0.3, 0.22));
      break;
    default:
      add(cap(mat, 1.05, 1.25));
  }
}

// look: { skin, hair（髮型）, hairColor, beard, band（頭帶顏色或 null）}
export function buildHead(look) {
  const g = geos();
  const group = new THREE.Group();
  const shape = new THREE.Group(); // 略扁的頭型
  shape.scale.set(1, 0.95, 0.97);
  group.add(shape);
  const mats = [];
  const std = (color, rough = 0.75) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });
    mats.push(m);
    return m;
  };
  const skinMat = std(look.skin);
  const hairMat = std(look.hairColor || '#15100e', 0.9);

  shape.add(new THREE.Mesh(g.skull, skinMat));
  // 耳朵
  for (const sx of [-1, 1]) shape.add(blob(skinMat, sx * 0.98, -0.06, -0.02, 0.1, 0.22, 0.17));

  // 臉
  const textures = {};
  for (const mood of MOODS) textures[mood] = faceTexture(look, mood);
  const faceMat = new THREE.MeshStandardMaterial({
    map: textures.normal, transparent: true, depthWrite: false, roughness: 0.75,
    polygonOffset: true, polygonOffsetFactor: -3,
  });
  mats.push(faceMat);
  const face = new THREE.Mesh(g.face, faceMat);
  face.renderOrder = 3;
  shape.add(face);

  buildHair(look.hair || 'short', hairMat, (m) => shape.add(m));

  // 大鬍子：下巴多一團
  if (look.beard === 'big') shape.add(blob(hairMat, 0, -0.74, 0.46, 0.7, 0.52, 0.56));

  // 頭帶
  if (look.band) {
    const band = new THREE.Mesh(g.band, std(look.band, 0.85));
    band.rotation.x = Math.PI / 2 - 0.2;
    band.position.y = 0.4;
    shape.add(band);
  }

  group.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });

  let mood = 'normal';
  return {
    group,
    mats,
    setMood(next) {
      if (next === mood || !textures[next]) return;
      mood = next;
      faceMat.map = textures[next];
    },
    dispose() {
      for (const t of Object.values(textures)) t.dispose();
      for (const m of mats) m.dispose();
      group.traverse((o) => { if (o.userData.ownGeo) o.geometry.dispose(); });
    },
  };
}
