import { COSMETICS } from "./config.js";

const els = {};
let gradeToastTimer = null;
let nearMissTimer = null;

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
  els.btnMute = document.getElementById("btn-mute");
  els.cosmeticRow = document.getElementById("cosmetic-row");
  els.metaBest = document.getElementById("meta-best");
  els.metaGrade = document.getElementById("meta-grade");

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

  els.overTitle = document.querySelector(".over-title");
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
  els.btnMute.addEventListener("click", (e) => {
    e.preventDefault();
    handlers.onToggleMute();
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
    }
    els.cosmeticRow.appendChild(chip);
  }
}

export function setMuteLabel(muted) {
  els.btnMute.textContent = muted ? "SOUND: OFF" : "SOUND: ON";
  els.btnMute.setAttribute("aria-pressed", String(muted));
}

export function showStart(bestMeters, highestGradeCode) {
  els.start.classList.remove("hidden");
  els.gameover.classList.add("hidden");
  els.hud.classList.add("hidden");
  els.metaBest.textContent = Math.floor(bestMeters) + "m";
  els.metaGrade.textContent = highestGradeCode;
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

export function showGameOver(stats, isNewBest) {
  els.hud.classList.add("hidden");
  els.gameover.classList.remove("hidden");
  els.pbBanner.classList.toggle("hidden", !isNewBest);
  els.pbBanner.textContent = isNewBest ? "NEW PERSONAL BEST" : "";
  els.statDistance.textContent = Math.floor(stats.meters) + "m";
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
