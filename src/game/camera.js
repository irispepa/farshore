// Assisted third-person camera: orbits a focus point, drifts back behind the mover
// when the right thumb is idle, and pulls in when rock or the cave roof is in the way.
import * as THREE from 'three';
import { clamp, damp, angleDiff } from '../core/util.js';
import { solidAt, heightAt } from '../world/terrain.js';
import { waveHeight } from '../world/water.js';

const LOOK_YAW = 0.0052, LOOK_PITCH = 0.0038;
const PITCH_MIN = -0.2, PITCH_MAX = 1.15;

export class ChaseCamera {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0;
    this.pitch = 0.24;
    this.dist = 4.4;
    this.target = new THREE.Vector3();
    this.idle = 9;          // seconds since the player last moved the camera by hand
    this.fov = camera.fov;
    this.spyYaw = 0;
    this.spyPitch = 0;
    this.aim = new THREE.Vector3();
  }

  snap(focus, yaw, pitch = 0.24, dist = 4.4) {
    this.target.copy(focus);
    this.yaw = yaw; this.pitch = pitch; this.dist = dist;
    this.idle = 9;
  }

  // near: the spyglass clips away grass and bushes right in front of the lens.
  #setFov(dt, fov, near = 0.1) {
    const f = damp(this.fov, fov, 6, dt);
    if (Math.abs(f - this.fov) > 0.01 || this.camera.near !== near) {
      this.fov = f;
      this.camera.fov = f;
      this.camera.near = near;
      this.camera.updateProjectionMatrix();
    }
  }

  // opts: { dist, pitch, followYaw (radians or null), followRate, look: { dx, dy }, t }
  update(dt, focus, opts) {
    const { look } = opts;
    if (look && (look.dx || look.dy)) {
      this.yaw -= look.dx * LOOK_YAW;
      this.pitch = clamp(this.pitch + look.dy * LOOK_PITCH, PITCH_MIN, PITCH_MAX);
      this.idle = 0;
    } else this.idle += dt;

    if (opts.followYaw != null && this.idle > 0.9 && opts.followRate > 0) {
      const d = angleDiff(this.yaw, opts.followYaw);
      this.yaw += d * (1 - Math.exp(-opts.followRate * dt));
    }
    if (this.idle > 2.5) this.pitch = damp(this.pitch, opts.pitch, 0.7, dt);

    const tg = this.target;
    tg.x = damp(tg.x, focus.x, 14, dt);
    tg.z = damp(tg.z, focus.z, 14, dt);
    tg.y = damp(tg.y, focus.y, 9, dt);

    const cp = Math.cos(this.pitch);
    const dx = Math.sin(this.yaw) * cp, dy = Math.sin(this.pitch), dz = Math.cos(this.yaw) * cp;

    // March out from the focus; stop short of anything solid.
    let free = opts.dist;
    for (let s = 0.5; s <= opts.dist; s += 0.25) {
      if (solidAt(tg.x + dx * s, tg.y + dy * s - 0.28, tg.z + dz * s)) { free = Math.max(0.7, s - 0.4); break; }
    }
    this.dist = damp(this.dist, free, free < this.dist ? 22 : 2.6, dt);

    const cam = this.camera;
    cam.position.set(tg.x + dx * this.dist, tg.y + dy * this.dist, tg.z + dz * this.dist);
    const floor = Math.max(heightAt(cam.position.x, cam.position.z), waveHeight(cam.position.x, cam.position.z, opts.t || 0)) + 0.3;
    // Only lift over open ground; inside the cave the roof march above already handled it.
    if (cam.position.y < floor && !solidAt(cam.position.x, floor + 0.1, cam.position.z)) cam.position.y = floor;
    cam.lookAt(tg);
    this.#setFov(dt, 55);
  }

  // Spyglass: first-person zoom that tracks a point, with a little free look.
  beginSpy(aim) { this.spyYaw = this.spyPitch = 0; this.aim.copy(aim); }

  spy(dt, eye, aim, look) {
    if (look) {
      this.spyYaw = clamp(this.spyYaw - look.dx * 0.0016, -0.3, 0.3);
      this.spyPitch = clamp(this.spyPitch - look.dy * 0.0016, -0.12, 0.16);
    }
    this.aim.x = damp(this.aim.x, aim.x, 2.2, dt);
    this.aim.y = damp(this.aim.y, aim.y, 2.2, dt);
    this.aim.z = damp(this.aim.z, aim.z, 2.2, dt);
    const cam = this.camera;
    cam.position.copy(eye);
    cam.lookAt(this.aim);
    cam.rotateY(this.spyYaw);
    cam.rotateX(this.spyPitch);
    this.#setFov(dt, 17, 6);
    // Keep the orbit camera roughly facing the same way for when the glass comes down.
    this.yaw = Math.atan2(eye.x - this.aim.x, eye.z - this.aim.z);
  }

  // Slow establishing orbit for the title screen.
  orbit(dt, t) {
    const a = 2.25 + Math.sin(t * 0.07) * 0.35;
    this.camera.position.set(30 + Math.sin(a) * 66, 13 + Math.sin(t * 0.11) * 2, 12 + Math.cos(a) * 62);
    this.target.set(28, 3.5, -4);
    this.camera.lookAt(this.target);
    this.#setFov(dt, 55);
  }
}
