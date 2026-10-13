// Creature roles and elite modifiers. Data only; behaviour is in sim/creatures.js.
// r is the real collision radius, which is also how big it is drawn.
// toughness divides impact energy before it is read as a tier.
// size: 1 small (liftable when stunned), 2 medium (liftable with Big Mitts), 3 large, 4 huge.

export const CREATURES = {
  charger: {
    name: 'Charger', ask: 'Where do I stand?', score: 100,
    r: 0.85, pips: 4, mass: 40, toughness: 4, slide: 4, size: 2, throwSpeed: 12,
    stalkSpeed: 2.2, stalkTime: 1.3, turnRate: 3, keepAway: 7,
    windup: 1.0, chargeSpeed: 20, chargeMax: 2.5, stallSpeed: 5,
    stunCrash: 2.0, stunStagger: 1.0, stunStall: 0.8,
  },
  spitter: {
    name: 'Spitter', ask: 'Chase it, or make it come to me?', score: 80,
    r: 0.45, pips: 2, mass: 8, toughness: 1, slide: 3, size: 1, throwSpeed: 22,
    speed: 4.6, keepMin: 7, keepMax: 11, cooldown: 2.6, windup: 1.15, blast: 1.7,
    stunStagger: 1.6, stunAny: true,
  },
  swarm: {
    name: 'Swarm', ask: 'How do I hit many at once?', score: 100, count: 8,
    r: 0.25, pips: 1, mass: 2, toughness: 0.3, slide: 2, size: 1, throwSpeed: 26,
    speed: 5.0, stunStagger: 0.5,
  },
  thrower: {
    name: 'Thrower', ask: 'Do I leave objects lying near it?', score: 120,
    r: 0.7, pips: 3, mass: 30, toughness: 3, slide: 4, size: 2, throwSpeed: 14,
    speed: 4.2, keepAway: 6, aimTime: 0.4, windup: 0.9, rest: 0.7, throwPower: 0.85,
    stunStagger: 1.4,
  },
  shell: {
    name: 'Shell', ask: 'How do I get behind it?', score: 140,
    r: 1.0, pips: 4, mass: 70, toughness: 4, slide: 5, size: 3, throwSpeed: 8,
    speed: 2.4, turnRate: 1.5, range: 9, windup: 0.8, lungeSpeed: 15, lungeTime: 0.55, rest: 1.2,
    // Armoured across the front: half-angle of the arc, in radians.
    armour: 1.75, stunCrash: 2.6, stunStagger: 1.0,
  },
  // Every fifth Threat. Three phases, so it is never one trick.
  bigone: {
    name: 'Big One', ask: 'What changes as it gets hurt?', score: 400,
    r: 1.6, pips: 10, mass: 200, toughness: 8, slide: 5, size: 4, throwSpeed: 6,
    stalkSpeed: 2.6, stalkTime: 1.0, turnRate: 2.4, keepAway: 8,
    windup: 1.1, chargeSpeed: 19, chargeMax: 2.5, stallSpeed: 4,
    stunCrash: 2.2, stunStagger: 0.8, stunStall: 0.8, blast: 1.9, volley: 3, summon: 3,
  },
  // The tutorial and practice target. It does nothing.
  dummy: {
    name: 'Dummy', ask: '', score: 0,
    r: 0.9, pips: 3, mass: 60, toughness: 1, slide: 3, size: 4, throwSpeed: 6, stunStagger: 0,
  },
};

export const MODIFIERS = {
  heavy:     { name: 'Heavy',     text: 'Bigger, heavier, and one pip tougher.' },
  spiky:     { name: 'Spiky',     text: 'Touching it hurts. It cannot be picked up.' },
  splitting: { name: 'Splitting', text: 'Splits into two smaller ones when beaten.' },
  shielded:  { name: 'Shielded',  text: 'Shrugs off the first hit. The shield grows back.' },
};

export const STARTER_CREATURES = ['charger', 'spitter', 'swarm'];
