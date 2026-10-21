// One run: every round until he goes down, with a card pick between rounds. No DOM here.
// Anything that changes the run returns { ok, why } and changes it only when ok.
// What lasts between runs (weapon XP, runes, hats, skins, tokens) is in game/meta.js.

import { makeRng } from '../sim/rng.js';
import { tuning } from '../sim/tuning.js';
import { ENEMIES, MOD_ORDER } from '../content/enemies.js';
import { WEAPONS, STARTER_WEAPONS, MAX_WEAPONS, MAX_LEVEL, upgradeCost } from '../content/weapons.js';
import { DECKS, MAX_ABILITIES, MAX_POWERS } from '../content/cards.js';
import { TOKEN_PRICE } from '../content/loot.js';
import { hatBonus } from './meta.js';

// Cover in the room. The middle is always clear, because that is where he starts.
const LAYOUTS = [
  [],
  [{ x: 9, y: 9, hx: 1, hy: 1 }, { x: 23, y: 9, hx: 1, hy: 1 }],
  [{ x: 9.5, y: 5, hx: 0.9, hy: 0.9 }, { x: 22.5, y: 5, hx: 0.9, hy: 0.9 }, { x: 9.5, y: 13, hx: 0.9, hy: 0.9 }, { x: 22.5, y: 13, hx: 0.9, hy: 0.9 }],
  [{ x: 16, y: 4.2, hx: 3, hy: 0.6 }, { x: 16, y: 13.8, hx: 3, hy: 0.6 }],
  [{ x: 8.5, y: 9, hx: 0.6, hy: 2.6 }, { x: 23.5, y: 9, hx: 0.6, hy: 2.6 }],
  [{ x: 11, y: 5.5, hx: 1.6, hy: 0.6 }, { x: 21, y: 12.5, hx: 1.6, hy: 0.6 }, { x: 21, y: 5.5, hx: 0.6, hy: 0.6 }, { x: 11, y: 12.5, hx: 0.6, hy: 0.6 }],
];

export const isBossWave = (wave) => wave % 5 === 0;
export const WAVE_HEAL = 15;

// What comes in a round, and when. A budget of points buys creatures in small groups.
export function wavePlan(wave, seed) {
  const rng = makeRng(seed);
  const boss = isBossWave(wave);
  const kinds = Object.entries(ENEMIES).filter(([, d]) => d.cost && d.from <= wave).map(([k]) => k);
  let budget = Math.round((9 + wave * 4.5 + wave * wave * 0.18) * (boss ? 0.45 : 1));
  const modChance = wave >= 6 ? Math.min(0.45, 0.07 * (wave - 5)) : 0;
  const swarmSize = ENEMIES.swarm.count + Math.floor(wave / 3);
  const groups = [];
  let at = 0.4;
  if (boss) {
    groups.push({ at, enemies: [{ kind: 'bigone', mod: wave >= 15 ? rng.pick(['heavy', 'shielded']) : null }] });
    at += 4;
  }
  // Newest creature first, so a new kind is seen on its own before the crowd.
  const newest = kinds.find((k) => ENEMIES[k].from === wave);
  while (budget > 0) {
    const group = [];
    let chunk = Math.min(budget, rng.range(5, 9 + wave * 0.4));
    while (chunk > 0) {
      const kind = newest && !groups.length && !group.length ? newest : rng.pick(kinds);
      const def = ENEMIES[kind];
      if (kind === 'swarm') {
        for (let i = 0; i < swarmSize; i++) group.push({ kind, mod: null });
      } else {
        group.push({ kind, mod: rng.chance(modChance) ? rng.pick(MOD_ORDER) : null });
      }
      chunk -= def.cost;
      budget -= def.cost;
    }
    groups.push({ at, enemies: group });
    at += rng.range(3, 4.5) * Math.max(0.55, 1 - wave * 0.025);
  }
  const blocks = wave === 1 ? LAYOUTS[1] : rng.pick(LAYOUTS);
  return { blocks: blocks.map((b) => ({ ...b })), groups };
}

