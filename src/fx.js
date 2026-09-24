import { rand, choose } from "./utils.js";

// Canvas-side juice that isn't a fart particle: floating callouts, screen
// flashes, confetti, speed lines, and the dizzy stars after a crash.

const FONT = '"Luckiest Guy", "Arial Black", Impact, sans-serif';
const CONFETTI = ["#ff5a3c", "#ffcd3c", "#38d67a", "#3fb8f5", "#c026d3", "#ffffff"];

export function createFx() {
  return { texts: [], confetti: [], flash: 0, flashColor: "#fff", lines: [], stars: null };
}

export function resetFx(fx) {
  fx.texts.length = 0;
  fx.confetti.length = 0;
  fx.lines.length = 0;
  fx.flash = 0;
  fx.stars = null;
}

// big: headline callouts (milestones, grade-ups); otherwise a small pop
export function popText(fx, x, y, text, { color = "#fff", size = 22, life = 0.9, rise = 60 } = {}) {
  fx.texts.push({ x, y, text, color, size, life: 0, maxLife: life, rise, wobble: rand(-0.12, 0.12) });
}

export function flash(fx, strength = 0.8, color = "#fff") {
  fx.flash = Math.max(fx.flash, strength);
  fx.flashColor = color;
}

export function burstConfetti(fx, x, y, count = 60, spread = 1) {
  for (let i = 0; i < count; i++) {
    const a = rand(-Math.PI, 0);
    const speed = rand(180, 520) * spread;
    fx.confetti.push({
      x, y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      rot: rand(0, Math.PI * 2),
      vr: rand(-12, 12),
      w: rand(5, 9),
      h: rand(3, 5),
      color: choose(CONFETTI),
      life: 0,
      maxLife: rand(1.4, 2.4),
    });
  }
}

export function showDizzyStars(fx, on) {
  fx.stars = on ? { phase: 0 } : null;
}

export function updateFx(fx, dt, scrollSpeed, worldW, worldH, speedFrac) {
  for (let i = fx.texts.length - 1; i >= 0; i--) {
    const t = fx.texts[i];
    t.life += dt;
    if (t.life >= t.maxLife) fx.texts.splice(i, 1);
  }
  for (let i = fx.confetti.length - 1; i >= 0; i--) {
    const c = fx.confetti[i];
    c.life += dt;
    if (c.life >= c.maxLife) {
      fx.confetti.splice(i, 1);
      continue;
    }
    c.vx *= Math.max(0, 1 - 1.8 * dt);
    c.vy += 520 * dt;
    c.vy *= Math.max(0, 1 - 1.2 * dt);
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.rot += c.vr * dt;
  }
  fx.flash = Math.max(0, fx.flash - dt * 3.5);
  if (fx.stars) fx.stars.phase += dt * 5;

  // speed lines only once the run is genuinely fast
  if (speedFrac > 0.35 && Math.random() < (speedFrac - 0.35) * 22 * dt) {
    fx.lines.push({ x: worldW + 20, y: rand(0, worldH * 0.9), len: rand(40, 110), life: 0 });
  }
  for (let i = fx.lines.length - 1; i >= 0; i--) {
    const l = fx.lines[i];
    l.x -= scrollSpeed * 3.2 * dt;
    l.life += dt;
    if (l.x + l.len < -20) fx.lines.splice(i, 1);
  }
}

export function drawFxWorld(ctx, fx, kurt) {
  if (fx.lines.length) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    for (const l of fx.lines) {
      ctx.beginPath();
      ctx.moveTo(l.x, l.y);
      ctx.lineTo(l.x + l.len, l.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (fx.stars && kurt) {
    ctx.save();
    const cx = kurt.x;
    const cy = kurt.y - 42;
    for (let i = 0; i < 3; i++) {
      const a = fx.stars.phase + (i * Math.PI * 2) / 3;
      const sx = cx + Math.cos(a) * 22;
      const sy = cy + Math.sin(a) * 7;
      drawStar(ctx, sx, sy, 6 + Math.sin(a) * 1.5, "#ffcd3c");
    }
    ctx.restore();
  }

  for (const c of fx.confetti) {
    const t = c.life / c.maxLife;
    ctx.save();
    ctx.globalAlpha = t > 0.75 ? (1 - t) / 0.25 : 1;
    ctx.translate(c.x, c.y);
    ctx.rotate(c.rot);
    ctx.scale(1, Math.cos(c.rot * 1.7));
    ctx.fillStyle = c.color;
    ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
    ctx.restore();
  }

  for (const t of fx.texts) {
    const k = t.life / t.maxLife;
    // snap in big, settle, then drift up and fade
    const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.55 : 1.15 - Math.min(0.15, (k - 0.15) * 0.6);
    const alpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(t.x, t.y - t.rise * easeOut(k));
    ctx.rotate(t.wobble);
    ctx.scale(pop, pop);
    ctx.font = `${t.size}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(4, t.size * 0.28);
    ctx.strokeStyle = "rgba(11,18,32,0.9)";
    ctx.strokeText(t.text, 0, 0);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, 0, 0);
    ctx.restore();
  }
}

export function drawFxScreen(ctx, fx, w, h) {
  if (fx.flash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, fx.flash);
    ctx.fillStyle = fx.flashColor;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

function drawStar(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.strokeStyle = "rgba(120,80,0,0.6)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function easeOut(t) {
  return 1 - (1 - t) * (1 - t);
}
