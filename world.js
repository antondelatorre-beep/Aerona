// The 3D world: streamed terrain chunks with distance LOD, instanced
// vegetation per biome, animated water, sky, sun/moon, stars, fog, and the
// day/night cycle. Terrain shape comes from shared/terrain.js so the server can
// validate against the same height field later.

import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WORLD, DAY_LENGTH_SECONDS, START_HOUR } from '/constants.js';
import {
  terrainHeight, terrainSlope, biomeAt, moisture, fbm, smoothstep, hash2d, URBAN_CENTER
} from '/terrain.js';

const QUALITY = {
  low:    { radius: 4, shadowMap: 1024, shadowSize: 60,  density: 0.5, pixelRatio: 1.0 },
  medium: { radius: 5, shadowMap: 2048, shadowSize: 80,  density: 0.8, pixelRatio: 1.5 },
  high:   { radius: 7, shadowMap: 2048, shadowSize: 110, density: 1.0, pixelRatio: 2.0 }
};
export const qualityPreset = (name) => QUALITY[name] || QUALITY.medium;

const SRGB = THREE.SRGBColorSpace;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const mix = (a, b, t) => a + (b - a) * t;

export const BIOME_LABELS = {
  water: 'Open water', coast: 'Coast', wetland: 'Wetland', rainforest: 'Rainforest',
  grassland: 'Grassland', mountain: 'Mountains', urban: 'Urban district'
};

// ---------------------------------------------------------------------------
// Vegetation prototypes: one merged, vertex-coloured geometry per plant type.
// ---------------------------------------------------------------------------

function part(geo, rgb, t = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.deleteAttribute('uv');
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(t.x || 0, t.y || 0, t.z || 0),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(t.rx || 0, t.ry || 0, t.rz || 0)),
    new THREE.Vector3(t.sx ?? 1, t.sy ?? 1, t.sz ?? 1)
  );
  g.applyMatrix4(m);
  const c = new THREE.Color().setRGB(rgb[0], rgb[1], rgb[2], SRGB);
  const n = g.attributes.position.count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

function buildPrototypes() {
  const TRUNK = [0.30, 0.21, 0.13];
  const ico = (r) => new THREE.IcosahedronGeometry(r, 0);
  const cyl = (rt, rb, h, s = 6) => new THREE.CylinderGeometry(rt, rb, h, s);
  const cone = (r, h, s = 7) => new THREE.ConeGeometry(r, h, s);
  const merged = (list) => mergeGeometries(list, false);
  const protos = {};

  protos.broadleaf = merged([
    part(cyl(0.35, 0.6, 7), TRUNK, { y: 3.5 }),
    part(ico(4.2), [0.16, 0.36, 0.14], { y: 9.2, sx: 1.2, sy: 0.8, sz: 1.2 }),
    part(ico(3.0), [0.20, 0.42, 0.16], { x: 2.4, y: 7.6, z: 0.8 }),
    part(ico(2.8), [0.14, 0.32, 0.13], { x: -2.2, y: 8.0, z: -1.2 })
  ]);
  protos.conifer = merged([
    part(cyl(0.25, 0.45, 3), TRUNK, { y: 1.5 }),
    part(cone(3.2, 4.2), [0.09, 0.25, 0.15], { y: 4.8 }),
    part(cone(2.4, 3.6), [0.11, 0.28, 0.17], { y: 7.2 }),
    part(cone(1.6, 3.2), [0.13, 0.31, 0.19], { y: 9.4 })
  ]);
  const fronds = [];
  for (let i = 0; i < 6; i++) {
    fronds.push(part(ico(1), [0.20, 0.46, 0.16], { y: 8.3, sx: 2.6, sy: 0.12, sz: 0.55, ry: (i / 6) * Math.PI * 2, rz: -0.35 }));
  }
  protos.palm = merged([part(cyl(0.2, 0.34, 8, 5), [0.42, 0.34, 0.24], { y: 4, rz: 0.06 }), ...fronds]);
  protos.bush = merged([
    part(ico(1.0), [0.20, 0.40, 0.15], { y: 0.7, sx: 1.2, sy: 0.85, sz: 1.2 }),
    part(ico(0.7), [0.24, 0.45, 0.17], { x: 0.8, y: 0.5, z: 0.4 })
  ]);
  protos.reed = merged([
    part(cone(0.09, 2.2, 4), [0.50, 0.56, 0.26], { y: 1.1, rz: 0.05 }),
    part(cone(0.08, 1.8, 4), [0.46, 0.54, 0.24], { x: 0.25, y: 0.9, rz: -0.12 }),
    part(cone(0.08, 2.0, 4), [0.52, 0.58, 0.28], { x: -0.2, y: 1.0, z: 0.2, rx: 0.1 })
  ]);
  protos.rock = merged([part(new THREE.DodecahedronGeometry(1, 0), [0.45, 0.43, 0.40], { y: 0.4, sx: 1.3, sy: 0.8, sz: 1.0 })]);
  const roots = [];
  for (let i = 0; i < 5; i++) {
    roots.push(part(cyl(0.08, 0.12, 2.4, 5), [0.28, 0.20, 0.14], { x: Math.cos(i * 1.256) * 1.2, y: 0.9, z: Math.sin(i * 1.256) * 1.2, rz: Math.cos(i * 1.256) * 0.5, rx: -Math.sin(i * 1.256) * 0.5 }));
  }
  protos.mangrove = merged([part(ico(2.8), [0.12, 0.30, 0.13], { y: 2.6, sx: 1.2, sy: 0.6, sz: 1.2 }), ...roots]);
  protos.building = merged([part(new THREE.BoxGeometry(1, 1, 1), [0.62, 0.64, 0.68], { y: 0.5 })]);
  return protos;
}

