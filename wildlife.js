// NPC birds. Each NPC is a full bird (same model rig, flight physics and
// procedural animation as the player) driven by a small behaviour machine
// instead of a keyboard:
//
//   ground: idle, look around, peck, wander, flee when the player comes close
//   flight: take off, fly to a waypoint at a species-appropriate height, soar or flap,
//           then either pick another waypoint or land at a spot that suits its habitat
//   flocks: flocking and colonial species spawn in groups; followers copy their
//           leader's takeoff, waypoint and landing
//
// Predation: species with `predation` in speciesData.js (osprey, red-tailed hawk, kestrel)
// hunt birds light enough to carry. NPC hunters stalk and stoop on prey; NPC prey flee from
// any hunter (including the player when the player is a predator) by bolting, jinking and
// diving. Success depends on speed, a stoop, the prey being on the ground and its agility.
//
// Cost control: model files are downloaded lazily and shared, NPCs far from the
// player animate at a reduced rate, and NPCs very far away are hidden and then removed.

import { createBird, preloadBird } from './birdModel.js';
import { FlightController } from './flight.js';
import { BirdAnimator } from './animation.js';
import { SPECIES } from './speciesData.js';
import { getModelConfig } from './modelConfigs.js';
import { terrainHeight, biomeAt } from '/terrain.js';

const HABITAT = {
  rainforest: ['rainforest'],
  grassland: ['grassland', 'garden'],
  wetland: ['wetland', 'lakes'],
  coast: ['coast', 'wetland'],
  mountain: ['mountain'],
  urban: ['urban', 'garden'],
  water: ['lakes', 'coast', 'wetland']
};

/** Chance and outcome of a strike. Shared by NPC hunters and the player. */
export function huntSuccess(predator, prey, speed, diving) {
  const maxMass = predator.predation?.maxPreyMass ?? 0;
  if (prey.species.size.mass > maxMass) return { ok: false, reason: 'too heavy' };
  const grounded = prey.flight.mode === 'ground';
  let p = 0.32 + 0.012 * Math.min(25, Math.max(0, speed)) + (diving ? 0.2 : 0) + (grounded ? 0.25 : 0) - prey.species.flight.turnRate * 0.07;
  p = Math.min(0.9, Math.max(0.1, p));
  return { ok: Math.random() < p, p };
}

/** Can this predator take that bird? */
export function isPrey(predator, npc) {
  return !!predator.predation && !npc.species.predation && npc.species.size.mass <= predator.predation.maxPreyMass;
}

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const pick = (list) => list[Math.floor(Math.random() * list.length)];

class Npc {
  constructor(species, model, flight, animator) {
    this.species = species;
    this.model = model;
    this.flight = flight;
    this.animator = animator;
    this.view = { yaw: flight.yaw, pitch: 0 };
    this.inp = { moveX: 0, moveY: 0, flap: false, glide: false, boost: false, descend: false };
    this.edges = { land: false, interact: false, rest: false, flap: false, menu: false };
    this.timer = rand(1, 6);
    this.walkT = 0;
    this.walkYaw = flight.yaw;
    this.wp = null;                 // { x, z }
    this.targetAlt = 30;
    this.landing = false;
    this.flightTime = 0;
    this.leader = null;
    this.offset = { x: rand(-18, 18), z: rand(-18, 18) };
    this.followDelay = -1;
    this.accum = 0;
    this.fleeDist = clamp(7 + species.size.length * 9, 8, 24);
    this.dist = 0;
    this.hunt = null;               // { target, t } while stalking prey
    this.huntCooldown = rand(20, 70);
    this.searchT = rand(0, 1);
    this.fleeT = 0;
    this.fleeYaw = 0;
    this.seed = Math.random() * 10;
  }
}

export class Wildlife {
  /**
   * @param count   how many NPCs to keep around the player
   * @param exclude species ids never spawned as NPCs
   */
  constructor(scene, world, { count = 14, exclude = [] } = {}) {
    this.scene = scene;
    this.world = world;
    this.target = count;
    this.npcs = [];
    this.ids = Object.keys(SPECIES).filter((id) => !exclude.includes(id) && getModelConfig(id));
    this.loaded = new Set();
    this.loading = new Set();
    this.maxLoaded = 10;
    this.spawning = false;
    this.spawnTimer = 0;
    this.loadTimer = 0;
    this.failures = 0;
    this.player = { x: 0, y: 0, z: 0 };
    this.playerInfo = { predator: false, active: false };
    this.clock = 0;
  }

