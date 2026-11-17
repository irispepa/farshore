// Shared helpers for world dressing: geometry builder, wind sway, colliders.
import * as THREE from 'three';

export const timeUniform = { value: 0 };

// Triangle-soup builder with per-vertex colour.
export class GeoBuilder {
  constructor() { this.p = []; this.c = []; }
  tri(a, b, c, ca, cb = ca, cc = ca) {
    this.p.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    this.c.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b);
  }
  quad(a, b, c, d, ca, cb = ca, cc = cb, cd = ca) {
    this.tri(a, b, c, ca, cb, cc);
    this.tri(a, c, d, ca, cc, cd);
  }
  // Append an existing geometry with a flat colour (or a per-vertex colour function).
  add(geo, color, matrix) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (matrix) g.applyMatrix4(matrix);
    const p = g.attributes.position;
    const v = new THREE.Vector3(), col = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      this.p.push(v.x, v.y, v.z);
      if (typeof color === 'function') color(v, col); else col.copy(color);
      this.c.push(col.r, col.g, col.b);
    }
  }
  build(smooth = false) {
    let geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    geo.computeVertexNormals();
    return geo;
  }
}

// Vertex sway driven by a shared clock: displacement grows with the square of local height.
export function addSway(material, amount, heightScale) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = timeUniform;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      float swPhase = 0.0;
      #ifdef USE_INSTANCING
        swPhase = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.23;
      #endif
      float swK = pow(max(transformed.y, 0.0) * ${heightScale.toFixed(4)}, 2.0) * ${amount.toFixed(4)};
      transformed.x += (sin(uTime * 1.3 + swPhase) + 0.4 * sin(uTime * 2.9 + swPhase * 2.0)) * swK;
      transformed.z += cos(uTime * 1.1 + swPhase * 1.3) * 0.6 * swK;`,
    );
  };
  material.customProgramCacheKey = () => `sway-${amount}-${heightScale}`;
  return material;
}

// ---- Circle colliders in a spatial hash -------------------------------------
const CELL = 6;
const grid = new Map();
const key = (cx, cz) => cx * 4096 + cz;

export function addCollider(x, z, r) {
  const c = { x, z, r };
  const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
  const z0 = Math.floor((z - r) / CELL), z1 = Math.floor((z + r) / CELL);
  for (let cx = x0; cx <= x1; cx++) {
    for (let cz = z0; cz <= z1; cz++) {
      const k = key(cx, cz);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(c);
    }
  }
  return c;
}

// Push a circle (pos.x, pos.z, radius) out of any colliders. Returns true if it touched one.
export function resolveColliders(pos, radius) {
  let hit = false;
  const cx = Math.floor(pos.x / CELL), cz = Math.floor(pos.z / CELL);
  for (let i = cx - 1; i <= cx + 1; i++) {
    for (let j = cz - 1; j <= cz + 1; j++) {
      const list = grid.get(key(i, j));
      if (!list) continue;
      for (const c of list) {
        const dx = pos.x - c.x, dz = pos.z - c.z;
        const d = Math.hypot(dx, dz), min = c.r + radius;
        if (d < min && d > 1e-4) {
          pos.x = c.x + (dx / d) * min;
          pos.z = c.z + (dz / d) * min;
          hit = true;
        }
      }
    }
  }
  return hit;
}

export function collides(x, z, radius) {
  const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
  for (let i = cx - 1; i <= cx + 1; i++) {
    for (let j = cz - 1; j <= cz + 1; j++) {
      const list = grid.get(key(i, j));
      if (!list) continue;
      for (const c of list) if (Math.hypot(x - c.x, z - c.z) < c.r + radius) return true;
    }
  }
  return false;
}

const _dummy = new THREE.Object3D();
export function setInstance(mesh, i, x, y, z, rotY, sx, sy = sx, sz = sx, tiltX = 0, tiltZ = 0) {
  _dummy.position.set(x, y, z);
  _dummy.rotation.set(tiltX, rotY, tiltZ, 'YXZ');
  _dummy.scale.set(sx, sy, sz);
  _dummy.updateMatrix();
  mesh.setMatrixAt(i, _dummy.matrix);
}
