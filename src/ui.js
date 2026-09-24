import { COSMETICS } from "./config.js";

const els = {};
let gradeToastTimer = null;
let nearMissTimer = null;
let countUpRaf = 0;

const OVER_TITLES = [
  "Oh no u pooted!",
  "Pbbbbbt.",
  "Gas leak detected.",
  "Well, that stinks.",
  "Rest in pieces.",
  "Tooted and booted.",
];

const COSMETIC_ICONS = {
  classic: "💨",
  business: "👔",
  cowboy: "🤠",
  viking: "🪓",
  disco: "🕺",
  greek: "🌿",
  astro: "👨‍🚀",
};

export function initUI(handlers) {
  els.start = document.getElementById("start-screen");
  els.gameover = document.getElementById("gameover-screen");
  els.hud = document.getElementById("hud");
  els.btnStart = document.getElementById("btn-start");
  els.btnRestart = document.getElementById("btn-restart");
  els.btnHome = document.getElementById("btn-home");
  els.btnMute = document.getElementById("btn-mute");
  els.cosmeticRow = document.getElementById("cosmetic-row");
  els.metaBest = document.getElementById("meta-best");
  els.metaGrade = document.getElementById("meta-grade");
  els.metaFarts = document.getElementById("meta-farts");
  els.cosmeticName = document.getElementById("cosmetic-name");
  els.btnMusic = document.getElementById("btn-music");
  els.btnPause = document.getElementById("btn-pause");
  els.btnResume = document.getElementById("btn-resume");
  els.btnQuit = document.getElementById("btn-quit");
  els.btnShare = document.getElementById("btn-share");
  els.pause = document.getElementById("pause-screen");
  els.ready = document.getElementById("ready-prompt");
  els.deathCause = document.getElementById("death-cause");
  els.pbDiff = document.getElementById("pb-diff");
  els.unlockBanner = document.getElementById("unlock-banner");
  els.statClose = document.getElementById("stat-close");

  els.hudDistance = document.getElementById("hud-distance-val");
  els.hudGrade = document.getElementById("hud-grade-code");
  els.dignityFill = document.getElementById("dignity-fill");
  els.powerupIndicator = document.getElementById("powerup-indicator");
  els.powerupName = document.getElementById("powerup-name");
  els.powerupFill = document.getElementById("powerup-fill");

  els.gradeToast = document.getElementById("grade-toast");
  els.toastCode = document.getElementById("toast-code");
  els.toastName = document.getElementById("toast-name");
  els.nearMissToast = document.getElementById("near-miss-toast");

  els.overTitle = document.querySelector("#gameover-screen .over-title");
  els.pbBanner = document.getElementById("pb-banner");
  els.statDistance = document.getElementById("stat-distance");
  els.statFarts = document.getElementById("stat-farts");
  els.statEfficiency = document.getElementById("stat-efficiency");
  els.statStreak = document.getElementById("stat-streak");
  els.statDignity = document.getElementById("stat-dignity");
  els.statGrade = document.getElementById("stat-grade");
  els.dignityQuip = document.getElementById("dignity-quip");

  els.btnStart.addEventListener("click", (e) => {
    e.preventDefault();
    handlers.onStart();
  });
  els.btnRestart.addEventListener("click", (e) => {
    e.preventDefault();
    handlers.onRestart();
  });
  els.btnHome.addEventListener("click", (e) => {
    e.preventDefault();
    handlers.onHome();
  });
  els.btnMute.addEventListener("click", (e) => {
    e.preventDefault();
    handlers.onToggleMute();
  });
  els.btnMusic.addEventListener("click", (e) => {
    e.preventDefault();
    handlers.onToggleMusic();
  });
  // pointerdown so the tap can't fall through and count as a fart
  els.btnPause.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    handlers.onPause();
  });
  els.btnResume.addEventListener("click", (e) => {
    e.preventDefault();
    handlers.onResume();
  });
  els.btnQuit.addEventListener("click", (e) => {
    e.preventDefault();
    handlers.onQuit();
  });
  els.btnShare.addEventListener("click", (e) => {
    e.preventDefault();
    handlers.onShare();
  });
}

export function renderCosmeticRow(selectedId, bestMeters, onSelect) {
  els.cosmeticRow.innerHTML = "";
  for (const c of COSMETICS) {
    const unlocked = bestMeters >= c.unlockMeters;
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "cosmetic-chip" + (c.id === selectedId ? " selected" : "") + (unlocked ? "" : " locked");
    chip.setAttribute("aria-label", c.name + (unlocked ? "" : " (locked)"));
    chip.innerHTML = `<span>${COSMETIC_ICONS[c.id] || "💨"}</span>${unlocked ? "" : '<span class="lock-badge">🔒</span>'}`;
    if (unlocked) {
      chip.addEventListener("click", () => onSelect(c.id));
    } else {
      chip.addEventListener("click", () => {
        els.cosmeticName.textContent = `REACH ${c.unlockMeters}m TO UNLOCK`;
      });
    }
    if (c.id === selectedId) els.cosmeticName.textContent = c.name.toUpperCase();
    els.cosmeticRow.appendChild(chip);
  }
}

export function setMuteLabel(muted) {
  els.btnMute.textContent = muted ? "SOUND: OFF" : "SOUND: ON";
  els.btnMute.setAttribute("aria-pressed", String(muted));
}

