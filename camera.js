// Third-person chase camera. The mouse (or touch drag) sets the view direction;
// the bird steers towards it. Kept above terrain and water.

import * as THREE from 'three';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export class ChaseCamera {
  constructor(camera, species) {
    this.camera = camera;
    this.yaw = 0;
    this.pitch = 0.12;          // positive looks up
    this.focus = new THREE.Vector3();
    this.position = new THREE.Vector3();
    this.sensitivity = 0.0024;
    this.fovBase = 62;
    this.setSpecies(species);
    this._first = true;
  }

  setSpecies(species) {
    this.distance = species.camera.distance;
    this.height = species.camera.height;
  }

  look(dx, dy) {
    this.yaw -= dx * this.sensitivity;
    this.pitch = clamp(this.pitch - dy * this.sensitivity, -1.25, 1.3);
  }

  update(dt, target, speed, world) {
    if (this._first) { this.focus.copy(target); this._first = false; }
    this.focus.lerp(target, 1 - Math.exp(-14 * dt));

    const cp = Math.cos(this.pitch);
    const dir = _dir.set(cp * Math.sin(this.yaw), Math.sin(this.pitch), cp * Math.cos(this.yaw));
    this.position.copy(this.focus).addScaledVector(dir, -this.distance);
    this.position.y += this.height;

    const floor = world.groundHeight(this.position.x, this.position.z) + 0.35 + this.distance * 0.04;
    if (this.position.y < floor) this.position.y = floor;

    this.camera.position.copy(this.position);
    this.camera.lookAt(_look.copy(this.position).add(dir));

    const fov = this.fovBase + clamp(speed - 10, 0, 35) * 0.3;
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov += (fov - this.camera.fov) * (1 - Math.exp(-3 * dt));
      this.camera.updateProjectionMatrix();
    }
  }
}

const _dir = new THREE.Vector3();
const _look = new THREE.Vector3();
