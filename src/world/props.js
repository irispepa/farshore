// Lava boulders, stone steps and the hand-placed props of the cove.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng, lerp, clamp, TAU, noise2, fbm, nearestOnPath } from '../core/util.js';
import { heightAt, rockAt, reefAt, pathAt, caveAt, inLookoutView, PATH, CLEFT, POI, CAVE } from './terrain.js';
import { addCollider, setInstance, timeUniform } from './common.js';
import { SUN_DIR } from './sky.js';

const C = (hex) => new THREE.Color(hex);
const std = (color, roughness = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });

function rockGeometry(seed) {
  const geo = mergeVertices(new THREE.IcosahedronGeometry(1, 3).deleteAttribute('normal').deleteAttribute('uv'), 1e-4);
  const p = geo.attributes.position;
  const col = new Float32Array(p.count * 3);
  const dark = C(0x342d3a), light = C(0x6e6276), c = new THREE.Color();
  for (let k = 0; k < p.count; k++) {
    const x = p.getX(k), y = p.getY(k), z = p.getZ(k);
    const big = fbm(x * 0.9 + seed, y * 0.9 + z * 1.3 - seed, 3);
    const pock = noise2(x * 5.1 + seed, y * 5.1 + z * 6.3);
    const d = 1 + big * 0.55 - Math.max(0, pock) * 0.07;
    p.setXYZ(k, x * d * 1.1, y * d * 0.78, z * d);
    c.copy(dark).lerp(light, clamp(0.35 + big * 0.9 - Math.max(0, pock) * 0.9 + y * 0.25, 0, 1));
    col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

export function buildRocks(grain) {
  const group = new THREE.Group();
  const r = rng(4242);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 });
  const MAX = 220;
  const kinds = [11, 37, 73].map((s) => ({ mesh: new THREE.InstancedMesh(rockGeometry(s), mat, MAX), n: 0 }));
  const near = { d: 0, h: 0, seg: 0, t: 0 };
  const rock = (x, z, s, sink = 0.28, collide = true) => {
    const k = kinds[Math.floor(r() * kinds.length)];
    if (k.n >= MAX) return;
    setInstance(k.mesh, k.n++, x, heightAt(x, z) - sink * s + 0.1, z, r() * TAU, s * (0.85 + r() * 0.4), s * (0.8 + r() * 0.35), s * (0.85 + r() * 0.4), (r() - 0.5) * 0.3, (r() - 0.5) * 0.3);
    if (collide && s >= 0.85) addCollider(x, z, 0.82 * s);
  };

  // Foreground boulders on the home beach (as in the concept frame).
  for (const [x, z, s] of [[-9.5, 46.5, 2.3], [-5, 51, 1.7], [2.5, 49.5, 2.0], [8, 47.5, 1.3], [-14, 38.5, 1.7], [-12.5, 35.5, 0.9],
    [-12, 25, 1.5], [-10.5, 22.5, 0.8], [-13.5, 6, 1.4], [-7, 4.5, 0.8], [-17, 15.5, 1.1]]) rock(x, z, s);

  // Rubble along the foot of the headland on the cove side, and at both flanks of the cave mouth.
  for (let x = -6; x < 90; x += 1.6 + r() * 2.2) {
    if (Math.abs(x - CAVE.x) < 7) continue;
    let z = -14;
    while (z > -34 && heightAt(x, z) < 0.25) z -= 0.5;
    for (let k = 0; k < 2; k++) rock(x + (r() - 0.5) * 2, z + 1.4 - r() * 4.2 * (k ? 1 : 0.3), 0.7 + r() * 1.6 * (k ? 0.6 : 1), 0.3);
  }
  for (const [x, z, s] of [[29.2, -27.2, 2.4], [42.8, -27.4, 2.6], [27, -25.5, 1.4], [45.2, -25.8, 1.5], [30.4, -24.2, 0.9], [41.8, -24.6, 1.0],
    [32.9, -44.3, 0.7], [39.4, -43.8, 0.9], [39.3, -38.4, 0.6], [32.8, -38.2, 0.55]]) rock(x, z, s, 0.3, s > 1.2);

  // South shelf: tide-pool boulders, with a walking lane left clear.
  for (let i = 0; i < 260; i++) {
    const x = 4 + r() * 62, z = 42 + r() * 12, h = heightAt(x, z);
    if (rockAt(x, z) < 0.7 || h < -0.4 || h > 2.4) continue;
    if (Math.abs(z - lerp(45.5, 47.5, (x - 4) / 57)) < 1.9) continue;
    rock(x, z, 0.5 + r() * 1.3);
  }
  // North side of the headland and the ridge feet: purely scenic.
  for (let i = 0; i < 70; i++) {
    const x = -4 + r() * 96, z = r() < 0.6 ? -50 - r() * 6 : 62 + r() * 5, h = heightAt(x, z);
    if (h < -1.2 || h > 1.5) continue;
    rock(x, z, 0.8 + r() * 1.8, 0.3, false);
  }
  // Headland top: a few scattered boulders off the trail.
  for (let i = 0; i < 80; i++) {
    const x = -6 + r() * 86, z = -48 + r() * 18, h = heightAt(x, z);
    if (h < 6.8 || caveAt(x, z) > 0.02) continue;
    if (nearestOnPath(PATH, x, z, near).d < 3.2 || nearestOnPath(CLEFT, x, z, near).d < 3.4) continue;
    if (inLookoutView(x, z)) continue;
    rock(x, z, 0.5 + r() * 1.0);
  }
  // Reef heads breaking the surface.
  for (let i = 0; i < 400; i++) {
    const x = 66 + r() * 28, z = -22 + r() * 64;
    if (reefAt(x, z) < 0.55 || heightAt(x, z) < -0.45) continue;
    rock(x, z, 0.7 + r() * 1.1, 0.42, false);
    addCollider(x, z, 1.0);
  }
  // Islet and pebbles on the sand.
  rock(POI.islet.x - 4, POI.islet.z + 3.5, 1.3); rock(POI.islet.x + 4.5, POI.islet.z - 2, 0.9);
  for (let i = 0; i < 60; i++) {
    const a = r() * TAU, d = 30 + r() * 10;
    const x = 30 + Math.cos(a) * d, z = 8 + Math.sin(a) * d, h = heightAt(x, z);
    if (h < 0.15 || h > 1.3 || rockAt(x, z) > 0.5 || pathAt(x, z) > 0.1) continue;
    rock(x, z, 0.15 + r() * 0.3, 0.2, false);
  }
  for (const k of kinds) {
    k.mesh.count = k.n;
    k.mesh.castShadow = k.mesh.receiveShadow = true;
    group.add(k.mesh);
  }

  // Stone steps along the climbing parts of the trail and down the cleft.
  const stepGeo = new RoundedBoxGeometry(1, 0.24, 0.62, 2, 0.07);
  const steps = new THREE.InstancedMesh(stepGeo, std(0xffffff, 0.9, { map: grain }), 160);
  const tint = new THREE.Color();
  let nS = 0;
  const laySteps = (path, from, to, width, spacing) => {
    for (let i = from; i < to; i++) {
      const a = path[i], b = path[i + 1];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]), rot = Math.atan2(b[0] - a[0], b[1] - a[1]);
      for (let d = 0.4; d < len; d += spacing) {
        const t = d / len, x = lerp(a[0], b[0], t), z = lerp(a[1], b[1], t);
        setInstance(steps, nS, x, heightAt(x, z) - 0.02, z, rot + (r() - 0.5) * 0.08, width * (0.92 + r() * 0.16), 1, 1);
        steps.setColorAt(nS++, tint.setHex(0xd4ad82).multiplyScalar(0.88 + r() * 0.2));
      }
    }
  };
  laySteps(PATH, 1, 4, 2.3, 1.15);
  laySteps(CLEFT, 0, 3, 1.9, 0.72);
  steps.count = nS;
  steps.castShadow = steps.receiveShadow = true;
  group.add(steps);

  // Unseen slab that shades the cave interior (the heightfield itself casts no shadows).
  const slab = new THREE.Mesh(new THREE.PlaneGeometry(32, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide }));
  slab.position.set(36, 6.0, -40);
  slab.castShadow = true;
  group.add(slab);
  return group;
}

