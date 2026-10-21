// Everything that lasts between runs: weapon XP and the permanent ranks it buys, runes and
// which weapon each is infused into, hats, skins, and slot tokens. No DOM here.
// Each change returns { ok, why } and changes meta only when ok.

import { MASTERY, MASTERY_MAX, masteryCost, masteryKeys, WEAPONS } from '../content/weapons.js';
import { HATS, SKINS, RUNES, DEFAULT_SKIN } from '../content/loot.js';

export function freshMeta() {
  return {
    xp: {},          // weapon id -> unspent XP
    ranks: {},       // weapon id -> { damage, rate, mag, reload, reach }
    runes: {},       // rune id -> how many are waiting to be infused
    infused: {},     // weapon id -> rune id
    hats: [],
    hat: null,
    skins: [DEFAULT_SKIN],
    skin: DEFAULT_SKIN,
    tokens: 3,       // a few to try the machine with
    spins: 0,
  };
}

const no = (why) => ({ ok: false, why });

export const hatBonus = (meta) => (meta.hat && HATS[meta.hat] ? HATS[meta.hat].bonus : {});
export const rankOf = (meta, id, key) => meta.ranks[id]?.[key] ?? 0;

export function canBuyRank(meta, id, key) {
  if (!WEAPONS[id] || !masteryKeys(id).includes(key)) return no('Not for this weapon');
  const rank = rankOf(meta, id, key);
  if (rank >= MASTERY_MAX) return no('Maxed');
  if ((meta.xp[id] ?? 0) < masteryCost(rank)) return no('Not enough XP');
  return { ok: true };
}
export function buyRank(meta, id, key) {
  const check = canBuyRank(meta, id, key);
  if (!check.ok) return check;
  const rank = rankOf(meta, id, key);
  meta.xp[id] -= masteryCost(rank);
  meta.ranks[id] = { ...meta.ranks[id], [key]: rank + 1 };
  return { ok: true };
}

// Infusing is for good, but a rune swapped out goes back in the bag rather than being lost.
export function infuse(meta, weapon, rune) {
  if (!WEAPONS[weapon]) return no('No such weapon');
  if (!RUNES[rune] || !(meta.runes[rune] > 0)) return no('No rune of that kind');
  if (meta.infused[weapon] === rune) return no('Already infused');
  const old = meta.infused[weapon];
  if (old) meta.runes[old] = (meta.runes[old] ?? 0) + 1;
  meta.runes[rune]--;
  meta.infused[weapon] = rune;
  return { ok: true };
}

export function equipHat(meta, hat) {
  if (hat !== null && !meta.hats.includes(hat)) return no('Not yours yet');
  meta.hat = hat;
  return { ok: true };
}
export function equipSkin(meta, skin) {
  if (!meta.skins.includes(skin) || !SKINS[skin]) return no('Not yours yet');
  meta.skin = skin;
  return { ok: true };
}

export { MASTERY };
