// SPDX-FileCopyrightText: 2026 Thomas Steiner
// SPDX-License-Identifier: Apache-2.0

// A dubstep soundtrack synthesized live with Web Audio: 160 BPM with a
// half-time feel, C minor, a driven sub, screeching, bit-crushed wobble bass in
// the drops, and
// lush pads.
// The arrangement below drives both the sequencer and the visuals, so a kick on
// screen is the kick in your ears.

export const BPM = 160;
export const STEP = 60 / BPM / 4;
export const BAR = STEP * 16;
const BEAT_HZ = BPM / 60;

let startBar = 0;
export const PARTS = [
  ['intro', 'Six hundred forty-one', 8],
  ['engines', 'Engine triangle', 16],
  ['categories', 'Category tunnel', 16],
  ['tests', 'Interop skyline', 16],
  ['solo', 'Going solo', 8],
  ['footprint', 'Monoliths', 16],
  ['time', 'Time warp', 16],
  ['greets', 'Greetings', 16],
].map(([key, name, bars]) => {
  const part = { key, name, bars, startBar };
  startBar += bars;
  return part;
});

export const SONG_BARS = startBar;
export const SONG_END = SONG_BARS * BAR;
const OUTRO_BAR = SONG_BARS - 4;

export function partIndexAt(bar) {
  for (let i = PARTS.length - 1; i >= 0; i--) {
    if (bar >= PARTS[i].startBar) {
      return i;
    }
  }
  return 0;
}

// C minor: i, VI, III, VII, two bars each, voiced with sevenths and ninths
const CHORDS = [
  { root: 36, pad: [60, 63, 67, 70, 74], pluck: [72, 75, 79, 82, 86] },
  { root: 32, pad: [56, 60, 63, 67, 70], pluck: [68, 72, 75, 79, 82] },
  { root: 39, pad: [55, 58, 62, 63, 65], pluck: [70, 74, 75, 79, 82] },
  { root: 34, pad: [58, 60, 62, 65, 69], pluck: [70, 72, 74, 77, 81] },
];

const chordAt = (bar) =>
  bar >= OUTRO_BAR ? CHORDS[0] : CHORDS[Math.floor(bar / 2) % 4];

// One two-bar phrase per chord: [step, midi note, length in steps]
const MELODY = [
  [
    [0, 79, 3],
    [3, 77, 3],
    [6, 75, 2],
    [8, 72, 4],
    [12, 75, 2],
    [14, 77, 2],
    [16, 79, 6],
    [24, 82, 4],
    [28, 79, 4],
  ],
  [
    [0, 80, 3],
    [3, 79, 3],
    [6, 75, 2],
    [8, 72, 4],
    [12, 75, 4],
    [16, 77, 6],
    [24, 75, 4],
    [28, 72, 4],
  ],
  [
    [0, 82, 3],
    [3, 79, 3],
    [6, 75, 2],
    [8, 79, 4],
    [12, 82, 4],
    [16, 87, 6],
    [24, 86, 4],
    [28, 82, 4],
  ],
  [
    [0, 77, 3],
    [3, 74, 3],
    [6, 70, 2],
    [8, 74, 4],
    [12, 77, 4],
    [16, 79, 8],
    [24, 77, 4],
    [28, 74, 4],
  ],
];

// Wobble bass phrases, one per bar of a four-bar cycle:
// [start step, length in steps, wobbles per beat, semitones above the root]
const WOBBLES = [
  [
    [0, 4, 4, 0],
    [4, 2, 8, 12],
    [6, 2, 6, 7],
    [10, 6, 4, 0],
  ],
  [
    [0, 6, 8, 0],
    [6, 2, 4, 12],
    [10, 3, 6, 3],
    [13, 3, 12, 0],
  ],
  [
    [0, 4, 4, 0],
    [4, 4, 8, 7],
    [10, 4, 6, 10],
    [14, 2, 16, 12],
  ],
  [
    [0, 3, 8, 0],
    [3, 3, 8, 3],
    [6, 2, 12, 12],
    [10, 4, 4, 0],
    [14, 2, 16, 12],
  ],
];

