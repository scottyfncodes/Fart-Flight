import { rand, choose, clamp } from "./utils.js";
import { storage } from "./storage.js";

let ctx = null;
let masterGain = null;
let windGain = null;
let windSource = null;
let noiseBuffer = null;
let unlocked = false;
let htmlUnlocked = false;
let muted = storage.getMuted();

// A ~0-length silent WAV. iOS Safari's audio-session handling treats a
// played HTMLMediaElement differently from a raw Web Audio oscillator, and
// some iOS versions only fully commit to allowing Web Audio playback after
// an <audio>/<video> element has also been played from a real user gesture.
// This is a standard belt-and-suspenders unlock alongside the AudioContext
// one below.
const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

function unlockHtmlAudio() {
  if (htmlUnlocked) return;
  htmlUnlocked = true;
  try {
    const el = new Audio(SILENT_WAV);
    el.volume = 0.01;
    el.playsInline = true;
    const p = el.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch (e) {
    /* ignore */
  }
}

function ensureContext() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : 1;
    masterGain.connect(ctx.destination);
    noiseBuffer = buildNoiseBuffer(ctx);
  } catch (e) {
    ctx = null;
  }
  return ctx;
}

function buildNoiseBuffer(c) {
  const len = c.sampleRate * 2;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export function initAudio() {
  unlockHtmlAudio();
  const c = ensureContext();
  if (!c) return;
  if (c.state === "suspended") {
    c.resume().catch(() => {});
  }
  // Some mobile browsers keep an AudioContext silent until a real sound is
  // started synchronously inside the same user-gesture call stack that
  // created/resumed it. A near-silent blip here fully commits the context.
  if (!unlocked) {
    unlocked = true;
    try {
      const osc = c.createOscillator();
      const g = c.createGain();
      g.gain.value = 0.0001;
      osc.connect(g);
      g.connect(masterGain);
      osc.start(c.currentTime);
      osc.stop(c.currentTime + 0.05);
    } catch (e) {
      /* ignore */
    }
  }
}

export function setMuted(m) {
  muted = m;
  storage.setMuted(m);
  if (masterGain) {
    masterGain.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.05);
  }
}

export function isMuted() {
  return muted;
}

function noiseSource(c) {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  src.loopEnd = noiseBuffer.duration;
  return src;
}

function envGain(c, attack, decay, peak, startAt) {
  const g = c.createGain();
  const t0 = startAt;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  return g;
}

const FART_PRESETS = {
  tiny: { startFreq: [520, 620], endFreq: [340, 420], duration: [0.08, 0.12], buzz: [55, 70], gain: 0.22, filter: 1600 },
  short: { startFreq: [300, 360], endFreq: [150, 200], duration: [0.16, 0.22], buzz: [45, 60], gain: 0.32, filter: 1200 },
  deep: { startFreq: [140, 170], endFreq: [65, 85], duration: [0.34, 0.46], buzz: [32, 42], gain: 0.42, filter: 850 },
  blast: { startFreq: [110, 130], endFreq: [45, 60], duration: [0.62, 0.85], buzz: [24, 34], gain: 0.5, filter: 700 },
};

function categoryForIntensity(intensity) {
  if (intensity < 0.45) return "tiny";
  if (intensity < 0.7) return "short";
  if (intensity < 0.95) return "deep";
  return "blast";
}

