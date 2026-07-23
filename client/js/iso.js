export const TILE = { w: 64, h: 32 };
const SX = TILE.w / 128; // world-unit -> iso scale factors (tuned)
const SY = TILE.h / 128;

export function worldToScreen(x, y, cam) {
  const wx = x - cam.x, wy = y - cam.y;
  const ix = (wx - wy) * SX * cam.scale;
  const iy = (wx + wy) * SY * cam.scale;
  return { sx: cam.cx + ix, sy: cam.cy + iy };
}

export function screenToWorld(sx, sy, cam) {
  const ix = (sx - cam.cx) / (SX * cam.scale);
  const iy = (sy - cam.cy) / (SY * cam.scale);
  const wx = (ix + iy) / 2;
  const wy = (iy - ix) / 2;
  return { x: wx + cam.x, y: wy + cam.y };
}
