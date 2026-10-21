// The slot machine: one token a spin. Mostly common powers, sometimes coins, and now and
// then something that lasts: a rune, a hat, a skin. No DOM here; ui/screens.js draws it.

import { makeRng } from '../sim/rng.js';
import { POWERS, MAX_POWERS } from '../content/cards.js';
import { HATS, SKINS, RUNES, PRIZES, SYMBOLS, SYMBOL_FOR } from '../content/loot.js';

const RARITY_WEIGHT = { common: 70, uncommon: 25, rare: 5 };

function weighted(rng, list, weight) {
  const total = list.reduce((n, x) => n + weight(x), 0);
  let roll = rng.next() * total;
  for (const x of list) { roll -= weight(x); if (roll < 0) return x; }
  return list[list.length - 1];
}

// The reels for a result. Three of a kind for the lasting prizes and the jackpot; two
// POW or two COIN for the everyday ones, so it still looks like a near thing.
function reelsFor(rng, kind) {
  const symbol = SYMBOL_FOR[kind];
  if (kind === 'power' || kind === 'coins') {
    const odd = rng.pick(SYMBOLS.filter((s) => s !== symbol));
    const reels = [symbol, symbol, symbol];
    reels[rng.int(3)] = odd;
    return reels;
  }
  return [symbol, symbol, symbol];
}

function powerPrize(rng, run, out) {
  const id = weighted(rng, Object.keys(POWERS), (p) => RARITY_WEIGHT[POWERS[p].rarity]);
  if (run && run.powers.length < MAX_POWERS) {
    run.powers.push(id);
    out.text = `${POWERS[id].name}!`;
  } else {
    // No room: it's sold back to the machine.
    if (run) run.coins += 30;
    out.text = `${POWERS[id].name}, but you're full: sold for $30`;
  }
  out.item = id;
}

// One spin. Changes meta (and the run, for powers and coins) and says what happened.
export function spin(meta, run) {
  if (meta.tokens < 1) return { ok: false, why: 'No tokens' };
  meta.tokens--;
  const rng = makeRng((Math.imul(++meta.spins, 2654435761) ^ 0x51075) >>> 0);
  let kind = weighted(rng, PRIZES, (p) => p.weight).kind;
  const out = { ok: true, kind, text: '', item: null };
  if (kind === 'hat' && Object.keys(HATS).every((h) => meta.hats.includes(h))) kind = 'coins';
  if (kind === 'skin' && Object.keys(SKINS).every((s) => meta.skins.includes(s))) kind = 'coins';
  out.kind = kind;
  if (kind === 'power') powerPrize(rng, run, out);
  else if (kind === 'coins') {
    const amount = 30 + rng.int(10) * 10;
    if (run) run.coins += amount;
    out.text = `$${amount}`;
  } else if (kind === 'rune') {
    const id = rng.pick(Object.keys(RUNES));
    meta.runes[id] = (meta.runes[id] ?? 0) + 1;
    out.item = id;
    out.text = `${RUNES[id].name}! Infuse it in the Armory.`;
  } else if (kind === 'hat') {
    const id = rng.pick(Object.keys(HATS).filter((h) => !meta.hats.includes(h)));
    meta.hats.push(id);
    out.item = id;
    out.text = `${HATS[id].name}! Wear it from the Wardrobe.`;
  } else if (kind === 'skin') {
    const id = rng.pick(Object.keys(SKINS).filter((s) => !meta.skins.includes(s)));
    meta.skins.push(id);
    out.item = id;
    out.text = `${SKINS[id].name} skin!`;
  } else {
    meta.tokens += 5;
    const rare = Object.keys(POWERS).filter((p) => POWERS[p].rarity === 'rare');
    const id = rng.pick(rare);
    const room = run && run.powers.length < MAX_POWERS;
    if (room) run.powers.push(id);
    out.item = id;
    out.text = `JACKPOT! 5 tokens${room ? ` and a ${POWERS[id].name}` : ''}!`;
  }
  out.reels = reelsFor(rng, kind);
  return out;
}
