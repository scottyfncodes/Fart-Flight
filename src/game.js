import { PHYSICS, SCROLL, DIGNITY, COSMETICS, WORLD } from "./config.js";
import { clamp, rand, choose } from "./utils.js";
import * as audio from "./audio.js";
import { storage } from "./storage.js";
import {
  createParticleSystem,
  spawnFartBurst,
  spawnSparkles,
  updateParticles,
  drawParticles,
} from "./particles.js";
import { createKurt, resetKurt, beginThrust, endThrust, pulseFart, updateKurt, updateKurtHair, getHitCircle, getButtPosition, drawKurt } from "./kurt.js";
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
  DEATH_CAUSES,
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
import { kurtHitsRects, kurtHitsSpinner, kurtHitsCircle } from "./collision.js";
import { createInputHandler } from "./input.js";
import {
  createFx,
  resetFx,
  popText,
  flash,
  burstConfetti,
  showDizzyStars,
  updateFx,
  drawFxWorld,
  drawFxScreen,
} from "./fx.js";
import * as ui from "./ui.js";

const GROUND_H = 34;
const MILESTONE_EVERY = 100;
const DEATH_REVEAL_DELAY = 1.15;

function buzz(pattern) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch (e) {
    /* unsupported */
  }
}

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
  const fx = createFx();

  // start -> ready (hovering, waiting for the first hold) -> playing ->
  // dying (crash animation) -> gameover
  let state = "start";
  let paused = false;
  let scrollSpeed = SCROLL.baseSpeed;
  let shownGradeIndex = 0;
  let shake = { t: 0, dur: 0.001, mag: 0 };
  let idleTapTimer = 1.4;
  let fartTickTimer = 0;
  let cosmeticId = storage.getCosmetic();
  let lastTime = 0;
  let running = false;
  let hitStop = 0;
  let slowMo = 0;
  let stateTime = 0;
  let nextMilestone = MILESTONE_EVERY;
  let runBest = 0;
  let passedBest = false;
  let deathInfo = null;
  let lastRun = null;
  let hoverBaseY = 0;
  let godMode = false; // debug-only, see installDebugHooks

  function currentCosmetic() {
    return COSMETICS.find((c) => c.id === cosmeticId) || COSMETICS[0];
  }

  function idleY() {
    return state === "start" ? worldH * 0.2 : worldH * 0.42;
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
    kurt.x = worldW * (state === "start" ? 0.5 : PHYSICS.kurtX);
    if (state === "start" || state === "ready") {
      kurt.y = idleY();
      hoverBaseY = kurt.y;
    }
  }

  function fullReset() {
    resetScoring(scoring);
    resetObstacleField(obstacles);
    resetPowerupField(powerupField);
    resetFx(fx);
    particles.puffs.length = 0;
    particles.bits.length = 0;
    particles.sparkles.length = 0;
    resetKurt(kurt, worldW * PHYSICS.kurtX, idleY(), currentCosmetic());
    scrollSpeed = SCROLL.baseSpeed;
    shownGradeIndex = 0;
    hitStop = 0;
    slowMo = 0;
    nextMilestone = MILESTONE_EVERY;
    runBest = storage.getBestDistance();
    passedBest = false;
    deathInfo = null;
  }

  function speedFrac() {
    return clamp((scrollSpeed - SCROLL.baseSpeed) / (SCROLL.maxSpeed - SCROLL.baseSpeed), 0, 1);
  }

  function fartTick(intensity) {
    const clamped = clamp(intensity, 0.3, 1.6);
    registerFart(scoring, clamped);
    audio.playFart(clamped);
    const butt = getButtPosition(kurt);
    spawnFartBurst(particles, butt.x, butt.y, clamped, 165);
    pulseFart(kurt, clamped);
    if (clamped > 0.85) triggerShake(0.12, 4 * clamped);
  }

  function setState(s) {
    state = s;
    stateTime = 0;
  }

  function beginPlay() {
    audio.initAudio();
    setState("ready");
    fullReset();
    kurt.y = idleY();
    hoverBaseY = kurt.y;
    paused = false;
    ui.hideStart();
    ui.hideGameOver();
    ui.hidePause();
    ui.showHud();
    ui.showReady();
    ui.updateHud(0, "F0", 100, null);
    input.setEnabled(true);
    audio.setMusicIntensity(0.5, 0);
    audio.startMusic();
  }

  // the first hold after the ready prompt is what actually launches the run
  function launch() {
    setState("playing");
    ui.hideReady();
    audio.startWind();
    audio.setMusicIntensity(1, 0);
    storage.addRun();
    beginThrust(kurt);
    fartTickTimer = 0;
    fartTick(0.9);
  }

  function triggerShake(dur, mag) {
    if (shake.t > 0 && shake.mag * (shake.t / shake.dur) > mag) return;
    shake = { t: dur, dur, mag };
  }

  function goHome() {
    if (state === "start") return;
    setState("start");
    paused = false;
    input.setEnabled(false);
    audio.stopWind();
    audio.stopMusic();
    fullReset();
    kurt.x = worldW * 0.5;
    kurt.y = idleY();
    idleTapTimer = rand(0.6, 1.2);
    ui.hideGameOver();
    ui.hidePause();
    refreshStartScreen();
  }

  function pause() {
    if (paused || (state !== "playing" && state !== "ready")) return;
    paused = true;
    endThrust(kurt);
    input.setEnabled(false);
    audio.stopWind();
    audio.stopMusic(0.1);
    ui.showPause();
  }

  function resume() {
    if (!paused) return;
    paused = false;
    ui.hidePause();
    input.setEnabled(true);
    lastTime = performance.now();
    if (state === "playing") {
      audio.startWind();
      audio.setMusicIntensity(1, speedFrac());
    }
    audio.startMusic();
    // a short grace beat so Kurt doesn't drop the instant you let go of the button
    slowMo = 0.5;
  }

  function crash(cause) {
    if (state !== "playing") return;
    setState("dying");
    deathInfo = { cause };
    endThrust(kurt);
    input.setEnabled(false);
    audio.stopWind();
    audio.stopMusic(0.08);
    audio.playImpact();
    buzz([60, 40, 90]);
    hitStop = 0.14;
    flash(fx, 0.85);
    triggerShake(0.45, 12);
    loseDignity(scoring, DIGNITY.collisionLoss);
    spawnSparkles(particles, kurt.x, kurt.y, "#ffffff", 18);

    // knocked back and sent tumbling
    kurt.dizzy = true;
    kurt.squash = 1;
    kurt.vy = cause === "ground" ? -420 : cause === "ceiling" ? 120 : -360;
    kurt.vx = -70;
    kurt.spin = rand(540, 760) * (Math.random() < 0.5 ? -1 : 1);
    kurt.bounces = 0;
    showDizzyStars(fx, true);
    setTimeout(() => audio.playFart(1.4), 160);

    lastRun = finalizeRun();
  }

  function finalizeRun() {
    const grade = getGradeForMeters(scoring.meters);
    const prevBest = storage.getBestDistance();
    const isNewBest = scoring.meters > prevBest && scoring.meters >= 1;
    const unlocked = COSMETICS.find((c) => c.unlockMeters > prevBest && c.unlockMeters <= scoring.meters) || null;
    if (isNewBest) storage.setBestDistance(scoring.meters);
    if (scoring.bestStreak > storage.getBestStreak()) storage.setBestStreak(scoring.bestStreak);
    if (getGradeIndex(grade.code) > getGradeIndex(storage.getHighestGrade())) {
      storage.setHighestGrade(grade.code);
    }
    storage.addLifetimeFarts(scoring.farts);
    return { grade, prevBest, isNewBest, unlocked };
  }

  function revealGameOver() {
    setState("gameover");
    const { grade, prevBest, isNewBest, unlocked } = lastRun;
    const cause = choose(DEATH_CAUSES[deathInfo.cause] || DEATH_CAUSES.ground);
    ui.showGameOver(
      {
        meters: scoring.meters,
        farts: scoring.farts,
        efficiency: getEfficiency(scoring),
        bestStreak: scoring.bestStreak,
        closeCalls: scoring.closeCalls,
        dignity: scoring.dignity,
        gradeCode: grade.code,
      },
      isNewBest,
      { cause, prevBest, unlocked, onTick: (k) => audio.playTick(1 + k * 0.8) }
    );
    if (isNewBest) {
      audio.playHighScore();
      burstConfetti(fx, worldW * 0.5, worldH * 0.35, 90, 1.2);
      buzz([30, 50, 30]);
    } else {
      audio.playSadTrombone();
    }
    if (unlocked) setTimeout(() => audio.playUnlock(), 700);
  }

  function restartFromGameOver() {
    if (state !== "gameover" || stateTime < 0.45) return;
    beginPlay();
  }

  function handleDown() {
    audio.initAudio();
    if (paused) return;
    if (state === "ready") {
      launch();
      return;
    }
    if (state !== "playing") return;
    beginThrust(kurt);
    fartTickTimer = 0;
  }

  function handleUp() {
    if (state !== "playing") return;
    endThrust(kurt);
  }

  const input = createInputHandler(canvas, handleDown, handleUp);
  input.setEnabled(false);

  function updateIdleStart(dt) {
    idleTapTimer -= dt;
    if (idleTapTimer <= 0) {
      if (kurt.thrusting) {
        endThrust(kurt);
        idleTapTimer = rand(1.1, 1.6);
      } else {
        beginThrust(kurt);
        const butt = getButtPosition(kurt);
        spawnFartBurst(particles, butt.x, butt.y, 0.6, 165);
        idleTapTimer = rand(0.5, 0.8);
      }
    }
    updateKurt(kurt, dt, 0.5, 50, 0.7);
    // show-off loop: drift in a lazy figure-eight around the top of the menu
    kurt.x = worldW * 0.5 + Math.sin(stateTime * 0.7) * worldW * 0.2;
    if (kurt.y > worldH * 0.3 || kurt.y < worldH * 0.14) {
      kurt.y = clamp(kurt.y, worldH * 0.14, worldH * 0.3);
      kurt.vy *= -0.3;
      endThrust(kurt);
    }
    updateBackground(background, dt, 40, 0);
    updateParticles(particles, dt);
    updateFx(fx, dt, 40, worldW, worldH, 0);
  }

  function updateReady(dt) {
    kurt.vy = 0;
    updateKurt(kurt, dt, 0, SCROLL.baseSpeed, 1);
    kurt.y = hoverBaseY + Math.sin(stateTime * 3.2) * 9;
    kurt.rotation = Math.sin(stateTime * 3.2 + 1) * 5;
    // gentle puffs keep him aloft while he waits
    idleTapTimer -= dt;
    if (idleTapTimer <= 0) {
      const butt = getButtPosition(kurt);
      spawnFartBurst(particles, butt.x, butt.y, 0.35, 165);
      idleTapTimer = rand(0.35, 0.6);
    }
    updateBackground(background, dt, SCROLL.baseSpeed, 0);
    updateParticles(particles, dt);
    updateFx(fx, dt, SCROLL.baseSpeed, worldW, worldH, 0);
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
        // irregular rhythm instead of a metronomic toot-toot-toot
        fartTickTimer = PHYSICS.fartTickInterval * rand(0.55, 1.7);
      }
    } else {
      fartTickTimer = 0;
    }

    addDistance(scoring, scrollSpeed * dt, WORLD.pxPerMeter);
    updateBackground(background, dt, scrollSpeed, scoring.meters);
    updateObstacles(obstacles, dt, scrollSpeed, worldW, worldH, GROUND_H, scoring.meters);
    maybeSpawnPowerup(powerupField, dt, worldW, worldH, GROUND_H, scoring.meters);
    updatePowerups(powerupField, dt, scrollSpeed);
    updateParticles(particles, dt);
    updateFx(fx, dt, scrollSpeed, worldW, worldH, speedFrac());
    audio.setWindIntensity(clamp(Math.abs(kurt.vy) / 700, 0, 1));
    audio.setMusicIntensity(1 + speedFrac(), speedFrac());

    const hit = getHitCircle(kurt);
    let cause = null;
    const playH = worldH - GROUND_H;
    if (hit.y + hit.r > playH) cause = "ground";
    else if (hit.y - hit.r < -4) cause = "ceiling";

    if (!cause) {
      for (const o of obstacles.list) {
        if (kurtHitsRects(hit, getObstacleRects(o, worldH, GROUND_H)) ||
            (o.hasSpinner && kurtHitsSpinner(hit, getSpinnerPoints(o)))) {
          cause = o.theme;
          break;
        }
      }
    }
    if (!cause) {
      for (const h of obstacles.hazards) {
        if (kurtHitsCircle(hit, getHazardCollider(h))) {
          cause = h.kind;
          break;
        }
      }
    }

    if (!cause) {
      checkNearMissAndScore(obstacles, kurt.x, kurt.y, hit.r, (nearMiss) => {
        registerPass(scoring, nearMiss);
        if (nearMiss) {
          loseDignity(scoring, DIGNITY.nearMissLoss);
          ui.flashNearMiss();
          audio.playWhoosh();
          buzz(15);
          slowMo = 0.35;
          popText(fx, kurt.x + 10, kurt.y - 40, choose(["CLOSE ONE!", "CLENCH!", "PHEW!", "SQUEAKER!"]), { color: "#ffcd3c", size: 26 });
          spawnSparkles(particles, kurt.x, kurt.y, "#ffcd3c", 10);
        } else if (scoring.streak > 0 && scoring.streak % 5 === 0) {
          popText(fx, kurt.x + 10, kurt.y - 40, `${scoring.streak} IN A ROW!`, { color: "#38d67a", size: 22 });
          audio.playMilestone();
        }
      });

      tryCollectPowerups(
        powerupField,
        kurt.x,
        kurt.y,
        hit.r,
        (key, def) => onPickup(def),
        (key, def) => {
          gainDignity(scoring, def.dignityBonus || 0);
          onPickup(def, `+${def.dignityBonus} DIGNITY`);
        }
      );

      if (scoring.meters >= nextMilestone) {
        // grade boundaries get the bigger grade-up toast instead
        if (getGradeForMeters(nextMilestone).meters !== nextMilestone) {
          popText(fx, worldW / 2, worldH * 0.2, `${nextMilestone}m`, { color: "#fff", size: 40, life: 1.1, rise: 30 });
          audio.playMilestone();
        }
        nextMilestone += MILESTONE_EVERY;
      }

      if (!passedBest && runBest >= 25 && scoring.meters > runBest) {
        passedBest = true;
        popText(fx, worldW / 2, worldH * 0.28, "NEW BEST!", { color: "#38d67a", size: 42, life: 1.4, rise: 30 });
        burstConfetti(fx, worldW / 2, worldH * 0.3, 50);
        audio.playHighScore();
        buzz(30);
      }

      const grade = getGradeForMeters(scoring.meters);
      const idx = getGradeIndex(grade.code);
      if (idx > shownGradeIndex) {
        shownGradeIndex = idx;
        ui.flashGradeToast(grade.code, grade.name);
        audio.playGradeUp();
        triggerShake(0.2, 4);
        flash(fx, 0.35, "#ffe9a8");
        burstConfetti(fx, worldW / 2, worldH * 0.3, 40, 0.8);
        buzz(30);
      }

      ui.updateHud(scoring.meters, grade.code, scoring.dignity, powerupField.active);
    }

    if (cause && !godMode) crash(cause);
  }

  function onPickup(def, label) {
    audio.playPowerUp();
    spawnSparkles(particles, kurt.x, kurt.y, def.color, 18);
    flash(fx, 0.25, def.color);
    popText(fx, kurt.x + 20, kurt.y - 36, label || def.label + "!", { color: def.color, size: 22, life: 1.2 });
    buzz(20);
  }

  function updateDying(dt) {
    const R = PHYSICS.kurtRadius;
    const floor = worldH - GROUND_H - R * 0.7;
    kurt.vy += PHYSICS.gravity * dt;
    kurt.y += kurt.vy * dt;
    kurt.x += kurt.vx * dt;
    kurt.vx *= Math.max(0, 1 - 1.5 * dt);
    kurt.rotation += kurt.spin * dt;
    if (kurt.y > floor) {
      kurt.y = floor;
      if (kurt.bounces < 2 && kurt.vy > 120) {
        kurt.bounces++;
        kurt.vy = -kurt.vy * 0.38;
        kurt.spin *= 0.4;
        kurt.squash = 1;
        triggerShake(0.15, 4);
        spawnFartBurst(particles, kurt.x, floor + R * 0.5, 0.5, 200);
      } else {
        kurt.vy = 0;
        kurt.vx = 0;
        kurt.spin = 0;
        // flop over onto his side
        kurt.rotation += (((90 - kurt.rotation) % 360 + 540) % 360 - 180) * Math.min(1, dt * 8);
      }
    }
    kurt.squash = Math.max(0, kurt.squash - dt * 4);
    const squashAmt = Math.sin(Math.min(1, kurt.squash) * Math.PI) * 0.25;
    kurt.scaleY = 1 - squashAmt;
    kurt.scaleX = 1 + squashAmt * 0.6;
    updateKurtHair(kurt, dt, 0);

    updateBackground(background, dt, 0, scoring.meters);
    updateParticles(particles, dt);
    updateFx(fx, dt, 0, worldW, worldH, 0);
    if (stateTime >= DEATH_REVEAL_DELAY) revealGameOver();
  }

  function updateGameOver(dt) {
    updateParticles(particles, dt);
    updateFx(fx, dt, 0, worldW, worldH, 0);
  }

  function update(dt) {
    if (shake.t > 0) shake.t = Math.max(0, shake.t - dt);
    if (hitStop > 0) {
      hitStop -= dt;
      return;
    }
    if (slowMo > 0) {
      slowMo -= dt;
      dt *= 0.45;
    }
    stateTime += dt;
    if (state === "start") updateIdleStart(dt);
    else if (state === "ready") updateReady(dt);
    else if (state === "playing") updatePlaying(dt);
    else if (state === "dying") updateDying(dt);
    else updateGameOver(dt);
  }

  function draw() {
    ctx.save();
    if (shake.t > 0) {
      const m = shake.mag * (shake.t / shake.dur);
      ctx.translate(rand(-m, m), rand(-m, m));
    }
    const metersForBg = state === "start" || state === "ready" ? 0 : scoring.meters;
    drawBackground(ctx, background, metersForBg, GROUND_H);

    if (state !== "start") {
      drawPowerups(ctx, powerupField);
      for (const o of obstacles.list) drawObstacle(ctx, o, worldH, GROUND_H);
      for (const h of obstacles.hazards) drawHazard(ctx, h);
    }

    if (powerupField.active && state === "playing") drawAura(powerupField.active);
    ctx.save();
    if (state === "start") {
      // hero-size Kurt showing off above the menu
      ctx.translate(kurt.x, kurt.y);
      ctx.scale(1.8, 1.8);
      ctx.translate(-kurt.x, -kurt.y);
    }
    drawKurt(ctx, kurt);
    drawParticles(ctx, particles);
    ctx.restore();
    drawFxWorld(ctx, fx, state === "dying" || state === "gameover" ? kurt : null);
    ctx.restore();
    drawFxScreen(ctx, fx, worldW, worldH);
  }

  function drawAura(active) {
    const t = performance.now() / 1000;
    const r = PHYSICS.kurtRadius * (1.45 + Math.sin(t * 10) * 0.08);
    const g = ctx.createRadialGradient(kurt.x, kurt.y - 6, r * 0.3, kurt.x, kurt.y - 6, r);
    g.addColorStop(0, active.def.color + "00");
    g.addColorStop(0.7, active.def.color + "55");
    g.addColorStop(1, active.def.color + "00");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(kurt.x, kurt.y - 6, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function loop(now) {
    if (!running) return;
    const dtRaw = (now - lastTime) / 1000;
    lastTime = now;
    const dt = Math.min(Math.max(dtRaw, 0), 1 / 30);
    if (!paused) update(dt);
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
    audio.stopMusic(0.05);
  }

  function resumeLoop() {
    if (running) return;
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(loop);
    // music resumes with the run, never on its own behind a pause menu
    if (!paused && state === "ready") audio.startMusic();
  }

  function onSelectCosmetic(id) {
    cosmeticId = id;
    storage.setCosmetic(id);
    kurt.cosmetic = currentCosmetic();
    // a celebratory toot on costume change
    audio.initAudio();
    audio.playFart(0.5);
    const butt = getButtPosition(kurt);
    spawnFartBurst(particles, butt.x, butt.y, 0.9, 165);
    spawnSparkles(particles, kurt.x, kurt.y, currentCosmetic().accent, 12);
    renderCosmetics();
  }

  function renderCosmetics() {
    ui.renderCosmeticRow(cosmeticId, storage.getBestDistance(), onSelectCosmetic);
  }

  function refreshStartScreen() {
    ui.showStart(storage.getBestDistance(), storage.getHighestGrade(), storage.getLifetimeFarts());
    renderCosmetics();
    ui.setMuteLabel(audio.isMuted());
    ui.setMusicLabel(audio.isMusicMuted());
  }

  async function share() {
    const m = Math.floor(scoring.meters);
    const grade = getGradeForMeters(scoring.meters);
    const url = location.href.split(/[?#]/)[0];
    const text = `I farted my way ${m}m in FfffKurt 💨 and earned ${grade.code}: ${grade.name}. Beat that.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "FfffKurt", text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      popText(fx, worldW / 2, worldH * 0.12, "COPIED!", { color: "#38d67a", size: 26 });
    } catch (e) {
      /* share sheet dismissed */
    }
  }

  function handleKeys(e) {
    if (e.repeat) return;
    const go = e.code === "Space" || e.code === "Enter" || e.code === "ArrowUp";
    if (state === "start" && go && document.activeElement?.tagName !== "BUTTON") {
      e.preventDefault();
      beginPlay();
    } else if (state === "gameover" && go) {
      e.preventDefault();
      restartFromGameOver();
    } else if (e.code === "Escape" || e.code === "KeyP") {
      if (paused) resume();
      else pause();
    } else if (paused && go) {
      e.preventDefault();
      resume();
    }
  }

  function installDebugHooks() {
    // ?debug exposes an autopilot and a teleport for automated playtesting
    if (!new URLSearchParams(location.search).has("debug")) return;
    window.__kurt = {
      state: () => state,
      god(on = true) {
        godMode = on;
      },
      meters: () => scoring.meters,
      jump(m) {
        addDistance(scoring, m * WORLD.pxPerMeter - scoring.distancePx, WORLD.pxPerMeter);
        nextMilestone = Math.ceil((m + 1) / MILESTONE_EVERY) * MILESTONE_EVERY;
        shownGradeIndex = getGradeIndex(getGradeForMeters(m).code);
      },
      autopilot() {
        if (state !== "playing") return null;
        const hit = getHitCircle(kurt);
        const next = obstacles.list.find((o) => o.x + o.width > kurt.x - hit.r);
        const target = next && next.x - kurt.x < 260 ? next.gapCenterY : (worldH - GROUND_H) * 0.5;
        const desiredVy = clamp((target - kurt.y) * 4, -500, 500);
        return kurt.vy > desiredVy ? "down" : "up";
      },
    };
  }

  function init() {
    ui.initUI({
      onStart: () => beginPlay(),
      onRestart: () => beginPlay(),
      onHome: () => goHome(),
      onPause: () => pause(),
      onResume: () => resume(),
      onQuit: () => goHome(),
      onShare: () => share(),
      onToggleMute: () => {
        const m = !audio.isMuted();
        audio.setMuted(m);
        ui.setMuteLabel(m);
      },
      onToggleMusic: () => {
        const m = !audio.isMusicMuted();
        audio.setMusicMuted(m);
        ui.setMusicLabel(m);
      },
    });

    resize();
    kurt.cosmetic = currentCosmetic();
    kurt.x = worldW * 0.5;
    kurt.y = idleY();
    refreshStartScreen();

    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);
    window.addEventListener("keydown", handleKeys);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        pause();
        pauseLoop();
      } else {
        resumeLoop();
        audio.initAudio();
      }
    });
    installDebugHooks();

    start();
  }

  return { init, resize };
}
