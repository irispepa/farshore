// Golden-hour sky dome, sculpted cumulus, the neighbouring island and the lights.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng, fbm, TAU } from '../core/util.js';

export const SUN_DIR = new THREE.Vector3(-0.56, 0.62, 0.5).normalize();
export const FOG = { color: new THREE.Color(0xe9c3dc), near: 150, far: 1150 };

const skyVert = /* glsl */ `
varying vec3 vDir;
void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const skyFrag = /* glsl */ `
uniform vec3 uZenith, uMid, uHorizon, uSea, uSun, uGlow;
varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir);
  float e = d.y;
  vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.22, e));
  col = mix(col, uZenith, smoothstep(0.16, 0.75, e));
  col = mix(col, uSea, smoothstep(0.0, -0.08, e));
  float s = max(dot(d, uSun), 0.0);
  col += uGlow * (pow(s, 6.0) * 0.35 + pow(s, 600.0) * 3.0);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const cloudVert = /* glsl */ `
varying vec3 vN; varying vec3 vW;
void main(){
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const cloudFrag = /* glsl */ `
uniform vec3 uSun, uLight, uShade, uRim, uHaze;
varying vec3 vN; varying vec3 vW;
void main(){
  vec3 n = normalize(vN);
  float l = dot(n, uSun) * 0.55 + n.y * 0.35 + 0.35;
  vec3 col = mix(uShade, uLight, smoothstep(0.1, 0.8, l));
  vec3 v = normalize(cameraPosition - vW);
  col += uRim * pow(1.0 - abs(dot(n, v)), 2.5) * 0.35;
  float e = normalize(vW - cameraPosition).y;
  col = mix(uHaze, col, smoothstep(0.0, 0.11, e));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function cloudGeometry(r, seed) {
  const parts = [];
  const n = 6 + Math.floor(r() * 6);
  const len = 1.6 + r() * 1.6;
  for (let i = 0; i < n; i++) {
    const g = mergeVertices(new THREE.IcosahedronGeometry(1, 3).deleteAttribute('normal').deleteAttribute('uv'), 1e-4);
    const t = i / (n - 1) - 0.5;
    const s = (0.55 + r() * 0.55) * (1 - Math.abs(t) * 0.7);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      let y = p.getY(k);
      if (y < -0.25) y = -0.25 + (y + 0.25) * 0.15; // flat cumulus base
      p.setY(k, y);
    }
    g.scale(s * 1.25, s, s);
    g.translate(t * len * 1.4, s * 0.25 + r() * 0.25, (r() - 0.5) * 0.7);
    parts.push(g);
  }
  const geo = mergeGeometries(parts);
  geo.computeVertexNormals();
  return geo;
}

export function buildSky() {
  const group = new THREE.Group();
  const follow = new THREE.Group(); // recentred on the camera each frame
  group.add(follow);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1900, 32, 20),
    new THREE.ShaderMaterial({
      vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        uZenith: { value: new THREE.Color(0x4f66dd) }, uMid: { value: new THREE.Color(0x9a9bf3) },
        uHorizon: { value: new THREE.Color(0xffc9c4) }, uSea: { value: FOG.color },
        uSun: { value: SUN_DIR }, uGlow: { value: new THREE.Color(0xffc890) },
      },
    }),
  );
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  follow.add(dome);

  const cloudMat = new THREE.ShaderMaterial({
    vertexShader: cloudVert, fragmentShader: cloudFrag,
    uniforms: {
      uSun: { value: SUN_DIR }, uLight: { value: new THREE.Color(0xfff1e2) },
      uShade: { value: new THREE.Color(0xc79bd6) }, uRim: { value: new THREE.Color(0xffb7a8) },
      uHaze: { value: new THREE.Color(0xf7c9d2) },
    },
  });
  const r = rng(1997);
  for (let i = 0; i < 15; i++) {
    const mesh = new THREE.Mesh(cloudGeometry(r, i), cloudMat);
    const a = (i / 15) * TAU + r() * 0.3;
    const dist = 950 + r() * 500;
    const s = 80 + r() * 90;
    mesh.position.set(Math.cos(a) * dist, 120 + r() * 230, Math.sin(a) * dist);
    mesh.scale.setScalar(s);
    mesh.rotation.y = -a + Math.PI / 2 + (r() - 0.5) * 0.5;
    follow.add(mesh);
  }

  // Neighbouring island: a broad shield volcano on the horizon.
  {
    const w = 760, d = 380, sx = 56, sz = 26;
    const geo = new THREE.PlaneGeometry(w, d, sx, sz);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    const col = new Float32Array(p.count * 3);
    const low = new THREE.Color(0xc9a6dc), high = new THREE.Color(0x7d6fc4), c = new THREE.Color();
    for (let k = 0; k < p.count; k++) {
      const u = p.getX(k) / (w / 2), v = p.getZ(k) / (d / 2);
      const rr = Math.min(1, Math.sqrt(u * u + v * v * 1.3));
      const h = 125 * Math.pow(1 - rr * rr, 1.25) * (0.86 + 0.3 * fbm(u * 3 + 9, v * 3, 4));
      p.setY(k, h - 2);
      c.copy(low).lerp(high, Math.min(1, h / 120));
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const island = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
    island.position.set(1150, 0, -640);
    island.rotation.y = 0.5;
    group.add(island);
  }

  const hemi = new THREE.HemisphereLight(0xc4ccff, 0xf2b98a, 1.5);
  const sun = new THREE.DirectionalLight(0xffe0b4, 3.7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 220;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.06;
  group.add(hemi, sun, sun.target);

  // Keep the shadow frustum centred on the focus point, snapped to texels to avoid shimmer.
  const texel = 60 / 2048;
  const focus = new THREE.Vector3();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), SUN_DIR).normalize();
  const up = new THREE.Vector3().crossVectors(SUN_DIR, right).normalize();
  function update(cameraPos, target) {
    follow.position.set(cameraPos.x, 0, cameraPos.z);
    const a = Math.round(target.dot(right) / texel) * texel;
    const b = Math.round(target.dot(up) / texel) * texel;
    focus.copy(right).multiplyScalar(a).addScaledVector(up, b).addScaledVector(SUN_DIR, target.dot(SUN_DIR));
    sun.target.position.copy(focus);
    sun.position.copy(focus).addScaledVector(SUN_DIR, 110);
  }
  return { group, sun, hemi, update };
}