  get count() { return this.npcs.length; }

  // -- model loading --------------------------------------------------------------

  _loadSome() {
    if (this.loading.size > 0 || this.loaded.size >= this.maxLoaded) return;
    const todo = this.ids.filter((id) => !this.loaded.has(id));
    if (!todo.length) return;
    const id = pick(todo);
    this.loading.add(id);
    preloadBird(SPECIES[id], getModelConfig(id)).then((gltf) => {
      this.loading.delete(id);
      if (gltf) this.loaded.add(id);
      else this.ids = this.ids.filter((x) => x !== id);       // failed download: never try again
    });
  }

  // -- spawning -----------------------------------------------------------------------

  _tagsAt(x, z, h) {
    const slope = 0;
    return HABITAT[biomeAt(x, z, h, slope)] || [];
  }

  /** Find a spawn position and a loaded species that belongs there. */
  _chooseSpawn() {
    const relaxed = this.failures >= 3;
    const loaded = [...this.loaded];
    if (!loaded.length) return null;
    const counts = {};
    for (const n of this.npcs) counts[n.species.id] = (counts[n.species.id] || 0) + 1;
    for (let i = 0; i < 14; i++) {
      const ang = rand(0, Math.PI * 2), dist = rand(110, 420);
      const x = this.player.x + Math.cos(ang) * dist, z = this.player.z + Math.sin(ang) * dist;
      if (Math.hypot(x, z) > this.world.half - 150) continue;
      const h = terrainHeight(x, z);
      const tags = this._tagsAt(x, z, h);
      const fit = loaded.filter((id) => {
        const sp = SPECIES[id];
        if (h < -0.3 && !sp.ground.swims) return false;
        return relaxed ? h > -0.3 || sp.ground.swims : sp.habitat.some((t) => tags.includes(t));
      });
      // keep the mix varied: never more than a flock (or two loners) of one species, prefer the rarest
      const room = fit.filter((id) => (counts[id] || 0) < (['flocking', 'colonial'].includes(SPECIES[id].social) ? 5 : 2));
      if (!room.length) continue;
      const fewest = Math.min(...room.map((id) => counts[id] || 0));
      return { x, z, species: SPECIES[pick(room.filter((id) => (counts[id] || 0) === fewest))] };
    }
    return null;
  }

  async _spawnGroup() {
    this.spawning = true;
    try {
      const spot = this._chooseSpawn();
      if (!spot) { this.failures++; return; }
      this.failures = 0;
      const sp = spot.species;
      const social = sp.social === 'flocking' || sp.social === 'colonial';
      const size = social ? 3 + Math.floor(Math.random() * 3) : 1;
      let leader = null;
      for (let i = 0; i < size; i++) {
        const x = spot.x + rand(-6, 6), z = spot.z + rand(-6, 6);
        const npc = await this._makeNpc(sp, x, z);
        if (!npc) break;
        if (!leader) leader = npc; else npc.leader = leader;
      }
    } finally {
      this.spawning = false;
    }
  }

  async _makeNpc(sp, x, z) {
    const model = await createBird(sp, getModelConfig(sp.id));
    if (model.info.source !== 'glb') { model.dispose(); return null; }
    const flight = new FlightController(sp, model, this.world, { x, z });
    flight.yaw = rand(-Math.PI, Math.PI);
    const npc = new Npc(sp, model, flight, new BirdAnimator(model, sp));
    model.root.position.copy(flight.pos);
    this.scene.add(model.root);
    this.npcs.push(npc);
    return npc;
  }

  /** Remove an NPC from the simulation but keep its model alive (the player is carrying it). */
  release(npc) {
    this.scene.remove(npc.model.root);
    this.npcs = this.npcs.filter((n) => n !== npc);
    for (const n of this.npcs) { if (n.leader === npc) n.leader = null; if (n.hunt?.target === npc) n.hunt = null; }
    return npc;
  }

  kill(npc) { this._remove(npc); }

