import * as THREE from 'three';
import { sparkTexture } from './textures.js';

// 粒子特效：著火尾焰、灌籃火花、進球彩帶。單一 Points 物件 + 粒子池

const MAX = 420;

export class Effects {
  constructor(scene) {
    this.n = 0;
    this.p = [];
    for (let i = 0; i < MAX; i++) this.p.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 1, r: 1, g: 1, b: 1, grav: 0, drag: 0 });
    this.cursor = 0;
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 4);
    this.size = new Float32Array(MAX);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 4));
    geo.setAttribute('psize', new THREE.BufferAttribute(this.size, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: sparkTexture() }, scale: { value: 600 } },
      vertexShader: `
        attribute vec4 pcolor;
        attribute float psize;
        uniform float scale;
        varying vec4 vColor;
        void main() {
          vColor = pcolor;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = psize * scale / max(0.1, -mv.z);
        }`,
      fragmentShader: `
        uniform sampler2D map;
        varying vec4 vColor;
        void main() {
          float a = texture2D(map, gl_PointCoord).a * vColor.a;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vColor.rgb * a, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      premultipliedAlpha: true,
    });
    this.mat = mat;
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    scene.add(this.points);
  }

  // 畫面高度（像素）改變時更新粒子大小基準
  setViewport(h) {
    this.mat.uniforms.scale.value = h * 0.9;
  }

  emit(x, y, z, vx, vy, vz, life, size, color, grav = 0, drag = 0) {
    const q = this.p[this.cursor];
    this.cursor = (this.cursor + 1) % MAX;
    q.life = q.max = life;
    q.x = x; q.y = y; q.z = z;
    q.vx = vx; q.vy = vy; q.vz = vz;
    q.size = size;
    q.r = color.r; q.g = color.g; q.b = color.b;
    q.grav = grav;
    q.drag = drag;
  }

  // 著火尾焰（每幀呼叫）
  flame(pos, intensity = 1, count = 2) {
    for (let i = 0; i < count; i++) {
      const hot = Math.random();
      _c.setRGB(1, 0.35 + hot * 0.5, hot * 0.25);
      this.emit(
        pos.x + (Math.random() - 0.5) * 0.25, pos.y + (Math.random() - 0.5) * 0.25, pos.z + (Math.random() - 0.5) * 0.25,
        (Math.random() - 0.5) * 0.8, 1.2 + Math.random() * 1.6, (Math.random() - 0.5) * 0.8,
        0.3 + Math.random() * 0.3, (0.3 + Math.random() * 0.3) * intensity, _c, -1.5, 1.5,
      );
    }
  }

  // 火花爆開（灌籃 / 蓋火鍋）
  burst(pos, color, n = 28, speed = 5) {
    _c.set(color);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const u = Math.random() * 0.9 + 0.1;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.emit(pos.x, pos.y, pos.z, Math.cos(a) * s * u, (Math.random() * 0.9 + 0.2) * s, Math.sin(a) * s * u, 0.45 + Math.random() * 0.45, 0.16 + Math.random() * 0.2, _c, 14, 1.2);
    }
  }

  update(dt) {
    let n = 0;
    for (let i = 0; i < MAX; i++) {
      const q = this.p[i];
      if (q.life <= 0) continue;
      q.life -= dt;
      const d = Math.exp(-q.drag * dt);
      q.vx *= d; q.vz *= d;
      q.vy = q.vy * d - q.grav * dt;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      if (q.y < 0.03 && q.grav > 0) { q.y = 0.03; q.vy *= -0.4; }
      const k = Math.max(0, q.life / q.max);
      this.pos[n * 3] = q.x;
      this.pos[n * 3 + 1] = q.y;
      this.pos[n * 3 + 2] = q.z;
      this.col[n * 4] = q.r;
      this.col[n * 4 + 1] = q.g;
      this.col[n * 4 + 2] = q.b;
      this.col[n * 4 + 3] = k;
      this.size[n] = q.size * (0.5 + k * 0.5);
      n++;
    }
    const geo = this.points.geometry;
    geo.setDrawRange(0, n);
    geo.attributes.position.needsUpdate = true;
    geo.attributes.pcolor.needsUpdate = true;
    geo.attributes.psize.needsUpdate = true;
  }
}

const _c = new THREE.Color();
