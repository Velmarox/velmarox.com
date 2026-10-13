// Every number the fight is tuned by. All placeholders (docs/05-formula-sheet.md).
// The object is mutable on purpose: the details panel edits it live.

export const STEP_HZ = 60;
export const STEP = 1 / STEP_HZ;

export const ROOM = { w: 32, h: 18, wall: 1 };

export const tuning = {
  guyRadius: 0.5,
  guyMass: 70,
  guySpeed: 9,          // m/s
  guyAccel: 0.25,       // share of the speed gap closed per step
  iceAccel: 0.05,       // the same, on ice
  reach: 1.9,           // grab distance from the guy's centre
  holdDistance: 1.25,   // where a held object sits in front of him

  slowScale: 0.3,       // time scale inside the aim window
  aimMeterMax: 2.0,     // seconds of slow-motion
  aimRefill: 1 / 3,     // seconds regained per second when not aiming
  chargeTime: 0.8,      // seconds to full throw power
  minCharge: 0.35,      // share of top speed with no charge
  throwPower: 1.0,      // multiplier on every throw speed
  flightTime: 1.2,      // seconds a thrown thing stays airborne if it hits nothing
  flightDrag: 0.1,      // drag while airborne; on landing its own slide takes over

  shoveRange: 2.2,
  shoveArc: Math.PI / 3,
  shoveImpulse: 80,
  shoveMaxDv: 9,
  shoveCooldown: 0.6,
  shoveStun: 1.2,       // seconds a small creature stays dazed after a shove

  // Impact energy thresholds: below T1 is weak, then solid, big, massive.
  T1: 250,
  T2: 1000,
  T3: 2200,
  minImpact: 20,        // quieter than this is not reported

  guyPips: 3,
  hitSafety: 1.0,       // seconds of safety after losing a pip
  hitStagger: 0.2,      // seconds without control after a hit
  hitKnockback: 13,
  blockArc: 1.2,        // a held object blocks hits from within this angle of the aim
  hostileSpeed: 6,      // a creature's thrown object must be at least this fast to hurt

  dispenserBelow: 2,    // a crate drops when fewer free objects than this remain
  dispenserDelay: 1.5,
  respawnTime: 3,       // practice room: seconds until a broken object comes back
  bailOpens: 20,        // seconds until the exit opens

  // Telegraph wind-ups shrink with Threat but never below this many seconds.
  windupFloor: 0.5,
  windupPerThreat: 0.025,

  // Swarm: each one on you slows you; enough of them bite after a visible count.
  swarmSlow: 0.12,
  swarmSlowFloor: 0.4,
  biteCount: 3,
  biteTime: 1.0,

  iceSlide: 0.15,       // floor drag on ice, as a share of normal
  pitDamage: 3,
  shieldRegrow: 8,
  stuckMax: 3,          // Sticky Gloves: objects one creature can carry

  // Gear and injuries.
  bootsSpeed: 0.8,
  mittsPower: 0.8,
  bungeeDelay: 0.25,
  bungeeSpeed: 24,
  magnetRange: 16,
  magnetPull: 70,
  magnetSpeed: 20,
  badArm: 1.6,
  limp: 0.8,
  rattled: 0.5,
};