export function newRun(seed = Math.floor(Math.random() * 2 ** 31)) {
  const run = {
    seed,
    wave: 1,
    coins: 0,
    hp: tuning.guyHp,
    maxHp: tuning.guyHp,
    held: 0,
    // level is what's been paid for; unlocked is how far duplicates have opened it.
    weapons: STARTER_WEAPONS.map((id) => ({ id, level: 1, unlocked: 1 })),
    abilities: [],
    powers: [],
    decks: {},
    draws: 0,
    offer: null,      // the three cards on the table, once dealt
    pending: null,    // a taken card that needs room making for it
    stats: { kills: 0, earned: 0, shots: 0, hurt: 0, xp: 0, cards: 0 },
  };
  const rng = makeRng(seed ^ 0x5eed);
  for (const [name, cards] of Object.entries(DECKS)) run.decks[name] = { pile: rng.shuffle(cards), discard: [] };
  return run;
}

const no = (why) => ({ ok: false, why });
const pay = (run, cost) => { run.coins -= cost; return { ok: true }; };
export const owns = (run, id) => run.weapons.some((w) => w.id === id);

// Takes the top card of a deck, shuffling the discards back in when it runs out.
// skip: cards not worth showing right now (an ability he already has).
function draw(run, deck, skip = () => false) {
  const d = run.decks[deck];
  const rng = makeRng((run.seed ^ Math.imul(++run.draws, 0x9e3779b1)) >>> 0);
  for (let tries = 0; tries < 40; tries++) {
    if (!d.pile.length) { d.pile = rng.shuffle(d.discard); d.discard = []; }
    if (!d.pile.length) return null;
    const card = d.pile.shift();
    if (skip(card) && tries < 39) { d.discard.push(card); continue; }
    return card;
  }
  return null;
}

// Deals one card from each deck. Dealing again before taking keeps the same three.
export function deal(run) {
  if (run.offer) return run.offer;
  run.offer = [
    { deck: 'weapon', id: draw(run, 'weapon') },
    { deck: 'ability', id: draw(run, 'ability', (id) => run.abilities.includes(id)) },
    { deck: 'power', id: draw(run, 'power') },
  ].filter((c) => c.id);
  return run.offer;
}

// What taking a card would do, for the card's own label.
export function cardEffect(run, card) {
  if (card.deck === 'weapon') {
    const have = run.weapons.find((w) => w.id === card.id);
    if (have) return have.unlocked >= MAX_LEVEL ? { kind: 'maxed', text: 'Already maxed: +$100' } : { kind: 'dup', text: `Duplicate: unlocks level ${have.unlocked + 1}` };
    return run.weapons.length >= MAX_WEAPONS ? { kind: 'replace', text: 'Swap out a weapon for it' } : { kind: 'new', text: 'New weapon' };
  }
  if (card.deck === 'ability') return run.abilities.length >= MAX_ABILITIES ? { kind: 'replace', text: 'Swap out an ability for it' } : { kind: 'new', text: 'New ability' };
  return run.powers.length >= MAX_POWERS ? { kind: 'replace', text: 'Swap out a power for it' } : { kind: 'new', text: 'Stored for later' };
}

// Takes one of the three cards on the table. The others go back in their decks.
export function takeCard(run, index) {
  const card = run.offer?.[index];
  if (!card) return no('No card there');
  for (const c of run.offer) run.decks[c.deck].discard.push(c.id);
  run.offer = null;
  run.stats.cards++;
  const effect = cardEffect(run, card);
  if (card.deck === 'weapon') {
    const have = run.weapons.find((w) => w.id === card.id);
    if (effect.kind === 'maxed') { run.coins += 100; return { ok: true, effect }; }
    if (effect.kind === 'dup') { have.unlocked++; return { ok: true, effect }; }
  }
  if (effect.kind === 'replace') { run.pending = card; return { ok: true, effect, needs: card.deck }; }
  if (card.deck === 'weapon') run.weapons.push({ id: card.id, level: 1, unlocked: 1 });
  else if (card.deck === 'ability') run.abilities.push(card.id);
  else run.powers.push(card.id);
  return { ok: true, effect };
}

