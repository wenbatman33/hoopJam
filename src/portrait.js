import * as THREE from 'three';
import { buildHead } from './head.js';
import { loadFace } from './models.js';

// 球員頭像：用場上同一顆 3D 頭（含頭髮、頭帶）拍成小圖，給選隊卡片等介面使用
// 結果以 data URL 快取，每位球員只拍一次

const SIZE = 192;

export class PortraitStudio {
  constructor(renderer, faceDB) {
    this.renderer = renderer;
    this.faceDB = faceDB;
    this.rt = new THREE.WebGLRenderTarget(SIZE, SIZE, { samples: 4 });
    this.rt.texture.colorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#7a6a5a', 1.5));
    const key = new THREE.DirectionalLight('#fff4e0', 2.1);
    key.position.set(2.5, 3, 5);
    this.scene.add(key);
    this.cam = new THREE.PerspectiveCamera(22, 1, 0.1, 60);
    this.buf = new Uint8Array(SIZE * SIZE * 4);
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = SIZE;
    this.cache = new Map();
  }

  // 回傳 Promise<data URL>
  get(player) {
    if (!this.cache.has(player.id)) this.cache.set(player.id, this._shoot(player));
    return this.cache.get(player.id);
  }

  async _shoot(player) {
    const face = this.faceDB[player.id] || null;
    const look = { ...player, face, skin: face ? face.skin : player.skin };
    const tex = face ? await loadFace(`./assets/faces/${face.file}`) : null;
    const head = buildHead(look, tex);
    this.scene.add(head.group);

    // 取景：頭頂（含髮型）到下巴，大鬍子最多往下拍到胸口
    const chin = face ? (1 - face.eye) * (0.9 / face.eye) : 1.05;
    const top = 1.42;
    const bottom = -Math.min(chin, 1.85) - 0.12;
    const cy = (top + bottom) / 2;
    const dist = ((top - bottom) / 2 / Math.tan(THREE.MathUtils.degToRad(11))) * 1.04;
    const yaw = 0.2;
    this.cam.position.set(Math.sin(yaw) * dist, cy + 0.15, Math.cos(yaw) * dist);
    this.cam.lookAt(0, cy, 0);

    const R = this.renderer;
    const prevTarget = R.getRenderTarget();
    const prevColor = R.getClearColor(new THREE.Color());
    const prevAlpha = R.getClearAlpha();
    R.setRenderTarget(this.rt);
    R.setClearColor(0x000000, 0);
    R.clear();
    R.render(this.scene, this.cam);
    R.readRenderTargetPixels(this.rt, 0, 0, SIZE, SIZE, this.buf);
    R.setRenderTarget(prevTarget);
    R.setClearColor(prevColor, prevAlpha);

    // 上下翻轉並還原預乘的透明邊緣
    const ctx = this.canvas.getContext('2d');
    const img = ctx.createImageData(SIZE, SIZE);
    const src = this.buf;
    const dst = img.data;
    for (let y = 0; y < SIZE; y++) {
      const so = (SIZE - 1 - y) * SIZE * 4;
      const d0 = y * SIZE * 4;
      for (let x = 0; x < SIZE * 4; x += 4) {
        const a = src[so + x + 3];
        const k = a > 0 && a < 255 ? 255 / a : 1;
        dst[d0 + x] = Math.min(255, src[so + x] * k);
        dst[d0 + x + 1] = Math.min(255, src[so + x + 1] * k);
        dst[d0 + x + 2] = Math.min(255, src[so + x + 2] * k);
        dst[d0 + x + 3] = a;
      }
    }
    ctx.putImageData(img, 0, 0);
    const url = this.canvas.toDataURL('image/png');

    head.group.removeFromParent();
    head.dispose();
    return url;
  }
}