// The second half of the engine triangle builds with a slow, opening sweep
const BUILD = [[0, 16, 0.5, 0]];

const PLUCK_ORDER = [0, 2, 1, 3, 2, 4, 1, 3];

const DROPS = ['categories', 'tests', 'footprint', 'time', 'greets'];

function where(bar) {
  const part = PARTS[partIndexAt(bar)];
  const local = bar - part.startBar;
  return {
    key: part.key,
    local,
    last: local === part.bars - 1,
    drop: DROPS.includes(part.key) && bar < OUTRO_BAR,
  };
}

export const isDrop = (bar) => bar >= 0 && bar < SONG_BARS && where(bar).drop;

function wobblesAt(bar) {
  if (bar < 0 || bar >= SONG_BARS) {
    return [];
  }
  const { key, local, drop } = where(bar);
  if (drop) {
    return WOBBLES[bar % 4];
  }
  return key === 'engines' && local >= 8 ? BUILD : [];
}

// The velocity (0 for silence) of a percussive hit
export function hit(instrument, bar, step) {
  if (bar < 0 || bar >= SONG_BARS) {
    return 0;
  }
  const { key, local, last, drop } = where(bar);
  const quiet = key === 'intro' || key === 'solo' || bar >= OUTRO_BAR;
  switch (instrument) {
    case 'kick':
      if (quiet) {
        return 0;
      }
      if (step === 0) {
        return 1;
      }
      if (step === 10) {
        return 0.9;
      }
      if (!drop) {
        return 0;
      }
      if (bar % 2 === 1 && (step === 3 || step === 6)) {
        return step === 3 ? 0.6 : 0.8;
      }
      return bar % 4 === 3 && step === 14 ? 0.75 : 0;
    case 'snare':
      if (key === 'solo' && last) {
        return 0.25 + (step / 15) * 0.75;
      }
      if (quiet) {
        return 0;
      }
      if (step === 8) {
        return 1;
      }
      return last && step >= 12 ? 0.35 + ((step - 12) / 3) * 0.4 : 0;
    case 'hat':
      if (quiet) {
        return key === 'solo' && step % 4 === 2 ? 0.25 : 0;
      }
      if (hit('openhat', bar, step)) {
        return 0;
      }
      if (!drop) {
        return step % 2 === 0 ? (step % 4 === 2 ? 0.7 : 0.4) : 0;
      }
      return step % 4 === 2 ? 0.9 : step % 2 === 0 ? 0.5 : 0.35;
    case 'openhat':
      return drop && bar % 2 === 0 && step === 14 ? 0.6 : 0;
    case 'crash':
      if (step !== 0) {
        return 0;
      }
      if (local === 0 && key !== 'intro' && key !== 'solo') {
        return 1;
      }
      if (key === 'footprint' && local % 4 === 0) {
        return 0.7;
      }
      return bar === OUTRO_BAR ? 0.8 : 0;
    default:
      return 0;
  }
}

function leadAt(bar, step) {
  const { key } = where(bar);
  if (!['tests', 'time', 'greets'].includes(key) || bar >= OUTRO_BAR) {
    return null;
  }
  const phraseStep = (bar % 2) * 16 + step;
  const note = MELODY[Math.floor(bar / 2) % 4].find(
    ([at]) => at === phraseStep,
  );
  return note ? { midi: note[1], steps: note[2] } : null;
}

// The pad changes chord every two bars and holds the last chord for the outro
function padAt(bar) {
  if (bar >= OUTRO_BAR) {
    return { startBar: OUTRO_BAR, bars: 4, chord: CHORDS[0], tail: 4 };
  }
  return {
    startBar: bar - (bar % 2),
    bars: 2,
    chord: chordAt(bar),
    tail: 0.8,
  };
}

const hasSub = (bar) => {
  const { key } = where(bar);
  return key !== 'intro' && key !== 'solo' && bar < OUTRO_BAR;
};