// Makes room for a pending card by dropping what's in slot; slot -1 turns the card down.
export function resolvePending(run, slot) {
  const card = run.pending;
  if (!card) return no('Nothing waiting');
  run.pending = null;
  if (slot < 0) return { ok: true };
  const list = card.deck === 'weapon' ? run.weapons : card.deck === 'ability' ? run.abilities : run.powers;
  if (!list[slot]) { run.pending = card; return no('Nothing there'); }
  if (card.deck === 'weapon') {
    list[slot] = { id: card.id, level: 1, unlocked: 1 };
    run.held = slot;
  } else list[slot] = card.id;
  return { ok: true };
}

export function canUpgrade(run, slot) {
  const w = run.weapons[slot];
  if (!w) return no('Nothing there');
  if (w.level >= MAX_LEVEL) return no('Maxed');
  if (w.level >= w.unlocked) return no('Find a duplicate');
  if (run.coins < upgradeCost(w.id, w.level)) return no('Not enough coins');
  return { ok: true };
}
export function upgradeWeapon(run, slot) {
  const check = canUpgrade(run, slot);
  if (!check.ok) return check;
  const w = run.weapons[slot];
  const cost = upgradeCost(w.id, w.level);
  w.level++;
  return pay(run, cost);
}

export function dropAbility(run, slot) {
  if (!run.abilities[slot]) return no('Nothing there');
  run.abilities.splice(slot, 1);
  return { ok: true };
}
export function dropPower(run, slot) {
  if (!run.powers[slot]) return no('Nothing there');
  run.powers.splice(slot, 1);
  return { ok: true };
}

export function buyTokens(run, meta, count = 1) {
  if (run.coins < TOKEN_PRICE * count) return no('Not enough coins');
  meta.tokens += count;
  return pay(run, TOKEN_PRICE * count);
}

// His most health: the run's own plus whatever his hat gives.
export const maxHealth = (run, meta) => run.maxHp + (hatBonus(meta).maxHp ?? 0);

// Everything the fight needs for the run's next round.
export function waveSetup(run, meta) {
  const seed = (run.seed ^ Math.imul(run.wave, 0x9e3779b1)) >>> 0;
  const maxHp = maxHealth(run, meta);
  return {
    seed, wave: run.wave, plan: wavePlan(run.wave, seed),
    loadout: run.weapons.map((w) => ({ id: w.id, level: w.level, rune: meta.infused[w.id] ?? null })),
    ranks: meta.ranks, held: run.held, abilities: [...run.abilities], powers: [...run.powers],
    bonus: hatBonus(meta), hp: Math.min(run.hp, maxHp), maxHp,
  };
}

// The bonus for clearing a round, more for taking no damage.
export function waveBonus(wave, hurt) {
  const base = 20 + wave * 7 + (isBossWave(wave) ? 100 : 0);
  return { base, clean: hurt === 0 ? Math.round(base * 0.5) : 0 };
}

// After a round: bank what the fight earned, XP and tokens included (those last between
// runs, so they're kept even when he goes down). Returns the summary the menu shows.
export function finishWave(run, sim, meta) {
  const won = sim.state === 'done' || sim.state === 'cleared';
  const bonus = won ? waveBonus(run.wave, sim.hurtTaken) : { base: 0, clean: 0 };
  const earned = sim.cash + bonus.base + bonus.clean;
  let xp = 0;
  for (const [id, gained] of Object.entries(sim.xp)) {
    if (!WEAPONS[id]) continue;
    const whole = Math.round(gained);
    meta.xp[id] = (meta.xp[id] ?? 0) + whole;
    xp += whole;
  }
  meta.tokens += sim.tokens;
  const summary = {
    wave: run.wave, won, pickedUp: sim.cash, bonus: bonus.base, clean: bonus.clean, kills: sim.kills,
    hurt: Math.round(sim.hurtTaken), xp, tokens: sim.tokens, healed: 0,
  };
  run.coins += earned;
  run.hp = Math.max(0, Math.round(sim.guy.hp));
  run.held = sim.held;
  run.powers = [...sim.powers];
  run.stats.kills += sim.kills;
  run.stats.earned += earned;
  run.stats.shots += sim.shotsFired;
  run.stats.hurt += sim.hurtTaken;
  run.stats.xp += xp;
  if (won) {
    summary.healed = Math.min(WAVE_HEAL, maxHealth(run, meta) - run.hp);
    run.hp += summary.healed;
    run.wave++;
  }
  return summary;
}
