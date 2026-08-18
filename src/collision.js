import { circleRectOverlap, circleCircleOverlap } from "./utils.js";

export function kurtHitsRects(kurt, rects) {
  for (const r of rects) {
    if (r.h <= 0) continue;
    if (circleRectOverlap(kurt.x, kurt.y, kurt.r, r.x, r.y, r.w, r.h)) return true;
  }
  return false;
}

export function kurtHitsSpinner(kurt, points) {
  for (const p of points) {
    if (circleCircleOverlap(kurt.x, kurt.y, kurt.r, p.x, p.y, p.r * 0.75)) return true;
  }
  return false;
}

export function kurtHitsCircle(kurt, c) {
  return circleCircleOverlap(kurt.x, kurt.y, kurt.r, c.x, c.y, c.r * 0.82);
}

export function kurtOutOfBounds(kurt, worldH, groundH) {
  const playH = worldH - groundH;
  return kurt.y - kurt.r < -4 || kurt.y + kurt.r > playH;
}