// ---- Props ------------------------------------------------------------------
function starTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,240,250,0.55)'); g.addColorStop(1, 'rgba(255,200,230,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU, rad = i % 2 ? 4 : 30;
    ctx.lineTo(32 + Math.cos(a) * rad, 32 + Math.sin(a) * rad);
  }
  ctx.fill();
  return new THREE.CanvasTexture(cv);
}

function labelTexture(lines) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 64 * lines.length;
  const ctx = cv.getContext('2d');
  lines.forEach((text, i) => {
    ctx.fillStyle = i % 2 ? '#f6c8d8' : '#fbe7c6';
    ctx.fillRect(0, i * 64, 256, 64);
    ctx.fillStyle = '#6b3f5c';
    ctx.font = '600 30px Fredoka, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, i * 64 + 34);
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeChest() {
  const g = new THREE.Group();
  const wood = std(0xb9834f, 0.8), band = std(0xff6fa8, 0.5), shell = std(0xfff0dc, 0.4);
  const base = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.34, 0.42, 2, 0.04), wood);
  base.position.y = 0.17;
  // The lid hinges along the back edge.
  const hinge = new THREE.Group();
  hinge.position.set(0, 0.34, -0.21);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.62, 12, 1, false, 0, Math.PI), wood);
  lid.rotation.z = Math.PI / 2; lid.rotation.y = Math.PI / 2; lid.position.z = 0.21;
  hinge.add(lid);
  g.add(base, hinge);
  g.userData.hinge = hinge;
  for (const x of [-0.2, 0.2]) {
    const b = new THREE.Mesh(new THREE.TorusGeometry(0.215, 0.022, 6, 14, Math.PI), band);
    b.rotation.y = Math.PI / 2; b.position.set(x, 0, 0.21);
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.34, 0.44), band);
    b2.position.set(x, 0.17, 0);
    hinge.add(b);
    g.add(b2);
  }
  const clasp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), shell);
  clasp.scale.set(1, 1, 0.5); clasp.position.set(0, 0.32, 0.22);
  g.add(clasp);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function buildProps() {
  const group = new THREE.Group();
  const sparkTex = starTexture();
  const sparkles = [];
  const sparkle = (x, y, z, scale = 0.55) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    s.position.set(x, y, z);
    s.userData = { base: scale, y, phase: sparkles.length * 1.7 };
    group.add(s);
    sparkles.push(s);
    return s;
  };
  const yAt = (p) => heightAt(p.x, p.z);

  // Tūtū's tin: a 90s biscuit tin on the cave ledge.
  const tin = new THREE.Group();
  {
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.2, 0.28, 3, 0.04), std(0xff8fc0, 0.35, { metalness: 0.35 }));
    body.position.y = 0.1;
    const lid = new THREE.Mesh(new RoundedBoxGeometry(0.43, 0.07, 0.31, 3, 0.03), std(0x56cdbd, 0.35, { metalness: 0.35 }));
    lid.position.y = 0.22;
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), std(0xfff3df, 0.4));
    dot.scale.y = 0.45; dot.position.y = 0.26;
    tin.add(body, lid, dot);
    tin.position.set(POI.tin.x, yAt(POI.tin), POI.tin.z);
    tin.rotation.y = 0.6;
    tin.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    tin.userData.lid = lid;
    group.add(tin);
  }
  const tinSpark = sparkle(POI.tin.x, yAt(POI.tin) + 0.75, POI.tin.z);

  // Chests holding collectible outfit pieces.
  const chests = {};
  for (const [id, p, rot] of [['islet', POI.islet, 2.2], ['shelf', POI.shelfTip, -1.2]]) {
    const c = makeChest();
    c.position.set(p.x, yAt(p) - 0.02, p.z);
    c.rotation.y = rot;
    group.add(c);
    addCollider(p.x, p.z, 0.4);
    chests[id] = { mesh: c, spark: sparkle(p.x, yAt(p) + 0.95, p.z) };
  }

  // Signpost where the trail leaves the beach.
  {
    const s = new THREE.Group();
    const wood = std(0xa97a4e, 0.85);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 1.9, 8), wood);
    post.position.y = 0.95;
    const tex = labelTexture(['Path Inland', 'Canoe Landing']);
    const plank = (row, y, rot) => {
      const t = tex.clone();
      t.repeat.set(1, 0.5); t.offset.set(0, row ? 0 : 0.5); t.needsUpdate = true;
      const faces = [wood, wood, wood, wood, std(0xffffff, 0.8, { map: t }), wood];
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.27, 0.05), faces);
      m.position.set(0.2 * (row ? -1 : 1), y, 0.07);
      m.rotation.z = rot;
      return m;
    };
    s.add(post, plank(0, 1.6, 0.05), plank(1, 1.25, -0.04));
    s.position.set(POI.sign.x, yAt(POI.sign) - 0.05, POI.sign.z);
    s.rotation.y = 2.1;
    s.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    group.add(s);
    addCollider(POI.sign.x, POI.sign.z, 0.25);
  }

  // Lookout: a weathered bench and a ribbon pole on the headland tip.
  const ribbon = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.22, 8, 1), std(0xff6fa8, 0.6, { side: THREE.DoubleSide }));
  {
    const l = new THREE.Group();
    const wood = std(0xb08a62, 0.9);
    const seat = new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.08, 0.42, 2, 0.03), wood);
    seat.position.y = 0.42;
    l.add(seat);
    for (const x of [-0.55, 0.55]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.36), wood);
      leg.position.set(x, 0.21, 0);
      l.add(leg);
    }
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 2.6, 6), wood);
    pole.position.set(1.5, 1.3, -0.4);
    ribbon.geometry.translate(0.45, 0, 0);
    ribbon.position.set(1.5, 2.45, -0.4);
    l.add(pole, ribbon);
    l.position.set(POI.lookout.x, yAt(POI.lookout), POI.lookout.z);
    l.rotation.y = -Math.atan2(POI.whale.x - POI.lookout.x, POI.whale.z - POI.lookout.z); // faces the whale grounds
    l.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    group.add(l);
    addCollider(POI.lookout.x, POI.lookout.z, 0.85);
  }

  // Light falling through the puka at the back of the cave, and a soft water glow.
  {
    const shaftGeo = new THREE.CylinderGeometry(1.5, 2.8, 9, 16, 1, true);
    const shaft = new THREE.Mesh(shaftGeo, new THREE.MeshBasicMaterial({ color: 0xffe9c2, transparent: true, opacity: 0.13, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    shaft.position.set(CAVE.x, 4.6, -42.2);
    shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(SUN_DIR.x * 0.35, 1, SUN_DIR.z * 0.35).normalize());
    shaft.renderOrder = 3;
    const glow = new THREE.PointLight(0x7fe9ff, 14, 22, 1.6);
    glow.position.set(CAVE.x, 1.4, -33);
    const warm = new THREE.PointLight(0xffd9a8, 10, 14, 1.6);
    warm.position.set(CAVE.x, 3.2, -42);
    group.add(shaft, glow, warm);
  }

  // Beach treasures: starfish and shells.
  {
    const r = rng(77);
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU, rad = i % 2 ? 0.42 : 1;
      shape[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rad, Math.sin(a) * rad);
    }
    const starGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 2 }).rotateX(-Math.PI / 2);
    const stars = new THREE.InstancedMesh(starGeo, std(0xffffff, 0.7), 14);
    const shellGeo = new THREE.SphereGeometry(1, 9, 5, 0, Math.PI).rotateX(-Math.PI / 2).scale(1, 0.45, 1.15);
    const shells = new THREE.InstancedMesh(shellGeo, std(0xffffff, 0.45), 22);
    const tint = new THREE.Color(), starCols = [0xff7aa8, 0xff9a5c, 0xffc247], shellCols = [0xfff1e0, 0xffd6e2, 0xffe4c4];
    let a = 0, b = 0;
    for (let i = 0; i < 900 && (a < 14 || b < 22); i++) {
      const an = r() * TAU, d = 31 + r() * 9;
      const x = 30 + Math.cos(an) * d, z = 8 + Math.sin(an) * d, h = heightAt(x, z);
      if (h < 0.12 || h > 0.9 || rockAt(x, z) > 0.4) continue;
      if (a < 14 && r() < 0.4) {
        setInstance(stars, a, x, h + 0.02, z, r() * TAU, 0.13 + r() * 0.06);
        stars.setColorAt(a++, tint.setHex(starCols[Math.floor(r() * 3)]));
      } else if (b < 22) {
        setInstance(shells, b, x, h + 0.01, z, r() * TAU, 0.08 + r() * 0.05);
        shells.setColorAt(b++, tint.setHex(shellCols[Math.floor(r() * 3)]));
      }
    }
    stars.count = a; shells.count = b;
    stars.castShadow = shells.castShadow = true;
    group.add(stars, shells);
  }

  function update(t) {
    for (const s of sparkles) {
      const u = s.userData, pulse = 0.75 + 0.25 * Math.sin(t * 3 + u.phase);
      s.scale.setScalar(u.base * pulse);
      s.position.y = u.y + Math.sin(t * 1.6 + u.phase) * 0.08;
      s.material.rotation = t * 0.6 + u.phase;
    }
    const p = ribbon.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      p.setZ(i, Math.sin(x * 6 - t * 7) * 0.09 * x);
    }
    p.needsUpdate = true;
  }
  return { group, tin, tinSpark, chests, update };
}