function pluckAt(bar, step) {
  const { key, local } = where(bar);
  if (step % 2 || bar >= OUTRO_BAR) {
    return 0;
  }
  if (key === 'intro') {
    return local >= 4 ? 0.5 + (local - 4) * 0.12 : 0;
  }
  return key === 'engines' && local < 8 ? 0 : 1;
}

// Risers lead into the next part, longest before the drops
function riserAt(bar) {
  const { key, local, last } = where(bar);
  if ((key === 'intro' || key === 'solo') && local === 6) {
    return 2;
  }
  if (key === 'engines' && local === 14) {
    return 2;
  }
  return last && key !== 'greets' && key !== 'engines' ? 1 : 0;
}

const mtof = (midi) => 440 * 2 ** ((midi - 69) / 12);

// Seconds since the most recent hit of an instrument, and its velocity, so the
// visuals can draw envelopes that line up with the audio exactly
export function since(instrument, time) {
  let index = Math.floor(time / STEP);
  for (let back = 0; back < 64 && index >= 0; back++, index--) {
    const velocity = hit(instrument, Math.floor(index / 16), index % 16);
    if (velocity) {
      return { dt: time - index * STEP, velocity };
    }
  }
  return { dt: Infinity, velocity: 0 };
}

// How far the wobble filter is open (0 to 1) at a song position, and how fast it
// moves, computed from the same phrases the synth plays
export function wobbleAt(time) {
  const bar = Math.floor(time / BAR);
  const into = time - bar * BAR;
  for (const [start, length, perBeat] of wobblesAt(bar)) {
    const offset = into - start * STEP;
    if (offset >= 0 && offset < length * STEP) {
      const phase = offset * perBeat * BEAT_HZ;
      return {
        level: 0.5 + 0.5 * Math.sin(phase * Math.PI * 2),
        rate: perBeat,
      };
    }
  }
  return { level: 0, rate: 0 };
}

export class Music {
  constructor() {
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    this.ctx = ctx;
    this.playing = false;
    this.pausedAt = 0;
    this.origin = 0;
    this.nextStep = 0;
    this.session = null;

    this.volume = ctx.createGain();
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.knee.value = 6;
    compressor.ratio.value = 8;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.25;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.7;
    this.fft = new Uint8Array(this.analyser.frequencyBinCount);
    // A soft clipper squeezes the mix before the compressor for density
    const clipper = ctx.createWaveShaper();
    clipper.curve = this.driveCurve(1.6);
    clipper.oversample = '2x';
    this.master.connect(clipper).connect(compressor);
    compressor.connect(this.analyser);
    this.analyser.connect(this.volume).connect(ctx.destination);

    // Everything but the drums pumps against the kick through this bus
    this.duck = ctx.createGain();
    this.duck.connect(this.master);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(3.2);
    const reverbOut = ctx.createGain();
    reverbOut.gain.value = 0.35;
    this.reverb.connect(reverbOut).connect(this.master);

    this.delay = ctx.createDelay(2);
    this.delay.delayTime.value = STEP * 3;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.42;
    const damp = ctx.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 2800;
    this.delay.connect(damp).connect(feedback).connect(this.delay);
    const delayOut = ctx.createGain();
    delayOut.gain.value = 0.35;
    damp.connect(delayOut).connect(this.master);

    this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const noise = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < noise.length; i++) {
      noise[i] = Math.random() * 2 - 1;
    }
    this.crackleBuffer = this.crackle(6);
    this.drive = this.driveCurve(10);
    this.warm = this.driveCurve(2.2);
    this.punch = this.driveCurve(3.5);
    this.crush = this.crushCurve(10);

