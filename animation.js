// Procedural animation. Turns the flight controller's state into a "pose"
// (wing spread, flap angle, neck, tail, legs...) and hands it to the BirdModel,
// which applies it to whatever skeleton or rigid parts that model has.
//
// All motion is smoothed with exponential damping and uses delta time. Each
// species has its own numbers in speciesData.anim, so a hummingbird does not
// flap like an eagle and a kingfisher does not glide like an albatross.

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (cur, target, lambda, dt) => cur + (target - cur) * (1 - Math.exp(-lambda * dt));

export class BirdAnimator {
  constructor(model, species) {
    this.model = model;
    this.species = species;
    this.a = { ...species.anim, ...(model.config.animation || {}) };
    this.flightPitch = model.config.flightPitch || 0;

    this.t = 0;
    this.phase = Math.random() * TAU;   // wing-beat phase
    this.stride = 0;                    // walking phase
    this.flightBlend = 0;               // 0 on the ground, 1 in the air
    this.spread = 0;                    // wing deployment, damped
    this.flapAmt = 0;
    this.diveAmt = 0;
    this.restBlend = 0;
    this.speedFlare = 0;

    this.lookTimer = 1.5;
    this.look = { yaw: 0, pitch: 0 };
    this.head = { yaw: 0, pitch: 0 };
    this.preenT = -1;

    this.pose = {
      attitude: 0, bobY: 0, waddle: 0,
      extend: 0, dihedral: 0, asym: 0, twist: 0, sweep: 0,
      neckExtend: 0, headPitch: 0, headYaw: 0,
      tailPitch: 0, tailYaw: 0, legL: 0, legR: 0
    };
  }

