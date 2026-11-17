// Procedural vegetation: coconut palms, broadleaf plants, grass tufts, shrubs,
// hibiscus and the jungle canopy on the hills. Everything is instanced.
import * as THREE from 'three';
import { rng, lerp, clamp, TAU, noise2, nearestOnPath } from '../core/util.js';
import { heightAt, coastAt, rockAt, pathAt, slopeAt, caveAt, roofAt, PATH, CLEFT, POI } from './terrain.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GeoBuilder, addSway, addCollider, setInstance } from './common.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const C = (hex) => new THREE.Color(hex);

function trunkGeometry(hgt, lean) {
  const segs = 22, rad = 8;
  const pos = [], col = [], idx = [];
  const a = C(0x9c6f4c), b = C(0xc9a074), c = new THREE.Color();
  for (let s = 0; s <= segs; s++) {
    const t = s / segs;
    const cx = lean * t * t * hgt * 0.3, cy = t * hgt;
    const r = lerp(0.3, 0.17, t) * (1 + 0.6 * Math.exp(-t * 12)) * (s % 2 ? 1.06 : 0.96);
    c.copy(a).lerp(b, s % 2 ? 0.75 : 0.15);
    for (let k = 0; k < rad; k++) {
      const an = (k / rad) * TAU;
      pos.push(cx + Math.cos(an) * r, cy, Math.sin(an) * r);
      col.push(c.r, c.g, c.b);
    }
  }
  for (let s = 0; s < segs; s++) {
    for (let k = 0; k < rad; k++) {
      const i0 = s * rad + k, i1 = s * rad + ((k + 1) % rad), j0 = i0 + rad, j1 = i1 + rad;
      idx.push(i0, j0, i1, i1, j0, j1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function crownGeometry(r, hgt, lean) {
  const gb = new GeoBuilder();
  const top = V(lean * hgt * 0.3, hgt - 0.1, 0);
  const dark = C(0x2f8f3d), mid = C(0x58b944), light = C(0xb4e25a);
  const nF = 13;
  for (let f = 0; f < nF; f++) {
    const az = (f / nF) * TAU + (r() - 0.5) * 0.35;
    const L = 3.4 + r() * 1.2;
    const rise = f % 3 === 0 ? 0.75 + r() * 0.3 : 0.2 + r() * 0.45;
    const P = (s) => V(top.x + Math.cos(az) * L * s, top.y + L * (rise * s - (0.5 + rise * 0.55) * s * s), top.z + Math.sin(az) * L * s);
    const side = V(-Math.sin(az), 0, Math.cos(az));
    const n = 13;
    for (let i = 0; i < n; i++) {
      const s = 0.08 + 0.92 * (i / (n - 1));
      const ds = (0.92 / (n - 1)) * 0.62;
      const ll = (0.3 + 0.95 * Math.sin(Math.PI * Math.pow(s, 0.75))) * 0.95;
      const pa = P(s - ds), pb = P(s + ds);
      const cb = dark.clone().lerp(mid, s);
      for (const sg of [-1, 1]) {
        const tip = P(Math.min(1, s + ds * 1.6)).addScaledVector(side, sg * ll).add(V(0, -0.5 * ll, 0));
        gb.tri(pa, pb, tip, cb, cb, light);
      }
    }
  }
  const nut = new THREE.IcosahedronGeometry(0.2, 1);
  for (let i = 0; i < 4; i++) {
    const an = (i / 4) * TAU + 0.4;
    gb.add(nut.clone(), C(i % 2 ? 0x8a5a2b : 0x6f8f2f), new THREE.Matrix4().makeTranslation(top.x + Math.cos(an) * 0.28, top.y - 0.25, top.z + Math.sin(an) * 0.28));
  }
  return gb.build();
}

function leafPlantGeometry(r, { leaves = 9, len = 1.1, width = 0.2, flower = false, dark = 0x23803f, light = 0x8ddb55 }) {
  const gb = new GeoBuilder();
  const cd = C(dark), cl = C(light);
  for (let l = 0; l < leaves; l++) {
    const az = (l / leaves) * TAU + (r() - 0.5) * 0.6;
    const tilt = 0.25 + r() * 0.6, L = len * (0.65 + r() * 0.55), droop = 0.8 + r() * 0.9;
    const dir = V(Math.cos(az), 0, Math.sin(az)), side = V(-Math.sin(az), 0, Math.cos(az));
    const segs = 5;
    let p = V(0, 0, 0), prev = null;
    const tint = 0.85 + r() * 0.3;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const th = tilt + droop * t * t;
      const w = width * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.92 + 0.06)), 0.8);
      const up = V(0, 1, 0).multiplyScalar(Math.cos(th)).addScaledVector(dir, Math.sin(th));
      const lift = V(0, 1, 0).multiplyScalar(Math.sin(th)).addScaledVector(dir, -Math.cos(th)).multiplyScalar(w * 0.35);
      const cur = {
        m: p.clone(),
        a: p.clone().addScaledVector(side, w).add(lift),
        b: p.clone().addScaledVector(side, -w).add(lift),
        c: cd.clone().lerp(cl, t).multiplyScalar(tint),
      };
      if (prev) {
        gb.quad(prev.a, prev.m, cur.m, cur.a, prev.c, prev.c, cur.c, cur.c);
        gb.quad(prev.m, prev.b, cur.b, cur.m, prev.c, prev.c, cur.c, cur.c);
      }
      prev = cur;
      p = p.clone().addScaledVector(up, L / segs);
    }
  }
  if (flower) {
    // Red ginger: a stem and a stacked bract cone.
    const stemC = C(0x3f9a45), red = C(0xf2385d), pink = C(0xff8fa8);
    const stem = new THREE.CylinderGeometry(0.018, 0.025, len * 0.95, 5);
    gb.add(stem, stemC, new THREE.Matrix4().makeTranslation(0.03, len * 0.47, 0.02));
    const cone = new THREE.ConeGeometry(0.06, 0.26, 7, 3);
    gb.add(cone, (v, c) => c.copy(red).lerp(pink, clamp((v.y - len * 0.95) / 0.26, 0, 1)), new THREE.Matrix4().makeTranslation(0.03, len * 1.08, 0.02));
  }
  return gb.build();
}