// ---------------------------------------------------------------------------
// Terrain colouring
// ---------------------------------------------------------------------------

const _c = new THREE.Color();
function terrainColor(x, z, h, slope, out) {
  const m = moisture(x, z);
  const n = fbm(x * 0.05, z * 0.05, 2, 5);
  const n2 = fbm(x * 0.4, z * 0.4, 2, 9);
  const coastal = Math.hypot(x, z) / WORLD.half > 0.5;

  let r, g, b;
  const forest = smoothstep(0.48, 0.60, m);
  r = mix(0.40, 0.13, forest); g = mix(0.50, 0.30, forest); b = mix(0.20, 0.12, forest);
  const shade = 0.82 + 0.3 * n + (n2 - 0.5) * 0.14;
  r *= shade; g *= shade; b *= shade;

  const wet = 1 - smoothstep(1.2, 5.0, h);
  r = mix(r, 0.28, wet * 0.6); g = mix(g, 0.38, wet * 0.6); b = mix(b, 0.20, wet * 0.6);

  const sand = coastal ? 1 - smoothstep(1.0, 3.4, h) : (1 - smoothstep(0.2, 1.1, h)) * 0.7;
  r = mix(r, 0.78, sand); g = mix(g, 0.70, sand); b = mix(b, 0.50, sand);

  const rock = clamp01(smoothstep(0.5, 0.95, slope) + smoothstep(110, 170, h) * 0.9);
  const rs = 0.8 + n2 * 0.4;
  r = mix(r, 0.42 * rs, rock); g = mix(g, 0.40 * rs, rock); b = mix(b, 0.38 * rs, rock);

  const snow = smoothstep(215, 250, h + n * 20);
  r = mix(r, 0.93, snow); g = mix(g, 0.95, snow); b = mix(b, 0.97, snow);

  const ud = Math.hypot(x - URBAN_CENTER.x, z - URBAN_CENTER.z);
  const urban = (1 - smoothstep(URBAN_CENTER.radius * 0.8, URBAN_CENTER.radius, ud)) * (slope < 0.25 && h < 60 && h > 3 ? 1 : 0);
  r = mix(r, 0.46, urban); g = mix(g, 0.47, urban); b = mix(b, 0.48, urban);

  if (h < 0) {                                           // sea / lake bed seen through the water
    const depth = smoothstep(0, 14, -h);
    r = mix(0.55, 0.03, depth); g = mix(0.50, 0.12, depth); b = mix(0.35, 0.22, depth);
  }
  _c.setRGB(r, g, b, SRGB);
  out[0] = _c.r; out[1] = _c.g; out[2] = _c.b;
}

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------