  /**
   * s = flight controller state:
   *  mode: 'ground' | 'takeoff' | 'flight' | 'landing'
   *  speed, groundSpeed, intensity (0..1 flapping effort), dive, brake, glide,
   *  pitch, roll, yawRate, agl, action ('peck'|'drink'|null), actionT (0..1), resting
   */
  update(dt, s) {
    const a = this.a, sp = this.species, p = this.pose;
    this.t += dt;
    const flying = s.mode !== 'ground';
    const landing = s.mode === 'landing';
    const flare = landing ? clamp01(1 - s.agl / 6) : 0;
    this.speedFlare = damp(this.speedFlare, flare, 8, dt);

    // -- blend between ground and air postures ----------------------------------
    const attitudeTarget = flying ? (landing && s.agl < 2.2 ? 0.35 : 1) : 0;
    this.flightBlend = damp(this.flightBlend, attitudeTarget, flying ? 5 : 4, dt);
    this.spread = damp(this.spread, flying ? 1 : 0, flying ? 9 : 6, dt);
    this.restBlend = damp(this.restBlend, s.resting ? 1 : 0, 2.5, dt);
    this.diveAmt = damp(this.diveAmt, s.dive ? 1 : 0, 4, dt);

    // -- wing beat ---------------------------------------------------------------
    const flapTarget = flying ? Math.max(s.intensity, landing ? 0.45 * this.speedFlare : 0) : 0;
    this.flapAmt = damp(this.flapAmt, flapTarget, 8, dt);
    const freq = lerp(a.flapFreq[0], a.flapFreq[1], clamp01(this.flapAmt));
    this.phase = (this.phase + TAU * freq * dt) % TAU;
    const cosP = Math.cos(this.phase), sinP = Math.sin(this.phase);
    const upstroke = Math.max(0, -sinP);

    const glide = 1 - clamp01(this.flapAmt * 2);
    let extend = lerp(1, 0.3, this.diveAmt) - a.upFold * upstroke * this.flapAmt;
    let dihedral = a.glideDihedral * glide
      + (a.flapAmp * cosP + 0.12) * this.flapAmt * (1 - 0.5 * this.diveAmt)
      + Math.sin(this.t * 0.9) * 0.02 * glide;
    if (landing) dihedral += 0.25 * this.speedFlare;           // wings cupped to brake
    const asymTarget = clamp(-s.roll * 0.18, -0.25, 0.25);
    p.asym = damp(p.asym, asymTarget, 5, dt);
    p.extend = this.spread * clamp01(extend);
    p.dihedral = dihedral * this.spread;
    p.twist = a.twist * sinP * this.flapAmt * this.spread;
    p.sweep = lerp(a.sweepCruise, a.sweepDive, this.diveAmt) * this.spread;

    // -- tail ---------------------------------------------------------------------
    let tailPitch, tailYaw;
    if (flying) {
      tailPitch = (s.brake ? 0.5 : 0) + 0.6 * this.speedFlare - clamp(s.pitch, -0.5, 0.5) * 0.25 + Math.sin(this.t * 1.7) * 0.03;
      tailYaw = clamp(s.yawRate * 0.35, -0.4, 0.4);
    } else {
      tailPitch = 0.1 * Math.sin(this.t * 0.7) + (s.groundSpeed > 0.2 ? 0.1 * Math.sin(this.stride * 2) : 0);
      tailYaw = 0.05 * Math.sin(this.t * 0.45);
    }
    p.tailPitch = damp(p.tailPitch, tailPitch, 6, dt);
    p.tailYaw = damp(p.tailYaw, tailYaw, 6, dt);

    // -- ground gait ---------------------------------------------------------------
    const g = sp.ground;
    const walking = !flying && s.groundSpeed > 0.15 && !s.action;
    if (walking) this.stride += (s.groundSpeed / g.strideLength) * Math.PI * dt;
    const stepAmt = walking ? clamp01(s.groundSpeed / Math.max(g.walk, 0.1)) : 0;
    let legL = 0, legR = 0, bobY = 0, waddle = 0, gaitLean = 0;
    if (!flying) {
      if (g.hop) {
        const hopArc = Math.abs(Math.sin(this.stride * 0.5));
        legL = legR = 0.45 * hopArc * stepAmt;
        bobY = hopArc * 0.12 * model_scale(this.model) * stepAmt * (g.strideLength * 4);
        gaitLean = -0.12 * stepAmt;
      } else {
        const sw = Math.sin(this.stride);
        legL = sw * 0.55 * Math.min(1, stepAmt);
        legR = -legL;
        bobY = Math.abs(sw) * 0.012 * stepAmt;
        waddle = sw * 0.05 * stepAmt;
      }
    } else {
      const tuck = 0.5 * (1 - this.speedFlare) * (1 - 0.3 * this.diveAmt);
      legL = legR = tuck - 0.9 * this.speedFlare;                // legs trail in flight, swing forward to land
    }
    p.legL = damp(p.legL, legL, 12, dt);
    p.legR = damp(p.legR, legR, 12, dt);
    p.bobY = damp(p.bobY, bobY, 18, dt);
    p.waddle = damp(p.waddle, waddle, 12, dt);

    // -- neck and head ------------------------------------------------------------
    let headYaw = 0, headPitch = 0, extraAttitude = 0;
    if (flying) {
      headPitch = s.pitch * 0.4;                                  // keep the eyes level
      headYaw = clamp(s.yawRate * 0.3, -0.5, 0.5);
      this.preenT = -1;
    } else {
      this._idleBehaviour(dt, s, walking);
      headYaw = this.head.yaw;
      headPitch = this.head.pitch + (walking ? Math.sin(this.stride * 2) * 0.12 : 0);
      if (this.restBlend > 0.01) {                               // sleeping: head turned back over the shoulder
        headYaw = lerp(headYaw, 2.2, this.restBlend);
        headPitch = lerp(headPitch, 0.35, this.restBlend);
      }
      if (s.action) {
        const env = clamp01(s.actionT * 6) * clamp01((1 - s.actionT) * 6);
        const dip = s.action === 'peck'
          ? Math.abs(Math.sin(s.actionT * Math.PI * 3)) * env
          : env * (0.85 + 0.15 * Math.sin(s.actionT * 40));
        headPitch += dip * 1.1;
        extraAttitude += dip * 0.22;
        headYaw *= 1 - env;
      }
      extraAttitude += Math.sin(this.t * 1.6) * 0.006 + gaitLean;   // breathing
    }
    p.headYaw = headYaw;
    p.headPitch = headPitch;
    p.neckExtend = this.flightBlend;
    p.attitude = this.flightPitch * this.flightBlend + extraAttitude;
  }

  _idleBehaviour(dt, s, walking) {
    const lookRate = this.a.idleLook || 1;
    if (this.preenT >= 0) {
      this.preenT += dt;
      const t = this.preenT;
      this.head.yaw = Math.sin(t * 2.1) * 1.2;
      this.head.pitch = 0.5 + 0.2 * Math.sin(t * 9);
      if (t > 3.8) { this.preenT = -1; this.lookTimer = 1; }
      return;
    }
    this.lookTimer -= dt;
    if (this.lookTimer <= 0 && !s.resting) {
      if (!walking && Math.random() < 0.1 * lookRate) {
        this.preenT = 0;
      } else {
        const amp = walking ? 0.35 : 1;
        this.look.yaw = (Math.random() - 0.5) * 1.8 * amp;
        this.look.pitch = (Math.random() - 0.35) * 0.5 * amp;
      }
      this.lookTimer = (1.2 + Math.random() * 2.6) / lookRate;
    }
    this.head.yaw = damp(this.head.yaw, s.resting ? 0 : this.look.yaw, 7, dt);
    this.head.pitch = damp(this.head.pitch, s.resting ? 0 : this.look.pitch, 7, dt);
  }

  apply() { this.model.applyPose(this.pose); }
}

function model_scale(model) { return model.config.scale || 1; }
