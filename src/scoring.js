export function createScoring() {
  return {
    distancePx: 0,
    meters: 0,
    farts: 0,
    thrustSum: 0,
    streak: 0,
    bestStreak: 0,
    dignity: 100,
  };
}

export function resetScoring(s) {
  s.distancePx = 0;
  s.meters = 0;
  s.farts = 0;
  s.thrustSum = 0;
  s.streak = 0;
  s.bestStreak = 0;
  s.dignity = 100;
}

export function addDistance(s, px, pxPerMeter) {
  s.distancePx += px;
  s.meters = s.distancePx / pxPerMeter;
}

export function registerFart(s, intensity) {
  s.farts += 1;
  s.thrustSum += intensity;
}

export function registerPass(s, nearMiss) {
  if (nearMiss) {
    s.streak = 0;
  } else {
    s.streak += 1;
    if (s.streak > s.bestStreak) s.bestStreak = s.streak;
  }
}

export function loseDignity(s, amount) {
  s.dignity = Math.max(0, s.dignity - amount);
}

export function gainDignity(s, amount) {
  s.dignity = Math.min(100, s.dignity + amount);
}

export function getEfficiency(s) {
  if (s.farts === 0) return 100;
  const metersPerFart = s.meters / s.farts;
  const pct = Math.round((metersPerFart / 6) * 100);
  return Math.max(0, Math.min(100, pct));
}
