import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { TUNING, VISUAL } from './config.js';
import { numberTexture } from './textures.js';
import { POSE_KEYS } from './poses.js';

// GLB 骨架球員（Quaternius CC0 模型）
// - 依骨骼權重把連帽衫 / 長褲重新上色成無袖球衣 + 短褲
// - 基礎動畫（Idle / Run / 側跑 / Death）之上，用「骨骼瞄準」疊加手臂動作（運球、投籃、灌籃…）

const BASE = import.meta.env.BASE_URL + 'models/';

// 姿勢鍵 → 骨頭名稱（GLTFLoader 會把名稱中的 "." 去掉）
const ARM_BONES = { uaL: 'UpperArmL', faL: 'LowerArmL', hL: 'WristL', uaR: 'UpperArmR', faR: 'LowerArmR', hR: 'WristR' };

const _m = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _cur = new THREE.Vector3();
const _rigQ = new THREE.Quaternion();
const _pq = new THREE.Quaternion();
const _wq = new THREE.Quaternion();
const _dq = new THREE.Quaternion();
const _lq = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

export async function loadModels() {
  const gltf = await new GLTFLoader().loadAsync(BASE + 'baller.glb');
  const scene = gltf.scene;
  const clips = {};
  for (const c of gltf.animations) {
    // 去除縮放軌道（大頭比例由程式控制）
    c.tracks = c.tracks.filter((t) => !t.name.endsWith('.scale'));
    clips[c.name.split('|').pop()] = c;
  }

  // 把骨架擺回綁定姿勢（檔案內的靜止姿勢是某一格動畫，不是站姿）
  scene.updateMatrixWorld(true);
  // 骨頭綁定時的世界矩陣 = 網格節點矩陣 × inverseBindMatrix⁻¹
  let skinned = null;
  scene.traverse((o) => { if (o.isSkinnedMesh && !skinned) skinned = o; });
  const skeleton = skinned.skeleton;
  skeleton.bones.forEach((bone, i) => {
    bone.matrixWorld.copy(skeleton.boneInverses[i]).invert().premultiply(skinned.matrixWorld);
    bone.matrix.copy(bone.parent.matrixWorld).invert().multiply(bone.matrixWorld);
    bone.matrix.decompose(bone.position, bone.quaternion, bone.scale);
  });
  scene.updateMatrixWorld(true);

  // 量測原始身高與腳底
  const box = new THREE.Box3().setFromObject(scene, true);
  const chest = scene.getObjectByName('Chest');
  const chestBindInv = chest.matrixWorld.clone().invert();

  // 預先計算「哪些頂點改上膚色」：手臂 → 無袖、小腿 → 短褲
  scene.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const tag = partTag(o);
    if (tag !== 'jersey' && tag !== 'shorts') return;
    const re = tag === 'jersey' ? /^(UpperArm|LowerArm|Wrist)/ : /^LowerLeg/;
    const geo = o.geometry;
    const si = geo.attributes.skinIndex;
    const sw = geo.attributes.skinWeight;
    const mask = new Uint8Array(si.count);
    for (let i = 0; i < si.count; i++) {
      let best = 0;
      let bw = -1;
      for (let k = 0; k < 4; k++) {
        const w = sw.getComponent(i, k);
        if (w > bw) { bw = w; best = si.getComponent(i, k); }
      }
      mask[i] = re.test(o.skeleton.bones[best].name) ? 1 : 0;
    }
    geo.userData.skinMask = mask;
  });

  return { scene, clips, height: box.max.y - box.min.y, minY: box.min.y, chestBindInv };
}

// 依材質名稱與所屬網格判斷部位
function partTag(mesh) {
  const where = mesh.name + ' ' + (mesh.parent?.name || '');
  const mat = mesh.material.name;
  if (mat === 'Purple') return /Feet/i.test(where) ? 'trim' : 'jersey';
  if (mat === 'LightBlue') return 'shorts';
  if (mat === 'White') return 'shoe';
  if (mat === 'Skin') return 'skin';
  if (mat === 'Hair') return 'hair';
  if (mat === 'Eyebrows') return 'brow';
  if (mat === 'Eye') return 'eye';
  return 'other';
}

