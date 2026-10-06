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
    reactionIndex: -1,
    reactionHold: 0,
    reactionCooldown: 0,
    hair: createHair(),
    cosmetic: null,
    dizzy: false,
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
  kurt.reactionIndex = -1;
  kurt.reactionHold = 0;
  kurt.reactionCooldown = 0;
  kurt.dizzy = false;
  kurt.cosmetic = cosmetic;
  resetHair(kurt.hair, x + PHYSICS.kurtRadius * 0.2, y - PHYSICS.kurtRadius * 1.3);
}

// each new fart gets the next reaction in the rotation; the face and the
// sound (audio.js FART_FLAVORS / playReaction) both key off these names
export const REACTIONS = ["giggles", "relief", "surprise", "embarrassed"];

// how long a reaction face lingers after letting go, so quick taps still
// read, and the minimum gap before the next press moves the rotation on —
// frantic tapping stays on one reaction instead of strobing faces and
// stacking voices
const REACTION_HOLD = 0.45;
const REACTION_COOLDOWN = 0.55;

// returns the reaction name when this press starts a new one, else null
export function beginThrust(kurt, thrustMult = 1) {
  kurt.thrusting = true;
  if (kurt.vy > 0) kurt.vy *= PHYSICS.pressFallDamp;
  kurt.vy = Math.max(PHYSICS.maxRise, kurt.vy - PHYSICS.pressKick * thrustMult);
  kurt.squash = 1;
  burstHair(kurt.hair, 0, -1, 160);
  if (kurt.reactionCooldown > 0 && kurt.reactionIndex >= 0) {
    kurt.reactionCooldown = REACTION_COOLDOWN;
    return null;
  }
  kurt.reactionIndex = (kurt.reactionIndex + 1) % REACTIONS.length;
  kurt.reactionCooldown = REACTION_COOLDOWN;
  return REACTIONS[kurt.reactionIndex];
}

export function endThrust(kurt) {
  if (kurt.thrusting && kurt.vy < 0) kurt.vy *= PHYSICS.releaseRiseDamp;
  kurt.thrusting = false;
  kurt.reactionHold = REACTION_HOLD;
}

export function currentReaction(kurt) {
  return kurt.reactionIndex >= 0 ? REACTIONS[kurt.reactionIndex] : null;
}

export function pulseFart(kurt, intensity) {
  kurt.squash = Math.max(kurt.squash, 0.55 * clamp(intensity, 0.3, 1.5));
}

export function updateKurt(kurt, dt, gravityMult, scrollSpeed, thrustMult = 1) {
  const g = PHYSICS.gravity * gravityMult;
  const brake = kurt.vy > 0 ? PHYSICS.thrustBrakeMult : 1;
  const accel = kurt.thrusting ? g - PHYSICS.holdThrustAccel * thrustMult * brake : g;
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
  } else {
    kurt.reactionHold = Math.max(0, kurt.reactionHold - dt);
    kurt.reactionCooldown = Math.max(0, kurt.reactionCooldown - dt);
  }

  kurt.blinkTimer -= dt;
  if (kurt.blinkTimer <= 0) {
    kurt.blinking = !kurt.blinking;
    kurt.blinkTimer = kurt.blinking ? 0.09 : rand(2, 4.5);
  }

  updateKurtHair(kurt, dt, scrollSpeed);
}

