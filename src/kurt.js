import { PHYSICS } from "./config.js";
import { clamp, expLerp, rand } from "./utils.js";
import { createHair, resetHair, updateHair, burstHair, drawHair } from "./hair.js";

export function createKurt() {
  return {
    x: 0,
    y: 0,
    vy: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    squash: 0,
    thrusting: false,
    buttWigglePhase: 0,
    blinking: false,
    blinkTimer: 2.5,
    hair: createHair(),
    cosmetic: null,
  };
}

export function resetKurt(kurt, x, y, cosmetic) {
  kurt.x = x;
  kurt.y = y;
  kurt.vy = 0;
  kurt.rotation = 0;
  kurt.scaleX = 1;
  kurt.scaleY = 1;
  kurt.squash = 0;
  kurt.thrusting = false;
  kurt.buttWigglePhase = 0;
  kurt.blinking = false;
  kurt.blinkTimer = rand(1.5, 3);
  kurt.cosmetic = cosmetic;
  resetHair(kurt.hair, x - PHYSICS.kurtRadius * 0.24, y - PHYSICS.kurtRadius * 0.99);
}

export function beginThrust(kurt) {
  kurt.thrusting = true;
  kurt.squash = 1;
  burstHair(kurt.hair, 0, -1, 160);
}

export function endThrust(kurt) {
  kurt.thrusting = false;
}

export function pulseFart(kurt, intensity) {
  kurt.squash = Math.max(kurt.squash, 0.55 * clamp(intensity, 0.3, 1.5));
}

