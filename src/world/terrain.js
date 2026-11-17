// Sheltered Cove terrain: an analytic heightfield sampled on a 1 m grid, plus a
// second "roof" layer over the sea cave so the headland can be walked above it.
import * as THREE from 'three';
import { clamp, lerp, smoothstep, fbm, noise2, distSeg, nearestOnPath, smax } from '../core/util.js';

export const X0 = -130, Z0 = -160, NX = 321, NZ = 321;
export const WORLD_W = NX - 1, WORLD_D = NZ - 1;
const at = (i, j) => j * NX + i;

// ---- Layout (metres; +x east, +z south) -----------------------------------
export const COVE = { x: 30, z: 8, r: 34 };
export const PATH = [
  [-11, 11, 0.7], [-19, 2, 1.9], [-25, -12, 4.2], [-22, -26, 6.0], [-12, -36, 7.1],
  [0, -40, 7.6], [14, -38, 7.7], [36, -34, 7.7], [52, -37, 7.7], [62, -38, 7.8], [70, -37, 7.7], [75, -35.6, 7.6],
];
export const CLEFT = [[17, -43.5, 7.5], [24, -44.5, 4.3], [30.5, -43.5, 1.2], [33.5, -42.5, 0.55]];
export const CAVE = { x: 36, zMouth: -27, zLedge: -37, zBack: -45 };
export const POI = {
  start: { x: 1, z: 35.5 },
  canoe: { x: 12.5, z: 30.5, heading: 2.0 },
  tin: { x: 38.6, z: -42.6 },
  lookout: { x: 78, z: -34.5 }, // on the plateau's east lip, facing the whale grounds
  whale: { x: 128, z: -16 },
  islet: { x: 96, z: 20 },
  shelfTip: { x: 61, z: 47.5 },
  caveView: { x: 8, z: -18.5 },
  sign: { x: -9.5, z: 13.5 },
};
const REEFS = [
  // x, z, rx, rz, top (m). Tops above -0.35 block the canoe.
  [80, -13, 8, 5, -0.15], [85, -1, 5, 6, -0.2], [81, 25, 6, 6, -0.15], [74, 35, 7, 5, -0.2],
  [36, 17, 6, 4, -1.15], [49, 5, 5, 5, -1.2], [29, 1, 4, 5, -1.1], [45, 25, 6, 4, -1.2], [58, 14, 5, 4, -1.4],
];

const H = new Float32Array(NX * NZ);      // walkable/visible ground (cave carved)
const H0 = new Float32Array(NX * NZ);     // ground with the cave filled (roof top)
const SD = new Float32Array(NX * NZ);     // signed distance inland from the general coast
const ROCK = new Float32Array(NX * NZ);
const REEF = new Float32Array(NX * NZ);
const PATHW = new Float32Array(NX * NZ);
const CAVEW = new Float32Array(NX * NZ);
const roofCell = new Uint8Array(NX * NZ);

