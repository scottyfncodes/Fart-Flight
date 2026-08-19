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
    fartExprIndex: 0,
    fartExprTimer: 0,
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
  kurt.fartExprIndex = 0;
  kurt.fartExprTimer = 0;
  kurt.cosmetic = cosmetic;
  resetHair(kurt.hair, x + PHYSICS.kurtRadius * 0.2, y - PHYSICS.kurtRadius * 1.3);
}

const FART_EXPRESSIONS = ["surprised", "embarrassed", "laughing"];

export function beginThrust(kurt) {
  kurt.thrusting = true;
  kurt.squash = 1;
  // always start a fresh fart on the "oh no" face
  kurt.fartExprIndex = 0;
  kurt.fartExprTimer = rand(0.22, 0.3);
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
    kurt.fartExprTimer -= dt;
    if (kurt.fartExprTimer <= 0) {
      kurt.fartExprIndex = (kurt.fartExprIndex + 1) % FART_EXPRESSIONS.length;
      kurt.fartExprTimer = rand(0.22, 0.32);
    }
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
  const localX = R * 0.2;
  const localY = -R * 1.3;
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
  const localX = -R * 0.42;
  const localY = R * 0.3;
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

  // back arm: wraps from the shoulder, behind the body, down to the
  // clasped hands gripping the shins
  drawArmCurve(ctx, R, -R * 0.08, -R * 0.4, -R * 0.46, -R * 0.02, R * 0.32, R * 0.42);

  // the whole curled torso-to-shin mass as one continuous silhouette
  // instead of overlapping ellipses — this is what actually reads as a
  // single tucked body rather than a body with balls stuck to it
  drawBodySilhouette(ctx, R);

  const wiggle = kurt.thrusting ? Math.sin(kurt.buttWigglePhase) * R * 0.04 : 0;
  drawButtCrack(ctx, R, wiggle);

  drawFoot(ctx, R, R * 0.42, R * 0.48, 0.4);
  drawFoot(ctx, R, R * 0.28, R * 0.58, 0.85);

  // front arm: wraps over the top of the thigh and down toward the shin,
  // staying inside the knee's own edge so the knee still reads as the
  // forward-most point instead of getting painted over by the arm
  drawArmCurve(ctx, R, R * 0.14, -R * 0.4, R * 0.3, -R * 0.04, R * 0.36, R * 0.4);
  drawClaspedHands(ctx, R, R * 0.34, R * 0.44);

  drawAccessoryBehindHead(ctx, R, kurt.cosmetic);

  ctx.save();
  ctx.translate(R * 0.06, -R * 0.62);
  ctx.rotate(0.34);

  ctx.fillStyle = SKIN;
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.58, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.stroke();

  drawShortHairCap(ctx, R);

  // a subtle hint of forehead shine, well short of a bald patch
  ctx.fillStyle = "rgba(255,255,255,0.09)";
  ctx.beginPath();
  ctx.ellipse(R * 0.1, -R * 0.42, R * 0.13, R * 0.08, -0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(190,120,80,0.3)";
  ctx.beginPath();
  ctx.arc(R * 0.1, R * 0.14, R * 0.36, 0.3, 2.5);
  ctx.fill();

  // ear tucked at the back of the profile
  ctx.fillStyle = SKIN_SHADE;
  ctx.beginPath();
  ctx.ellipse(-R * 0.52, R * 0.02, R * 0.13, R * 0.17, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-R * 0.5, R * 0.03, R * 0.06, 0.2, Math.PI * 1.3);
  ctx.stroke();

  // nose bump on the leading edge — this is what turns the face into a profile
  ctx.fillStyle = SKIN;
  ctx.beginPath();
  ctx.moveTo(R * 0.46, -R * 0.12);
  ctx.quadraticCurveTo(R * 0.76, -R * 0.06, R * 0.7, R * 0.09);
  ctx.quadraticCurveTo(R * 0.6, R * 0.12, R * 0.48, R * 0.06);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  const eyeY = -R * 0.08;
  const expr = kurt.thrusting ? FART_EXPRESSIONS[kurt.fartExprIndex] : "happy";

  if (expr === "embarrassed") {
    ctx.fillStyle = "rgba(230,90,90,0.4)";
    ctx.beginPath();
    ctx.ellipse(R * 0.02, R * 0.14, R * 0.13, R * 0.09, -0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  drawEye(ctx, R * 0.16, eyeY, R, kurt.blinking, expr);
  drawEyebrow(ctx, R, R * 0.16, eyeY, expr);

  ctx.fillStyle = MUSTACHE;
  ctx.beginPath();
  ctx.moveTo(R * 0.14, R * 0.14);
  ctx.quadraticCurveTo(R * 0.36, R * 0.13, R * 0.52, R * 0.22);
  ctx.quadraticCurveTo(R * 0.34, R * 0.25, R * 0.12, R * 0.22);
  ctx.closePath();
  ctx.fill();

  drawMouth(ctx, R, expr);

  drawAccessoryOnHead(ctx, R, kurt.cosmetic);

  ctx.restore();

  ctx.restore();
}

function drawBodySilhouette(ctx, R) {
  // a single closed loop: shoulder -> down the curved back -> under the
  // butt -> forward along the underside of the thigh/shin -> up the front
  // of the knee -> back over the top of the thigh -> shoulder. One shape,
  // one outline, reads as a curled body instead of a stack of balls.
  ctx.fillStyle = SKIN;
  ctx.beginPath();
  ctx.moveTo(-R * 0.08, -R * 0.5);
  ctx.quadraticCurveTo(-R * 0.58, -R * 0.35, -R * 0.5, R * 0.15);
  ctx.quadraticCurveTo(-R * 0.6, R * 0.5, -R * 0.15, R * 0.62);
  ctx.quadraticCurveTo(R * 0.15, R * 0.7, R * 0.3, R * 0.55);
  ctx.quadraticCurveTo(R * 0.38, R * 0.4, R * 0.62, R * 0.06);
  ctx.quadraticCurveTo(R * 0.4, -R * 0.18, R * 0.22, -R * 0.36);
  ctx.quadraticCurveTo(R * 0.1, -R * 0.48, -R * 0.08, -R * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.stroke();

  // knee crease, separating thigh from shin
  ctx.strokeStyle = "rgba(150,90,55,0.4)";
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.moveTo(R * 0.52, -R * 0.14);
  ctx.quadraticCurveTo(R * 0.46, R * 0.16, R * 0.3, R * 0.4);
  ctx.stroke();

  // belly fold where the torso meets the tucked thigh
  ctx.strokeStyle = "rgba(150,90,55,0.35)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(R * 0.05, -R * 0.1, R * 0.34, 0.4, 1.9);
  ctx.stroke();
}

function drawButtCrack(ctx, R, wiggle) {
  const cx = -R * 0.42 + wiggle;
  ctx.strokeStyle = "rgba(140,80,50,0.45)";
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx, R * 0.14);
  ctx.quadraticCurveTo(cx - R * 0.01, R * 0.3, cx, R * 0.46);
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

function drawEye(ctx, ex, ey, R, blinking, expr) {
  if (expr === "laughing") {
    // scrunched shut from laughing, regardless of the blink timer
    ctx.strokeStyle = "#2b2016";
    ctx.lineWidth = 1.8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(ex, ey + R * 0.04, R * 0.12, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    return;
  }
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
  let scale = 1;
  if (expr === "surprised") scale = 1.45;
  else if (expr === "embarrassed") scale = 0.55;
  const ex2 = ex, ey2 = expr === "embarrassed" ? ey + R * 0.02 : ey;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(ex2, ey2, R * 0.13 * scale, R * 0.11 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2b2016";
  ctx.beginPath();
  ctx.arc(ex2 + R * 0.02, ey2 + R * 0.01, R * 0.055 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(ex2 + R * 0.045, ey2 - R * 0.02, R * 0.018 * scale, 0, Math.PI * 2);
  ctx.fill();
}

function drawShortHairCap(ctx, R) {
  // hugs the crown and back of the head, tapering out before the ear and
  // staying well clear of the forehead — a short, close crop rather than
  // strands you'd need physics for
  ctx.fillStyle = HAIR_BASE;
  ctx.beginPath();
  ctx.moveTo(R * 0.22, -R * 0.5);
  ctx.quadraticCurveTo(R * 0.1, -R * 0.72, -R * 0.24, -R * 0.64);
  ctx.quadraticCurveTo(-R * 0.6, -R * 0.52, -R * 0.58, -R * 0.12);
  ctx.quadraticCurveTo(-R * 0.56, R * 0.14, -R * 0.36, R * 0.22);
  // receded at the temple, then a widow's-peak dip back down toward the
  // brow before receding again on the other side
  ctx.quadraticCurveTo(-R * 0.14, R * 0.02, R * 0.02, -R * 0.14);
  ctx.quadraticCurveTo(R * 0.12, -R * 0.28, R * 0.1, -R * 0.38);
  ctx.quadraticCurveTo(R * 0.18, -R * 0.46, R * 0.22, -R * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.strokeStyle = HAIR_HI;
  ctx.lineWidth = 1.3;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.moveTo(-R * 0.42, -R * 0.54);
  ctx.quadraticCurveTo(-R * 0.3, -R * 0.4, -R * 0.34, -R * 0.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-R * 0.16, -R * 0.6);
  ctx.quadraticCurveTo(-R * 0.06, -R * 0.44, -R * 0.1, -R * 0.26);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawEyebrow(ctx, R, ex, eyeY, expr) {
  ctx.strokeStyle = "rgba(120,70,40,0.5)";
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  if (expr === "surprised") {
    // shot up high, well clear of the eye
    ctx.beginPath();
    ctx.arc(ex, eyeY - R * 0.32, R * 0.13, Math.PI * 1.05, Math.PI * 1.85);
    ctx.stroke();
  } else if (expr === "embarrassed") {
    // a single awkward angled line, furrowed in toward the nose
    ctx.beginPath();
    ctx.moveTo(ex - R * 0.15, eyeY - R * 0.1);
    ctx.lineTo(ex + R * 0.13, eyeY - R * 0.2);
    ctx.stroke();
  } else if (expr === "laughing") {
    ctx.beginPath();
    ctx.arc(ex, eyeY - R * 0.22, R * 0.13, Math.PI * 1.05, Math.PI * 1.85);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(ex, eyeY - R * 0.24, R * 0.14, Math.PI * 1.15, Math.PI * 1.65);
    ctx.stroke();
  }
}

function drawMouth(ctx, R, expr) {
  const mx = R * 0.28;
  if (expr === "laughing") {
    // a wide, upturned open grin — a real cackle
    ctx.fillStyle = "#7a2020";
    ctx.beginPath();
    ctx.moveTo(mx - R * 0.19, R * 0.28);
    ctx.quadraticCurveTo(mx, R * 0.21, mx + R * 0.19, R * 0.28);
    ctx.quadraticCurveTo(mx + R * 0.15, R * 0.44, mx, R * 0.47);
    ctx.quadraticCurveTo(mx - R * 0.15, R * 0.44, mx - R * 0.19, R * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(mx, R * 0.27, R * 0.15, R * 0.045, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(mx - R * 0.19, R * 0.28);
    ctx.quadraticCurveTo(mx, R * 0.21, mx + R * 0.19, R * 0.28);
    ctx.quadraticCurveTo(mx + R * 0.15, R * 0.44, mx, R * 0.47);
    ctx.quadraticCurveTo(mx - R * 0.15, R * 0.44, mx - R * 0.19, R * 0.28);
    ctx.stroke();
  } else if (expr === "surprised") {
    // small round "oh no" mouth
    ctx.fillStyle = "#7a2020";
    ctx.beginPath();
    ctx.ellipse(mx, R * 0.35, R * 0.09, R * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.3;
    ctx.stroke();
  } else if (expr === "embarrassed") {
    // a small flat, awkward grimace
    ctx.strokeStyle = "#8a5a35";
    ctx.lineWidth = R * 0.045;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(mx - R * 0.1, R * 0.4);
    ctx.quadraticCurveTo(mx, R * 0.37, mx + R * 0.1, R * 0.4);
    ctx.stroke();
  } else {
    ctx.strokeStyle = "#5b3a24";
    ctx.lineWidth = R * 0.06;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(mx, R * 0.4, R * 0.13, Math.PI * 0.2, Math.PI * 0.8);
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
