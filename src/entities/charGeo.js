// Geometry helpers for the code-built character: lofted body/garment profiles,
// flattened hair strands, the sculpted head surface and the drawn face.
import * as THREE from 'three';
import { TAU } from '../core/util.js';

const cr = (p0, p1, p2, p3, t) => 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);

// Normalises loft keys and resamples them with a Catmull-Rom spline (smooth > 0).
export function sections(keys, smooth = 4) {
  let secs = keys.map((k) => [k[0], k[1], k[2], k[3] ?? k[2], k[4] || 0, k[5] || 0]);
  if (smooth > 0 && secs.length > 2) {
    const out = [], n = secs.length;
    for (let i = 0; i < n - 1; i++) {
      const a = secs[Math.max(0, i - 1)], b = secs[i], c = secs[i + 1], d = secs[Math.min(n - 1, i + 2)];
      for (let s = 0; s < smooth; s++) out.push(b.map((_, f) => cr(a[f], b[f], c[f], d[f], s / smooth)));
    }
    out.push(secs[n - 1]);
    secs = out;
  }
  return secs;
}

// Cross-section [y, rx, rzFront, rzBack, ox, oz] of resampled sections at height y.
export function profileAt(secs, y) {
  if (y >= secs[0][0]) return secs[0];
  for (let i = 0; i < secs.length - 1; i++) {
    const a = secs[i], b = secs[i + 1];
    if (y <= a[0] && y >= b[0]) {
      const t = a[0] === b[0] ? 0 : (a[0] - y) / (a[0] - b[0]);
      return a.map((v, f) => v + (b[f] - v) * t);
    }
  }
  return secs[secs.length - 1];
}

// Point on a loft surface at height y and angle a (0 = +x, PI/2 = front), pushed
// `lift` out along the cross-section normal. Optionally writes that normal.
export function loftPoint(secs, y, a, lift = 0, target = new THREE.Vector3(), normal = null) {
  const [, rx, rzf, rzb, ox, oz] = profileAt(secs, y);
  const c = Math.cos(a), s = Math.sin(a), rz = s > 0 ? rzf : rzb;
  const nx = c / rx, nz = s / rz, nl = Math.hypot(nx, nz) || 1;
  if (normal) normal.set(nx / nl, 0, nz / nl);
  return target.set(ox + c * rx + (nx / nl) * lift, y, oz + s * rz + (nz / nl) * lift);
}

