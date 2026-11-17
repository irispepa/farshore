// Assembles the Sheltered Cove scene.
import * as THREE from 'three';
import { buildTerrain, makeGrainTexture } from './terrain.js';
import { buildWater } from './water.js';
import { buildSky, SUN_DIR, FOG } from './sky.js';
import { buildFlora } from './flora.js';
import { buildRocks, buildProps } from './props.js';
import { timeUniform } from './common.js';

export function buildWorld(scene) {
  scene.fog = new THREE.Fog(FOG.color, FOG.near, FOG.far);
  scene.background = FOG.color;
  const terrain = buildTerrain();
  const sky = buildSky();
  const water = buildWater(terrain.heightTexture, SUN_DIR, FOG);
  const props = buildProps();
  scene.add(sky.group, terrain.group, water.mesh, buildFlora(), buildRocks(makeGrainTexture()), props.group);
  return {
    sky, water, props,
    update(t, camera, focus) {
      timeUniform.value = t;
      water.update(t);
      props.update(t);
      sky.update(camera.position, focus);
    },
  };
}
