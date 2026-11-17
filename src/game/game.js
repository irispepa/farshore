// The game: owns the scene, the loop and the flow between walking, sailing, the
// spyglass, cards and the atlas.
import * as THREE from 'three';
import { buildWorld } from '../world/world.js';
import { heightAt, groundAt, caveAt, roofAt, reefAt, POI, CAVE } from '../world/terrain.js';
import { waveHeight, WIND } from '../world/water.js';
import { Character, WARDROBE } from '../entities/character.js';
import { Canoe } from '../entities/canoe.js';
import { Whale } from '../entities/whale.js';
import { Spray } from '../fx/spray.js';
import { clamp, damp } from '../core/util.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { ChaseCamera } from './camera.js';
import { Walker } from './walker.js';
import { Sailing } from './sailing.js';
import { freshSave, loadSave, storeSave, clearSave, stageOf } from './save.js';
import { OBJECTIVES, PLACES, CARDS, LOOT, HINT, MAP, lootCard } from './story.js';
import { UI } from '../ui/ui.js';
import { Journal } from '../ui/journal.js';

const START_FACING = 2.0;
const MARK_RADIUS = 30;     // how close an atlas mark must be to the whale's water
const HULL_HALF = 2.3, HULL_R = 0.62;

export class Game {
  constructor(canvas, uiRoot) {
    const renderer = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }));
    this.pixelRatio = Math.min(devicePixelRatio || 1, 2);
    renderer.setPixelRatio(this.pixelRatio);
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.shadowMap.enabled = true;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 4000);
    this.world = buildWorld(this.scene);
    this.girl = new Character();
    this.canoe = new Canoe();
    this.spray = new Spray();
    this.whale = new Whale(this.spray);
    this.scene.add(this.girl.root, this.canoe.group, this.spray.points, this.whale.group);

    this.ui = new UI(uiRoot);
    this.input = new Input(canvas, this.ui.el.stick);
    this.sound = new Sound();
    this.cam = new ChaseCamera(this.camera);
    this.walker = new Walker(this.girl);
    this.sailing = new Sailing(this.canoe);
    this.walker.obstacle = (p) => this.#pushOutOfHull(p);

    this.save = freshSave();
    this.state = 'title';   // title | play | card | journal | pause
    this.mode = 'walk';     // walk | sail
    this.spy = null;        // { t, seen, done } while the spyglass is up
    this.time = 0;
    this.action = null;     // current contextual action { label, icon, at, run }
    this.hintAt = {};       // last time each hint was shown
    this.saveTimer = 0;
    this.songTimer = 14;
    this.wake = 0;
    this.caveMix = 0;
    this.restartArmed = -1e9;
    this.frameAvg = 16;
    this.slowFor = 0;
    this.wasBreaching = false;

    this.focus = new THREE.Vector3();
    this._v = new THREE.Vector3();
    this._axis = { x: 0, y: 0 };
    this._look = { dx: 0, dy: 0 };
    this._land = { x: 0, z: 0 };
    this._eye = new THREE.Vector3();
    this._aim = new THREE.Vector3();

    const game = this;
    this.journal = new Journal(this.ui.el.journal, {
      get save() { return game.save; },
      playerPos: () => (game.mode === 'sail' ? game.canoe.group.position : game.girl.root.position),
      onMark: (x, z) => game.#onMark(x, z),
      onEquip: (slot, id) => game.#equip(slot, id),
      onClose: () => { game.state = 'play'; game.input.enabled = true; game.persist(); },
      persist: () => game.persist(),
      tick: () => game.sound.tick(),
      scribble: () => game.sound.pencil?.(),
    });
    this.journal.setMapImage(this.#renderMap());

    const ui = this.ui;
    ui.onAction = () => this.#act();
    ui.onJournal = () => this.openJournal();
    ui.onPause = () => this.pause(true);
    ui.onResume = () => this.pause(false);
    ui.onRestart = () => this.#restart();
    ui.onSound = () => { this.sound.setMuted(!this.sound.muted); ui.setSound(!this.sound.muted); };
    ui.setSound(!this.sound.muted);
    this.input.onKey = (code) => this.#key(code);

    addEventListener('resize', () => this.resize());
    window.visualViewport?.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.persist(); if (this.state === 'play') this.pause(true); else this.sound.suspend?.(); }
      else if (this.state !== 'pause') this.sound.resume?.();
    });
    addEventListener('pagehide', () => this.persist());
    this.resize();

    this.#resetWorld(null);
    this.last = performance.now() / 1000;
    renderer.setAnimationLoop((ms) => this.#frame(ms / 1000));
  }

  // ---- Boot, save and restart ----------------------------------------------
  async begin() {
    const saved = loadSave();
    const choice = await this.ui.ready(!!saved);
    this.sound.start();
    if (choice === 'continue' && saved) this.#resetWorld(saved);
    else { clearSave(); this.#resetWorld(null); }
    this.ui.hideTitle();
    this.state = 'play';
    this.ui.showHud(true);
    if (choice !== 'continue') await this.#card('letter');
    this.persist();
  }

  #resetWorld(saved) {
    const s = (this.save = saved || freshSave());
    s.stage = stageOf(s);
    const { girl, canoe, world } = this;
    for (const slot of Object.keys(s.outfit)) girl.setOutfit(slot, s.outfit[slot]);

    const c = s.canoe || POI.canoe;
    canoe.group.position.set(c.x, 0, c.z);
    canoe.heading = c.heading;
    canoe.speed = canoe.turn = 0;

    this.#stopSpy();
    if (saved && s.mode === 'sail') this.#seat();
    else {
      this.mode = 'walk';
      this.scene.add(girl.root);
      const p = s.player || { x: POI.start.x, z: POI.start.z, y: 30, facing: START_FACING };
      this.walker.place(p.x, p.z, p.facing, p.y);
    }

    world.props.tin.userData.lid.position.set(0, 0.22, 0);
    world.props.tin.userData.lid.rotation.set(0, 0, 0);
    world.props.tinSpark.visible = !s.clues.tin;
    if (s.clues.tin) this.#liftTinLid(1);
    for (const [id, chest] of Object.entries(world.props.chests)) {
      chest.mesh.userData.hinge.rotation.x = s.chests[id] ? -1.25 : 0;
      chest.spark.visible = !s.chests[id];
    }
    this.lidAnim = null;

    this.#focusPoint(this.focus);
    this.cam.snap(this.focus, (this.mode === 'sail' ? canoe.heading : this.walker.facing) + Math.PI, this.mode === 'sail' ? 0.3 : 0.24, this.mode === 'sail' ? 8.5 : 4.4);
    this.ui.setObjective(OBJECTIVES[s.stage]);
    this.ui.setAction('');
    this.ui.setPrompt('');
  }

  persist() {
    if (this.state === 'title') return;
    const s = this.save, g = this.girl.root.position, c = this.canoe;
    s.mode = this.mode;
    s.canoe = { x: c.group.position.x, z: c.group.position.z, heading: c.heading };
    if (this.mode === 'walk') s.player = { x: g.x, y: g.y, z: g.z, facing: this.walker.facing };
    storeSave(s);
  }

  #restart() {
    // Two taps, so a stray thumb cannot wipe the voyage.
    const btn = this.ui.root.querySelector('#btn-restart');
    const now = performance.now();
    if (now - this.restartArmed > 4000) {
      this.restartArmed = now;
      btn.textContent = 'Tap again to restart';
      return;
    }
    btn.textContent = 'Restart voyage';
    this.restartArmed = -1e9;
    clearSave();
    this.#resetWorld(null);
    this.pause(false);
    this.#card('letter').then(() => this.persist());
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // Top-down render of the cove, used as the atlas page.
  #renderMap() {
    const { renderer, scene } = this;
    const cx = (MAP.x0 + MAP.x1) / 2, cz = (MAP.z0 + MAP.z1) / 2;
    const hw = (MAP.x1 - MAP.x0) / 2, hd = (MAP.z1 - MAP.z0) / 2;
    const cam = new THREE.OrthographicCamera(-hw, hw, hd, -hd, 1, 700);
    cam.position.set(cx, 320, cz);
    cam.up.set(0, 0, -1);
    cam.lookAt(cx, 0, cz);
    const hidden = [this.girl.root, this.canoe.group, this.whale.group, this.spray.points];
    for (const o of hidden) o.visible = false;
    const fog = scene.fog, near = fog.near, far = fog.far;
    fog.near = 5000; fog.far = 9000;
    this.world.update(0, cam, new THREE.Vector3(cx, 0, cz));
    renderer.setPixelRatio(1);
    renderer.setSize(MAP.w, MAP.h, false);
    renderer.render(scene, cam);
    const out = document.createElement('canvas');
    out.width = MAP.w; out.height = MAP.h;
    out.getContext('2d').drawImage(renderer.domElement, 0, 0, MAP.w, MAP.h);
    fog.near = near; fog.far = far;
    for (const o of hidden) o.visible = true;
    renderer.setPixelRatio(this.pixelRatio);
    return out;
  }

  // ---- Flow -------------------------------------------------------------------
  async #card(key) {
    const prev = this.state;
    this.state = 'card';
    this.input.enabled = false;
    this.input.reset();
    this.ui.setPrompt('');
    this.sound.paper?.();
    await this.ui.card(typeof key === 'string' ? CARDS[key] : key);
    this.sound.tick();
    this.state = prev === 'title' || prev === 'card' ? 'play' : prev;
    if (this.state === 'play') this.input.enabled = true;
  }

  openJournal(tab = 'map', tool) {
    if (this.state !== 'play') return;
    this.#stopSpy();
    this.state = 'journal';
    this.input.enabled = false;
    this.input.reset();
    this.ui.setPrompt('');
    this.sound.paper?.();
    this.journal.open(tab, tool);
  }

  pause(on) {
    if (on && this.state !== 'play') return;
    if (!on && this.state !== 'pause') return;
    this.state = on ? 'pause' : 'play';
    this.input.enabled = !on;
    this.input.reset();
    this.ui.showPause(on);
    this.ui.setPrompt('');
    if (on) { this.persist(); this.sound.suspend?.(); }
    else {
      this.sound.resume?.();
      this.restartArmed = -1e9;
      this.ui.root.querySelector('#btn-restart').textContent = 'Restart voyage';
    }
  }

  #key(code) {
    if (code === 'Escape' || code === 'KeyP') {
      if (this.state === 'journal') this.journal.close();
      else this.pause(this.state === 'play');
    } else if (code === 'KeyJ' || code === 'KeyM' || code === 'Tab') {
      if (this.state === 'journal') this.journal.close(); else this.openJournal();
    } else if ((code === 'KeyE' || code === 'Space' || code === 'Enter') && this.state === 'play') this.#act();
  }

  #hint(key, ms = 3200, every = 9) {
    if (this.time - (this.hintAt[key] ?? -99) < every) return;
    this.hintAt[key] = this.time;
    this.ui.toast(HINT[key], ms);
  }

  #clue(id) {
    const s = this.save;
    if (s.clues[id]) return false;
    s.clues[id] = true;
    s.stage = stageOf(s);
    this.ui.setObjective(OBJECTIVES[s.stage]);
    this.persist();
    return true;
  }

  #equip(slot, id) {
    if (!this.save.owned[slot].includes(id)) return;
    this.girl.setOutfit(slot, id);
    this.save.outfit[slot] = id;
    this.sound.pickup?.();
    this.persist();
  }

  // A find: wide eyes while its card is up, a laugh once it is put away.
  async #delight(key) {
    this.girl.setExpression('surprised');
    await this.#card(key);
    this.girl.setExpression('laugh', 2.4);
  }

  // Called by the journal when a symbol is stamped on the map.
  #onMark(x, z) {
    this.sound.stamp?.();
    const s = this.save;
    if (s.stage !== 2) return false;
    if (Math.hypot(x - POI.whale.x, z - POI.whale.z) > MARK_RADIUS) {
      this.ui.toast(CARDS.wrongMark, 3600);
      this.sound.error?.();
      return false;
    }
    this.#clue('heading');
    this.journal.refresh();
    setTimeout(async () => {
      this.journal.close();
      this.sound.fanfare();
      await this.#delight('heading');
      this.persist();
    }, 900);
    return true;
  }

  // ---- Walking ↔ sailing -------------------------------------------------------
  #seat() {
    const { girl, canoe } = this;
    this.mode = 'sail';
    canoe.tilt.add(girl.root);
    girl.root.position.copy(canoe.seat);
    girl.root.rotation.set(0, 0, 0);
  }

  #board() {
    this.#seat();
    this.cam.idle = 9;
    this.sound.creak?.();
    this.#hint('sailTip', 4200, 60);
    this.persist();
  }

  #disembark(spot) {
    const { girl, canoe } = this;
    this.mode = 'walk';
    this.scene.add(girl.root);
    const p = canoe.group.position;
    this.walker.place(spot.x, spot.z, Math.atan2(spot.x - p.x, spot.z - p.z), 1.6);
    canoe.speed = 0;
    this.sound.creak?.();
    if (heightAt(spot.x, spot.z) < 0.05) this.sound.splash();
    this.persist();
  }

  // Keep the walker out of the beached hull.
  #pushOutOfHull(p) {
    const c = this.canoe, o = c.group.position;
    if (Math.abs(p.x - o.x) > 4 || Math.abs(p.z - o.z) > 4 || p.y > 1.4) return;
    const sin = Math.sin(c.heading), cos = Math.cos(c.heading);
    const rx = p.x - o.x, rz = p.z - o.z;
    const t = clamp(rx * sin + rz * cos, -HULL_HALF, HULL_HALF);
    const dx = rx - sin * t, dz = rz - cos * t, d = Math.hypot(dx, dz);
    if (d < HULL_R && d > 1e-4) { p.x += (dx / d) * (HULL_R - d); p.z += (dz / d) * (HULL_R - d); }
  }

  // ---- Spyglass -----------------------------------------------------------------
  // from: 'lookout' when raised at the lookout bench, so the eye steps up to the lip.
  #startSpy(from = null) {
    this.spy = { t: 0, seen: 0, done: false, from };
    this.whale.cue();
    this.cam.beginSpy(this.#whaleAim(this._aim));
    this.ui.spyglass(true);
    this.input.reset();
    if (!this.save.clues.whale) this.#hint('spyWait', 3000, 20);
  }

  #stopSpy() {
    if (!this.spy) return;
    this.spy = null;
    this.ui.spyglass(false);
    this.cam.idle = 9;
  }

  #whaleAim(out) {
    return this.whale.watchPoint(out);
  }

  #spyEye(out) {
    if (this.mode === 'sail') return out.copy(this.canoe.group.position).setY(1.45 + this.canoe.tilt.position.y);
    if (this.spy && this.spy.from === 'lookout') {
      // She steps up beside the bench, a metre toward the sea, wherever in reach she pressed it.
      const L = POI.lookout, dx = POI.whale.x - L.x, dz = POI.whale.z - L.z, d = Math.hypot(dx, dz);
      const x = L.x + dx / d, z = L.z + dz / d;
      return out.set(x, heightAt(x, z) + 1.6, z);
    }
    return out.copy(this.girl.root.position).setY(this.girl.root.position.y + 1.6);
  }

  // Zoom so roughly 16 m of height is in view at the whale: a breach fills the glass near or far.
  #spyFov(eye, aim) {
    const d = Math.hypot(aim.x - eye.x, aim.z - eye.z);
    return clamp((2 * Math.atan(8 / Math.max(d, 1)) * 180) / Math.PI, 8, 17);
  }

  // ---- Contextual action --------------------------------------------------------
  #findAction() {
    if (this.spy) return { label: 'Done', icon: 'eye', run: () => this.#stopSpy() };
    const s = this.save, props = this.world.props;
    if (this.mode === 'sail') {
      const c = this.canoe.group.position;
      if (Math.abs(this.canoe.speed) < 2.2) {
        const spot = this.sailing.findLanding(this._land);
        if (spot) return { label: 'Land', icon: 'anchor', run: () => this.#disembark(spot) };
      }
      if (Math.hypot(c.x - POI.whale.x, c.z - POI.whale.z) < 62) return { label: 'Watch', icon: 'eye', run: () => this.#startSpy() };
      return null;
    }
    const p = this.girl.root.position;
    const near = (q, r) => Math.hypot(p.x - q.x, p.z - q.z) < r && Math.abs(p.y - heightAt(q.x, q.z)) < 2.2;
    let best = null, bestD = Infinity;
    const offer = (q, r, y, action) => {
      if (!near(q, r)) return;
      const d = Math.hypot(p.x - q.x, p.z - q.z);
      if (d < bestD) { bestD = d; best = { ...action, at: this._v.clone().set(q.x, heightAt(q.x, q.z) + y, q.z), face: q }; }
    };
    if (!s.clues.tin) offer(POI.tin, 2.1, 0.75, { label: 'Open', icon: 'hand', run: () => this.#openTin() });
    for (const id of Object.keys(props.chests)) {
      if (!s.chests[id]) offer(POI[id === 'islet' ? 'islet' : 'shelfTip'], 2.6, 0.95, { label: 'Open', icon: 'hand', run: () => this.#openChest(id) });
    }
    offer(POI.sign, 2.4, 2.0, { label: 'Read', icon: 'eye', run: async () => { this.girl.setExpression('focused'); await this.#card('sign'); this.girl.setExpression('neutral'); } });
    offer(POI.lookout, 4.6, 1.3, { label: 'Look out', icon: 'eye', run: () => this.#startSpy('lookout') });
    const c = this.canoe.group.position;
    const dc = Math.hypot(p.x - c.x, p.z - c.z);
    if (dc < 5.6 && p.y < 1.8 && dc < bestD) best = { label: 'Sail', icon: 'sail', at: this._v.clone().set(c.x, 1.5, c.z), run: () => this.#board() };
    return best;
  }

  #act() {
    if (this.state !== 'play' || !this.action) return;
    const a = this.action;
    if (a.face && this.mode === 'walk') { this.walker.face(a.face.x, a.face.z); this.walker.reach = 0.55; }
    this.sound.tick();
    a.run();
  }

  #liftTinLid(k) {
    const lid = this.world.props.tin.userData.lid;
    lid.position.set(-0.16 * k, 0.22 + 0.13 * k, -0.2 * k);
    lid.rotation.set(-0.9 * k, 0, 0.25 * k);
  }

  async #openTin() {
    this.lidAnim = { t: 0, apply: (k) => this.#liftTinLid(k) };
    this.world.props.tinSpark.visible = false;
    // Reaching the tin by the cleft skips the cave mouth; the atlas should still know the cave.
    this.save.clues.cave = this.save.places.cave = true;
    this.#clue('tin');
    this.sound.chime();
    await new Promise((r) => setTimeout(r, 650));
    await this.#delight('tin');
    if (this.save.stage === 2) this.#hint('markNow', 4200, 0);
  }

  async #openChest(id) {
    const chest = this.world.props.chests[id], loot = LOOT[id], s = this.save;
    this.lidAnim = { t: 0, apply: (k) => { chest.mesh.userData.hinge.rotation.x = -1.25 * k; } };
    chest.spark.visible = false;
    s.chests[id] = true;
    if (!s.owned[loot.slot].includes(loot.id)) s.owned[loot.slot].push(loot.id);
    this.persist();
    this.sound.pickup?.();
    await new Promise((r) => setTimeout(r, 600));
    await this.#delight(lootCard(WARDROBE[loot.slot][loot.id].name, loot.where));
  }

  // ---- Per-frame ------------------------------------------------------------------
  #focusPoint(out) {
    if (this.mode === 'sail') return out.copy(this.canoe.group.position).setY(1.35);
    const p = this.girl.root.position;
    return out.set(p.x, p.y + 1.22, p.z);
  }

  #triggers() {
    const s = this.save;
    const p = this.mode === 'sail' ? this.canoe.group.position : this.girl.root.position;
    for (const place of PLACES) {
      if (s.places[place.id] || !place.r) continue;
      if (Math.hypot(p.x - place.at[0], p.z - place.at[1]) < place.r) {
        s.places[place.id] = true;
        this.ui.toast(`${place.name} added to your map`);
        this.sound.pickup?.();
        this.persist();
      }
    }
    if (!s.clues.cave && p.y < 2.5 && (Math.hypot(p.x - CAVE.x, p.z - CAVE.zMouth) < 13 || Math.hypot(p.x - POI.caveView.x, p.z - POI.caveView.z) < 5)) {
      s.places.cave = true;
      this.#clue('cave');
      this.sound.chime();
      this.#card('cave');
    }
  }

  #updateSpy(dt) {
    const spy = this.spy, whale = this.whale;
    spy.t += dt;
    const eye = this.#spyEye(this._eye), aim = this.#whaleAim(this._aim);
    this.cam.spy(dt, eye, aim, this.input.consumeLook(this._look), this.#spyFov(eye, aim));
    if (whale.breaching) spy.seen += dt;
    // Wait for her to crash back down before calling it a sighting.
    if (spy.seen > 1.2 && !whale.breaching && !spy.done && !this.save.clues.whale) {
      spy.done = true;
      setTimeout(async () => {
        if (!this.spy) return;
        this.#stopSpy();
        this.#clue('whale');
        this.sound.chime();
        await this.#delight('whale');
        if (this.save.stage === 2) this.#hint('markNow', 4500, 0);
      }, 1500);
    }
  }

  #updatePlay(dt) {
    const { input, cam, canoe, walker, sailing } = this;
    const ax = input.axis(this._axis);
    const moving = Math.hypot(ax.x, ax.y) > 0.15;
    if (this.spy && moving && this.spy.t > 0.4) this.#stopSpy();

    if (this.mode === 'walk') {
      if (this.spy) walker.update(dt, 0, 0, cam.yaw); else walker.update(dt, ax.x, ax.y, cam.yaw, input.sprint);
      sailing.rest(dt);
      if (walker.blocked === 'deep' && moving) this.#hint('deep');
    } else {
      if (this.spy) sailing.rest(dt); else sailing.update(dt, ax.x, ax.y, WIND);
      this.girl.update(dt, { speed: 0, sitting: true });
      if (sailing.bump) {
        const o = canoe.group.position, bx = o.x + Math.sin(canoe.heading) * 2.5, bz = o.z + Math.cos(canoe.heading) * 2.5;
        this.sound.creak?.();
        this.#hint(reefAt(bx, bz) > 0.2 ? 'reef' : 'shallow', 3400, 12);
      }
      if (sailing.atEdge) this.#hint('edge', 3200, 12);
      // Bow wave.
      const sp = Math.abs(canoe.speed);
      this.wake += sp > 2 ? dt * sp * 5 : 0;
      if (this.wake >= 1) {
        const n = Math.floor(this.wake), o = canoe.group.position;
        this.wake -= n;
        this.spray.emit(o.x + Math.sin(canoe.heading) * 2.5, 0.12, o.z + Math.cos(canoe.heading) * 2.5, n, 0.3, 1.5, 1.3);
      }
    }

    if (this.spy) this.#updateSpy(dt);
    else {
      this.#focusPoint(this.focus);
      const look = input.consumeLook(this._look);
      if (this.mode === 'sail') {
        cam.update(dt, this.focus, { dist: 8.5, pitch: 0.3, followYaw: canoe.heading + Math.PI, followRate: 1.5, look, t: this.time });
      } else {
        // Follow behind when she moves across the view; never swing round when she runs at the camera.
        const want = walker.facing + Math.PI;
        const off = Math.atan2(Math.sin(want - cam.yaw), Math.cos(want - cam.yaw));
        const rate = Math.abs(off) > 2.5 ? 0 : (1.3 + 0.7 * walker.run) * clamp(walker.speed / 3.2, 0, 1) * (0.2 + 0.8 * Math.abs(Math.sin(off)));
        cam.update(dt, this.focus, { dist: 4.4 + 0.9 * walker.run, pitch: 0.24, followYaw: want, followRate: rate, look, t: this.time });
      }
    }

    this.#triggers();
    this.action = this.#findAction();
    const a = this.action;
    this.ui.setAction(a ? a.label : '', a ? a.icon : 'hand');
    if (a && a.at && !this.spy) {
      const v = this._v.copy(a.at).project(this.camera);
      if (v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1) this.ui.setPrompt(a.label, (v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight);
      else this.ui.setPrompt('');
    } else this.ui.setPrompt('');

    this.saveTimer += dt;
    if (this.saveTimer > 6) { this.saveTimer = 0; this.persist(); }
  }

  #updateAudio(dt) {
    const sail = this.mode === 'sail';
    const p = sail ? this.canoe.group.position : this.girl.root.position;
    const inCave = caveAt(p.x, p.z) > 0.5 && (roofAt(p.x, p.z) || p.z < CAVE.zLedge + 1) && p.y < 3;
    this.caveMix = damp(this.caveMix, inCave ? 1 : 0, 1.6, dt);
    const ground = sail ? 0 : groundAt(p.x, p.z, p.y);
    this.sound.update?.(dt, {
      mode: this.mode,
      speed: this.state === 'play' ? (sail ? Math.abs(this.canoe.speed) : this.walker.speed) : 0,
      wading: sail ? 0 : this.walker.wading,
      cave: this.caveMix,
      shore: sail ? 0.8 : 1 - clamp((ground - 0.6) / 7, 0, 0.75),
      wind: sail ? clamp(0.35 + Math.abs(this.canoe.speed) / 9, 0, 1) : clamp(0.12 + ground / 20, 0, 0.5),
    });
    // Whale sounds carry when she is close or being watched.
    const w = this.whale, d = Math.hypot(p.x - w.centre.x, p.z - w.centre.z);
    if (this.wasBreaching && !w.breaching && (this.spy || d < 110)) this.sound.breach?.();
    this.wasBreaching = w.breaching;
    this.songTimer -= dt;
    if (this.songTimer < 0) {
      this.songTimer = 22 + Math.random() * 16;
      if (this.state === 'play' && (d < 95 || this.spy)) this.sound.whaleSong?.();
    }
  }

  // Drop resolution if the phone cannot hold the frame rate.
  #adapt(rawDt) {
    this.frameAvg = damp(this.frameAvg, rawDt * 1000, 2, rawDt);
    this.slowFor = this.frameAvg > 24 ? this.slowFor + rawDt : 0;
    if (this.slowFor > 2.5 && this.pixelRatio > 1) {
      this.pixelRatio = Math.max(1, this.pixelRatio - 0.25);
      this.renderer.setPixelRatio(this.pixelRatio);
      this.resize();
      this.slowFor = 0;
    }
  }

  #frame(now) {
    const raw = now - this.last;
    this.last = now;
    const dt = clamp(raw, 0, 0.05);
    if (this.state === 'pause') { this.renderer.render(this.scene, this.camera); return; }
    this.time += dt;
    if (raw > 0 && raw < 0.25 && this.state === 'play') this.#adapt(raw);

    if (this.state === 'play') this.#updatePlay(dt);
    else {
      this.sailing.rest(dt);
      this.girl.update(dt, { speed: 0, sitting: this.mode === 'sail' });
      if (this.state === 'title') this.cam.orbit(dt, this.time);
      else if (!this.spy) {
        this.#focusPoint(this.focus);
        this.cam.update(dt, this.focus, { dist: this.mode === 'sail' ? 8.5 : 4.4, pitch: this.mode === 'sail' ? 0.3 : 0.24, followYaw: null, followRate: 0, look: null, t: this.time });
      }
    }

    if (this.lidAnim) {
      const a = this.lidAnim;
      a.t = Math.min(1, a.t + dt * 2.2);
      a.apply(1 - (1 - a.t) ** 3);
      if (a.t >= 1) this.lidAnim = null;
    }

    this.canoe.update(dt, this.time, (x, z) => waveHeight(x, z, this.time), WIND);
    this.whale.update(dt);
    this.spray.update(dt);
    this.#updateAudio(dt);
    this.world.update(this.time, this.camera, this.state === 'title' ? this.cam.target : this.focus);
    this.renderer.render(this.scene, this.camera);
  }
}
