// Dev-only character viewer (loaded from main.js in dev builds when the URL has ?char).
// Renders the explorer from several angles side by side, for comparing with the
// character sheet. Query parameters:
//   yaws=0,90,180,35   view angles in degrees (0 = front)
//   focus=body|head|torso|legs|feet|pack
//   pose=idle|walk|run|sit|ground|reach   phase=1.2 freezes the gait at that phase
//   expr=neutral|surprised|laugh|focused  top=…  bottoms=…  footwear=…
// The same settings can be changed live through window.cv.set({ … }).
import * as THREE from 'three';
import { Character, WARDROBE } from '../entities/character.js';

const FOCUS = {
  body: { y: 0.86, d: 4.3 }, head: { y: 1.38, d: 1.35 }, torso: { y: 1.12, d: 2.0 },
  legs: { y: 0.45, d: 2.4 }, feet: { y: 0.1, d: 1.05 }, pack: { y: 1.12, d: 1.6 },
};

export function startCharViewer(canvas) {
  const q = Object.fromEntries(new URLSearchParams(location.search));
  const opt = { yaws: '0,90,180,35', focus: 'body', pose: 'idle', pitch: 6, ...q };
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.setScissorTest(true);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf7e9f1);
  // Same light rig as the game (world/sky.js).
  scene.add(new THREE.HemisphereLight(0xc4ccff, 0xf2b98a, 1.5));
  const sun = new THREE.DirectionalLight(0xffe0b4, 3.7);
  sun.position.set(2.5, 5, 3.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 2.5, bottom: -1, near: 0.5, far: 14 });
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(3, 48), new THREE.MeshStandardMaterial({ color: 0xf1dbe8, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const girl = new Character();
  girl.time = 1; // start clear of the blink at t = 0
  scene.add(girl.root);
  const camera = new THREE.PerspectiveCamera(24, 1, 0.05, 50);

  const state = () => {
    const pose = opt.pose;
    return { speed: pose === 'walk' ? 3.2 : pose === 'run' ? 5.8 : 0, run: pose === 'run' ? 1 : 0, sitting: pose === 'sit' ? true : pose === 'ground' ? 'ground' : false, reaching: pose === 'reach' };
  };
  const apply = () => {
    for (const slot of Object.keys(WARDROBE)) if (opt[slot]) girl.setOutfit(slot, opt[slot]);
    if (opt.expr) girl.setExpression(opt.expr);
    for (let i = 0; i < 80; i++) girl.update(0.05, state()); // settle into the pose at once
  };
  apply();
  window.cv = { girl, opt, set: (o) => { Object.assign(opt, o); apply(); } };

  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (opt.phase !== undefined) girl.phase = +opt.phase;
    girl.update(dt, state());

    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * renderer.getPixelRatio())) renderer.setSize(w, h, false);
    const yaws = String(opt.yaws).split(',').map(Number), f = FOCUS[opt.focus] || FOCUS.body;
    const vw = w / yaws.length, pitch = (+opt.pitch * Math.PI) / 180;
    const y = f.y + (opt.dy ? +opt.dy : 0), d = f.d * (opt.zoom ? 1 / +opt.zoom : 1);
    camera.aspect = vw / h;
    camera.updateProjectionMatrix();
    yaws.forEach((deg, i) => {
      const a = (deg * Math.PI) / 180;
      camera.position.set(Math.sin(a) * Math.cos(pitch) * d, y + Math.sin(pitch) * d, Math.cos(a) * Math.cos(pitch) * d);
      camera.lookAt(0, y, 0);
      renderer.setViewport(i * vw, 0, vw, h);
      renderer.setScissor(i * vw, 0, vw, h);
      renderer.render(scene, camera);
    });
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
