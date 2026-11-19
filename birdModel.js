// Loads a bird (Sketchfab GLB or a procedural stand-in) and binds it to a
// species-independent "rig" that the procedural animator drives.
//
// Hierarchy (outermost first):
//   root      world position + yaw / pitch / roll from the flight controller
//   bob       uniform model scale, body bounce and sway
//   attitude  tilts a perched-pose model into a flying posture, about the pivot
//   content   shifted so the pivot (centre of mass) sits at the origin
//   object    the imported scene
//
// The rig never assumes bone names; everything comes from the model config.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { wingBasis } from './rigMath.js';

const AX = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ease = (t) => t * t * (3 - 2 * t);

/** Find a node by (punctuation-insensitive) name, RegExp, or exact name. */
export function findNode(root, spec) {
  if (!spec) return null;
  if (spec instanceof RegExp) {
    let hit = null;
    root.traverse((o) => { if (!hit && spec.test(o.name)) hit = o; });
    return hit;
  }
  const target = norm(spec);
  let exact = null, partial = null;
  root.traverse((o) => {
    const n = norm(o.name);
    if (!n) return;
    if (n === target) { if (!exact) exact = o; } else if (!partial && n.includes(target)) partial = o;
  });
  return exact || partial;
}

export function describeModel(root) {
  const lines = [];
  root.traverse((o) => {
    let depth = 0, p = o;
    while (p && p !== root) { depth++; p = p.parent; }
    lines.push(`${'  '.repeat(depth)}${o.type}${o.isBone ? ' (bone)' : ''}: "${o.name}"`);
  });
  return lines;
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

let sharedLoader = null;
function getLoader() {
  if (sharedLoader) return sharedLoader;
  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath('/vendor/three/examples/jsm/libs/draco/gltf/');
  loader.setDRACOLoader(draco);
  loader.setMeshoptDecoder(MeshoptDecoder);
  sharedLoader = loader;
  return loader;
}

/**
 * Create a BirdModel for a species. Never throws: if the GLB is missing or
 * unusable the game falls back to a procedural bird and reports why in
 * `model.info.error`.
 */
const sourceCache = new Map();   // path -> Promise<gltf>, shared by every bird that uses the file

/** Download (once) and cache a GLB. */
export function loadBirdSource(path, onProgress) {
  if (!sourceCache.has(path)) {
    const p = getLoader().loadAsync(path, (e) => { if (onProgress && e.total) onProgress(e.loaded / e.total); });
    p.then((gltf) => {
      console.groupCollapsed(`[aerona] nodes in ${path}`);
      console.log(describeModel(gltf.scene).join('\n'));
      console.log('animation clips:', gltf.animations.map((a) => a.name));
      console.groupEnd();
    }).catch(() => sourceCache.delete(path));
    sourceCache.set(path, p);
  }
  return sourceCache.get(path);
}

/** Start downloading a species' model without building anything. */
export function preloadBird(species, config) {
  const path = config?.path;
  return path ? loadBirdSource(path).catch(() => null) : Promise.resolve(null);
}

/**
 * Create a BirdModel for a species. Never throws: if the GLB is missing or
 * unusable the game falls back to a procedural bird and reports why in
 * `model.info.error`. Every call gets its own clone of the cached scene, so any
 * number of birds can share one downloaded file.
 */
export async function createBird(species, config, onProgress, autoPath = null) {
  const path = config?.path || autoPath;
  if (!path) return buildPlaceholder(species, { reason: 'no-config' });
  try {
    const gltf = await loadBirdSource(path, onProgress);
    const cfg = config || autoConfig(gltf.scene, species, path);
    if (!config) console.info(`[aerona] ${species.id}: no entry in modelConfigs.js, using an automatic draft:`, JSON.stringify(cfg, null, 2));
    return new BirdModel(cloneSkinned(gltf.scene), cfg, species, { source: 'glb', auto: !config, clips: gltf.animations });
  } catch (err) {
    console.error(`[aerona] could not load ${path}`, err);
    return buildPlaceholder(species, { reason: 'load-failed', error: err?.message || String(err), path });
  }
}

/**
 * Draft model config for a GLB nobody has configured yet. It fits the scale to
 * the species' real size, finds rigid wing/leg meshes and neck/tail bones by
 * name, and logs the result so it can be pasted into modelConfigs.js and refined.
 */
export function autoConfig(object, species, path) {
  object.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
  const spreadModel = size.x > size.z * 1.6;            // authored with wings already out
  const scale = spreadModel ? species.size.wingspan / Math.max(size.x, 1e-6) : species.size.length / Math.max(size.z, 1e-6);

  const all = [];
  object.traverse((o) => all.push(o));
  const hasMesh = (o) => o.isMesh || o.children.some((c) => c.isMesh);
  const topmost = (list) => list.filter((o) => !list.includes(o.parent));
  const wingNodes = topmost(all.filter((o) => !o.isBone && /wing/i.test(o.name) && hasMesh(o)));
  const legNodes = topmost(all.filter((o) => !o.isBone && /leg|foot|talon|claw/i.test(o.name) && hasMesh(o)));
  const bones = all.filter((o) => o.isBone);
  const names = (list) => list.map((o) => o.name);
  const byDepth = (list) => [...list].sort((a, b) => depthOf(a) - depthOf(b));

  const cfg = {
    path, auto: true, scale, forwardRotation: 0, flightPitch: 0, fixMaterials: true,
    shoulderDir: [0, 0, 1],
    wings: !spreadModel && wingNodes.length >= 2 ? { type: 'rigid', nodes: names(wingNodes.slice(0, 2)), spread: { length: 2, thickness: 1, chord: 1.5 } } : { type: 'rigid', nodes: [] },
    legs: legNodes.length ? { type: 'rigid', nodes: names(legNodes.slice(0, 2)) } : undefined,
    bones: { neck: names(byDepth(bones.filter((b) => /neck|head/i.test(b.name)))), tail: names(byDepth(bones.filter((b) => /tail/i.test(b.name)))) },
    neck: { pitchWeights: [0.4, 0.3, 0.3], yawWeights: [0.3, 0.7] },
    tail: { pitchWeights: [0.5, 0.5], yawWeights: [0.5, 0.5] }
  };
  return cfg;
}

function depthOf(o) { let d = 0; for (let p = o; p; p = p.parent) d++; return d; }

// ---------------------------------------------------------------------------
// Procedural stand-in bird (also the fallback for missing/incompatible models)
// ---------------------------------------------------------------------------

function colorFromId(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return new THREE.Color().setHSL((h % 360) / 360, 0.35, 0.38);
}

function buildPlaceholder(species, info) {
  const L = species.size.length;
  const mat = (c, r = 0.85) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0 });
  const body = colorFromId(species.id);
  const light = body.clone().offsetHSL(0, -0.1, 0.25);
  const g = new THREE.Group();
  g.name = 'placeholder_bird';

  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 14), mat(body));
  torso.scale.set(0.3 * L, 0.27 * L, 0.55 * L);
  g.add(torso);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 10), mat(light));
  belly.scale.set(0.26 * L, 0.18 * L, 0.45 * L);
  belly.position.set(0, -0.07 * L, 0.02 * L);
  g.add(belly);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), mat(body.clone().offsetHSL(0, 0, -0.05)));
  head.scale.setScalar(0.22 * L);
  head.position.set(0, 0.1 * L, 0.5 * L);
  g.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05 * L, 0.2 * L, 8), mat(0xd9a441, 0.6));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.08 * L, 0.7 * L);
  g.add(beak);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018 * L, 8, 6), mat(0x050505, 0.3));
    eye.position.set(s * 0.085 * L, 0.13 * L, 0.58 * L);
    g.add(eye);
  }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.2 * L, 0.025 * L, 0.38 * L), mat(body.clone().offsetHSL(0, 0, -0.08)));
  tail.position.set(0, 0.0, -0.62 * L);
  g.add(tail);

  const wingLenFolded = 0.55 * L;
  for (const [name, s] of [['ph_wingL', 1], ['ph_wingR', -1]]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.03 * L, 0.2 * L, wingLenFolded), mat(body.clone().offsetHSL(0, 0, -0.1)));
    wing.name = name;
    wing.position.set(s * 0.3 * L, 0.06 * L, -0.02 * L);
    g.add(wing);
  }
  for (const [name, s] of [['ph_legL', 1], ['ph_legR', -1]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012 * L, 0.012 * L, 0.3 * L, 6), mat(0xc98a3d, 0.7));
    leg.name = name;
    leg.position.set(s * 0.1 * L, -0.28 * L, 0.02 * L);
    g.add(leg);
  }

  const targetHalfSpan = Math.max(species.size.wingspan - 0.6 * L, 0.2 * L) / 2;
  const config = {
    path: null,
    scale: 1,
    forwardRotation: 0,
    flightPitch: 0,
    fixMaterials: false,
    shoulderDir: [0, 0, 1],
    wings: { type: 'rigid', nodes: ['ph_wingL', 'ph_wingR'], spread: { length: targetHalfSpan / wingLenFolded, thickness: 1, chord: 1.5 } },
    legs: { type: 'rigid', nodes: ['ph_legL', 'ph_legR'] },
    bones: {}, neck: {}, tail: {}
  };
  g.traverse((o) => {
    if (o.geometry) o.geometry.userData.owned = true;
    if (o.material) o.material.userData.owned = true;
  });
  return new BirdModel(g, config, species, { source: 'placeholder', ...info });
}

