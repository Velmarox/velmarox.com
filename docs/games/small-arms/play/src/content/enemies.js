// The creatures, the same five (and the Big One) as Contract Zero, retuned for bullets.
// Data only; behaviour is in sim/enemies.js. r is the collision radius and how big it is
// drawn. hp grows each wave (tuning.hpPerWave). cash is what it drops on wave 1.
// touch is damage for walking into the guy; hit is damage from its attack. xp goes to the
// weapon that finishes it.

export const ENEMIES = {
  swarm: {
    name: 'Swarm', blurb: 'Small, fast, and never alone.', cost: 4, from: 1, count: 6,
    r: 0.27, hp: 12, mass: 1, speed: 5.4, touch: 5, cash: 4, xp: 2,
  },
  charger: {
    name: 'Charger', blurb: 'Warns down a line, then runs it. Dodge, and it hits the wall.', cost: 4, from: 1,
    r: 0.85, hp: 62, mass: 8, speed: 2.4, touch: 8, hit: 24, cash: 22, xp: 8,
    stalkTime: 1.6, turnRate: 3, keepAway: 5, windup: 0.9, chargeSpeed: 19, chargeMax: 2.2, stun: 1.8,
  },
  spitter: {
    name: 'Spitter', blurb: 'Keeps its distance and lobs goo where you stand.', cost: 3, from: 2,
    r: 0.45, hp: 30, mass: 2, speed: 4.4, touch: 6, hit: 18, cash: 16, xp: 5,
    keepMin: 7, keepMax: 11, cooldown: 2.8, windup: 0.7, glob: 1.0, blast: 1.6,
  },
  thrower: {
    name: 'Thrower', blurb: 'Hurls rocks in a straight line. Step aside.', cost: 4, from: 3,
    r: 0.7, hp: 52, mass: 5, speed: 3.8, touch: 8, hit: 16, cash: 20, xp: 7,
    keepAway: 8, cooldown: 2.4, windup: 0.75, rockSpeed: 17,
  },
  shell: {
    name: 'Shell', blurb: 'Bullets bounce off its front. Get round the side.', cost: 7, from: 6,
    r: 1.0, hp: 120, mass: 14, speed: 2.2, touch: 6, hit: 20, cash: 34, xp: 12,
    turnRate: 1.3, range: 7, windup: 0.8, lungeSpeed: 15, lungeTime: 0.5, rest: 1.6,
    armour: 0.95, // half-angle of the armoured front, in radians
  },
  // Every fifth wave. Three phases, so it is never one trick.
  bigone: {
    name: 'Big One', blurb: 'Charges, then spits, then calls the swarm.', cost: 0, from: 5,
    r: 1.6, hp: 1400, mass: 60, speed: 2.7, touch: 15, hit: 30, cash: 320, xp: 120,
    stalkTime: 1.2, turnRate: 2.4, keepAway: 6, windup: 1.0, chargeSpeed: 18, chargeMax: 2.4, stun: 1.6,
    cooldown: 2.4, glob: 1.1, blast: 1.9, volley: 3, summon: 5,
  },
};

export const MODIFIERS = {
  heavy:     { name: 'Heavy',     text: 'Bigger, slower, and much tougher.' },
  spiky:     { name: 'Spiky',     text: 'Touching it hurts twice as much.' },
  splitting: { name: 'Splitting', text: 'Splits into two smaller ones when beaten.' },
  shielded:  { name: 'Shielded',  text: 'A bubble soaks up damage, and grows back.' },
};

export const MOD_ORDER = Object.keys(MODIFIERS);
