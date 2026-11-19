// AERONA: THE LIVING WORLD, Stage 1 entry point.
// Wires the world, one playable bird, flight, animation, camera, input, HUD.

import * as THREE from 'three';
import { World, qualityPreset } from './world.js';
import { createBird } from './birdModel.js';
import { BirdAnimator } from './animation.js';
import { FlightController } from './flight.js';
import { ChaseCamera } from './camera.js';
import { Input } from './input.js';
import { MobileControls, isTouchDevice } from './mobileControls.js';
import { getSpecies, SPECIES, GROUPS } from './speciesData.js';
import { getModelConfig } from './modelConfigs.js';
import { Hud } from './hud.js';
import { Wildlife } from './wildlife.js';
import { Hunting } from './hunting.js';
import { findSpawn } from '/terrain.js';

const params = new URLSearchParams(location.search);
const touch = isTouchDevice();
const quality = params.get('quality') || (touch ? 'low' : 'medium');
const species = getSpecies(params.get('species'));


const hud = new Hud();

async function boot() {
  const canvas = document.getElementById('view');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !touch, powerPreference: 'high-performance' });
  const preset = qualityPreset(quality);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, preset.pixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.15, 12000);
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  hud.setLoading('Raising the terrain', 0);
  const spawn = findSpawn();
  const world = new World(scene, renderer, quality);
  await world.prime(new THREE.Vector3(spawn.x, spawn.y, spawn.z), (f) => hud.setLoading('Raising the terrain', f * 0.7));

  const available = await fetchModelList();
  const statusOf = (sp) => {
    const cfg = getModelConfig(sp.id);
    if (!available) return cfg ? 'model' : 'standin';        // no listing endpoint: trust the configs
    return available.has(cfg ? cfg.path.split('/').pop() : `${sp.id}.glb`) ? 'model' : 'standin';
  };
  const roster = Object.entries(GROUPS).map(([key, g]) => ({
    label: g.label,
    items: Object.values(SPECIES).filter((sp) => sp.group === key).map((sp) => ({ id: sp.id, name: sp.name, status: statusOf(sp) }))
  })).filter((g) => g.items.length);

  const input = new Input(canvas);
  const mobile = touch ? new MobileControls(input) : null;
  const chase = new ChaseCamera(camera, species);
  let current = null;          // { species, model, flight, animator }
  let hunting = null;

  async function useSpecies(id, onProgress) {
    const sp = getSpecies(id);
    const cfg = getModelConfig(sp.id);
    const auto = !cfg && available?.has(`${sp.id}.glb`) ? `/${sp.id}.glb` : null;
    const model = await createBird(sp, cfg, onProgress, auto);
    const flight = new FlightController(sp, model, world, spawn);
    if (current) {
      flight.inherit(current.flight);
      scene.remove(current.model.root);
      current.model.dispose();
    }
    scene.add(model.root);
    current = { species: sp, model, flight, animator: new BirdAnimator(model, sp) };
    chase.setSpecies(sp);
    hunting?.setBird(sp, model, flight);
    if (!window.aerona) window.aerona = {};
    Object.assign(window.aerona, { world, model, flight, animator: current.animator, species: sp, camera: chase });
    const url = new URL(location.href);
    url.searchParams.set('species', sp.id);
    history.replaceState(null, '', url);
    return model;
  }

  const noticeFor = (model, sp) => {
    if (model.info.source === 'placeholder') {
      return model.info.reason === 'load-failed'
        ? `Could not load ${model.info.path}. Using a stand-in bird. Check the file path and see the README.`
        : `No 3D model for the ${sp.name} yet. This stand-in flies with its real characteristics. Drop ${sp.id}.glb next to main.js to use a model.`;
    }
    return model.info.auto ? 'This model was configured automatically. Check the browser console for the draft config to refine.' : '';
  };

  hud.setLoading(`Loading ${species.name}`, 0.7);
  await useSpecies(species.id, (f) => hud.setLoading(`Loading ${species.name}`, 0.7 + f * 0.3));
  chase.yaw = current.flight.yaw;

  let playing = false;
  let started = false;
  const setPlaying = (value) => {
    playing = value;
    input.enabled = value;
    if (!value) input.reset();
    hud.showMenu(!value, started);
    mobile?.show(value);
  };
  const begin = () => {
    started = true;
    setPlaying(true);
    if (!touch && canvas.requestPointerLock) { try { canvas.requestPointerLock(); } catch { /* ignore */ } }
  };
  const showMenu = (notice) => hud.setupMenu({
    species: current.species, notice, onStart: begin, roster,
    onPick: async (id) => {
      if (id === current.species.id) return;
      hud.setBusy(`Loading ${getSpecies(id).name}`);
      const model = await useSpecies(id);
      showMenu(noticeFor(model, current.species));
    }
  });
  input.onMenuKey = () => setPlaying(!playing);
  input.onPointerLockChange = (locked) => { if (!locked && playing && !touch) setPlaying(false); };

  showMenu(noticeFor(current.model, current.species));
  hud.hideLoading();
  setPlaying(false);

  const wildlife = new Wildlife(scene, world, { count: preset.npcs });
  hunting = new Hunting(wildlife);
  hunting.setBird(current.species, current.model, current.flight);
  Object.assign(window.aerona, { wildlife, hunting });
  const ndc = new THREE.Vector3();

  const clock = new THREE.Clock();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    const { flight, animator, model } = current;
    if (playing) {
      const look = input.takeLook();
      chase.look(look.x, look.y);
      const inp = input.state();
      if (flight.mode !== 'ground') chase.yaw -= inp.moveX * 1.6 * dt;
      const edges = input.takeEdges();
      flight.update(dt, inp, { yaw: chase.yaw, pitch: chase.pitch }, edges);
      hunting.update(dt, edges, { yaw: chase.yaw, pitch: chase.pitch });
    }
    model.updateClip(dt, flight.mode === 'ground');
    animator.update(dt, flight.state);
    animator.apply();
    model.root.position.copy(flight.pos);
    euler.set(-flight.pitch, flight.yaw, flight.roll);
    model.root.quaternion.setFromEuler(euler);
    model.root.updateMatrixWorld(true);

    world.update(dt, flight.pos);
    wildlife.update(dt, flight.pos, { predator: !!current.species.predation, active: flight.mode !== 'ground', species: current.species });
    chase.update(dt, flight.pos, flight.state.speed, world);
    hud.update(dt, flight, world, wildlife, hunting);
    if (hunting.target && playing) {
      ndc.copy(hunting.target.pos).project(camera);
      hud.setTarget(ndc.z < 1 ? { x: (ndc.x * 0.5 + 0.5) * window.innerWidth, y: (-ndc.y * 0.5 + 0.5) * window.innerHeight, label: `${hunting.target.npc.species.name}, ${Math.round(hunting.target.dist)} m` } : null);
    } else hud.setTarget(null);
    renderer.render(scene, camera);
  });
}

async function fetchModelList() {
  try {
    const res = await fetch('/api/models');
    if (!res.ok) return null;
    return new Set((await res.json()).birds);
  } catch { return null; }
}

boot().catch((err) => {
  console.error(err);
  hud.fatal(`Startup failed: ${err.message}. WebGL 2 is required.`);
});
