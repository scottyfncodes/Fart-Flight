import { rand } from "./utils.js";

// Kurt's dignity is his wardrobe. He starts every run fully dressed and
// sheds a piece each time his dignity drops below that piece's line, down
// to the bare cannonball. Missing pieces float by as pickups; grabbing one
// puts it back on and restores dignity.
// Ordered from first lost to last lost.
export const CLOTHES = [
  { key: "socks", label: "SOCKS", lostAt: 85, color: "#f4f1e8", trim: "#ff5a3c" },
  { key: "shirt", label: "SHIRT", lostAt: 65, color: "#3fb8f5", trim: "#2a8cc0" },
  { key: "pants", label: "PANTS", lostAt: 45, color: "#3d5a99", trim: "#2b4173" },
  { key: "undies", label: "UNDIES", lostAt: 20, color: "#ffffff", trim: "#ff6fa5" },
];

export const CLOTHES_BY_KEY = Object.fromEntries(CLOTHES.map((c) => [c.key, c]));

// pickups land you this far above the piece's line, so one bad near-miss
// doesn't strip it straight back off
const RESTORE_MARGIN = 8;
const MIN_RESTORE = 10;

export function outfitFor(dignity) {
  const o = {};
  for (const c of CLOTHES) o[c.key] = dignity >= c.lostAt;
  return o;
}

// the piece Kurt would put on next: the last one he lost
export function nextMissing(dignity) {
  for (let i = CLOTHES.length - 1; i >= 0; i--) {
    if (dignity < CLOTHES[i].lostAt) return CLOTHES[i];
  }
  return null;
}

export function restoreAmount(dignity, piece) {
  return Math.max(MIN_RESTORE, piece.lostAt + RESTORE_MARGIN - dignity);
}

export function createWardrobe() {
  return { items: [], flying: [], sinceSpawn: 0, nextSpawn: 6 };
}

export function resetWardrobe(w) {
  w.items.length = 0;
  w.flying.length = 0;
  w.sinceSpawn = 0;
  w.nextSpawn = rand(5, 8);
}

// while something is missing, float its replacement in every so often
export function maybeSpawnClothes(w, dt, dignity, worldW, worldH, groundH) {
  const piece = nextMissing(dignity);
  if (!piece || w.items.length) return;
  w.sinceSpawn += dt;
  if (w.sinceSpawn < w.nextSpawn) return;
  w.sinceSpawn = 0;
  w.nextSpawn = rand(7, 11);
  const y = rand(worldH * 0.18, (worldH - groundH) * 0.78);
  w.items.push({ piece, x: worldW + 30, y, r: 20, phase: rand(0, 10) });
}

// a lost piece tumbles off Kurt and falls away
export function throwOff(w, piece, x, y) {
  w.flying.push({ piece, x, y, vx: rand(-160, -60), vy: rand(-320, -220), rot: 0, vr: rand(-9, 9), life: 0 });
}

export function updateWardrobe(w, dt, scrollSpeed) {
  for (let i = w.items.length - 1; i >= 0; i--) {
    const it = w.items[i];
    it.x -= scrollSpeed * dt;
    it.phase += dt * 3;
    it.y += Math.sin(it.phase) * 0.5;
    if (it.x < -40) w.items.splice(i, 1);
  }
  for (let i = w.flying.length - 1; i >= 0; i--) {
    const f = w.flying[i];
    f.life += dt;
    f.vy += 900 * dt;
    f.x += (f.vx - scrollSpeed * 0.4) * dt;
    f.y += f.vy * dt;
    f.rot += f.vr * dt;
    if (f.life > 2.5) w.flying.splice(i, 1);
  }
}

export function tryCollectClothes(w, kurtX, kurtY, kurtR, onCollect) {
  for (let i = w.items.length - 1; i >= 0; i--) {
    const it = w.items[i];
    const dx = it.x - kurtX;
    const dy = it.y - kurtY;
    if (dx * dx + dy * dy <= (it.r + kurtR) * (it.r + kurtR)) {
      w.items.splice(i, 1);
      onCollect(it.piece);
    }
  }
}

export function drawWardrobe(ctx, w) {
  for (const it of w.items) {
    ctx.save();
    ctx.translate(it.x, it.y);
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 180);
    ctx.globalAlpha = 0.3 + pulse * 0.25;
    ctx.fillStyle = "#ffe066";
    ctx.beginPath();
    ctx.arc(0, 0, 25 + pulse * 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.strokeStyle = "rgba(20,24,40,0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.rotate(Math.sin(performance.now() / 260) * 0.2);
    drawPiece(ctx, it.piece, 1);
    ctx.restore();
  }
  for (const f of w.flying) {
    ctx.save();
    ctx.globalAlpha = f.life > 1.8 ? Math.max(0, 1 - (f.life - 1.8) / 0.7) : 1;
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot);
    drawPiece(ctx, f.piece, 1.1);
    ctx.restore();
  }
}

// a little flat icon of each piece, centred on the origin
function drawPiece(ctx, piece, s) {
  ctx.save();
  ctx.scale(s, s);
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#2a1f1a";
  ctx.lineWidth = 1.6;
  ctx.fillStyle = piece.color;
  ctx.beginPath();
  switch (piece.key) {
    case "socks":
      ctx.moveTo(-5, -12);
      ctx.lineTo(3, -12);
      ctx.lineTo(3, 2);
      ctx.lineTo(11, 6);
      ctx.quadraticCurveTo(13, 12, 6, 12);
      ctx.lineTo(-3, 9);
      ctx.quadraticCurveTo(-6, 7, -5, 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = piece.trim;
      ctx.fillRect(-5, -12, 8, 4);
      break;
    case "shirt":
      ctx.moveTo(-5, -11);
      ctx.lineTo(-13, -6);
      ctx.lineTo(-10, 0);
      ctx.lineTo(-7, -2);
      ctx.lineTo(-7, 11);
      ctx.lineTo(7, 11);
      ctx.lineTo(7, -2);
      ctx.lineTo(10, 0);
      ctx.lineTo(13, -6);
      ctx.lineTo(5, -11);
      ctx.quadraticCurveTo(0, -6, -5, -11);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case "pants":
      ctx.moveTo(-9, -11);
      ctx.lineTo(9, -11);
      ctx.lineTo(10, 12);
      ctx.lineTo(3, 12);
      ctx.lineTo(0, -2);
      ctx.lineTo(-3, 12);
      ctx.lineTo(-10, 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = piece.trim;
      ctx.fillRect(-9, -11, 18, 3);
      break;
    case "undies":
      ctx.moveTo(-12, -7);
      ctx.lineTo(12, -7);
      ctx.lineTo(10, 1);
      ctx.quadraticCurveTo(3, 3, 2, 8);
      ctx.lineTo(-2, 8);
      ctx.quadraticCurveTo(-3, 3, -10, 1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = piece.trim;
      ctx.fillRect(-12, -7, 24, 3);
      // a couple of hearts' worth of dots
      ctx.beginPath();
      ctx.arc(-5, -1, 1.6, 0, Math.PI * 2);
      ctx.arc(5, -1, 1.6, 0, Math.PI * 2);
      ctx.fill();
      break;
  }
  ctx.restore();
}
