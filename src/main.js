import './style.css';
import * as THREE from 'three';
import { buildWorld } from './world/world.js';
import { heightAt, POI } from './world/terrain.js';
import { Character } from './entities/character.js';
import { Canoe } from './entities/canoe.js';
import { Whale } from './entities/whale.js';
import { Spray } from './fx/spray.js';
import { waveHeight, WIND } from './world/water.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 4000);
const t0 = performance.now();
const world = buildWorld(scene);
console.log('world built in', Math.round(performance.now() - t0), 'ms');
const girl = new Character(); girl.root.position.set(POI.start.x, heightAt(POI.start.x, POI.start.z), POI.start.z); girl.root.rotation.y = 2.4; scene.add(girl.root);
const canoe = new Canoe(); canoe.group.position.set(POI.canoe.x, 0, POI.canoe.z); canoe.heading = POI.canoe.heading; scene.add(canoe.group);
const spray = new Spray(); scene.add(spray.points);
const whale = new Whale(spray); scene.add(whale.group);
let last = 0;
const focus = new THREE.Vector3(POI.start.x, heightAt(POI.start.x, POI.start.z) + 1, POI.start.z);
window.__dbg = { girl, canoe, whale, camera, scene, renderer, focus, THREE, view(px, py, pz, tx, ty, tz) { camera.position.set(px, py, pz); focus.set(tx, ty, tz); } };
window.__dbg.view(-6, 3.2, 44, 20, 1.5, 5);
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
renderer.setAnimationLoop((ms) => {
  const dt = Math.min(0.05, ms / 1000 - last); last = ms / 1000;
  girl.update(dt, { speed: window.__spd || 0, sitting: window.__sit });
  canoe.update(dt, last, (x, z) => waveHeight(x, z, last), WIND); whale.update(dt); spray.update(dt);
  camera.lookAt(focus);
  world.update(ms / 1000, camera, focus);
  renderer.render(scene, camera);
});
