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
    minClear: Infinity,
    seed: Math.floor(rand(0, 1e6)),
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

// Tracks how close Kurt's hitbox came to either edge of the gap while he
// was actually inside the obstacle, then reports the pass once he clears it.
export function checkNearMissAndScore(field, kurtX, kurtY, kurtR, onPass) {
  for (const o of field.list) {
    if (o.passed) continue;
    if (kurtX + kurtR > o.x && kurtX - kurtR < o.x + o.width) {
      const topEdge = o.gapCenterY - o.gapHeight / 2;
      const bottomEdge = o.gapCenterY + o.gapHeight / 2;
      const clear = Math.min(kurtY - topEdge, bottomEdge - kurtY) - kurtR;
      if (clear < o.minClear) o.minClear = clear;
    }
    if (o.x + o.width < kurtX - kurtR) {
      o.passed = true;
      onPass(o.minClear < DIGNITY.nearMissDistance, o);
    }
  }
}

export const DEATH_CAUSES = {
  trees: ["Kurt got to know a tree.", "Branch manager Kurt.", "Bark worse than his bite."],
  scaffolding: ["Kurt failed the safety inspection.", "Hard hat area, Kurt.", "OSHA has been notified."],
  "power-lines": ["Kurt got a little too charged up.", "Shockingly bad.", "That's one way to get a perm."],
  buildings: ["Kurt tried to enter through a wall.", "Window shopping, face first.", "Downtown did not want him."],
  cacti: ["Kurt hugged a cactus.", "That's gonna sting for weeks.", "Prickly situation."],
  towers: ["The castle guard said no.", "Siege failed.", "The tower remains unconquered."],
  chaos: ["The void farted back.", "Reality stopped cooperating.", "Too powerful for this world."],
  bird: ["Bonked by a bird.", "The bird had right of way.", "Seagull: 1, Kurt: 0."],
  helicopter: ["Kurt vs helicopter. Helicopter won.", "Airspace violation.", "Chopped."],
  ground: ["Kurt ran out of gas.", "Gravity always wins.", "Crash landing. Face first."],
  ceiling: ["Kurt flew too close to the sun.", "Too much gas. Way too much.", "Houston, we have a smell."],
};

const THEME_PALETTE = {
  trees: { body: "#7a5230", dark: "#5a3a20", cap: "#3f8a4a", cap2: "#5fb56a", hi: "#86d08e" },
  scaffolding: { body: "#a8adb3", dark: "#70767d", cap: "#f2c230", cap2: "#2b2b2b", hi: "#dfe3e8" },
  "power-lines": { body: "#6b5a48", dark: "#4a3d30", cap: "#3a3a42", cap2: "#9fd7ff", hi: "#8d7a66" },
  buildings: { body: "#5b6b82", dark: "#435066", cap: "#3a455a", cap2: "#ffe28a", hi: "#7d8ea8" },
  cacti: { body: "#3f9a5c", dark: "#2c7444", cap: "#2f6b46", cap2: "#ff7fb0", hi: "#6cc58a" },
  towers: { body: "#9b9384", dark: "#716a5d", cap: "#827a6b", cap2: "#5a5347", hi: "#b8b1a2" },
  chaos: { body: "#6a3a8a", dark: "#4a2266", cap: "#c56cff", cap2: "#ff6cf0", hi: "#9a63ab" },
};

const OUTLINE = "rgba(20,24,40,0.55)";

function paletteFor(theme) {
  return THEME_PALETTE[theme] || THEME_PALETTE.trees;
}