    setInterval(() => this.tick(), 25);
  }

  impulse(seconds) {
    const { ctx } = this;
    const length = ctx.sampleRate * seconds;
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3.5;
      }
    }
    return buffer;
  }

  // Vinyl hiss with sparse dust pops
  crackle(seconds) {
    const { ctx } = this;
    const length = ctx.sampleRate * seconds;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let hiss = 0;
    for (let i = 0; i < length; i++) {
      hiss = hiss * 0.92 + (Math.random() * 2 - 1) * 0.08;
      data[i] = hiss * 0.3;
      if (Math.random() < 0.0004) {
        const pop = (Math.random() * 2 - 1) * 0.9;
        for (let k = 0; k < 40 && i + k < length; k++) {
          data[i + k] += pop * Math.exp(-k / 6);
        }
      }
    }
    return buffer;
  }

  // Quantizes the waveform to a few levels, like a cheap sampler
  crushCurve(levels) {
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.round(x * levels) / levels;
    }
    return curve;
  }

  driveCurve(amount) {
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
    }
    return curve;
  }

  // Every voice of one play session goes through its own gains, so seeking can
  // silence what the previous session already scheduled
  newSession() {
    const { ctx } = this;
    const now = ctx.currentTime;
    if (this.session) {
      const old = this.session;
      for (const node of Object.values(old)) {
        node.gain?.setTargetAtTime(0, now, 0.02);
      }
      old.crackle?.stop(now + 0.1);
      setTimeout(() => {
        for (const node of Object.values(old)) {
          node.disconnect();
        }
      }, 400);
    }
    const make = (destination) => {
      const node = ctx.createGain();
      node.connect(destination);
      return node;
    };
    this.session = {
      dry: make(this.master),
      duck: make(this.duck),
      reverb: make(this.reverb),
      delay: make(this.delay),
    };
    this.duck.gain.cancelScheduledValues(now);
    this.duck.gain.setValueAtTime(1, now);
  }

  startCrackle(at) {
    const { ctx } = this;
    const source = ctx.createBufferSource();
    source.buffer = this.crackleBuffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2500;
    filter.Q.value = 0.4;
    const amp = ctx.createGain();
    amp.gain.value = 0.09;
    source.connect(filter).connect(amp).connect(this.session.dry);
    source.start(at);
    this.session.crackle = source;
  }

  // The song position of the sample playing out of the speakers right now
  get time() {
    if (!this.playing) {
      return this.pausedAt;
    }
    const { ctx } = this;
    let heard = ctx.currentTime - (ctx.baseLatency || 0);
    const stamp = ctx.getOutputTimestamp?.();
    const age = performance.now() - (stamp?.performanceTime ?? 0);
    if (stamp?.contextTime > 0 && age < 250) {
      heard = stamp.contextTime + age / 1000;
    }
    return Math.min(SONG_END, Math.max(0, heard - this.origin));
  }

  get ended() {
    return this.playing && this.time >= SONG_END;
  }

  async play(from = this.pausedAt) {
    if (this.ctx.state !== 'running') {
      await this.ctx.resume();
    }
    this.newSession();
    const now = this.ctx.currentTime + 0.05;
    this.origin = now - from;
    this.nextStep = Math.ceil(from / STEP - 1e-6);
    this.playing = true;
    this.startCrackle(now);
    // Bring in the chord and sub that were already sounding where playback starts
    const bar = Math.floor(from / BAR);
    if (bar < SONG_BARS) {
      const pad = padAt(bar);
      const end = (pad.startBar + pad.bars) * BAR;
      const midChord = from - pad.startBar * BAR > STEP / 2;
      if (midChord && end - from > 0.3) {
        this.pad(now, pad.chord.pad, end - from, pad.tail);
        if (hasSub(bar)) {
          this.sub(now, pad.chord.root, end - from);
        }
      }
    }
  }

  pause() {
    if (!this.playing) {
      return;
    }
    this.pausedAt = this.time;
    this.playing = false;
    this.newSession();
  }

  seek(to) {
    const clamped = Math.min(SONG_END - 0.01, Math.max(0, to));
    if (this.playing) {
      this.play(clamped);
    } else {
      this.pausedAt = clamped;
    }
  }

  set muted(value) {
    this.volume.gain.setTargetAtTime(value ? 0 : 1, this.ctx.currentTime, 0.02);
  }

  // Makes room for a voice
  set speaking(value) {
    this.master.gain.setTargetAtTime(
      value ? 0.5 : 0.8,
      this.ctx.currentTime,
      0.08,
    );
  }

  readFft() {
    this.analyser.getByteFrequencyData(this.fft);
    return this.fft;
  }

  tick() {
    if (!this.playing) {
      return;
    }
    const horizon = this.ctx.currentTime + 0.15;
    while (
      this.nextStep < SONG_BARS * 16 &&
      this.origin + this.nextStep * STEP < horizon
    ) {
      this.scheduleStep(this.nextStep, this.origin + this.nextStep * STEP);
      this.nextStep++;
    }
  }

  scheduleStep(index, t) {
    const bar = Math.floor(index / 16);
    const step = index % 16;
    const { drop } = where(bar);
    // Swing the off-sixteenths for a lazier groove
    const swung = step % 2 ? t + STEP * 0.14 : t;

    const kick = hit('kick', bar, step);
    if (kick) {
      this.kick(t, kick);
    }
    const snare = hit('snare', bar, step);
    if (snare) {
      this.snare(t, snare);
    }
    const hat = hit('hat', bar, step);
    if (hat) {
      this.hat(swung, hat, false);
    }
    const openhat = hit('openhat', bar, step);
    if (openhat) {
      this.hat(swung, openhat, true);
    }
    const crash = hit('crash', bar, step);
    if (crash) {
      this.crash(t, crash);
      if (drop || where(bar).key === 'engines') {
        this.boom(t);
      }
    }
    const chord = chordAt(bar);
    const pluck = pluckAt(bar, step);
    if (pluck) {
      const order = PLUCK_ORDER[(step >> 1) % PLUCK_ORDER.length];
      this.pluck(t, chord.pluck[order], pluck);
    }
    const lead = leadAt(bar, step);
    if (lead) {
      this.lead(t, lead.midi, lead.steps * STEP);
    }
    for (const [start, length, rate, offset] of wobblesAt(bar)) {
      if (start === step) {
        this.wobble(t, chord.root + 12 + offset, length * STEP, rate);
      }
    }
    if (step === 0) {
      const pad = padAt(bar);
      if (pad.startBar === bar) {
        this.pad(t, pad.chord.pad, pad.bars * BAR, pad.tail);
        if (hasSub(bar)) {
          this.sub(t, pad.chord.root, pad.bars * BAR);
        }
      }
      const riser = riserAt(bar);
      if (riser) {
        this.riser(t, riser * BAR);
      }
    }
  }

  envelope(param, t, peak, attack, decay) {
    param.setValueAtTime(0.0001, t);
    param.exponentialRampToValueAtTime(peak, t + attack);
    param.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  send(node, destination, amount) {
    const gain = this.ctx.createGain();
    gain.gain.value = amount;
    node.connect(gain).connect(destination);
  }

  noise(
    t,
    { type, frequency, q = 1, gain, attack = 0.001, decay, out, reverb = 0 },
  ) {
    const { ctx } = this;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const amp = ctx.createGain();
    this.envelope(amp.gain, t, gain, attack, decay);
    source.connect(filter).connect(amp).connect(out);
    if (reverb) {
      this.send(amp, this.session.reverb, reverb);
    }
    source.start(t, Math.random() * 1.5);
    source.stop(t + attack + decay + 0.05);
  }

  kick(t, velocity) {
    const { ctx } = this;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(190, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.09);
    const amp = ctx.createGain();
    this.envelope(amp.gain, t, 1.3 * velocity, 0.002, 0.42);
    const shaper = ctx.createWaveShaper();
    shaper.curve = this.punch;
    osc.connect(amp).connect(shaper).connect(this.session.dry);
    osc.start(t);
    osc.stop(t + 0.5);
    this.noise(t, {
      type: 'highpass',
      frequency: 3000,
      gain: 0.3 * velocity,
      decay: 0.012,
      out: this.session.dry,
    });
    this.duck.gain.setValueAtTime(0.12, t);
    this.duck.gain.linearRampToValueAtTime(1, t + 0.26);
  }

  // A fat half-time snare: noise, a crack, a tonal body, and a clap
  snare(t, velocity) {
    const { ctx } = this;
    this.noise(t, {
      type: 'bandpass',
      frequency: 1800,
      q: 0.7,
      gain: 0.85 * velocity,
      decay: 0.22,
      out: this.session.dry,
      reverb: 0.55,
    });
    this.noise(t, {
      type: 'highpass',
      frequency: 4500,
      gain: 0.5 * velocity,
      decay: 0.05,
      out: this.session.dry,
    });
    for (const offset of [0, 0.011, 0.023]) {
      this.noise(t + offset, {
        type: 'bandpass',
        frequency: 1100,
        q: 1.2,
        gain: 0.3 * velocity,
        decay: 0.05,
        out: this.session.dry,
        reverb: 0.5,
      });
    }
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, t);
    osc.frequency.exponentialRampToValueAtTime(160, t + 0.08);
    const amp = ctx.createGain();
    this.envelope(amp.gain, t, 0.6 * velocity, 0.002, 0.12);
    const shaper = ctx.createWaveShaper();
    shaper.curve = this.punch;
    osc.connect(amp).connect(shaper).connect(this.session.dry);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  hat(t, velocity, open) {
    this.noise(t, {
      type: 'highpass',
      frequency: 8000,
      gain: (open ? 0.14 : 0.16) * velocity,
      decay: open ? 0.3 : 0.03,
      out: this.session.dry,
      reverb: 0.15,
    });
  }

  crash(t, velocity) {
    this.noise(t, {
      type: 'highpass',
      frequency: 4500,
      gain: 0.18 * velocity,
      decay: 2.2,
      out: this.session.dry,
      reverb: 0.7,
    });
  }

  // The low impact that lands a drop
  boom(t) {
    const { ctx } = this;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 1.2);
    const amp = ctx.createGain();
    this.envelope(amp.gain, t, 0.6, 0.005, 1.4);
    osc.connect(amp).connect(this.session.dry);
    this.send(amp, this.session.reverb, 0.3);
    osc.start(t);
    osc.stop(t + 1.5);
  }

  riser(t, duration) {
    const { ctx } = this;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 3;
    filter.frequency.setValueAtTime(250, t);
    filter.frequency.exponentialRampToValueAtTime(8000, t + duration);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(0.22, t + duration);
    amp.gain.linearRampToValueAtTime(0, t + duration + 0.02);
    source.connect(filter).connect(amp).connect(this.session.dry);
    this.send(amp, this.session.reverb, 0.6);
    source.start(t);
    source.stop(t + duration + 0.05);
  }

  sub(t, midi, duration) {
    const { ctx } = this;
    const osc = ctx.createOscillator();
    osc.frequency.value = mtof(midi);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(0.75, t + 0.03);
    amp.gain.setValueAtTime(0.75, t + duration - 0.05);
    amp.gain.linearRampToValueAtTime(0, t + duration);
    // Saturation adds harmonics that laptop speakers can reproduce
    const shaper = ctx.createWaveShaper();
    shaper.curve = this.warm;
    const level = ctx.createGain();
    level.gain.value = 0.7;
    osc.connect(amp).connect(shaper).connect(level).connect(this.session.duck);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  // Detuned saws through two drive stages into a resonant lowpass and a
  // vowel-like bandpass, plus bit-crushed grit and a screech an octave up, all
  // swept by an LFO locked to the beat
  wobble(t, midi, duration, perBeat) {
    const { ctx } = this;
    const frequency = mtof(midi);
    const mix = ctx.createGain();
    mix.gain.value = 0.45;
    for (const [type, detune, ratio] of [
      ['sawtooth', -16, 1],
      ['sawtooth', 16, 1],
      ['square', 0, 0.5],
      ['sawtooth', 7, 2],
    ]) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = frequency * ratio;
      osc.detune.value = detune;
      osc.connect(mix);
      osc.start(t);
      osc.stop(t + duration + 0.05);
    }
    const shaper = ctx.createWaveShaper();
    shaper.curve = this.drive;
    shaper.oversample = '2x';
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = perBeat * BEAT_HZ;
    lfo.start(t);
    lfo.stop(t + duration + 0.05);
    const sweep = (type, center, range, q) => {
      const filter = ctx.createBiquadFilter();
      filter.type = type;
      filter.Q.value = q;
      filter.frequency.value = center;
      const depth = ctx.createGain();
      depth.gain.value = range;
      lfo.connect(depth).connect(filter.frequency);
      return filter;
    };
    const lowpass = sweep('lowpass', 1700, 1550, 14);
    const vowel = sweep('bandpass', 1000, 700, 5);
    const screech = sweep('bandpass', 2600, 2000, 9);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(0.28, t + 0.006);
    amp.gain.setValueAtTime(0.28, t + duration - 0.025);
    amp.gain.linearRampToValueAtTime(0, t + duration);
    mix.connect(shaper);
    // The second drive stage grinds what the filters leave
    const grind = ctx.createWaveShaper();
    grind.curve = this.warm;
    shaper.connect(lowpass).connect(grind).connect(amp);
    const layer = (node, level) => {
      const gain = ctx.createGain();
      gain.gain.value = level;
      node.connect(gain).connect(amp);
    };
    layer(shaper.connect(vowel), 0.6);
    layer(shaper.connect(screech), perBeat >= 6 ? 0.45 : 0.25);
    const crusher = ctx.createWaveShaper();
    crusher.curve = this.crush;
    layer(lowpass.connect(crusher), 0.25);
    amp.connect(this.session.duck);
    this.send(amp, this.session.reverb, 0.08);
  }

  pad(t, notes, duration, tail) {
    const { ctx } = this;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0.8;
    filter.frequency.setValueAtTime(700, t);
    filter.frequency.linearRampToValueAtTime(1500, t + duration * 0.6);
    filter.frequency.linearRampToValueAtTime(900, t + duration + tail);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(0.045, t + 0.6);
    amp.gain.setValueAtTime(0.045, t + duration);
    amp.gain.linearRampToValueAtTime(0, t + duration + tail);
    filter.connect(amp).connect(this.session.duck);
    this.send(amp, this.session.reverb, 0.8);
    for (const midi of notes) {
      for (const detune of [-11, 0, 11]) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = mtof(midi);
        osc.detune.value = detune;
        osc.connect(filter);
        osc.start(t);
        osc.stop(t + duration + tail + 0.05);
      }
    }
  }

  // A soft, glassy pluck that lives mostly in the delay
  pluck(t, midi, velocity) {
    const { ctx } = this;
    const amp = ctx.createGain();
    this.envelope(amp.gain, t, 0.07 * velocity, 0.003, 0.35);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(4000, t);
    filter.frequency.exponentialRampToValueAtTime(700, t + 0.3);
    filter.connect(amp).connect(this.session.duck);
    this.send(amp, this.session.delay, 0.7);
    this.send(amp, this.session.reverb, 0.3);
    for (const [type, ratio] of [
      ['triangle', 1],
      ['sine', 2],
    ]) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = mtof(midi) * ratio;
      osc.connect(filter);
      osc.start(t);
      osc.stop(t + 0.45);
    }
  }

  lead(t, midi, duration) {
    const { ctx } = this;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2400;
    filter.Q.value = 1.5;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(0.075, t + 0.04);
    amp.gain.setValueAtTime(0.075, t + duration * 0.85);
    amp.gain.linearRampToValueAtTime(0, t + duration + 0.2);
    filter.connect(amp).connect(this.session.duck);
    this.send(amp, this.session.delay, 0.45);
    this.send(amp, this.session.reverb, 0.5);
    const vibrato = ctx.createOscillator();
    vibrato.frequency.value = 5;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(14, t + duration);
    vibrato.connect(depth);
    for (const [type, detune] of [
      ['sawtooth', -6],
      ['triangle', 6],
    ]) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(mtof(midi - 1), t);
      osc.frequency.exponentialRampToValueAtTime(mtof(midi), t + 0.05);
      osc.detune.value = detune;
      depth.connect(osc.detune);
      osc.connect(filter);
      osc.start(t);
      osc.stop(t + duration + 0.25);
    }
    vibrato.start(t);
    vibrato.stop(t + duration + 0.25);
  }
}
