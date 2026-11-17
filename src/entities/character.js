// The explorer: a jointed 3D figure built in code. The base body is stable; top,
// bottoms, footwear, hair and gear are separate pieces hung on shared joints.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { hibiscusGeometry } from '../world/flora.js';
import { clamp, damp, TAU } from '../core/util.js';

export const WARDROBE = {
  top: {
    tee: { name: 'Shoreline tee', body: 0xfdeaf0, trim: 0x4fc9bd },
    sunset: { name: 'Sunset tee', body: 0xff8f66, trim: 0xffd95a },
  },
  bottoms: {
    shorts: { name: 'Hibiscus shorts', body: 0xf2529d, trim: 0xfff6fa },
  },
  footwear: {
    sneakers: { name: 'Splash sneakers', sock: 0xb9a0e8, shoe: 0xfff7f0, accent: 0xff6fa8, accent2: 0x4fc9bd },
    seafoam: { name: 'Seafoam high-tops', sock: 0xfff6fa, shoe: 0x7fe3d2, accent: 0xffd95a, accent2: 0xff6fa8 },
  },
};
export const SLOT_LABEL = { top: 'Top', bottoms: 'Bottoms', footwear: 'Footwear' };

const matCache = new Map();
function mat(color, roughness = 0.75, extra) {
  const key = `${color}-${roughness}-${extra ? JSON.stringify(extra) : ''}`;
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness, ...extra }));
  return matCache.get(key);
}
function add(parent, geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}
const V2 = (x, y) => new THREE.Vector2(x, y);
const lathe = (pts, seg = 16) => new THREE.LatheGeometry(pts.map(([r, y]) => V2(r, y)), seg);

// Tapered capsule hanging down from a joint (origin at the joint).
function limb(r1, r2, len, seg = 12) {
  const pts = [], n = 5;
  for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (i / n) * (Math.PI / 2); pts.push(V2(Math.cos(a) * r2, -len + Math.sin(a) * r2)); }
  for (let i = 0; i <= n; i++) { const a = (i / n) * (Math.PI / 2); pts.push(V2(Math.cos(a) * r1, Math.sin(a) * r1)); }
  return new THREE.LatheGeometry(pts, seg);
}