function natural(x, z, k) {
  const wob = fbm(z * 0.018 + 7.3, 2.1, 3) * 9;
  const taper = Math.max(0, Math.abs(z) - 95);
  const sdWest = 46 + wob - x - taper * taper * 0.045;
  const dCove = Math.hypot(x - COVE.x, z - COVE.z) - COVE.r + fbm(x * 0.06 + 3, z * 0.06, 2) * 2.2;
  const sdGen = Math.min(sdWest, dCove);
  const sdS = 8 + fbm(x * 0.08, z * 0.08 + 5, 2) * 2.5 - distSeg(x, z, 6, 52, 60, 49);
  const sdR = 6 + fbm(x * 0.09 + 20, z * 0.09, 2) * 1.5 - distSeg(x, z, 0, 60, 62, 56);
  const sdH = 14 + fbm(x * 0.07 + 11, z * 0.07, 2) * 2 - distSeg(x, z, 6, -40, 76, -38);
  const rockSd = Math.max(sdH, sdR, sdS);
  const sd = smax(smax(sdGen, sdS, 3), smax(sdH, sdR, 3), 3);

  let h;
  if (sd < 0) {
    const drop = 1.3 * smoothstep(0, 2.5, -sd) * smoothstep(-14, -4, rockSd);
    h = Math.max(-14, sd * 0.11 - drop);
  } else {
    const ridged = 1 - Math.abs(fbm(x * 0.012 + 50, z * 0.012, 4)) * 2;
    h = 0.085 * Math.min(sd, 14)
      + smoothstep(12, 26, sd) * 2.6
      + smoothstep(24, 50, sd) * (26 + fbm(x * 0.03, z * 0.03, 3) * 14)
      + smoothstep(45, 130, sd) * (18 + ridged * 26);
  }
  if (sdH > 0) h = Math.max(h, 7.6 * smoothstep(0, 6.5, sdH) + fbm(x * 0.2, z * 0.2, 2) * 0.55 * smoothstep(4, 8, sdH));
  if (sdR > 0) h = Math.max(h, 7.2 * smoothstep(0, 5, sdR) + fbm(x * 0.2, z * 0.2 + 9, 2) * 0.5);
  if (sdS > 0) h = Math.max(h, 1.1 * smoothstep(0, 4, sdS) + fbm(x * 0.3, z * 0.3, 2) * 0.22 * smoothstep(1, 4, sdS));

  // Sandy islet beyond the reef.
  const dI = Math.hypot(x - POI.islet.x, z - POI.islet.z);
  if (dI < 14) h = smax(h, 1.25 * (1 - (dI / 9) * (dI / 9)), 0.4);

  // Reef and coral patches.
  let reef = 0;
  for (const [rx, rz, ax, az, top] of REEFS) {
    const q = ((x - rx) / ax) ** 2 + ((z - rz) / az) ** 2;
    if (q < 2.2) {
      const lump = top - q * 1.4 + noise2(x * 0.45, z * 0.45) * 0.25;
      if (lump > h) h = lump;
      reef = Math.max(reef, 1 - smoothstep(0.5, 1.5, q));
    }
  }
  SD[k] = sdGen;
  ROCK[k] = smoothstep(-5, 1.5, rockSd);
  REEF[k] = reef;
  return h;
}

function generate() {
  const near = { d: 0, h: 0, seg: 0, t: 0 };
  for (let j = 0; j < NZ; j++) {
    for (let i = 0; i < NX; i++) {
      const x = X0 + i, z = Z0 + j, k = at(i, j);
      let h = natural(x, z, k);

      // Inland path: flatten a bench along the polyline.
      if (x > -36 && x < 82 && z > -52 && z < 22) {
        nearestOnPath(PATH, x, z, near);
        h = lerp(h, near.h, 1 - smoothstep(2.0, 5.5, near.d));
        PATHW[k] = 1 - smoothstep(0.8, 1.9, near.d + noise2(x * 0.7, z * 0.7) * 0.5);
        // The cleft: a stair trench down from the plateau into the cave.
        if (x > 12 && x < 38 && z < -38) {
          nearestOnPath(CLEFT, x, z, near);
          const w = 1 - smoothstep(1.3, 2.4, near.d);
          h = lerp(h, Math.min(h, near.h), w);
          PATHW[k] = Math.max(PATHW[k], (1 - smoothstep(0.7, 1.4, near.d)) * 0.8);
        }
      }
      H0[k] = h;

      // Sea cave: a channel through the headland with a dry ledge at the back.
      const dx = Math.abs(x - CAVE.x);
      if (dx < 6.5 && z > -47 && z < -18) {
        const w = (1 - smoothstep(4.2, 5.6, dx)) * smoothstep(-46.3, -45, z);
        const floor = z > -33 ? -1.7 : z > CAVE.zLedge ? lerp(0.5, -1.7, (z - CAVE.zLedge) / 4) : 0.5 + noise2(x * 0.6, z * 0.6) * 0.06;
        h = lerp(h, Math.min(h, floor), w);
        CAVEW[k] = w;
      }
      H[k] = h;
    }
  }
  // Roof cells: where the carve removed rock and enough thickness remains above the ceiling.
  for (let j = 0; j < NZ - 1; j++) {
    for (let i = 0; i < NX - 1; i++) {
      const z = Z0 + j;
      if (z < -40 || z > -24) continue;
      let carved = false, thick = true;
      for (const [di, dj] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
        const k = at(i + di, j + dj);
        if (H[k] < H0[k] - 0.05) carved = true;
        if (H0[k] - ceilAt(X0 + i + di, Z0 + j + dj) < 0.45) thick = false;
      }
      if (carved && thick) roofCell[at(i, j)] = 1;
    }
  }
}

export function ceilAt(x, z) {
  const dx = x - CAVE.x;
  return 5.6 - 0.12 * dx * dx + noise2(x * 0.5, z * 0.5) * 0.25;
}

