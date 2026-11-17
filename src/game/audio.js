// Tiny synthesised soundscape: surf, a discovery chime and soft UI ticks. No audio files.
export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('farshore-mute') === '1';
  }

  // Must be called from a user gesture (iOS unlocks audio only then).
  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(ctx.destination);

    // Surf: looped noise through a low-pass that breathes like swell.
    const len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) { b = b * 0.97 + (Math.random() * 2 - 1) * 0.03; d[i] = b * 6; }
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 700;
    const surf = ctx.createGain();
    surf.gain.value = 0.16;
    const lfo = ctx.createOscillator(), lfoGain = ctx.createGain();
    lfo.frequency.value = 0.13; lfoGain.gain.value = 0.09;
    lfo.connect(lfoGain).connect(surf.gain);
    const lfo2 = ctx.createOscillator(), lfo2Gain = ctx.createGain();
    lfo2.frequency.value = 0.13; lfo2Gain.gain.value = 380;
    lfo2.connect(lfo2Gain).connect(lp.frequency);
    src.connect(lp).connect(surf).connect(this.master);
    src.start(); lfo.start(); lfo2.start();
  }

  setMuted(m) {
    this.muted = m;
    localStorage.setItem('farshore-mute', m ? '1' : '0');
    if (this.master) this.master.gain.value = m ? 0 : 1;
  }

  #note(freq, at, dur, gain = 0.12, type = 'sine') {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(gain, at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(this.master);
    o.start(at); o.stop(at + dur + 0.05);
  }

  chime() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => { this.#note(f, t + i * 0.09, 0.9, 0.1, 'triangle'); this.#note(f * 2, t + i * 0.09, 0.5, 0.03); });
  }

  fanfare() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [392, 523.25, 659.25, 783.99, 659.25, 1046.5].forEach((f, i) => this.#note(f, t + i * 0.14, 1.1, 0.11, 'triangle'));
  }

  tick() {
    if (!this.ctx) return;
    this.#note(880, this.ctx.currentTime, 0.08, 0.05);
  }

  splash() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime, len = ctx.sampleRate * 0.5;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = buf; f.type = 'bandpass'; f.frequency.value = 1200; g.gain.value = 0.12;
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }
}