export function playFart(intensity = 1) {
  const c = ensureContext();
  if (!c) return;
  const cat = categoryForIntensity(clamp(intensity, 0, 1.4));
  const p = FART_PRESETS[cat];
  const t0 = c.currentTime;
  const dur = rand(p.duration[0], p.duration[1]);
  // a wide overall pitch multiplier on top of the preset's own range, so
  // farts land noticeably sharp or flat instead of always landing neatly
  // inside their category's "normal" band
  const pitchMult = rand(0.76, 1.32);
  const startFreq = rand(p.startFreq[0], p.startFreq[1]) * pitchMult;
  const endFreq = rand(p.endFreq[0], p.endFreq[1]) * pitchMult;
  // the buzz gets its own independent detune so it sometimes clashes
  // against the main tone instead of always sitting in a clean interval
  const buzzFreq = rand(p.buzz[0], p.buzz[1]) * rand(0.7, 1.45);
  // buzz starts slightly early or late relative to the main tone — a
  // ragged, off-time attack instead of both voices firing in lockstep
  const buzzOffset = rand(-0.02, 0.025);

  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(p.filter, t0);
  filter.frequency.exponentialRampToValueAtTime(Math.max(200, p.filter * 0.4), t0 + dur);
  filter.connect(masterGain);

  const master = envGain(c, 0.012, dur, p.gain * rand(0.85, 1.1), t0);
  master.connect(filter);

  const osc = c.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(startFreq, t0);
  // roughly a third of farts wobble mid-note instead of sliding cleanly
  // from start pitch to end pitch, like the pitch caught a hiccup
  if (Math.random() < 0.35) {
    const wobbleT = t0 + dur * rand(0.3, 0.6);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, startFreq * rand(1.15, 1.4)), wobbleT);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + dur);
  } else {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + dur);
  }
  osc.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);

  const buzz = c.createOscillator();
  buzz.type = "square";
  buzz.frequency.setValueAtTime(buzzFreq, t0 + buzzOffset);
  const buzzGain = c.createGain();
  buzzGain.gain.value = p.gain * 0.35;
  buzz.connect(buzzGain);
  buzzGain.connect(master);
  buzz.start(t0 + buzzOffset);
  buzz.stop(t0 + dur + 0.02);

  const noise = noiseSource(c);
  const noiseFilter = c.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.value = p.filter * 0.6;
  noiseFilter.Q.value = 0.7;
  const noiseGain = envGain(c, 0.008, dur * 0.6, p.gain * 0.28, t0);
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(filter);
  noise.start(t0);
  noise.stop(t0 + dur * 0.6 + 0.02);
}

export function startWind() {
  const c = ensureContext();
  if (!c || windSource) return;
  windSource = noiseSource(c);
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 500;
  filter.Q.value = 0.5;
  windGain = c.createGain();
  windGain.gain.value = 0;
  windSource.connect(filter);
  filter.connect(windGain);
  windGain.connect(masterGain);
  windSource.start();
  windGain.gain.setTargetAtTime(0.045, c.currentTime, 0.6);
}

export function setWindIntensity(t) {
  if (!windGain || !ctx) return;
  const g = 0.03 + clamp(t, 0, 1) * 0.05;
  windGain.gain.setTargetAtTime(g, ctx.currentTime, 0.3);
}

export function stopWind() {
  if (!windGain || !ctx) return;
  windGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
  const src = windSource;
  windSource = null;
  setTimeout(() => {
    try { src.stop(); } catch (e) {}
  }, 400);
}

export function playImpact() {
  const c = ensureContext();
  if (!c) return;
  const t0 = c.currentTime;

  const thud = c.createOscillator();
  thud.type = "sine";
  thud.frequency.setValueAtTime(140, t0);
  thud.frequency.exponentialRampToValueAtTime(38, t0 + 0.25);
  const thudGain = envGain(c, 0.006, 0.28, 0.55, t0);
  thud.connect(thudGain);
  thudGain.connect(masterGain);
  thud.start(t0);
  thud.stop(t0 + 0.3);

  const noise = noiseSource(c);
  const nf = c.createBiquadFilter();
  nf.type = "lowpass";
  nf.frequency.value = 1800;
  const ng = envGain(c, 0.004, 0.18, 0.5, t0);
  noise.connect(nf);
  nf.connect(ng);
  ng.connect(masterGain);
  noise.start(t0);
  noise.stop(t0 + 0.2);
}