export function updateKurt(kurt, dt, gravityMult, scrollSpeed, thrustMult = 1) {
  const g = PHYSICS.gravity * gravityMult;
  const accel = kurt.thrusting ? g - PHYSICS.holdThrustAccel * thrustMult : g;
  kurt.vy += accel * dt;
  kurt.vy = clamp(kurt.vy, PHYSICS.maxRise, PHYSICS.maxFall);
  kurt.y += kurt.vy * dt;

  const targetRotation =
    kurt.vy < 0
      ? clamp((kurt.vy / PHYSICS.maxRise) * PHYSICS.maxRotationUp, PHYSICS.maxRotationUp, 0)
      : clamp((kurt.vy / PHYSICS.maxFall) * PHYSICS.maxRotationDown, 0, PHYSICS.maxRotationDown);
  kurt.rotation = expLerp(kurt.rotation, targetRotation, PHYSICS.rotationLerp, dt);

  kurt.squash = Math.max(0, kurt.squash - dt * 4.5);
  const squashAmt = Math.sin(Math.min(1, kurt.squash) * Math.PI) * 0.22;
  kurt.scaleY = 1 - squashAmt;
  kurt.scaleX = 1 + squashAmt * 0.6;

  if (kurt.thrusting) {
    kurt.buttWigglePhase += dt * 46;
  }

  kurt.blinkTimer -= dt;
  if (kurt.blinkTimer <= 0) {
    kurt.blinking = !kurt.blinking;
    kurt.blinkTimer = kurt.blinking ? 0.09 : rand(2, 4.5);
  }

  const R = PHYSICS.kurtRadius;
  const rad = (kurt.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const localX = -R * 0.24;
  const localY = -R * 0.99;
  const anchorX = kurt.x + localX * cos - localY * sin;
  const anchorY = kurt.y + localX * sin + localY * cos;
  updateHair(kurt.hair, dt, anchorX, anchorY, kurt.vy, scrollSpeed);
}

export function getHitCircle(kurt) {
  return { x: kurt.x, y: kurt.y, r: PHYSICS.kurtRadius * 0.72 };
}

export function getButtPosition(kurt) {
  const R = PHYSICS.kurtRadius;
  const rad = (kurt.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const localX = R * 0.05;
  const localY = R * 0.9;
  return {
    x: kurt.x + localX * cos - localY * sin,
    y: kurt.y + localX * sin + localY * cos,
  };
}

const SKIN = "#f4c9a0";
const SKIN_SHADE = "#e0a97c";
const OUTLINE = "rgba(120,66,38,0.55)";
const HAIR_BASE = "#4a2f1c";
const HAIR_HI = "#7a4f2f";
const MUSTACHE = "#5b3a24";

export function drawKurt(ctx, kurt) {
  const R = PHYSICS.kurtRadius;
  drawHair(ctx, kurt.hair, HAIR_BASE, HAIR_HI);

  ctx.save();
  ctx.translate(kurt.x, kurt.y);
  ctx.rotate((kurt.rotation * Math.PI) / 180);
  ctx.scale(kurt.scaleX, kurt.scaleY);

  // back arm: sweeps behind the body around to the clasped hands
  drawArmCurve(ctx, R, -R * 0.18, -R * 0.32, -R * 0.7, R * 0.14, R * 0.24, R * 0.5);

  // one rounded body mass reads as the tucked torso + thighs together,
  // matching a real cannonball tuck instead of separate limb shapes
  ctx.fillStyle = SKIN;
  ctx.beginPath();
  ctx.ellipse(R * 0.05, R * 0.1, R * 0.88, R * 0.8, 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.stroke();

  // soft shading where the thighs tuck against the chest
  ctx.fillStyle = "rgba(190,120,80,0.22)";
  ctx.beginPath();
  ctx.ellipse(R * 0.3, R * 0.26, R * 0.48, R * 0.38, 0.25, 0, Math.PI * 2);
  ctx.fill();

  // knee crease
  ctx.strokeStyle = "rgba(150,90,55,0.4)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-R * 0.24, -R * 0.08);
  ctx.quadraticCurveTo(R * 0.14, R * 0.08, R * 0.52, -R * 0.04);
  ctx.stroke();

  const wiggle = kurt.thrusting ? Math.sin(kurt.buttWigglePhase) * R * 0.04 : 0;
  drawButtCrack(ctx, R, wiggle);

  drawFoot(ctx, R, R * 0.82, R * 0.48, 0.6);
  drawFoot(ctx, R, R * 0.7, R * 0.74, 0.8);

  // front arm: comes over the top of the tuck to meet the back arm
  drawArmCurve(ctx, R, R * 0.22, -R * 0.3, R * 0.62, R * 0.14, R * 0.3, R * 0.48);
  drawClaspedHands(ctx, R, R * 0.27, R * 0.49);

  drawAccessoryBehindHead(ctx, R, kurt.cosmetic);

  ctx.save();
  ctx.translate(-R * 0.22, -R * 0.56);
  ctx.rotate(-0.08);

  ctx.fillStyle = SKIN;
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.58, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.stroke();

  // a slightly higher hairline: just a hint of bare forehead
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.beginPath();
  ctx.ellipse(R * 0.04, -R * 0.44, R * 0.2, R * 0.13, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(120,80,50,0.22)";
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(-R * 0.06, -R * 0.36, R * 0.4, Math.PI * 1.16, Math.PI * 1.68);
  ctx.stroke();

  ctx.fillStyle = "rgba(190,120,80,0.35)";
  ctx.beginPath();
  ctx.arc(R * 0.18, R * 0.1, R * 0.4, 0.2, 2.6);
  ctx.fill();

  const eyeY = -R * 0.06;
  const silly = kurt.thrusting;
  drawEye(ctx, -R * 0.14, eyeY, R, kurt.blinking, silly);
  drawEye(ctx, R * 0.2, eyeY, R, kurt.blinking, silly);

  drawEyebrows(ctx, R, eyeY, silly);

  drawMouth(ctx, R, silly);

  ctx.fillStyle = MUSTACHE;
  ctx.beginPath();
  ctx.moveTo(-R * 0.32, R * 0.22);
  ctx.quadraticCurveTo(-R * 0.12, R * 0.12, 0, R * 0.22);
  ctx.quadraticCurveTo(R * 0.12, R * 0.12, R * 0.34, R * 0.22);
  ctx.quadraticCurveTo(R * 0.14, R * 0.34, 0, R * 0.24);
  ctx.quadraticCurveTo(-R * 0.14, R * 0.34, -R * 0.32, R * 0.22);
  ctx.fill();

  drawAccessoryOnHead(ctx, R, kurt.cosmetic);

  ctx.restore();

  ctx.restore();
}

function drawButtCrack(ctx, R, wiggle) {
  const cx = -R * 0.16 + wiggle;
  ctx.strokeStyle = "rgba(140,80,50,0.45)";
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx, R * 0.62);
  ctx.quadraticCurveTo(cx, R * 0.74, cx, R * 0.84);
  ctx.stroke();
}

function drawClaspedHands(ctx, R, cx, cy) {
  ctx.fillStyle = SKIN_SHADE;
  ctx.beginPath();
  ctx.arc(cx - R * 0.07, cy, R * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + R * 0.09, cy + R * 0.03, R * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(cx - R * 0.07, cy, R * 0.15, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx + R * 0.09, cy + R * 0.03, R * 0.15, 0, Math.PI * 2);
  ctx.stroke();
}

function drawFoot(ctx, R, cx, cy, rot) {
  ctx.fillStyle = SKIN;
  ctx.beginPath();
  ctx.ellipse(cx, cy, R * 0.19, R * 0.12, rot, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.4;
  ctx.stroke();
}

function drawEye(ctx, ex, ey, R, blinking, silly) {
  if (blinking) {
    ctx.strokeStyle = "#2b2016";
    ctx.lineWidth = 1.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(ex - R * 0.11, ey);
    ctx.quadraticCurveTo(ex, ey + R * 0.03, ex + R * 0.11, ey);
    ctx.stroke();
    return;
  }
  const scale = silly ? 1.2 : 1;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(ex, ey, R * 0.13 * scale, R * 0.11 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2b2016";
  ctx.beginPath();
  ctx.arc(ex + R * 0.02, ey + R * 0.01, R * 0.055 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(ex + R * 0.045, ey - R * 0.02, R * 0.018 * scale, 0, Math.PI * 2);
  ctx.fill();
}

function drawEyebrows(ctx, R, eyeY, silly) {
  ctx.strokeStyle = "rgba(120,70,40,0.5)";
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  if (silly) {
    ctx.beginPath();
    ctx.arc(-R * 0.14, eyeY - R * 0.22, R * 0.13, Math.PI * 1.05, Math.PI * 1.85);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(R * 0.2, eyeY - R * 0.22, R * 0.13, Math.PI * 1.05, Math.PI * 1.85);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(-R * 0.25, eyeY - R * 0.06);
    ctx.lineTo(-R * 0.04, eyeY - R * 0.19);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(R * 0.06, eyeY - R * 0.19);
    ctx.lineTo(R * 0.29, eyeY - R * 0.06);
    ctx.stroke();
  }
}

function drawMouth(ctx, R, silly) {
  if (silly) {
    ctx.fillStyle = "#7a2020";
    ctx.beginPath();
    ctx.ellipse(0, R * 0.33, R * 0.19, R * 0.17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(0, R * 0.24, R * 0.16, R * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(0, R * 0.33, R * 0.19, R * 0.17, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.strokeStyle = "#8a5a35";
    ctx.lineWidth = R * 0.05;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(0, R * 0.46, R * 0.13, Math.PI * 1.3, Math.PI * 1.7);
    ctx.stroke();
  }
}

function drawArmCurve(ctx, R, sx, sy, cx, cy, ex, ey) {
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo(cx, cy, ex, ey);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = R * 0.3 + 3;
  ctx.stroke();
  ctx.strokeStyle = SKIN;
  ctx.lineWidth = R * 0.3;
  ctx.stroke();
}

function drawAccessoryOnHead(ctx, R, cosmetic) {
  if (!cosmetic || !cosmetic.accessory) return;
  const accent = cosmetic.accent;
  switch (cosmetic.accessory) {
    case "cowboy":
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.ellipse(0, -R * 0.42, R * 0.62, R * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -R * 0.58, R * 0.34, Math.PI, Math.PI * 2);
      ctx.fill();
      break;
    case "viking":
      ctx.fillStyle = "#c9c9c9";
      ctx.beginPath();
      ctx.arc(0, -R * 0.5, R * 0.42, Math.PI * 1.05, Math.PI * 1.95);
      ctx.fill();
      ctx.fillStyle = "#eee6d0";
      ctx.beginPath();
      ctx.moveTo(-R * 0.4, -R * 0.5);
      ctx.quadraticCurveTo(-R * 0.62, -R * 0.75, -R * 0.5, -R * 0.9);
      ctx.quadraticCurveTo(-R * 0.35, -R * 0.68, -R * 0.28, -R * 0.52);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(R * 0.4, -R * 0.5);
      ctx.quadraticCurveTo(R * 0.62, -R * 0.75, R * 0.5, -R * 0.9);
      ctx.quadraticCurveTo(R * 0.35, -R * 0.68, R * 0.28, -R * 0.52);
      ctx.fill();
      break;
    case "disco":
      ctx.strokeStyle = accent;
      ctx.lineWidth = R * 0.1;
      ctx.beginPath();
      ctx.arc(0, -R * 0.38, R * 0.42, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      break;
    case "laurel":
      ctx.strokeStyle = "#7a9a5a";
      ctx.lineWidth = R * 0.08;
      ctx.beginPath();
      ctx.arc(0, -R * 0.4, R * 0.44, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      ctx.fillStyle = "#8fae63";
      for (let i = 0; i < 5; i++) {
        const a = Math.PI * 1.2 + i * 0.14;
        const lx = Math.cos(a) * R * 0.46;
        const ly = -R * 0.4 + Math.sin(a) * R * 0.46;
        ctx.beginPath();
        ctx.ellipse(lx, ly, R * 0.09, R * 0.05, a, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case "astro":
      ctx.strokeStyle = accent;
      ctx.lineWidth = R * 0.08;
      ctx.beginPath();
      ctx.arc(0, -R * 0.02, R * 0.72, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(160,210,255,0.25)";
      ctx.beginPath();
      ctx.arc(0, -R * 0.02, R * 0.68, Math.PI * 1.2, Math.PI * 1.9);
      ctx.fill();
      break;
    default:
      break;
  }
}

function drawAccessoryBehindHead(ctx, R, cosmetic) {
  if (!cosmetic) return;
  if (cosmetic.accessory === "tie") {
    ctx.fillStyle = cosmetic.accent;
    ctx.beginPath();
    ctx.moveTo(-R * 0.1, -R * 0.15);
    ctx.lineTo(R * 0.1, -R * 0.15);
    ctx.lineTo(R * 0.14, R * 0.45);
    ctx.lineTo(0, R * 0.6);
    ctx.lineTo(-R * 0.14, R * 0.45);
    ctx.closePath();
    ctx.fill();
  }
}
