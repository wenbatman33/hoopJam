// 音效：全部用 WebAudio 即時合成，不需要音檔

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    try { this.enabled = localStorage.getItem('hoopjam_sound') !== '0'; } catch (e) { /* 忽略 */ }
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.8 : 0;
      this.master.connect(this.ctx.destination);
      // 白噪音緩衝
      const len = this.ctx.sampleRate * 2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this._crowdStart();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setEnabled(on) {
    this.enabled = on;
    try { localStorage.setItem('hoopjam_sound', on ? '1' : '0'); } catch (e) { /* 忽略 */ }
    if (this.master) this.master.gain.value = on ? 0.8 : 0;
  }

  get t() { return this.ctx.currentTime; }

  _tone(type, f0, f1, dur, vol, delay = 0) {
    if (!this.ctx) return;
    const t = this.t + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  _noise(dur, vol, type, f0, f1, q = 1, delay = 0) {
    if (!this.ctx) return;
    const t = this.t + delay;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random());
    s.stop(t + dur + 0.02);
  }

  // 觀眾底噪（持續）+ 歡呼時加大
  _crowdStart() {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 900;
    f.Q.value = 0.5;
    this.crowdGain = this.ctx.createGain();
    this.crowdGain.gain.value = 0.02;
    s.connect(f).connect(this.crowdGain).connect(this.master);
    s.start();
  }

  cheer(amount = 1) {
    if (!this.ctx) return;
    const g = this.crowdGain.gain;
    const t = this.t;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0.05 + 0.16 * amount, t + 0.12);
    g.exponentialRampToValueAtTime(0.02, t + 1.4 + amount);
  }

  bounce(vol = 1) {
    this._tone('sine', 150, 70, 0.09, 0.32 * vol);
    this._noise(0.04, 0.08 * vol, 'lowpass', 900, 300);
  }

  swish() {
    this._noise(0.32, 0.3, 'bandpass', 5200, 1400, 1.2);
  }

  clank() {
    this._tone('triangle', 520, 480, 0.3, 0.2);
    this._tone('square', 1310, 1280, 0.16, 0.06);
    this._tone('sine', 216, 200, 0.24, 0.2);
  }

  dunk() {
    this._tone('sine', 120, 38, 0.5, 0.75);
    this._noise(0.28, 0.4, 'lowpass', 2400, 200);
    this._tone('triangle', 480, 420, 0.5, 0.16, 0.03);
    this._tone('square', 960, 900, 0.3, 0.05, 0.03);
  }

  slap() {
    this._noise(0.07, 0.4, 'highpass', 1800, 2600);
  }

  thud() {
    this._tone('sine', 110, 45, 0.2, 0.55);
    this._noise(0.1, 0.22, 'lowpass', 700, 200);
  }

  block() {
    this._noise(0.09, 0.5, 'bandpass', 1300, 600, 0.8);
    this._tone('sine', 190, 80, 0.16, 0.4);
  }

  pass() {
    this._noise(0.1, 0.12, 'bandpass', 2400, 900, 1.5);
  }

  whistle() {
    this._tone('square', 2150, 2150, 0.32, 0.1);
    this._tone('square', 2230, 2230, 0.32, 0.08);
  }

  buzzer() {
    this._tone('sawtooth', 196, 196, 1.0, 0.22);
    this._tone('square', 147, 147, 1.0, 0.14);
  }

  beep(high = false) {
    this._tone('square', high ? 1320 : 880, high ? 1320 : 880, high ? 0.3 : 0.12, 0.1);
  }

  perfect() {
    this._tone('sine', 1320, 1320, 0.1, 0.16);
    this._tone('sine', 1980, 1980, 0.16, 0.14, 0.07);
  }

  fire() {
    this._noise(0.7, 0.34, 'bandpass', 500, 3000, 0.7);
    this._tone('sawtooth', 220, 880, 0.5, 0.1);
  }

  cutin() {
    this._noise(0.35, 0.3, 'bandpass', 400, 4200, 0.9);
    this._tone('sawtooth', 110, 440, 0.25, 0.12);
  }

  click() {
    this._tone('square', 660, 880, 0.06, 0.08);
  }

  fanfare() {
    [523, 659, 784, 1047].forEach((f, i) => this._tone('square', f, f, 0.22, 0.1, i * 0.13));
  }
}
