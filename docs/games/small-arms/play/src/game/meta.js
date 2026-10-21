// Everything that lasts between runs: weapon XP and the permanent ranks it buys, runes and
// which weapon each is infused into, hats, skins, and slot tokens. No DOM here.
// Each change returns { ok, why } and changes meta only when ok.

import { MASTERY, MASTERY_MAX, masteryCost, masteryKeys, WEAPONS } from '../content/weapons.js';
import { HATS, SKINS, RUNES, DEFAULT_SKIN, RUNE_TIERS, MERGE_COUNT, SOCKET_COST } from '../content/loot.js';

export function freshMeta() {
  return {
    xp: {},          // weapon id -> unspent XP
    ranks: {},       // weapon id -> { damage, rate, mag, reload, reach }
    runes: {},       // rune id -> [tier I, II, III] waiting to be infused
    infused: {},     // weapon id -> [socket 1, socket 2] of { id, tier } or null
    sockets: {},     // weapon id -> sockets open, when a second has been bought
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

// ----- runes -----
// meta.runes: rune id -> [tier I, tier II, tier III] counts in the bag.
// meta.infused: weapon id -> [socket 1, socket 2], each { id, tier } or null. Tiers count from 0.
// meta.sockets: weapon id -> how many sockets it has open (1 until a second is bought).
export const runeCount = (meta, id, tier) => meta.runes[id]?.[tier] ?? 0;
export const socketsOf = (meta, weapon) => meta.sockets?.[weapon] ?? 1;
export const socketRune = (meta, weapon, socket) => meta.infused[weapon]?.[socket] ?? null;
// The runes in a weapon, for the fight: [{ id, tier }], first socket first.
export const infusedRunes = (meta, weapon) => (meta.infused[weapon] ?? []).filter(Boolean).map((r) => ({ ...r }));
// The highest tier of a rune in the bag, or -1 with none.
export function bestTier(meta, id) {
  for (let t = RUNE_TIERS - 1; t >= 0; t--) if (runeCount(meta, id, t) > 0) return t;
  return -1;
}
const addRune = (meta, id, tier, n = 1) => {
  const counts = meta.runes[id] ?? Array(RUNE_TIERS).fill(0);
  counts[tier] = (counts[tier] ?? 0) + n;
  meta.runes[id] = counts;
};

// Infusing is for good, but a rune swapped out goes back in the bag rather than being lost.
// With no tier given it uses the best one in the bag. Two sockets can't hold the same kind.
export function infuse(meta, weapon, rune, socket = 0, tier = bestTier(meta, rune)) {
  if (!WEAPONS[weapon]) return no('No such weapon');
  if (!RUNES[rune] || !(tier >= 0) || runeCount(meta, rune, tier) < 1) return no('No rune of that kind');
  if (!(socket >= 0 && socket < socketsOf(meta, weapon))) return no('Socket not open');
  const slots = [...(meta.infused[weapon] ?? [null, null])];
  const here = slots[socket];
  if (here && here.id === rune && here.tier >= tier) return no('Already infused');
  if (slots.some((r, i) => i !== socket && r?.id === rune)) return no('Already in the other socket');
  if (here) addRune(meta, here.id, here.tier);
  meta.runes[rune][tier]--;
  slots[socket] = { id: rune, tier };
  meta.infused[weapon] = slots;
  return { ok: true };
}
export function takeOut(meta, weapon, socket) {
  const here = socketRune(meta, weapon, socket);
  if (!here) return no('Nothing there');
  addRune(meta, here.id, here.tier);
  meta.infused[weapon][socket] = null;
  return { ok: true };
}

// Three of a tier make one of the next.
export function canMerge(meta, id, tier) {
  if (!RUNES[id] || !(tier >= 0 && tier < RUNE_TIERS - 1)) return no('Can\'t merge that');
  if (runeCount(meta, id, tier) < MERGE_COUNT) return no(`Needs ${MERGE_COUNT}`);
  return { ok: true };
}
export function mergeRunes(meta, id, tier) {
  const check = canMerge(meta, id, tier);
  if (!check.ok) return check;
  meta.runes[id][tier] -= MERGE_COUNT;
  addRune(meta, id, tier + 1);
  return { ok: true };
}

// A second socket costs tier I runes of any kind, the most plentiful kinds first.
const spareFirst = (meta) => Object.keys(RUNES).filter((id) => runeCount(meta, id, 0) > 0).sort((a, b) => runeCount(meta, b, 0) - runeCount(meta, a, 0));
export const spareRunes = (meta) => Object.keys(RUNES).reduce((n, id) => n + runeCount(meta, id, 0), 0);
export function canOpenSocket(meta, weapon) {
  if (!WEAPONS[weapon]) return no('No such weapon');
  if (socketsOf(meta, weapon) >= 2) return no('Already open');
  if (spareRunes(meta) < SOCKET_COST) return no(`Needs ${SOCKET_COST} tier I runes`);
  return { ok: true };
}
export function openSocket(meta, weapon) {
  const check = canOpenSocket(meta, weapon);
  if (!check.ok) return check;
  for (let left = SOCKET_COST; left > 0; left--) meta.runes[spareFirst(meta)[0]][0]--;
  meta.sockets = { ...meta.sockets, [weapon]: 2 };
  return { ok: true };
}

// Saves from before tiers kept a plain count per rune and one rune id per weapon.
export function upgradeRunes(meta) {
  for (const [id, v] of Object.entries(meta.runes ?? {})) if (typeof v === 'number') meta.runes[id] = [v, 0, 0];
  for (const [w, v] of Object.entries(meta.infused ?? {})) if (typeof v === 'string') meta.infused[w] = [{ id: v, tier: 0 }, null];
  meta.sockets = meta.sockets ?? {};
  return meta;
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
