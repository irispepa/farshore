// The explorer: a jointed 3D figure built in code. The base body is stable; top,
// bottoms, footwear, hair and gear are separate pieces hung on shared joints.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { hibiscusGeometry } from '../world/flora.js';
import { clamp, damp } from '../core/util.js';
import { loft, strand, headSurf, headNormal, headGeometry, hairCapGeometry, facePatchGeometry, faceTexture, faceDir, FACE } from './charGeo.js';

// `covers` lists body regions a garment fully encloses; those are hidden while it is worn.
export const WARDROBE = {
  top: {
    tee: { name: 'Shoreline tee', body: 0xfdeaf0, trim: 0x4fc9bd, covers: [] },
    sunset: { name: 'Sunset tee', body: 0xff8f66, trim: 0xffd95a, covers: [] },
  },
  bottoms: {
    shorts: { name: 'Hibiscus shorts', body: 0xf2529d, trim: 0xfff6fa, covers: ['pelvis'] },
  },
  footwear: {
    sneakers: { name: 'Splash sneakers', sock: 0xb9a0e8, shoe: 0xfff7f0, accent: 0xff6fa8, accent2: 0x4fc9bd, covers: [] },
    seafoam: { name: 'Seafoam high-tops', sock: 0xfff6fa, shoe: 0x7fe3d2, accent: 0xffd95a, accent2: 0xff6fa8, covers: [] },
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
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

const SKIN = 0xc98b5e, HAIR = 0x4a2a1d, HAIR_LIGHT = 0x6a3c27;
const HEAD_Y = 0.14; // head centre above the head joint

// Body profiles: [y, rx, rzFront, rzBack, offsetX, offsetZ] down from the joint.
const TORSO = [[0.338, 0.058, 0.046], [0.312, 0.122, 0.07, 0.074], [0.27, 0.139, 0.09, 0.086], [0.215, 0.133, 0.099, 0.084], [0.14, 0.116, 0.085, 0.08], [0.075, 0.111, 0.081, 0.08], [0.0, 0.128, 0.093, 0.098], [-0.06, 0.128, 0.09, 0.1]];
const THIGH = [[0.0, 0.084, 0.088, 0.092], [-0.07, 0.088, 0.09, 0.094], [-0.17, 0.079, 0.08, 0.08], [-0.26, 0.064, 0.066, 0.063], [-0.33, 0.056, 0.059, 0.055]];
const SHIN = (sg) => [[0.0, 0.055, 0.058, 0.055], [-0.06, 0.057, 0.051, 0.064, sg * 0.003], [-0.125, 0.059, 0.049, 0.07, sg * 0.005], [-0.2, 0.049, 0.045, 0.054, sg * 0.002], [-0.28, 0.039, 0.04, 0.04], [-0.34, 0.037, 0.039, 0.038]];
const UPPER_ARM = [[0.0, 0.051, 0.051], [-0.06, 0.05, 0.05, 0.052], [-0.14, 0.043, 0.044], [-0.21, 0.039, 0.04]];
const FOREARM = [[0.0, 0.039, 0.04], [-0.05, 0.043, 0.042, 0.044], [-0.12, 0.036, 0.035], [-0.19, 0.029, 0.026]];
const HAND = [[0.0, 0.021, 0.026], [-0.03, 0.02, 0.039, 0.036], [-0.062, 0.018, 0.038, 0.034], [-0.088, 0.013, 0.027, 0.025]];

export class Character {
  constructor() {
    this.root = new THREE.Group();
    this.j = {};
    this.slotMeshes = { top: [], bottoms: [], footwear: [] };
    this.bodyParts = {};
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
    const part = (region, mesh) => { (this.bodyParts[region] ||= []).push(mesh); return mesh; };
    const pelvis = part('pelvis', add(J.hips, new THREE.SphereGeometry(0.15, 18, 12), skin, 0, -0.02, 0));
    pelvis.scale.set(1.0, 0.8, 0.8);
    part('torso', add(J.spine, loft(TORSO, { radial: 20, roundBot: true }), skin));
    add(J.neck, new THREE.CylinderGeometry(0.04, 0.046, 0.11, 14), skin, 0, -0.012, 0);
    add(J.head, headGeometry(), skin, 0, HEAD_Y, 0);
    for (const sg of [1, -1]) {
      const ear = add(J.head, new THREE.SphereGeometry(0.03, 10, 8), skin, sg * 0.131, 0.125, -0.005);
      ear.scale.set(0.45, 1, 0.75);
      const hoop = add(J.head, new THREE.TorusGeometry(0.03, 0.007, 6, 16), mat(0xff5fa8, 0.35), sg * 0.14, 0.068, 0);
      hoop.rotation.y = Math.PI / 2;
    }
    for (const [s, sg] of [['L', 1], ['R', -1]]) {
      add(J['shoulder' + s], loft(UPPER_ARM, { radial: 12, roundTop: true, roundBot: true }), skin);
      add(J['elbow' + s], loft(FOREARM, { radial: 12, roundTop: true, roundBot: true }), skin);
      // Relaxed hand: palm towards the thigh, thumb lobe at the front.
      add(J['wrist' + s], loft(HAND, { radial: 10, roundTop: true, roundBot: true }), skin);
      const thumb = add(J['wrist' + s], new THREE.SphereGeometry(1, 8, 6), skin, -sg * 0.006, -0.04, 0.036);
      thumb.scale.set(0.011, 0.027, 0.012);
      thumb.rotation.x = -0.45;
      add(J['hip' + s], loft(THIGH, { radial: 16, roundTop: true, roundBot: true }), skin);
      add(J['knee' + s], loft(SHIN(sg), { radial: 14, roundTop: true, roundBot: true }), skin);
    }
  }

  // The face is drawn onto a thin patch that follows the sculpted head, so the
  // features sit in the surface from every angle. The nose is real geometry.
  #face() {
    const head = this.j.head;
    this.faceOpen = faceTexture(false);
    this.faceClosed = faceTexture(true);
    this.faceMat = new THREE.MeshStandardMaterial({ map: this.faceOpen, roughness: 0.5, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const patch = new THREE.Mesh(facePatchGeometry(), this.faceMat);
    patch.position.y = HEAD_Y;
    patch.renderOrder = 1;
    head.add(patch);
    const d = faceDir(0, FACE.nosePitch), p = headSurf(d), n = headNormal(d);
    const nose = add(head, new THREE.SphereGeometry(0.0145, 14, 10), mat(SKIN, 0.62), p.x, p.y + HEAD_Y + 0.003, p.z - 0.0065);
    nose.scale.set(1.05, 0.82, 0.95);
    nose.lookAt(nose.position.clone().add(n));
    nose.castShadow = false;
  }

  #hair() {
    const head = this.j.head;
    const hairMat = mat(HAIR, 0.5), hairLight = mat(HAIR_LIGHT, 0.5);
    add(head, hairCapGeometry(), hairMat, 0, HEAD_Y, 0);
    // Two swoops from a side part, sweeping back over the temples to behind the jaw.
    const centre = V3(0, HEAD_Y, 0);
    const sph = (p, o) => o.copy(p).sub(centre);
    for (const sg of [1, -1]) {
      const pts = sg > 0
        ? [V3(0.035, 0.3, 0.035), V3(0.09, 0.283, 0.068), V3(0.135, 0.225, 0.052), V3(0.153, 0.13, 0.012), V3(0.158, 0.02, -0.02), V3(0.165, -0.08, -0.05)]
        : [V3(0.035, 0.303, 0.04), V3(-0.04, 0.297, 0.082), V3(-0.108, 0.25, 0.074), V3(-0.146, 0.15, 0.022), V3(-0.157, 0.03, -0.015), V3(-0.165, -0.08, -0.05)];
      add(head, strand(pts, { out: sph, segs: 18, radial: 10, width: (t) => 0.016 + 0.03 * Math.sin(Math.PI * Math.min(1, t * 1.2 + 0.1)) * (1 - 0.5 * t * t), thick: (t) => 0.01 + 0.01 * Math.sin(Math.PI * t) }), sg > 0 ? hairMat : hairLight);
    }
    // Long waves down the back: a swaying mass plus broad, flattened clumps.
    const sway = new THREE.Group();
    sway.position.set(0, 0.2, -0.05);
    head.add(sway);
    this.hairSway = sway;
    for (const [y, z, sx, sy, sz] of [[-0.1, -0.06, 0.165, 0.16, 0.12], [-0.22, -0.1, 0.195, 0.15, 0.11]]) {
      const b = add(sway, new THREE.SphereGeometry(1, 18, 12), hairMat, 0, y, z);
      b.scale.set(sx, sy, sz);
    }
    const cyl = (p, o) => o.set(p.x, 0, p.z + 0.04 + p.y * 0.25);
    const lock = (a, len, ph, w, light) => {
      const pts = [];
      for (let k = 0; k <= 7; k++) {
        const t = k / 7;
        const rad = 0.098 + 0.125 * Math.sin(Math.PI * Math.min(1, t * 1.05)) ** 0.8 + 0.014 * Math.sin(t * 8 + ph);
        const aa = a + 0.17 * Math.sin(t * 7.5 + ph);
        pts.push(V3(Math.sin(aa) * rad, 0.03 - t * len, -Math.cos(aa) * rad * 0.8 - 0.005 - t * 0.1 * Math.max(0, Math.cos(aa))));
      }
      const g = strand(pts, {
        out: cyl, segs: 20, radial: 10,
        width: (t) => w * (0.5 + 0.6 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.08)) + 0.12 * Math.sin(t * 15 + ph)) * (1 - 0.75 * t ** 5),
        thick: (t) => (0.022 + 0.014 * Math.sin(Math.PI * t)) * (1 - 0.6 * t ** 5),
      });
      add(sway, g, light ? hairLight : hairMat);
    };
    // Shorter across the back so the pack stays readable, longer beside the shoulders.
    const n = 7, spread = 3.2;
    const len = (a) => 0.33 + 0.12 * (1 - Math.max(0, Math.cos(a))) ** 1.5;
    for (let i = 0; i < n; i++) { const a = ((i / (n - 1)) - 0.5) * spread; lock(a, len(a) + (i % 2) * 0.03, i * 1.9, 0.062, false); }
    for (let i = 0; i < n - 1; i++) { const a = ((i + 0.5) / (n - 1) - 0.5) * spread; lock(a, len(a) - 0.03 + (i % 3) * 0.02, i * 2.7 + 1, 0.028, true); }
    // Hibiscus over her right temple, petals turned to the front and outward.
    const flower = add(head, hibiscusGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: THREE.DoubleSide }), -0.118, 0.245, 0.088);
    flower.scale.setScalar(0.062);
    flower.quaternion.setFromUnitVectors(V3(0, 1, 0), V3(-0.5, 0.3, 0.81).normalize());
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
    const band = add(J.wristL, new THREE.TorusGeometry(0.03, 0.008, 6, 14), pink, 0, 0.012, 0);
    band.rotation.x = Math.PI / 2; band.scale.y = 0.9;
    add(J.wristL, new RoundedBoxGeometry(0.036, 0.032, 0.012, 2, 0.005), mat(0xffc1dd, 0.3), 0.031, 0.012, 0).rotation.y = Math.PI / 2;
    const beads = add(J.wristR, new THREE.TorusGeometry(0.03, 0.008, 6, 14), mat(0xff8fc0, 0.35), 0, 0.012, 0);
    beads.rotation.x = Math.PI / 2; beads.scale.y = 0.9;
  }

  setOutfit(slot, id) {
    const def = WARDROBE[slot][id];
    if (!def) return;
    this.outfit[slot] = id;
    for (const m of this.slotMeshes[slot]) { m.parent.remove(m); m.geometry.dispose(); }
    const list = (this.slotMeshes[slot] = []);
    const put = (...args) => { const m = add(...args); list.push(m); return m; };
    const J = this.j;
    const open = { capTop: false, capBot: false };
    if (slot === 'top') {
      const body = mat(def.body, 0.85), trim = mat(def.trim, 0.7);
      // Shell follows the torso profile with a little ease, hanging loose at the hem.
      const ease = 0.013;
      const shell = [[0.34, 0.07, 0.055], ...TORSO.slice(1, 6).map(([y, rx, rz, rzb = rz]) => [y, rx + ease, rz + ease, rzb + ease]), [0.022, 0.146, 0.107, 0.11]];
      put(J.spine, loft(shell, { radial: 20, ...open, lipBot: 0.9 }), body);
      put(J.spine, loft([[0.349, 0.064, 0.05], [0.349, 0.077, 0.061], [0.331, 0.083, 0.066]], { radial: 20, smooth: 0, ...open }), trim);
      for (const s of ['L', 'R']) {
        put(J['shoulder' + s], loft([[0.0, 0.065, 0.065], [-0.05, 0.064, 0.064], [-0.092, 0.067, 0.067]], { radial: 14, roundTop: true, capBot: false, lipBot: 0.84 }), body);
        put(J['shoulder' + s], loft([[-0.078, 0.066, 0.066], [-0.078, 0.0695, 0.0695], [-0.098, 0.0705, 0.0705], [-0.098, 0.058, 0.058]], { radial: 14, smooth: 0, ...open }), trim);
      }
    } else if (slot === 'bottoms') {
      const body = mat(def.body, 0.8), trim = mat(def.trim, 0.7);
      // Seat on the hips; each leg is a domed sleeve on its hip joint, so the pair
      // reads as two legs meeting at the crotch and follows the thighs in any pose.
      put(J.hips, loft([[0.092, 0.132, 0.099, 0.1], [0.04, 0.147, 0.106, 0.112], [-0.03, 0.156, 0.102, 0.124], [-0.095, 0.138, 0.09, 0.116], [-0.132, 0.07, 0.06, 0.075], [-0.15, 0.012, 0.012, 0.014]], { radial: 20, capTop: false }), body);
      put(J.hips, loft([[0.097, 0.124, 0.092], [0.097, 0.135, 0.102, 0.103], [0.074, 0.142, 0.106, 0.109], [0.074, 0.128, 0.096]], { radial: 20, smooth: 0, ...open }), trim);
      for (const s of ['L', 'R']) {
        put(J['hip' + s], loft([[0.0, 0.099, 0.1, 0.104], [-0.07, 0.1, 0.1, 0.105], [-0.128, 0.104, 0.103, 0.107]], { radial: 16, roundTop: true, capBot: false, lipBot: 0.87 }), body);
        put(J['hip' + s], loft([[-0.114, 0.1045, 0.104, 0.108], [-0.114, 0.107, 0.106, 0.11], [-0.134, 0.1085, 0.1075, 0.1115], [-0.134, 0.092, 0.092, 0.095]], { radial: 16, smooth: 0, ...open }), trim);
      }
    } else if (slot === 'footwear') {
      const sock = mat(def.sock, 0.9), shoe = mat(def.shoe, 0.6), ac = mat(def.accent, 0.5), ac2 = mat(def.accent2, 0.5);
      for (const s of ['L', 'R']) {
        const shin = J['knee' + s], foot = J['ankle' + s];
        // Slouch sock: one cloth shape with shallow folds.
        put(shin, loft([[-0.2, 0.043, 0.043], [-0.203, 0.052, 0.052], [-0.222, 0.0495, 0.0495], [-0.24, 0.0535, 0.0535], [-0.258, 0.05, 0.05], [-0.276, 0.0535, 0.0535], [-0.295, 0.05, 0.05], [-0.32, 0.052, 0.052], [-0.345, 0.05, 0.05]], { radial: 14, smooth: 3, capTop: false }), sock);
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
    // Hide body regions enclosed by what is currently worn.
    const covered = new Set(Object.keys(this.outfit).flatMap((sl) => WARDROBE[sl][this.outfit[sl]].covers));
    for (const [region, meshes] of Object.entries(this.bodyParts)) for (const m of meshes) m.visible = !covered.has(region);
  }

  // state: { speed (m/s), run (0..1 running gait), sitting, reaching }
  update(dt, state) {
    this.time += dt;
    const J = this.j, t = this.time;
    const amp = (this.amp = damp(this.amp, clamp(state.speed / 3.4, 0, 1), 10, dt));
    const sit = (this.sit = damp(this.sit, state.sitting ? 1 : 0, 7, dt));
    this.reach = damp(this.reach, state.reaching ? 1 : 0, 8, dt);
    const run = state.run || 0;
    // Running takes longer strides, so the cadence rises less than the speed does.
    this.phase += state.speed * dt * 2.75 * (1 - 0.3 * run);
    const sw = Math.sin(this.phase), cw = Math.cos(this.phase);
    const idle = 1 - amp, breath = Math.sin(t * 1.7);
    const st = 1 - sit;

    // Hips and torso.
    J.hips.position.y = (0.8 - amp * 0.025 - run * 0.03 + Math.abs(cw) * (0.035 + 0.045 * run) * amp + breath * 0.004 * idle) * st + 0.15 * sit;
    J.hips.rotation.set(0.04 * amp * st, -sw * 0.1 * amp * st, sw * 0.03 * amp * st);
    J.spine.rotation.set((0.09 * amp + 0.16 * run + this.reach * 0.5) * st - 0.05 * sit, sw * (0.14 + 0.08 * run) * amp * st, 0);
    J.chest.rotation.set(breath * 0.012, sw * 0.08 * amp * st, 0);
    J.head.rotation.set(-0.05 * amp - 0.12 * run + Math.sin(t * 0.6) * 0.03 * idle + this.reach * 0.2, Math.sin(t * 0.37) * 0.12 * idle, 0);

    // Legs.
    for (const [s, sg] of [['L', 1], ['R', -1]]) {
      const ph = this.phase + (sg > 0 ? 0 : Math.PI);
      const swing = Math.sin(ph);
      const lift = Math.max(0, Math.sin(ph + 1.1));
      J['hip' + s].rotation.set((-swing * (0.72 + 0.3 * run) * amp - 0.12 * run) * st - 1.48 * sit, 0, sg * 0.03 * st + sg * 0.1 * sit);
      J['knee' + s].rotation.x = (0.08 + lift * (1.05 + 0.55 * run) * amp + 0.12 * run) * st + 1.35 * sit;
      J['ankle' + s].rotation.x = (swing * 0.25 * amp - lift * 0.3 * amp) * st + 0.1 * sit;
      // Arms swing opposite the legs; resting they hang slightly out from the body.
      const arm = -swing;
      J['shoulder' + s].rotation.set(
        (arm * (0.62 + 0.4 * run) * amp + Math.sin(t * 1.1 + sg) * 0.03 * idle - this.reach * (sg > 0 ? 0 : 1.1)) * st - 0.55 * sit,
        0,
        sg * (0.13 + 0.04 * amp) * st + sg * 0.22 * sit,
      );
      J['elbow' + s].rotation.x = -(0.18 + 0.5 * amp + 0.75 * run + Math.max(0, arm) * 0.35 * amp + this.reach * (sg > 0 ? 0 : 0.5)) * st - 0.75 * sit;
    }

    // Hair follows with a little lag.
    const target = -clamp(state.speed * 0.045, 0, 0.36) * st + Math.sin(this.phase * 2) * 0.035 * amp;
    this.hairVel += ((target - this.hairSway.rotation.x) * 60 - this.hairVel * 9) * dt;
    this.hairSway.rotation.x += this.hairVel * dt;
    this.hairSway.rotation.z = Math.sin(t * 1.3) * 0.02 + sw * 0.03 * amp;

    // Blink.
    const map = (t % 3.7) < 0.11 ? this.faceClosed : this.faceOpen;
    if (this.faceMat.map !== map) this.faceMat.map = map;
  }
}
