// client/js/interpolate.js
export class SnapshotBuffer {
  constructor() { this.snaps = []; }
  push(snap) { this.snaps.push(snap); if (this.snaps.length > 20) this.snaps.shift(); }
  sample(renderTime) {
    const s = this.snaps;
    if (s.length === 0) return null;
    if (s.length === 1) return s[0];
    let a = s[0], b = s[s.length - 1];
    for (let i = 0; i < s.length - 1; i++) {
      if (s[i].t <= renderTime && s[i + 1].t >= renderTime) { a = s[i]; b = s[i + 1]; break; }
    }
    const span = b.t - a.t || 1;
    const f = Math.max(0, Math.min(1, (renderTime - a.t) / span));
    const byId = (arr) => { const m = new Map(); for (const o of arr) m.set(o.id, o); return m; };
    const bs = byId(b.ships);
    const ships = a.ships.map((sa) => {
      const sb = bs.get(sa.id) || sa;
      return { ...sb, x: sa.x + (sb.x - sa.x) * f, y: sa.y + (sb.y - sa.y) * f };
    });
    let kraken = b.kraken;
    if (a.kraken && b.kraken) kraken = { ...b.kraken, x: a.kraken.x + (b.kraken.x - a.kraken.x) * f, y: a.kraken.y + (b.kraken.y - a.kraken.y) * f };
    return { ships, projectiles: b.projectiles, fires: b.fires, bases: b.bases, score: b.score, kraken, over: b.over, winner: b.winner };
  }
}
