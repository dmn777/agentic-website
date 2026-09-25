// Darkfield's sound (GAME_DESIGN.md §Sound): WebAudio synthesis, no audio files. Muted by
// default. The AudioContext is created on the first unmute, which is always a user gesture
// (a click or the M key), as browsers require. Every sound is a few oscillators or a noise
// burst through a filter, shaped by a gain envelope.

export interface Sound {
  readonly muted: boolean;
  /** Call from a user gesture: unmuting creates or resumes the context. */
  setMuted(m: boolean): void;
  /** A capture: a pentatonic run that climbs with the number caught. */
  chime(n: number): void;
  /** The line snapping on a contaminant. */
  snap(): void;
  /** Low-ink tick. */
  tick(): void;
  /** The run ending: a falling tone. */
  over(): void;
  /** The pen's quiet scratch while it draws. */
  scratch(on: boolean): void;
  dispose(): void;
}

// C major pentatonic from C5 up: a capture of n plays the first n notes (at most eight).
const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51];

export function createSound(): Sound {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let scratchGain: GainNode | null = null;
  let scratchOn = false;
  let muted = true;

  function ensure(): AudioContext | null {
    if (ctx) return ctx;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.45;
    master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    // The scratch runs for as long as the page does; its gain opens while the pen draws.
    const src = ctx.createBufferSource();
    src.buffer = noise; src.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass'; band.frequency.value = 3200; band.Q.value = 0.8;
    scratchGain = ctx.createGain();
    scratchGain.gain.value = 0;
    src.connect(band).connect(scratchGain).connect(master);
    src.start();
    return ctx;
  }
  const live = () => (!muted && ctx && master ? ctx : null);

  function env(c: AudioContext, at: number, peak: number, attack: number, decay: number): GainNode {
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
    g.connect(master!);
    return g;
  }
  function tone(c: AudioContext, type: OscillatorType, f: number, at: number, peak: number, decay: number, fEnd?: number) {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, at);
    if (fEnd) o.frequency.exponentialRampToValueAtTime(fEnd, at + decay);
    o.connect(env(c, at, peak, 0.008, decay));
    o.start(at); o.stop(at + decay + 0.05);
  }
  function burst(c: AudioContext, at: number, freq: number, q: number, peak: number, decay: number) {
    const s = c.createBufferSource();
    s.buffer = noise;
    const f = c.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    s.connect(f).connect(env(c, at, peak, 0.004, decay));
    s.start(at, Math.random() * 0.5); s.stop(at + decay + 0.05);
  }
  function setScratch() {
    if (!ctx || !scratchGain) return;
    scratchGain.gain.setTargetAtTime(scratchOn && !muted ? 0.035 : 0, ctx.currentTime, 0.05);
  }

  return {
    get muted() { return muted; },
    setMuted(m) {
      muted = m;
      if (!m) { const c = ensure(); if (c && c.state === 'suspended') void c.resume(); }
      setScratch();
    },
    chime(n) {
      const c = live(); if (!c || n <= 0) return;
      const t = c.currentTime;
      const k = Math.min(n, PENTA.length);
      for (let i = 0; i < k; i++) {
        tone(c, 'sine', PENTA[i], t + i * 0.055, 0.22, 0.5);
        tone(c, 'triangle', PENTA[i] * 2, t + i * 0.055, 0.05, 0.25);
      }
    },
    snap() {
      const c = live(); if (!c) return;
      burst(c, c.currentTime, 1800, 1.2, 0.5, 0.14);
      burst(c, c.currentTime + 0.03, 700, 2, 0.3, 0.1);
    },
    tick() {
      const c = live(); if (!c) return;
      tone(c, 'square', 1500, c.currentTime, 0.06, 0.03);
    },
    over() {
      const c = live(); if (!c) return;
      const o = c.createOscillator(), lp = c.createBiquadFilter();
      o.type = 'sawtooth'; lp.type = 'lowpass'; lp.frequency.value = 1200;
      const t = c.currentTime;
      o.frequency.setValueAtTime(440, t);
      o.frequency.exponentialRampToValueAtTime(92, t + 0.9);
      o.connect(lp).connect(env(c, t, 0.2, 0.01, 0.9));
      o.start(t); o.stop(t + 1);
    },
    scratch(on) { if (on !== scratchOn) { scratchOn = on; setScratch(); } },
    dispose() { void ctx?.close(); ctx = null; },
  };
}
