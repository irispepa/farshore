// Outrigger sailing canoe (waʻa): hull, ama float, ʻiako booms, mast and sail.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { damp, clamp } from '../core/util.js';

const std = (color, roughness = 0.75, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });

function stripeTexture(draw, w = 16, h = 256) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const HALF_BEAM = 0.37, LENGTH = 5.4;
const widthAt = (u) => HALF_BEAM * Math.pow(Math.sin(Math.PI * u), 0.6);
const keelAt = (u) => -0.34 + 0.5 * Math.pow(Math.abs(2 * u - 1), 2.6);
const sheerAt = (u) => 0.27 + 0.42 * Math.pow(Math.abs(2 * u - 1), 3);

function hullGeometry() {
  const nu = 30, nv = 14, pos = [], uv = [], idx = [];
  for (let i = 0; i <= nu; i++) {
    const u = i / nu, z = (u - 0.5) * LENGTH, w = widthAt(u), k = keelAt(u), s = sheerAt(u);
    for (let j = 0; j <= nv; j++) {
      const a = ((j / nv) * 2 - 1) * (Math.PI / 2), f = 1 - Math.cos(a);
      pos.push(w * Math.sin(a), k + (s - k) * f, z);
      uv.push(u, f);
    }
  }
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const a = i * (nv + 1) + j, b = a + 1, c = a + nv + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function deckGeometry() {
  const nu = 30, pos = [], idx = [];
  for (let i = 0; i <= nu; i++) {
    const u = i / nu, z = (u - 0.5) * LENGTH, w = widthAt(u) * 0.95, y = sheerAt(u) - 0.09;
    pos.push(-w, y, z, w, y, z);
  }
  for (let i = 0; i < nu; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

export class Canoe {
  constructor() {
    this.group = new THREE.Group();   // origin at the waterline, bow toward +Z
    this.tilt = new THREE.Group();    // bob, roll and pitch
    this.group.add(this.tilt);
    this.heading = 0;
    this.speed = 0;
    this.turn = 0;
    this.sailSide = 1;
    this.seat = new THREE.Vector3(0, 0.3, -1.05);

    const wood = std(0xc9935a, 0.8), bamboo = std(0xd9aa66, 0.7), cream = std(0xfff3e2, 0.7), lash = std(0xb98a55, 0.9);
    const hullTex = stripeTexture((ctx, w, h) => {
      ctx.fillStyle = '#fff3e0'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#f47fae'; ctx.fillRect(0, h * 0.14, w, h * 0.2);   // canvas top = gunwale (v = 1)
      ctx.fillStyle = '#ffb7d0'; ctx.fillRect(0, h * 0.1, w, h * 0.025);
      ctx.fillStyle = '#c98f5a'; ctx.fillRect(0, 0, w, h * 0.035);
    });
    const hull = new THREE.Mesh(hullGeometry(), std(0xffffff, 0.65, { map: hullTex, side: THREE.DoubleSide }));
    const deck = new THREE.Mesh(deckGeometry(), wood);
    this.tilt.add(hull, deck);
    for (const z of [-1.05, 0.15, 1.35]) {
      const u = z / LENGTH + 0.5;
      const t = new THREE.Mesh(new RoundedBoxGeometry(widthAt(u) * 2 + 0.06, 0.05, 0.24, 2, 0.02), wood);
      t.position.set(0, sheerAt(u) + 0.005, z);
      this.tilt.add(t);
    }

    // Outrigger on the port side (+X when facing +Z).
    const amaX = 2.05;
    const amaPts = [];
    for (let i = 0; i <= 14; i++) { const t = i / 14; amaPts.push(new THREE.Vector2(0.001 + 0.135 * Math.pow(Math.sin(Math.PI * t), 0.55), (t - 0.5) * 3.7)); }
    const ama = new THREE.Mesh(new THREE.LatheGeometry(amaPts, 12).rotateX(Math.PI / 2), cream);
    ama.position.set(amaX, 0.02, 0.1);
    this.tilt.add(ama);
    for (const z of [0.8, -0.8]) {
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.42, 0.34, z), new THREE.Vector3(1.0, 0.62, z), new THREE.Vector3(amaX, 0.2, z + 0.1));
      this.tilt.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.036, 7), bamboo));
      const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.24, 6), bamboo);
      peg.position.set(amaX, 0.11, z + 0.1);
      this.tilt.add(peg);
      for (const x of [-0.36, 0.36, amaX]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.016, 5, 10), lash);
        ring.position.set(x, x === amaX ? 0.2 : 0.36 + (x > 0 ? 0.07 : 0), z + (x === amaX ? 0.1 : 0));
        ring.rotation.y = Math.PI / 2;
        this.tilt.add(ring);
      }
    }
    // A paddle resting across the thwarts.
    const paddle = new THREE.Group();
    paddle.add(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.3, 6), bamboo));
    const blade = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), std(0xff6fa8, 0.5));
    blade.scale.set(1, 1.9, 0.14); blade.position.y = -0.8;
    paddle.add(blade);
    paddle.rotation.set(Math.PI / 2 - 0.06, 0, 0.1);
    paddle.position.set(-0.16, 0.36, 0.25);
    this.tilt.add(paddle);

    // Mast and sail. The rig pivots about the mast to follow the wind.
    const mastZ = 0.8, mastBase = 0.32, tack = 0.55, head = 3.55, boomLen = 2.55;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, head + 0.25, 8), bamboo);
    mast.position.set(0, mastBase + (head + 0.25) / 2, mastZ);
    this.tilt.add(mast);
    this.rig = new THREE.Group();
    this.rig.position.set(0, mastBase, mastZ);
    this.tilt.add(this.rig);
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, boomLen + 0.15, 7), bamboo);
    boom.rotation.x = Math.PI / 2 - 0.1;
    boom.position.set(0, tack + 0.13, -(boomLen + 0.15) / 2 + 0.05);
    this.rig.add(boom);

    const A = new THREE.Vector3(0, tack, -0.03), B = new THREE.Vector3(0, head, -0.03), Cc = new THREE.Vector3(0, tack + 0.28, -boomLen);
    const n = 12, pos = [], uv = [], idx = [], bulge = [], row = [];
    for (let i = 0; i <= n; i++) {
      row.push(pos.length / 3);
      for (let j = 0; j <= n - i; j++) {
        const a = i / n, b = j / n;
        const p = A.clone().addScaledVector(B.clone().sub(A), a).addScaledVector(Cc.clone().sub(A), b);
        pos.push(p.x, p.y, p.z);
        uv.push(b, (p.y - tack) / (head - tack));
        bulge.push(5.2 * b * (1 - a - b) * Math.min(1, a * 4 + 0.2));
      }
    }
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n - i; j++) {
        const p0 = row[i] + j, p1 = p0 + 1, q0 = row[i + 1] + j;
        idx.push(p0, p1, q0);
        if (j < n - i - 1) idx.push(p1, q0 + 1, q0);
      }
    }
    const sailGeo = new THREE.BufferGeometry();
    sailGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    sailGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    sailGeo.setIndex(idx);
    const sailTex = stripeTexture((ctx, w, h) => {
      ctx.fillStyle = '#fdf0dc'; ctx.fillRect(0, 0, w, h);
      // Canvas y runs top→bottom; uv.v = 0 (the foot of the sail) samples the bottom rows.
      ctx.fillStyle = '#f48db4'; ctx.fillRect(0, h * 0.56, w, h * 0.3);
      ctx.fillStyle = '#fbc4d8'; ctx.fillRect(0, h * 0.5, w, h * 0.035);
      ctx.fillStyle = '#fbc4d8'; ctx.fillRect(0, h * 0.44, w, h * 0.02);
      ctx.fillStyle = '#e9d6b8'; for (let y = 0.1; y < 0.44; y += 0.11) ctx.fillRect(0, h * y, w, 2);
    });
    this.sail = new THREE.Mesh(sailGeo, std(0xffffff, 0.8, { map: sailTex, side: THREE.DoubleSide }));
    this.sailBulge = bulge;
    this.rig.add(this.sail);

    this.pennant = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, -0.22, 0, 0.6, -0.11, 0], 3)), std(0xff5fa8, 0.6, { side: THREE.DoubleSide }));
    this.pennant.geometry.computeVertexNormals();
    this.pennant.position.set(0, mastBase + head + 0.22, mastZ);
    this.tilt.add(this.pennant);

    this.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.#shapeSail(0, 1);
  }

  #shapeSail(t, side) {
    const p = this.sail.geometry.attributes.position, b = this.sailBulge;
    for (let i = 0; i < p.count; i++) {
      p.setX(i, b[i] * side * 0.42 * (1 + 0.1 * Math.sin(t * 3.1 + p.getY(i) * 2.3)));
    }
    p.needsUpdate = true;
    this.sail.geometry.computeVertexNormals();
  }

  // wave: surface height sampler (x, z) → y. wind: unit Vector2 the wind blows toward.
  update(dt, t, wave, wind) {
    const g = this.group, sin = Math.sin(this.heading), cos = Math.cos(this.heading);
    g.rotation.y = this.heading;
    const bow = wave(g.position.x + sin * 2, g.position.z + cos * 2), stern = wave(g.position.x - sin * 2, g.position.z - cos * 2);
    const port = wave(g.position.x + cos * 1.6, g.position.z - sin * 1.6);
    const mid = (bow + stern) * 0.5;
    this.tilt.position.y = damp(this.tilt.position.y, mid + Math.sin(t * 1.7) * 0.015, 6, dt);
    this.tilt.rotation.x = damp(this.tilt.rotation.x, -(bow - stern) / 4 - this.speed * 0.006, 5, dt);
    this.tilt.rotation.z = damp(this.tilt.rotation.z, (mid - port) / 1.6 * 0.6 + this.turn * 0.09 + Math.sin(t * 1.3) * 0.012, 5, dt);

    // Sail swings to leeward; wind relative to the boat decides the side.
    const rx = wind.x * cos - wind.y * sin; // wind's sideways component in boat space (+X = port)
    const rz = wind.x * sin + wind.y * cos; // along the boat (+ = from astern)
    const side = clamp(rx * 3, -1, 1);
    this.sailSide = damp(this.sailSide, side === 0 ? 1 : side, 2.5, dt);
    const open = 0.25 + 0.55 * clamp((rz + 1) / 2, 0, 1);
    this.rig.rotation.y = damp(this.rig.rotation.y, -this.sailSide * open, 3, dt);
    this.#shapeSail(t, this.sailSide);
    this.pennant.rotation.y = Math.atan2(-rz, rx) + Math.sin(t * 6) * 0.15;
  }
}