// keeps the hair wisps attached to the head wherever Kurt's body goes,
// including while he's tumbling after a crash
export function updateKurtHair(kurt, dt, scrollSpeed) {
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

// where the gas leaves Kurt: the bottom of the crack on the underside of
// the butt, plus the direction it jets out (world degrees). The jet points
// away from the butt in Kurt's own frame, so it swings with his rotation:
// nose-up it fires down, nose-down it fires back and up.
const VENT_X = -0.44;
const VENT_Y = 0.8;
const VENT_ANGLE = 142; // local: back and down, straight out of the butt
export function getButtPosition(kurt) {
  const R = PHYSICS.kurtRadius;
  const rad = (kurt.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const localX = R * VENT_X;
  const localY = R * VENT_Y;
  return {
    x: kurt.x + localX * cos - localY * sin,
    y: kurt.y + localX * sin + localY * cos,
    angle: VENT_ANGLE + kurt.rotation,
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

  drawTuckBody(ctx, R, kurt.thrusting ? Math.sin(kurt.buttWigglePhase) * R * 0.04 : 0);

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
  const reacting = kurt.thrusting || kurt.reactionHold > 0;
  const expr = kurt.dizzy ? "dizzy" : reacting && currentReaction(kurt) ? currentReaction(kurt) : "happy";

  if (expr === "embarrassed") {
    ctx.fillStyle = "rgba(230,90,90,0.5)";
    ctx.beginPath();
    ctx.ellipse(R * 0.02, R * 0.14, R * 0.16, R * 0.1, -0.1, 0, Math.PI * 2);
    ctx.fill();
  } else if (expr === "giggles") {
    ctx.fillStyle = "rgba(240,120,110,0.3)";
    ctx.beginPath();
    ctx.ellipse(R * 0.04, R * 0.14, R * 0.12, R * 0.08, -0.1, 0, Math.PI * 2);
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

  if (expr === "embarrassed") drawSweatDrop(ctx, R, R * 0.4, -R * 0.3);

  drawAccessoryOnHead(ctx, R, kurt.cosmetic);

  ctx.restore();

  ctx.restore();
}

// The flying tuck: a cannonball off the diving board. Kurt faces +x.
// Built straight from the reference photos: the body stays upright with
// a rounded back, the knees are hugged up to chest height so they lead in
// front of the chin, the shins hang almost straight down from the knees
// so the feet dangle just in front of the butt, toes forward, with the
// calves tucked right up against it, and the near arm runs down the side of the thigh to a
// low elbow with the forearm crossing the shin just under the knee,
// hands clasped on the shin.
//
// Readability over anatomy: every piece is its own fully outlined
// capsule, layered back to front so each overlap draws a clean edge, and
// the layout leaves real negative space (between chin and knee, and
// in front of the shins) so the silhouette alone says "tucked" at game size.
//   far shin + far foot (shade) -> torso -> near thigh -> near shin ->
//   near foot -> near arm -> clasped hands
// Limbs are [startX, startY, controlX, controlY, endX, endY, width] in R.
const NEAR_THIGH = [-0.24, 0.56, 0.18, 0.14, 0.7, -0.14, 0.42];
const NEAR_SHIN = [0.66, -0.08, 0.58, 0.42, 0.4, 0.88, 0.3];
const FAR_SHIN = [0.6, -0.06, 0.54, 0.44, 0.36, 0.9, 0.28];
const NEAR_ARM = [0.02, -0.3, 0.16, 0.76, 0.66, 0.26, 0.26];
const LIMB_EDGE = 3.2;

function drawTuckBody(ctx, R, wiggle) {
  ctx.lineJoin = "round";

  // far leg, in shade: a second shin and foot pressed close behind the
  // near leg, so the tuck clearly has both legs hugged up together
  drawLimb(ctx, R, FAR_SHIN, SKIN_SHADE);
  drawFoot(ctx, R, 0.52, 1.04, 0.5, SKIN_SHADE);

  torsoPath(ctx, R);
  ctx.fillStyle = SKIN;
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.stroke();
  drawButtCrack(ctx, R, wiggle);

  // near leg: thigh hugged up to the chest, shin hanging from the knee
  drawLimb(ctx, R, NEAR_THIGH, SKIN);
  drawLimb(ctx, R, NEAR_SHIN, SKIN);
  drawFoot(ctx, R, 0.57, 1.0, 0.5, SKIN);

  // near arm: down the side of the thigh to a low elbow, then the forearm
  // reaches up and forward to grip the shin just below the knee
  drawLimb(ctx, R, NEAR_ARM, SKIN);
  drawClaspedHands(ctx, R, R * 0.7, R * 0.3);
}

function torsoPath(ctx, R) {
  // an upright bean: tall rounded back from the shoulders down to a round
  // butt whose underside runs forward to meet the back of the calves, so
  // no sky shows between the butt and the hanging shins
  ctx.beginPath();
  ctx.moveTo(R * 0.2, -R * 0.42);
  ctx.quadraticCurveTo(R * 0.02, -R * 0.5, -R * 0.14, -R * 0.46);
  ctx.quadraticCurveTo(-R * 0.8, -R * 0.3, -R * 0.62, R * 0.3);
  ctx.quadraticCurveTo(-R * 0.7, R * 0.88, -R * 0.3, R * 0.88);
  ctx.quadraticCurveTo(R * 0.1, R * 0.92, R * 0.32, R * 0.72);
  ctx.quadraticCurveTo(R * 0.44, R * 0.24, R * 0.38, -R * 0.24);
  ctx.quadraticCurveTo(R * 0.36, -R * 0.42, R * 0.2, -R * 0.42);
  ctx.closePath();
}

function drawButtCrack(ctx, R, wiggle) {
  // a clean, defined crack down the back of the butt: a soft wide shadow
  // with a crisp darker line inside it, curving in at the top and flaring
  // very slightly at the bottom where the gas comes out; plus a soft
  // shade under the cheek so the butt reads as round. Nothing more.
  const cx = -R * 0.5 + wiggle;
  // keep every stroke inside the body outline so nothing pokes out past
  // the edge of the butt
  ctx.save();
  torsoPath(ctx, R);
  ctx.clip();
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(140,80,50,0.28)";
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(cx + R * 0.02, R * 0.34);
  ctx.quadraticCurveTo(cx - R * 0.04, R * 0.56, cx + R * 0.05, R * 0.78);
  ctx.stroke();
  ctx.strokeStyle = "rgba(120,66,38,0.7)";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(cx + R * 0.02, R * 0.36);
  ctx.quadraticCurveTo(cx - R * 0.04, R * 0.56, cx + R * 0.05, R * 0.77);
  ctx.stroke();

  ctx.strokeStyle = "rgba(150,90,55,0.3)";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(cx - R * 0.08, R * 0.5, R * 0.3, Math.PI * 0.35, Math.PI * 0.8);
  ctx.stroke();
  ctx.restore();
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

// a foot hanging from the ankle: heel at the back under the shin, toes
// pointing forward and down the way they do in a real cannonball
function drawFoot(ctx, R, cx, cy, rot, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(R * cx, R * cy, R * 0.25, R * 0.12, rot, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.6;
  ctx.stroke();
}

// a limb is an outlined capsule along a quadratic curve, given as
// [sx, sy, cx, cy, ex, ey, width] in units of R
function drawLimb(ctx, R, [sx, sy, cx, cy, ex, ey, width], fill) {
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(R * sx, R * sy);
  ctx.quadraticCurveTo(R * cx, R * cy, R * ex, R * ey);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = R * width + LIMB_EDGE;
  ctx.stroke();
  ctx.strokeStyle = fill;
  ctx.lineWidth = R * width;
  ctx.stroke();
}

function drawEye(ctx, ex, ey, R, blinking, expr) {
  if (expr === "dizzy") {
    // knocked-out X eye
    ctx.strokeStyle = "#2b2016";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    const d = R * 0.1;
    ctx.beginPath();
    ctx.moveTo(ex - d, ey - d);
    ctx.lineTo(ex + d, ey + d);
    ctx.moveTo(ex + d, ey - d);
    ctx.lineTo(ex - d, ey + d);
    ctx.stroke();
    return;
  }
  if (expr === "relief") {
    // eyes closed in bliss: soft downward-bowed lids
    ctx.strokeStyle = "#2b2016";
    ctx.lineWidth = 1.8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(ex, ey - R * 0.03, R * 0.11, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    return;
  }
  if (expr === "giggles") {
    // scrunched shut from giggling, regardless of the blink timer
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
  if (expr === "surprise") scale = 1.45;
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
  if (expr === "surprise") {
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
  } else if (expr === "giggles") {
    ctx.beginPath();
    ctx.arc(ex, eyeY - R * 0.22, R * 0.13, Math.PI * 1.05, Math.PI * 1.85);
    ctx.stroke();
  } else if (expr === "relief") {
    // relaxed, lifted and gently arched
    ctx.beginPath();
    ctx.arc(ex, eyeY - R * 0.2, R * 0.16, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(ex, eyeY - R * 0.24, R * 0.14, Math.PI * 1.15, Math.PI * 1.65);
    ctx.stroke();
  }
}

function drawMouth(ctx, R, expr) {
  const mx = R * 0.28;
  if (expr === "dizzy") {
    // slack wobbly mouth with the tongue lolling out
    ctx.strokeStyle = "#5b3a24";
    ctx.lineWidth = R * 0.05;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(mx - R * 0.16, R * 0.36);
    ctx.quadraticCurveTo(mx - R * 0.08, R * 0.31, mx, R * 0.36);
    ctx.quadraticCurveTo(mx + R * 0.08, R * 0.41, mx + R * 0.16, R * 0.35);
    ctx.stroke();
    ctx.fillStyle = "#e0707a";
    ctx.beginPath();
    ctx.ellipse(mx + R * 0.05, R * 0.44, R * 0.07, R * 0.09, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    return;
  }
  if (expr === "relief") {
    // a loose, contented "ahhh" — soft open oval with the corners lifted
    ctx.fillStyle = "#8a3030";
    ctx.beginPath();
    ctx.ellipse(mx, R * 0.37, R * 0.13, R * 0.055, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.3;
    ctx.stroke();
    return;
  }
  if (expr === "giggles") {
    // a wide, upturned open grin — can't hold it in
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
  } else if (expr === "surprise") {
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

function drawSweatDrop(ctx, R, x, y) {
  ctx.fillStyle = "rgba(150,210,255,0.9)";
  ctx.beginPath();
  ctx.moveTo(x, y - R * 0.12);
  ctx.quadraticCurveTo(x + R * 0.08, y + R * 0.01, x, y + R * 0.05);
  ctx.quadraticCurveTo(x - R * 0.08, y + R * 0.01, x, y - R * 0.12);
  ctx.fill();
  ctx.strokeStyle = "rgba(70,130,190,0.7)";
  ctx.lineWidth = 1;
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