function tuftGeometry(r) {
  const gb = new GeoBuilder();
  const a = C(0x4fae3a), b = C(0xc4ec6b);
  for (let i = 0; i < 7; i++) {
    const az = r() * TAU, h = 0.25 + r() * 0.3, lean = 0.1 + r() * 0.25, w = 0.035;
    const d = V(Math.cos(az), 0, Math.sin(az)), s = V(-Math.sin(az), 0, Math.cos(az));
    const base = d.clone().multiplyScalar(r() * 0.12);
    const m = base.clone().addScaledVector(d, lean * 0.4).add(V(0, h * 0.6, 0));
    const tip = base.clone().addScaledVector(d, lean).add(V(0, h, 0));
    const c1 = a.clone().lerp(b, 0.5);
    gb.quad(base.clone().addScaledVector(s, w), base.clone().addScaledVector(s, -w), m.clone().addScaledVector(s, -w * 0.7), m.clone().addScaledVector(s, w * 0.7), a, a, c1, c1);
    gb.tri(m.clone().addScaledVector(s, w * 0.7), m.clone().addScaledVector(s, -w * 0.7), tip, c1, c1, b);
  }
  return gb.build();
}

function puffGeometry(r, blobs, detail) {
  const gb = new GeoBuilder();
  const lo = C(0x8a8a8a), hi = C(0xffffff);
  for (let i = 0; i < blobs; i++) {
    const g = new THREE.IcosahedronGeometry(1, detail);
    const p = g.attributes.position, seed = r() * 50;
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k), y = p.getY(k), z = p.getZ(k);
      const d = 1 + 0.22 * noise2(x * 1.7 + seed, y * 1.7 + z * 2.1);
      p.setXYZ(k, x * d, y * d * 0.82, z * d);
    }
    const s = blobs === 1 ? 1 : 0.55 + r() * 0.35;
    const an = r() * TAU, off = blobs === 1 ? 0 : 0.55;
    const m = new THREE.Matrix4().makeScale(s, s, s).setPosition(Math.cos(an) * off, s * 0.55 + (blobs === 1 ? 0 : r() * 0.3), Math.sin(an) * off);
    gb.add(g, (v, c) => c.copy(lo).lerp(hi, THREE.MathUtils.clamp(v.y * 0.6 + 0.35, 0, 1)), m);
  }
  // Weld shared vertices so each blob shades as a soft mound rather than facets.
  const geo = gb.build();
  geo.deleteAttribute('normal');
  const welded = mergeVertices(geo, 1e-3);
  welded.computeVertexNormals();
  return welded;
}

