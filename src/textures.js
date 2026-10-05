import * as THREE from 'three';
import { COURT, accentOf } from './config.js';

// 程序化貼圖：球場地板、籃球、觀眾、籃網、陰影、號碼

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, { repeat = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

const FONT_EN = '"Bungee", "Arial Black", sans-serif';
const FONT_TC = '"Noto Sans TC", "PingFang TC", sans-serif';

// 球場地板：木紋 + 標線 + 隊色禁區。畫布上方 = -Z（遠端）
export function courtTexture(home, away) {
  const { halfW, halfL, apron, hoopZ, threeR, cornerX, keyHalfW, keyLen } = COURT;
  const S = 64; // 每公尺像素
  const [c, g] = makeCanvas(Math.round((halfW + apron) * 2 * S), Math.round((halfL + apron) * 2 * S));
  const X = (x) => (x + halfW + apron) * S;
  const Z = (z) => (z + halfL + apron) * S;

  // 界外底色
  g.fillStyle = '#101c33';
  g.fillRect(0, 0, c.width, c.height);

  // 木地板（木條沿 Z 方向）
  const plankW = 0.17 * S;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let px = X(-halfW); px < X(halfW); px += plankW) {
    let pz = Z(-halfL) - rnd() * 2.2 * S;
    while (pz < Z(halfL)) {
      const len = (1.6 + rnd() * 1.4) * S;
      const l = 62 + rnd() * 9;
      g.fillStyle = `hsl(${30 + rnd() * 5}, ${52 + rnd() * 10}%, ${l}%)`;
      const y0 = Math.max(pz, Z(-halfL));
      const y1 = Math.min(pz + len, Z(halfL));
      g.fillRect(px, y0, Math.min(plankW, X(halfW) - px), y1 - y0);
      g.fillStyle = 'rgba(70,40,10,0.22)';
      g.fillRect(px, y1 - 1, plankW, 1);
      pz += len;
    }
    g.fillStyle = 'rgba(70,40,10,0.18)';
    g.fillRect(px, Z(-halfL), 1, (halfL * 2) * S);
  }

  // 禁區塗色：近端（+Z）是主隊防守的籃框，遠端是客隊
  const paintKey = (sign, color) => {
    g.fillStyle = color;
    g.globalAlpha = 0.86;
    const z0 = sign > 0 ? halfL - keyLen : -halfL;
    g.fillRect(X(-keyHalfW), Z(z0), keyHalfW * 2 * S, keyLen * S);
    g.globalAlpha = 1;
  };
  paintKey(1, home.color);
  paintKey(-1, away.color);

  // 中圈
  g.fillStyle = '#16233f';
  g.beginPath();
  g.arc(X(0), Z(0), 1.8 * S, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#f27a1a';
  g.beginPath();
  g.arc(X(0), Z(0), 1.25 * S, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#16233f';
  g.lineWidth = 0.07 * S;
  g.beginPath();
  g.moveTo(X(-1.25), Z(0));
  g.lineTo(X(1.25), Z(0));
  g.moveTo(X(0), Z(-1.25));
  g.lineTo(X(0), Z(1.25));
  g.stroke();
  g.beginPath();
  g.arc(X(-1.45), Z(0), 1.15 * S, -0.9, 0.9);
  g.stroke();
  g.beginPath();
  g.arc(X(1.45), Z(0), 1.15 * S, Math.PI - 0.9, Math.PI + 0.9);
  g.stroke();

  // 標線
  g.strokeStyle = '#ffffff';
  g.lineWidth = 0.075 * S;
  g.lineJoin = 'round';
  g.strokeRect(X(-halfW), Z(-halfL), halfW * 2 * S, halfL * 2 * S);
  g.beginPath();
  g.moveTo(X(-halfW), Z(0));
  g.lineTo(X(-1.8), Z(0));
  g.moveTo(X(1.8), Z(0));
  g.lineTo(X(halfW), Z(0));
  g.stroke();
  g.beginPath();
  g.arc(X(0), Z(0), 1.8 * S, 0, Math.PI * 2);
  g.stroke();

  for (const sign of [-1, 1]) {
    const hz = sign * hoopZ;
    const base = sign * halfL;
    const keyTop = sign * (halfL - keyLen);
    // 禁區框與罰球圈
    g.strokeRect(X(-keyHalfW), Z(Math.min(base, keyTop)), keyHalfW * 2 * S, keyLen * S);
    g.beginPath();
    g.arc(X(0), Z(keyTop), 1.8 * S, sign > 0 ? Math.PI : 0, sign > 0 ? Math.PI * 2 : Math.PI);
    g.stroke();
    // 三分線：底角直線 + 弧線
    const dz = Math.sqrt(threeR * threeR - cornerX * cornerX);
    const ang = Math.atan2(dz, cornerX);
    g.beginPath();
    g.moveTo(X(-cornerX), Z(base));
    g.lineTo(X(-cornerX), Z(hz - sign * dz));
    if (sign > 0) g.arc(X(0), Z(hz), threeR * S, Math.PI + ang, Math.PI * 2 - ang);
    else g.arc(X(0), Z(hz), threeR * S, Math.PI - ang, ang, true);
    g.lineTo(X(cornerX), Z(base));
    g.stroke();
    // 禁制區弧線
    g.beginPath();
    g.arc(X(0), Z(hz), 1.25 * S, sign > 0 ? Math.PI : 0, sign > 0 ? Math.PI * 2 : Math.PI);
    g.stroke();
  }

  // 底線外隊名
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `${1.25 * S}px ${FONT_EN}`;
  g.fillStyle = accentOf(home);
  g.fillText(home.en, X(0), Z(halfL + apron * 0.52));
  g.fillStyle = accentOf(away);
  g.fillText(away.en, X(0), Z(-halfL - apron * 0.52));
  // 邊線外標語
  g.font = `${0.8 * S}px ${FONT_EN}`;
  g.fillStyle = 'rgba(255,255,255,0.16)';
  for (const sx of [-1, 1]) {
    g.save();
    g.translate(X(sx * (halfW + apron * 0.55)), Z(0));
    g.rotate(sx * Math.PI / 2);
    g.fillText('HOOP JAM  ·  2 ON 2  ·  HOOP JAM', 0, 0);
    g.restore();
  }

  // 聚光暗角
  const vg = g.createRadialGradient(c.width / 2, c.height / 2, c.height * 0.2, c.width / 2, c.height / 2, c.height * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,10,0.38)');
  g.fillStyle = vg;
  g.fillRect(0, 0, c.width, c.height);

  return toTexture(c);
}

// 籃球（等距圓柱展開）
export function ballTexture() {
  const [c, g] = makeCanvas(512, 256);
  g.fillStyle = '#e8721c';
  g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(${90 + Math.random() * 60},${30 + Math.random() * 30},0,${0.12 + Math.random() * 0.12})`;
    g.fillRect(Math.random() * 512, Math.random() * 256, 1.6, 1.6);
  }
  g.strokeStyle = '#1b1008';
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(0, 128);
  g.lineTo(512, 128);
  for (const u of [0, 256, 512]) {
    g.moveTo(u, 0);
    g.lineTo(u, 256);
  }
  g.stroke();
  // 兩條弧形溝紋
  for (const u0 of [128, 384]) {
    g.beginPath();
    for (let y = 0; y <= 256; y += 4) {
      const x = u0 + Math.sin((y / 256) * Math.PI) * 52 * (u0 === 128 ? 1 : -1);
      if (y === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  return toTexture(c);
}

// 觀眾席
export function crowdTexture() {
  const [c, g] = makeCanvas(512, 256);
  g.fillStyle = '#080d1a';
  g.fillRect(0, 0, 512, 256);
  const cols = ['#e3312f', '#19b3c8', '#f2a51a', '#b23cf0', '#35b34a', '#e8edf2', '#ff7ab8', '#4a6bff'];
  for (let row = 0; row < 9; row++) {
    const y = 14 + row * 27;
    g.fillStyle = 'rgba(255,255,255,0.05)';
    g.fillRect(0, y + 12, 512, 3);
    for (let i = 0; i < 30; i++) {
      const x = i * 17.2 + (row % 2) * 8 + Math.random() * 4;
      const col = cols[(Math.random() * cols.length) | 0];
      const dim = 0.45 + Math.random() * 0.4;
      g.globalAlpha = dim;
      g.fillStyle = col;
      g.fillRect(x - 5.5, y + 2, 11, 12);
      g.fillStyle = ['#e8c09a', '#b87a50', '#7a4a2e', '#f0d0b0'][(Math.random() * 4) | 0];
      g.beginPath();
      g.arc(x, y - 3, 4.6, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.globalAlpha = 1;
  return toTexture(c, { repeat: true });
}

// 籃網（菱形格）
export function netTexture() {
  const [c, g] = makeCanvas(128, 128);
  g.clearRect(0, 0, 128, 128);
  g.strokeStyle = '#ffffff';
  g.lineWidth = 3.2;
  for (let i = -128; i <= 256; i += 21.33) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + 64, 128);
    g.moveTo(i + 64, 0);
    g.lineTo(i, 128);
    g.stroke();
  }
  const t = toTexture(c, { repeat: true });
  return t;
}

// 籃板框線
export function boardTexture() {
  const [c, g] = makeCanvas(360, 210);
  g.fillStyle = 'rgba(210,235,255,0.2)';
  g.fillRect(0, 0, 360, 210);
  g.strokeStyle = '#ffffff';
  g.lineWidth = 9;
  g.strokeRect(5, 5, 350, 200);
  g.lineWidth = 7;
  g.strokeRect(120, 112, 120, 78);
  return toTexture(c);
}

// 圓形柔邊陰影
export function blobTexture() {
  const [c, g] = makeCanvas(64, 64);
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, 'rgba(0,0,0,0.62)');
  gr.addColorStop(0.6, 'rgba(0,0,0,0.38)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return toTexture(c);
}

// 腳下圓環
export function ringTexture() {
  const [c, g] = makeCanvas(128, 128);
  g.strokeStyle = '#ffffff';
  g.lineWidth = 12;
  g.beginPath();
  g.arc(64, 64, 52, 0, Math.PI * 2);
  g.stroke();
  g.globalAlpha = 0.18;
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(64, 64, 52, 0, Math.PI * 2);
  g.fill();
  return toTexture(c);
}

// 玩家頭上箭頭
export function arrowTexture() {
  const [c, g] = makeCanvas(96, 96);
  g.fillStyle = '#ffffff';
  g.strokeStyle = '#101828';
  g.lineWidth = 8;
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(14, 20);
  g.lineTo(82, 20);
  g.lineTo(48, 80);
  g.closePath();
  g.stroke();
  g.fill();
  return toTexture(c);
}

// 球衣號碼
export function numberTexture(num, color = '#ffffff', outline = '#101828') {
  const [c, g] = makeCanvas(128, 128);
  g.font = `92px ${FONT_EN}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = 14;
  g.strokeStyle = outline;
  g.strokeText(String(num), 64, 70);
  g.fillStyle = color;
  g.fillText(String(num), 64, 70);
  return toTexture(c);
}

// 場邊廣告看板
export function adTexture(text, bg, fg) {
  const [c, g] = makeCanvas(1024, 64);
  g.fillStyle = bg;
  g.fillRect(0, 0, 1024, 64);
  g.font = `40px ${FONT_EN}`;
  g.textBaseline = 'middle';
  g.fillStyle = fg;
  let x = 12;
  while (x < 1024) {
    g.fillText(text, x, 35);
    x += g.measureText(text).width + 46;
  }
  return toTexture(c, { repeat: true });
}

// 粒子用柔邊圓點
export function sparkTexture() {
  const [c, g] = makeCanvas(64, 64);
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.35, 'rgba(255,255,255,0.65)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return toTexture(c);
}

// 蓋板特寫的背景：隊色漸層 + 放射光
export function cutinTexture(color, trim) {
  const [c, g] = makeCanvas(256, 128);
  const base = new THREE.Color(color);
  const hex = (k) => `#${base.clone().multiplyScalar(k).getHexString()}`;
  const lg = g.createLinearGradient(0, 0, 0, 128);
  lg.addColorStop(0, hex(0.45));
  lg.addColorStop(0.5, hex(1));
  lg.addColorStop(1, hex(0.4));
  g.fillStyle = lg;
  g.fillRect(0, 0, 256, 128);
  // 放射光束
  g.save();
  g.translate(128, 64);
  g.fillStyle = trim;
  for (let i = 0; i < 18; i++) {
    g.globalAlpha = 0.1 + (i % 3) * 0.05;
    g.rotate((Math.PI * 2) / 18);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(260, -13);
    g.lineTo(260, 13);
    g.closePath();
    g.fill();
  }
  g.restore();
  const rg = g.createRadialGradient(128, 64, 4, 128, 64, 120);
  rg.addColorStop(0, 'rgba(255,255,255,0.4)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, 256, 128);
  return toTexture(c);
}

export { FONT_EN, FONT_TC };