function bilinear(arr, x, z) {
  const fx = clamp(x - X0, 0, NX - 1.001), fz = clamp(z - Z0, 0, NZ - 1.001);
  const i = Math.floor(fx), j = Math.floor(fz);
  const u = fx - i, v = fz - j, k = at(i, j);
  return lerp(lerp(arr[k], arr[k + 1], u), lerp(arr[k + NX], arr[k + NX + 1], u), v);
}

export const heightAt = (x, z) => bilinear(H, x, z);
export const coastAt = (x, z) => bilinear(SD, x, z);
export const rockAt = (x, z) => bilinear(ROCK, x, z);
export const pathAt = (x, z) => bilinear(PATHW, x, z);
export const caveAt = (x, z) => bilinear(CAVEW, x, z);
export const reefAt = (x, z) => bilinear(REEF, x, z);

// The lookout's sightline to the whale grounds (a wedge seaward of the bench) and the
// bench clearing itself: kept free of shrubs, boulders and tall grass so the glass sees water.
const VIEW_COS = Math.cos(0.6), VIEW_LEN = 40;
export function inLookoutView(x, z) {
  const L = POI.lookout, dx = x - L.x, dz = z - L.z, d = Math.hypot(dx, dz);
  if (d < 5) return true;
  if (d > VIEW_LEN) return false;
  const wx = POI.whale.x - L.x, wz = POI.whale.z - L.z;
  return (dx * wx + dz * wz) / (d * Math.hypot(wx, wz)) > VIEW_COS;
}

export function roofAt(x, z) {
  const i = Math.floor(x - X0), j = Math.floor(z - Z0);
  return i >= 0 && j >= 0 && i < NX - 1 && j < NZ - 1 && roofCell[at(i, j)] === 1;
}

// Ground under a walker who is currently at height y (picks the roof layer when above it).
export function groundAt(x, z, y) {
  if (roofAt(x, z) && y > ceilAt(x, z) - 0.4) return bilinear(H0, x, z);
  return bilinear(H, x, z);
}

// True when a point is inside rock or soil (used for camera collision).
export function solidAt(x, y, z) {
  if (y < bilinear(H, x, z)) return true;
  return roofAt(x, z) && y > ceilAt(x, z) && y < bilinear(H0, x, z);
}

export function slopeAt(x, z) {
  const e = 1;
  const dx = heightAt(x + e, z) - heightAt(x - e, z);
  const dz = heightAt(x, z + e) - heightAt(x, z - e);
  return Math.hypot(dx, dz) / (2 * e);
}

const _near = { d: 0, h: 0, seg: 0, t: 0 };
export function inPlayZone(x, z) {
  if (z > 64 || z < -57 || x < -45 || x > 110) return false;
  if (coastAt(x, z) > 27) {
    if (nearestOnPath(PATH, x, z, _near).d < 5) return true;
    return false;
  }
  return true;
}

// ---- Colour ----------------------------------------------------------------
const C = (hex) => new THREE.Color(hex);
const PAL = {
  sand: C(0xfbd9a0), sandWet: C(0xe0ac74), seabed: C(0xf0dcae), seabedDeep: C(0x9fb7b0),
  grassA: C(0x86d148), grassB: C(0x4daa3b), grassDark: C(0x3c8f3a),
  cliffGreen: C(0x4b9a45), cliffRock: C(0x7d5d58),
  lava: C(0x3b3442), lavaLight: C(0x6a5f72), lavaWet: C(0x2a2533),
  path: C(0xe6b072), reef: C(0x3f7f6c), caveSand: C(0xe6cba0),
};
const _c = new THREE.Color(), _d = new THREE.Color();