export function hibiscusGeometry() {
  const gb = new GeoBuilder();
  const deep = C(0xe01f7a), pink = C(0xff73b0), edge = C(0xffa3cc), yellow = C(0xffd84a);
  for (let pI = 0; pI < 5; pI++) {
    const a0 = (pI / 5) * TAU;
    const n = 5, pts = [];
    for (let k = 0; k <= n; k++) {
      const an = a0 + (k / n - 0.5) * 1.3;
      const rad = 0.72 + 0.28 * Math.sin((Math.PI * k) / n);
      pts.push(V(Math.cos(an) * rad, 0.3 * rad * rad, Math.sin(an) * rad));
    }
    const mid = V(Math.cos(a0) * 0.45, 0.04, Math.sin(a0) * 0.45);
    const cen = V(0, 0, 0);
    for (let k = 0; k < n; k++) {
      gb.tri(mid, pts[k + 1], pts[k], pink, edge, edge);
    }
    gb.tri(cen, mid, pts[0], deep, pink, edge);
    gb.tri(cen, pts[n], mid, deep, edge, pink);
  }
  const st = new THREE.CylinderGeometry(0.035, 0.05, 0.6, 5);
  gb.add(st, yellow, new THREE.Matrix4().makeRotationZ(0.25).setPosition(0.05, 0.3, 0));
  const tipG = new THREE.IcosahedronGeometry(0.09, 0);
  gb.add(tipG, yellow, new THREE.Matrix4().makeTranslation(-0.02, 0.62, 0));
  return gb.build();
}

const near = { d: 0, h: 0, seg: 0, t: 0 };
const offPath = (x, z, m) => nearestOnPath(PATH, x, z, near).d > m && nearestOnPath(CLEFT, x, z, near).d > m;