// cheap deterministic hash so per-obstacle details don't flicker
function hash(seed, i) {
  const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function drawObstacle(ctx, o, worldH, groundH) {
  const pal = paletteFor(o.theme);
  const [top, bottom] = getObstacleRects(o, worldH, groundH);

  drawSegment(ctx, top, pal, o, true);
  drawSegment(ctx, bottom, pal, o, false);

  if (o.hasSpinner) {
    const cx = o.x + o.width / 2;
    const cy = o.gapCenterY;
    const len = o.gapHeight * 0.34;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(o.spinAngle);
    for (let i = 0; i < 2; i++) {
      ctx.save();
      ctx.rotate(i * Math.PI);
      ctx.fillStyle = "#e0331f";
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      roundRect(ctx, -5, -len, 10, len, 4);
      ctx.fill();
      ctx.stroke();
      // hazard stripes on the blade
      ctx.fillStyle = "#fff";
      for (let y = -len + 8; y < -10; y += 14) ctx.fillRect(-5, y, 10, 5);
      ctx.restore();
    }
    ctx.fillStyle = "#3a3a3a";
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#9a9a9a";
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawSegment(ctx, rect, pal, o, isTop) {
  if (rect.h <= 0) return;
  const theme = o.theme;
  const capY = isTop ? rect.y + rect.h : rect.y;
  const dir = isTop ? -1 : 1; // direction from the gap edge into the body
  const cx = rect.x + rect.w / 2;
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  switch (theme) {
    case "trees": {
      const tw = rect.w * 0.42;
      body(ctx, cx - tw / 2, rect.y, tw, rect.h, pal);
      ctx.strokeStyle = pal.dark;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < rect.h / 26; i++) {
        const y = rect.y + 10 + i * 26 + hash(o.seed, i) * 8;
        ctx.beginPath();
        ctx.moveTo(cx - tw * 0.25, y);
        ctx.quadraticCurveTo(cx, y + 5, cx + tw * 0.1, y + 1);
        ctx.stroke();
      }
      // leafy canopy at the gap end
      // blobs are [dx, depth-into-body, r]; the gap-side edge of every blob
      // stays flush with the hitbox so leaves never look like a free pass
      const blobs = [[-15, 4, 18], [0, 0, 24], [15, 4, 18], [-8, 20, 18], [10, 22, 17]];
      const at = (dy, r) => capY + dir * (r + dy - 2);
      ctx.fillStyle = OUTLINE;
      for (const [dx, dy, r] of blobs) circle(ctx, cx + dx, at(dy, r), r + 2);
      ctx.fillStyle = pal.cap;
      for (const [dx, dy, r] of blobs) circle(ctx, cx + dx, at(dy, r), r);
      ctx.fillStyle = pal.cap2;
      for (const [dx, dy, r] of blobs) circle(ctx, cx + dx - 3, at(dy, r) - 4, r * 0.7);
      ctx.fillStyle = pal.hi;
      circle(ctx, cx - 8, at(0, 24) - 10, 5);
      break;
    }
    case "scaffolding": {
      ctx.strokeStyle = pal.dark;
      ctx.lineWidth = 6;
      line(ctx, rect.x + 5, rect.y, rect.x + 5, rect.y + rect.h);
      line(ctx, rect.x + rect.w - 5, rect.y, rect.x + rect.w - 5, rect.y + rect.h);
      ctx.strokeStyle = pal.body;
      ctx.lineWidth = 4;
      line(ctx, rect.x + 5, rect.y, rect.x + 5, rect.y + rect.h);
      line(ctx, rect.x + rect.w - 5, rect.y, rect.x + rect.w - 5, rect.y + rect.h);
      ctx.lineWidth = 3;
      const step = 34;
      for (let y = rect.y; y < rect.y + rect.h; y += step) {
        line(ctx, rect.x + 5, y, rect.x + rect.w - 5, y);
        line(ctx, rect.x + 5, y, rect.x + rect.w - 5, Math.min(y + step, rect.y + rect.h));
      }
      // hazard-striped plank at the gap
      const py = isTop ? capY - 12 : capY;
      ctx.save();
      roundRect(ctx, rect.x - 8, py, rect.w + 16, 12, 3);
      ctx.fillStyle = pal.cap;
      ctx.fill();
      ctx.clip();
      ctx.fillStyle = pal.cap2;
      for (let x = rect.x - 20; x < rect.x + rect.w + 20; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, py + 12);
        ctx.lineTo(x + 8, py + 12);
        ctx.lineTo(x + 16, py);
        ctx.lineTo(x + 8, py);
        ctx.fill();
      }
      ctx.restore();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      roundRect(ctx, rect.x - 8, py, rect.w + 16, 12, 3);
      ctx.stroke();
      break;
    }
    case "power-lines": {
      const pw = rect.w * 0.3;
      body(ctx, cx - pw / 2, rect.y, pw, rect.h, pal);
      // crossbar with insulators near the gap
      const by = capY + dir * 18;
      ctx.fillStyle = pal.cap;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      roundRect(ctx, rect.x - 6, by - 4, rect.w + 12, 8, 3);
      ctx.fill();
      ctx.stroke();
      for (const dx of [-rect.w / 2 - 2, 0, rect.w / 2 + 2]) {
        ctx.fillStyle = pal.cap2;
        roundRect(ctx, cx + dx - 4, by - dir * 4 - (isTop ? 0 : 10), 8, 10, 3);
        ctx.fill();
        ctx.stroke();
      }
      // sparking tip
      ctx.fillStyle = "#fff6a0";
      const t = performance.now() / 90 + o.seed;
      if (Math.sin(t) > 0.3) {
        ctx.beginPath();
        const sy = capY;
        ctx.moveTo(cx - 6, sy);
        ctx.lineTo(cx + 2, sy - dir * 6);
        ctx.lineTo(cx - 1, sy - dir * 2);
        ctx.lineTo(cx + 7, sy - dir * 9);
        ctx.lineTo(cx, sy - dir * 1);
        ctx.fill();
      }
      break;
    }
    case "buildings": {
      body(ctx, rect.x, rect.y, rect.w, rect.h, pal);
      const cols = 3;
      const ww = 9, wh = 11, gx = (rect.w - cols * ww) / (cols + 1);
      let row = 0;
      const startY = isTop ? rect.y + rect.h - 22 : rect.y + 16;
      for (let y = startY; isTop ? y > rect.y : y < rect.y + rect.h - 8; y += isTop ? -20 : 20) {
        for (let c = 0; c < cols; c++) {
          const lit = hash(o.seed, row * 7 + c) > 0.35;
          ctx.fillStyle = lit ? pal.cap2 : "rgba(20,30,50,0.45)";
          ctx.fillRect(rect.x + gx + c * (ww + gx), y, ww, wh);
        }
        row++;
      }
      ctx.fillStyle = pal.cap;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      roundRect(ctx, rect.x - 4, isTop ? capY - 8 : capY, rect.w + 8, 8, 2);
      ctx.fill();
      ctx.stroke();
      // blinking aircraft-warning light on the corner
      ctx.fillStyle = Math.sin(performance.now() / 300 + o.seed) > 0 ? "#ff4a3a" : "#7a2a24";
      circle(ctx, rect.x + rect.w - 6, capY + dir * 14, 3);
      break;
    }
    case "cacti": {
      const w = rect.w * 0.62;
      const x0 = cx - w / 2;
      body(ctx, x0, rect.y, w, rect.h, pal, w / 2);
      ctx.strokeStyle = pal.dark;
      ctx.lineWidth = 2;
      for (const f of [0.3, 0.7]) line(ctx, x0 + w * f, rect.y + 6, x0 + w * f, rect.y + rect.h - 6);
      // an arm
      const ay = capY + dir * 46;
      const side = hash(o.seed, 3) > 0.5 ? 1 : -1;
      const ax = cx + side * (w / 2);
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.moveTo(ax - side * 4, ay);
      ctx.lineTo(ax + side * 12, ay);
      ctx.lineTo(ax + side * 12, ay - dir * 22);
      ctx.stroke();
      ctx.strokeStyle = pal.body;
      ctx.lineWidth = 12;
      ctx.stroke();
      // spines
      ctx.strokeStyle = "rgba(255,255,220,0.8)";
      ctx.lineWidth = 1;
      for (let i = 0; i < rect.h / 14; i++) {
        const y = rect.y + 8 + i * 14;
        const sx = i % 2 ? x0 : x0 + w;
        const sd = i % 2 ? -1 : 1;
        line(ctx, sx, y, sx + sd * 4, y - 2);
      }
      // flower on the gap end
      ctx.fillStyle = pal.cap2;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        circle(ctx, cx + Math.cos(a) * 5, capY + dir * 9 + Math.sin(a) * 5, 4);
      }
      ctx.fillStyle = "#ffe066";
      circle(ctx, cx, capY + dir * 9, 3);
      break;
    }
    case "towers": {
      body(ctx, rect.x, rect.y, rect.w, rect.h, pal);
      ctx.strokeStyle = pal.dark;
      ctx.lineWidth = 1.2;
      let r = 0;
      for (let y = rect.y + 12; y < rect.y + rect.h; y += 12) {
        line(ctx, rect.x, y, rect.x + rect.w, y);
        for (let x = rect.x + (r % 2 ? 10 : 20); x < rect.x + rect.w; x += 20) line(ctx, x, y - 12, x, y);
        r++;
      }
      // crenellations
      const teeth = 4;
      const tw = (rect.w + 8) / (teeth * 2 - 1);
      ctx.fillStyle = pal.cap;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      for (let i = 0; i < teeth; i++) {
        const x = rect.x - 4 + i * tw * 2;
        roundRect(ctx, x, isTop ? capY - 16 : capY, tw, 16, 2);
        ctx.fill();
        ctx.stroke();
      }
      // arrow slit
      ctx.fillStyle = "#2b2620";
      roundRect(ctx, cx - 3, capY + dir * 40 - 10, 6, 20, 3);
      ctx.fill();
      break;
    }
    default: {
      // chaos: shifting crystal pillars with a watching eye
      body(ctx, rect.x, rect.y, rect.w, rect.h, pal);
      const t = performance.now() / 600 + o.seed;
      ctx.strokeStyle = pal.cap2;
      ctx.globalAlpha = 0.6 + Math.sin(t * 2) * 0.3;
      ctx.lineWidth = 2;
      for (let y = rect.y + ((t * 30) % 30); y < rect.y + rect.h; y += 30) {
        line(ctx, rect.x + 4, y, rect.x + rect.w - 4, y + 10);
      }
      ctx.globalAlpha = 1;
      // crystal tip
      ctx.fillStyle = pal.cap;
      ctx.strokeStyle = OUTLINE;
      ctx.beginPath();
      ctx.moveTo(rect.x - 2, capY + dir * 16);
      ctx.lineTo(cx, capY);
      ctx.lineTo(rect.x + rect.w + 2, capY + dir * 16);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      const ey = capY + dir * 40;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.ellipse(cx, ey, 12, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a0a26";
      circle(ctx, cx + Math.sin(t) * 4, ey, 4);
    }
  }
  ctx.restore();
}

// a filled, outlined column with a light edge and a shaded edge
function body(ctx, x, y, w, h, pal, radius = 0) {
  ctx.fillStyle = pal.body;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, radius);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = pal.dark;
  ctx.globalAlpha = 0.55;
  ctx.fillRect(x + w * 0.68, y, w * 0.32, h);
  ctx.fillStyle = pal.hi;
  ctx.globalAlpha = 0.5;
  ctx.fillRect(x + w * 0.1, y, w * 0.12, h);
  ctx.restore();
  roundRect(ctx, x, y, w, h, radius);
  ctx.stroke();
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  if (r <= 0) {
    ctx.rect(x, y, w, h);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

export function drawHazard(ctx, h) {
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (h.kind === "bird") {
    // a grumpy seagull flying at Kurt
    const flap = Math.sin(h.wingPhase);
    ctx.translate(h.x, h.y);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    // back wing
    ctx.fillStyle = "#c9d1d9";
    wing(ctx, 4, -2, flap * 0.9);
    ctx.fillStyle = "#f4f6f8";
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // tail
    ctx.beginPath();
    ctx.moveTo(12, -2);
    ctx.lineTo(20, -5);
    ctx.lineTo(19, 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // head + beak
    ctx.beginPath();
    ctx.arc(-11, -5, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffb020";
    ctx.beginPath();
    ctx.moveTo(-17, -6);
    ctx.lineTo(-25, -3);
    ctx.lineTo(-17, -2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#1a1a1a";
    circle(ctx, -13, -7, 1.6);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 1.5;
    line(ctx, -16, -11, -10, -9); // angry brow
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.fillStyle = "#e2e8ee";
    wing(ctx, -1, -3, flap);
  } else {
    ctx.translate(h.x, h.y);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    // tail boom + rotor
    ctx.fillStyle = "#c0392b";
    roundRect(ctx, 10, -4, 26, 6, 3);
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.translate(36, -2);
    ctx.rotate(h.wingPhase * 3);
    ctx.fillStyle = "rgba(60,60,60,0.7)";
    ctx.fillRect(-8, -1.5, 16, 3);
    ctx.restore();
    // body
    ctx.fillStyle = "#e74c3c";
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#aee3ff";
    ctx.beginPath();
    ctx.ellipse(-9, -2, 10, 8, 0, Math.PI * 0.9, Math.PI * 2.1);
    ctx.fill();
    ctx.stroke();
    // skids
    ctx.strokeStyle = "#333";
    line(ctx, -14, 17, 12, 17);
    line(ctx, -8, 12, -8, 17);
    line(ctx, 6, 12, 6, 17);
    // main rotor blur
    ctx.strokeStyle = OUTLINE;
    line(ctx, 0, -13, 0, -18);
    const spin = Math.cos(h.wingPhase * 3);
    ctx.fillStyle = "rgba(40,40,40,0.25)";
    ctx.beginPath();
    ctx.ellipse(0, -19, 34, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(40,40,40,0.8)";
    ctx.lineWidth = 3;
    line(ctx, -34 * spin, -19, 34 * spin, -19);
  }
  ctx.restore();
}

function wing(ctx, x, y, flap) {
  ctx.beginPath();
  ctx.moveTo(x - 6, y);
  ctx.quadraticCurveTo(x, y - 22 * flap - 4, x + 10, y - 18 * flap);
  ctx.quadraticCurveTo(x + 6, y, x + 6, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

export function getHazardCollider(h) {
  return { x: h.x, y: h.y, r: h.kind === "bird" ? 10 : 20 };
}
