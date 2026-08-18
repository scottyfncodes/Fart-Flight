import { POWERUPS } from "./config.js";
import { rand, choose } from "./utils.js";

export function createPowerupField() {
  return { items: [], active: null, sinceLastSpawn: 0 };
}

export function resetPowerupField(field) {
  field.items.length = 0;
  field.active = null;
  field.sinceLastSpawn = 0;
}

export function maybeSpawnPowerup(field, dt, worldW, worldH, groundH, meters) {
  field.sinceLastSpawn += dt;
  if (field.sinceLastSpawn < POWERUPS.minGapBetween) return;
  if (Math.random() < POWERUPS.spawnChance * dt * 60) {
    const key = choose(Object.keys(POWERUPS.types));
    const def = POWERUPS.types[key];
    const y = rand(worldH * 0.2, (worldH - groundH) * 0.8);
    field.items.push({ key, def, x: worldW + 30, y, r: 18, bobPhase: rand(0, 10) });
    field.sinceLastSpawn = 0;
  }
}

export function updatePowerups(field, dt, scrollSpeed) {
  for (let i = field.items.length - 1; i >= 0; i--) {
    const p = field.items[i];
    p.x -= scrollSpeed * dt;
    p.bobPhase += dt * 3;
    p.y += Math.sin(p.bobPhase) * 0.6;
    if (p.x < -40) field.items.splice(i, 1);
  }
  if (field.active) {
    field.active.timeLeft -= dt;
    if (field.active.timeLeft <= 0) field.active = null;
  }
}

export function tryCollectPowerups(field, kurtX, kurtY, kurtR, onCollect, onInstant) {
  for (let i = field.items.length - 1; i >= 0; i--) {
    const p = field.items[i];
    const dx = p.x - kurtX;
    const dy = p.y - kurtY;
    if (dx * dx + dy * dy <= (p.r + kurtR) * (p.r + kurtR)) {
      field.items.splice(i, 1);
      if (p.def.instant) {
        onInstant(p.key, p.def);
      } else {
        field.active = { key: p.key, def: p.def, timeLeft: p.def.duration, duration: p.def.duration };
        onCollect(p.key, p.def);
      }
    }
  }
}

export function getActiveModifiers(field) {
  if (!field.active) return { thrustMult: 1, gravityMult: 1, speedMult: 1 };
  const d = field.active.def;
  return {
    thrustMult: d.thrustMult || 1,
    gravityMult: d.gravityMult || 1,
    speedMult: d.speedMult || 1,
  };
}

export function drawPowerups(ctx, field) {
  for (const p of field.items) {
    drawIcon(ctx, p.x, p.y, p.def);
  }
}

function drawIcon(ctx, x, y, def) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.arc(0, 0, 19, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = def.color;
  switch (def.icon) {
    case "burrito":
      ctx.beginPath();
      ctx.ellipse(0, 0, 13, 8, 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#7a4a1f";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-8, -2);
      ctx.lineTo(6, 6);
      ctx.stroke();
      break;
    case "shake":
      ctx.fillRect(-7, -10, 14, 18);
      ctx.fillStyle = "#fff";
      ctx.fillRect(-2, -16, 3, 8);
      break;
    case "taco":
      ctx.beginPath();
      ctx.arc(0, 4, 12, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = "#7ab35c";
      ctx.fillRect(-11, 2, 22, 4);
      break;
    case "hotsauce":
      ctx.fillRect(-5, -12, 10, 20);
      ctx.fillRect(-2, -16, 4, 5);
      break;
    case "gasx":
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 7, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-6, 4);
      ctx.lineTo(6, -4);
      ctx.stroke();
      break;
    case "pancakes":
      ctx.fillStyle = "#c97f34";
      ctx.beginPath();
      ctx.ellipse(0, 8, 12, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#d99a4e";
      ctx.beginPath();
      ctx.ellipse(0, 2.5, 12, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#eebb6c";
      ctx.beginPath();
      ctx.ellipse(0, -3, 12, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f6d445";
      ctx.fillRect(-3, -7, 6, 4);
      ctx.strokeStyle = "#8a5a20";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-9, -2);
      ctx.quadraticCurveTo(0, 3, 9, 0);
      ctx.stroke();
      break;
    default:
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
  }
  ctx.restore();
}