function syntheticWingGeometry(cfg, side) {
  const L = cfg.length, C = cfg.chord;
  // span fraction, chord fraction (+ is towards the leading edge)
  const outline = [[0, 0.30], [0.45, 0.36], [0.8, 0.26], [1, 0.05], [0.97, -0.2], [0.88, -0.32], [0.84, -0.5], [0.72, -0.38],
    [0.66, -0.56], [0.52, -0.42], [0.42, -0.58], [0.3, -0.44], [0.15, -0.4], [0, -0.3]];
  const shape = new THREE.Shape();
  outline.forEach(([sx, cz], i) => (i ? shape.lineTo(side * sx * L, -cz * C) : shape.moveTo(side * sx * L, -cz * C)));
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);                       // plate lies flat, dorsal side up, leading edge towards +Z
  const base = new THREE.Color().setRGB(...(cfg.color || [0.12, 0.13, 0.15]), THREE.SRGBColorSpace);
  const trail = new THREE.Color().setRGB(...(cfg.trailColor || [0.55, 0.57, 0.6]), THREE.SRGBColorSpace);
  const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, Math.max(0, (0.3 * C - pos.getZ(i)) / (0.9 * C)));   // 0 at leading edge, 1 at trailing edge
    c.copy(base).lerp(trail, t * t);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.userData.owned = true;
  return geo;
}

