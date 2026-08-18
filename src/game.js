import { PHYSICS, SCROLL, DIGNITY, COSMETICS, WORLD } from "./config.js";
import { clamp, rand } from "./utils.js";
import * as audio from "./audio.js";
import { storage } from "./storage.js";
import {
  createParticleSystem,
  spawnFartBurst,
  spawnSparkles,
  updateParticles,
  drawParticles,
} from "./particles.js";
import { createKurt, resetKurt, beginThrust, endThrust, pulseFart, updateKurt, getHitCircle, getButtPosition, drawKurt } from "./kurt.js";
import {
  createObstacleField,
  resetObstacleField,
  updateObstacles,
  getObstacleRects,
  getSpinnerPoints,
  checkNearMissAndScore,
  drawObstacle,
  drawHazard,
  getHazardCollider,
} from "./obstacles.js";
import {
  createPowerupField,
  resetPowerupField,
  maybeSpawnPowerup,
  updatePowerups,
  tryCollectPowerups,
  getActiveModifiers,
  drawPowerups,
} from "./powerups.js";
import { createBackground, resizeBackground, updateBackground, drawBackground } from "./background.js";
import { createScoring, resetScoring, addDistance, registerFart, registerPass, loseDignity, gainDignity, getEfficiency } from "./scoring.js";
import { getGradeForMeters, getGradeIndex } from "./progression.js";
import { kurtHitsRects, kurtHitsSpinner, kurtHitsCircle, kurtOutOfBounds } from "./collision.js";
import { createInputHandler } from "./input.js";
import * as ui from "./ui.js";

const GROUND_H = 34;

