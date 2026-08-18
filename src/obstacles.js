import { OBSTACLES, THEMES, SCROLL, DIGNITY } from "./config.js";
import { clamp, rand, choose } from "./utils.js";

let nextId = 1;

function themeAt(meters) {
  let cur = THEMES[0].key;
  for (const t of THEMES) if (meters >= t.from) cur = t.key;
  return cur;
}

export function createObstacleField() {
  return { list: [], hazards: [], spawnTimer: 0.9, hazardTimer: 4 };
}

export function resetObstacleField(field) {
  field.list.length = 0;
  field.hazards.length = 0;
  field.spawnTimer = 1.1;
  field.hazardTimer = 4.5;
}

function difficultyAt(meters) {
  const gapHeight = clamp(
    OBSTACLES.baseGap - meters * OBSTACLES.gapShrinkPerMeter,
    OBSTACLES.minGap,
    OBSTACLES.baseGap
  );
  const spawnInterval = clamp(
    SCROLL.spawnBaseInterval - meters * 0.00009,
    SCROLL.spawnMinInterval,
    SCROLL.spawnBaseInterval
  );
  return { gapHeight, spawnInterval };
}

export function spawnObstacle(field, worldW, worldH, groundH, meters) {
  const theme = meters >= THEMES[THEMES.length - 1].from && Math.random() < 0.35
    ? choose(THEMES.slice(1)).key
    : themeAt(meters);
  const { gapHeight } = difficultyAt(meters);
  const margin = 60;
  const playH = worldH - groundH;
  const gapCenterY = rand(margin + gapHeight / 2, playH - margin - gapHeight / 2);

  const canMove = meters > THEMES[1].from + 50;
  const canRotate = meters > THEMES[3].from;

  const obstacle = {
    id: nextId++,
    x: worldW + OBSTACLES.width,
    width: OBSTACLES.width,
    theme,
    gapCenterY,
    gapHeight,
    baseCenterY: gapCenterY,
    bob: canMove && Math.random() < 0.4
      ? { amp: rand(30, 70), speed: rand(0.6, 1.3), phase: rand(0, Math.PI * 2) }
      : null,
    hasSpinner: canRotate && Math.random() < 0.3,
    spinAngle: 0,
    passed: false,
    nearMissDone: false,
  };
  field.list.push(obstacle);
}

export function spawnHazard(field, worldW, worldH, groundH, meters) {
  const kind = Math.random() < 0.6 ? "bird" : "helicopter";
  const playH = worldH - groundH;
  const y = rand(playH * 0.15, playH * 0.75);
  field.hazards.push({
    id: nextId++,
    kind,
    x: worldW + 40,
    y,
    baseY: y,
    amp: rand(25, 60),
    speed: rand(0.8, 1.8),
    phase: rand(0, Math.PI * 2),
    radius: kind === "bird" ? 14 : 22,
    wingPhase: 0,
  });
}

export function updateObstacles(field, dt, scrollSpeed, worldW, worldH, groundH, meters, onSpawnCheck) {
  const { spawnInterval } = difficultyAt(meters);
  field.spawnTimer -= dt;
  if (field.spawnTimer <= 0) {
    spawnObstacle(field, worldW, worldH, groundH, meters);
    field.spawnTimer = spawnInterval * rand(0.9, 1.15);
  }

  if (meters > THEMES[2].from) {
    field.hazardTimer -= dt;
    if (field.hazardTimer <= 0) {
      spawnHazard(field, worldW, worldH, groundH, meters);
      field.hazardTimer = rand(4.5, 7.5);
    }
  }

  for (let i = field.list.length - 1; i >= 0; i--) {
    const o = field.list[i];
    o.x -= scrollSpeed * dt;
    if (o.bob) {
      o.bob.phase += o.bob.speed * dt;
      o.gapCenterY = o.baseCenterY + Math.sin(o.bob.phase) * o.bob.amp;
    }
    if (o.hasSpinner) o.spinAngle += dt * 2.2;
    if (o.x + o.width < -40) field.list.splice(i, 1);
  }

  for (let i = field.hazards.length - 1; i >= 0; i--) {
    const h = field.hazards[i];
    h.x -= scrollSpeed * dt * (h.kind === "bird" ? 1.15 : 0.95);
    h.phase += h.speed * dt;
    h.y = h.baseY + Math.sin(h.phase) * h.amp;
    h.wingPhase += dt * 14;
    if (h.x < -60) field.hazards.splice(i, 1);
  }
}

