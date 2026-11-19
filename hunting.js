// The player's side of the food chain: hunger, foraging, hunting other birds,
// carrying and eating prey, fishing, and experience.
//
//   Predators (species with `predation`) can strike NPC birds: line one up in the
//   target marker and press E within reach. A strike succeeds depending on your speed,
//   whether you are stooping, how agile the prey is and whether it is on the ground.
//   The kill is carried in your talons; land and press E to eat it, bite by bite.
//   Piscivores can press E while skimming low over water to dive for fish.
//   Everyone can peck at the ground for small amounts of food; predators get very little
//   from scraps, so they need to hunt.
//
// Progress is saved in localStorage for now. Stage 4 moves it to the server, because
// the client must not be trusted with progression.

import * as THREE from 'three';
import { huntSuccess, isPrey } from './wildlife.js';
import { terrainHeight } from '/terrain.js';

const STORE = 'aerona.progress.v1';
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const SCRAP_DIETS = new Set(['granivore', 'herbivore', 'omnivore', 'frugivore', 'insectivore', 'nectarivore']);

function loadStats() {
  try { return { xp: 0, kills: 0, fish: 0, meals: 0, bySpecies: {}, ...JSON.parse(localStorage.getItem(STORE) || '{}') }; }
  catch { return { xp: 0, kills: 0, fish: 0, meals: 0, bySpecies: {} }; }
}

export class Hunting {
  constructor(wildlife) {
    this.wildlife = wildlife;
    this.stats = loadStats();
    this.food = 80;
    this.target = null;          // { npc, dist, pos }
    this.carry = null;           // { npc, model, bites, mass }
    this.prompt = '';
    this.message = '';
    this.messageT = 0;
    this.strikeT = 0;
    this.cooldown = 0;
    this.prevAction = null;
    this.starveT = 0;
    this.bird = null;
    this._fwd = new THREE.Vector3();
  }

  get level() { return 1 + Math.floor(Math.sqrt(this.stats.xp / 40)); }
  get canHunt() { return !!this.bird?.species.predation; }

  setBird(species, model, flight) {
    this.dropCarry();
    this.bird = { species, model, flight };
    this.strikeT = 0;
    this.target = null;
  }

  say(text, seconds = 2.5) { this.message = text; this.messageT = seconds; }

  _addXp(n) {
    const before = this.level;
    this.stats.xp += n;
    if (this.level > before) this.say(`Level ${this.level}`, 3);
    this._save();
  }

  _save() { try { localStorage.setItem(STORE, JSON.stringify(this.stats)); } catch { /* storage unavailable */ } }

  dropCarry() {
    if (!this.carry) return;
    this.carry.model.root.removeFromParent();
    this.carry.model.dispose();
    this.carry = null;
  }

  // -- per frame, after the flight controller has updated ---------------------------------------

  update(dt, edges, view) {
    const { species: sp, model, flight } = this.bird;
    if (this.messageT > 0) { this.messageT -= dt; if (this.messageT <= 0) this.message = ''; }
    this.cooldown = Math.max(0, this.cooldown - dt);

    // hunger: slow drain, faster while flapping
    const drain = flight.mode === 'ground' ? 0.12 : 0.22 + flight.intensity * 0.25;
    this.food = clamp(this.food - drain * dt, 0, 100);
    flight.hungerFactor = this.food <= 0 ? 0.5 : 1;
    if (this.food <= 0) {
      this.starveT -= dt;
      if (this.starveT <= 0) { this.say('Starving: hunt or forage', 3); this.starveT = 20; }
    }

    // pecking on the ground: forage, or take a bite of carried prey
    const action = flight.action;
    if (action === 'peck' && this.prevAction !== 'peck') this._onPeck(sp);
    this.prevAction = action;

    const flying = flight.mode === 'flight' || flight.mode === 'takeoff';
    this._findTarget(view, flight, sp, flying);

    if (flying && edges.interact) this._onInteractInAir(sp, flight);

    if (this.strikeT > 0) this._resolveStrike(dt, flight, sp);
    flight.striking = this.strikeT > 0;

    this._prompt(flight, sp, flying);
  }

  // -- targets --------------------------------------------------------------------------------

