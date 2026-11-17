// Geometry helpers for the code-built character: lofted body/garment profiles,
// flattened hair strands, the sculpted head surface and the drawn face.
import * as THREE from 'three';
import { TAU } from '../core/util.js';

const cr = (p0, p1, p2, p3, t) => 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);

// Loft of elliptical cross-sections stacked down the y axis (origin at the joint).
// keys: [y, rx, rzFront, rzBack = rzFront, offsetX = 0, offsetZ = 0], in descending y.
// smooth > 0 resamples the keys with a Catmull-Rom spline; roundTop/roundBot close an
// end with a dome; lipBot turns the open bottom edge inward (garment hems).
export function loft(keys, { radial = 14, smooth = 4, roundTop = false, roundBot = false, capTop = true, capBot = true, lipBot = 0 } = {}) {
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

// Draws eyes, lids, brows, blush, freckles and lips into a transparent texture.
export function faceTexture(closed = false) {
  const S = 1024, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const X = (yaw) => S / 2 + (yaw / FACE.yawMax) * (S / 2), Y = (pitch) => S / 2 - (pitch / FACE.pitchMax) * (S / 2);
  const LASH = '#2b1711', BROW = '#3b2117';

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
    const upper = () => { g.moveTo(-88, 12); g.bezierCurveTo(-64, -62, 34, -78, 94, -16); };
    if (closed) {
      g.strokeStyle = LASH; g.lineWidth = 12; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-88, 6); g.bezierCurveTo(-48, 38, 44, 36, 98, -6); g.stroke();
    } else {
      g.save();
      g.beginPath(); upper(); g.bezierCurveTo(62, 46, -44, 56, -88, 12); g.closePath();
      g.fillStyle = '#fffaf4'; g.fill();
      g.clip();
      const ir = g.createRadialGradient(0, 6, 8, 0, -6, 60);
      ir.addColorStop(0, '#9a6234'); ir.addColorStop(0.7, '#6b3d20'); ir.addColorStop(1, '#3a1e10');
      g.fillStyle = ir; g.beginPath(); g.arc(2, -6, 58, 0, TAU); g.fill();
      g.fillStyle = '#1c0e09'; g.beginPath(); g.arc(2, -8, 26, 0, TAU); g.fill();
      const sh = g.createLinearGradient(0, -78, 0, -28);
      sh.addColorStop(0, 'rgba(50,24,16,0.55)'); sh.addColorStop(1, 'rgba(50,24,16,0)');
      g.fillStyle = sh; g.fillRect(-100, -80, 200, 60);
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(2 + sg * -20, -28, 13, 0, TAU); g.fill();
      g.globalAlpha = 0.7; g.beginPath(); g.arc(2 + sg * 18, 12, 6, 0, TAU); g.fill();
      g.restore();
      // Upper lid: tapered lash line with a small wing; soft crease and lower lid.
      g.fillStyle = LASH;
      g.beginPath(); g.moveTo(-90, 13); g.bezierCurveTo(-66, -70, 36, -90, 100, -24); g.lineTo(122, -42);
      g.lineTo(98, -8); g.bezierCurveTo(36, -68, -62, -52, -86, 14); g.closePath(); g.fill();
      g.lineCap = 'round';
      g.strokeStyle = 'rgba(120,62,38,0.5)'; g.lineWidth = 3.5;
      g.beginPath(); g.moveTo(-70, -42); g.bezierCurveTo(-36, -92, 44, -100, 96, -50); g.stroke();
      g.strokeStyle = 'rgba(110,56,34,0.55)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(92, -12); g.bezierCurveTo(62, 48, -44, 58, -84, 16); g.stroke();
    }
    g.restore();

    // Brow: full at the inner end, arched, tapering outwards.
    g.save();
    g.translate(X(sg * (FACE.eyeYaw + 0.01)), Y(FACE.browPitch));
    g.scale(sg, 1);
    g.fillStyle = BROW;
    g.beginPath(); g.moveTo(-78, 6); g.bezierCurveTo(-74, -12, -40, -24, 6, -30); g.bezierCurveTo(48, -34, 84, -18, 104, 4);
    g.bezierCurveTo(70, -10, 40, -12, 6, -8); g.bezierCurveTo(-28, -4, -54, 10, -70, 20); g.bezierCurveTo(-78, 20, -80, 14, -78, 6);
    g.closePath(); g.fill();
    g.restore();
  }

  // Soft shadow under the nose, then the lips.
  const nx = X(0), ny = Y(FACE.nosePitch) + 30;
  const ns = g.createRadialGradient(nx, ny, 0, nx, ny, 34);
  ns.addColorStop(0, 'rgba(120,60,36,0.3)'); ns.addColorStop(1, 'rgba(120,60,36,0)');
  g.fillStyle = ns; g.fillRect(nx - 40, ny - 20, 80, 50);

  g.save();
  g.translate(X(0), Y(FACE.mouthPitch));
  g.scale(1.3, 1.3);
  g.fillStyle = '#b4505f';
  g.beginPath(); g.moveTo(-60, -10); g.bezierCurveTo(-34, -16, -14, -24, 0, -15); g.bezierCurveTo(14, -24, 34, -16, 60, -10);
  g.bezierCurveTo(30, 12, -30, 12, -60, -10); g.closePath(); g.fill();
  g.fillStyle = '#d4707a';
  g.beginPath(); g.moveTo(-54, -5); g.bezierCurveTo(-28, 13, 28, 13, 54, -5); g.bezierCurveTo(34, 36, -34, 36, -54, -5); g.closePath(); g.fill();
  g.strokeStyle = '#7c2f3c'; g.lineWidth = 4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-66, -14); g.bezierCurveTo(-32, 12, 32, 12, 66, -14); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.28)';
  g.beginPath(); g.ellipse(4, 16, 16, 5, 0, 0, TAU); g.fill();
  g.restore();

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