function blip(c, t0, freq, dur, type, gain) {
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  const g = envGain(c, 0.008, dur, gain, t0);
  osc.connect(g);
  g.connect(masterGain);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export function playGradeUp() {
  const c = ensureContext();
  if (!c) return;
  const t0 = c.currentTime;
  const notes = [523.25, 659.25, 783.99];
  notes.forEach((f, i) => blip(c, t0 + i * 0.09, f, 0.22, "triangle", 0.28));
}

export function playHighScore() {
  const c = ensureContext();
  if (!c) return;
  const t0 = c.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
  notes.forEach((f, i) => blip(c, t0 + i * 0.08, f, 0.3, "triangle", 0.3));
}

export function playPowerUp() {
  const c = ensureContext();
  if (!c) return;
  const t0 = c.currentTime;
  blip(c, t0, 440, 0.1, "square", 0.22);
  blip(c, t0 + 0.09, 660, 0.16, "square", 0.24);
}

export function playNearMiss() {
  const c = ensureContext();
  if (!c) return;
  const t0 = c.currentTime;
  blip(c, t0, 260, 0.08, "sine", 0.14);
}

export function playTapVariant() {
  playFart(rand(0.15, 0.4));
}

// ---------- extra SFX ----------

export function playWhoosh() {
  const c = ensureContext();
  if (!c) return;
  const t0 = c.currentTime;
  const noise = noiseSource(c);
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = 1.4;
  f.frequency.setValueAtTime(600, t0);
  f.frequency.exponentialRampToValueAtTime(3200, t0 + 0.16);
  f.frequency.exponentialRampToValueAtTime(900, t0 + 0.3);
  const g = envGain(c, 0.04, 0.26, 0.32, t0);
  noise.connect(f);
  f.connect(g);
  g.connect(masterGain);
  noise.start(t0);
  noise.stop(t0 + 0.34);
  blip(c, t0 + 0.05, 1318.5, 0.12, "triangle", 0.12);
  blip(c, t0 + 0.11, 1760, 0.16, "triangle", 0.1);
}

export function playMilestone() {
  const c = ensureContext();
  if (!c) return;
  const t0 = c.currentTime;
  blip(c, t0, 987.77, 0.12, "square", 0.1);
  blip(c, t0 + 0.07, 1318.5, 0.3, "triangle", 0.22);
}

export function playTick(pitch = 1) {
  const c = ensureContext();
  if (!c) return;
  blip(c, c.currentTime, 880 * pitch, 0.04, "square", 0.06);
}

export function playUnlock() {
  const c = ensureContext();
  if (!c) return;
  const t0 = c.currentTime;
  [659.25, 830.61, 987.77, 1318.5].forEach((f, i) => blip(c, t0 + i * 0.07, f, 0.35, "triangle", 0.22));
  [329.63, 493.88].forEach((f) => blip(c, t0 + 0.28, f, 0.5, "square", 0.08));
}

// wah... wah... wah... waaaaah — plays under the game-over reveal
export function playSadTrombone() {
  const c = ensureContext();
  if (!c) return;
  const t0 = c.currentTime + 0.05;
  const notes = [
    { f: 293.66, at: 0, dur: 0.34 },
    { f: 277.18, at: 0.38, dur: 0.34 },
    { f: 261.63, at: 0.76, dur: 0.34 },
    { f: 246.94, at: 1.14, dur: 1.1 },
  ];
  for (const n of notes) {
    const t = t0 + n.at;
    const osc = c.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(n.f * 1.03, t);
    osc.frequency.exponentialRampToValueAtTime(n.f, t + 0.06);
    if (n.dur > 0.5) {
      // the long last note sags and wobbles
      const lfo = c.createOscillator();
      const lfoGain = c.createGain();
      lfo.frequency.value = 5.5;
      lfoGain.gain.setValueAtTime(0, t);
      lfoGain.gain.linearRampToValueAtTime(n.f * 0.035, t + 0.35);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + n.dur + 0.05);
      osc.frequency.exponentialRampToValueAtTime(n.f * 0.94, t + n.dur);
    }
    // the "wah": a lowpass that opens and closes like a plunger mute
    const wah = c.createBiquadFilter();
    wah.type = "lowpass";
    wah.Q.value = 6;
    wah.frequency.setValueAtTime(300, t);
    wah.frequency.exponentialRampToValueAtTime(1500, t + Math.min(0.14, n.dur * 0.4));
    wah.frequency.exponentialRampToValueAtTime(420, t + n.dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.03);
    g.gain.setValueAtTime(0.22, t + n.dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + n.dur);
    osc.connect(wah);
    wah.connect(g);
    g.connect(masterGain);
    osc.start(t);
    osc.stop(t + n.dur + 0.05);
  }
}

// ---------- music ----------
// A tiny lookahead sequencer: oompah tuba bass, off-beat chord stabs and a
// cheeky melody, all synthesized. Layers come in as the run heats up.

const MIDI = (n) => 440 * Math.pow(2, (n - 69) / 12);
// 8th-note steps, 8 per bar, 4 bars. Chords: C F G C, then C F G7 C.
const CHORDS = [
  [48, [60, 64, 67]],
  [41, [60, 65, 69]],
  [43, [59, 62, 67]],
  [48, [60, 64, 67]],
  [48, [60, 64, 67]],
  [41, [60, 65, 69]],
  [43, [59, 62, 65]],
  [48, [60, 64, 67]],
];
const _ = null;
const MELODY = [
  67, _, 72, _, 71, 72, 74, _,
  72, _, 69, _, 65, _, 67, 69,
  71, _, 74, _, 79, _, 77, 74,
  72, _, 67, _, 72, _, _, _,
  67, _, 72, _, 71, 72, 74, _,
  77, _, 76, _, 74, _, 72, 74,
  76, 74, 72, _, 71, _, 67, _,
  72, _, 79, _, 84, _, _, _,
];

