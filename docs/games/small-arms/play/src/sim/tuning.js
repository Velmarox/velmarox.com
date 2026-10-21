// Every number the fight is tuned by that isn't a gun or a creature.
// The object is mutable on purpose: the live tuning panel (T in a fight) edits it.

export const STEP_HZ = 60;
export const STEP = 1 / STEP_HZ;

export const ROOM = { w: 32, h: 18 };

export const tuning = {
  guyRadius: 0.5,
  guyHp: 100,
  guySpeed: 8.5,        // m/s
  guyAccel: 0.22,       // share of the speed gap closed per step
  dashSpeed: 23,
  dashTime: 0.16,
  dashCooldown: 1.0,
  hitSafety: 0.8,       // seconds he can't be hurt after a hit
  hitKnockback: 11,

  // Coins: picked up inside this radius, pulled in from the magnet radius.
  pickup: 0.7,
  magnet: 2.6,
  coinPull: 22,

  aliveCap: 16,         // most creatures on the floor at once; the rest wait their turn
  spawnWarn: 0.9,       // seconds a spawn marker shows before a creature arrives
  stunDamage: 1.5,      // a stunned creature takes this much more damage
  friction: 7,          // how fast a shoved creature slows down

  hpPerWave: 0.16,      // creature health grows this share each wave
  speedPerWave: 0.012,  // and a little speed, capped below
  speedCap: 1.3,
  cashPerWave: 0.1,
  coinScale: 0.5,       // with no shop, coins only buy upgrades and slot tokens
};