// ---------------------------------------------------------------------------
// BirdModel
// ---------------------------------------------------------------------------

const _m1 = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _qa = new THREE.Quaternion();
const _qb = new THREE.Quaternion();
const _qc = new THREE.Quaternion();
const _qLevel = new THREE.Quaternion();
const _qInv = new THREE.Quaternion();
const _ident = new THREE.Quaternion();

export class BirdModel {
  constructor(object, config, species, info = {}) {
    this.config = config;
    this.species = species;
    this.info = info;
    this.warnings = [];
    this.object = object;

    this.root = new THREE.Group();
    this.bob = new THREE.Group();
    this.attitude = new THREE.Group();
    this.content = new THREE.Group();
    this.root.add(this.bob);
    this.bob.add(this.attitude);
    this.attitude.add(this.content);
    this.content.add(object);
    object.rotation.y += config.forwardRotation || 0;

    this.wings = [];       // rigid wing records
    this.legs = [];        // rigid leg records
    this.wingChains = { left: [], right: [] };
    this.neck = [];
    this.tail = [];

    this._prepareMeshes();
    this.content.updateMatrixWorld(true);
    this._measure();
    this._setupWings();
    this._setupLegs();
    this._setupBones();
    this.content.position.copy(this.pivot).multiplyScalar(-1);
    this.bob.scale.setScalar(config.scale || 1);
    this.root.updateMatrixWorld(true);

    if (this.warnings.length) console.warn('[aerona] model warnings for', species.id, this.warnings);
  }

