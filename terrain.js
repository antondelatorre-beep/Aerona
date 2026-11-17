// Deterministic terrain, shared by the client (rendering, physics) and, from
// Stage 4 on, the server (movement validation). Pure functions, no imports
// beyond constants.

import { WORLD } from './constants.js';

const SEED = 1337;

function hash2(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function hash2d(ix, iy, seed = 0) { return hash2(ix, iy, seed); }

const quintic = (t) => t * t * t * (t * (t * 6 - 15) + 10);

export function noise2(x, y, seed = 0) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const u = quintic(x - x0), v = quintic(y - y0);
  const a = hash2(x0, y0, seed), b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed), d = hash2(x0 + 1, y0 + 1, seed);
  const top = a + (b - a) * u;
  const bottom = c + (d - c) * u;
  return top + (bottom - top) * v; // 0..1
}

export function fbm(x, y, octaves = 4, seed = 0) {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2(x * freq, y * freq, seed + i * 17);
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm; // 0..1
}

export const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const R = WORLD.half;

export function terrainHeight(x, z) {
  const d = Math.hypot(x, z) / R;
  const coastWobble = (fbm(x * 0.0007 + 10, z * 0.0007 + 10, 2, SEED + 3) - 0.5) * 0.35;
  const mask = 1 - smoothstep(0.72, 1.02, d + coastWobble);
  const base = fbm(x * 0.0009, z * 0.0009, 4, SEED);
  const hills = fbm(x * 0.004, z * 0.004, 4, SEED + 11);
  const ridge = 1 - Math.abs(fbm(x * 0.0016 + 50, z * 0.0016 + 50, 4, SEED + 23) * 2 - 1);
  const mountainZone = smoothstep(0.42, 0.66, fbm(x * 0.0006 + 99, z * 0.0006 - 40, 3, SEED + 31));
  let h = (base - 0.27) * 70 + (hills - 0.5) * 36 + mountainZone * Math.pow(ridge, 2.2) * 260;
  h = h * mask + (mask - 1) * 45;
  return h;
}

export function moisture(x, z) {
  return fbm(x * 0.0011 + 300, z * 0.0011 - 200, 3, SEED + 47);
}

export function terrainSlope(x, z, e = 3) {
  const dx = terrainHeight(x + e, z) - terrainHeight(x - e, z);
  const dz = terrainHeight(x, z + e) - terrainHeight(x, z - e);
  return Math.hypot(dx, dz) / (2 * e);
}

// An urban district on gentle lowland (buildings arrive in a later stage).
export const URBAN_CENTER = { x: -900, z: 700, radius: 380 };

export function biomeAt(x, z, h = terrainHeight(x, z), slope = null) {
  if (h < -0.4) return 'water';
  const d = Math.hypot(x, z) / R;
  if (h > 150) return 'mountain';
  if (h < 4.5) return d > 0.55 ? 'coast' : 'wetland';
  const ud = Math.hypot(x - URBAN_CENTER.x, z - URBAN_CENTER.z);
  if (ud < URBAN_CENTER.radius && h < 60 && (slope ?? terrainSlope(x, z)) < 0.2) return 'urban';
  return moisture(x, z) > 0.52 ? 'rainforest' : 'grassland';
}

// A pleasant starting spot: open grassland above sea level, close to the origin.
export function findSpawn() {
  for (let r = 0; r < 2400; r += 40) {
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2 + r * 0.01;
      const x = Math.cos(ang) * r, z = Math.sin(ang) * r;
      const h = terrainHeight(x, z);
      if (h > 6 && h < 45 && terrainSlope(x, z) < 0.15 && biomeAt(x, z, h) === 'grassland') {
        return { x, z, y: h };
      }
    }
  }
  return { x: 0, z: 0, y: Math.max(terrainHeight(0, 0), 1) };
}