export function getObstacleRects(o, worldH, groundH) {
  const playH = worldH - groundH;
  const topH = Math.max(0, o.gapCenterY - o.gapHeight / 2);
  const bottomY = o.gapCenterY + o.gapHeight / 2;
  const bottomH = Math.max(0, playH - bottomY);
  return [
    { x: o.x, y: 0, w: o.width, h: topH },
    { x: o.x, y: bottomY, w: o.width, h: bottomH },
  ];
}

export function getSpinnerPoints(o) {
  if (!o.hasSpinner) return [];
  const cx = o.x + o.width / 2;
  const cy = o.gapCenterY;
  const len = o.gapHeight * 0.32;
  const pts = [];
  for (let i = 0; i < 2; i++) {
    const a = o.spinAngle + i * Math.PI;
    pts.push({ x: cx + Math.cos(a) * len, y: cy + Math.sin(a) * len, r: 9 });
    pts.push({ x: cx + Math.cos(a) * len * 0.55, y: cy + Math.sin(a) * len * 0.55, r: 8 });
  }
  return pts;
}

export function checkNearMissAndScore(field, kurtX, kurtY, onPass) {
  for (const o of field.list) {
    if (!o.passed && o.x + o.width < kurtX) {
      o.passed = true;
      const topEdge = o.gapCenterY - o.gapHeight / 2;
      const bottomEdge = o.gapCenterY + o.gapHeight / 2;
      const distToEdge = Math.min(Math.abs(kurtY - topEdge), Math.abs(kurtY - bottomEdge));
      const nearMiss = distToEdge < DIGNITY.nearMissDistance;
      onPass(nearMiss);
    }
  }
}

const THEME_PALETTE = {
  trees: { body: "#6b4a2c", cap: "#3f8a4a", cap2: "#57a15f" },
  scaffolding: { body: "#9a9a9a", cap: "#d1b13c", cap2: "#7d7d7d" },
  "power-lines": { body: "#4a4a52", cap: "#2c2c33", cap2: "#6a6a72" },
  buildings: { body: "#5b6b82", cap: "#3f4c60", cap2: "#8fa2bd" },
  cacti: { body: "#3f8a5c", cap: "#2f6b46", cap2: "#4fa06c" },
  towers: { body: "#8b8478", cap: "#6b6459", cap2: "#a49b8c" },
  chaos: { body: "#7a4a8a", cap: "#5a3268", cap2: "#9a63ab" },
};

function paletteFor(theme) {
  return THEME_PALETTE[theme] || THEME_PALETTE.trees;
}