  _findTarget(view, flight, sp, flying) {
    this.target = null;
    if (!sp.predation || !flying || this.carry) return;
    const cp = Math.cos(view.pitch);
    const fwd = this._fwd.set(cp * Math.sin(view.yaw), Math.sin(view.pitch), cp * Math.cos(view.yaw));
    let bestScore = Infinity;
    for (const n of this.wildlife.npcs) {
      if (!isPrey(sp, n)) continue;
      const dx = n.flight.pos.x - flight.pos.x, dy = n.flight.pos.y - flight.pos.y, dz = n.flight.pos.z - flight.pos.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > 160 || d < 0.5) continue;
      const dot = (dx * fwd.x + dy * fwd.y + dz * fwd.z) / d;
      if (dot < 0.82) continue;                                // roughly 35 degrees either side of where you look
      const score = d * (2 - dot);
      if (score < bestScore) { bestScore = score; this.target = { npc: n, dist: d, pos: n.flight.pos }; }
    }
  }

  // -- strikes and fishing -----------------------------------------------------------------------

  _onInteractInAir(sp, flight) {
    if (this.cooldown > 0 || flight.mode !== 'flight') return;
    if (sp.predation && !this.carry) {
      this.strikeT = 1.1;
      this.cooldown = 2.6;
      this.say('Talons out', 1);
      return;
    }
    if (sp.diet === 'piscivore' && !this.carry) {
      const overWater = terrainHeight(flight.pos.x, flight.pos.z) < 0;
      if (overWater && flight.agl < 5 && flight.speed > 5) {
        this.cooldown = 3;
        if (Math.random() < 0.45) {
          this.food = clamp(this.food + 30, 0, 100);
          this.stats.fish++;
          this._addXp(12);
          this.say('Caught a fish');
        } else this.say('The fish got away');
      } else this.say('Skim low over water to fish', 2);
    }
  }

  _resolveStrike(dt, flight, sp) {
    this.strikeT -= dt;
    const cp = Math.cos(flight.pitch);
    const fx = Math.sin(flight.yaw) * cp, fy = Math.sin(flight.pitch), fz = Math.cos(flight.yaw) * cp;
    for (const n of this.wildlife.npcs) {
      if (!isPrey(sp, n)) continue;
      const dx = n.flight.pos.x - flight.pos.x, dy = n.flight.pos.y - flight.pos.y, dz = n.flight.pos.z - flight.pos.z;
      const d = Math.hypot(dx, dy, dz);
      const reach = 2 + 2 * (sp.size.length + n.species.size.length);
      if (d > reach || (dx * fx + dy * fy + dz * fz) < -0.2 * d) continue;
      this.strikeT = 0;
      const diving = flight.dive || flight.pitch < -0.4;
      const result = huntSuccess(sp, n, flight.speed, diving);
      if (result.ok) this._grab(n);
      else {
        n.fleeT = 4;
        this.say(result.reason === 'too heavy' ? `${n.species.name} is too heavy` : 'Missed', 2);
      }
      return;
    }
    if (this.strikeT <= 0) this.say('Nothing in reach', 1.5);
  }

  _grab(npc) {
    const { model, species } = this.bird;
    this.wildlife.release(npc);
    const prey = npc.model;
    prey.root.visible = true;
    prey.root.position.set(0, -species.size.length * 0.45, species.size.length * 0.2);
    prey.root.rotation.set(0.9, 0, 0);
    model.root.add(prey.root);
    this.carry = { npc, model: prey, bites: 4, mass: npc.species.size.mass };
    this.stats.kills++;
    this.stats.bySpecies[npc.species.id] = (this.stats.bySpecies[npc.species.id] || 0) + 1;
    this._addXp(15 + Math.round(200 * npc.species.size.mass));
    const name = npc.species.name;
    this.say(`Caught ${/^[AEIOU]/i.test(name) ? 'an' : 'a'} ${name}. Land and press E to eat`, 4);
  }

  // -- eating and foraging -------------------------------------------------------------------------

  _onPeck(sp) {
    if (this.carry) {
      const total = 15 + 85 * clamp(this.carry.mass / (0.25 * sp.size.mass), 0, 1);
      this.food = clamp(this.food + total / 4, 0, 100);
      this.carry.bites--;
      this.carry.model.root.scale.multiplyScalar(0.8);
      if (this.carry.bites <= 0) {
        this.dropCarry();
        this.stats.meals++;
        this._addXp(6);
        this.say('Meal finished');
      }
      return;
    }
    const gain = SCRAP_DIETS.has(sp.diet) ? 5 : 1;
    this.food = clamp(this.food + gain, 0, 100);
  }

  _prompt(flight, sp, flying) {
    if (this.carry && flight.mode === 'ground') this.prompt = `E: eat (${this.carry.bites} bites left)`;
    else if (this.carry) this.prompt = 'Land to eat your catch';
    else if (flying && this.target) this.prompt = this.target.dist < 30 ? `E: strike ${this.target.npc.species.name}` : `Prey: ${this.target.npc.species.name}`;
    else if (flying && sp.diet === 'piscivore' && flight.agl < 5 && terrainHeight(flight.pos.x, flight.pos.z) < 0) this.prompt = 'E: dive for fish';
    else this.prompt = '';
  }
}