export class Baller {
  // look: { jersey, shorts, trim, skin, hair, num, h }
  constructor(models, look) {
    this.root = new THREE.Group(); // 位置 = 腳底、rotation.y = 面向
    this.rig = new THREE.Group(); // 身體中心樞紐（前傾 / 空翻）
    this.root.add(this.rig);
    this.look = look;

    const model = cloneSkinned(models.scene);
    this.model = model;
    this.scale = (TUNING.playerHeight * (look.h || 1)) / models.height;
    this.height = TUNING.playerHeight * (look.h || 1);
    model.scale.setScalar(this.scale);
    this.center = this.height * 0.52;
    this.rig.position.y = this.center;
    model.position.y = -models.minY * this.scale - this.center;
    this.rig.add(model);

    this.bones = {};
    model.traverse((o) => { if (o.isBone) this.bones[o.name] = o; });

    this._paint(model, look);
    this._numbers(models, look);
    this.setHeadScale(TUNING.headScale);

    // 動畫
    this.mixer = new THREE.AnimationMixer(model);
    this.actions = {};
    for (const [k, c] of Object.entries(models.clips)) this.actions[k] = this.mixer.clipAction(c);
    for (const k of ['Death', 'HitRecieve', 'Roll', 'Punch_Right']) {
      const a = this.actions[k];
      if (a) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
    }
    this.base = null;
    this.setBase('Idle');

    // 手臂覆寫狀態
    this.arm = POSE_KEYS.map((key) => {
      const bone = this.bones[ARM_BONES[key]];
      return { key, bone, anim: bone.quaternion.clone(), dir: new THREE.Vector3(0, -1, 0), w: 0 };
    });
    this._pose = null;
    this._sharp = 14;
    this.mixer.update(0);
    for (const b of this.arm) b.anim.copy(b.bone.quaternion);
  }

