// Sailing the waʻa: forgiving wind-driven steering, depth and reef collision, and
// finding somewhere to step ashore.
import { clamp, damp, smoothstep } from '../core/util.js';
import { heightAt, inPlayZone, slopeAt } from '../world/terrain.js';
import { collides } from '../world/common.js';

const MAX_SPEED = 6.2;
const HULL_DRAFT = 0.42, AMA_DRAFT = 0.3;
export const SEA_BOUNDS = { x0: -38, x1: 118, z0: -54, z1: 62 };
// Probe points in boat space: [x (port +), z (bow +), draft].
const PROBES = [[0, 0, HULL_DRAFT], [0, 1.3, HULL_DRAFT], [0, 2.5, HULL_DRAFT], [0, -1.3, HULL_DRAFT], [0, -2.5, HULL_DRAFT], [2.05, 1.2, AMA_DRAFT], [2.05, -1.0, AMA_DRAFT]];

export class Sailing {
  constructor(canoe) {
    this.canoe = canoe;
    this.pos = canoe.group.position;
    this.bump = 0;        // set to the impact speed when the hull strikes something
    this.atEdge = false;  // true while pushing against the edge of the charted water
    this.power = 0;       // 0..1 how well the sail is drawing
  }

  // Smallest water clearance under the boat; positive means afloat everywhere.
  clearance(x, z, h) {
    const sin = Math.sin(h), cos = Math.cos(h);
    let min = Infinity;
    for (const [lx, lz, draft] of PROBES) {
      const px = x + lx * cos + lz * sin, pz = z - lx * sin + lz * cos;
      let c = -draft - heightAt(px, pz);
      if (lx === 0 && collides(px, pz, 0.35)) c = -1;
      if (c < min) min = c;
    }
    return min;
  }

  #inBounds(x, z) { return x > SEA_BOUNDS.x0 && x < SEA_BOUNDS.x1 && z > SEA_BOUNDS.z0 && z < SEA_BOUNDS.z1; }

  // ax: steer (right +), ay: sheet in / back-paddle. wind: unit Vector2 the wind blows toward.
  update(dt, ax, ay, wind) {
    const c = this.canoe, p = this.pos;
    c.turn = damp(c.turn, -ax, 5, dt);
    const here = this.clearance(p.x, p.z, c.heading);

    const turnRate = 0.4 + 0.85 * clamp(Math.abs(c.speed) / 3, 0, 1);
    const h2 = c.heading + c.turn * turnRate * dt * (c.speed < -0.1 ? -1 : 1);
    const turned = this.clearance(p.x, p.z, h2);
    if (turned > 0 || turned >= here) c.heading = h2;

    const sin = Math.sin(c.heading), cos = Math.cos(c.heading);
    // Running and reaching draw fully; beating into the wind is slow but never stalls.
    const along = wind.x * sin + wind.y * cos;
    this.power = 0.5 + 0.5 * smoothstep(-1, -0.15, along);
    const target = ay > 0 ? ay * MAX_SPEED * this.power : ay * 1.5;
    c.speed = damp(c.speed, target, Math.abs(target) > Math.abs(c.speed) ? 0.9 : ay === 0 ? 0.55 : 1.6, dt);

    this.bump = 0;
    this.atEdge = false;
    const dx = sin * c.speed * dt, dz = cos * c.speed * dt;
    const ok = (x, z) => {
      if (!this.#inBounds(x, z)) { this.atEdge = true; return false; }
      const cl = this.clearance(x, z, c.heading);
      return cl > 0 || cl > here;
    };
    if (ok(p.x + dx, p.z + dz)) { p.x += dx; p.z += dz; }
    else if (ok(p.x + dx, p.z)) { p.x += dx; c.speed *= 1 - 2.5 * dt; }
    else if (ok(p.x, p.z + dz)) { p.z += dz; c.speed *= 1 - 2.5 * dt; }
    else {
      if (Math.abs(c.speed) > 1.2) this.bump = Math.abs(c.speed);
      c.speed *= -0.25;
    }
  }

  // Bring the boat to rest (used while moored or in menus).
  rest(dt) {
    const c = this.canoe;
    c.speed = damp(c.speed, 0, 2, dt);
    c.turn = damp(c.turn, 0, 5, dt);
  }

  // Nearest dry or wadeable spot to step out onto, or null.
  findLanding(out) {
    const p = this.pos;
    let best = -Infinity, found = false;
    for (let r = 1.5; r <= 5.2; r += 0.7) {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const x = p.x + Math.sin(a) * r, z = p.z + Math.cos(a) * r;
        const h = heightAt(x, z);
        if (h < -0.4 || h > 1.6 || !inPlayZone(x, z) || slopeAt(x, z) > 0.9 || collides(x, z, 0.4)) continue;
        const score = -Math.abs(h - 0.35) - r * 0.22;
        if (score > best) { best = score; out.x = x; out.z = z; found = true; }
      }
    }
    return found ? out : null;
  }
}