  _remove(npc) {
    this.scene.remove(npc.model.root);
    npc.model.dispose();
    this.npcs = this.npcs.filter((n) => n !== npc);
    for (const n of this.npcs) { if (n.leader === npc) n.leader = null; if (n.hunt?.target === npc) n.hunt = null; }
  }

  // -- behaviour -------------------------------------------------------------------------

  _waypoint(n, awayFromPlayer = false) {
    const f = n.flight, sp = n.species;
    const heading = awayFromPlayer ? Math.atan2(f.pos.x - this.player.x, f.pos.z - this.player.z) : f.yaw + rand(-1.4, 1.4);
    const dist = rand(150, 420);
    let x = f.pos.x + Math.sin(heading) * dist, z = f.pos.z + Math.cos(heading) * dist;
    const limit = this.world.half - 140, r = Math.hypot(x, z);
    if (r > limit) { x *= limit / r; z *= limit / r; }
    n.wp = { x, z };
    const style = sp.flight.style;
    n.targetAlt = style === 'soar' || style === 'glide' ? rand(50, 130)
      : style === 'dash' || style === 'hover' ? rand(5, 22) : rand(12, 45);
  }

  _landingSpot(n) {
    const f = n.flight, sp = n.species;
    for (let i = 0; i < 10; i++) {
      const ang = f.yaw + rand(-1.2, 1.2), dist = rand(70, 220);
      const x = f.pos.x + Math.sin(ang) * dist, z = f.pos.z + Math.cos(ang) * dist;
      if (Math.hypot(x, z) > this.world.half - 140) continue;
      const h = terrainHeight(x, z);
      const swimmer = sp.ground.swims;
      if (swimmer ? h < 0.4 && h > -6 : h > 1.5 && sp.habitat.some((t) => this._tagsAt(x, z, h).includes(t))) return { x, z };
    }
    return null;
  }

  _takeoff(n, awayFromPlayer) {
    n.edges.flap = true;
    n.landing = false;
    n.flightTime = 0;
    if (n.leader) this._followLeader(n); else this._waypoint(n, awayFromPlayer);
  }

  _followLeader(n) {
    const l = n.leader;
    if (!l.wp) return;
    n.wp = { x: l.wp.x + n.offset.x, z: l.wp.z + n.offset.z };
    n.targetAlt = l.targetAlt + rand(-4, 4);
    n.landing = l.landing;
  }

  _think(n, dt) {
    const f = n.flight, sp = n.species, inp = n.inp, ed = n.edges;
    inp.moveX = inp.moveY = 0; inp.flap = inp.glide = inp.boost = inp.descend = false;
    ed.land = ed.interact = ed.rest = ed.flap = false;
    const dxp = this.player.x - f.pos.x, dzp = this.player.z - f.pos.z;
    const dPlayer = Math.hypot(dxp, dzp);
    let scared = dPlayer < n.fleeDist;

    const threat = this._threatFor(n);
    if (threat) n.fleeT = 2.5; else n.fleeT = Math.max(0, n.fleeT - dt);
    if (threat || n.fleeT > 0) { this._flee(n, threat); return; }

    if (f.mode === 'flight' && sp.predation && this._hunt(n, dt)) return;
    if (n.hunt && f.mode !== 'flight') n.hunt = null;

    if (f.mode === 'ground') {
      n.timer -= dt;
      n.landing = false;
      if (sp.flight.flightless) {
        if (scared) { n.view.yaw = Math.atan2(-dxp, -dzp); inp.moveY = 1; inp.boost = true; }
        else this._wander(n, dt);
        return;
      }
      const leader = n.leader;
      if (scared) { this._takeoff(n, true); return; }
      if (leader) {
        if (leader.flight.mode !== 'ground') {
          if (n.followDelay < 0) n.followDelay = rand(0, 1.2);
          n.followDelay -= dt;
          if (n.followDelay <= 0) { n.followDelay = -1; this._takeoff(n, false); return; }
        }
        this._wander(n, dt);
        return;
      }
      if (n.timer <= 0 && Math.random() < 0.45 && !f.exhausted) { this._takeoff(n, false); return; }
      this._wander(n, dt);
      return;
    }

    // airborne
    if (!n.wp) this._waypoint(n);
    if (n.leader && n.leader.wp && f.mode === 'flight') this._followLeader(n);
    const dx = n.wp.x - f.pos.x, dz = n.wp.z - f.pos.z, d = Math.hypot(dx, dz);
    n.view.yaw = Math.atan2(dx, dz);
    const need = n.targetAlt - f.agl;
    n.view.pitch = clamp(need * 0.03, -0.35, 0.4);

    const soarer = sp.flight.style === 'soar' || sp.flight.style === 'glide';
    let flap = !soarer || need > 8 || f.speed < sp.flight.cruiseSpeed * 0.85;
    if (need < -8) flap = false;
    if (f.speed < sp.flight.cruiseSpeed * 0.9) n.view.pitch = Math.min(n.view.pitch, 0.08);   // build speed before climbing
    if (flap) { inp.moveY = 1; if (need > 4) inp.flap = true; }

    if (f.mode === 'takeoff') return;
    if (f.mode === 'landing') { n.view.pitch = 0; return; }

    n.flightTime += dt;
    if (f.exhausted && !n.landing) { n.landing = true; n.wp = this._landingSpot(n) || n.wp; }
    if (!n.landing && n.flightTime > 80) { n.landing = true; n.wp = this._landingSpot(n) || n.wp; }
    if (n.landing) {
      if (d < 80 + f.agl * 2.5) ed.land = true;
    } else if (d < 30 && !n.leader) {
      if (Math.random() < 0.5) {
        const spot = this._landingSpot(n);
        if (spot) { n.landing = true; n.wp = spot; } else this._waypoint(n);
      } else this._waypoint(n);
    }
    n.timer = rand(5, 14);
  }

