import * as THREE from 'three';

// Q 版卡通臉：用 canvas 畫大眼五官，貼在頭部前方的球面貼片上
// 每位球員依 look（膚色、髮色、鬍型）產生四種表情：normal / effort / happy / dizzy

const S = 256;
const CX = S / 2;
const EYE_Y = 124;
const EYE_DX = 47;

export const MOODS = ['normal', 'effort', 'happy', 'dizzy'];

const css = (c) => `#${c.getHexString()}`;

function ellipse(g, x, y, rx, ry) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

// 鬍子（畫在五官底下）
function beard(g, kind, col) {
  if (!kind || kind === 'none') return;
  g.save();
  g.fillStyle = col;
  if (kind === 'stubble') g.globalAlpha = 0.34;
  if (kind === 'goatee') {
    ellipse(g, CX, 214, 44, 40);
    g.fill();
  } else if (kind === 'mustache') {
    ellipse(g, CX, 184, 34, 9);
    g.fill();
  } else {
    // full / big / stubble：沿下顎一整圈，上緣在嘴巴上方
    g.beginPath();
    g.moveTo(0, 138);
    g.lineTo(0, S);
    g.lineTo(S, S);
    g.lineTo(S, 138);
    g.bezierCurveTo(214, 146, 198, 178, CX, 174);
    g.bezierCurveTo(58, 178, 42, 146, 0, 138);
    g.closePath();
    g.fill();
  }
  g.restore();
}

function eye(g, x, mood, sx) {
  const ink = '#1a0f0a';
  g.lineCap = 'round';
  if (mood === 'happy') {
    // 笑瞇瞇 ^ ^
    g.strokeStyle = ink;
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(x - 20, EYE_Y + 8);
    g.quadraticCurveTo(x, EYE_Y - 20, x + 20, EYE_Y + 8);
    g.stroke();
    return;
  }
  if (mood === 'dizzy') {
    g.strokeStyle = ink;
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(x - 16, EYE_Y - 16);
    g.lineTo(x + 16, EYE_Y + 16);
    g.moveTo(x + 16, EYE_Y - 16);
    g.lineTo(x - 16, EYE_Y + 16);
    g.stroke();
    return;
  }
  const ry = mood === 'effort' ? 22 : 27;
  g.fillStyle = '#ffffff';
  ellipse(g, x, EYE_Y, 22, ry);
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = ink;
  g.stroke();
  // 虹膜與瞳孔（略往內看）
  const ix = x - sx * 3;
  const iy = EYE_Y + 3;
  g.fillStyle = '#3a2214';
  ellipse(g, ix, iy, 14, 15);
  g.fill();
  g.fillStyle = '#0a0605';
  ellipse(g, ix, iy, 7.5, 8.5);
  g.fill();
  g.fillStyle = '#ffffff';
  ellipse(g, ix - 5, iy - 7, 5.5, 5.5);
  g.fill();
  ellipse(g, ix + 5, iy + 6, 2.4, 2.4);
  g.fill();
  // 上眼線
  g.strokeStyle = ink;
  g.lineWidth = 6;
  g.beginPath();
  g.ellipse(x, EYE_Y, 22, ry, 0, Math.PI * 1.08, Math.PI * 1.92);
  g.stroke();
}

function brow(g, x, mood, sx, col) {
  g.strokeStyle = col;
  g.lineWidth = 9;
  g.lineCap = 'round';
  g.beginPath();
  if (mood === 'effort') {
    // 用力：眉頭下壓
    g.moveTo(x + sx * 24, EYE_Y - 50);
    g.lineTo(x - sx * 18, EYE_Y - 30);
  } else if (mood === 'dizzy') {
    g.moveTo(x + sx * 22, EYE_Y - 34);
    g.lineTo(x - sx * 16, EYE_Y - 46);
  } else {
    const lift = mood === 'happy' ? 6 : 0;
    g.moveTo(x - 20, EYE_Y - 40 - lift);
    g.quadraticCurveTo(x, EYE_Y - 50 - lift, x + 20, EYE_Y - 40 - lift);
  }
  g.stroke();
}

function mouth(g, mood, bearded) {
  const ink = '#2a120c';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  if (bearded && mood !== 'happy' && mood !== 'effort') {
    // 鬍子上要有嘴唇底色才看得到嘴
    g.fillStyle = '#b8705f';
    ellipse(g, CX, 199, 27, 10);
    g.fill();
  }
  if (mood === 'happy') {
    // 張嘴大笑
    g.fillStyle = '#5a1512';
    g.beginPath();
    g.moveTo(CX - 34, 186);
    g.quadraticCurveTo(CX, 180, CX + 34, 186);
    g.quadraticCurveTo(CX + 30, 228, CX, 230);
    g.quadraticCurveTo(CX - 30, 228, CX - 34, 186);
    g.closePath();
    g.fill();
    g.strokeStyle = ink;
    g.lineWidth = 4;
    g.stroke();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(CX - 28, 188);
    g.quadraticCurveTo(CX, 183, CX + 28, 188);
    g.lineTo(CX + 25, 197);
    g.lineTo(CX - 25, 197);
    g.closePath();
    g.fill();
    g.fillStyle = '#ff7a8a';
    ellipse(g, CX, 220, 15, 8);
    g.fill();
  } else if (mood === 'effort') {
    // 咬牙
    g.fillStyle = '#ffffff';
    g.strokeStyle = ink;
    g.lineWidth = 4;
    g.beginPath();
    g.roundRect(CX - 30, 186, 60, 26, 9);
    g.fill();
    g.stroke();
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(CX - 30, 199);
    g.lineTo(CX + 30, 199);
    for (const dx of [-15, 0, 15]) {
      g.moveTo(CX + dx, 187);
      g.lineTo(CX + dx, 211);
    }
    g.stroke();
  } else if (mood === 'dizzy') {
    g.strokeStyle = ink;
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(CX - 28, 202);
    g.bezierCurveTo(CX - 14, 188, CX - 8, 214, CX, 202);
    g.bezierCurveTo(CX + 8, 190, CX + 14, 214, CX + 28, 200);
    g.stroke();
  } else {
    g.strokeStyle = ink;
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(CX - 24, 194);
    g.quadraticCurveTo(CX, 214, CX + 24, 194);
    g.stroke();
  }
}

export function faceTexture(look, mood) {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const skin = new THREE.Color(look.skin);
  const hair = new THREE.Color(look.hairColor || '#1a1210');
  const browCol = css(hair.clone().multiplyScalar(0.7));
  const bearded = look.beard && look.beard !== 'none' && look.beard !== 'mustache';

  beard(g, look.beard, css(hair));
  // 腮紅
  g.fillStyle = 'rgba(255, 80, 80, 0.2)';
  for (const sx of [-1, 1]) {
    ellipse(g, CX + sx * 80, 166, 20, 13);
    g.fill();
  }
  for (const sx of [-1, 1]) {
    eye(g, CX + sx * EYE_DX, mood, sx);
    brow(g, CX + sx * EYE_DX, mood, sx, browCol);
  }
  // 一字眉
  if (look.unibrow && mood !== 'effort') {
    g.strokeStyle = browCol;
    g.lineWidth = 8;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(CX - 30, EYE_Y - 43);
    g.lineTo(CX + 30, EYE_Y - 43);
    g.stroke();
  }
  // 鼻子
  g.strokeStyle = css(skin.clone().multiplyScalar(0.62));
  g.lineWidth = 4.5;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(CX - 8, 160);
  g.quadraticCurveTo(CX, 170, CX + 8, 160);
  g.stroke();
  mouth(g, mood, bearded);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
