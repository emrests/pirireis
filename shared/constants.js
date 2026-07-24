export const TICK_MS = 50;
export const WORLD = { w: 4000, h: 4000 };

export const FACTION = { PIRATE: 'pirate', NAVY: 'navy' };
export const WEAPON = { CANNON: 'cannon', ARCHER: 'archer', MOLOTOV: 'molotov' };

// client -> server and server -> client message type strings
export const MSG = {
  // client -> server
  LIST_ROOMS: 'listRooms',
  JOIN: 'join',
  MOVE: 'move',
  FIRE: 'fire',
  USE_SKILL: 'useSkill',
  DONATE: 'donate',
  HEAL: 'heal',
  START_GAME: 'startGame',
  SET_TEAM: 'setTeam',
  SET_NPC: 'setNpc',
  // server -> client
  ROOMS: 'rooms',
  JOINED: 'joined',
  LOBBY: 'lobby',
  STARTED: 'started',
  SNAPSHOT: 'snapshot',
  EVENT: 'event',
  ERROR: 'error',
};

export const SHIP_CLASSES = {
  pirate: ['sloop', 'brig', 'frigate', 'galleon', 'fireship'],
  navy: ['cutter', 'corvette', 'frigate_n', 'shipofline', 'bombketch'],
};
