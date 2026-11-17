// Pooled white spray particles: whale splashes, spouts and the canoe's bow wave.
import * as THREE from 'three';

export class Spray {
  constructor(max = 500) {
    this.max = max;
    this.pos = new Float32Array(max * 3).fill(-999);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.next = 0;
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const ctx = cv.getContext('2d'), g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(cv), size: 0.9, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false, color: 0xffffff }));
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
  }

  emit(x, y, z, count, spread, up, out = 1) {
    for (let i = 0; i < count; i++) {
      const k = this.next;
      this.next = (this.next + 1) % this.max;
      const a = Math.random() * Math.PI * 2, r = Math.random();
      this.pos[k * 3] = x + Math.cos(a) * r * spread;
      this.pos[k * 3 + 1] = y;
      this.pos[k * 3 + 2] = z + Math.sin(a) * r * spread;
      this.vel[k * 3] = Math.cos(a) * (0.5 + r) * out;
      this.vel[k * 3 + 1] = up * (0.5 + Math.random() * 0.7);
      this.vel[k * 3 + 2] = Math.sin(a) * (0.5 + r) * out;
      this.life[k] = 1.2 + Math.random() * 1.2;
    }
  }

  update(dt) {
    for (let k = 0; k < this.max; k++) {
      if (this.life[k] <= 0) continue;
      this.life[k] -= dt;
      this.vel[k * 3 + 1] -= 9 * dt;
      this.pos[k * 3] += this.vel[k * 3] * dt;
      this.pos[k * 3 + 1] += this.vel[k * 3 + 1] * dt;
      this.pos[k * 3 + 2] += this.vel[k * 3 + 2] * dt;
      if (this.life[k] <= 0 || this.pos[k * 3 + 1] < -0.3) { this.life[k] = 0; this.pos[k * 3 + 1] = -999; }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}
