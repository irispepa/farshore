// Synthesised soundscape: continuous surf / wind / hull / cave layers steered by update(), plus one-shots. No audio files.
const clamp01 = (v, d = 0) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : d);
const rand = (a, b) => a + Math.random() * (b - a);
const chain = (...nodes) => { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes[nodes.length - 1]; };
const settle = (p) => p && p.catch && p.catch(() => {});
const STEP_LEN = 0.75; // metres of travel per footstep
const STEER_EVERY = 0.05; // s; keeps the automation timeline short instead of one event per frame

function readMute() {
  try { return localStorage.getItem('farshore-mute') === '1'; } catch { return false; }
}

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = readMute();
    this.paused = false;
    this.stepDist = 0;
    this.steerClock = STEER_EVERY;
    this.lastPencil = -1;
    this.targets = new Map();
  }

  // Must be called from a user gesture (iOS unlocks audio only then).
  start() {
    if (this.ctx) { if (!this.paused) settle(this.ctx.resume()); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());

    // bus -> highpass (phone speakers can't use the lows) -> compressor -> master (mute) -> out
    this.master = this.#gain(this.muted ? 0 : 1);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3;
    comp.attack.value = 0.006; comp.release.value = 0.25;
    this.bus = this.#gain(1);
    chain(this.bus, this.#filter('highpass', 85), comp, this.master, ctx.destination);
    this.fx = this.#gain(1); // all one-shots go through here so the cave echo can catch them
    this.fx.connect(this.bus);

    // Cave echo: feedback delay, darkened on every pass.
    this.echo = ctx.createDelay(1);
    this.echo.delayTime.value = 0.27;
    chain(this.echo, this.#filter('lowpass', 1900), this.#gain(0.42), this.echo);
    chain(this.echo, this.#gain(0.7), this.bus);
    this.echoSend = this.#gain(0);
    chain(this.fx, this.echoSend, this.echo);
    this.whaleSend = this.#gain(0.3);
    this.whaleSend.connect(this.echo);

    this.noise = this.#noiseBuffer(2, 0);
    const brown = this.#noiseBuffer(6, 0.97);

    // Surf: brown noise through a low-pass that breathes like swell. Kept well under the
    // whale and the cues, with a shallow swell so it sits in the background.
    this.surfLp = this.#filter('lowpass', 700);
    const swell = this.#gain(0.075);
    this.surfLevel = this.#gain(1);
    this.#loop(brown, 0, this.surfLp, swell, this.surfLevel, this.bus);
    this.#lfo(0.13, 0.03, swell.gain);
    this.surfSweep = this.#lfo(0.13, 380, this.surfLp.frequency);

    // Wind in the sail: band-passed noise with two slow, unrelated gust LFOs.
    this.windBp = this.#filter('bandpass', 600, 0.9);
    const gust = this.#gain(0.7);
    this.windLevel = this.#gain(0);
    this.#loop(this.noise, 0, this.windBp, gust, this.windLevel, this.bus);
    this.#lfo(0.11, 0.25, gust.gain);
    this.#lfo(0.037, 0.2, gust.gain);
    this.#lfo(0.17, 160, this.windBp.frequency);

    // Hull water-rush with a gentle lapping pulse.
    this.hullBp = this.#filter('bandpass', 700, 0.6);
    const lap = this.#gain(0.75);
    this.hullLevel = this.#gain(0);
    this.#loop(this.noise, 1, this.hullBp, lap, this.hullLevel, this.bus);
    this.#lfo(0.8, 0.25, lap.gain);

    // Singing rock: a soft open chord (E4, B4, E5) of near-unison sine pairs. The pairs beat
    // slowly (~0.5 and ~0.9 Hz) so it wavers like a hum rather than pulsing; one shared pitch
    // wander keeps those beat rates steady, and a slow tremolo lets it breathe.
    const trem = this.#gain(0.8);
    this.droneLevel = this.#gain(0);
    chain(trem, this.#filter('lowpass', 1500), this.droneLevel, this.bus);
    this.droneLevel.connect(this.echo);
    const wander = this.#gain(4); // cents
    const wanderLfo = ctx.createOscillator();
    wanderLfo.frequency.value = 0.06;
    wanderLfo.connect(wander); wanderLfo.start();
    [[329.63, 0.5], [330.1, 0.2], [493.88, 0.14], [494.8, 0.06], [659.26, 0.05]].forEach(([f, lvl]) => {
      const o = ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = f;
      wander.connect(o.detune);
      chain(o, this.#gain(lvl), trem);
      o.start();
    });
    this.#lfo(0.19, 0.2, trem.gain);
  }

  setMuted(m) {
    this.muted = !!m;
    try { localStorage.setItem('farshore-mute', m ? '1' : '0'); } catch { /* private mode */ }
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.03);
  }

  suspend() {
    this.paused = true;
    if (this.ctx) settle(this.ctx.suspend());
  }

  resume() {
    this.paused = false;
    if (this.ctx) settle(this.ctx.resume());
  }

  // Per-frame: steer continuous layers and drive footsteps. Safe before start().
  update(dt, state) {
    if (!this.ctx || this.paused) return;
    const s = state || {};
    const dts = Number.isFinite(dt) ? Math.min(Math.max(dt, 0), 0.1) : 0;
    const sail = s.mode === 'sail';
    const speed = Number.isFinite(s.speed) ? Math.max(0, s.speed) : 0;
    const wading = clamp01(s.wading), cave = clamp01(s.cave), shore = clamp01(s.shore, 1), wind = clamp01(s.wind);

    this.steerClock += dts;
    if (this.steerClock >= STEER_EVERY) {
      this.steerClock = 0;
      const rush = sail ? Math.min(1, speed / 6) : 0;
      // In the cave the surf drops back to a soft, muffled wash so the singing rock carries.
      this.#steer(this.surfLevel.gain, (0.2 + 0.8 * shore) * (1 - 0.6 * cave), 0.5);
      this.#steer(this.surfLp.frequency, 700 - 250 * cave, 0.5);
      this.#steer(this.surfSweep.gain, 380 * (1 - 0.6 * cave), 0.5);
      this.#steer(this.windLevel.gain, wind * (sail ? 0.11 : 0.035) * (1 - cave));
      this.#steer(this.windBp.frequency, 450 + 650 * wind, 0.6);
      this.#steer(this.hullLevel.gain, 0.13 * rush ** 1.3);
      this.#steer(this.hullBp.frequency, 500 + 700 * rush);
      this.#steer(this.droneLevel.gain, 0.06 * cave ** 1.5, 0.8);
      this.#steer(this.echoSend.gain, 0.55 * cave, 0.3);
    }

    if (sail) { this.stepDist = 0; return; }
    if (speed < 0.15) return;
    this.stepDist += speed * dts;
    if (this.stepDist >= STEP_LEN) {
      this.stepDist %= STEP_LEN;
      this.step(wading > 0.15 ? 'wet' : cave > 0.4 ? 'rock' : 'sand', Math.min(1, 0.55 + speed / 8));
    }
  }

  // kind: 'sand' | 'wet' | 'rock'. vol (0..1) is optional.
  step(kind = 'sand', vol = 1) {
    if (!this.#live()) return;
    const t = this.#now(), v = Math.max(0.05, vol) * rand(0.8, 1.1);
    if (kind === 'wet') {
      this.#burst(t, 0.2, { gain: 0.07 * v, freq: rand(1300, 1700), to: 600, q: 0.8, attack: 0.012 });
      this.#burst(t + 0.03, 0.14, { gain: 0.05 * v, type: 'lowpass', freq: 700 });
    } else if (kind === 'rock') {
      // A light tap, not a knock: the cave echo repeats it, so keep the low body small.
      this.#burst(t, 0.045, { gain: 0.04 * v, freq: rand(1900, 2500), q: 2.5, attack: 0.002 });
      this.#note(rand(300, 360), t, 0.05, 0.016 * v, 'triangle', { to: 240, attack: 0.003 });
    } else {
      this.#burst(t, rand(0.07, 0.1), { gain: 0.055 * v, freq: rand(700, 1000), to: 450, q: 0.9, attack: 0.008 });
    }
  }

  chime() {
    if (!this.#live()) return;
    const t = this.#now();
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => { this.#note(f, t + i * 0.09, 0.9, 0.1, 'triangle'); this.#note(f * 2, t + i * 0.09, 0.5, 0.03); });
  }

  fanfare() {
    if (!this.#live()) return;
    const t = this.#now();
    [392, 523.25, 659.25, 783.99, 659.25, 1046.5].forEach((f, i) => this.#note(f, t + i * 0.14, 1.1, 0.11, 'triangle'));
  }

  tick() {
    if (!this.#live()) return;
    this.#note(880, this.#now(), 0.08, 0.05);
  }

  splash() {
    if (!this.#live()) return;
    this.#burst(this.#now(), 0.8, { gain: 0.12, freq: 1200, attack: 0.004 });
  }

  // Quick sine sparkle: faster, higher and lighter than chime().
  pickup() {
    if (!this.#live()) return;
    const t = this.#now();
    [783.99, 1046.5, 1318.5, 1568].forEach((f, i) => {
      this.#note(f, t + i * 0.05, 0.3 - i * 0.03, 0.06, 'sine', { attack: 0.004 });
      this.#note(f * 2.01, t + i * 0.05, 0.12, 0.012, 'sine', { attack: 0.004 });
    });
  }

  paper() {
    if (!this.#live()) return;
    const t = this.#now();
    this.#burst(t, 0.16, { gain: 0.045, freq: 1600, to: 3200, q: 0.7, attack: 0.03 });
    this.#burst(t + 0.09, 0.22, { gain: 0.035, freq: 2600, to: 1400, q: 0.6, attack: 0.04 });
  }

  pencil() {
    if (!this.#live()) return;
    const now = this.ctx.currentTime;
    if (now - this.lastPencil < 0.08) return;
    this.lastPencil = now;
    this.#burst(this.#now(), 0.035, { gain: 0.018, freq: rand(2200, 3000), q: 1.8, attack: 0.004 });
  }

  stamp() {
    if (!this.#live()) return;
    const t = this.#now();
    this.#note(240, t, 0.16, 0.16, 'sine', { to: 110, attack: 0.004 });
    this.#note(520, t, 0.07, 0.05, 'triangle', { to: 300, attack: 0.002 });
    this.#burst(t, 0.04, { gain: 0.05, type: 'lowpass', freq: 1800, attack: 0.002 });
  }

  // Wooden creak (band-passed sawtooth with a pitch bend) plus a hull thud.
  creak() {
    if (!this.#live()) return;
    const ctx = this.ctx, t = this.#now(), o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(rand(80, 95), t);
    o.frequency.linearRampToValueAtTime(rand(120, 140), t + 0.22);
    o.frequency.linearRampToValueAtTime(rand(95, 105), t + 0.42);
    this.#env(g.gain, t, 0.5, 0.22, 0.06);
    chain(o, this.#filter('bandpass', 850, 4), g, this.fx);
    o.start(t); o.stop(t + 0.55);
    this.#note(170, t + 0.05, 0.22, 0.15, 'sine', { to: 85 });
    this.#burst(t + 0.05, 0.18, { gain: 0.07, type: 'lowpass', freq: 500 });
  }

  // ~4.5 s humpback-like phrase: moan, rising "whup", lower answering moan.
  whaleSong() {
    if (!this.#live()) return;
    const t = this.#now();
    this.#moan(t, [[0, 210], [1.1, 320], [2.0, 190]], 0.08);
    this.#moan(t + 2.3, [[0, 150], [0.35, 420]], 0.07);
    this.#moan(t + 2.9, [[0, 280], [0.8, 250], [1.6, 175]], 0.06);
  }

  breach() {
    if (!this.#live()) return;
    const t = this.#now();
    this.#note(130, t, 1.4, 0.22, 'sine', { to: 50, attack: 0.03 });
    this.#note(190, t, 0.9, 0.08, 'triangle', { to: 80, attack: 0.03 });
    this.#burst(t, 2.4, { gain: 0.2, type: 'lowpass', freq: 1100, to: 220, attack: 0.05 });
    this.#burst(t + 0.25, 1.6, { gain: 0.05, freq: 1800, to: 900, q: 0.7, attack: 0.2 }); // falling spray
  }

  error() {
    if (!this.#live()) return;
    const t = this.#now();
    this.#note(587.33, t, 0.22, 0.07, 'triangle');
    this.#note(493.88, t + 0.15, 0.38, 0.07, 'triangle', { to: 466 });
  }

  // --- internals ---

  #live() { return !!this.ctx && !this.muted && !this.paused; }
  #now() { return this.ctx.currentTime + 0.01; }

  #gain(v) {
    const g = this.ctx.createGain();
    g.gain.value = v;
    return g;
  }

  #filter(type, freq, q = 0.7) {
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    return f;
  }

  // smooth > 0 gives one-pole low-passed ("brown") noise. That is correlated, so a plain
  // loop would jump at the wrap point; a band-limited step like that is heard as a thump
  // once filtered (it was the cave thump). Run the filter over the same white noise twice
  // and keep the second pass: its start then continues from its own end, so the loop is seamless.
  #noiseBuffer(seconds, smooth) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    if (!smooth) return buf;
    let b = 0;
    for (let i = 0; i < len; i++) b = b * smooth + d[i] * (1 - smooth);
    for (let i = 0; i < len; i++) { b = b * smooth + d[i] * (1 - smooth); d[i] = b * 6; }
    return buf;
  }

  #loop(buf, offset, ...nodes) {
    const src = this.ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    chain(src, ...nodes);
    src.start(0, offset);
  }

  // Returns the depth gain so callers can steer modulation depth.
  #lfo(freq, depth, param) {
    const o = this.ctx.createOscillator(), g = this.#gain(depth);
    o.frequency.value = freq;
    o.connect(g); g.connect(param);
    o.start();
    return g;
  }

  #steer(param, v, tc = 0.25) {
    const last = this.targets.get(param);
    if (last !== undefined && Math.abs(last - v) <= 1e-3 * Math.max(1, Math.abs(v))) return;
    this.targets.set(param, v);
    param.setTargetAtTime(v, this.ctx.currentTime, tc);
  }

  #env(p, at, dur, peak, attack) {
    p.setValueAtTime(0, at);
    p.linearRampToValueAtTime(peak, at + attack);
    p.exponentialRampToValueAtTime(0.0001, at + dur);
  }

  #note(freq, at, dur, gain = 0.12, type = 'sine', o = {}) {
    const osc = this.ctx.createOscillator(), g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, at + dur);
    this.#env(g.gain, at, dur, gain, o.attack ?? 0.015);
    chain(osc, g, this.fx);
    osc.start(at); osc.stop(at + dur + 0.05);
  }

  #burst(at, dur, { gain, type = 'bandpass', freq, to, q = 1, attack = 0.005 }) {
    const src = this.ctx.createBufferSource(), f = this.#filter(type, freq, q), g = this.ctx.createGain();
    src.buffer = this.noise; src.loop = true;
    f.frequency.setValueAtTime(freq, at);
    if (to) f.frequency.exponentialRampToValueAtTime(to, at + dur);
    this.#env(g.gain, at, dur, gain, attack);
    chain(src, f, g, this.fx);
    src.start(at, Math.random() * this.noise.duration);
    src.stop(at + dur + 0.05);
  }

  #moan(at, pts, gain) {
    const ctx = this.ctx, dur = pts[pts.length - 1][0], end = at + dur + 0.4;
    const g = ctx.createGain(), lp = this.#filter('lowpass', 1400);
    const vib = ctx.createOscillator(), vibDepth = this.#gain(18); // cents
    vib.frequency.value = rand(4.5, 5.5);
    vib.connect(vibDepth);
    [['triangle', 1, 1], ['sine', 2, 0.35]].forEach(([type, mul, lvl]) => {
      const o = ctx.createOscillator();
      o.type = type;
      pts.forEach(([dt, f], i) => (i ? o.frequency.exponentialRampToValueAtTime(f * mul, at + dt) : o.frequency.setValueAtTime(f * mul, at)));
      vibDepth.connect(o.detune);
      chain(o, this.#gain(lvl), lp);
      o.start(at); o.stop(end);
    });
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(gain, at + dur * 0.3);
    g.gain.setValueAtTime(gain, at + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    chain(lp, g, this.fx);
    g.connect(this.whaleSend);
    vib.start(at); vib.stop(end);
  }
}
