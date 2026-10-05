import * as THREE from 'three';
import { COURT, VISUAL, accentOf } from './config.js';
import { courtTexture, crowdTexture, netTexture, boardTexture, adTexture } from './textures.js';

// 球場、籃架、觀眾席。hoops[i] = 隊伍 i 進攻的籃框（0 遠端 -Z、1 近端 +Z）

export class Court {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    const { halfW, halfL, apron } = COURT;
    const W = (halfW + apron) * 2;
    const L = (halfL + apron) * 2;

    // 地板
    this.floorMat = new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.05 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, L), this.floorMat);
    floor.rotation.x = -Math.PI / 2;
    this.group.add(floor);

    // 場外地面
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshStandardMaterial({ color: '#070b16', roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.03;
    this.group.add(ground);

    this._stands(W, L);
    this._ads(W, L);

    this.hoops = [this._hoop(-1), this._hoop(1)];
    this.applyVisual();
  }

  setTeams(home, away) {
    this.floorMat.map?.dispose();
    this.floorMat.map = courtTexture(home, away);
    this.floorMat.needsUpdate = true;
    this.adMats[0].color.set(accentOf(home));
    this.adMats[1].color.set(accentOf(away));
  }

  // 四面觀眾席（斜面 + 觀眾貼圖）
  _stands(W, L) {
    const tex = crowdTexture();
    const make = (len, x, z, rotY, repeat) => {
      const t = tex.clone();
      t.repeat.set(repeat, 2.4);
      t.needsUpdate = true;
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(len, 13),
        new THREE.MeshBasicMaterial({ map: t, color: '#b9c2d6' }),
      );
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = rotY;
      m.rotation.x = -0.72;
      m.position.set(0, 4.6, -4.2);
      g.add(m);
      this.group.add(g);
    };
    const dx = W / 2 + 2.2;
    const dz = L / 2 + 2.2;
    make(W + 30, 0, -dz, 0, 5); // 遠端
    make(L + 30, -dx, 0, Math.PI / 2, 7); // 左
    make(L + 30, dx, 0, -Math.PI / 2, 7); // 右
  }

  // 場邊廣告看板（近端不放，避免擋鏡頭）
  _ads(W, L) {
    this.adMats = [];
    const mk = (text, len, x, z, rotY, idx) => {
      const tex = adTexture(text, '#ffffff', '#0c1220');
      tex.repeat.set(len / 12, 1);
      const mat = new THREE.MeshBasicMaterial({ map: tex });
      if (idx != null) this.adMats[idx] = mat;
      const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.75, 0.12), mat);
      m.position.set(x, 0.375, z);
      m.rotation.y = rotY;
      this.group.add(m);
    };
    mk('HOOP JAM', W, 0, -L / 2 - 0.3, 0, 1);
    const side = '2 ON 2  ★  TURBO  ★  SLAM  ★  ON FIRE';
    mk(side, L, -W / 2 - 0.3, 0, Math.PI / 2, 0);
    mk(side, L, W / 2 + 0.3, 0, -Math.PI / 2);
    if (!this.adMats[0]) this.adMats[0] = new THREE.MeshBasicMaterial();
  }

  // 籃架：local +Z 指向底線
  _hoop(sign) {
    const { hoopZ, boardZ, rimH, rimR } = COURT;
    const g = new THREE.Group();
    g.position.set(0, 0, sign * hoopZ);
    g.rotation.y = sign > 0 ? 0 : Math.PI;
    this.group.add(g);
    const near = sign > 0;
    const bz = boardZ - hoopZ;

    // 籃板
    const boardMat = new THREE.MeshBasicMaterial({ map: boardTexture(), transparent: true, side: THREE.DoubleSide, depthWrite: false });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.05), boardMat);
    board.position.set(0, rimH + 0.375, bz);
    board.rotation.y = Math.PI;
    g.add(board);

    // 籃框
    const rimMat = new THREE.MeshStandardMaterial({ color: '#ff5a1f', roughness: 0.4, metalness: 0.3, emissive: '#7a1f00', emissiveIntensity: 0.5 });
    const rimPivot = new THREE.Group();
    rimPivot.position.set(0, rimH, bz - 0.06);
    g.add(rimPivot);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(rimR, 0.022, 8, 28), rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.z = -(bz - 0.06);
    rimPivot.add(rim);
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, bz - rimR), rimMat);
    bracket.position.z = -(bz - rimR) / 2 + 0.03;
    rimPivot.add(bracket);

    // 籃網
    const netTex = netTexture();
    netTex.repeat.set(3, 1);
    const netMat = new THREE.MeshBasicMaterial({ map: netTex, transparent: true, alphaTest: 0.25, side: THREE.DoubleSide });
    const net = new THREE.Mesh(new THREE.CylinderGeometry(rimR * 0.97, rimR * 0.6, 0.46, 14, 3, true), netMat);
    net.position.set(0, -0.23, -(bz - 0.06));
    rimPivot.add(net);

    // 支架（近端半透明）
    const poleMat = new THREE.MeshStandardMaterial({ color: '#2a3550', roughness: 0.6, transparent: near, opacity: 1 });
    const padMat = new THREE.MeshStandardMaterial({ color: '#c8283a', roughness: 0.8, transparent: near, opacity: 1 });
    const pz = bz + 1.35;
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.3, 0.22), poleMat);
    pole.position.set(0, 1.65, pz);
    g.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 1.5), poleMat);
    arm.position.set(0, 3.3, pz - 0.68);
    arm.rotation.x = 0.12;
    g.add(arm);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.7, 0.5), padMat);
    pad.position.set(0, 0.85, pz);
    g.add(pad);

    return { group: g, near, rimPivot, net, boardMat, poleMat, padMat, swishT: 9, rattleT: 9, rattleAmp: 0, center: new THREE.Vector3(0, rimH, sign * hoopZ) };
  }

  applyVisual() {
    for (const h of this.hoops) {
      const o = h.near ? VISUAL.nearHoopOpacity : 1;
      h.poleMat.opacity = o;
      h.padMat.opacity = o;
      h.boardMat.opacity = h.near ? Math.min(1, o + 0.45) : 1;
    }
  }

  // 進球：籃網甩動
  swish(i) {
    this.hoops[i].swishT = 0;
  }

  // 打鐵 / 灌籃：籃框震動
  rattle(i, amp = 1) {
    const h = this.hoops[i];
    h.rattleT = 0;
    h.rattleAmp = amp;
  }

  update(dt) {
    for (const h of this.hoops) {
      h.swishT += dt;
      h.rattleT += dt;
      const s = Math.exp(-h.swishT * 4.5) * Math.sin(h.swishT * 22);
      h.net.scale.set(1 - s * 0.22, 1 + s * 0.4, 1 - s * 0.22);
      h.net.position.y = -0.23 * (1 + s * 0.4);
      const r = Math.exp(-h.rattleT * 6) * Math.sin(h.rattleT * 38) * h.rattleAmp;
      h.rimPivot.rotation.x = r * 0.16;
    }
  }
}
