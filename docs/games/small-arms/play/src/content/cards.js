// The three decks dealt from at the end of every round, and what's in them. Data only;
// dealing is in game/run.js and the effects are in sim/effects.js.
// Each deck holds 15 cards. One card from each is shown; he takes one.

import { WEAPON_ORDER, STARTER_WEAPONS } from './weapons.js';

// ----- abilities: active, on a cooldown, three at most, gone when the run ends -----
export const ABILITIES = {
  shockwave: { name: 'Shockwave', text: 'Blasts everything near you away and hurts it.', cooldown: 9, icon: 'ring' },
  frag:      { name: 'Frag Out', text: 'Throws a grenade where you aim.', cooldown: 6, icon: 'ball' },
  turret:    { name: 'Turret', text: 'Drops a little turret that shoots for 10 seconds.', cooldown: 18, icon: 'tower' },
  overdrive: { name: 'Overdrive', text: 'Double attack speed for 5 seconds.', cooldown: 16, icon: 'bolt' },
  bubble:    { name: 'Bubble', text: 'Nothing can hurt you for 2.5 seconds.', cooldown: 18, icon: 'bubble' },
  slowmo:    { name: 'Slow-Mo', text: 'Creatures and their shots slow to a crawl for 4 seconds.', cooldown: 20, icon: 'clock' },
  blink:     { name: 'Blink', text: 'Teleports you to where you aim.', cooldown: 7, icon: 'arrow' },
  pound:     { name: 'Belly Flop', text: 'Jump and land where you aim, stunning what you land near.', cooldown: 12, icon: 'drop' },
  decoy:     { name: 'Decoy', text: 'An inflatable you that creatures chase for 5 seconds.', cooldown: 16, icon: 'guy' },
  mines:     { name: 'Mine Layer', text: 'Scatters three mines around you.', cooldown: 12, icon: 'mine' },
  zap:       { name: 'Chain Zap', text: 'Lightning that jumps between five creatures.', cooldown: 8, icon: 'bolt' },
  freeze:    { name: 'Cold Snap', text: 'Freezes everything near you for 2 seconds.', cooldown: 15, icon: 'flake' },
  bottomless:{ name: 'Bottomless', text: 'No reloading and no ammo used for 5 seconds.', cooldown: 18, icon: 'ammo' },
  vampire:   { name: 'Thirsty', text: 'For 6 seconds, every hit heals you a little.', cooldown: 18, icon: 'drop' },
  secondwind:{ name: 'Second Wind', text: 'Heals 30.', cooldown: 30, icon: 'heart' },
};
export const MAX_ABILITIES = 3;

// ----- powers: single use, three at most, gone when the run ends -----
// rarity sets how often the slot machine pays one out.
export const POWERS = {
  medkit:    { name: 'Med Kit', text: 'Heals 40.', rarity: 'common' },
  grenade:   { name: 'Big Grenade', text: 'A huge blast where you aim.', rarity: 'common' },
  adrenaline:{ name: 'Adrenaline', text: 'Faster feet and faster attacks for 8 seconds.', rarity: 'common' },
  plate:     { name: 'Armour Plate', text: 'Soaks up the next 50 damage.', rarity: 'common' },
  coinbag:   { name: 'Coin Bag', text: '+150 coins, right now.', rarity: 'common' },
  ammo:      { name: 'Ammo Crate', text: 'Reloads everything, then 8 seconds of free ammo.', rarity: 'common' },
  smoke:     { name: 'Smoke Bomb', text: 'Creatures lose you and go for the smoke for 4 seconds.', rarity: 'common' },
  icebomb:   { name: 'Ice Bomb', text: 'Freezes everything where you aim for 3 seconds.', rarity: 'common' },
  molotov:   { name: 'Molotov', text: 'A patch of fire where you aim, for 6 seconds.', rarity: 'common' },
  rage:      { name: 'Rage Pill', text: 'Double damage for 8 seconds.', rarity: 'uncommon' },
  tesla:     { name: 'Tesla Coil', text: 'A coil that zaps anything close for 12 seconds.', rarity: 'uncommon' },
  airstrike: { name: 'Airstrike', text: 'Five blasts walk down a line toward where you aim.', rarity: 'uncommon' },
  mystery:   { name: 'Mystery Box', text: 'Turns into a random power when used.', rarity: 'uncommon' },
  revive:    { name: 'Spare Heart', text: 'Used by itself if you go down: back up with half health.', rarity: 'rare' },
  nuke:      { name: 'Party Popper', text: 'Hits every creature on the floor, hard.', rarity: 'rare' },
};
export const MAX_POWERS = 3;

// ----- the decks -----
export const DECKS = {
  weapon: WEAPON_ORDER.filter((id) => !STARTER_WEAPONS.includes(id)),
  ability: Object.keys(ABILITIES),
  power: Object.keys(POWERS),
};
export const DECK_NAMES = { weapon: 'Weapon', ability: 'Ability', power: 'Power' };