let musicGain = null;
let musicTimer = null;
let musicStep = 0;
let nextStepTime = 0;
let musicIntensity = 0; // 0 idle, 1 playing, ramps toward 2 with speed
let musicOn = !storage.getMusicMuted();
let tempo = 132;

export function isMusicMuted() {
  return !musicOn;
}

export function setMusicMuted(m) {
  musicOn = !m;
  storage.setMusicMuted(m);
  if (musicGain && ctx) musicGain.gain.setTargetAtTime(m ? 0 : 0.55, ctx.currentTime, 0.1);
}

export function setMusicIntensity(level, speedFrac = 0) {
  musicIntensity = level;
  tempo = 132 + clamp(speedFrac, 0, 1) * 22;
}

export function startMusic() {
  const c = ensureContext();
  if (!c || musicTimer) return;
  if (!musicGain) {
    musicGain = c.createGain();
    musicGain.connect(masterGain);
  }
  musicGain.gain.cancelScheduledValues(c.currentTime);
  musicGain.gain.setValueAtTime(0.0001, c.currentTime);
  musicGain.gain.setTargetAtTime(musicOn ? 0.55 : 0, c.currentTime, 0.15);
  musicStep = 0;
  nextStepTime = c.currentTime + 0.08;
  musicTimer = setInterval(scheduleMusic, 25);
}

export function stopMusic(fade = 0.25) {
  if (!musicTimer) return;
  clearInterval(musicTimer);
  musicTimer = null;
  if (musicGain && ctx) {
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.setTargetAtTime(0.0001, ctx.currentTime, fade / 3);
  }
}

function scheduleMusic() {
  const c = ctx;
  if (!c) return;
  // after a long stall (backgrounded tab) don't try to catch up
  if (nextStepTime < c.currentTime - 0.2) nextStepTime = c.currentTime + 0.05;
  while (nextStepTime < c.currentTime + 0.12) {
    playStep(c, musicStep, nextStepTime);
    nextStepTime += 60 / tempo / 2;
    musicStep = (musicStep + 1) % MELODY.length;
  }
}

function playStep(c, step, t) {
  const bar = Math.floor(step / 8);
  const beat = step % 8;
  const [root, chord] = CHORDS[bar];
  const dur8 = 60 / tempo / 2;

  // oom: bass on 1 and 3 (root, then fifth)
  if (beat === 0 || beat === 4) {
    tuba(c, t, MIDI(beat === 0 ? root : root + 7), dur8 * 1.6);
  }
  // pah: short chord stabs on the off-beats
  if (beat === 2 || beat === 6) {
    for (const n of chord) pluck(c, t, MIDI(n), dur8 * 0.7, "square", 0.028, 2200);
  }
  if (musicIntensity >= 1) {
    const m = MELODY[step];
    if (m) pluck(c, t, MIDI(m), dur8 * 1.4, "triangle", 0.1, 3500);
  }
  if (musicIntensity >= 1.4 && beat % 2 === 1) hat(c, t, 0.05);
  if (musicIntensity >= 1.75 && beat % 2 === 0) hat(c, t, 0.03);
}

function tuba(c, t, freq, dur) {
  const osc = c.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(freq * 0.97, t);
  osc.frequency.exponentialRampToValueAtTime(freq, t + 0.03);
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.setValueAtTime(260, t);
  f.frequency.exponentialRampToValueAtTime(700, t + 0.04);
  f.frequency.exponentialRampToValueAtTime(240, t + dur);
  f.Q.value = 3;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.32, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(f);
  f.connect(g);
  g.connect(musicGain);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function pluck(c, t, freq, dur, type, gain, cutoff) {
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.setValueAtTime(cutoff, t);
  f.frequency.exponentialRampToValueAtTime(cutoff * 0.3, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(f);
  f.connect(g);
  g.connect(musicGain);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function hat(c, t, gain) {
  const src = noiseSource(c);
  const f = c.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = 7000;
  const g = envGain(c, 0.002, 0.04, gain, t);
  src.connect(f);
  f.connect(g);
  g.connect(musicGain);
  src.start(t, Math.random());
  src.stop(t + 0.06);
}