export function drawObstacle(ctx, o, worldH, groundH) {
  const pal = paletteFor(o.theme);
  const [top, bottom] = getObstacleRects(o, worldH, groundH);

  drawSegment(ctx, top, pal, o.theme, true);
  drawSegment(ctx, bottom, pal, o.theme, false);

  if (o.hasSpinner) {
    const cx = o.x + o.width / 2;
    const cy = o.gapCenterY;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(o.spinAngle);
    ctx.fillStyle = "#e0331f";
    for (let i = 0; i < 2; i++) {
      ctx.save();
      ctx.rotate(i * Math.PI);
      ctx.fillRect(-4, -o.gapHeight * 0.34, 8, o.gapHeight * 0.34);
      ctx.restore();
    }
    ctx.fillStyle = "#3a3a3a";
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawSegment(ctx, rect, pal, theme, isTop) {
  if (rect.h <= 0) return;
  ctx.fillStyle = pal.body;
  const bodyInset = theme === "power-lines" ? rect.w * 0.32 : 0;
  ctx.fillRect(rect.x + bodyInset, rect.y, rect.w - bodyInset * 2, rect.h);

  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(rect.x + bodyInset, rect.y, (rect.w - bodyInset * 2) * 0.35, rect.h);

  const capY = isTop ? rect.y + rect.h : rect.y;
  const cx = rect.x + rect.w / 2;

  switch (theme) {
    case "trees":
      ctx.fillStyle = pal.cap2;
      for (let i = 0; i < 3; i++) {
        const oy = isTop ? -i * 14 : i * 14;
        ctx.beginPath();
        ctx.arc(cx + (i - 1) * 14, capY + oy, 24 - i * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case "scaffolding": {
      ctx.strokeStyle = pal.cap2;
      ctx.lineWidth = 4;
      for (let y = rect.y + 10; y < rect.y + rect.h; y += 24) {
        ctx.beginPath();
        ctx.moveTo(rect.x, y);
        ctx.lineTo(rect.x + rect.w, y - 16);
        ctx.stroke();
      }
      ctx.fillStyle = pal.cap;
      ctx.fillRect(rect.x - 6, capY - (isTop ? 8 : 0), rect.w + 12, 8);
      break;
    }
    case "power-lines":
      ctx.fillStyle = pal.cap;
      ctx.fillRect(cx - 12, capY - (isTop ? 10 : 0), 24, 10);
      break;
    case "buildings": {
      ctx.fillStyle = "rgba(255,230,140,0.85)";
      const cols = Math.max(1, Math.floor(rect.w / 16));
      for (let cxi = 0; cxi < cols; cxi++) {
        for (let y = rect.y + 8; y < rect.y + rect.h - 6; y += 18) {
          if (Math.random() < 0.001) continue;
          ctx.fillRect(rect.x + 6 + cxi * 16, y, 8, 10);
        }
      }
      ctx.fillStyle = pal.cap;
      ctx.fillRect(rect.x, capY - (isTop ? 6 : 0), rect.w, 6);
      break;
    }
    case "cacti":
      ctx.fillStyle = pal.cap2;
      ctx.beginPath();
      ctx.ellipse(cx, capY + (isTop ? -8 : 8), rect.w * 0.42, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "towers": {
      ctx.fillStyle = pal.cap;
      const teeth = 4;
      const tw = rect.w / teeth;
      for (let i = 0; i < teeth; i++) {
        if (i % 2 === 0) {
          ctx.fillRect(rect.x + i * tw, capY - (isTop ? 10 : 0), tw, 10);
        }
      }
      break;
    }
    default:
      ctx.fillStyle = pal.cap2;
      ctx.beginPath();
      ctx.arc(cx, capY, rect.w * 0.4, 0, Math.PI * 2);
      ctx.fill();
  }
}

export function drawHazard(ctx, h) {
  if (h.kind === "bird") {
    ctx.strokeStyle = "#2b2016";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    const flap = Math.sin(h.wingPhase) * 8;
    ctx.beginPath();
    ctx.moveTo(h.x - 12, h.y - flap);
    ctx.quadraticCurveTo(h.x, h.y - 4, h.x + 12, h.y - flap);
    ctx.stroke();
    ctx.fillStyle = "#f2c9a0";
    ctx.beginPath();
    ctx.arc(h.x, h.y, 7, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "#3a4a3f";
    ctx.beginPath();
    ctx.ellipse(h.x, h.y, 24, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(h.x + 18, h.y - 3, 14, 4);
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2;
    const spin = h.wingPhase * 3;
    ctx.beginPath();
    ctx.moveTo(h.x - 30 * Math.cos(spin), h.y - 16 - 6 * Math.sin(spin));
    ctx.lineTo(h.x + 30 * Math.cos(spin), h.y - 16 + 6 * Math.sin(spin));
    ctx.stroke();
  }
}

export function getHazardCollider(h) {
  return { x: h.x, y: h.y, r: h.kind === "bird" ? 10 : 20 };
}
