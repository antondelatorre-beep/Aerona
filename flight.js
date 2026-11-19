// Movement for the player's bird: walking on the ground, taking off, flying,
// gliding, diving and landing.
//
// The flight model is a compact energy model rather than a full rigid body:
//   * `speed` is airspeed along the bird's heading and changes through
//       thrust (flapping) - drag - gravity * sin(pitch)
//   * lift cancels weight at cruiseSpeed; slower than stallSpeed the bird mushes
//     downwards and its nose drops
//   * drag is chosen so a glide settles at atan(1 / glideRatio) below the horizon,
//     and the controller trims the pitch so an un-flapped bird holds cruise speed
//   * turning is coordinated: yaw rate comes from bank, limited by g-load
// Every number comes from speciesData.js, so eagles soar, falcons stoop,
// hummingbirds hover and albatrosses glide for hours.

import * as THREE from 'three';
import { GRAVITY as G } from '/constants.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (cur, target, lambda, dt) => cur + (target - cur) * (1 - Math.exp(-lambda * dt));
const wrap = (a) => ((((a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;

export class FlightController {
  constructor(species, model, world, spawn) {
    this.species = species;
    this.f = species.flight;
    this.g = species.ground;
    this.world = world;
    this.lift = model.groundLift;           // pivot height above the soles of the feet

    const gh = world.groundHeight(spawn.x, spawn.z);
    this.pos = new THREE.Vector3(spawn.x, gh + this.lift, spawn.z);
    this.yaw = 0;
    this.pitch = 0;
    this.roll = 0;
    this.yawRate = 0;
    this.mode = 'ground';           // ground | takeoff | flight | landing
    this.speed = 0;                 // airspeed
    this.groundSpeed = 0;
    this.vy = 0;
    this.vyExtra = 0;
    this.vyHover = 0;
    this.vyLand = 0;
    this.intensity = 0;
    this.stamina = this.f.stamina;
    this.exhausted = false;
    this.takeoffT = 0;
    this.agl = 0;
    this.action = null;
    this.actionT = 0;
    this.resting = false;
    this.dive = false;
    this.brake = false;
    this.message = '';
    this.messageT = 0;
    this.striking = false;          // talons out (set by the hunting system)
    this.hungerFactor = 1;          // < 1 slows stamina recovery when starving
    this.time = 0;
    this.state = this._snapshot();
  }

  /** Continue from another controller's position and motion (used when the player switches species). */
  inherit(prev) {
    const f = this.f;
    this.yaw = prev.yaw;
    this.pos.x = prev.pos.x;
    this.pos.z = prev.pos.z;
    if (prev.mode === 'ground') {
      this.pos.y = this.world.groundHeight(prev.pos.x, prev.pos.z) + this.lift;
      return;
    }
    const gh = this.world.groundHeight(prev.pos.x, prev.pos.z);
    this.mode = 'flight';
    this.pos.y = Math.max(gh + this.lift + prev.agl, gh + this.lift + 2);
    this.speed = Math.min(Math.max(prev.speed, f.stallSpeed * 1.1), f.maxSpeed);
    this.pitch = prev.pitch;
  }

  teleport(x, z, y = null) {
    const gh = this.world.groundHeight(x, z);
    this.pos.set(x, y ?? gh + this.lift, z);
  }

  say(text, seconds = 2.5) { this.message = text; this.messageT = seconds; }

  update(dt, inp, view, edges) {
    this.time += dt;
    if (this.messageT > 0) { this.messageT -= dt; if (this.messageT <= 0) this.message = ''; }
    if (this.mode === 'ground') this._ground(dt, inp, view, edges);
    else this._air(dt, inp, view, edges);
    this._bounds();
    const gh = this.world.groundHeight(this.pos.x, this.pos.z);
    this.agl = Math.max(0, this.pos.y - this.lift - gh);
    this.state = this._snapshot();
    return this.state;
  }

  // -------------------------------------------------------------------------
  // Ground
  // -------------------------------------------------------------------------

  _ground(dt, inp, view, edges) {
    const g = this.g, world = this.world;
    if (edges.rest && !this.action) { this.resting = !this.resting; this.say(this.resting ? 'Resting' : ''); }

    if (edges.interact && !this.action) {
      const ahead = (d) => world.terrainHeight(this.pos.x + Math.sin(this.yaw) * d, this.pos.z + Math.cos(this.yaw) * d);
      const nearWater = world.terrainHeight(this.pos.x, this.pos.z) < 0.4 || ahead(1.2) < 0.3 || ahead(2.5) < 0.1;
      this.action = nearWater ? 'drink' : 'peck';
      this.actionT = 0;
      this.resting = false;
    }
    if (this.action) {
      this.actionT += dt / (this.action === 'drink' ? 2.4 : 1.6);
      if (this.actionT >= 1) { this.action = null; this.actionT = 0; }
    }

    const mag = Math.hypot(inp.moveX, inp.moveY);
    const moving = mag > 0.1 && !this.action;
    if (moving) this.resting = false;

    if ((edges.land || edges.flap) && !this.action) {
      if (this.f.flightless) this.say('This bird cannot fly. Hold Shift to run.', 2);
      else if (!this.exhausted) { this._startTakeoff(); return; }
    }

    if (moving) {
      const target = view.yaw + Math.atan2(-inp.moveX, inp.moveY);
      const diff = wrap(target - this.yaw);
      this.yaw = wrap(this.yaw + clamp(diff, -g.turnRate * dt, g.turnRate * dt));
      const alignment = clamp(1 - Math.abs(diff) / 1.6, 0.15, 1);
      const top = inp.boost ? g.run : g.walk;
      this.groundSpeed = damp(this.groundSpeed, top * Math.min(1, mag) * alignment, 6, dt);
    } else {
      this.groundSpeed = damp(this.groundSpeed, 0, this.action ? 12 : 5, dt);
      if (this.groundSpeed < 0.02) this.groundSpeed = 0;
    }

    if (this.groundSpeed > 0) {
      const nx = this.pos.x + Math.sin(this.yaw) * this.groundSpeed * dt;
      const nz = this.pos.z + Math.cos(this.yaw) * this.groundSpeed * dt;
      const deep = world.terrainHeight(nx, nz) < -0.6;
      if (deep && !g.swims) { this.groundSpeed = 0; this.say('Water is too deep to wade. Take off with F or Space.', 1.5); }
      else { this.pos.x = nx; this.pos.z = nz; }
    }

    const gh = world.groundHeight(this.pos.x, this.pos.z);
    this.pos.y = damp(this.pos.y, gh + this.lift, 30, dt);

    // lean with the slope
    const d = 0.5;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const slope = (world.groundHeight(this.pos.x + fx * d, this.pos.z + fz * d) - world.groundHeight(this.pos.x - fx * d, this.pos.z - fz * d)) / (2 * d);
    this.pitch = damp(this.pitch, clamp(Math.atan(slope) * 0.7, -0.5, 0.5), 8, dt);
    this.roll = damp(this.roll, 0, 8, dt);
    this.speed = 0;
    this.intensity = damp(this.intensity, 0, 8, dt);
    this.vy = 0;

    const regen = this.resting ? this.f.staminaRegen * 4 : this.f.staminaRegen * 2.2;
    this._regen(dt, regen);
  }

  _startTakeoff() {
    const f = this.f;
    this.mode = 'takeoff';
    this.takeoffT = 0;
    this.speed = Math.max(this.groundSpeed, f.stallSpeed * 0.5);
    this.vyExtra = Math.max(3, f.stallSpeed * 0.5);
    this.vyHover = 0;
    this.resting = false;
    this.action = null;
    this.stamina = Math.max(0, this.stamina - 5);
    this.say('');
  }

  // -------------------------------------------------------------------------
  // Air: takeoff, flight, landing
  // -------------------------------------------------------------------------

  _air(dt, inp, view, edges) {
    const f = this.f, world = this.world;
    const takeoff = this.mode === 'takeoff';
    let landing = this.mode === 'landing';

    if (edges.land) {
      if (this.mode === 'flight') { this.mode = 'landing'; landing = true; this.say('Landing: hold course and flare', 2); }
      else if (landing) { this.mode = 'flight'; landing = false; }
    }
    if (landing && (inp.flap || edges.flap) && !this.exhausted) { this.mode = 'flight'; landing = false; }

    if (takeoff) {
      this.takeoffT += dt;
      if ((this.takeoffT > 1 && this.speed >= f.stallSpeed * 0.95 && this.agl > 1.5) || this.takeoffT > 2.4) this.mode = 'flight';
    }

    // --- steering: the bird turns towards where the camera looks -------------------
    const dyaw = wrap(view.yaw - this.yaw);
    const maxTurn = Math.min(f.turnRate, (G * Math.tan(f.maxBank) * 0.9) / Math.max(this.speed, 4));
    const yawTarget = clamp(dyaw * 3, -maxTurn, maxTurn);
    this.yawRate = damp(this.yawRate, yawTarget, 7, dt);
    this.yaw = wrap(this.yaw + this.yawRate * dt);
    const rollTarget = clamp(-Math.atan((this.yawRate * Math.max(this.speed, 3)) / G) * f.bankGain, -f.maxBank, f.maxBank);
    this.roll = damp(this.roll, rollTarget, 6, dt);

    // --- flapping effort and stamina ---------------------------------------------------
    const boost = inp.boost && !this.exhausted && !inp.glide;
    let want = 0;
    if (inp.flap) want = 1;
    else if (inp.moveY > 0.1) want = 0.55 * inp.moveY;
    if (boost) want = Math.max(want, 0.6);
    if (inp.glide) want = 0;
    if (takeoff) want = 1;
    if (landing) want = this.speed < f.stallSpeed * 1.15 ? 0.25 : 0;
    if (this.exhausted) want = Math.min(want, 0.2);
    this.intensity = damp(this.intensity, want, 6, dt);

    this.stamina -= f.staminaDrain * this.intensity * (boost ? 1.5 : 1) * dt;
    if (this.intensity < 0.15) this._regen(dt, f.staminaRegen * 0.5);
    if (this.stamina <= 0) { this.stamina = 0; if (!this.exhausted) { this.exhausted = true; this.say('Exhausted: glide to recover', 3); } }

    this.brake = inp.moveY < -0.2 && !landing;
    this.dive = !!inp.descend && !landing;

    // --- pitch -------------------------------------------------------------------------------
    const glideAngle = Math.atan(1 / f.glideRatio);
    let pitchTarget = clamp(view.pitch, -1.2, 1.1);
    pitchTarget -= glideAngle * (1 - clamp01(this.intensity * 2));       // trim: an un-flapped glide holds cruise speed
    if (this.dive) pitchTarget = Math.min(pitchTarget - 0.5, -0.2);
    if (takeoff) pitchTarget = Math.max(pitchTarget, 0.35);
    if (!f.hover && !takeoff && !landing && this.speed < f.stallSpeed) {
      pitchTarget -= (1 - this.speed / f.stallSpeed) * 0.9;               // stall: nose drops
    }
    if (landing) {
      pitchTarget = this.agl < 4 ? lerp(0.1, 0.5, 1 - this.agl / 4) : clamp(view.pitch, -0.3, 0.1) - 0.05;
    }
    const maxRate = f.pitchRate * dt;
    this.pitch += clamp((pitchTarget - this.pitch) * 4 * dt, -maxRate, maxRate);

    // --- speed -------------------------------------------------------------------------------
    if (landing) {
      const approach = lerp(f.stallSpeed * 0.55, f.stallSpeed * 1.15, clamp01(this.agl / 25));
      this.speed = damp(this.speed, approach, 1.6, dt);
    } else {
      const sq = (v) => v * v;
      let drag = (G / f.glideRatio) * sq(this.speed / f.cruiseSpeed);
      if (this.brake) drag *= 2.5;
      if (this.dive) drag *= 0.75;
      const stoop = this.pitch < -0.35;
      const cap = stoop ? f.diveSpeed : f.maxSpeed * (boost ? 1.12 : 1);
      const over = Math.max(0, this.speed - cap);
      const thrust = takeoff ? Math.max(f.flapThrust * 1.8, 5) : f.flapThrust * this.intensity * (boost ? 1.5 : 1);
      this.speed += (thrust - drag - over * over * 0.35 - G * Math.sin(this.pitch)) * dt;
      this.speed = clamp(this.speed, 0, f.diveSpeed * 1.15);
    }

    // --- velocity ------------------------------------------------------------------------------
    let vy = this.speed * Math.sin(this.pitch);
    const vh = this.speed * Math.cos(this.pitch);
    const sinkFlapping = clamp01(this.intensity * 2.5);

    if (f.hover) {
      const hoverTarget = inp.flap ? 3.5 : inp.descend ? -3.5 : 0;
      this.vyHover = damp(this.vyHover, hoverTarget, 5, dt);
      vy += this.vyHover - (1 - sinkFlapping) * 4.5 * (this.speed < 3 ? 1 : 0.3);
    } else if (!takeoff && !landing && this.speed < f.stallSpeed) {
      const k = 1 - this.speed / f.stallSpeed;
      vy -= k * k * 14;
    }
    if (!landing) vy += world.updraft(this.pos.x, this.pos.z, this.time) * f.soaring * (1 - clamp01(this.intensity * 2));
    if (takeoff) { vy += this.vyExtra; this.vyExtra = Math.max(0, this.vyExtra - 3 * dt); }
    if (landing) {
      const target = -clamp(this.agl * 0.45, 0.35, 4.5);
      this.vyLand = damp(this.vyLand || vy, target, 3, dt);
      vy = this.vyLand;
    } else {
      this.vyLand = 0;
    }
    this.vy = vy;

    const wind = world.wind;
    this.pos.x += (Math.sin(this.yaw) * vh + wind.x * 0.5) * dt;
    this.pos.z += (Math.cos(this.yaw) * vh + wind.z * 0.5) * dt;
    this.pos.y = Math.min(this.pos.y + vy * dt, 1800);

    // --- ground contact ------------------------------------------------------------------------
    const gh = world.groundHeight(this.pos.x, this.pos.z);
    const floorY = gh + this.lift;
    if (this.pos.y <= floorY) {
      this.pos.y = floorY;
      if (!takeoff || this.vy < -0.5) this._touchdown(vh);
    }
  }

  _touchdown(horizontalSpeed) {
    const hard = -this.vy > 9;
    const wasLanding = this.mode === 'landing';
    this.groundSpeed = horizontalSpeed * (hard ? 0.2 : wasLanding ? 0.9 : 0.5);
    if (hard) { this.stamina = Math.max(0, this.stamina - 12); this.say('Hard landing'); }
    else if (!wasLanding && horizontalSpeed > this.f.stallSpeed * 1.5) this.say('Scraped the ground: use F to land');
    this.mode = 'ground';
    this.speed = 0;
    this.pitch = 0;
    this.roll = 0;
    this.vy = 0;
    this.intensity = 0;
    this.takeoffT = 0;
    this.exhausted = this.exhausted && this.stamina < 20;
  }

  _regen(dt, rate) {
    this.stamina = Math.min(this.f.stamina, this.stamina + rate * this.hungerFactor * dt);
    if (this.exhausted && this.stamina > 25) this.exhausted = false;
  }

  _bounds() {
    const limit = this.world.half - 60;
    const r = Math.hypot(this.pos.x, this.pos.z);
    if (r > limit) {
      const k = limit / r;
      this.pos.x *= k;
      this.pos.z *= k;
      this.say('Edge of the world: turn back', 1.5);
    }
  }

  _snapshot() {
    const flying = this.mode !== 'ground';
    return {
      mode: this.mode,
      speed: flying ? this.speed : this.groundSpeed,
      airspeed: this.speed,
      groundSpeed: this.groundSpeed,
      intensity: this.intensity,
      dive: this.dive && flying,
      striking: this.striking,
      brake: this.brake && flying,
      pitch: this.pitch,
      roll: this.roll,
      yawRate: this.yawRate,
      yaw: this.yaw,
      vy: this.vy,
      agl: this.agl,
      action: this.action,
      actionT: this.actionT,
      resting: this.resting,
      stamina: this.stamina,
      staminaMax: this.f.stamina,
      exhausted: this.exhausted,
      message: this.message
    };
  }
}