  /** Distance from the model centre (pivot) to the soles of the feet, in metres. */
  get groundLift() { return (this.pivot.y - this.footY) * (this.config.scale || 1); }

  warn(msg) { this.warnings.push(msg); }

  _prepareMeshes() {
    const fix = this.config.fixMaterials;
    this.object.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;   // parts are re-posed every frame; bind-pose bounds are unreliable
      if (fix) {
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if ('metalness' in m) m.metalness = Math.min(m.metalness, 0.05);
          if ('roughness' in m) m.roughness = Math.max(m.roughness, 0.65);
        }
      }
    });
  }

  _measure() {
    const box = new THREE.Box3().setFromObject(this.content, true);
    const centre = box.getCenter(new THREE.Vector3());
    this.box = box;
    this.symmetryX = centre.x;
    this.pivot = this.config.pivot ? new THREE.Vector3(...this.config.pivot) : centre.clone();
    this.footY = this.config.footY ?? box.min.y;
  }

  _pointsOf(node) {
    const inv = _m1.copy(this.content.matrixWorld).invert();
    const pts = [];
    node.updateWorldMatrix(true, true);
    node.traverse((m) => {
      if (!m.isMesh) return;
      const attr = m.geometry.attributes.position;
      const mm = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
      for (let i = 0; i < attr.count; i++) {
        _v.fromBufferAttribute(attr, i).applyMatrix4(mm);
        pts.push(_v.x, _v.y, _v.z);
      }
    });
    return pts;
  }

  _relMatrix(node) {
    node.updateWorldMatrix(true, false);
    const inv = new THREE.Matrix4().copy(this.content.matrixWorld).invert();
    return new THREE.Matrix4().multiplyMatrices(inv, node.matrixWorld);
  }

  /** Find the configured nodes; with `split`, cut each one's mesh into left and right halves. */
  _resolveNodes(cfg, label) {
    const out = [];
    for (const spec of cfg.nodes || []) {
      const node = findNode(this.object, spec);
      if (!node) { this.warn(`${label} node "${spec}" not found`); continue; }
      if (cfg.split) out.push(...this._splitBySide(node, label));
      else out.push(node);
    }
    return out;
  }

  _splitBySide(node, label) {
    let mesh = null;
    node.traverse((o) => { if (!mesh && o.isMesh) mesh = o; });
    if (!mesh) { this.warn(`${label} node "${node.name}" has no mesh to split`); return []; }
    this.content.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(this.content.matrixWorld).invert();
    const mm = new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld);
    const g = mesh.geometry, pos = g.attributes.position, idx = g.index;
    const tris = idx ? idx.count / 3 : pos.count / 3;
    const at = (t, k) => (idx ? idx.getX(t * 3 + k) : t * 3 + k);
    const sides = [[], []];
    for (let t = 0; t < tris; t++) {
      let cx = 0;
      for (let k = 0; k < 3; k++) cx += _v.fromBufferAttribute(pos, at(t, k)).applyMatrix4(mm).x;
      sides[cx / 3 >= this.symmetryX ? 0 : 1].push(at(t, 0), at(t, 1), at(t, 2));
    }
    const getters = ['getX', 'getY', 'getZ', 'getW'];
    const parts = [];
    sides.forEach((list, s) => {
      if (!list.length) return;
      const remap = new Map(), order = [], newIndex = [];
      for (const i of list) {
        if (!remap.has(i)) { remap.set(i, order.length); order.push(i); }
        newIndex.push(remap.get(i));
      }
      const ng = new THREE.BufferGeometry();
      for (const [name, attr] of Object.entries(g.attributes)) {
        const arr = new Float32Array(order.length * attr.itemSize);
        order.forEach((o, n) => { for (let k = 0; k < attr.itemSize; k++) arr[n * attr.itemSize + k] = attr[getters[k]](o); });
        ng.setAttribute(name, new THREE.BufferAttribute(arr, attr.itemSize));
      }
      ng.setIndex(newIndex);
      ng.userData.owned = true;
      const m = new THREE.Mesh(ng, mesh.material);
      m.name = `${node.name}_${s === 0 ? 'L' : 'R'}`;
      m.position.copy(mesh.position); m.quaternion.copy(mesh.quaternion); m.scale.copy(mesh.scale);
      m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
      mesh.parent.add(m);
      parts.push(m);
    });
    mesh.parent.remove(mesh);
    this.content.updateMatrixWorld(true);
    return parts;
  }

  // -- wings ---------------------------------------------------------------

  _setupWings() {
    const cfg = this.config.wings;
    if (!cfg) { this.warn('no wing configuration'); return; }
    if (cfg.type === 'rigid') {
      const spread = { length: 1.5, thickness: 1, chord: 1.5, ...(cfg.spread || {}) };
      this.wingSpread = spread;
      const shoulderDir = this.config.shoulderDir || [0, 1, 0];
      for (const node of this._resolveNodes(cfg, 'wing')) {
        const pts = this._pointsOf(node);
        if (!pts.length) { this.warn(`wing node "${node.name}" has no mesh`); continue; }
        const meanX = pts.reduce((a, v, i) => a + (i % 3 === 0 ? v : 0), 0) / (pts.length / 3);
        const side = meanX - this.symmetryX >= 0 ? 1 : -1;
        const b = wingBasis(pts, side, shoulderDir);

        const U = new THREE.Vector3(...b.u), N = new THREE.Vector3(...b.n), F = new THREE.Vector3(...b.f);
        const basis = new THREE.Matrix4().makeBasis(U, N, F);
        const basisT = basis.clone().transpose();
        const S = new THREE.Vector3(side, 0, 0), Up = new THREE.Vector3(0, 1, 0);
        const target = new THREE.Matrix4().makeBasis(S, Up, new THREE.Vector3().crossVectors(S, Up));
        const rot = new THREE.Matrix4().multiplyMatrices(target, basisT);
        const rSpread = new THREE.Quaternion().setFromRotationMatrix(rot);

        const shoulderPos = new THREE.Vector3(...b.shoulder);
        if (cfg.rootOffset) shoulderPos.add(new THREE.Vector3(...cfg.rootOffset).multiply(new THREE.Vector3(side, 1, 1)));
        const shoulder = new THREE.Group();
        shoulder.name = `shoulder_${side > 0 ? 'L' : 'R'}`;
        shoulder.position.copy(shoulderPos);
        this.content.add(shoulder);
        const rel = this._relMatrix(node);
        shoulder.add(node);
        node.matrixAutoUpdate = false;
        node.matrix.copy(rel).premultiply(_m2.makeTranslation(-shoulderPos.x, -shoulderPos.y, -shoulderPos.z));

        node.traverse((m) => {
          if (m.isMesh) { m.material = m.material.clone(); m.material.side = THREE.DoubleSide; m.material.userData.owned = true; }
        });
        this.wings.push({ side, node, shoulder, rel, shoulderPos, basis, basisT, rSpread });
      }
      if (this.wings.length === 0) this.warn('no rigid wings could be bound; using body-bounce fallback');
    } else if (cfg.type === 'synthetic') {
      // The model has no separate wings (they are baked into the body mesh).
      // Build flat feathered wing plates that appear when the bird takes off.
      this.wingSpread = { length: 1, thickness: 1, chord: 1 };
      for (const side of [1, -1]) {
        const mesh = new THREE.Mesh(syntheticWingGeometry(cfg, side), new THREE.MeshStandardMaterial({
          vertexColors: true, roughness: 0.85, metalness: 0, side: THREE.DoubleSide
        }));
        mesh.castShadow = true;
        mesh.frustumCulled = false;
        mesh.visible = false;
        mesh.material.userData.owned = true;
        const shoulder = new THREE.Group();
        shoulder.name = `shoulder_${side > 0 ? 'L' : 'R'}`;
        shoulder.position.set(side * cfg.shoulder[0], cfg.shoulder[1], cfg.shoulder[2]);
        shoulder.add(mesh);
        this.content.add(shoulder);
        this.wings.push({ side, synthetic: true, node: mesh, shoulder, rSpread: new THREE.Quaternion() });
      }
    } else if (cfg.type === 'bones') {
      for (const side of ['left', 'right']) {
        for (const seg of cfg[side] || []) {
          const bone = findNode(this.object, seg.bone);
          if (!bone) { this.warn(`wing bone "${seg.bone}" not found`); continue; }
          this.wingChains[side].push({ ...seg, node: bone, rest: bone.quaternion.clone() });
        }
      }
    }
  }

  // -- legs ----------------------------------------------------------------

  _setupLegs() {
    const cfg = this.config.legs;
    if (!cfg || cfg.type !== 'rigid') return;
    for (const node of this._resolveNodes(cfg, 'leg')) {
      const pts = this._pointsOf(node);
      if (!pts.length) continue;
      let top = -Infinity, sx = 0, sz = 0;
      const n = pts.length / 3;
      for (let i = 0; i < n; i++) { top = Math.max(top, pts[i * 3 + 1]); sx += pts[i * 3]; sz += pts[i * 3 + 2]; }
      const hip = new THREE.Vector3(sx / n, top, sz / n);
      const hipGroup = new THREE.Group();
      hipGroup.position.copy(hip);
      this.content.add(hipGroup);
      const rel = this._relMatrix(node);
      hipGroup.add(node);
      node.matrixAutoUpdate = false;
      node.matrix.copy(rel).premultiply(_m2.makeTranslation(-hip.x, -hip.y, -hip.z));
      this.legs.push({ side: hip.x - this.symmetryX >= 0 ? 1 : -1, hip: hipGroup });
    }
  }

  // -- skeleton bones (neck, tail) -------------------------------------------

  _setupBones() {
    const bones = this.config.bones || {};
    const grab = (names, label) => (names || []).map((n) => {
      const node = findNode(this.object, n);
      if (!node) { this.warn(`${label} bone "${n}" not found`); return null; }
      const wq = node.getWorldQuaternion(new THREE.Quaternion()).invert();
      // The model's own lateral (X) and vertical (Y) axes expressed in this bone's local frame, so
      // nodding and turning work whatever orientation the exporter gave the joint.
      return { node, rest: node.quaternion.clone(), axX: AX.x.clone().applyQuaternion(wq), axY: AX.y.clone().applyQuaternion(wq) };
    });
    this.content.updateMatrixWorld(true);
    this.neck = grab(bones.neck, 'neck');
    this.tail = grab(bones.tail, 'tail');
    this._setupClip();
  }

  // -- the model's own animation clip (idle behaviour on the ground) ----------------

  _setupClip() {
    this.mixer = null;
    const want = this.config.idleClip;
    const clips = this.info.clips || [];
    if (!want || !clips.length) return;
    const clip = typeof want === 'string' ? clips.find((c) => c.name === want) : clips[0];
    if (!clip) { this.warn(`animation clip "${want}" not found`); return; }
    this.mixer = new THREE.AnimationMixer(this.object);
    this.clipAction = this.mixer.clipAction(clip);
    this.clipAction.play();
    this.clipActive = true;
  }

  /** Play the clip while `active` (on the ground); back to the bind pose otherwise. */
  updateClip(dt, active) {
    if (!this.mixer) return;
    if (active) {
      if (!this.clipActive) { this.clipAction.play(); this.clipActive = true; }
      this.mixer.update(dt);
    } else if (this.clipActive) {
      this.clipAction.stop();
      this.mixer.update(0);
      this.object.traverse((o) => { if (o.isSkinnedMesh) o.skeleton.pose(); });
      this.clipActive = false;
    }
  }

  // -- pose application ------------------------------------------------------

  /**
   * pose = {
   *   attitude, bobY, waddle,
   *   extend, dihedral, asym, twist, sweep,         // wings
   *   neckExtend, headPitch, headYaw,               // neck (extend: 0 perched S-curve .. 1 straight)
   *   tailPitch, tailYaw,
   *   legL, legR                                     // hip swing, radians
   * }
   */
  applyPose(p) {
    this.attitude.rotation.x = p.attitude;
    this.bob.position.y = p.bobY;
    this.bob.rotation.z = p.waddle;
    this._applyWings(p);
    this._applyNeck(p);
    this._applyTail(p);
    for (const leg of this.legs) leg.hip.rotation.x = leg.side > 0 ? p.legL : p.legR;
  }

  _applyWings(p) {
    const t = ease(clamp01(p.extend));
    if (this.wings.length) {
      _qInv.setFromAxisAngle(AX.x, -p.attitude);
      const sp = this.wingSpread;
      const sl = 1 + (sp.length - 1) * t, st = 1 + (sp.thickness - 1) * t, sc = 1 + (sp.chord - 1) * t;
      for (const w of this.wings) {
        const s = w.side;
        _qa.setFromAxisAngle(AX.y, s * p.sweep);
        _qb.setFromAxisAngle(AX.z, s * (p.dihedral + (s > 0 ? p.asym : -p.asym)));
        _qc.setFromAxisAngle(AX.x, s * p.twist);
        _qLevel.copy(_qInv).multiply(_qa).multiply(_qb).multiply(_qc).multiply(w.rSpread);
        if (w.synthetic) {
          w.node.visible = t > 0.04;
          w.shoulder.quaternion.copy(_qLevel);
          w.shoulder.scale.set(0.15 + 0.85 * t, 1, 1);          // fold by shortening the span
          continue;
        }
        w.shoulder.quaternion.copy(_ident).slerp(_qLevel, t);

        _m1.makeScale(sl, st, sc);
        _m2.copy(w.basis).multiply(_m1).multiply(w.basisT);        // stretch along the wing's own axes
        w.node.matrix.copy(w.rel)
          .premultiply(_m1.makeTranslation(-w.shoulderPos.x, -w.shoulderPos.y, -w.shoulderPos.z))
          .premultiply(_m2);
        w.node.matrixWorldNeedsUpdate = true;
      }
    } else if (!this.wingChains.left.length && !this.wingChains.right.length) {
      // No usable wings at all: bounce the whole body so flapping is still readable.
      this.bob.position.y += Math.sin(p.dihedral * 6) * 0.03 * t;
    }
    for (const side of ['left', 'right']) {
      const sign = side === 'left' ? 1 : (this.config.wings?.mirrorRight === false ? 1 : -1);
      for (const seg of this.wingChains[side]) {
        _qb.copy(seg.rest);
        if (seg.fold) _qb.multiply(_qa.setFromAxisAngle(AX[seg.fold[0]], seg.fold[1] * (1 - t) * sign));
        if (seg.flap) _qb.multiply(_qa.setFromAxisAngle(AX[seg.flap[0]], (p.dihedral + (side === 'left' ? p.asym : -p.asym)) * seg.flap[1] * sign));
        if (seg.twist) _qb.multiply(_qa.setFromAxisAngle(AX[seg.twist[0]], p.twist * seg.twist[1] * sign));
        seg.node.quaternion.copy(_qb);
      }
    }
  }

  _applyNeck(p) {
    if (!this.neck.length) return;
    const cfg = this.config.neck || {};
    const from = cfg.straightenFrom ?? this.neck.length;
    const pw = cfg.pitchWeights || [];
    const yw = cfg.yawWeights || [];
    this.neck.forEach((b, i) => {
      if (!b) return;
      _qb.copy(b.rest);
      if (i >= from) _qb.slerp(_ident, clamp01(p.neckExtend));
      if (pw[i]) _qb.multiply(_qa.setFromAxisAngle(b.axX, p.headPitch * pw[i]));
      if (yw[i]) _qb.multiply(_qa.setFromAxisAngle(b.axY, p.headYaw * yw[i]));
      b.node.quaternion.copy(_qb);
    });
  }

  _applyTail(p) {
    if (!this.tail.length) return;
    const cfg = this.config.tail || {};
    const pw = cfg.pitchWeights || [];
    const yw = cfg.yawWeights || [];
    this.tail.forEach((b, i) => {
      if (!b) return;
      _qb.copy(b.rest);
      if (pw[i]) _qb.multiply(_qa.setFromAxisAngle(b.axX, p.tailPitch * pw[i]));
      if (yw[i]) _qb.multiply(_qa.setFromAxisAngle(b.axY, p.tailYaw * yw[i]));
      b.node.quaternion.copy(_qb);
    });
  }

  dispose() {
    this.root.traverse((o) => {
      if (o.geometry?.userData.owned) o.geometry.dispose();
      for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) if (m.userData.owned) m.dispose();
    });
    this.mixer?.stopAllAction();
  }
}