export function setMusicLabel(muted) {
  els.btnMusic.textContent = muted ? "MUSIC: OFF" : "MUSIC: ON";
  els.btnMusic.setAttribute("aria-pressed", String(muted));
}

export function showReady() {
  els.ready.classList.remove("hidden");
}

export function hideReady() {
  els.ready.classList.add("hidden");
}

export function showPause() {
  els.pause.classList.remove("hidden");
}

export function hidePause() {
  els.pause.classList.add("hidden");
}

export function isGameOverVisible() {
  return !els.gameover.classList.contains("hidden");
}

export function showStart(bestMeters, highestGradeCode, lifetimeFarts) {
  els.start.classList.remove("hidden");
  els.gameover.classList.add("hidden");
  els.pause.classList.add("hidden");
  els.hud.classList.add("hidden");
  els.ready.classList.add("hidden");
  els.metaBest.textContent = Math.floor(bestMeters) + "m";
  els.metaGrade.textContent = highestGradeCode;
  els.metaFarts.textContent = lifetimeFarts.toLocaleString();
}

export function hideStart() {
  els.start.classList.add("hidden");
}

export function showHud() {
  els.hud.classList.remove("hidden");
}

export function hideHud() {
  els.hud.classList.add("hidden");
}

export function updateHud(meters, gradeCode, dignityPct, activePowerup) {
  els.hudDistance.textContent = Math.floor(meters);
  els.hudGrade.textContent = gradeCode;
  els.dignityFill.style.width = clampPct(dignityPct) + "%";
  if (dignityPct <= 25) {
    els.dignityFill.style.background = "#ff5a3c";
  } else {
    els.dignityFill.style.background = "";
  }
  if (activePowerup) {
    els.powerupIndicator.classList.remove("hidden");
    els.powerupName.textContent = activePowerup.def.label;
    els.powerupFill.style.width = clampPct((activePowerup.timeLeft / activePowerup.duration) * 100) + "%";
    els.powerupIndicator.classList.toggle("ending", activePowerup.timeLeft < 1.5);
  } else {
    els.powerupIndicator.classList.add("hidden");
  }
}

function clampPct(v) {
  return Math.max(0, Math.min(100, v));
}

export function flashGradeToast(code, name) {
  els.toastCode.textContent = code;
  els.toastName.textContent = name.toUpperCase();
  els.gradeToast.classList.remove("hidden");
  requestAnimationFrame(() => els.gradeToast.classList.add("show"));
  clearTimeout(gradeToastTimer);
  gradeToastTimer = setTimeout(() => {
    els.gradeToast.classList.remove("show");
    setTimeout(() => els.gradeToast.classList.add("hidden"), 250);
  }, 1700);
}

export function flashNearMiss() {
  els.nearMissToast.classList.remove("hidden");
  requestAnimationFrame(() => els.nearMissToast.classList.add("show"));
  clearTimeout(nearMissTimer);
  nearMissTimer = setTimeout(() => {
    els.nearMissToast.classList.remove("show");
    setTimeout(() => els.nearMissToast.classList.add("hidden"), 250);
  }, 550);
}

export function showGameOver(stats, isNewBest, { cause, prevBest, unlocked, onTick } = {}) {
  els.hud.classList.add("hidden");
  els.ready.classList.add("hidden");
  els.gameover.classList.remove("hidden");
  els.overTitle.textContent = OVER_TITLES[Math.floor(Math.random() * OVER_TITLES.length)];
  els.deathCause.textContent = cause || "";
  els.pbBanner.classList.add("hidden");
  els.pbBanner.textContent = "NEW PERSONAL BEST";
  const shortBy = Math.ceil(prevBest - stats.meters);
  els.pbDiff.classList.toggle("hidden", isNewBest || !(prevBest > 0));
  els.pbDiff.textContent = shortBy <= 25 ? `SO CLOSE! ${shortBy}m SHORT OF YOUR BEST` : `BEST: ${Math.floor(prevBest)}m`;
  els.unlockBanner.classList.toggle("hidden", !unlocked);
  els.unlockBanner.textContent = unlocked ? `UNLOCKED: ${unlocked.name.toUpperCase()}!` : "";

  // tick the distance up like a slot machine, then reveal the PB banner
  cancelAnimationFrame(countUpRaf);
  const target = Math.floor(stats.meters);
  const dur = Math.min(1100, 350 + target * 1.5);
  const t0 = performance.now();
  let lastShown = -1;
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    const v = Math.round(target * (1 - Math.pow(1 - k, 3)));
    els.statDistance.textContent = v;
    if (onTick && v !== lastShown && k < 1 && Math.floor(v / Math.max(1, target / 14)) !== Math.floor(lastShown / Math.max(1, target / 14))) onTick(k);
    lastShown = v;
    if (k < 1) countUpRaf = requestAnimationFrame(step);
    else if (isNewBest) els.pbBanner.classList.remove("hidden");
  };
  countUpRaf = requestAnimationFrame(step);
  els.statClose.textContent = stats.closeCalls;
  els.statFarts.textContent = stats.farts;
  els.statEfficiency.textContent = stats.efficiency + "%";
  els.statStreak.textContent = stats.bestStreak;
  els.statDignity.textContent = Math.round(stats.dignity) + "%";
  els.statGrade.textContent = stats.gradeCode;
  els.dignityQuip.classList.toggle("hidden", stats.dignity > 0);
}

export function hideGameOver() {
  els.gameover.classList.add("hidden");
}
