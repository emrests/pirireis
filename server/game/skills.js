// server/game/skills.js
import { BUFF_MS } from './balance.js';

export function addBuff(ship, type, now) {
  const until = now + (BUFF_MS[type] || 8000);
  const existing = ship.buffs.find((b) => b.type === type);
  if (existing) existing.until = until;
  else ship.buffs.push({ type, until });
}

export function expireBuffs(ship, now) {
  ship.buffs = ship.buffs.filter((b) => b.until > now);
}

export function cooldownFactor(ship) {
  return ship.hasBuff('fastreload') ? 0.6 : 1;
}

export function onKill(killer, killsThisShot, now) {
  killer.streak += 1;
  const granted = [];
  const grant = (t) => { addBuff(killer, t, now); granted.push(t); };
  if (killer.streak === 3) grant('fastreload');
  if (killer.streak === 5) grant('broadside');
  if (killer.streak === 7) grant('fullsails');
  if (killer.streak === 10) grant('inferno');
  if (killsThisShot >= 3) grant('shockwave');
  else if (killsThisShot >= 2) grant('chainshot');
  return granted;
}

export function onArcherKill(killer, now) {
  killer.archerKills += 1;
  const granted = [];
  if (killer.archerKills > 0 && killer.archerKills % 3 === 0) {
    addBuff(killer, 'marksman', now);
    granted.push('marksman');
  }
  return granted;
}

export function resetStreak(ship) {
  ship.streak = 0;
  ship.archerKills = 0;
}