export class World {
  constructor(scene, renderer, quality = 'medium') {
    this.scene = scene;
    this.renderer = renderer;
    this.q = qualityPreset(quality);
    this.half = WORLD.half;
    this.time = 0;
    this.hour = START_HOUR;
    this.daylight = 1;
    this.sunDir = new THREE.Vector3(0, 1, 0);
    this.wind = { x: 3, z: 1.5 };
    this.chunks = new Map();
    this.protos = buildPrototypes();
    this.vegMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
    this.terrainMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 });

    this._buildSky();
    this._buildLights();
    this._buildWater();
    this._setTimeOfDay(START_HOUR);
  }

  // -- queries used by gameplay ------------------------------------------------

  terrainHeight(x, z) { return terrainHeight(x, z); }
  /** Height a bird can stand on: terrain, or the water surface where the terrain is submerged. */
  groundHeight(x, z) { return Math.max(terrainHeight(x, z), WORLD.seaLevel); }
  isWater(x, z) { return terrainHeight(x, z) < WORLD.seaLevel; }
  biomeAt(x, z) { return biomeAt(x, z); }

  /** Thermal updraft in m/s: warm patches over land, strongest in the afternoon. */
  updraft(x, z, t) {
    if (terrainHeight(x, z) < 1) return 0;
    const n = fbm(x * 0.0035 + t * 0.004, z * 0.0035 - t * 0.003, 3, 71);
    return smoothstep(0.55, 0.78, n) * 3.2 * this.daylight;
  }

  // -- sky, lights, water ---------------------------------------------------------

  _buildSky() {
    this.sky = new Sky();
    this.sky.scale.setScalar(9000);
    const u = this.sky.material.uniforms;
    u.turbidity.value = 4;
    u.rayleigh.value = 1.2;
    u.mieCoefficient.value = 0.005;
    u.mieDirectionalG.value = 0.8;
    this.scene.add(this.sky);

    const N = 1400, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 1.9 - 0.95);
      pos[i * 3] = 7000 * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = 7000 * Math.cos(ph);
      pos[i * 3 + 2] = 7000 * Math.sin(ph) * Math.sin(th);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);

    this.fog = new THREE.Fog(0xaec8e6, 300, 1200);
    this.scene.fog = this.fog;
  }

  _buildLights() {
    this.hemi = new THREE.HemisphereLight(0xaecdff, 0x5a4a30, 1);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    const s = this.sun.shadow;
    s.mapSize.set(this.q.shadowMap, this.q.shadowMap);
    const e = this.q.shadowSize;
    Object.assign(s.camera, { left: -e, right: e, top: e, bottom: -e, near: 1, far: 700 });
    s.bias = -0.0004;
    s.normalBias = 0.05;
    this.scene.add(this.sun, this.sun.target);
  }

  _buildWater() {
    const geo = new THREE.PlaneGeometry(1, 1, 1, 1);
    geo.rotateX(-Math.PI / 2);
    this.waterUniforms = {
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color(1, 0.95, 0.85) },
      uSkyColor: { value: new THREE.Color(0.35, 0.55, 0.9) },
      uDeep: { value: new THREE.Color(0.02, 0.10, 0.16) },
      uFogColor: { value: new THREE.Color(0.7, 0.8, 0.9) },
      uFogNear: { value: 300 },
      uFogFar: { value: 1200 },
      uLight: { value: 1 }
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.waterUniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */`
        varying vec3 vWorld;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */`
        uniform float uTime, uFogNear, uFogFar, uLight;
        uniform vec3 uSunDir, uSunColor, uSkyColor, uDeep, uFogColor;
        varying vec3 vWorld;
        void main() {
          vec2 p = vWorld.xz;
          float t = uTime;
          vec2 g = vec2(0.0);
          g += vec2(0.80, 0.60) * cos(dot(p, vec2(0.80, 0.60)) * 0.35 + t * 0.9) * 0.35;
          g += vec2(-0.50, 0.85) * cos(dot(p, vec2(-0.50, 0.85)) * 0.62 + t * 1.3) * 0.22;
          g += vec2(0.20, -0.95) * cos(dot(p, vec2(0.20, -0.95)) * 1.40 + t * 1.9) * 0.12;
          g += vec2(0.90, -0.40) * cos(dot(p, vec2(0.90, -0.40)) * 2.90 + t * 2.7) * 0.05;
          vec3 N = normalize(vec3(-g.x * 0.35, 1.0, -g.y * 0.35));
          vec3 V = normalize(cameraPosition - vWorld);
          float fres = mix(0.04, 1.0, pow(1.0 - max(dot(N, V), 0.0), 4.0));
          vec3 col = mix(uDeep * uLight, uSkyColor * uLight, fres);
          vec3 R = reflect(-uSunDir, N);
          float spec = pow(max(dot(R, V), 0.0), 140.0) * step(0.0, uSunDir.y);
          col += uSunColor * spec * 2.0;
          float fog = smoothstep(uFogNear, uFogFar, length(cameraPosition - vWorld));
          col = mix(col, uFogColor, fog);
          float alpha = mix(clamp(0.55 + fres * 0.45, 0.0, 1.0), 1.0, fog);
          gl_FragColor = vec4(col, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    });
    this.water = new THREE.Mesh(geo, mat);
    this.water.scale.set(16000, 1, 16000);
    this.water.renderOrder = 2;
    this.water.frustumCulled = false;
    this.scene.add(this.water);
  }

  _setTimeOfDay(hour) {
    this.hour = hour;
    const el = ((hour - 6) / 12) * Math.PI;
    this.sunDir.set(Math.cos(el) * Math.cos(0.6), Math.sin(el), Math.cos(el) * Math.sin(0.6)).normalize();
    const s = this.sunDir.y;
    const day = smoothstep(-0.06, 0.25, s);
    this.daylight = day;
    const twilight = clamp01(1 - Math.abs(s) / 0.3) * (s > -0.12 ? 1 : 0);

    const fog = new THREE.Color();
    fog.setRGB(mix(0.015, 0.66, day), mix(0.025, 0.78, day), mix(0.05, 0.90, day));
    fog.lerp(new THREE.Color(0.9, 0.55, 0.35), twilight * 0.7);
    this.fog.color.copy(fog);
    this.waterUniforms.uFogColor.value.copy(fog);
    this.waterUniforms.uSkyColor.value.setRGB(mix(0.02, 0.30, day), mix(0.04, 0.52, day), mix(0.08, 0.90, day)).lerp(new THREE.Color(0.9, 0.5, 0.3), twilight * 0.4);
    this.waterUniforms.uLight.value = mix(0.15, 1, day);
    this.waterUniforms.uSunDir.value.copy(this.sunDir);

    const warm = new THREE.Color(1, 0.62, 0.32), white = new THREE.Color(1, 0.96, 0.9);
    const sunColor = warm.lerp(white, smoothstep(0.05, 0.5, s));
    this.waterUniforms.uSunColor.value.copy(sunColor);
    if (s > -0.02) {
      this.sun.color.copy(sunColor);
      this.sun.intensity = 3.2 * smoothstep(-0.02, 0.12, s);
      this._lightDir = this.sunDir;
    } else {
      this.sun.color.setRGB(0.45, 0.55, 0.9);
      this.sun.intensity = 0.35 * smoothstep(-0.02, -0.18, s);
      this._lightDir = _moon.copy(this.sunDir).negate();
    }
    this.hemi.intensity = mix(0.08, 1.0, day);
    this.hemi.color.setRGB(mix(0.2, 0.68, day), mix(0.25, 0.80, day), mix(0.4, 1.0, day));

    const u = this.sky.material.uniforms;
    u.sunPosition.value.copy(this.sunDir);
    u.rayleigh.value = mix(0.3, 1.2, day) + twilight * 1.2;
    this.stars.material.opacity = clamp01(1 - day * 1.4);
    this.renderer.toneMappingExposure = mix(0.9, 0.55, day);
  }

  // -- streaming ----------------------------------------------------------------------

  _ring(cx, cz, fcx, fcz) { return Math.max(Math.abs(cx - fcx), Math.abs(cz - fcz)); }
  _tiers(ring) { return { terrain: ring <= 1 ? 0 : ring <= 3 ? 1 : 2, veg: ring <= 2 ? 0 : 1 }; }

  update(dt, focus) {
    this.time += dt;
    this.waterUniforms.uTime.value = this.time;
    this._setTimeOfDay((START_HOUR + (this.time / DAY_LENGTH_SECONDS) * 24) % 24);
    this.wind.x = 3 + Math.sin(this.time * 0.05) * 1.5;
    this.wind.z = 1.5 + Math.cos(this.time * 0.037) * 1.2;

    // lights follow the player
    this.sun.target.position.copy(focus);
    this.sun.position.copy(focus).addScaledVector(this._lightDir, 280);
    this.sky.position.copy(focus);
    this.stars.position.copy(focus);
    this.water.position.set(focus.x, 0, focus.z);

    this._stream(focus, 2);
  }

  _fogFar() { return this.q.radius * WORLD.chunk * 0.92; }

  _stream(focus, budget) {
    const size = WORLD.chunk, R = this.q.radius;
    const fcx = Math.floor(focus.x / size), fcz = Math.floor(focus.z / size);
    const far = this._fogFar();
    this.fog.near = far * 0.45;
    this.fog.far = far;
    this.waterUniforms.uFogNear.value = this.fog.near;
    this.waterUniforms.uFogFar.value = this.fog.far;

    const wanted = [];
    const limit = Math.floor(WORLD.half / size);
    for (let dz = -R; dz <= R; dz++) {
      for (let dx = -R; dx <= R; dx++) {
        const cx = fcx + dx, cz = fcz + dz;
        if (Math.abs(cx) > limit || Math.abs(cz) > limit) continue;
        wanted.push({ cx, cz, ring: Math.max(Math.abs(dx), Math.abs(dz)), d: dx * dx + dz * dz });
      }
    }
    wanted.sort((a, b) => a.d - b.d);

    let built = 0;
    const keep = new Set();
    for (const w of wanted) {
      const key = `${w.cx},${w.cz}`;
      keep.add(key);
      const tiers = this._tiers(w.ring);
      const have = this.chunks.get(key);
      if (have && have.tt === tiers.terrain && have.vt === tiers.veg) { have.ring = w.ring; continue; }
      if (built >= budget) continue;
      if (have) this._disposeChunk(have);
      this.chunks.set(key, this._buildChunk(w.cx, w.cz, w.ring, tiers));
      built++;
    }
    for (const [key, chunk] of this.chunks) {
      if (!keep.has(key)) { this._disposeChunk(chunk); this.chunks.delete(key); }
    }
    return built;
  }

  /** Build everything around `focus` before the first frame; reports progress 0..1. */
  async prime(focus, onProgress) {
    const need = (2 * this.q.radius + 1) ** 2;
    for (let guard = 0; guard < 400; guard++) {
      const built = this._stream(focus, 3);
      onProgress?.(Math.min(1, this.chunks.size / need));
      if (!built) break;
      await new Promise((r) => setTimeout(r, 0));
    }
    onProgress?.(1);
  }

  _disposeChunk(c) {
    this.scene.remove(c.group);
    c.group.traverse((o) => {
      if (o.isInstancedMesh) o.dispose();
      else if (o.isMesh && o.geometry) o.geometry.dispose();
    });
  }

  _buildChunk(cx, cz, ring, tiers) {
    const size = WORLD.chunk;
    const seg = [48, 24, 12][tiers.terrain];
    const group = new THREE.Group();
    group.position.set(cx * size, 0, cz * size);

    const mesh = new THREE.Mesh(this._terrainGeometry(cx, cz, seg), this.terrainMaterial);
    mesh.receiveShadow = true;
    group.add(mesh);
    this._populate(group, cx, cz, tiers, ring <= 2);
    this.scene.add(group);
    return { group, cx, cz, ring, tt: tiers.terrain, vt: tiers.veg };
  }

  _terrainGeometry(cx, cz, seg) {
    const size = WORLD.chunk, x0 = cx * size, z0 = cz * size, step = size / seg, n = seg + 1, w = n + 2;
    const hs = new Float32Array(w * w);
    for (let j = -1; j <= n; j++) for (let i = -1; i <= n; i++) hs[(j + 1) * w + (i + 1)] = terrainHeight(x0 + i * step, z0 + j * step);
    const H = (i, j) => hs[(j + 1) * w + (i + 1)];

    const ring = [];
    for (let i = 0; i < n; i++) ring.push([i, 0]);
    for (let j = 1; j < n; j++) ring.push([n - 1, j]);
    for (let i = n - 2; i >= 0; i--) ring.push([i, n - 1]);
    for (let j = n - 2; j >= 1; j--) ring.push([0, j]);

    const verts = n * n + ring.length;
    const pos = new Float32Array(verts * 3), nor = new Float32Array(verts * 3), col = new Float32Array(verts * 3);
    const rgb = [0, 0, 0];
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = j * n + i, h = H(i, j);
        pos[k * 3] = i * step; pos[k * 3 + 1] = h; pos[k * 3 + 2] = j * step;
        const nx = (H(i - 1, j) - H(i + 1, j)) / (2 * step), nz = (H(i, j - 1) - H(i, j + 1)) / (2 * step);
        const il = 1 / Math.hypot(nx, 1, nz);
        nor[k * 3] = nx * il; nor[k * 3 + 1] = il; nor[k * 3 + 2] = nz * il;
        const slope = Math.hypot(nx, nz);
        terrainColor(x0 + i * step, z0 + j * step, h, slope, rgb);
        col[k * 3] = rgb[0]; col[k * 3 + 1] = rgb[1]; col[k * 3 + 2] = rgb[2];
      }
    }
    const skirtBase = n * n, skirtDrop = 25;
    ring.forEach(([i, j], s) => {
      const src = j * n + i, k = skirtBase + s;
      pos[k * 3] = pos[src * 3]; pos[k * 3 + 1] = pos[src * 3 + 1] - skirtDrop; pos[k * 3 + 2] = pos[src * 3 + 2];
      nor[k * 3] = nor[src * 3]; nor[k * 3 + 1] = nor[src * 3 + 1]; nor[k * 3 + 2] = nor[src * 3 + 2];
      col[k * 3] = col[src * 3]; col[k * 3 + 1] = col[src * 3 + 1]; col[k * 3 + 2] = col[src * 3 + 2];
    });

    const idx = [];
    for (let j = 0; j < seg; j++) {
      for (let i = 0; i < seg; i++) {
        const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    for (let s = 0; s < ring.length; s++) {
      const [i0, j0] = ring[s], [i1, j1] = ring[(s + 1) % ring.length];
      const p0 = j0 * n + i0, p1 = j1 * n + i1, q0 = skirtBase + s, q1 = skirtBase + ((s + 1) % ring.length);
      idx.push(p0, p1, q0, p1, q1, q0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
  }

  // -- vegetation ----------------------------------------------------------------------

  _populate(group, cx, cz, tiers, castShadow) {
    const size = WORLD.chunk, cell = 10, cells = size / cell;
    const x0 = cx * size, z0 = cz * size;
    const dens = this.q.density * (tiers.veg === 0 ? 1 : 0.3);
    const farTier = tiers.veg > 0;
    const buckets = {};
    const add = (type, x, y, z, rot, sx, sy, sz) => { (buckets[type] ||= []).push(x - x0, y, z - z0, rot, sx, sy, sz); };

    for (let gz = 0; gz < cells; gz++) {
      for (let gx = 0; gx < cells; gx++) {
        const ix = cx * cells + gx, iz = cz * cells + gz;
        const wx = x0 + (gx + hash2d(ix, iz, 1)) * cell;
        const wz = z0 + (gz + hash2d(ix, iz, 2)) * cell;
        const h = terrainHeight(wx, wz);
        if (h < -0.3) continue;
        const slope = terrainSlope(wx, wz, 2);
        const biome = biomeAt(wx, wz, h, slope);
        const r = hash2d(ix, iz, 3), r2 = hash2d(ix, iz, 4), rot = hash2d(ix, iz, 5) * Math.PI * 2;
        const sc = 0.75 + hash2d(ix, iz, 6) * 0.75;

        switch (biome) {
          case 'rainforest':
            if (slope < 0.7 && r < 0.55 * dens) add('broadleaf', wx, h - 0.2, wz, rot, sc * 1.1, sc * (1 + r2 * 0.5), sc * 1.1);
            else if (!farTier && r2 < 0.35 * dens) add('bush', wx, h, wz, rot, sc, sc, sc);
            break;
          case 'grassland':
            if (r < 0.07 * dens) add('broadleaf', wx, h - 0.2, wz, rot, sc * 0.7, sc * 0.7, sc * 0.7);
            else if (!farTier && r2 < 0.22 * dens) add('bush', wx, h, wz, rot, sc * 0.8, sc * 0.8, sc * 0.8);
            break;
          case 'wetland':
            if (!farTier && r < 0.8) {
              for (let k = 0; k < 3; k++) {
                add('reed', wx + (hash2d(ix, iz, 10 + k) - 0.5) * cell, Math.max(h, 0), wz + (hash2d(ix, iz, 20 + k) - 0.5) * cell, rot + k, sc, sc * (0.8 + r2 * 0.6), sc);
              }
            }
            if (r2 < 0.05 * dens) add('palm', wx, h, wz, rot, sc * 0.8, sc * 0.8, sc * 0.8);
            break;
          case 'coast':
            if (h < 1.6 && r < 0.28 * dens) add('mangrove', wx, h, wz, rot, sc, sc, sc);
            else if (r < 0.2 * dens) add('palm', wx, h, wz, rot, sc * 0.9, sc * 0.9, sc * 0.9);
            else if (!farTier && r2 < 0.1 * dens) add('bush', wx, h, wz, rot, sc * 0.7, sc * 0.7, sc * 0.7);
            break;
          case 'mountain':
            if (h < 175 && slope < 0.8 && r < 0.38 * dens) add('conifer', wx, h - 0.2, wz, rot, sc, sc * (0.9 + r2 * 0.6), sc);
            else if (r2 < 0.22 && (slope > 0.45 || h > 150)) add('rock', wx, h - 0.2, wz, rot, sc * 1.6, sc * 1.4, sc * 1.6);
            break;
          case 'urban':
            if (gx % 4 === 0 && gz % 4 === 0 && slope < 0.2 && r < 0.75 * Math.max(dens, 0.4)) {
              const w = 12 + r2 * 12, d = 12 + hash2d(ix, iz, 7) * 12, ht = 8 + Math.pow(hash2d(ix, iz, 8), 2) * 34;
              add('building', wx, h - 0.5, wz, Math.floor(rot / (Math.PI / 2)) * (Math.PI / 2), w, ht, d);
            } else if (!farTier && r < 0.1 * dens) add('broadleaf', wx, h - 0.2, wz, rot, sc * 0.55, sc * 0.55, sc * 0.55);
            break;
          default:
            break;
        }
      }
    }

    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), color = new THREE.Color();
    for (const [type, arr] of Object.entries(buckets)) {
      const count = arr.length / 7;
      const mesh = new THREE.InstancedMesh(this.protos[type], this.vegMaterial, count);
      for (let i = 0; i < count; i++) {
        const o = i * 7;
        q.setFromAxisAngle(AXIS_Y, arr[o + 3]);
        m.compose(p.set(arr[o], arr[o + 1], arr[o + 2]), q, s.set(arr[o + 4], arr[o + 5], arr[o + 6]));
        mesh.setMatrixAt(i, m);
        const v = 0.82 + hash2d(i, count, 99) * 0.36;
        mesh.setColorAt(i, color.setRGB(v, v * (0.95 + hash2d(i, count, 98) * 0.1), v * 0.95));
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.castShadow = castShadow && type !== 'reed' && type !== 'bush';
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      group.add(mesh);
    }
  }
}

const AXIS_Y = new THREE.Vector3(0, 1, 0);
const _moon = new THREE.Vector3();