  /** Nearest hunter that threatens this bird: the player (if a predator on the wing) or an NPC stalking it. */
  _threatFor(n) {
    const f = n.flight;
    const range = f.mode === 'ground' ? 45 : 75;
    let best = null;
    const consider = (x, y, z) => {
      const d = Math.hypot(x - f.pos.x, y - f.pos.y, z - f.pos.z);
      if (d < range && (!best || d < best.d)) best = { x, y, z, d };
    };
    if (this.playerInfo.predator && this.playerInfo.active && isPrey(this.playerInfo.species, n)) consider(this.player.x, this.player.y, this.player.z);
    for (const h of this.npcs) {
      if (h.hunt?.target === n) consider(h.flight.pos.x, h.flight.pos.y, h.flight.pos.z);
    }
    return best;
  }

  _flee(n, threat) {
    const f = n.flight, inp = n.inp;
    if (threat) n.fleeYaw = Math.atan2(f.pos.x - threat.x, f.pos.z - threat.z);
    if (f.mode === 'ground') {
      if (n.species.flight.flightless) {
        n.view.yaw = n.fleeYaw; inp.moveY = 1; inp.boost = true;
      } else {
        n.edges.flap = true;                       // bolt into the air
        n.landing = false;
        n.flightTime = 0;
        n.wp = { x: f.pos.x + Math.sin(n.fleeYaw) * 300, z: f.pos.z + Math.cos(n.fleeYaw) * 300 };
        n.targetAlt = rand(10, 40);
        n.view.yaw = n.fleeYaw;
      }
      return;
    }
    if (f.mode === 'landing') n.edges.land = true; // abort the landing
    n.view.yaw = n.fleeYaw + Math.sin(this.clock * 5 + n.seed) * 0.6;      // jink
    const above = threat && threat.y > f.pos.y + 3;
    n.view.pitch = above ? -0.3 : 0.05;
    inp.moveY = 1; inp.flap = true; inp.boost = !f.exhausted;
    n.landing = false;
    n.wp = { x: f.pos.x + Math.sin(n.fleeYaw) * 250, z: f.pos.z + Math.cos(n.fleeYaw) * 250 };
  }

  _findPrey(n) {
    const f = n.flight, sp = n.species;
    let best = null, bestD = 260;
    for (const o of this.npcs) {
      if (o === n || !isPrey(sp, o)) continue;
      if (this.npcs.some((h) => h !== n && h.hunt?.target === o)) continue;
      const d = Math.hypot(o.flight.pos.x - f.pos.x, o.flight.pos.y - f.pos.y, o.flight.pos.z - f.pos.z);
      if (d < bestD) { best = o; bestD = d; }
    }
    return best;
  }