function shade(i, j, h, ny, out) {
  const x = X0 + i, z = Z0 + j, k = at(i, j);
  const sd = SD[k], rock = ROCK[k];
  const n = fbm(x * 0.11, z * 0.11, 3), n2 = noise2(x * 0.83, z * 0.83);

  // Soft land colour: sand → grass → cliff.
  const sandy = 1 - smoothstep(11, 16, sd + n * 5);
  _c.copy(PAL.grassB).lerp(PAL.grassA, clamp(0.5 + n * 1.4, 0, 1));
  _c.lerp(PAL.sand, sandy);
  const cliff = smoothstep(0.84, 0.62, ny) * (1 - sandy);
  _d.copy(PAL.cliffGreen).lerp(PAL.cliffRock, clamp(0.45 + n2 * 0.6 + n, 0, 1));
  _c.lerp(_d, cliff);
  if (h > 20) _c.lerp(PAL.grassDark, smoothstep(20, 50, h) * 0.5);

  // Lava rock, with green growing on the flat headland top.
  _d.copy(PAL.lava).lerp(PAL.lavaLight, clamp(0.4 + n * 0.9 + n2 * 0.35, 0, 1));
  if (h > 4.5 && ny > 0.86) _d.lerp(PAL.grassB, smoothstep(-0.05, 0.2, fbm(x * 0.07 + 40, z * 0.07, 2)) * 0.8);
  if (h < 0.5) _d.lerp(PAL.lavaWet, 1 - smoothstep(-0.2, 0.5, h));
  _c.lerp(_d, rock);

  // The trail crosses over the cave; only the roof surface wears it, not the carved walls below.
  if (h > H0[k] - 0.05) _c.lerp(PAL.path, PATHW[k] * (h > 4.5 ? 0.75 : 0.9));

  // Sand only on the flat floor: wall-foot vertices would smear it up the stretched wall faces.
  if (CAVEW[k] > 0.3 && h < 1.2) _c.lerp(PAL.caveSand, smoothstep(0.3, 0.9, CAVEW[k]) * smoothstep(1.2, 0.7, h) * smoothstep(0.72, 0.93, ny) * 0.9);

  // Shoreline and seabed.
  if (h < 0.4 && rock < 0.6) _c.lerp(PAL.sandWet, (1 - smoothstep(0.02, 0.4, h)) * sandy * (1 - rock));
  if (h < 0) {
    _d.copy(PAL.seabed).lerp(PAL.seabedDeep, smoothstep(-2, -9, h));
    _c.lerp(_d, smoothstep(0, -0.7, h) * (1 - rock * 0.75));
    _c.lerp(PAL.reef, REEF[k] * 0.85);
  }
  const g = 1 + n2 * 0.05;
  out.setRGB(_c.r * g, _c.g * g, _c.b * g);
}

function normalFrom(arr, i, j, out) {
  const i0 = Math.max(0, i - 1), i1 = Math.min(NX - 1, i + 1);
  const j0 = Math.max(0, j - 1), j1 = Math.min(NZ - 1, j + 1);
  const dx = (arr[at(i1, j)] - arr[at(i0, j)]) / (i1 - i0);
  const dz = (arr[at(i, j1)] - arr[at(i, j0)]) / (j1 - j0);
  const l = 1 / Math.hypot(dx, 1, dz);
  out.set(-dx * l, l, -dz * l);
}

