import { createGame } from "./game.js";

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