export function buildFlora() {
  const group = new THREE.Group();
  const r = rng(808);

  // ---- Palms ----------------------------------------------------------------
  const trunkMat = addSway(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), 0.35, 1 / 8);
  const crownMat = addSway(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide }), 0.35, 1 / 8);
  const palmSpots = [
    [-10, 41, 2.6, 1.1], [-15, 27, 0.6, 0.95], [-13, 17, 5.2, 1.0], [-6, 49, 2.2, 0.9], [-19, 37, 4, 1.05],
    [-17, -4, 0.3, 0.9], [-29, -8, 3.5, 1.1], [-27, -22, 5.9, 1.0], [-17, -31, 1.2, 0.95], [-6, -24, 5.2, 0.85],
    [8, -42, 3.3, 0.8], [50, -41.5, 0.8, 0.85], [96, 21, 1.2, 0.8], [99, 17, 4.4, 0.65], [-22, 12, 2, 1.1],
    [-2, 56, 4.6, 0.9], [-26, 26, 1, 1.15], [-30, 4, 2.4, 1.05], [-9, -44, 3.6, 0.9], [22, -34, 5.0, 0.75],
  ];
  const variants = [[8.4, 1.0], [7.2, 1.7], [9.4, 0.5]].map(([h, lean]) => ({
    trunk: new THREE.InstancedMesh(trunkGeometry(h, lean), trunkMat, palmSpots.length),
    crown: new THREE.InstancedMesh(crownGeometry(r, h, lean), crownMat, palmSpots.length),
    n: 0,
  }));
  palmSpots.forEach(([x, z, rot, s], i) => {
    const v = variants[i % variants.length], y = heightAt(x, z) - 0.15;
    setInstance(v.trunk, v.n, x, y, z, rot, s);
    setInstance(v.crown, v.n, x, y, z, rot, s);
    v.n++;
    addCollider(x, z, 0.42 * s);
  });
  for (const v of variants) {
    v.trunk.count = v.crown.count = v.n;
    v.trunk.castShadow = v.crown.castShadow = true;
    v.trunk.receiveShadow = true;
    group.add(v.trunk, v.crown);
  }

  // ---- Broadleaf plants (ti-like leaves, some with red ginger) -----------------
  const leafMat = addSway(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide }), 0.07, 1);
  const leafKinds = [
    { geo: leafPlantGeometry(r, { leaves: 10, len: 1.15, width: 0.2, flower: true }), max: 90, w: 0.25 },
    { geo: leafPlantGeometry(r, { leaves: 8, len: 0.95, width: 0.26, dark: 0x1f7a44, light: 0x79d260 }), max: 170, w: 0.45 },
    { geo: leafPlantGeometry(r, { leaves: 12, len: 1.15, width: 0.15, dark: 0x2c8a3a, light: 0xa6e05a }), max: 130, w: 0.3 },
  ].map((k) => ({ ...k, mesh: new THREE.InstancedMesh(k.geo, leafMat, k.max), n: 0 }));
  const landOK = (x, z) => {
    const sd = coastAt(x, z);
    return sd > 13 && sd < 34 && rockAt(x, z) < 0.3 && pathAt(x, z) < 0.05 && slopeAt(x, z) < 1.1 && heightAt(x, z) > 0.8;
  };
  const plantAt = (x, z, kind, s) => {
    if (kind.n >= kind.max) return;
    setInstance(kind.mesh, kind.n++, x, heightAt(x, z) - 0.03, z, r() * TAU, s, s * (0.9 + r() * 0.3), s);
  };
  // Hero dressing near the start, as in the concept: ginger and broad leaves by the path mouth.
  for (const [x, z, k, s] of [[-13, 15, 0, 1.3], [-14.5, 12, 1, 1.4], [-8, 16.5, 0, 1.2], [-16.5, 8.5, 0, 1.25], [-12, 30, 1, 1.5], [-14, 34, 2, 1.3],
    [-13.5, 23, 0, 1.3], [-15, 44, 1, 1.6], [-12.5, 47, 2, 1.4], [-22, 5, 0, 1.2], [-21, -6, 0, 1.3], [-28, -15, 1, 1.5], [-19, -17, 2, 1.2], [-18, -28, 0, 1.3], [-26, -29, 1, 1.4]]) {
    plantAt(x, z, leafKinds[k], s);
  }
  for (let i = 0; i < 5200; i++) {
    const x = -48 + r() * 100, z = -58 + r() * 124;
    if (!landOK(x, z)) continue;
    const pick = r();
    const kind = pick < 0.22 ? leafKinds[0] : pick < 0.65 ? leafKinds[1] : leafKinds[2];
    // Denser near the path edges and the back of the beach.
    const edge = nearestOnPath(PATH, x, z, near).d;
    if (edge > 7 && coastAt(x, z) > 17 && r() < 0.55) continue;
    plantAt(x, z, kind, 0.7 + r() * 0.6);
  }
  for (const k of leafKinds) { k.mesh.count = k.n; k.mesh.castShadow = true; group.add(k.mesh); }

  // ---- Grass tufts -------------------------------------------------------------
  const tuftMat = addSway(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }), 0.5, 1.6);
  const tufts = new THREE.InstancedMesh(tuftGeometry(r), tuftMat, 1500);
  let nT = 0;
  for (let i = 0; i < 9000 && nT < 1500; i++) {
    const x = -46 + r() * 122, z = -56 + r() * 122;
    const sd = coastAt(x, z), h = heightAt(x, z), top = rockAt(x, z) > 0.6 && h > 6.8 && !roofAt(x, z);
    const ok = (sd > 10 && sd < 30 && rockAt(x, z) < 0.3) || top;
    if (!ok || pathAt(x, z) > 0.25 || slopeAt(x, z) > 0.7 || h < 0.7 || caveAt(x, z) > 0.1) continue;
    setInstance(tufts, nT++, x, h, z, r() * TAU, 1 + r() * 1.3);
  }
  tufts.count = nT;
  group.add(tufts);

  // ---- Shrubs and jungle canopy ---------------------------------------------------
  const puffMat = addSway(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), 0.03, 1);
  const shrubs = new THREE.InstancedMesh(puffGeometry(r, 3, 1), puffMat, 420);
  const tint = new THREE.Color();
  const greens = [0x4fb043, 0x6cc644, 0x3f9a45, 0x7fd04f, 0x58b84a];
  let nS = 0;
  const shrubAt = (x, z, s, collide) => {
    if (nS >= 420) return;
    setInstance(shrubs, nS, x, heightAt(x, z) - 0.15 * s, z, r() * TAU, s, s * (0.8 + r() * 0.3), s);
    shrubs.setColorAt(nS++, tint.setHex(greens[Math.floor(r() * greens.length)]));
    if (collide) addCollider(x, z, 0.75 * s);
  };
  const flowerBushes = [[-11, 44.5, 1.5], [-7.5, 52, 1.3], [-15, 19, 1.4], [-17.5, 31, 1.6], [-23, -2, 1.3], [-16, -10.5, 1.2], [-27, -19, 1.4], [5, -45, 1.1], [45, -42, 1.0], [-18, 40.5, 1.5]];
  for (const [x, z, s] of flowerBushes) shrubAt(x, z, s, true);
  for (let i = 0; i < 6000 && nS < 420; i++) {
    const x = -50 + r() * 142, z = -60 + r() * 128;
    const sd = coastAt(x, z), h = heightAt(x, z), rock = rockAt(x, z);
    const terrace = sd > 14 && sd < 34 && rock < 0.3;
    const top = rock > 0.6 && h > 6.6 && slopeAt(x, z) < 0.5 && !roofAt(x, z) && caveAt(x, z) < 0.05 && Math.hypot(x - POI.lookout.x, z - POI.lookout.z) > 5;
    if (!(terrace || top) || !offPath(x, z, 2.6) || slopeAt(x, z) > 1.3) continue;
    if (top && r() < 0.45) continue;
    shrubAt(x, z, top ? 0.6 + r() * 0.6 : 0.8 + r() * 1.0, true);
  }
  shrubs.count = nS;
  shrubs.castShadow = true;
  shrubs.receiveShadow = true;
  group.add(shrubs);

  const canopy = new THREE.InstancedMesh(puffGeometry(r, 1, 1), puffMat, 1500);
  const cgreens = [0x3e9a42, 0x4fae45, 0x358a3e, 0x62bd4a, 0x2f7f3c, 0x58b548];
  let nC = 0;
  for (let i = 0; i < 12000 && nC < 1500; i++) {
    const x = -128 + r() * 180, z = -150 + r() * 300;
    const sd = coastAt(x, z), h = heightAt(x, z);
    if (sd < 21 || h < 2.5 || !offPath(x, z, 5.5) || slopeAt(x, z) > 2.2) continue;
    if (sd < 30 && r() < 0.5) continue;
    const s = sd < 34 ? 1.7 + r() * 1.6 : 2.6 + r() * 3.6;
    setInstance(canopy, nC, x, h + s * 0.35, z, r() * TAU, s * (1 + r() * 0.3), s * (0.75 + r() * 0.3), s * (1 + r() * 0.3));
    canopy.setColorAt(nC++, tint.setHex(cgreens[Math.floor(r() * cgreens.length)]).multiplyScalar(0.85 + r() * 0.3));
  }
  canopy.count = nC;
  canopy.receiveShadow = true;
  group.add(canopy);

  // ---- Hibiscus flowers on the feature bushes ----------------------------------------
  const flowerMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide });
  const flowers = new THREE.InstancedMesh(hibiscusGeometry(), flowerMat, flowerBushes.length * 7);
  let nF = 0;
  for (const [x, z, s] of flowerBushes) {
    const y0 = heightAt(x, z);
    for (let k = 0; k < 7; k++) {
      const an = r() * TAU, el = 0.25 + r() * 0.9, rad = s * 0.98;
      const fx = x + Math.cos(an) * Math.cos(el) * rad * 1.05, fz = z + Math.sin(an) * Math.cos(el) * rad * 1.05;
      const fy = y0 + s * 0.45 + Math.sin(el) * rad * 0.7;
      const sc = 0.26 + r() * 0.14;
      setInstance(flowers, nF++, fx, fy, fz, -an + Math.PI / 2, sc, sc, sc, (Math.PI / 2 - el) * 0.9);
    }
  }
  flowers.count = nF;
  group.add(flowers);

  return group;
}
