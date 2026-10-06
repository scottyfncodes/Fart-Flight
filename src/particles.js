import { rand, choose } from "./utils.js";

export function createParticleSystem() {
  return { puffs: [], bits: [], sparkles: [] };
}

const BIT_GREENS = ["#8bc34a", "#7cb342", "#9ccc65", "#6fa83a"];

export function spawnFartBurst(sys, x, y, intensity, angleDeg = 165) {
  const count = Math.round(4 + intensity * 5);
  const baseAngle = (angleDeg * Math.PI) / 180;
  const dirX = Math.cos(baseAngle);
  const dirY = Math.sin(baseAngle);
  for (let i = 0; i < count; i++) {
    // a narrow cone out of the vent: the puffs leave as a tight jet and
    // only spread as drag slows them, so the cloud visibly billows out
    // from one point instead of appearing as a ready-made blob
    const spread = (rand(-14, 14) * Math.PI) / 180;
    const a = baseAngle + spread;
    const speed = rand(110, 200) * (0.55 + intensity * 0.55);
    // stagger the puffs a little way down the jet so the first frame
    // already reads as a stream leaving the body
    const along = rand(0, 10);
    sys.puffs.push({
      x: x + dirX * along + rand(-1.5, 1.5),
      y: y + dirY * along + rand(-1.5, 1.5),
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      r: rand(3, 6.5) * (0.7 + intensity * 0.7),
      life: 0,
      maxLife: rand(0.65, 1.1),
      spin: rand(-1, 1),
    });
  }
  const bitCount = Math.round(5 + intensity * 6);
  for (let i = 0; i < bitCount; i++) {
    const spread = (rand(-24, 24) * Math.PI) / 180;
    const a = baseAngle + spread;
    const speed = rand(120, 220) * (0.55 + intensity * 0.6);
    sys.bits.push({
      x: x + dirX * rand(0, 4),
      y: y + dirY * rand(0, 4),
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      r: rand(1.6, 3.2),
      life: 0,
      maxLife: rand(0.4, 0.65),
      color: choose(BIT_GREENS),
    });
  }
}

export function spawnSparkles(sys, x, y, color, count = 14) {
  for (let i = 0; i < count; i++) {
    const a = rand(0, Math.PI * 2);
    const speed = rand(40, 160);
    sys.sparkles.push({
      x, y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: 0,
      maxLife: rand(0.4, 0.8),
      color,
      r: rand(2, 4),
    });
  }
}

export function updateParticles(sys, dt) {
  updateArr(sys.puffs, dt, 9);
  updateArr(sys.bits, dt, 7);
  updateArr(sys.sparkles, dt, 10, true);
}

function updateArr(arr, dt, drag, gravity) {
  for (let i = arr.length - 1; i >= 0; i--) {
    const p = arr[i];
    p.life += dt;
    if (p.life >= p.maxLife) {
      arr.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.max(0, 1 - drag * dt);
    p.vy *= Math.max(0, 1 - drag * dt);
    if (gravity) p.vy += 260 * dt;
    else p.vy += 30 * dt;
  }
}

export function drawParticles(ctx, sys) {
  ctx.save();
  for (const p of sys.puffs) {
    const t = p.life / p.maxLife;
    ctx.globalAlpha = (1 - t) * 0.55;
    ctx.fillStyle = "#e4f0d4";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * (0.6 + t * 1.9), 0, Math.PI * 2);
    ctx.fill();
  }
  for (const p of sys.bits) {
    const t = p.life / p.maxLife;
    ctx.globalAlpha = (1 - t) * 0.85;
    ctx.fillStyle = p.color || "#8bc34a";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const p of sys.sparkles) {
    const t = p.life / p.maxLife;
    ctx.globalAlpha = 1 - t;
    ctx.fillStyle = p.color || "#ffcd3c";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * (1 - t * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}
