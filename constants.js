// Values shared by the browser client and the Node server.
// Keep this file free of browser or Node specific APIs.

export const WORLD = {
  size: 6000,        // metres, square world centred on (0, 0)
  half: 3000,
  seaLevel: 0,
  chunk: 200         // terrain chunk edge in metres
};

export const GRAVITY = 9.81;

// One in-game day lasts this many real seconds.
export const DAY_LENGTH_SECONDS = 1200;
export const START_HOUR = 9;

// Reserved for Stage 4 (multiplayer).
export const NET = { tickRate: 15, maxPlayers: 64 };