function taperTube(points, radiusFn, segs = 14, radial = 6) {
  const curve = new THREE.CatmullRomCurve3(points);
  const frames = curve.computeFrenetFrames(segs, false);
  const pos = [], idx = [], p = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, r = radiusFn(t), N = frames.normals[i], B = frames.binormals[i];
    curve.getPointAt(t, p);
    for (let k = 0; k < radial; k++) {
      const a = (k / radial) * TAU, c = Math.cos(a) * r, s = Math.sin(a) * r;
      pos.push(p.x + N.x * c + B.x * s, p.y + N.y * c + B.y * s, p.z + N.z * c + B.z * s);
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let k = 0; k < radial; k++) {
      const a = i * radial + k, b = i * radial + ((k + 1) % radial), c = a + radial, d = b + radial;
      idx.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

const SKIN = 0xc98b5e, HAIR = 0x4a2a1d, HAIR_LIGHT = 0x6a3c27;

export class Character {
  constructor() {
    this.root = new THREE.Group();
    this.j = {};
    this.slotMeshes = { top: [], bottoms: [], footwear: [] };
    this.outfit = { top: 'tee', bottoms: 'shorts', footwear: 'sneakers' };
    this.phase = 0;
    this.amp = 0;
    this.sit = 0;
    this.reach = 0;
    this.time = 0;
    this.hairVel = 0;
    this.#skeleton();
    this.#body();
    this.#face();
    this.#hair();
    this.#gear();
    for (const slot of Object.keys(this.outfit)) this.setOutfit(slot, this.outfit[slot]);
  }

  #skeleton() {
    const J = this.j;
    const joint = (name, parent, x, y, z) => {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      parent.add(g);
      J[name] = g;
      return g;
    };
    joint('hips', this.root, 0, 0.8, 0);
    joint('spine', J.hips, 0, 0.06, 0);
    joint('chest', J.spine, 0, 0.17, 0);
    joint('neck', J.chest, 0, 0.19, 0);
    joint('head', J.neck, 0, 0.04, 0);
    for (const [s, sg] of [['L', 1], ['R', -1]]) {
      joint('shoulder' + s, J.chest, sg * 0.158, 0.125, 0);
      joint('elbow' + s, J['shoulder' + s], 0, -0.21, 0);
      joint('wrist' + s, J['elbow' + s], 0, -0.19, 0);
      joint('hip' + s, J.hips, sg * 0.088, -0.03, 0);
      joint('knee' + s, J['hip' + s], 0, -0.33, 0);
      joint('ankle' + s, J['knee' + s], 0, -0.34, 0);
    }
  }

  #body() {
    const J = this.j, skin = mat(SKIN, 0.62);
    const pelvis = add(J.hips, new THREE.SphereGeometry(0.15, 18, 12), skin, 0, -0.02, 0);
    pelvis.scale.set(1.08, 0.8, 0.85);
    const torso = add(J.spine, lathe([[0.001, -0.07], [0.125, -0.06], [0.127, 0], [0.114, 0.07], [0.117, 0.14], [0.133, 0.22], [0.138, 0.27], [0.12, 0.31], [0.07, 0.335], [0.001, 0.342]], 18), skin);
    torso.scale.z = 0.74;
    add(J.neck, new THREE.CylinderGeometry(0.042, 0.047, 0.1, 12), skin, 0, -0.01, 0);
    const head = add(J.head, new THREE.SphereGeometry(0.138, 28, 20), skin, 0, 0.14, 0);
    head.scale.set(1, 1.08, 1);
    for (const sg of [1, -1]) {
      const ear = add(J.head, new THREE.SphereGeometry(0.03, 10, 8), skin, sg * 0.134, 0.125, 0);
      ear.scale.set(0.5, 1, 0.8);
      const hoop = add(J.head, new THREE.TorusGeometry(0.03, 0.007, 6, 16), mat(0xff5fa8, 0.35), sg * 0.146, 0.07, 0.005);
      hoop.rotation.y = Math.PI / 2;
    }
    for (const s of ['L', 'R']) {
      add(J['shoulder' + s], limb(0.05, 0.043, 0.21), skin);
      add(J['elbow' + s], limb(0.043, 0.034, 0.19), skin);
      const hand = add(J['wrist' + s], new THREE.SphereGeometry(0.042, 12, 10), skin, 0, -0.04, 0);
      hand.scale.set(0.72, 1.15, 0.52);
      add(J['hip' + s], limb(0.085, 0.062, 0.33, 14), skin);
      add(J['knee' + s], limb(0.062, 0.043, 0.34, 14), skin);
    }
  }

  #face() {
    const head = this.j.head, centre = new THREE.Vector3(0, 0.14, 0);
    const place = (obj, yaw, pitch, r) => {
      const d = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch) * 1.08, Math.cos(yaw) * Math.cos(pitch));
      obj.position.copy(centre).addScaledVector(d, r);
      obj.lookAt(centre.clone().addScaledVector(d, 2));
      head.add(obj);
      return obj;
    };
    const white = mat(0xffffff, 0.3), iris = mat(0x6b3f22, 0.3), dark = mat(0x2a1712, 0.4);
    this.eyes = [];
    for (const sg of [1, -1]) {
      const eye = new THREE.Group();
      const w = add(eye, new THREE.SphereGeometry(0.031, 16, 12), white); w.scale.set(1, 1.18, 0.3);
      const ir = add(eye, new THREE.SphereGeometry(0.022, 14, 10), iris, 0, -0.002, 0.008); ir.scale.z = 0.3;
      const pu = add(eye, new THREE.SphereGeometry(0.012, 10, 8), dark, 0, -0.002, 0.014); pu.scale.z = 0.3;
      const hl = add(eye, new THREE.SphereGeometry(0.0065, 8, 6), mat(0xffffff, 0.2, { emissive: 0xffffff, emissiveIntensity: 0.6 }), sg * 0.007, 0.01, 0.018);
      hl.castShadow = false;
      const lash = add(eye, new THREE.TorusGeometry(0.031, 0.0055, 4, 12, Math.PI), dark, 0, 0.004, 0.006);
      lash.scale.y = 1.18;
      place(eye, sg * 0.4, -0.02, 0.134);
      this.eyes.push(eye);
      const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.0065, 0.04, 3, 6), dark);
      brow.rotation.z = Math.PI / 2 + sg * 0.16;
      const bg = new THREE.Group(); bg.add(brow);
      place(bg, sg * 0.4, 0.42, 0.139);
      const blush = new THREE.Mesh(new THREE.CircleGeometry(0.028, 14), mat(0xff7f96, 0.8, { transparent: true, opacity: 0.38 }));
      place(blush, sg * 0.72, -0.32, 0.1395);
    }
    const nose = add(new THREE.Group(), new THREE.SphereGeometry(0.014, 10, 8), mat(0xbd7f55, 0.6));
    place(nose.parent, 0, -0.2, 0.139);
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.006, 5, 12, Math.PI), mat(0xa63f55, 0.5));
    mouth.rotation.z = Math.PI;
    const mg = new THREE.Group(); mg.add(mouth);
    place(mg, 0, -0.42, 0.136);
  }

  #hair() {
    const head = this.j.head;
    const hairMat = mat(HAIR, 0.5), hairLight = mat(HAIR_LIGHT, 0.5);
    const cap = add(head, new THREE.SphereGeometry(0.153, 24, 18), hairMat, 0, 0.158, -0.03);
    cap.scale.set(1.03, 1.02, 1.04);
    // A soft side-swept fringe on each temple.
    for (const sg of [1, -1]) {
      const g = taperTube([
        new THREE.Vector3(sg * 0.02, 0.305, 0.07), new THREE.Vector3(sg * 0.09, 0.27, 0.105),
        new THREE.Vector3(sg * 0.138, 0.19, 0.075), new THREE.Vector3(sg * 0.15, 0.08, 0.03), new THREE.Vector3(sg * 0.14, -0.02, 0.01),
      ], (t) => 0.04 - t * 0.018, 12, 7);
      add(head, g, hairMat);
    }
    // Long waves: a swaying mass down the back plus individual locks.
    const sway = new THREE.Group();
    sway.position.set(0, 0.2, -0.05);
    head.add(sway);
    this.hairSway = sway;
    for (const [y, z, sx, sy, sz] of [[-0.13, -0.085, 0.17, 0.17, 0.11], [-0.28, -0.15, 0.19, 0.17, 0.1], [-0.43, -0.2, 0.175, 0.16, 0.085]]) {
      const b = add(sway, new THREE.SphereGeometry(1, 16, 12), hairMat, 0, y, z);
      b.scale.set(sx, sy, sz);
    }
    const n = 13;
    for (let i = 0; i < n; i++) {
      const a = ((i / (n - 1)) - 0.5) * 4.6; // around the back, ear to ear
      const len = 0.5 + 0.1 * Math.cos(a * 0.8) + (i % 3) * 0.035;
      const ph = i * 1.9;
      const pts = [];
      for (let k = 0; k <= 6; k++) {
        const t = k / 6;
        const rad = 0.125 + 0.065 * Math.sin(Math.PI * Math.min(1, t * 1.15)) + 0.012 * Math.sin(t * 9 + ph);
        const aa = a + 0.12 * Math.sin(t * 8 + ph);
        pts.push(new THREE.Vector3(Math.sin(aa) * rad, 0.03 - t * len, -Math.cos(aa) * rad * 0.82 + 0.05 - t * 0.12 * Math.max(0, Math.cos(aa))));
      }
      add(sway, taperTube(pts, (t) => 0.05 * (1 - t * 0.55) * (0.9 + 0.2 * Math.sin(t * 10 + ph)), 14, 6), i % 3 === 1 ? hairLight : hairMat);
    }
    const flower = add(head, hibiscusGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: THREE.DoubleSide }), -0.112, 0.235, 0.07);
    flower.scale.setScalar(0.07);
    flower.rotation.set(0.9, 0, 0.95);
  }

  #gear() {
    const J = this.j, aqua = mat(0x5ccfc0, 0.7), aquaDark = mat(0x3fb3a6, 0.7), pink = mat(0xff6fa8, 0.5);
    const pack = new THREE.Group();
    pack.position.set(0, -0.02, -0.185);
    J.chest.add(pack);
    add(pack, new RoundedBoxGeometry(0.27, 0.31, 0.14, 3, 0.05), aqua);
    add(pack, new RoundedBoxGeometry(0.2, 0.14, 0.06, 3, 0.025), aquaDark, 0, -0.065, -0.08);
    add(pack, new RoundedBoxGeometry(0.24, 0.1, 0.05, 3, 0.02), aqua, 0, 0.08, -0.06);
    for (const x of [-0.06, 0.06]) add(pack, new THREE.BoxGeometry(0.03, 0.06, 0.015), pink, x, 0.03, -0.088);
    // Notebook with stickers poking out of the top.
    const book = add(pack, new RoundedBoxGeometry(0.2, 0.2, 0.03, 2, 0.01), mat(0xffc24a, 0.7), 0, 0.14, -0.035);
    book.rotation.x = 0.08;
    const st1 = add(book, new THREE.CircleGeometry(0.038, 12), mat(0xff6fa8, 0.6), -0.045, 0.03, -0.017); st1.rotation.y = Math.PI;
    const st2 = add(book, new THREE.CircleGeometry(0.038, 12), mat(0x4aa8e8, 0.6), 0.048, 0.02, -0.017); st2.rotation.y = Math.PI;
    // Bottle in the side pocket, shell charm, straps.
    add(pack, new THREE.CylinderGeometry(0.036, 0.036, 0.17, 12), mat(0xff7fb8, 0.3), -0.165, -0.03, 0);
    add(pack, new THREE.CylinderGeometry(0.022, 0.03, 0.04, 10), mat(0xd94c8f, 0.4), -0.165, 0.075, 0);
    add(pack, new THREE.CylinderGeometry(0.043, 0.043, 0.09, 12, 1, true), mat(0xb9a0e8, 0.8, { side: THREE.DoubleSide }), -0.165, -0.08, 0);
    const charm = add(pack, new THREE.SphereGeometry(0.035, 10, 8), mat(0xfff0dc, 0.4), 0.05, -0.17, -0.09);
    charm.scale.set(1, 1.1, 0.45);
    for (const sg of [1, -1]) {
      const strap = add(J.chest, new THREE.TorusGeometry(0.115, 0.016, 6, 14, Math.PI * 1.15), aqua, sg * 0.092, 0.06, -0.03);
      strap.rotation.set(0, Math.PI / 2, -0.25);
      strap.scale.z = 0.6;
    }
    // Watch on the left wrist, bead bracelet on the right.
    const band = add(J.wristL, new THREE.TorusGeometry(0.037, 0.011, 6, 14), pink, 0, 0.012, 0);
    band.rotation.x = Math.PI / 2;
    add(J.wristL, new RoundedBoxGeometry(0.04, 0.035, 0.014, 2, 0.006), mat(0xffc1dd, 0.3), 0.036, 0.012, 0).rotation.y = Math.PI / 2;
    const beads = add(J.wristR, new THREE.TorusGeometry(0.037, 0.01, 6, 14), mat(0xff8fc0, 0.35), 0, 0.012, 0);
    beads.rotation.x = Math.PI / 2;
  }

  setOutfit(slot, id) {
    const def = WARDROBE[slot][id];
    if (!def) return;
    this.outfit[slot] = id;
    for (const m of this.slotMeshes[slot]) m.parent.remove(m);
    const list = (this.slotMeshes[slot] = []);
    const put = (...args) => { const m = add(...args); list.push(m); return m; };
    const J = this.j;
    if (slot === 'top') {
      const body = mat(def.body, 0.85), trim = mat(def.trim, 0.7);
      const shell = put(J.spine, lathe([[0.139, 0.03], [0.129, 0.07], [0.13, 0.14], [0.147, 0.22], [0.152, 0.27], [0.132, 0.312], [0.082, 0.34]], 18), body);
      shell.scale.z = 0.77;
      const collar = put(J.spine, new THREE.TorusGeometry(0.068, 0.014, 6, 18), trim, 0, 0.338, 0);
      collar.rotation.x = Math.PI / 2; collar.scale.y = 0.8;
      for (const s of ['L', 'R']) {
        put(J['shoulder' + s], new THREE.SphereGeometry(0.066, 12, 10), body, 0, 0.004, 0);
        put(J['shoulder' + s], new THREE.CylinderGeometry(0.064, 0.068, 0.1, 12, 1, true), body, 0, -0.05, 0);
        const cuff = put(J['shoulder' + s], new THREE.TorusGeometry(0.066, 0.012, 6, 14), trim, 0, -0.1, 0);
        cuff.rotation.x = Math.PI / 2;
      }
    } else if (slot === 'bottoms') {
      const body = mat(def.body, 0.8), trim = mat(def.trim, 0.7);
      const shell = put(J.hips, lathe([[0.001, -0.15], [0.11, -0.14], [0.154, -0.105], [0.16, -0.03], [0.148, 0.05], [0.138, 0.085]], 18), body);
      shell.scale.z = 0.82;
      const band = put(J.hips, new THREE.TorusGeometry(0.136, 0.013, 6, 18), trim, 0, 0.082, 0);
      band.rotation.x = Math.PI / 2; band.scale.y = 0.8;
      for (const s of ['L', 'R']) {
        put(J['hip' + s], new THREE.CylinderGeometry(0.089, 0.101, 0.14, 14, 1, true), body, 0, -0.07, 0);
        const hem = put(J['hip' + s], new THREE.TorusGeometry(0.1, 0.012, 6, 16), trim, 0, -0.14, 0);
        hem.rotation.x = Math.PI / 2;
      }
    } else if (slot === 'footwear') {
      const sock = mat(def.sock, 0.9), shoe = mat(def.shoe, 0.6), ac = mat(def.accent, 0.5), ac2 = mat(def.accent2, 0.5);
      for (const s of ['L', 'R']) {
        const shin = J['knee' + s], foot = J['ankle' + s];
        put(shin, new THREE.CylinderGeometry(0.05, 0.047, 0.12, 12), sock, 0, -0.275, 0);
        for (const y of [-0.215, -0.25, -0.285]) {
          const ring = put(shin, new THREE.TorusGeometry(0.05, 0.019, 6, 14), sock, 0, y, 0);
          ring.rotation.x = Math.PI / 2;
        }
        put(foot, new RoundedBoxGeometry(0.108, 0.05, 0.255, 3, 0.022), shoe, 0, -0.072, 0.045);
        put(foot, new RoundedBoxGeometry(0.112, 0.016, 0.26, 2, 0.006), ac, 0, -0.062, 0.045);
        const upper = put(foot, new THREE.SphereGeometry(0.06, 14, 10), shoe, 0, -0.03, 0.04);
        upper.scale.set(0.86, 0.82, 1.9);
        put(foot, new THREE.CylinderGeometry(0.052, 0.055, 0.06, 12), shoe, 0, 0.005, -0.005);
        const toe = put(foot, new THREE.SphereGeometry(0.045, 10, 8), ac2, 0, -0.05, 0.135);
        toe.scale.set(1.05, 0.55, 0.8);
        for (const z of [0.03, 0.06, 0.09]) put(foot, new THREE.BoxGeometry(0.07, 0.008, 0.012), ac, 0, 0.012 - (z - 0.03) * 0.28, z);
        put(foot, new THREE.BoxGeometry(0.03, 0.05, 0.012), ac2, 0, -0.01, -0.062);
      }
    }
  }

  // state: { speed (m/s), sitting, wading (0..1) }
  update(dt, state) {
    this.time += dt;
    const J = this.j, t = this.time;
    const amp = (this.amp = damp(this.amp, clamp(state.speed / 3.4, 0, 1), 10, dt));
    const sit = (this.sit = damp(this.sit, state.sitting ? 1 : 0, 7, dt));
    this.reach = damp(this.reach, state.reaching ? 1 : 0, 8, dt);
    this.phase += state.speed * dt * 2.75;
    const sw = Math.sin(this.phase), cw = Math.cos(this.phase);
    const idle = 1 - amp, breath = Math.sin(t * 1.7);
    const st = 1 - sit;

    // Hips and torso.
    J.hips.position.y = (0.8 - amp * 0.025 + Math.abs(cw) * 0.035 * amp + breath * 0.004 * idle) * st + 0.15 * sit;
    J.hips.rotation.set(0.04 * amp * st, -sw * 0.1 * amp * st, sw * 0.03 * amp * st);
    J.spine.rotation.set((0.09 * amp + this.reach * 0.5) * st - 0.05 * sit, sw * 0.14 * amp * st, 0);
    J.chest.rotation.set(breath * 0.012, sw * 0.08 * amp * st, 0);
    J.head.rotation.set(-0.05 * amp + Math.sin(t * 0.6) * 0.03 * idle + this.reach * 0.2, Math.sin(t * 0.37) * 0.12 * idle, 0);

    // Legs.
    for (const [s, sg] of [['L', 1], ['R', -1]]) {
      const ph = this.phase + (sg > 0 ? 0 : Math.PI);
      const swing = Math.sin(ph);
      const lift = Math.max(0, Math.sin(ph + 1.1));
      J['hip' + s].rotation.set((-swing * 0.72 * amp) * st - 1.48 * sit, 0, sg * 0.03 * st + sg * 0.1 * sit);
      J['knee' + s].rotation.x = (0.08 + lift * 1.05 * amp) * st + 1.35 * sit;
      J['ankle' + s].rotation.x = (swing * 0.25 * amp - lift * 0.3 * amp) * st + 0.1 * sit;
      // Arms swing opposite the legs; resting they hang slightly out from the body.
      const arm = -swing;
      J['shoulder' + s].rotation.set(
        (arm * 0.62 * amp + Math.sin(t * 1.1 + sg) * 0.03 * idle - this.reach * (sg > 0 ? 0 : 1.1)) * st - 0.55 * sit,
        0,
        sg * (0.13 + 0.04 * amp) * st + sg * 0.22 * sit,
      );
      J['elbow' + s].rotation.x = -(0.18 + 0.5 * amp + Math.max(0, arm) * 0.35 * amp + this.reach * (sg > 0 ? 0 : 0.5)) * st - 0.75 * sit;
    }

    // Hair follows with a little lag.
    const target = -clamp(state.speed * 0.045, 0, 0.3) * st + Math.sin(this.phase * 2) * 0.035 * amp;
    this.hairVel += ((target - this.hairSway.rotation.x) * 60 - this.hairVel * 9) * dt;
    this.hairSway.rotation.x += this.hairVel * dt;
    this.hairSway.rotation.z = Math.sin(t * 1.3) * 0.02 + sw * 0.03 * amp;

    // Blink.
    const blink = (t % 3.7) < 0.11 ? 0.15 : 1;
    for (const e of this.eyes) e.scale.y = blink;
  }
}
