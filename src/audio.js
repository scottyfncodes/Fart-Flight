import { rand, choose, clamp } from "./utils.js";
import { storage } from "./storage.js";

let ctx = null;
let masterGain = null;
let windGain = null;
let windSource = null;
let noiseBuffer = null;
let unlocked = false;
let muted = storage.getMuted();

function ensureContext() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  masterGain = ctx.createGain();
  masterGain.gain.value = muted ? 0 : 1;
  masterGain.connect(ctx.destination);
  noiseBuffer = buildNoiseBuffer(ctx);
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
  const startFreq = rand(p.startFreq[0], p.startFreq[1]);
  const endFreq = rand(p.endFreq[0], p.endFreq[1]);
  const buzzFreq = rand(p.buzz[0], p.buzz[1]);

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
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + dur);
  osc.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);

  const buzz = c.createOscillator();
  buzz.type = "square";
  buzz.frequency.setValueAtTime(buzzFreq, t0);
  const buzzGain = c.createGain();
  buzzGain.gain.value = p.gain * 0.35;
  buzz.connect(buzzGain);
  buzzGain.connect(master);
  buzz.start(t0);
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

export function playGiggle() {
  const c = ensureContext();
  if (!c) return;
  const t0 = c.currentTime;
  const noteCount = 3 + Math.floor(rand(0, 3));
  const baseFreq = rand(480, 560);
  const noteDur = 0.1;
  for (let i = 0; i < noteCount; i++) {
    const start = t0 + i * noteDur * 0.82;
    const freq = baseFreq * rand(0.94, 1.12) + i * 14;
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, start);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.22, start + noteDur * 0.55);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.92, start + noteDur);
    const g = envGain(c, 0.012, noteDur * 0.75, 0.16, start);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(start);
    osc.stop(start + noteDur + 0.03);
  }
}
