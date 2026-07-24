// client/js/three/audio.js
// All sound is synthesized with the Web Audio API — no asset files. Weapon SFX
// (cannon boom, arrow whoosh, molotov whoosh, explosion) plus a low, looping
// battle ambience. Music volume is adjustable from the on-screen control.
class GameAudio {
  constructor() {
    this.ctx = null; this.master = null; this.sfx = null;
    this.musicEl = null; this.muted = false; this.musicVol = 0.6; this._musicOn = false;
    this._lastSfx = 0;
  }

  // must be called from a user gesture (the join click)
  init() {
    if (this.ctx) { this.ctx.resume && this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    this.ctx = new C();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(this.ctx.destination);
    this.sfx = this.ctx.createGain(); this.sfx.gain.value = 0.85; this.sfx.connect(this.master);
  }

  setMusicVolume(v) { this.musicVol = v; if (this.musicEl) this.musicEl.volume = this.muted ? 0 : v; }
  setMuted(b) {
    this.muted = b;
    if (this.master) this.master.gain.setTargetAtTime(b ? 0 : 0.9, this.ctx.currentTime, 0.05); // SFX
    if (this.musicEl) this.musicEl.volume = b ? 0 : this.musicVol;
  }

  _noise(dur) {
    const ctx = this.ctx, n = Math.max(1, Math.floor(dur * ctx.sampleRate));
    const buf = ctx.createBuffer(1, n, ctx.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(); s.buffer = buf; return s;
  }
  _hit(peak, atk, dec, t) { const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + atk); g.gain.exponentialRampToValueAtTime(0.0001, t + atk + dec); g.connect(this.sfx); return g; }
  // throttle so a volley of arrows doesn't machine-gun the mix
  _ok() { const now = performance.now(); if (now - this._lastSfx < 22) return false; this._lastSfx = now; return true; }

  cannonFire() {
    if (!this.ctx || !this._ok()) return; const t = this.ctx.currentTime;
    const g = this._hit(0.9, 0.005, 0.34, t);
    const o = this.ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(170 + Math.random() * 30, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.3);
    o.connect(g); o.start(t); o.stop(t + 0.4);
    const ng = this._hit(0.55, 0.002, 0.16, t); const nb = this._noise(0.22);
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100;
    nb.connect(lp); lp.connect(ng); nb.start(t);
  }
  arrowFire() {
    if (!this.ctx || !this._ok()) return; const t = this.ctx.currentTime;
    const g = this._hit(0.32, 0.004, 0.14, t); const nb = this._noise(0.16);
    const hp = this.ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.setValueAtTime(1800, t); hp.frequency.exponentialRampToValueAtTime(3600, t + 0.12); hp.Q.value = 1.2;
    nb.connect(hp); hp.connect(g); nb.start(t);
  }
  molotovThrow() {
    if (!this.ctx || !this._ok()) return; const t = this.ctx.currentTime;
    const g = this._hit(0.3, 0.02, 0.3, t); const nb = this._noise(0.35);
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(500, t); bp.frequency.linearRampToValueAtTime(1400, t + 0.3); bp.Q.value = 0.8;
    nb.connect(bp); bp.connect(g); nb.start(t);
  }
  impact(kind) {
    if (!this.ctx || !this._ok()) return; const t = this.ctx.currentTime;
    if (kind === 'arrow') { const g = this._hit(0.3, 0.001, 0.07, t); const nb = this._noise(0.06); const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500; nb.connect(hp); hp.connect(g); nb.start(t); return; }
    if (kind === 'molotov') { const g = this._hit(0.5, 0.01, 0.5, t); const nb = this._noise(0.55); const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1600; nb.connect(lp); lp.connect(g); nb.start(t); return; }
    this._boom(t, 0.8, 0.4, 150); // cannon impact
  }
  explosion() {
    if (!this.ctx) return; const t = this.ctx.currentTime; this._boom(t, 1.0, 0.7, 120);
    const g = this._hit(0.7, 0.01, 0.6, t); const nb = this._noise(0.7);
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(2200, t); lp.frequency.exponentialRampToValueAtTime(300, t + 0.6);
    nb.connect(lp); lp.connect(g); nb.start(t);
  }
  _boom(t, peak, dec, f0) {
    const g = this._hit(peak, 0.005, dec, t);
    const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(38, t + dec);
    o.connect(g); o.start(t); o.stop(t + dec + 0.1);
  }

  // background music from the provided mp3 (looped)
  startMusic() {
    if (this._musicOn) return; this._musicOn = true;
    const el = new Audio('/mp3/background-theme.mp3');
    el.loop = true; el.volume = this.muted ? 0 : this.musicVol;
    el.play().catch(() => { /* autoplay may need a further gesture; ignore */ });
    this.musicEl = el;
  }
  stopMusic() { this._musicOn = false; if (this.musicEl) { this.musicEl.pause(); } }
}

export const audio = new GameAudio();
