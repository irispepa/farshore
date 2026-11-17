// Shared math, seeded randomness and gradient noise.

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

export function angleDiff(from, to) {
  let d = (to - from) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Perlin-style gradient noise -------------------------------------------
const PERM = new Uint8Array(512);
{
  const r = rng(90210);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
}
const GX = [1, -1, 1, -1, 1, -1, 0, 0];
const GY = [1, 1, -1, -1, 0, 0, 1, -1];
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

export function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const X = xi & 255, Y = yi & 255;
  const g = (ix, iy, dx, dy) => {
    const h = PERM[PERM[ix] + iy] & 7;
    return GX[h] * dx + GY[h] * dy;
  };
  const u = fade(xf), v = fade(yf);
  const a = lerp(g(X, Y, xf, yf), g(X + 1, Y, xf - 1, yf), u);
  const b = lerp(g(X, Y + 1, xf, yf - 1), g(X + 1, Y + 1, xf - 1, yf - 1), u);
  return lerp(a, b, v); // roughly [-1, 1]
}

export function fbm(x, y, octaves = 4) {
  let amp = 0.5, f = 1, sum = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2(x * f, y * f);
    f *= 2.03;
    amp *= 0.5;
  }
  return sum;
}

// Distance from point to segment; writes interpolation factor into out.t.
const _seg = { t: 0 };
export function distSeg(px, pz, ax, az, bx, bz, out = _seg) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz;
  const t = l2 > 0 ? clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1) : 0;
  out.t = t;
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

// Nearest point on a polyline of [x, z, h] waypoints.
export function nearestOnPath(path, x, z, out) {
  let best = Infinity;
  const s = { t: 0 };
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    const d = distSeg(x, z, a[0], a[1], b[0], b[1], s);
    if (d < best) {
      best = d;
      out.h = lerp(a[2], b[2], s.t);
      out.seg = i;
      out.t = s.t;
    }
  }
  out.d = best;
  return out;
}

export const smax = (a, b, k) => {
  const h = clamp(0.5 + (0.5 * (a - b)) / k, 0, 1);
  return lerp(b, a, h) + k * h * (1 - h);
};