  /** Stalk, stoop and strike. Returns true while the hunt owns the controls. */
  _hunt(n, dt) {
    const f = n.flight, sp = n.species, inp = n.inp;
    n.huntCooldown -= dt;
    if (!n.hunt) {
      if (n.huntCooldown > 0) return false;
      n.searchT -= dt;
      if (n.searchT > 0) return false;
      n.searchT = 1;
      const target = this._findPrey(n);
      if (target) n.hunt = { target, t: 0 };
      return !!n.hunt;
    }
    const h = n.hunt, t = h.target;
    h.t += dt;
    const dx = t.flight.pos.x - f.pos.x, dy = t.flight.pos.y - f.pos.y, dz = t.flight.pos.z - f.pos.z;
    const dh = Math.hypot(dx, dz), d3 = Math.hypot(dh, dy);
    if (h.t > 25 || f.exhausted || d3 > 450) { n.hunt = null; n.huntCooldown = 40; return false; }
    n.view.yaw = Math.atan2(dx, dz);
    n.view.pitch = clamp(Math.atan2(dy, Math.max(dh, 1)), -0.9, 0.5);
    inp.moveY = 1; inp.flap = true; inp.boost = d3 > 12;
    if (dy < -8 && dh < 80) inp.descend = true;                      // stoop
    const reach = 2 + 2 * (sp.size.length + t.species.size.length);
    if (d3 < reach) {
      const result = huntSuccess(sp, t, f.speed, inp.descend);
      n.hunt = null;
      if (result.ok) {
        this._remove(t);
        n.huntCooldown = rand(90, 170);
        n.landing = true;                                              // go and eat
        n.wp = this._landingSpot(n) || n.wp;
      } else {
        n.huntCooldown = 25;
        t.fleeT = 4;
      }
    }
    return true;
  }

  _wander(n, dt) {
    const inp = n.inp;
    if (n.walkT > 0) {
      n.walkT -= dt;
      n.view.yaw = n.walkYaw;
      inp.moveY = 1;
    } else if (n.timer <= 0) {
      n.walkYaw = rand(-Math.PI, Math.PI);
      n.walkT = rand(1.5, 4);
      n.timer = rand(3, 9);
      if (Math.random() < 0.3) { n.walkT = 0; n.edges.interact = true; }
    }
  }

  // -- per frame -----------------------------------------------------------------------------

  update(dt, playerPos, playerInfo = null) {
    this.player.x = playerPos.x; this.player.y = playerPos.y; this.player.z = playerPos.z;
    if (playerInfo) this.playerInfo = playerInfo;
    this.clock += dt;

    this.loadTimer -= dt;
    if (this.loadTimer <= 0) { this.loadTimer = 1.5; this._loadSome(); }
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && !this.spawning && this.npcs.length < this.target) {
      this.spawnTimer = 1.2;
      this._spawnGroup();
    }

    for (const n of [...this.npcs]) {
      const d = Math.hypot(n.flight.pos.x - this.player.x, n.flight.pos.z - this.player.z);
      n.dist = d;
      if (d > 680) { this._remove(n); continue; }
      this._think(n, dt);
      n.flight.update(dt, n.inp, n.view, n.edges);

      const visible = d < 520;
      n.model.root.visible = visible;
      if (!visible) continue;
      n.accum += dt;
      const step = d < 180 ? 0 : 1 / 20;
      if (n.accum >= step) {
        n.model.updateClip(n.accum, n.flight.mode === 'ground');
        n.animator.update(n.accum, n.flight.state);
        n.animator.apply();
        n.accum = 0;
      }
      n.model.root.position.copy(n.flight.pos);
      n.model.root.rotation.set(-n.flight.pitch, n.flight.yaw, n.flight.roll, 'YXZ');
    }
  }

  /** Closest NPC within maxDist metres, for the HUD field label. */
  nearest(maxDist = 120) {
    let best = null;
    for (const n of this.npcs) {
      if (n.dist < maxDist && (!best || n.dist < best.dist)) best = n;
    }
    return best ? { name: best.species.name, dist: best.dist, mode: best.flight.mode } : null;
  }
}
