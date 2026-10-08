export const WORLD = {
  aspect: 0.5625,
  pxPerMeter: 45,
};

export const PHYSICS = {
  gravity: 1350,
  holdThrustAccel: 2500,
  // a fresh press kills most of the fall and adds a small hop, so Kurt
  // answers the instant you touch instead of sinking for half a second
  pressFallDamp: 0.4,
  pressKick: 140,
  // extra push while still falling, so holding reverses a dive quickly
  thrustBrakeMult: 1.6,
  // letting go mid-climb trims the rise, so quick taps make small hops
  releaseRiseDamp: 0.65,
  fartTickInterval: 0.12,
  maxFall: 920,
  maxRise: -700,
  rotationLerp: 10,
  maxRotationDown: 78,
  maxRotationUp: -32,
  kurtRadius: 26,
  kurtX: 0.3,
};

export const SCROLL = {
  baseSpeed: 165,
  maxSpeed: 340,
  speedGrowthPerMeter: 0.05,
  spawnBaseInterval: 1.55,
  spawnMinInterval: 1.05,
};

export const OBSTACLES = {
  baseGap: 235,
  minGap: 150,
  gapShrinkPerMeter: 0.021,
  width: 62,
};

export const GRADES = [
  { code: "F0", name: "Beginner Breeze", meters: 0 },
  { code: "F1", name: "Slightly Gassy", meters: 300 },
  { code: "F2", name: "Trouser Thunder", meters: 700 },
  { code: "F3", name: "Gastrointestinal", meters: 1200 },
  { code: "F4", name: "Unholy Pressure", meters: 1800 },
  { code: "F5", name: "Flatulence Master", meters: 2500 },
  { code: "F6", name: "Human Jet Engine", meters: 3300 },
  { code: "F7", name: "Ascended Gasbag", meters: 4200 },
];

export const THEMES = [
  { key: "trees", from: 0 },
  { key: "scaffolding", from: 300 },
  { key: "power-lines", from: 700 },
  { key: "buildings", from: 1200 },
  { key: "cacti", from: 1800 },
  { key: "towers", from: 2500 },
  { key: "chaos", from: 3300 },
];

export const POWERUPS = {
  spawnChance: 0.012,
  minGapBetween: 8,
  // every pickup helps: each timed one makes flying easier for a while and
  // also restores a little dignity; pancakes are a big dignity refill
  types: {
    burrito: {
      label: "BEAN BURRITO",
      blurb: "STEADY GAS",
      duration: 8,
      // gentler, floatier farts: easier to hold a line through a gap
      thrustMult: 0.85,
      gravityMult: 0.72,
      dignityBonus: 10,
      color: "#c68a3a",
      icon: "burrito",
    },
    shake: {
      label: "PROTEIN SHAKE",
      blurb: "FART SHIELD",
      duration: 10,
      // shrugs off one crash, then it's used up
      shield: true,
      dignityBonus: 10,
      color: "#e7e4da",
      icon: "shake",
    },
    taco: {
      label: "TACO TUESDAY",
      blurb: "SLOW-MO",
      duration: 6.5,
      speedMult: 0.65,
      dignityBonus: 10,
      color: "#ffcd3c",
      icon: "taco",
    },
    hotsauce: {
      label: "HOT SAUCE",
      blurb: "SKINNY KURT",
      duration: 8,
      // Kurt sweats it out and squeezes through tighter gaps
      hitScale: 0.6,
      dignityBonus: 10,
      color: "#e0331f",
      icon: "hotsauce",
    },
    gasx: {
      label: "GAS-X",
      blurb: "FEATHER FLOAT",
      duration: 8,
      thrustMult: 0.65,
      gravityMult: 0.55,
      dignityBonus: 10,
      color: "#8fd6c8",
      icon: "gasx",
    },
    pancakes: {
      label: "STACK OF PANCAKES",
      instant: true,
      dignityBonus: 30,
      color: "#e8a33d",
      icon: "pancakes",
    },
  },
};

export const DIGNITY = {
  nearMissLoss: 3,
  collisionLoss: 35,
  nearMissDistance: 16,
  // dignity seeps away as Kurt flies, faster the farther he gets:
  // points lost per meter = drainBase + meters * drainGrowth
  // Kurt flies ~4 m/s, so that's about 15 dignity a second at the start and
  // ~30 by 1000m: on his own he'd be naked in about 6 seconds. Clean
  // passes, snacks and clothing pickups pull it back, so his clothes are
  // always coming off and going back on.
  drainBase: 4.0,
  drainGrowth: 0.0024,
  // dignity earned back for flying clean: every gap passed without a
  // near-miss, plus a bonus every 5 in a row
  cleanPassGain: 2,
  streakGain: 5,
  // what the protein shake's shield costs when it saves Kurt
  shieldLoss: 10,
};

export const COSMETICS = [
  { id: "classic", name: "Classic Kurt", unlockMeters: 0, accent: "#ff5a3c", accessory: null },
  { id: "business", name: "Business Kurt", unlockMeters: 300, accent: "#33415c", accessory: "tie" },
  { id: "cowboy", name: "Cowboy Kurt", unlockMeters: 700, accent: "#a5673f", accessory: "cowboy" },
  { id: "viking", name: "Viking Kurt", unlockMeters: 1200, accent: "#6b7280", accessory: "viking" },
  { id: "disco", name: "Disco Kurt", unlockMeters: 1800, accent: "#c026d3", accessory: "disco" },
  { id: "greek", name: "Ancient Greek Kurt", unlockMeters: 2500, accent: "#e8e2d0", accessory: "laurel" },
  { id: "astro", name: "Astronaut Kurt", unlockMeters: 3300, accent: "#d9dde3", accessory: "astro" },
];

export const STORAGE_KEYS = {
  best: "kurt.bestDistance",
  bestStreak: "kurt.bestStreak",
  grade: "kurt.highestGrade",
  farts: "kurt.lifetimeFarts",
  muted: "kurt.muted",
  cosmetic: "kurt.cosmetic",
  musicMuted: "kurt.musicMuted",
  runs: "kurt.runs",
};
