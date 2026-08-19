import { createGame } from "./game.js";
import { getAudioDebugInfo } from "./audio.js";

function setAppHeight() {
  document.documentElement.style.setProperty("--app-height", `${window.innerHeight}px`);
}
setAppHeight();
window.addEventListener("resize", setAppHeight);
window.addEventListener("orientationchange", setAppHeight);

const canvas = document.getElementById("game-canvas");
const stage = document.getElementById("stage");

const game = createGame(canvas, stage);
game.init();

if (new URLSearchParams(location.search).has("audiodebug")) {
  const wrap = document.createElement("div");
  wrap.style.cssText =
    "position:fixed;top:0;left:0;right:0;z-index:9999;" +
    "background:rgba(0,0,0,0.85);padding:8px;";

  const btnRow = document.createElement("div");
  btnRow.style.cssText = "display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap;";

  const toneBtn = document.createElement("button");
  toneBtn.textContent = "PLAY RAW TONE";
  toneBtn.style.cssText = "font:12px monospace;padding:8px;";
  toneBtn.addEventListener("click", () => {
    // Bypasses audio.js entirely: no mute gain, no envelopes, no filters.
    // If this is silent, the problem is device/OS-level, not this game's code.
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const c = new AC();
      c.resume().catch(() => {});
      const osc = c.createOscillator();
      const g = c.createGain();
      g.gain.value = 0.3;
      osc.type = "sine";
      osc.frequency.value = 440;
      osc.connect(g);
      g.connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + 1);
      toneBtn.textContent = "PLAYED (check ears)";
      setTimeout(() => (toneBtn.textContent = "PLAY RAW TONE"), 1500);
    } catch (e) {
      toneBtn.textContent = "TONE ERROR: " + e.message;
    }
  });

  const unmuteBtn = document.createElement("button");
  unmuteBtn.textContent = "FORCE UNMUTE";
  unmuteBtn.style.cssText = "font:12px monospace;padding:8px;";
  unmuteBtn.addEventListener("click", () => {
    game.forceUnmute();
  });

  btnRow.appendChild(toneBtn);
  btnRow.appendChild(unmuteBtn);
  wrap.appendChild(btnRow);

  const panel = document.createElement("pre");
  panel.style.cssText =
    "margin:0;color:#0f0;font:10px/1.4 monospace;" +
    "white-space:pre-wrap;word-break:break-all;max-height:35vh;overflow:auto;";
  wrap.appendChild(panel);
  document.body.appendChild(wrap);

  setInterval(() => {
    const info = getAudioDebugInfo();
    panel.textContent = Object.entries(info)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
  }, 250);
}
