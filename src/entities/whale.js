// A humpback (koholā) beyond the reef: breaches, blows and dives on a loop.
import * as THREE from 'three';
import { lerp, clamp, smoothstep } from '../core/util.js';
import { POI } from '../world/terrain.js';

const CYCLE = 19;

export class Whale {
  constructor(spray) {
    this.spray = spray;
    this.group = new THREE.Group();
    this.time = 5;        // start partway so the first breach comes soon after arriving
    this.lap = 0;
    this.centre = new THREE.Vector3(POI.whale.x, 0, POI.whale.z);
    this.breaching = false;
    this.flags = {};

    const top = new THREE.Color(0x3d4d70), belly = new THREE.Color(0xf2ede2), c = new THREE.Color();
    const profile = [[0.001, -6.4], [0.14, -5.9], [0.3, -4.9], [0.62, -3.2], [1.05, -1.2], [1.42, 0.8], [1.58, 2.6], [1.5, 4.2], [1.15, 5.5], [0.6, 6.2], [0.001, 6.45]];
    const body = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 20).rotateX(Math.PI / 2);
    body.scale(1, 0.86, 1);
    const p = body.attributes.position, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), z = p.getZ(i);
      const groove = z > 1 ? 0.06 * Math.sin(p.getX(i) * 22) : 0;
      c.copy(top).lerp(belly, smoothstep(-0.25, -0.7, y + groove) * smoothstep(-5.5, -2.5, z));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    body.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const skin = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x3d4d70, roughness: 0.35 });
    const pale = new THREE.MeshStandardMaterial({ color: 0xdfe3ea, roughness: 0.4 });
    this.group.add(new THREE.Mesh(body, skin));
    for (const sg of [1, -1]) {
      const fin = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), pale);
      fin.scale.set(0.42, 0.1, 2.1);
      fin.position.set(sg * 2.2, -0.75, 1.9);
      fin.rotation.set(0.15, sg * 1.05, sg * -0.3);
      this.group.add(fin);
    }
    const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.55, 6), dark);
    dorsal.position.set(0, 1.0, -2.2); dorsal.rotation.x = -0.5;
    this.group.add(dorsal);
    this.tail = new THREE.Group();
    this.tail.position.set(0, 0, -6.1);
    for (const sg of [1, -1]) {
      const lobe = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), dark);
      lobe.scale.set(1.55, 0.11, 0.75);
      lobe.position.set(sg * 1.25, 0, -0.35);
      lobe.rotation.y = sg * 0.5;
      this.tail.add(lobe);
    }
    this.group.add(this.tail);
    this.group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    this.group.position.set(this.centre.x, -8, this.centre.z);
  }

  // Jump the loop to just before the next breach (used when the player is watching).
  cue() { if (this.time > 3.6) { this.time = CYCLE - 1.2; this.flags = {}; } }

  once(name, fn) { if (!this.flags[name]) { this.flags[name] = true; fn(); } }

  update(dt) {
    this.time += dt;
    if (this.time >= CYCLE) { this.time -= CYCLE; this.lap++; this.flags = {}; }
    const t = this.time, g = this.group;
    const ang = this.lap * 1.9 + 0.6, heading = ang + Math.PI / 2;
    const cx = this.centre.x + Math.cos(ang) * 12, cz = this.centre.z + Math.sin(ang) * 12;
    const fx = Math.sin(heading), fz = Math.cos(heading);
    let along = 0, y = -8, pitch = 0, roll = 0, tailFlex = 0;
    this.breaching = false;
    if (t < 3.6) {
      const u = t / 3.6;
      this.breaching = u > 0.05 && u < 0.95;
      along = -6 + u * 12;
      y = -5 + 10.5 * Math.sin(Math.PI * u);
      pitch = lerp(-1.3, 0.95, u);
      roll = smoothstep(0.2, 0.9, u) * 1.5;
      this.once('out', () => this.spray.emit(cx + fx * (along + 4), 0.2, cz + fz * (along + 4), 60, 2.5, 7, 3));
      if (u > 0.8) this.once('in', () => this.spray.emit(cx + fx * (along + 3), 0.2, cz + fz * (along + 3), 160, 4, 11, 6));
    } else if (t > 8.5 && t < 13) {
      const u = (t - 8.5) / 4.5;
      along = -4 + u * 9;
      y = -1.35 + 0.35 * Math.sin(Math.PI * u);
      pitch = lerp(-0.12, 0.2, u);
      if (u > 0.2) this.once('blow', () => this.spray.emit(cx + fx * (along + 3.8), 0.4, cz + fz * (along + 3.8), 50, 0.4, 9, 0.8));
    } else if (t >= 13 && t < 16.5) {
      const u = (t - 13) / 3.5;
      along = 5 + u * 5;
      pitch = smoothstep(0, 0.45, u) * 1.25;
      y = -1.0 - smoothstep(0.35, 1, u) * 8;
      tailFlex = -Math.sin(Math.PI * clamp(u * 1.4, 0, 1)) * 0.5;
    }
    g.position.set(cx + fx * along, y, cz + fz * along);
    g.rotation.set(pitch, heading, roll, 'YXZ');
    this.tail.rotation.x = tailFlex + Math.sin(this.time * 2.2) * 0.12;
  }
}
