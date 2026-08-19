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
  const panel = document.createElement("pre");
  panel.style.cssText =
    "position:fixed;top:0;left:0;right:0;z-index:9999;margin:0;padding:8px;" +
    "background:rgba(0,0,0,0.85);color:#0f0;font:10px/1.4 monospace;" +
    "white-space:pre-wrap;word-break:break-all;pointer-events:none;max-height:45vh;overflow:auto;";
  document.body.appendChild(panel);
  setInterval(() => {
    const info = getAudioDebugInfo();
    panel.textContent = Object.entries(info)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
  }, 250);
}
