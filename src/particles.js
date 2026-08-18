import { rand } from "./utils.js";

export function createParticleSystem() {
  return { puffs: [], bits: [], sparkles: [] };
}

export function spawnFartBurst(sys, x, y, intensity, angleDeg = 100) {
  const count = Math.round(4 + intensity * 5);
  const baseAngle = (angleDeg * Math.PI) / 180;
  for (let i = 0; i < count; i++) {
    const spread = (rand(-26, 26) * Math.PI) / 180;
    const a = baseAngle + spread;
    const speed = rand(35, 100) * (0.55 + intensity * 0.55);
    sys.puffs.push({
      x: x + rand(-4, 4),
      y: y + rand(-4, 4),
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      r: rand(5, 10) * (0.7 + intensity * 0.7),
      life: 0,
      maxLife: rand(0.65, 1.1),
      spin: rand(-1, 1),
    });
  }
  const bitCount = Math.round(3 + intensity * 4);
  for (let i = 0; i < bitCount; i++) {
    const spread = (rand(-38, 38) * Math.PI) / 180;
    const a = baseAngle + spread;
    const speed = rand(80, 170) * (0.55 + intensity * 0.6);
    sys.bits.push({
      x, y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      r: rand(1.5, 3),
      life: 0,
      maxLife: rand(0.4, 0.65),
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
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * (0.7 + t * 0.8), 0, Math.PI * 2);
    ctx.fill();
  }
  for (const p of sys.bits) {
    const t = p.life / p.maxLife;
    ctx.globalAlpha = (1 - t) * 0.7;
    ctx.fillStyle = "#d7e8c8";
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
