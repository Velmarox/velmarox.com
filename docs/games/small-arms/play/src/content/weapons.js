// The weapons. Data only; firing and swinging are in sim/world.js, the models come from the
// weapon pack, and the way he holds each one is set by its class:
//   handgun: held out in front in both little fists
//   long:    he turns side-on and shoulders it along the aim
//   melee:   swung in an arc, thrust straight, or (style 'saw') held out and run
//
// Guns: damage is per bullet; rate is shots a second; spread is the cone half-angle in
// radians; life is how long a bullet flies (so it sets the range); pierce is how many extra
// creatures one bullet goes through; blast is an explosion radius; knock is shove per hit.
// Melee: rate is swings a second; reach is how far it hits from his middle; arc is the
// half-angle it covers. Melee ignores the Shell's armour and knocks shots out of the air.
// size is the model's length in the pack, which sets where the muzzle is.
// value sets what upgrades cost. xp is earned per kill with the weapon.

export const WEAPONS = {
  pistol: {
    name: 'Pea Shooter', blurb: 'Your first gun. Reliable, polite.', class: 'handgun', value: 120, size: 1.26, sound: 'pistol',
    damage: 12, rate: 4.2, mag: 12, reload: 0.9, spread: 0.04, speed: 34, life: 0.6, knock: 3,
  },
  knife: {
    name: 'Butter Knife', blurb: 'Quick stabs up close.', class: 'melee', style: 'thrust', value: 120, size: 2.59, sound: 'stab',
    damage: 24, rate: 3.2, reach: 1.35, arc: 0.55, knock: 4,
  },
  revolver: {
    name: 'Big Iron', blurb: 'Six heavy rounds that go through the first one.', class: 'handgun', value: 200, size: 1.82, sound: 'revolver',
    damage: 36, rate: 2.2, mag: 6, reload: 1.5, spread: 0.02, speed: 42, life: 0.7, knock: 8, pierce: 1,
  },
  smg: {
    name: 'Buzzbox', blurb: 'Sprays and prays. Mostly sprays.', class: 'handgun', value: 260, size: 1.89, sound: 'smg',
    damage: 8, rate: 12, mag: 32, reload: 1.3, spread: 0.12, speed: 32, life: 0.5, knock: 1.4,
  },
  sawnoff: {
    name: 'Sawn-Off', blurb: 'Two barrels. Point it at whatever is closest.', class: 'long', value: 320, size: 3.21, sound: 'shotgun',
    damage: 10, pellets: 7, rate: 3, mag: 2, reload: 1.3, spread: 0.36, speed: 28, life: 0.3, knock: 3.5,
  },
  pump: {
    name: 'Pump Action', blurb: 'Eight pellets, a good shove, and a long reload.', class: 'long', value: 600, size: 5.42, sound: 'shotgun',
    damage: 12, pellets: 8, rate: 1.4, mag: 6, reload: 2.1, spread: 0.24, speed: 30, life: 0.42, knock: 4.5,
  },
  spas: {
    name: 'Street Sweeper', blurb: 'A shotgun that keeps going.', class: 'long', value: 1300, size: 4.46, sound: 'shotgun',
    damage: 12, pellets: 8, rate: 3.2, mag: 8, reload: 2.4, spread: 0.26, speed: 30, life: 0.42, knock: 4,
  },
  rifle: {
    name: 'Rattler', blurb: 'An assault rifle. Every round goes through one creature.', class: 'long', value: 900, size: 4.97, sound: 'rifle',
    damage: 19, rate: 7.5, mag: 30, reload: 1.8, spread: 0.045, speed: 46, life: 0.75, knock: 2.6, pierce: 1,
  },
  aug: {
    name: 'Bullpup', blurb: 'Fast, accurate, and goes through two.', class: 'long', value: 1700, size: 4.08, sound: 'rifle',
    damage: 26, rate: 7, mag: 30, reload: 1.9, spread: 0.025, speed: 52, life: 0.8, knock: 3, pierce: 2,
  },
  awm: {
    name: 'Long Talk', blurb: 'One shot. Goes through everything in a line.', class: 'long', value: 2100, size: 7.18, sound: 'sniper',
    damage: 170, rate: 0.9, mag: 5, reload: 2.8, spread: 0, speed: 90, life: 0.6, knock: 14, pierce: 8,
  },
  m60: {
    name: 'Lawnmower', blurb: 'One hundred rounds. Lean on the trigger.', class: 'long', value: 2500, size: 6.54, sound: 'heavy',
    damage: 19, rate: 13, mag: 100, reload: 4.2, spread: 0.1, speed: 44, life: 0.7, knock: 2.4, pierce: 1,
  },
  m79: {
    name: 'Thumper', blurb: 'Lobs a grenade that bursts where you aim.', class: 'long', value: 1500, size: 3.92, sound: 'launcher',
    damage: 70, rate: 1.3, mag: 1, reload: 1.1, spread: 0.02, speed: 19, life: 1.6, knock: 10, blast: 2.6, lob: true,
  },
  bazooka: {
    name: 'Big Problem', blurb: 'A rocket. A big one. Mind the splash.', class: 'long', value: 3200, size: 7.0, sound: 'rocket',
    damage: 190, rate: 0.75, mag: 1, reload: 2.0, spread: 0.01, speed: 15, accel: 40, maxSpeed: 34, life: 1.4, knock: 18, blast: 3.8,
  },
  bat: {
    name: 'Slugger', blurb: 'Big swings that send things flying.', class: 'melee', style: 'swing', value: 400, size: 4.9, sound: 'whoosh',
    damage: 40, rate: 1.8, reach: 1.75, arc: 1.3, knock: 14,
  },
  katana: {
    name: 'Night Blade', blurb: 'Fast, wide cuts.', class: 'melee', style: 'swing', value: 1100, size: 5.09, sound: 'slice',
    damage: 46, rate: 2.6, reach: 1.9, arc: 1.2, knock: 4,
  },
  spear: {
    name: 'Long Poke', blurb: 'A long thrust through everything in front.', class: 'melee', style: 'thrust', value: 900, size: 6.69, sound: 'stab',
    damage: 55, rate: 1.6, reach: 2.8, arc: 0.3, knock: 8,
  },
  chainsaw: {
    name: 'Brrrt', blurb: 'Hold it out and lean in.', class: 'melee', style: 'saw', value: 1600, size: 4.34, sound: 'saw',
    damage: 11, rate: 12, reach: 1.6, arc: 0.6, knock: 1.2,
  },
};