export function createGame(canvas, stageEl) {
  const ctx = canvas.getContext("2d");

  let worldW = 0;
  let worldH = 0;
  let dpr = 1;

  const kurt = createKurt();
  const obstacles = createObstacleField();
  const powerupField = createPowerupField();
  const particles = createParticleSystem();
  const background = createBackground(0, 0);
  const scoring = createScoring();

  let state = "start";
  let scrollSpeed = SCROLL.baseSpeed;
  let shownGradeIndex = 0;
  let shake = { t: 0, dur: 0.001, mag: 0 };
  let idleTime = 0;
  let idleTapTimer = 1.4;
  let fartTickTimer = 0;
  let giggleTimer = 0;
  let cosmeticId = storage.getCosmetic();
  let lastTime = 0;
  let running = false;

  function currentCosmetic() {
    return COSMETICS.find((c) => c.id === cosmeticId) || COSMETICS[0];
  }

  function resize() {
    worldW = stageEl.clientWidth;
    worldH = stageEl.clientHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.max(1, Math.round(worldW * dpr));
    canvas.height = Math.max(1, Math.round(worldH * dpr));
    canvas.style.width = worldW + "px";
    canvas.style.height = worldH + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    resizeBackground(background, worldW, worldH);
    kurt.x = worldW * PHYSICS.kurtX;
    if (state !== "playing") kurt.y = worldH * 0.42;
  }

  function fullReset() {
    resetScoring(scoring);
    resetObstacleField(obstacles);
    resetPowerupField(powerupField);
    particles.puffs.length = 0;
    particles.bits.length = 0;
    particles.sparkles.length = 0;
    resetKurt(kurt, worldW * PHYSICS.kurtX, worldH * 0.42, currentCosmetic());
    scrollSpeed = SCROLL.baseSpeed;
    shownGradeIndex = 0;
    giggleTimer = 0;
  }

  function fartTick(intensity) {
    const clamped = clamp(intensity, 0.3, 1.6);
    registerFart(scoring, clamped);
    audio.playFart(clamped);
    const butt = getButtPosition(kurt);
    spawnFartBurst(particles, butt.x, butt.y, clamped, 91);
    pulseFart(kurt, clamped);
    if (clamped > 0.85) triggerShake(0.12, 4 * clamped);
  }

  function maybeGiggle() {
    if (giggleTimer > 0) return;
    audio.playGiggle();
    giggleTimer = rand(1.6, 3.2);
  }

  function beginPlay() {
    audio.initAudio();
    fullReset();
    state = "playing";
    ui.hideStart();
    ui.hideGameOver();
    ui.showHud();
    audio.startWind();
    input.setEnabled(true);
    fartTick(0.8);
  }

  function triggerShake(dur, mag) {
    shake = { t: dur, dur, mag };
  }

  function endGame() {
    if (state !== "playing") return;
    state = "gameover";
    endThrust(kurt);
    input.setEnabled(false);
    audio.stopWind();
    audio.playImpact();
    triggerShake(0.35, 10);
    kurt.squash = 1;
    loseDignity(scoring, DIGNITY.collisionLoss);

    const grade = getGradeForMeters(scoring.meters);
    const efficiency = getEfficiency(scoring);
    const prevBest = storage.getBestDistance();
    const isNewBest = scoring.meters > prevBest;
    if (isNewBest) storage.setBestDistance(scoring.meters);
    if (scoring.bestStreak > storage.getBestStreak()) storage.setBestStreak(scoring.bestStreak);
    if (getGradeIndex(grade.code) > getGradeIndex(storage.getHighestGrade())) {
      storage.setHighestGrade(grade.code);
    }
    storage.addLifetimeFarts(scoring.farts);

    setTimeout(() => {
      ui.showGameOver(
        {
          meters: scoring.meters,
          farts: scoring.farts,
          efficiency,
          bestStreak: scoring.bestStreak,
          dignity: scoring.dignity,
          gradeCode: grade.code,
        },
        isNewBest
      );
      if (isNewBest) audio.playHighScore();
    }, 220);
  }

  function handleDown() {
    audio.initAudio();
    if (state !== "playing") return;
    beginThrust(kurt);
    fartTickTimer = 0;
    maybeGiggle();
  }

  function handleUp() {
    if (state !== "playing") return;
    endThrust(kurt);
  }

  const input = createInputHandler(canvas, handleDown, handleUp);
  input.setEnabled(false);

  function updateIdleStart(dt) {
    idleTime += dt;
    idleTapTimer -= dt;
    if (idleTapTimer <= 0) {
      if (kurt.thrusting) {
        endThrust(kurt);
        idleTapTimer = rand(1.1, 1.6);
      } else {
        beginThrust(kurt);
        const butt = getButtPosition(kurt);
        spawnFartBurst(particles, butt.x, butt.y, 0.6, 91);
        maybeGiggle();
        idleTapTimer = rand(0.5, 0.8);
      }
    }
    updateKurt(kurt, dt, 0.5, 50, 0.7);
    if (kurt.y > worldH * 0.75 || kurt.y < worldH * 0.12) {
      kurt.y = worldH * 0.42;
      kurt.vy = 0;
      endThrust(kurt);
    }
    if (giggleTimer > 0) giggleTimer -= dt;
    updateBackground(background, dt, 40, 0);
    updateParticles(particles, dt);
  }

  function updatePlaying(dt) {
    const mods = getActiveModifiers(powerupField);
    scrollSpeed = clamp(
      SCROLL.baseSpeed + scoring.meters * SCROLL.speedGrowthPerMeter,
      SCROLL.baseSpeed,
      SCROLL.maxSpeed
    ) * mods.speedMult;

    updateKurt(kurt, dt, mods.gravityMult, scrollSpeed, mods.thrustMult);

    if (kurt.thrusting) {
      fartTickTimer -= dt;
      if (fartTickTimer <= 0) {
        fartTick(rand(0.55, 0.85) * mods.thrustMult);
        fartTickTimer = PHYSICS.fartTickInterval;
      }
    } else {
      fartTickTimer = 0;
    }
    if (giggleTimer > 0) giggleTimer -= dt;

    addDistance(scoring, scrollSpeed * dt, WORLD.pxPerMeter);
    updateBackground(background, dt, scrollSpeed, scoring.meters);
    updateObstacles(obstacles, dt, scrollSpeed, worldW, worldH, GROUND_H, scoring.meters);
    maybeSpawnPowerup(powerupField, dt, worldW, worldH, GROUND_H, scoring.meters);
    updatePowerups(powerupField, dt, scrollSpeed);
    updateParticles(particles, dt);
    audio.setWindIntensity(clamp(Math.abs(kurt.vy) / 700, 0, 1));

    const hit = getHitCircle(kurt);
    let collided = kurtOutOfBounds(hit, worldH, GROUND_H);

    if (!collided) {
      for (const o of obstacles.list) {
        const rects = getObstacleRects(o, worldH, GROUND_H);
        if (kurtHitsRects(hit, rects)) {
          collided = true;
          break;
        }
        if (o.hasSpinner && kurtHitsSpinner(hit, getSpinnerPoints(o))) {
          collided = true;
          break;
        }
      }
    }
    if (!collided) {
      for (const h of obstacles.hazards) {
        if (kurtHitsCircle(hit, getHazardCollider(h))) {
          collided = true;
          break;
        }
      }
    }

    checkNearMissAndScore(obstacles, kurt.x, kurt.y, (nearMiss) => {
      registerPass(scoring, nearMiss);
      if (nearMiss) {
        loseDignity(scoring, DIGNITY.nearMissLoss);
        ui.flashNearMiss();
        audio.playNearMiss();
      }
    });

    tryCollectPowerups(
      powerupField,
      kurt.x,
      kurt.y,
      hit.r,
      (key, def) => {
        audio.playPowerUp();
        spawnSparkles(particles, kurt.x, kurt.y, def.color);
      },
      (key, def) => {
        audio.playPowerUp();
        gainDignity(scoring, def.dignityBonus || 0);
        spawnSparkles(particles, kurt.x, kurt.y, def.color);
      }
    );

    const grade = getGradeForMeters(scoring.meters);
    const idx = getGradeIndex(grade.code);
    if (idx > shownGradeIndex) {
      shownGradeIndex = idx;
      ui.flashGradeToast(grade.code, grade.name);
      audio.playGradeUp();
      triggerShake(0.2, 4);
    }

    ui.updateHud(scoring.meters, grade.code, scoring.dignity, powerupField.active);

    if (shake.t > 0) shake.t = Math.max(0, shake.t - dt);

    if (collided) endGame();
  }

  function updateGameOver(dt) {
    updateParticles(particles, dt);
    if (shake.t > 0) shake.t = Math.max(0, shake.t - dt);
    kurt.squash = Math.max(0, kurt.squash - dt * 3);
  }

  function update(dt) {
    if (state === "start") updateIdleStart(dt);
    else if (state === "playing") updatePlaying(dt);
    else updateGameOver(dt);
  }

  function draw() {
    ctx.save();
    if (shake.t > 0) {
      const m = shake.mag * (shake.t / shake.dur);
      ctx.translate(rand(-m, m), rand(-m, m));
    }
    const metersForBg = state === "start" ? 0 : scoring.meters;
    drawBackground(ctx, background, metersForBg, GROUND_H);

    if (state !== "start") {
      drawPowerups(ctx, powerupField);
      for (const o of obstacles.list) drawObstacle(ctx, o, worldH, GROUND_H);
      for (const h of obstacles.hazards) drawHazard(ctx, h);
    }

    drawKurt(ctx, kurt);
    drawParticles(ctx, particles);
    ctx.restore();
  }

  function loop(now) {
    if (!running) return;
    const dtRaw = (now - lastTime) / 1000;
    lastTime = now;
    const dt = Math.min(Math.max(dtRaw, 0), 1 / 30);
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function start() {
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function pauseLoop() {
    running = false;
    audio.stopWind();
  }

  function resumeLoop() {
    if (running) return;
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function onSelectCosmetic(id) {
    cosmeticId = id;
    storage.setCosmetic(id);
    renderCosmetics();
  }

  function renderCosmetics() {
    ui.renderCosmeticRow(cosmeticId, storage.getBestDistance(), onSelectCosmetic);
  }

  function refreshStartScreen() {
    ui.showStart(storage.getBestDistance(), storage.getHighestGrade());
    renderCosmetics();
    ui.setMuteLabel(audio.isMuted());
  }

  function init() {
    ui.initUI({
      onStart: () => {
        beginPlay();
      },
      onRestart: () => {
        beginPlay();
      },
      onToggleMute: () => {
        const m = !audio.isMuted();
        audio.setMuted(m);
        ui.setMuteLabel(m);
      },
    });

    resize();
    kurt.y = worldH * 0.42;
    refreshStartScreen();

    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) pauseLoop();
      else resumeLoop();
    });

    start();
  }

  return { init, resize };
}
