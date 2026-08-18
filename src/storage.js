import { STORAGE_KEYS } from "./config.js";

let available = true;
try {
  const t = "__kurt_test__";
  localStorage.setItem(t, "1");
  localStorage.removeItem(t);
} catch (e) {
  available = false;
}

function get(key, fallback) {
  if (!available) return fallback;
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch (e) {
    return fallback;
  }
}

function set(key, value) {
  if (!available) return;
  try {
    localStorage.setItem(key, String(value));
  } catch (e) {
    /* ignore quota/private-mode errors */
  }
}

export const storage = {
  getBestDistance: () => Number(get(STORAGE_KEYS.best, 0)) || 0,
  setBestDistance: (m) => set(STORAGE_KEYS.best, Math.floor(m)),

  getBestStreak: () => Number(get(STORAGE_KEYS.bestStreak, 0)) || 0,
  setBestStreak: (s) => set(STORAGE_KEYS.bestStreak, Math.floor(s)),

  getHighestGrade: () => get(STORAGE_KEYS.grade, "F0"),
  setHighestGrade: (code) => set(STORAGE_KEYS.grade, code),

  getLifetimeFarts: () => Number(get(STORAGE_KEYS.farts, 0)) || 0,
  addLifetimeFarts: (n) => set(STORAGE_KEYS.farts, storage.getLifetimeFarts() + n),

  getMuted: () => get(STORAGE_KEYS.muted, "0") === "1",
  setMuted: (m) => set(STORAGE_KEYS.muted, m ? "1" : "0"),

  getCosmetic: () => get(STORAGE_KEYS.cosmetic, "classic"),
  setCosmetic: (id) => set(STORAGE_KEYS.cosmetic, id),
};
