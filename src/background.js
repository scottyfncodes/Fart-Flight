import { rand } from "./utils.js";

// far/near are the two parallax hill layers; skyline fades a city in
const THEME_COLORS = [
  { from: 0, sky1: "#58c8ff", sky2: "#eaf9ff", far: "#a9dcf0", near: "#8fd07c", ground: "#6bbf59", sun: "#fff4c2", skyline: 0, stars: 0 },
  { from: 300, sky1: "#5cc4ff", sky2: "#eaf9ff", far: "#a6d3ea", near: "#9cc98a", ground: "#9aa0a8", sun: "#fff4c2", skyline: 0.35, stars: 0 },
  { from: 700, sky1: "#63c0fa", sky2: "#e6f7ff", far: "#9fc6e0", near: "#8fb492", ground: "#8b93a0", sun: "#fff0b8", skyline: 0.7, stars: 0 },
  { from: 1200, sky1: "#4fa8ec", sky2: "#e3f4ff", far: "#8fb2d6", near: "#7d8fa8", ground: "#5f6b80", sun: "#ffe7a3", skyline: 1, stars: 0 },
  { from: 1800, sky1: "#ffb35c", sky2: "#fff0d2", far: "#f2c98f", near: "#e0a867", ground: "#d9a24f", sun: "#fff1c9", skyline: 0, stars: 0 },
  { from: 2500, sky1: "#6f7fd6", sky2: "#f0e0ff", far: "#a99bd6", near: "#7d6fa6", ground: "#5c527a", sun: "#ffd7f0", skyline: 0.3, stars: 0.3 },
  { from: 3300, sky1: "#1d1f4a", sky2: "#7a5fae", far: "#3d3570", near: "#2f2a58", ground: "#2c2a4d", sun: "#f2f0ff", skyline: 0.5, stars: 1 },
];

function lerpColor(c1, c2, t) {
  const a = hexToRgb(c1), b = hexToRgb(c2);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return `rgb(${r},${g},${bl})`;
}
function hexToRgb(hex) {
  if (hex.startsWith("rgb")) {
    const [r, g, b] = hex.match(/\d+/g).map(Number);
    return { r, g, b };
  }
  const v = hex.replace("#", "");
  return {
    r: parseInt(v.substring(0, 2), 16),
    g: parseInt(v.substring(2, 4), 16),
    b: parseInt(v.substring(4, 6), 16),
  };
}

function colorsAt(meters) {
  const nextIdx = THEME_COLORS.findIndex((t) => t.from > meters);
  if (nextIdx === -1) return THEME_COLORS[THEME_COLORS.length - 1];
  const cur = THEME_COLORS[nextIdx - 1];
  const next = THEME_COLORS[nextIdx];
  // hold each theme, then blend over the last 120m before the next one
  const t = Math.max(0, Math.min(1, (meters - (next.from - 120)) / 120));
  if (t === 0) return cur;
  const out = {};
  for (const k of Object.keys(cur)) {
    out[k] = typeof cur[k] === "number" ? cur[k] + (next[k] - cur[k]) * t : lerpColor(cur[k], next[k], t);
  }
  return out;
}

export function createBackground(w, h) {
  const clouds = [];
  for (let i = 0; i < 6; i++) {
    clouds.push({ x: rand(0, w), y: rand(h * 0.05, h * 0.4), scale: rand(0.6, 1.4), speed: rand(10, 22) });
  }
  const stars = [];
  for (let i = 0; i < 50; i++) stars.push({ x: rand(0, 1), y: rand(0, 0.6), r: rand(0.6, 1.8), tw: rand(0, 6) });
  const buildings = [];
  let bx = 0;
  while (bx < 2000) {
    const bw = rand(26, 60);
    buildings.push({ x: bx, w: bw, h: rand(40, 130), antenna: Math.random() < 0.25 });
    bx += bw + rand(2, 10);
  }
  return { clouds, stars, buildings, skylineLen: bx, scroll: 0, groundOffset: 0, time: 0, w, h, prevMeters: 0 };
}

export function resizeBackground(bg, w, h) {
  bg.w = w;
  bg.h = h;
}

export function updateBackground(bg, dt, scrollSpeed, meters) {
  bg.prevMeters = meters;
  bg.scroll += scrollSpeed * dt;
  bg.time += dt;
  for (const c of bg.clouds) {
    c.x -= (c.speed + scrollSpeed * 0.08) * dt;
    if (c.x < -80) {
      c.x = bg.w + rand(20, 100);
      c.y = rand(bg.h * 0.05, bg.h * 0.4);
      c.scale = rand(0.6, 1.4);
    }
  }
  bg.groundOffset = bg.scroll % 40;
}