export function makeGrainTexture() {
  const s = 256, cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(s, s);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      // Tileable blend of two noise scales: soft blotches plus fine speckle.
      const u = (x / s) * 8, v = (y / s) * 8;
      const a = noise2(u, v) * 0.5 + noise2(u * 4, v * 4) * 0.3;
      const sp = (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
      const val = clamp(0.95 + a * 0.14 + Math.abs(sp) * 0.06 - 0.03, 0, 1) * 255;
      const o = (y * s + x) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = val;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function buildTerrain() {
  generate();
  const grain = makeGrainTexture();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: grain, roughness: 0.95, metalness: 0 });

  // Main heightfield.
  const count = NX * NZ;
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3);
  const col = new Float32Array(count * 3), uv = new Float32Array(count * 2);
  const n = new THREE.Vector3(), c = new THREE.Color();
  for (let j = 0; j < NZ; j++) {
    for (let i = 0; i < NX; i++) {
      const k = at(i, j);
      pos[k * 3] = X0 + i; pos[k * 3 + 1] = H[k]; pos[k * 3 + 2] = Z0 + j;
      normalFrom(H, i, j, n);
      nor[k * 3] = n.x; nor[k * 3 + 1] = n.y; nor[k * 3 + 2] = n.z;
      shade(i, j, H[k], n.y, c);
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
      uv[k * 2] = (X0 + i) * 0.13; uv[k * 2 + 1] = (Z0 + j) * 0.13;
    }
  }
  const index = new Uint32Array((NX - 1) * (NZ - 1) * 6);
  let p = 0;
  for (let j = 0; j < NZ - 1; j++) {
    for (let i = 0; i < NX - 1; i++) {
      const a = at(i, j), b = a + 1, d = a + NX, e = d + 1;
      index[p++] = a; index[p++] = d; index[p++] = b;
      index[p++] = b; index[p++] = d; index[p++] = e;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  const ground = new THREE.Mesh(geo, mat);
  ground.receiveShadow = true; // the heightfield does not cast: distant ridges would shade the whole beach

  const group = new THREE.Group();
  group.add(ground, buildRoof(mat));
  return { group, heightTexture: makeHeightTexture() };
}

function buildRoof(mat) {
  const P = [], N = [], Cc = [], U = [];
  const n = new THREE.Vector3(), c = new THREE.Color(), lava = new THREE.Color();
  const push = (x, y, z, nx, ny, nz, col) => {
    P.push(x, y, z); N.push(nx, ny, nz); Cc.push(col.r, col.g, col.b); U.push(x * 0.13 + y * 0.07, z * 0.13 + y * 0.07);
  };
  const top = (i, j) => {
    const k = at(i, j);
    normalFrom(H0, i, j, n); shade(i, j, H0[k], n.y, c);
    // shade() reads the carved cave mask; the roof top should stay rock/grass.
    if (CAVEW[k] > 0.3) { lava.copy(PAL.lava).lerp(PAL.grassB, smoothstep(-0.05, 0.2, fbm((X0 + i) * 0.07 + 40, (Z0 + j) * 0.07, 2)) * 0.8); c.copy(lava); }
    push(X0 + i, H0[k], Z0 + j, n.x, n.y, n.z, c);
  };
  const under = (i, j) => {
    const x = X0 + i, z = Z0 + j;
    const y = Math.min(ceilAt(x, z), H0[at(i, j)] - 0.2);
    lava.copy(PAL.lavaWet).lerp(PAL.lavaLight, clamp(0.35 + noise2(x * 0.6, z * 0.6) * 0.5, 0, 1));
    push(x, y, z, 0.24 * (x - CAVE.x) / 5, -1, 0, lava);
    return y;
  };
  const wall = (i0, j0, i1, j1, nx, nz) => {
    const pts = [[i0, j0], [i1, j1]].map(([i, j]) => {
      const x = X0 + i, z = Z0 + j;
      return [x, H0[at(i, j)], Math.min(ceilAt(x, z), H0[at(i, j)] - 0.2), z];
    });
    lava.copy(PAL.lava).lerp(PAL.lavaLight, 0.35);
    const [a, b] = pts;
    push(a[0], a[1], a[3], nx, 0.2, nz, lava); push(a[0], a[2], a[3], nx, -0.2, nz, lava); push(b[0], b[1], b[3], nx, 0.2, nz, lava);
    push(b[0], b[1], b[3], nx, 0.2, nz, lava); push(a[0], a[2], a[3], nx, -0.2, nz, lava); push(b[0], b[2], b[3], nx, -0.2, nz, lava);
  };
  const isRoof = (i, j) => i >= 0 && j >= 0 && roofCell[at(i, j)] === 1;
  for (let j = 0; j < NZ - 1; j++) {
    for (let i = 0; i < NX - 1; i++) {
      if (!isRoof(i, j)) continue;
      top(i, j); top(i, j + 1); top(i + 1, j);
      top(i + 1, j); top(i, j + 1); top(i + 1, j + 1);
      under(i, j); under(i + 1, j); under(i, j + 1);
      under(i + 1, j); under(i + 1, j + 1); under(i, j + 1);
      if (!isRoof(i - 1, j)) wall(i, j, i, j + 1, -1, 0);
      if (!isRoof(i + 1, j)) wall(i + 1, j, i + 1, j + 1, 1, 0);
      if (!isRoof(i, j - 1)) wall(i, j, i + 1, j, 0, -1);
      if (!isRoof(i, j + 1)) wall(i, j + 1, i + 1, j + 1, 0, 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  const m = mat.clone();
  m.side = THREE.DoubleSide;
  const roof = new THREE.Mesh(geo, m);
  roof.castShadow = true;
  roof.receiveShadow = true;
  return roof;
}

function makeHeightTexture() {
  const data = new Uint16Array(NX * NZ);
  for (let k = 0; k < NX * NZ; k++) data[k] = THREE.DataUtils.toHalfFloat(clamp(H[k], -20, 20));
  const tex = new THREE.DataTexture(data, NX, NZ, THREE.RedFormat, THREE.HalfFloatType);
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}
