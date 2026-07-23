# Naval Battle Game — Design Spec

**Date:** 2026-07-23
**Status:** Approved design, ready for implementation planning

## 1. Overview

A LAN-playable, real-time multiplayer naval battle game in the browser. Two factions —
**Pirates (Korsan)** and **Navy (Donanma)** — fight ship battles from a full isometric
(Age-of-Empires style, 2:1) camera. Players pick a room, nickname, faction, ship class, and
flag color, then join one of two teams. A team wins by destroying the enemy base.

All visuals are drawn as **vector art in Canvas/SVG by code** (no external art assets). The
server is authoritative.

### Core pillars
- Isometric 2:1 camera, vector-drawn ships and world.
- RTS click-to-move movement + manual aim (mouse direction + power) weapons.
- Distance-based cannon damage: close = high, far = low.
- Three weapons: cannon, archer, molotov (fire).
- Timed-buff skill system unlocked by kill streaks / multi-kills.
- Per-team base = respawn point + healing zone + win/lose objective.
- Buff donation between teammates at base.

## 2. Architecture

Approach: **Node.js + `ws` + vanilla HTML5 Canvas client** (no build step). Authoritative
server. `node server.js`, players open `http://LAN-IP:PORT`.

### Directory layout
```
ship/
  server/
    server.js        # HTTP static serve + WS upgrade, room router
    room.js          # 1 match = 1 room: state, tick loop, players
    game/
      ship.js        # ship entity + RTS-path movement
      weapons.js     # cannon/archer/molotov projectiles + damage
      skills.js      # streak tracking + buff application
      base.js        # base HP, healing zone, respawn, donation
      map.js         # island/obstacle geometry, collision
      balance.js     # ALL constants (stats, damage, cooldowns) in one place
  client/
    index.html
    js/ render.js (isometric draw) input.js net.js game.js
    js/ ships/ (per-ship vector-draw functions)
  shared/
    constants.js     # protocol message types, enums (shared server+client)
```

### Game loop
- Authoritative server, **20 tick/s** (50ms). Each tick: apply input → movement/collision →
  advance projectiles → damage/deaths → skills/streaks → base/heal → broadcast snapshot.
- Client sends input over WS (target point, fire dir+power, use skill). Server resolves.
- Client renders 60fps, **interpolates** between the two latest snapshots for smoothness.
- 1 room = 1 match, 2 teams (Pirate/Navy), 2–10 players.

Rationale: server decides everything = fair, cheat-resistant. `balance.js` centralizes all
numbers for easy tuning.

## 3. Ship Roster

Each faction has 5 classes. Same 5 archetypes, different faction flavor:
**Pirates = fast, burst, fire**; **Navy = armored, range, discipline**. Numbers live in
`balance.js` and are tunable.

### Pirates (Korsan)
| # | Ship | Size | HP | Speed | Cannon dmg | Reload | Range | Special / role |
|---|------|------|----|-------|-----------|--------|-------|----------------|
|1|Salapurya (Sloop)|small|80|100|low|fast|short|Fastest, hardest to hit, +vision. Kites.|
|2|Uskuna (Brig)|small-med|110|85|med|med|med|Archer specialist, strong volley.|
|3|Firkateyn (Frigate)|med|150|70|med|med|med|Balanced all-rounder.|
|4|Kalyon (Galleon)|large|240|45|high|slow|long|Heavy cannons, slow. Crusher.|
|5|Ates Gemisi (Fireship)|special|120|65|low|med|short|Molotov specialist, large AoE fire.|

### Navy (Donanma)
| # | Ship | Size | HP | Speed | Cannon dmg | Reload | Range | Special / role |
|---|------|------|----|-------|-----------|--------|-------|----------------|
|1|Karakol (Cutter)|small|90|95|low|fast|short|Fast scout, +vision.|
|2|Korvet (Corvette)|small-med|120|80|med|med|long|Sharpshooter archer, long range.|
|3|Firkateyn (Frigate)|med|160|68|med|med|med|Balanced, slightly armored.|
|4|Hat Gemisi (Ship-of-the-line)|large|260|42|high|slow|long|Armored broadside, tankiest.|
|5|Havan Gemisi (Bomb ketch)|special|130|60|med|slow|very long|Mortar/explosive, long-range area damage.|

### Rock-paper-scissors balance
- Small kites large (speed, hard to hit).
- Large crushes medium (raw HP/damage).
- Medium beats small (balance, accuracy).
- Fire/mortar special punishes clusters + slow large ships.
- Long-range archer (Corvette/Bomb ketch) punishes small kiters with range.

## 4. Weapons

Three weapons, all **manual aim** (mouse = direction + power/distance). Each has its own
cooldown. **Friendly fire OFF** in the first version. Ammo unlimited; balance via cooldowns.

### 4.1 Cannon (main)
- Aim: mouse direction, hold to charge **power** (distance), release to fire.
- **Distance–damage inverse (core mechanic):** the farther the shot travels, the less damage.
  - Close (< short threshold): full damage (~100%).
  - Mid: linear falloff (~60%).
  - Long (max range): min damage (~30%).
  - `dmg = base * lerp(1.0 → 0.3, distance / maxRange)`. Exact values in `balance.js`.
- Projectile travels (speed + flight time); moving targets can dodge → aiming skill.
- Reload depends on ship class (see roster).

