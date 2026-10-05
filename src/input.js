// 輸入：鍵盤（PC）＋ 虛擬搖桿與按鍵（觸控）
// 輸出統一為：mx / mz（-1..1，畫面右 = +X、畫面下 = +Z）、a / b / turbo 持續狀態與 aDown / aUp / bDown / swDown 邊緣

const KEY_MAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  KeyJ: 'a', KeyZ: 'a',
  KeyK: 'b', KeyX: 'b',
  KeyL: 'turbo', KeyC: 'turbo', ShiftLeft: 'turbo', ShiftRight: 'turbo',
  Space: 'sw', KeyQ: 'sw',
  Escape: 'pause', KeyP: 'pause',
  Enter: 'confirm',
};

export class Input {
  constructor(onCommand) {
    this.onCommand = onCommand; // 'pause' | 'confirm'
    this.keys = {};
    this.touch = { mx: 0, mz: 0, a: false, b: false, turbo: false };
    this.usedTouch = false;
    this.mx = 0;
    this.mz = 0;
    this.a = false;
    this.b = false;
    this.turbo = false;
    this.aDown = false;
    this.aUp = false;
    this.bDown = false;
    this.swDown = false;
    this._prevA = false;
    this._prevB = false;
    this._sw = false;

    window.addEventListener('keydown', (e) => {
      if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      const k = KEY_MAP[e.code];
      if (!k) return;
      e.preventDefault();
      if (e.repeat) return;
      if (k === 'pause' || k === 'confirm') { this.onCommand(k); return; }
      if (k === 'sw') { this._sw = true; return; }
      this.keys[k] = true;
    });
    window.addEventListener('keyup', (e) => {
      const k = KEY_MAP[e.code];
      if (k) this.keys[k] = false;
    });
    window.addEventListener('blur', () => { this.keys = {}; this._resetTouch(); });

    this._bindStick(document.getElementById('stick'), document.getElementById('stickKnob'));
    this._bindButton(document.getElementById('btnA'), 'a');
    this._bindButton(document.getElementById('btnB'), 'b');
    this._bindButton(document.getElementById('btnC'), 'turbo');
    const sw = document.getElementById('btnSw');
    sw.addEventListener('pointerdown', (e) => {
      if (document.body.classList.contains('dev')) return;
      e.preventDefault();
      this._sw = true;
      this._touched(e);
    });
  }

  _touched(e) {
    if (e.pointerType === 'touch' && !this.usedTouch) {
      this.usedTouch = true;
      document.body.classList.add('touch');
    }
  }

  _resetTouch() {
    const t = this.touch;
    t.mx = t.mz = 0;
    t.a = t.b = t.turbo = false;
    this.knob?.style.setProperty('transform', 'translate(-50%, -50%)');
    for (const id of ['btnA', 'btnB', 'btnC']) document.getElementById(id)?.classList.remove('down');
  }

  // 虛擬搖桿：按住底座任意處拖曳
  _bindStick(base, knob) {
    this.knob = knob;
    let id = null;
    const move = (e) => {
      const r = base.getBoundingClientRect();
      const R = r.width / 2;
      let dx = (e.clientX - (r.left + R)) / R;
      let dy = (e.clientY - (r.top + R)) / R;
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      // 死區
      const dead = 0.16;
      const l2 = Math.hypot(dx, dy);
      const k = l2 < dead ? 0 : Math.min(1, (l2 - dead) / (0.8 - dead)) / l2;
      this.touch.mx = dx * k;
      this.touch.mz = dy * k;
      knob.style.transform = `translate(calc(-50% + ${dx * R * 0.62}px), calc(-50% + ${dy * R * 0.62}px))`;
    };
    base.addEventListener('pointerdown', (e) => {
      if (document.body.classList.contains('dev')) return;
      e.preventDefault();
      id = e.pointerId;
      base.setPointerCapture(id);
      this._touched(e);
      move(e);
    });
    base.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      this.touch.mx = this.touch.mz = 0;
      knob.style.transform = 'translate(-50%, -50%)';
    };
    base.addEventListener('pointerup', end);
    base.addEventListener('pointercancel', end);
  }

  _bindButton(el, key) {
    let id = null;
    el.addEventListener('pointerdown', (e) => {
      if (document.body.classList.contains('dev')) return;
      e.preventDefault();
      id = e.pointerId;
      el.setPointerCapture(id);
      this.touch[key] = true;
      el.classList.add('down');
      this._touched(e);
    });
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      this.touch[key] = false;
      el.classList.remove('down');
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // 每幀開頭呼叫：整合鍵盤與觸控並計算邊緣
  poll() {
    const k = this.keys;
    const t = this.touch;
    let mx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    let mz = (k.down ? 1 : 0) - (k.up ? 1 : 0);
    if (mx && mz) { mx *= 0.7071; mz *= 0.7071; }
    if (t.mx || t.mz) { mx = t.mx; mz = t.mz; }
    this.mx = mx;
    this.mz = mz;
    this.a = !!k.a || t.a;
    this.b = !!k.b || t.b;
    this.turbo = !!k.turbo || t.turbo;
    this.aDown = this.a && !this._prevA;
    this.aUp = !this.a && this._prevA;
    this.bDown = this.b && !this._prevB;
    this.swDown = this._sw;
    this._sw = false;
    this._prevA = this.a;
    this._prevB = this.b;
  }
}
