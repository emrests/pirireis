// client/js/input.js
// Translates mouse/keyboard into intent messages. World coordinates come from
// the renderer's raycast (screenToWorld) so input matches the 3D camera.
export class Input {
  constructor(canvas, net, getState, getMeId, screenToWorld) {
    this.canvas = canvas; this.net = net;
    this.getState = getState; this.getMeId = getMeId;
    this.s2w = screenToWorld;
    this.mouse = { x: 0, y: 0 };
    this.aiming = false; this.aimStart = null;
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mousemove', (e) => { this.mouse = { x: e.clientX, y: e.clientY }; });
    canvas.addEventListener('mousedown', (e) => this._down(e));
    canvas.addEventListener('mouseup', (e) => this._up(e));
    window.addEventListener('keydown', (e) => this._key(e));
  }
  _me() { return (this.getState()?.ships || []).find((s) => s.id === this.getMeId()); }
  _down(e) {
    if (e.button === 0) {
      const w = this.s2w(e.clientX, e.clientY);
      this.net.send({ type: 'move', x: w.x, y: w.y });
    } else if (e.button === 2) { this.aiming = true; this.aimStart = { x: e.clientX, y: e.clientY }; }
  }
  _up(e) {
    if (e.button === 2 && this.aiming) {
      this.aiming = false;
      const me = this._me(); if (!me) return;
      const w = this.s2w(e.clientX, e.clientY);
      const dir = { x: w.x - me.x, y: w.y - me.y };
      const dragLen = Math.hypot(e.clientX - this.aimStart.x, e.clientY - this.aimStart.y);
      const power = Math.max(0.1, Math.min(1, dragLen / 300));
      this.net.send({ type: 'fire', weapon: 'cannon', dir, power });
    }
  }
  _key(e) {
    const me = this._me(); if (!me) return;
    const w = this.s2w(this.mouse.x, this.mouse.y);
    const k = e.key.toLowerCase();
    if (k === 'a') this.net.send({ type:'fire', weapon:'archer', dir:{ x:w.x-me.x, y:w.y-me.y } });
    if (k === 'm') this.net.send({ type:'fire', weapon:'molotov', aim:{ x:w.x, y:w.y } });
    if (k === 'd') {
      const mates = (this.getState()?.ships || []).filter((s) => s.faction === me.faction && s.id !== me.id).filter((s) => s.alive);
      if (mates.length) {
        mates.sort((p, q) => Math.hypot(p.x-me.x,p.y-me.y) - Math.hypot(q.x-me.x,q.y-me.y));
        this.net.send({ type:'donate', targetPlayerId: mates[0].id });
      }
    }
  }
}