export const WEAPON_ORDER = Object.keys(WEAPONS);
export const STARTER_WEAPONS = ['pistol', 'knife'];
export const MAX_WEAPONS = 4;
export const MAX_LEVEL = 5;

export const isMelee = (id) => WEAPONS[id].class === 'melee';

// Permanent ranks bought with weapon XP. Guns and melee weapons train different things.
export const MASTERY = {
  damage: { name: 'Damage', per: 0.07, for: 'all' },
  rate:   { name: 'Speed', per: 0.045, for: 'all' },
  mag:    { name: 'Magazine', per: 0.1, for: 'gun' },
  reload: { name: 'Reload', per: 0.06, for: 'gun' },
  reach:  { name: 'Reach', per: 0.07, for: 'melee' },
};
export const MASTERY_MAX = 5;
export const masteryCost = (rank) => Math.round(60 * Math.pow(rank + 1, 1.6) / 5) * 5;
export const masteryKeys = (id) => Object.keys(MASTERY).filter((k) => MASTERY[k].for === 'all' || MASTERY[k].for === (isMelee(id) ? 'melee' : 'gun'));

// A weapon's numbers: its run level (bought with coins once a duplicate unlocks it), its
// permanent ranks, and anything his hat or buffs add. Level 1 is as dealt.
export function weaponStats(id, level = 1, ranks = {}, bonus = {}) {
  const w = WEAPONS[id];
  const up = level - 1;
  const r = (k) => ranks[k] ?? 0;
  const melee = w.class === 'melee';
  const out = {
    ...w,
    damage: w.damage * Math.pow(1.2, up) * (1 + MASTERY.damage.per * r('damage')) * (w.class === 'handgun' ? 1 + (bonus.handgun ?? 0) : 1),
    rate: w.rate * Math.pow(1.07, up) * (1 + MASTERY.rate.per * r('rate')),
  };
  if (melee) {
    out.reach = w.reach * (1 + 0.04 * up) * (1 + MASTERY.reach.per * r('reach'));
  } else {
    const magScale = Math.pow(1.15, up) * (1 + MASTERY.mag.per * r('mag'));
    out.mag = w.mag === 1 ? 1 + Math.floor((up + r('mag')) / 3) : Math.round(w.mag * magScale);
    out.reload = w.reload * Math.pow(0.93, up) * (1 - MASTERY.reload.per * r('reload')) * (1 - (bonus.reload ?? 0));
  }
  return out;
}

// What the next run level costs in coins.
export const upgradeCost = (id, level) => Math.round(Math.max(60, WEAPONS[id].value * 0.4) * level / 10) * 10;

// Where the muzzle is, forward of the hand, in metres. Matches the drawn models.
export const barrel = (id) => 0.31 * Math.sqrt(WEAPONS[id].size / 1.26);

// Damage a second, for comparing on cards.
export function dps(s) {
  if (s.class === 'melee') return s.damage * s.rate;
  const perShot = s.damage * (s.pellets ?? 1);
  return (perShot * s.mag) / (s.mag / s.rate + s.reload);
}