  // 重新上色：連帽衫 → 無袖球衣、長褲 → 短褲
  _paint(model, look) {
    this.mats = [];
    const cSkin = new THREE.Color(look.skin);
    model.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      o.frustumCulled = false;
      const tag = partTag(o);
      const mat = o.material.clone();
      mat.roughness = 0.7;
      mat.metalness = 0;
      if (tag === 'jersey' || tag === 'shorts') {
        const cloth = new THREE.Color(tag === 'jersey' ? look.jersey : look.shorts);
        const mask = o.geometry.userData.skinMask;
        const geo = o.geometry.clone();
        const col = new Float32Array(mask.length * 3);
        for (let i = 0; i < mask.length; i++) {
          const c = mask[i] ? cSkin : cloth;
          col[i * 3] = c.r;
          col[i * 3 + 1] = c.g;
          col[i * 3 + 2] = c.b;
        }
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        o.geometry = geo;
        mat.vertexColors = true;
        mat.color.set('#ffffff');
      } else if (tag === 'skin') mat.color.copy(cSkin);
      else if (tag === 'hair') mat.color.set(look.hair);
      else if (tag === 'brow') mat.color.set(look.hair).multiplyScalar(0.6);
      else if (tag === 'eye') mat.color.set('#120c08');
      else if (tag === 'shoe') mat.color.set('#f4f4f4');
      else if (tag === 'trim') mat.color.set(look.trim);
      o.material = mat;
      this.mats.push(mat);
    });
  }

  // 球衣號碼：掛在 Chest 骨頭上，前後各一
  _numbers(models, look) {
    const tex = numberTexture(look.num, look.trim, '#0c1220');
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    const geo = new THREE.PlaneGeometry(1, 1);
    this.numBack = new THREE.Mesh(geo, mat);
    this.numFront = new THREE.Mesh(geo, mat);
    for (const p of [this.numBack, this.numFront]) {
      p.matrixAutoUpdate = false;
      p.frustumCulled = false;
      this.bones.Chest.add(p);
    }
    this._chestBindInv = models.chestBindInv;
    this._minY = models.minY;
    this.applyNumbers();
  }

  // 依 VISUAL 設定重新擺放號碼（DEV 工具即時調整）
  applyNumbers() {
    const s = this.scale;
    const k = this.height / TUNING.playerHeight;
    const place = (plane, y, z, back) => {
      _m.compose(
        _v.set(0, (y * k) / s + this._minY, (z * k) / s),
        _lq.setFromAxisAngle(UP, back ? Math.PI : 0),
        _dir.setScalar((VISUAL.numSize * k) / s),
      );
      plane.matrix.copy(this._chestBindInv).multiply(_m);
    };
    place(this.numBack, VISUAL.numBackY, VISUAL.numBackZ, true);
    place(this.numFront, VISUAL.numFrontY, VISUAL.numFrontZ, false);
  }

  setHeadScale(s) {
    this.bones.Head.scale.setScalar(s);
  }

  // 著火時讓材質發光
  setGlow(v) {
    for (const m of this.mats) {
      m.emissive.setRGB(1, 0.35, 0.05);
      m.emissiveIntensity = v;
    }
  }

  // 切換基礎動畫（全身）
  setBase(name, ts = 1, fade = 0.15, at = null) {
    const a = this.actions[name];
    if (!a) return;
    if (this.base !== name) {
      const prev = this.actions[this.base];
      a.reset().setEffectiveWeight(1).fadeIn(fade).play();
      if (at != null) a.time = at;
      if (prev) prev.fadeOut(fade);
      this.base = name;
    }
    a.timeScale = ts;
  }

  // 設定本幀的手臂目標姿勢（null = 不覆寫）
  pose(dict, sharp = 14) {
    this._pose = dict;
    this._sharp = sharp;
  }

  update(dt) {
    // 混合器只在數值變動時才寫回骨頭，所以先還原成上一幀的動畫值，再疊加覆寫
    for (const b of this.arm) b.bone.quaternion.copy(b.anim);
    this.mixer.update(dt);
    for (const b of this.arm) b.anim.copy(b.bone.quaternion);

    const a = 1 - Math.exp(-this._sharp * dt);
    this.rig.getWorldQuaternion(_rigQ);
    for (const b of this.arm) {
      const tgt = this._pose ? this._pose[b.key] : null;
      if (tgt) {
        if (b.w < 0.02) b.dir.copy(tgt);
        else b.dir.lerp(tgt, a).normalize();
      }
      b.w += ((tgt ? 1 : 0) - b.w) * a;
      if (b.w < 0.01) continue;
      // 讓骨頭的 +Y（骨頭延伸方向）指向目標方向
      _dir.copy(b.dir).applyQuaternion(_rigQ);
      b.bone.parent.getWorldQuaternion(_pq);
      _wq.copy(_pq).multiply(b.bone.quaternion);
      _cur.set(0, 1, 0).applyQuaternion(_wq);
      _dq.setFromUnitVectors(_cur, _dir);
      _wq.premultiply(_dq);
      _lq.copy(_pq).invert().multiply(_wq);
      b.bone.quaternion.slerp(_lq, b.w);
    }
  }

  // 手掌世界座標（side: 'L' | 'R'）
  hand(side, out) {
    const bone = this.bones[side === 'L' ? 'WristL' : 'WristR'];
    bone.updateWorldMatrix(true, false);
    out.setFromMatrixPosition(bone.matrixWorld);
    _v.set(0, 1, 0).transformDirection(bone.matrixWorld);
    return out.addScaledVector(_v, 0.1);
  }

  dispose() {
    this.mixer.stopAllAction();
    this.root.removeFromParent();
    for (const m of this.mats) m.dispose();
  }
}