// Loft of elliptical cross-sections stacked down the y axis (origin at the joint).
// keys: [y, rx, rzFront, rzBack = rzFront, offsetX = 0, offsetZ = 0], in descending y.
// smooth > 0 resamples the keys with a Catmull-Rom spline; roundTop/roundBot close an
// end with a dome; lipBot turns the open bottom edge inward (garment hems).
export function loft(keys, { radial = 14, smooth = 4, roundTop = false, roundBot = false, capTop = true, capBot = true, lipBot = 0 } = {}) {
  let secs = sections(keys, smooth);
  const dome = (s, dir) => {
    const h = Math.min(s[1], (s[2] + s[3]) / 2), rings = [];
    for (let i = 1; i <= 3; i++) {
      const a = (i / 4) * (Math.PI / 2), c = Math.cos(a);
      rings.push([s[0] + dir * Math.sin(a) * h, s[1] * c, s[2] * c, s[3] * c, s[4], s[5]]);
    }
    return { rings, apex: s[0] + dir * h };
  };
  let apexTop = secs[0][0], apexBot = secs[secs.length - 1][0];
  if (roundTop) { const d = dome(secs[0], 1); secs = [...d.rings.reverse(), ...secs]; apexTop = d.apex; }
  if (roundBot) { const d = dome(secs[secs.length - 1], -1); secs = [...secs, ...d.rings]; apexBot = d.apex; }
  if (lipBot) { const l = secs[secs.length - 1]; secs.push([l[0], l[1] * lipBot, l[2] * lipBot, l[3] * lipBot, l[4], l[5]]); }

  const pos = [], idx = [];
  for (const [y, rx, rz, rzb, ox, oz] of secs) {
    for (let k = 0; k < radial; k++) {
      const a = (k / radial) * TAU, c = Math.cos(a), s = Math.sin(a);
      pos.push(ox + c * rx, y, oz + s * (s > 0 ? rz : rzb));
    }
  }
  for (let i = 0; i < secs.length - 1; i++) {
    for (let k = 0; k < radial; k++) {
      const a = i * radial + k, b = i * radial + ((k + 1) % radial), c = a + radial, d = b + radial;
      idx.push(a, b, c, b, d, c);
    }
  }
  if (capTop) {
    const t = pos.length / 3, s = secs[0];
    pos.push(s[4], apexTop, s[5]);
    for (let k = 0; k < radial; k++) idx.push(t, (k + 1) % radial, k);
  }
  if (capBot && !lipBot) {
    const t = pos.length / 3, s = secs[secs.length - 1], o = (secs.length - 1) * radial;
    pos.push(s[4], apexBot, s[5]);
    for (let k = 0; k < radial; k++) idx.push(t, o + k, o + ((k + 1) % radial));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// One continuous limb for skinning: the upper profile, then the lower one hung at
// jointY. Vertices blend from bone 0 to bone 1 across the joint, so the surface
// stays unbroken when the joint bends.
export function limbGeometry(upper, lower, jointY, { radial = 14, blend = 0.035 } = {}) {
  const keys = [...upper, ...lower.slice(1).map((k) => [k[0] + jointY, ...k.slice(1)])];
  const geo = loft(keys, { radial, roundTop: true, roundBot: true });
  const P = geo.attributes.position, idx = [], wts = [];
  for (let i = 0; i < P.count; i++) {
    const k = Math.min(1, Math.max(0, (jointY + blend - P.getY(i)) / (2 * blend))), w = k * k * (3 - 2 * k);
    idx.push(0, 1, 0, 0); wts.push(1 - w, w, 0, 0);
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wts, 4));
  return geo;
}

// Panel lying on a loft surface: rows run from y0 down to y1; centre(t) and half(t)
// give the panel's angle and angular half-width at row t (0..1).
export function loftPatch(keys, { y0, y1, centre, half, lift = 0.003, rows = 14, cols = 12, smooth = 4 }) {
  const secs = sections(keys, smooth), pos = [], idx = [], p = new THREE.Vector3();
  for (let j = 0; j <= rows; j++) {
    const t = j / rows, y = y0 + (y1 - y0) * t, c = centre(t), h = half(t);
    for (let i = 0; i <= cols; i++) {
      loftPoint(secs, y, c + (i / cols - 0.5) * 2 * h, lift, p);
      pos.push(p.x, p.y, p.z);
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i, b = a + 1, c = a + cols + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// Cuts a V notch into the bottom edge of a garment loft: vertices near angle `at`
// are raised by up to `depth`, fading out `reach` above the hem at yBot.
export function notchHem(geo, { at, width, depth, yBot, reach = 0.06 }) {
  const P = geo.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    let d = Math.abs(Math.atan2(z, x) - at);
    if (d > Math.PI) d = TAU - d;
    const k = Math.max(0, 1 - d / width) * Math.min(1, Math.max(0, 1 - (y - yBot) / reach));
    if (k > 0) P.setY(i, y + depth * k);
  }
  P.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// Flattened, tapered tube along a curve: `thick` runs along the outward direction
// given by out(point), `width` across it. Both ends are capped.
export function strand(points, { width, thick, out, segs = 16, radial = 8 }) {
  const curve = new THREE.CatmullRomCurve3(points);
  const pos = [], idx = [];
  const p = new THREE.Vector3(), T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3(), O = new THREE.Vector3();
  const first = new THREE.Vector3(), last = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPoint(t, p);
    curve.getTangent(t, T);
    out(p, O);
    O.addScaledVector(T, -O.dot(T));
    if (O.lengthSq() > 1e-8) N.copy(O).normalize();
    B.crossVectors(T, N).normalize();
    const w = width(t), h = thick(t);
    for (let k = 0; k < radial; k++) {
      const a = (k / radial) * TAU, c = Math.cos(a) * h, s = Math.sin(a) * w;
      pos.push(p.x + N.x * c + B.x * s, p.y + N.y * c + B.y * s, p.z + N.z * c + B.z * s);
    }
    if (i === 0) first.copy(p);
    if (i === segs) last.copy(p);
  }
  for (let i = 0; i < segs; i++) {
    for (let k = 0; k < radial; k++) {
      const a = i * radial + k, b = i * radial + ((k + 1) % radial), c = a + radial, d = b + radial;
      idx.push(a, b, c, b, d, c);
    }
  }
  const s = pos.length / 3, o = segs * radial;
  pos.push(first.x, first.y, first.z, last.x, last.y, last.z);
  for (let k = 0; k < radial; k++) {
    idx.push(s, (k + 1) % radial, k);
    idx.push(s + 1, o + k, o + ((k + 1) % radial));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// Smooth curve through [t, value] keys (Catmull-Rom), clamped at both ends.
export function spline(keys) {
  return (t) => {
    const n = keys.length;
    if (t <= keys[0][0]) return keys[0][1];
    if (t >= keys[n - 1][0]) return keys[n - 1][1];
    let i = 0;
    while (t > keys[i + 1][0]) i++;
    const a = keys[Math.max(0, i - 1)], b = keys[i], c = keys[i + 1], d = keys[Math.min(n - 1, i + 2)];
    return cr(a[1], b[1], c[1], d[1], (t - b[0]) / (c[0] - b[0]));
  };
}

// Angle offset that makes hair clumps snake from side to side down their length.
export const hairWave = (t, wave, seed) => wave * Math.sin(t * 7.5 + seed) + 0.35 * wave * Math.sin(t * 13 + seed * 2.3);

// Wavy hair mass: a rounded volume whose surface is cut into clumps by S-curved
// grooves. shape(t) gives { y, rx, rz, cz } from the top (t = 0) to the bottom (1);
// angle 0 is the back of the head. Each clump hangs to its own length(angle, index), so the
// lower edge is layered, and ridges are tinted from `dark` to `light`.
export function hairMassGeometry(shape, { segs = 160, rings = 56, clumps = 9, depth = 0.17, wave = 0.36, seed = 0, length = () => 1, dark = 0x000000, light = 0xffffff } = {}) {
  const pos = [], col = [], idx = [];
  const cd = new THREE.Color(dark), cl = new THREE.Color(light), c = new THREE.Color();
  const yTop = shape(0).y;
  for (let j = 0; j <= rings; j++) {
    const t = j / rings, { y, rx, rz, cz } = shape(t);
    // Smooth at the crown, where it meets the scalp; grooves deepen towards the tips.
    const fade = Math.min(1, Math.max(0, (t - 0.1) / 0.25)), tip = Math.min(1, Math.max(0, (t - 0.68) / 0.32));
    for (let i = 0; i < segs; i++) {
      const phi = (i / segs) * TAU - Math.PI;
      const u = (clumps / 2) * (phi + hairWave(t, wave, seed)) + 0.5 * Math.sin(phi * 3 + seed);
      const ridge = 1 - Math.cos(u) ** 4; // broad lobes, narrow smooth grooves
      const k = 1 - (depth * fade + 0.3 * tip * tip) * (1 - ridge);
      // Length is taken at the clump's own centre, easing to the neighbour's in the
      // groove between them so the surface stays unbroken.
      const m = Math.floor(u / Math.PI), nb = u / Math.PI - m < 0.5 ? m - 1 : m + 1;
      const own = length(((m + 0.5) * TAU) / clumps, m), next = length(((nb + 0.5) * TAU) / clumps, nb);
      const len = own + (next - own) * 0.5 * (1 - Math.min(1, ridge / 0.75)) ** 2;
      pos.push(Math.sin(phi) * rx * k, yTop + (y - yTop) * (1 + (len - 1) * t), cz - Math.cos(phi) * rz * k);
      c.copy(cd).lerp(cl, ridge * ridge * (0.55 + 0.45 * Math.sin(u * 0.5 + phi * 2 + t * 5) ** 2));
      col.push(c.r, c.g, c.b);
    }
  }
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < segs; i++) {
      const a = j * segs + i, b = j * segs + ((i + 1) % segs), c2 = a + segs, d = b + segs;
      idx.push(a, b, c2, b, d, c2);
    }
  }
  const top = shape(0), bot = shape(1), n = pos.length / 3;
  pos.push(0, top.y, top.cz, 0, bot.y, bot.cz);
  col.push(cd.r, cd.g, cd.b, cd.r, cd.g, cd.b);
  for (let i = 0; i < segs; i++) {
    idx.push(n, (i + 1) % segs, i);
    idx.push(n + 1, rings * segs + i, rings * segs + ((i + 1) % segs));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// --- Head ------------------------------------------------------------------
// Sculpted head surface: point for a unit direction, relative to the head centre.
// Fuller cranium, cheeks, a jaw that tapers to the chin and a flatter face plane.
export function headSurf(d, target = new THREE.Vector3()) {
  const low = Math.max(0, -d.y), up = Math.max(0, d.y), front = Math.max(0, d.z);
  let x = d.x * 0.133, y = d.y * (d.y > 0 ? 0.152 : 0.158), z = d.z * 0.146;
  x *= 1 - 0.4 * Math.pow(low, 1.7);
  x *= 1 + 0.035 * up * (1 - up);
  z *= d.z > 0 ? 1 - 0.1 * front * front - 0.16 * Math.pow(low, 2) : 1 - 0.34 * Math.pow(low, 1.4);
  const cheek = Math.exp(-((Math.abs(d.x) - 0.55) ** 2 + (d.y + 0.34) ** 2) / 0.07) * front;
  const k = 1 + 0.07 * cheek;
  return target.set(x * k, y, z * k);
}

const _u = new THREE.Vector3(), _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
export function headNormal(d, target = new THREE.Vector3()) {
  _u.set(0, 1, 0);
  if (Math.abs(d.y) > 0.95) _u.set(1, 0, 0);
  _u.cross(d).normalize();
  _v.crossVectors(d, _u);
  headSurf(d, _a);
  headSurf(_d.copy(d).addScaledVector(_u, 0.02).normalize(), _b).sub(_a);
  headSurf(_d.copy(d).addScaledVector(_v, 0.02).normalize(), _c).sub(_a);
  target.crossVectors(_b, _c).normalize();
  if (target.dot(_a) < 0) target.negate();
  return target;
}

// Whole-head mesh from the surface function; `grow` (number or fn of direction)
// pushes it out along the normal.
export function headGeometry(grow = 0, ws = 48, hs = 36) {
  const geo = new THREE.SphereGeometry(1, ws, hs);
  const P = geo.attributes.position;
  const d = new THREE.Vector3(), p = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    d.fromBufferAttribute(P, i).normalize();
    headSurf(d, p); headNormal(d, n);
    p.addScaledVector(n, typeof grow === 'function' ? grow(d) : grow);
    P.setXYZ(i, p.x, p.y, p.z);
  }
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

// Scalp shell on the same grid as the head: lifted where hair grows and sunk just
// inside the skin elsewhere, so the hairline is a clean contour.
export function hairCapGeometry() {
  return headGeometry((d) => {
    const h = 0.4 + 0.66 * d.y - d.z + 0.05 * Math.cos(d.x * 7) * Math.max(0, d.z);
    const k = Math.min(1, Math.max(0, (h + 0.05) / 0.12));
    return -0.008 + (0.03 + 0.012 * Math.max(0, d.y)) * k * k * (3 - 2 * k);
  }, 64, 48);
}

export const faceDir = (yaw, pitch, target = new THREE.Vector3()) =>
  target.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));

// Face layout, as (yaw, pitch) on the head surface.
export const FACE = { yawMax: 1.05, pitchMax: 0.95, eyeYaw: 0.4, eyePitch: -0.03, browPitch: 0.25, nosePitch: -0.3, mouthPitch: -0.6 };

// Thin patch hugging the front of the head; carries the drawn face.
export function facePatchGeometry(n = 36, lift = 0.0012) {
  const pos = [], uv = [], nor = [], idx = [];
  const d = new THREE.Vector3(), p = new THREE.Vector3(), nn = new THREE.Vector3();
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const u = i / n, v = j / n;
      faceDir((u - 0.5) * 2 * FACE.yawMax, (v - 0.5) * 2 * FACE.pitchMax, d);
      headSurf(d, p); headNormal(d, nn);
      p.addScaledVector(nn, lift);
      pos.push(p.x, p.y, p.z); nor.push(nn.x, nn.y, nn.z); uv.push(u, v);
    }
  }
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, e = c + 1;
      idx.push(a, b, c, b, e, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

// Expression set for the drawn face.
//   eye: 'open' | 'closed' (blink) | 'happy' (arched shut)
//   lid: lowers (+) or raises (-) the upper lid; iris: iris size; look: gaze offset in px
//   brow: [lift in radians of pitch, tilt (+ pulls the inner end down)]
//   mouth: 'smile' | 'o' | 'laugh' | 'flat'
export const EXPRESSIONS = {
  neutral: { eye: 'open', mouth: 'smile' },
  blink: { eye: 'closed', mouth: 'smile' },
  surprised: { eye: 'open', lid: -16, iris: 0.84, brow: [0.075, -0.06], mouth: 'o' },
  laugh: { eye: 'happy', brow: [0.04, -0.05], mouth: 'laugh' },
  focused: { eye: 'open', lid: 30, look: [0, 16], brow: [-0.05, 0.2], mouth: 'flat' },
  focusedBlink: { eye: 'closed', brow: [-0.05, 0.2], mouth: 'flat' },
};

// Draws eyes, lids, brows, blush, freckles and lips into a transparent texture.
export function faceTexture(name = 'neutral') {
  const e = { lid: 0, iris: 1, look: [0, 0], brow: [0, 0], ...(EXPRESSIONS[name] || EXPRESSIONS.neutral) };
  const S = 1024, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const X = (yaw) => S / 2 + (yaw / FACE.yawMax) * (S / 2), Y = (pitch) => S / 2 - (pitch / FACE.pitchMax) * (S / 2);
  const LASH = '#2b1711', BROW = '#3b2117';
  const L = e.lid, L2 = e.lid * 0.3;

  for (const sg of [1, -1]) {
    // Blush: soft falloff, no edge.
    const bx = X(sg * 0.66), by = Y(-0.3);
    const bl = g.createRadialGradient(bx, by, 0, bx, by, 92);
    bl.addColorStop(0, 'rgba(255,105,120,0.42)'); bl.addColorStop(0.55, 'rgba(255,105,120,0.2)'); bl.addColorStop(1, 'rgba(255,105,120,0)');
    g.fillStyle = bl; g.fillRect(bx - 95, by - 95, 190, 190);
    g.fillStyle = 'rgba(140,72,44,0.5)';
    for (const [fx, fy] of [[0.5, -0.2], [0.58, -0.25], [0.66, -0.2], [0.74, -0.26], [0.6, -0.16]]) {
      g.beginPath(); g.arc(X(sg * fx), Y(fy), 3.2, 0, TAU); g.fill();
    }

    g.save();
    g.translate(X(sg * FACE.eyeYaw), Y(FACE.eyePitch));
    g.scale(sg * 1.14, 1.14); // +x is the outer corner
    g.lineCap = 'round';
    if (e.eye === 'closed') {
      g.strokeStyle = LASH; g.lineWidth = 12;
      g.beginPath(); g.moveTo(-88, 6); g.bezierCurveTo(-48, 38, 44, 36, 98, -6); g.stroke();
    } else if (e.eye === 'happy') {
      // Squeezed shut in a laugh: an upward arc with a small wing and a cheek crease.
      g.strokeStyle = LASH; g.lineWidth = 13;
      g.beginPath(); g.moveTo(-86, 14); g.bezierCurveTo(-52, -44, 46, -50, 100, 6); g.stroke();
      g.lineWidth = 7;
      g.beginPath(); g.moveTo(96, 2); g.lineTo(120, -12); g.stroke();
      g.strokeStyle = 'rgba(110,56,34,0.4)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(-60, 40); g.bezierCurveTo(-24, 54, 36, 54, 76, 34); g.stroke();
    } else {
      g.save();
      g.beginPath(); g.moveTo(-88, 12); g.bezierCurveTo(-64, -62 + L, 34, -78 + L, 94, -16 + L2);
      g.bezierCurveTo(62, 46, -44, 56, -88, 12); g.closePath();
      g.fillStyle = '#fffaf4'; g.fill();
      g.clip();
      const ix = 2 + sg * e.look[0], iy = -6 + e.look[1], r = 58 * e.iris;
      const ir = g.createRadialGradient(ix - 2, iy + 12, 8 * e.iris, ix - 2, iy, 60 * e.iris);
      ir.addColorStop(0, '#9a6234'); ir.addColorStop(0.7, '#6b3d20'); ir.addColorStop(1, '#3a1e10');
      g.fillStyle = ir; g.beginPath(); g.arc(ix, iy, r, 0, TAU); g.fill();
      g.fillStyle = '#1c0e09'; g.beginPath(); g.arc(ix, iy - 2, 26 * e.iris, 0, TAU); g.fill();
      const sh = g.createLinearGradient(0, -78 + L, 0, -28 + L);
      sh.addColorStop(0, 'rgba(50,24,16,0.55)'); sh.addColorStop(1, 'rgba(50,24,16,0)');
      g.fillStyle = sh; g.fillRect(-100, -80 + L, 200, 60);
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(ix + sg * -20, iy - 22, 13 * e.iris, 0, TAU); g.fill();
      g.globalAlpha = 0.7; g.beginPath(); g.arc(ix + sg * 18, iy + 18, 6 * e.iris, 0, TAU); g.fill();
      g.restore();
      // Upper lid: tapered lash line with a small wing; soft crease and lower lid.
      g.fillStyle = LASH;
      g.beginPath(); g.moveTo(-90, 13); g.bezierCurveTo(-66, -70 + L, 36, -90 + L, 100, -24 + L2); g.lineTo(122, -42 + L2);
      g.lineTo(98, -8 + L2); g.bezierCurveTo(36, -68 + L, -62, -52 + L, -86, 14); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(120,62,38,0.5)'; g.lineWidth = 3.5;
      g.beginPath(); g.moveTo(-70, -42 + L * 0.4); g.bezierCurveTo(-36, -92 + L * 0.4, 44, -100 + L * 0.4, 96, -50 + L * 0.4); g.stroke();
      g.strokeStyle = 'rgba(110,56,34,0.55)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(92, -12); g.bezierCurveTo(62, 48, -44, 58, -84, 16); g.stroke();
    }
    g.restore();

    // Brow: full at the inner end, arched, tapering outwards.
    g.save();
    g.translate(X(sg * (FACE.eyeYaw + 0.01)), Y(FACE.browPitch + e.brow[0]));
    g.scale(sg, 1);
    g.rotate(-e.brow[1]);
    g.fillStyle = BROW;
    g.beginPath(); g.moveTo(-78, 6); g.bezierCurveTo(-74, -12, -40, -24, 6, -30); g.bezierCurveTo(48, -34, 84, -18, 104, 4);
    g.bezierCurveTo(70, -10, 40, -12, 6, -8); g.bezierCurveTo(-28, -4, -54, 10, -70, 20); g.bezierCurveTo(-78, 20, -80, 14, -78, 6);
    g.closePath(); g.fill();
    g.restore();
  }

  // Soft shadow under the nose, then the mouth.
  const nx = X(0), ny = Y(FACE.nosePitch) + 30;
  const ns = g.createRadialGradient(nx, ny, 0, nx, ny, 34);
  ns.addColorStop(0, 'rgba(120,60,36,0.3)'); ns.addColorStop(1, 'rgba(120,60,36,0)');
  g.fillStyle = ns; g.fillRect(nx - 40, ny - 20, 80, 50);

  g.save();
  g.translate(X(0), Y(FACE.mouthPitch));
  g.scale(1.3, 1.3);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const LIP = '#b4505f', LIP_LIGHT = '#d4707a', INSIDE = '#6b2330';
  if (e.mouth === 'o') {
    g.scale(1.25, 1.25);
    g.fillStyle = LIP; g.beginPath(); g.ellipse(0, 6, 31, 35, 0, 0, TAU); g.fill();
    g.fillStyle = LIP_LIGHT; g.beginPath(); g.ellipse(0, 14, 28, 26, 0, 0, Math.PI); g.fill();
    g.fillStyle = INSIDE; g.beginPath(); g.ellipse(0, 5, 19, 22, 0, 0, TAU); g.fill();
    g.fillStyle = '#fffaf4'; g.beginPath(); g.ellipse(0, -11, 13, 5, 0, 0, TAU); g.fill();
  } else if (e.mouth === 'laugh') {
    g.translate(0, -6); g.scale(1.45, 1.3);
    const shape = () => { g.beginPath(); g.moveTo(-70, -18); g.bezierCurveTo(-34, -8, 34, -8, 70, -18); g.bezierCurveTo(62, 66, -62, 66, -70, -18); g.closePath(); };
    shape(); g.fillStyle = INSIDE; g.fill();
    g.save(); shape(); g.clip();
    g.fillStyle = '#e0707c'; g.beginPath(); g.ellipse(0, 50, 36, 22, 0, 0, TAU); g.fill();
    g.fillStyle = '#fffaf4'; g.beginPath(); g.moveTo(-74, -22); g.lineTo(74, -22); g.lineTo(60, 2); g.bezierCurveTo(30, 12, -30, 12, -60, 2); g.closePath(); g.fill();
    g.restore();
    shape(); g.strokeStyle = LIP; g.lineWidth = 8; g.stroke();
    g.strokeStyle = LIP_LIGHT; g.lineWidth = 6;
    g.beginPath(); g.moveTo(-46, 40); g.bezierCurveTo(-20, 56, 20, 56, 46, 40); g.stroke();
  } else {
    // Closed lips; 'flat' is narrower with the corners level.
    const flat = e.mouth === 'flat', c = flat ? 2 : 12;
    if (flat) g.scale(0.72, 0.85);
    g.fillStyle = LIP;
    g.beginPath(); g.moveTo(-60, -10 + (flat ? 8 : 0)); g.bezierCurveTo(-34, -16, -14, -24, 0, -15); g.bezierCurveTo(14, -24, 34, -16, 60, -10 + (flat ? 8 : 0));
    g.bezierCurveTo(30, c, -30, c, -60, -10 + (flat ? 8 : 0)); g.closePath(); g.fill();
    g.fillStyle = LIP_LIGHT;
    g.beginPath(); g.moveTo(-54, -5 + (flat ? 5 : 0)); g.bezierCurveTo(-28, c + 1, 28, c + 1, 54, -5 + (flat ? 5 : 0)); g.bezierCurveTo(34, 36, -34, 36, -54, -5 + (flat ? 5 : 0)); g.closePath(); g.fill();
    g.strokeStyle = '#7c2f3c'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(-66, flat ? -2 : -14); g.bezierCurveTo(-32, c, 32, c, 66, flat ? -2 : -14); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.28)';
    g.beginPath(); g.ellipse(4, 16, 16, 5, 0, 0, TAU); g.fill();
  }
  g.restore();

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