### 4.2 Archer (in-ship fire)
- Fast, low-medium damage, fast cooldown, short-medium range (Corvette = long).
- Fires a fan volley. Good in close dogfights. **No distance falloff** (flat low damage).
- Role: fill-in damage while cannons reload + harass small ships.

### 4.3 Molotov (fire, area denial)
- Slow cooldown, leaves a **burning area** for a few seconds; ships inside take **damage over
  time (DoT)**.
- Fireship: larger area + longer duration. Strong vs clusters / slow large ships.
- Navy counterpart Bomb Ketch: very long range explosive, instant area damage (shock instead
  of lingering fire).

### Shared weapon rules
- No friendly fire (tunable later).
- Unlimited ammo, cooldown-gated.
- Attacks disabled inside own base healing zone (safe zone).

## 5. Skills / Streak System

Skills are **timed buffs** (activate on trigger, active X seconds, then expire). Kill streak
resets on death. Multiple buffs can stack.

| Trigger | Condition | Reward buff | Effect | Duration |
|---------|-----------|-------------|--------|----------|
|Line of Fire|3 kills in a row (no death)|**Fast Reload**|all cooldowns −40%|12s|
|Butcher|5 kills in a row|**Devastating Broadside**|cannon damage ×2|10s|
|Legend|7 kills in a row|**Full Sails**|speed +50%, damage taken −25%|10s|
|Slaughter|10 kills in a row|**Inferno** (ultimate)|molotov/fire area ×2, DoT ×2, cannons spread fire|12s|
|Double Kill|2 kills in one shot|**Chain Shot**|cannon ball pierces (multi-hit)|8s|
|Triple Kill|3 kills in one shot|**Shockwave** (instant)|knockback nearby enemies + stun 1.5s|instant + 8s buff|
|Eagle Eye|3 archer kills in a row|**Marksman**|archer range +40%, +2 arrows per volley|10s|

Rules:
- Buff gain shows a HUD notification + icon.
- Timed: a bar fills/drains; buff disappears when it ends.
- Higher streak = higher buff; keeping a streak requires not dying → risk/reward.
- No faction difference in triggers/rewards (fair).
- All numbers in `balance.js`.

Out of scope for v1 (YAGNI): faction-specific skill trees.

## 6. Base / Healing / Donation

### Base structure
- Each team has a base in an opposite corner. Large **HP bar** (~2000). If destroyed, that team
  can no longer respawn → **match ends, enemy wins**.
- Base has **defense turrets**: auto-fire at nearby enemies (diving in to destroy is risky).

### Healing zone (own team only)
- Circular area around base. Own ship must **enter and wait a few seconds** to regen HP
  (~2s wait → +X HP/sec until full).
- While inside, own ship **takes no damage** (safe). But it must wait, so it also cannot fire
  (matches "heal by waiting").
- Enemies may enter the zone (to attack the base) but get pounded by defense turrets. No healing
  for enemies.
- Respawn point = own base.

### Donation (buff donation)
- A player can **donate an active timed buff** to a teammate who comes near the base — sacrifice
  your own buff to strengthen a weaker teammate. Adds team-play depth; reuses the skill system.
- Command: `donate {targetPlayerId}` when both are in/near own base.

## 7. Network Protocol (WS, JSON)

Message types in `shared/constants.js` (shared server + client).

**Client→Server:**
- `join {room, nick, faction, shipClass, flagColor}`
- `move {x, y}` (target point)
- `fire {weapon, dir, power}`
- `useSkill {id}`
- `donate {targetPlayerId}`
- enter/leave heal zone detected automatically server-side.

**Server→Client:**
- `joined {playerId, worldState}`
- `snapshot {t, ships[], projectiles[], fires[], bases[]}` (20/s)
- `event {kill, streak, skillGained, baseHit, gameOver, ...}` (HUD/sound)
- `lobbyRooms {...}`

Notes:
- Snapshots are full (not delta) — cheap for small player counts. Client interpolates between
  the two latest snapshots.
- Reconnect: simple — on disconnect the ship sinks / player leaves (v1 YAGNI).

## 8. Lobby Flow

1. Page opens → **room list** (join existing / create new).
2. In a room: type **nickname** → **pick team** (Pirate/Navy) → pick one of that faction's
   **5 ships** → pick **flag color** (palette).
3. "Enter Battle" → server spawns the player, game screen loads.
4. HUD: HP bar, weapon cooldown icons, active buffs + timers, killstreak counter, score (both
   base HP), minimap.
5. On match end (base destroyed) → victory/defeat screen → back to lobby.

## 9. Map & Collision

- Fixed-size sea (~4000×4000 world units), drawn isometric.
- Two opposite-corner bases + healing zones. Islands/rocks in the middle (impassable cover).
- Collision: ship–island (circle/polygon), ship–ship (push), projectile–island (stops),
  projectile–ship (damage). Simple circle collision suffices for 2–10 players.
- Islands block projectiles and vision → corners for molotov/archer, kiting lanes.
- Map data (island positions/radii) in `map.js` for easy editing.

## 10. Out of Scope (v1)

- Faction-specific skill trees.
- Reconnect/rejoin persistence.
- Separate ammo counters for archer/molotov (cooldown-only for now).
- Friendly fire (off; tunable later).
- Accounts/persistence/matchmaking beyond LAN room list.
