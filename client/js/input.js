// client/js/input.js
// Controls: Q/W/E select the weapon (cannon/rifle/molotov) — they do NOT fire.
// R = sail home to heal. LEFT click (or hold) fires the selected weapon toward
// the cursor, limited to that weapon's range. RIGHT click sets the move
// destination (a marker only this player sees).
const SHIP_RANGE = {
  sloop:520, brig:620, frigate:680, galleon:820, fireship:520,
  cutter:520, corvette:700, frigate_n:700, shipofline:860, bombketch:1100,
};
const RIFLE_RANGE = 660, MOLOTOV_RANGE = 600, FIRE_INTERVAL = 140;

export class Input {
  constructor(canvas, net, getState, getMeId, screenToWorld, renderer) {
    this.net = net; this.getState = getState; this.getMeId = getMeId;
    this.s2w = screenToWorld; this.renderer = renderer;
    this.mouse = { x: 0, y: 0 };
    this.weapon = 'cannon';
    this.firing = false;
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mousemove', (e) => { this.mouse = { x: e.clientX, y: e.clientY }; });
    canvas.addEventListener('mousedown', (e) => this._down(e));
    canvas.addEventListener('mouseup', (e) => this._up(e));
    window.addEventListener('mouseup', (e) => this._up(e));
    window.addEventListener('keydown', (e) => this._key(e));
    this.renderer.setWeapon(this.weapon);
    this._loop();
  }
  _me() { return (this.getState()?.ships || []).find((s) => s.id === this.getMeId()); }

  _down(e) {
    if (e.button === 0) { this.firing = true; this._fire(); }
    else if (e.button === 2) {
      const w = this.s2w(e.clientX, e.clientY);
      this.net.send({ type: 'move', x: w.x, y: w.y });
      this.renderer.setMoveMarker(w);
    }
  }
  _up(e) { if (e.button === 0) this.firing = false; }
  _loop() { if (this.firing) this._fire(); setTimeout(() => this._loop(), FIRE_INTERVAL); }

  _fire() {
    const me = this._me(); if (!me) return;
    const w = this.s2w(this.mouse.x, this.mouse.y);
    const dx = w.x - me.x, dy = w.y - me.y, d = Math.hypot(dx, dy) || 1;
    if (this.weapon === 'cannon') {
      const r = SHIP_RANGE[me.cls] || 700;
      const power = Math.max(0.12, Math.min(1, d / r));
      this.net.send({ type: 'fire', weapon: 'cannon', dir: { x: dx, y: dy }, power });
      this.renderer.markAbility('cannon');
    } else if (this.weapon === 'rifle') {
      this.net.send({ type: 'fire', weapon: 'archer', dir: { x: dx, y: dy } });
      this.renderer.markAbility('rifle');
    } else if (this.weapon === 'molotov') {
      const max = MOLOTOV_RANGE;
      const ax = d > max ? me.x + dx / d * max : w.x;
      const ay = d > max ? me.y + dy / d * max : w.y;
      this.net.send({ type: 'fire', weapon: 'molotov', aim: { x: ax, y: ay } });
      this.renderer.markAbility('molotov');
    }
  }

  _key(e) {
    const k = e.key.toLowerCase();
    if (k === 'q') { this.weapon = 'cannon'; this.renderer.setWeapon('cannon'); }
    else if (k === 'w') { this.weapon = 'rifle'; this.renderer.setWeapon('rifle'); }
    else if (k === 'e') { this.weapon = 'molotov'; this.renderer.setWeapon('molotov'); }
    else if (k === 'r') {
      // spend a full heal charge (fills as you deal damage) for +20 HP
      this.net.send({ type: 'heal' });
    }
  }

  weaponRange(cls) {
    if (this.weapon === 'rifle') return RIFLE_RANGE;
    if (this.weapon === 'molotov') return MOLOTOV_RANGE;
    return SHIP_RANGE[cls] || 700;
  }
}
