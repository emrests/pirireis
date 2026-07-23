# Deniz Savaşı (Naval Battle)

LAN multiplayer isometric ship-battle. Pirates vs Navy. Node.js authoritative server + vanilla Canvas client.

## Run
```
npm install
npm start
```
Open `http://<server-LAN-IP>:8080` in each player's browser.

## Controls
- Left click: move ship (RTS)
- Right click + drag + release: fire cannon (drag length = power; closer aim = more damage)
- `A`: archer volley toward mouse
- `M`: molotov / mortar at mouse
- `D`: donate your oldest active buff to nearest teammate (near your base)

## Rules
- Destroy the enemy base to win. Your base is respawn + heal zone (wait ~2s inside to heal; can't fire while healing).
- Kill streaks grant timed buffs (3/5/7/10 in a row; multi-kills grant chain/shock).

## Test
```
npm test
```

## Tuning
All numbers live in `server/game/balance.js` (+ `BUFF_MS`). Map/islands in `server/game/map.js` — mirror the client copy in `client/js/render.js`.
