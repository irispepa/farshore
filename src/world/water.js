// Stylised sea: depth-tinted, see-through shallows, caustic webbing, shore foam.
import * as THREE from 'three';
import { smoothstep } from '../core/util.js';
import { X0, Z0, NX, NZ, heightAt } from './terrain.js';

// Wind blows toward the south-west (trade winds from the north-east).
export const WIND = new THREE.Vector2(-0.8, 0.6).normalize();

// Must match the vertex shader below; used for canoe bobbing.
export function waveHeight(x, z, t) {
  const amp = smoothstep(0.5, 6, -heightAt(x, z));
  return amp * (0.2 * Math.sin(x * 0.06 + z * 0.035 + t * 0.9)
    + 0.11 * Math.sin(-x * 0.045 + z * 0.13 + t * 1.25)
    + 0.045 * Math.sin(x * 0.17 + z * 0.15 + t * 1.7));
}

const vertexShader = /* glsl */ `
uniform sampler2D uH; uniform float uTime; uniform vec4 uBounds;
varying vec3 vW; varying vec2 vSlope;
float terrainH(vec2 xz){
  vec2 uv = (xz - uBounds.xy) / uBounds.zw;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return -14.0;
  return texture2D(uH, uv).r;
}
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  float amp = smoothstep(0.5, 6.0, -terrainH(wp.xz));
  float a = wp.x*0.06 + wp.z*0.035 + uTime*0.9;
  float b = -wp.x*0.045 + wp.z*0.13 + uTime*1.25;
  float c = wp.x*0.17 + wp.z*0.15 + uTime*1.7;
  wp.y += amp * (0.2*sin(a) + 0.11*sin(b) + 0.045*sin(c));
  vSlope = amp * vec2(0.2*0.06*cos(a) - 0.11*0.045*cos(b) + 0.045*0.17*cos(c),
                      0.2*0.035*cos(a) + 0.11*0.13*cos(b) + 0.045*0.15*cos(c));
  vW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const fragmentShader = /* glsl */ `
uniform sampler2D uH; uniform float uTime; uniform vec4 uBounds; uniform vec3 uSun;
uniform vec3 uShallow, uMid, uDeep, uAbyss, uSkyLow, uSkyHigh, uFogColor, uSunColor;
uniform float uFogNear, uFogFar;
varying vec3 vW; varying vec2 vSlope;

float terrainH(vec2 xz){
  vec2 uv = (xz - uBounds.xy) / uBounds.zw;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return -14.0;
  return texture2D(uH, uv).r;
}
// Tileable caustic webbing (after Dave Hoskins' classic water turbulence).
float caustic(vec2 uv, float t){
  vec2 p = mod(uv * 6.28318, 6.28318) - 250.0;
  vec2 i = p; float c = 1.0; const float inten = 0.005;
  for (int n = 0; n < 3; n++) {
    float tt = t * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
  }
  c /= 3.0; c = 1.17 - pow(c, 1.4);
  return pow(abs(c), 8.0);
}
void main(){
  float depth = -terrainH(vW.xz);
  float nz = sin(vW.x*0.21 + vW.z*0.17)*0.5 + sin(vW.x*0.07 - vW.z*0.11 + 1.3)*0.5;
  float swash = 0.07 + 0.07 * sin(uTime*0.9 + nz*2.5);
  float d2 = depth - swash;
  if (d2 < 0.0) discard;

  vec3 col = mix(uShallow, uMid, smoothstep(0.0, 2.4, depth));
  col = mix(col, uDeep, smoothstep(2.0, 7.5, depth));
  col = mix(col, uAbyss, smoothstep(7.0, 13.0, depth));

  vec2 q = vW.xz; float t = uTime;
  vec2 rip = vec2(
    0.05*2.1*cos(q.x*2.1 + q.y*0.8 + t*1.6) - 0.04*1.3*cos(-q.x*1.3 + q.y*2.6 + t*1.2) + 0.012*5.3*cos(q.x*5.3 + q.y*4.1 - t*2.2),
    0.05*0.8*cos(q.x*2.1 + q.y*0.8 + t*1.6) + 0.04*2.6*cos(-q.x*1.3 + q.y*2.6 + t*1.2) + 0.012*4.1*cos(q.x*5.3 + q.y*4.1 - t*2.2));
  float dist = distance(cameraPosition, vW);
  rip *= 1.0 / (1.0 + dist * 0.02);
  vec3 N = normalize(vec3(-vSlope.x - rip.x, 1.0, -vSlope.y - rip.y));
  vec3 V = normalize(cameraPosition - vW);

  // Light webbing on the shallows.
  float web = caustic(q * 0.11 + N.xz * 0.05, t * 0.55);
  col += web * vec3(0.75, 1.0, 0.9) * 0.34 * (1.0 - smoothstep(0.6, 5.5, depth)) * smoothstep(0.05, 0.5, depth);

  // Sky reflection and sun glitter.
  float fres = pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 R = reflect(-V, N);
  vec3 sky = mix(uSkyLow, uSkyHigh, clamp(R.y * 1.5, 0.0, 1.0));
  col = mix(col, sky, fres * 0.45);
  float spec = pow(max(dot(N, normalize(V + uSun)), 0.0), 220.0);
  col += uSunColor * spec * 1.6;

  // Foam: a bright lip at the waterline plus lapping bands that roll in.
  float lip = 1.0 - smoothstep(0.0, 0.09, d2);
  float band = smoothstep(0.55, 0.95, sin(depth*7.5 - t*1.3 + nz*3.0)) * (1.0 - smoothstep(0.12, 0.85, depth));
  float breakup = 0.55 + 0.45 * sin(q.x*3.1 + t*0.7) * sin(q.y*2.7 - t*0.5);
  float foam = clamp(lip + band * breakup * 0.8, 0.0, 1.0);
  col = mix(col, vec3(1.0, 0.99, 0.97), foam);

  float alpha = mix(0.34, 0.95, smoothstep(0.0, 2.8, depth));
  alpha = max(max(alpha, foam * 0.96), fres * 0.8);

  float fogF = smoothstep(uFogNear, uFogFar, dist);
  col = mix(col, uFogColor, fogF);
  alpha = mix(alpha, 1.0, fogF);

  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function buildWater(heightTexture, sunDir, fog) {
  const geo = new THREE.PlaneGeometry(1600, 1600, 256, 256);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    vertexShader, fragmentShader, transparent: true, depthWrite: false,
    uniforms: {
      uH: { value: heightTexture }, uTime: { value: 0 },
      uBounds: { value: new THREE.Vector4(X0 - 0.5, Z0 - 0.5, NX, NZ) },
      uSun: { value: sunDir.clone() },
      uShallow: { value: new THREE.Color(0x6ff2dd) }, uMid: { value: new THREE.Color(0x1dc3cf) },
      uDeep: { value: new THREE.Color(0x1563c9) }, uAbyss: { value: new THREE.Color(0x103f9e) },
      uSkyLow: { value: new THREE.Color(0xbfe6f5) }, uSkyHigh: { value: new THREE.Color(0x7f9cf5) },
      uSunColor: { value: new THREE.Color(0xfff0d0) },
      uFogColor: { value: fog.color }, uFogNear: { value: fog.near }, uFogFar: { value: fog.far },
    },
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(30, 0, 0);
  mesh.renderOrder = 2;
  mesh.frustumCulled = false;
  return { mesh, update: (t) => { mat.uniforms.uTime.value = t; } };
}