export function drawBackground(ctx, bg, meters, groundH) {
  const w = bg.w, h = bg.h;
  const col = colorsAt(meters);
  const groundY = h - groundH;

  const grad = ctx.createLinearGradient(0, 0, 0, groundY);
  grad.addColorStop(0, col.sky1);
  grad.addColorStop(1, col.sky2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  if (col.stars > 0.01) {
    ctx.fillStyle = "#fff";
    for (const s of bg.stars) {
      ctx.globalAlpha = col.stars * (0.55 + 0.45 * Math.sin(bg.time * 2 + s.tw));
      ctx.beginPath();
      ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // sun with a soft halo
  const sx = w * 0.78, sy = h * 0.16, sr = Math.min(w, h) * 0.07;
  const halo = ctx.createRadialGradient(sx, sy, sr * 0.6, sx, sy, sr * 3.2);
  halo.addColorStop(0, "rgba(255,255,240,0.55)");
  halo.addColorStop(1, "rgba(255,255,240,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(sx - sr * 4, sy - sr * 4, sr * 8, sr * 8);
  ctx.fillStyle = col.sun;
  ctx.beginPath();
  ctx.arc(sx, sy, sr, 0, Math.PI * 2);
  ctx.fill();

  for (const c of bg.clouds) drawCloud(ctx, c.x, c.y, c.scale);

  // far mountains
  drawRidge(ctx, w, groundY, bg.scroll * 0.08, col.far, groundY - h * 0.2, h * 0.07, [0.0061, 0.0137, 0.0023], [1, 0.45, 0.8]);

  if (col.skyline > 0.01) drawSkyline(ctx, bg, w, groundY, col.skyline);

  // near hills
  drawRidge(ctx, w, groundY, bg.scroll * 0.22, col.near, groundY - h * 0.08, h * 0.04, [0.009, 0.021, 0.0041], [1, 0.35, 0.6]);

  if (groundH > 0) {
    ctx.fillStyle = col.ground;
    ctx.fillRect(0, groundY, w, groundH);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(0, groundY, w, 3);
    ctx.fillStyle = "rgba(0,0,0,0.14)";
    ctx.fillRect(0, groundY + 3, w, 3);
    // scrolling stripes sell the speed
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    const off = bg.groundOffset || 0;
    for (let gx = -off; gx < w + 40; gx += 40) {
      ctx.beginPath();
      ctx.moveTo(gx, groundY + 6);
      ctx.lineTo(gx + 20, groundY + 6);
      ctx.lineTo(gx + 8, h);
      ctx.lineTo(gx - 12, h);
      ctx.closePath();
      ctx.fill();
    }
    // grass tufts along the edge
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    const toff = bg.scroll % 23;
    for (let gx = -toff; gx < w + 23; gx += 23) {
      ctx.beginPath();
      ctx.moveTo(gx, groundY + 1);
      ctx.lineTo(gx + 3, groundY - 5);
      ctx.lineTo(gx + 6, groundY + 1);
      ctx.fill();
    }
  }
}

function drawRidge(ctx, w, baseY, offset, color, midY, amp, freqs, weights) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, baseY);
  for (let x = 0; x <= w + 8; x += 8) {
    const u = x + offset;
    let y = 0;
    for (let i = 0; i < freqs.length; i++) y += Math.sin(u * freqs[i] + i * 1.7) * weights[i];
    ctx.lineTo(x, midY - y * amp);
  }
  ctx.lineTo(w, baseY);
  ctx.closePath();
  ctx.fill();
}

function drawSkyline(ctx, bg, w, groundY, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha * 0.8;
  ctx.fillStyle = "#7c93b3";
  const off = (bg.scroll * 0.14) % bg.skylineLen;
  for (let pass = 0; pass < 2; pass++) {
    for (const b of bg.buildings) {
      const x = b.x - off + pass * bg.skylineLen;
      if (x > w || x + b.w < 0) continue;
      ctx.fillRect(x, groundY - b.h - 20, b.w, b.h + 20);
      if (b.antenna) ctx.fillRect(x + b.w / 2 - 1, groundY - b.h - 36, 2, 16);
    }
  }
  ctx.restore();
}

function drawCloud(ctx, x, y, s) {
  const puffs = [[0, 0, 22, 13], [16, -6, 15, 11], [-16, -3, 14, 10], [6, -11, 12, 9]];
  ctx.fillStyle = "rgba(200,225,245,0.7)";
  for (const [dx, dy, rx, ry] of puffs) {
    ctx.beginPath();
    ctx.ellipse(x + dx * s, y + dy * s + 3 * s, rx * s, ry * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  for (const [dx, dy, rx, ry] of puffs) {
    ctx.beginPath();
    ctx.ellipse(x + dx * s, y + dy * s, rx * s, ry * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
