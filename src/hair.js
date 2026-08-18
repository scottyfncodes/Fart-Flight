const STRAND_COUNT = 7;
const REST_LENGTHS = [6, 5, 3.5, 2.5];
const DAMPING = 0.9;

function createStrand(offsetX, offsetY, lenScale) {
  const points = [];
  for (let i = 0; i < REST_LENGTHS.length + 1; i++) {
    points.push({ x: 0, y: 0, px: 0, py: 0 });
  }
  return { points, offsetX, offsetY, lenScale };
}

export function createHair() {
  const strands = [];
  const n = STRAND_COUNT;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1) - 0.5;
    // mildly biased toward the back of the scalp, leaving a little forehead bare
    strands.push(createStrand(-6 + t * 13, -Math.abs(t) * 4 - 1, 1 - Math.abs(t) * 0.3));
  }
  return { strands };
}

export function resetHair(hair, x, y) {
  for (const s of hair.strands) {
    const rootX = x + s.offsetX;
    const rootY = y + s.offsetY;
    for (let i = 0; i < s.points.length; i++) {
      const p = s.points[i];
      p.x = rootX + s.offsetX * 0.15 * i;
      p.y = rootY - i * 3;
      p.px = p.x;
      p.py = p.y;
    }
  }
}

export function burstHair(hair, dirX, dirY, strength) {
  for (const s of hair.strands) {
    for (let i = 1; i < s.points.length; i++) {
      const p = s.points[i];
      const falloff = 1 - i / s.points.length;
      p.px -= dirX * strength * falloff * 0.05;
      p.py -= dirY * strength * falloff * 0.05;
    }
  }
}

export function updateHair(hair, dt, anchorX, anchorY, kurtVy, scrollSpeed) {
  const ax = -scrollSpeed * 0.7;
  const ay = kurtVy * 0.3 + 160;
  const clampedDt = Math.min(dt, 1 / 30);

  for (const s of hair.strands) {
    const pts = s.points;
    pts[0].px = pts[0].x;
    pts[0].py = pts[0].y;
    pts[0].x = anchorX + s.offsetX;
    pts[0].y = anchorY + s.offsetY;

    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      const vx = (p.x - p.px) * DAMPING;
      const vy = (p.y - p.py) * DAMPING;
      p.px = p.x;
      p.py = p.y;
      p.x += vx + ax * clampedDt * clampedDt;
      p.y += vy + ay * clampedDt * clampedDt;
    }

    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const p = pts[i];
      const dx = p.x - prev.x;
      const dy = p.y - prev.y;
      const dist = Math.hypot(dx, dy) || 0.0001;
      const target = REST_LENGTHS[i - 1] * s.lenScale;
      const diff = (dist - target) / dist;
      p.x -= dx * diff;
      p.y -= dy * diff;
    }
  }
}

export function drawHair(ctx, hair, baseColor, highlightColor) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const s of hair.strands) {
    const pts = s.points;
    ctx.strokeStyle = baseColor;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2;
      const my = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.stroke();

    ctx.strokeStyle = highlightColor;
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[Math.floor(pts.length / 2)].x, pts[Math.floor(pts.length / 2)].y);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}
