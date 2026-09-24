// Home Screen icon artwork. Kurt himself is drawn with the real in-game
// renderer (drawKurt), so the icon can never drift from the character.
// Rendered to PNGs by tools/build-icons.mjs.
import { createKurt, resetKurt, beginThrust, updateKurt, getButtPosition, drawKurt } from "../src/kurt.js";

const SKY_TOP = "#3fb8f5";
const SKY_BOTTOM = "#bff0ff";
const PUFF = "#e4f0d4";
const PUFF_SHADE = "#bcd89a";
const PUFF_EDGE = "rgba(84,120,48,0.55)";
const BIT_GREENS = ["#8bc34a", "#7cb342", "#9ccc65", "#6fa83a"];

// deterministic RNG so every build produces byte-identical art
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function posedKurt() {
  const kurt = createKurt();
  resetKurt(kurt, 0, 0, null);
  beginThrust(kurt);
  // hold a steady nose-up climb (thrust exactly cancels gravity) long
  // enough for the hair wisps to stream back like he's mid-flight
  kurt.vy = -400;
  for (let i = 0; i < 150; i++) updateKurt(kurt, 1 / 60, 1, 700, 0.54);
  kurt.fartExprIndex = 2; // laughing: he's having the time of his life
  kurt.blinking = false;
  kurt.squash = 0;
  kurt.scaleX = 0.96;
  kurt.scaleY = 1.05; // a hint of stretch sells the upward launch
  return kurt;
}

// size: output px. zoom: 1 for full-bleed Home Screen art, <1 to pull the
// subject into the maskable safe zone, >1 for tight favicon crops.
export function drawIcon(ctx, size, { zoom = 1 } = {}) {
  const rand = mulberry32(0xf4a7);
  const u = size / 100; // work in a 100x100 design space
  ctx.save();
  ctx.clearRect(0, 0, size, size);

  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, size);
  sky.addColorStop(0, SKY_TOP);
  sky.addColorStop(1, SKY_BOTTOM);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, size, size);

  const kurt = posedKurt();
  // Kurt's visual centre sits a little above and ahead of his physics origin
  const R = 26;
  const scale = size * 0.0122 * zoom;
  const originX = size * 0.56 - (R * 0.05) * scale;
  const originY = size * 0.47 + (R * 0.3) * scale;

  // sunburst radiating from Kurt
  ctx.save();
  ctx.translate(size * 0.58, size * 0.38);
  const rays = 14;
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  for (let i = 0; i < rays; i++) {
    const a0 = (i / rays) * Math.PI * 2;
    const a1 = a0 + Math.PI / rays;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, size * 1.2, a0, a1);
    ctx.closePath();
    ctx.fill();
  }
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.42);
  glow.addColorStop(0, "rgba(255,248,210,0.75)");
  glow.addColorStop(1, "rgba(255,248,210,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(-size, -size, size * 2, size * 2);
  ctx.restore();

  // little background clouds
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  cloud(ctx, 16 * u, 18 * u, 0.55 * u);
  cloud(ctx, 88 * u, 70 * u, 0.4 * u);

  // speed lines streaming off behind him
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineCap = "round";
  for (const [x, y, len, w] of [
    [8, 40, 16, 1.6],
    [4, 52, 12, 1.2],
    [14, 30, 10, 1.1],
    [70, 88, 14, 1.3],
  ]) {
    ctx.lineWidth = w * u;
    ctx.beginPath();
    ctx.moveTo(x * u, y * u);
    ctx.lineTo((x + len) * u, (y - len * 0.45) * u);
    ctx.stroke();
  }

  ctx.translate(originX, originY);
  ctx.scale(scale, scale);
  // the flight sim above carried him upward; recentre on where he ended up
  ctx.translate(-kurt.x, -kurt.y);

  // the fart cloud: a billowing trail from the butt to the bottom-left
  // corner, drawn in world units so it lines up with Kurt at any zoom
  const butt = getButtPosition(kurt);
  const puffs = [];
  const steps = 9;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    puffs.push({
      x: butt.x - 6 - t * 58 + (rand() - 0.5) * 6,
      y: butt.y + 4 + t * 38 + (rand() - 0.5) * 6,
      r: 7 + t * 15 + rand() * 3,
    });
  }
  // outline pass, then fill pass, so overlapping puffs merge into one cloud
  ctx.fillStyle = PUFF_EDGE;
  for (const p of puffs) circle(ctx, p.x, p.y, p.r + 1.6);
  ctx.fillStyle = PUFF_SHADE;
  for (const p of puffs) circle(ctx, p.x, p.y, p.r);
  ctx.fillStyle = PUFF;
  for (const p of puffs) circle(ctx, p.x - p.r * 0.18, p.y - p.r * 0.2, p.r * 0.78);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  for (const p of puffs) circle(ctx, p.x - p.r * 0.38, p.y - p.r * 0.42, p.r * 0.22);

  // stink bits flung out of the blast
  for (let i = 0; i < 9; i++) {
    const t = rand();
    ctx.fillStyle = BIT_GREENS[i % BIT_GREENS.length];
    circle(
      ctx,
      butt.x - 8 - t * 44 + (rand() - 0.5) * 30,
      butt.y + 2 + t * 30 + (rand() - 0.5) * 30,
      0.9 + rand() * 1.1,
    );
  }

  // Kurt goes on his own layer first so the drop shadow is cast by his
  // silhouette alone rather than by every eyebrow and crease stroke
  const layer = document.createElement("canvas");
  layer.width = layer.height = size;
  const lctx = layer.getContext("2d");
  lctx.setTransform(ctx.getTransform());
  drawKurt(lctx, kurt);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.shadowColor = "rgba(20,40,80,0.35)";
  ctx.shadowBlur = 0.04 * size;
  ctx.shadowOffsetY = 0.015 * size;
  ctx.drawImage(layer, 0, 0);

  ctx.restore();
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function cloud(ctx, x, y, s) {
  for (const [dx, dy, rx, ry] of [[0, 0, 22, 13], [16, -6, 15, 11], [-16, -3, 14, 10]]) {
    ctx.beginPath();
    ctx.ellipse(x + dx * s, y + dy * s, rx * s, ry * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
