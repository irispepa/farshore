// On-foot movement: camera-relative steering over the heightfield (and the cave roof
// layer), with slope limits, wading, cliff guards and sliding along obstacles.
import { clamp, damp, angleDiff } from '../core/util.js';
import { groundAt, inPlayZone } from '../world/terrain.js';
import { resolveColliders } from '../world/common.js';

const WALK = 3.2, RUN = 5.8; // m/s
const WADE_DEPTH = 0.62;  // deepest water she will walk into
const MAX_UP = 1.0, MAX_DOWN = 1.7; // slope limits (rise over run)
const PROBE = 0.5;

export class Walker {
  constructor(character) {
    this.c = character;
    this.pos = character.root.position;
    this.vx = 0; this.vz = 0;
    this.facing = 0;
    this.speed = 0;
    this.wading = 0;
    this.run = 0;          // 0..1 blend into the running gait
    this.blocked = null;   // 'deep' | 'steep' | 'drop' | 'edge' while pushing against something
    this.reach = 0;        // seconds left of the reach gesture
    this.obstacle = null;  // optional (pos) => void that pushes pos out of a dynamic obstacle
  }

  place(x, z, facing = this.facing, y = 30) {
    this.pos.set(x, groundAt(x, z, y), z);
    this.vx = this.vz = this.speed = 0;
    this.facing = facing;
    this.c.root.rotation.set(0, facing, 0);
  }

  // Why a step from the current spot toward (dx, dz) is not allowed, or null if it is.
  #barrier(dx, dz) {
    const p = this.pos, len = Math.hypot(dx, dz);
    if (len < 1e-6) return null;
    const ux = dx / len, uz = dz / len;
    const nx = p.x + dx, nz = p.z + dz;
    if (!inPlayZone(nx, nz)) return 'edge';
    const here = groundAt(p.x, p.z, p.y);
    const ahead = groundAt(p.x + ux * PROBE, p.z + uz * PROBE, p.y);
    const slope = (ahead - here) / PROBE;
    if (slope > MAX_UP) return 'steep';
    if (slope < -MAX_DOWN) return 'drop';
    if (groundAt(nx, nz, p.y) < -WADE_DEPTH && ahead < here) return 'deep';
    return null;
  }

  // ax/ay: stick right/forward, camYaw: orbit yaw of the camera, sprint: run instead of walk.
  update(dt, ax, ay, camYaw, sprint = false) {
    const p = this.pos;
    const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
    const wx = ax * cos - ay * sin, wz = -ax * sin - ay * cos;
    // No running through water: wading drags her back to a walk.
    const top = sprint && this.wading < 0.25 ? RUN : WALK;
    const max = top * (1 - 0.45 * this.wading);
    this.vx = damp(this.vx, wx * max, 11, dt);
    this.vz = damp(this.vz, wz * max, 11, dt);

    const ox = p.x, oz = p.z;
    const dx = this.vx * dt, dz = this.vz * dt;
    this.blocked = null;
    if (Math.hypot(dx, dz) > 1e-5) {
      const why = this.#barrier(dx, dz);
      if (!why) { p.x += dx; p.z += dz; }
      else {
        this.blocked = why;
        // Slide along whichever axis is still open.
        if (Math.abs(dx) > 1e-5 && !this.#barrier(dx, 0)) { p.x += dx; this.vz *= 0.5; }
        else if (Math.abs(dz) > 1e-5 && !this.#barrier(0, dz)) { p.z += dz; this.vx *= 0.5; }
        else { this.vx *= 0.3; this.vz *= 0.3; }
      }
    }
    resolveColliders(p, 0.32);
    this.obstacle?.(p);

    const ground = groundAt(p.x, p.z, p.y);
    p.y = damp(p.y, Math.max(ground, -WADE_DEPTH), 20, dt);
    this.wading = damp(this.wading, clamp(-ground / WADE_DEPTH, 0, 1), 8, dt);
    this.speed = dt > 0 ? Math.hypot(p.x - ox, p.z - oz) / dt : 0;

    if (Math.hypot(wx, wz) > 0.08) {
      const want = Math.atan2(this.vx, this.vz);
      this.facing += angleDiff(this.facing, want) * (1 - Math.exp(-12 * dt));
    }
    this.c.root.rotation.y = this.facing;
    this.reach = Math.max(0, this.reach - dt);
    this.run = damp(this.run, clamp((this.speed - WALK) / (RUN - WALK), 0, 1), 6, dt);
    this.c.update(dt, { speed: this.speed, run: this.run, sitting: false, reaching: this.reach > 0 });
  }

  // Turn to face a point (used when interacting).
  face(x, z) { this.facing = Math.atan2(x - this.pos.x, z - this.pos.z); }
}
