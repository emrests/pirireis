// client/js/input.js
// Controls: LEFT click = move. RIGHT click = set the aim target (a marker on the
// water). Q/W/E/R fire toward that target: Q cannon, W rifle, E molotov,
// R = sail home to heal. World coords come from the renderer's raycast so aim
// matches the 3D camera.
const SHIP_RANGE = {
  sloop:520, brig:620, frigate:680, galleon:820, fireship:520,
  cutter:520, corvette:700, frigate_n:700, shipofline:860, bombketch:1100,
};

export class Input {
  constructor(canvas, net, getState, getMeId, screenToWorld, onUse, onTarget) {
    this.canvas = canvas; this.net = net;
    this.getState = getState; this.getMeId = getMeId;
    this.s2w = screenToWorld;
    this.onUse = onUse || (() => {});
    this.onTarget = onTarget || (() => {});
    this.mouse = { x: 0, y: 0 };
    this.target = null; // world {x,y}
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mousemove', (e) => { this.mouse = { x: e.clientX, y: e.clientY }; });
    canvas.addEventListener('mousedown', (e) => this._down(e));
    window.addEventListener('keydown', (e) => this._key(e));
  }
  _me() { return (this.getState()?.ships || []).find((s) => s.id === this.getMeId()); }
  _aim() { return this.target || this.s2w(this.mouse.x, this.mouse.y); }

  _down(e) {
    if (e.button === 0) {
      const w = this.s2w(e.clientX, e.clientY);
      this.net.send({ type: 'move', x: w.x, y: w.y });
    } else if (e.button === 2) {
      this.target = this.s2w(e.clientX, e.clientY);
      this.onTarget(this.target);
    }
  }

  _key(e) {
    const me = this._me(); if (!me) return;
    const k = e.key.toLowerCase();
    if (k === 'r') { // heal: sail to own base
      const base = (this.getState()?.bases || []).find((b) => b.faction === me.faction);
      if (base) { this.net.send({ type: 'move', x: base.x, y: base.y }); this.onUse('heal'); }
      return;
    }
    const tp = this._aim();
    const dir = { x: tp.x - me.x, y: tp.y - me.y };
    if (k === 'q') { // cannon toward target; power set so it reaches the target
      const range = SHIP_RANGE[me.cls] || 700;
      const power = Math.max(0.12, Math.min(1, Math.hypot(dir.x, dir.y) / range));
      this.net.send({ type: 'fire', weapon: 'cannon', dir, power });
      this.onUse('cannon');
    } else if (k === 'w') { // rifle burst
      this.net.send({ type: 'fire', weapon: 'archer', dir });
      this.onUse('rifle');
    } else if (k === 'e') { // molotov at target
      this.net.send({ type: 'fire', weapon: 'molotov', aim: { x: tp.x, y: tp.y } });
      this.onUse('molotov');
    }
  }
}
