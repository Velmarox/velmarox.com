// Builds the board of three contracts and the reward offers. Everything is drawn from
// what the player has unlocked, by a seeded generator, under the compatibility rules in
// stages/stage-06. checkContract() states those rules so tests can run them over many seeds.

import { makeRng } from '../sim/rng.js';
import { CREATURES, MODIFIERS, STARTER_CREATURES } from '../content/creatures.js';
import { OBJECTS, STARTER_OBJECTS } from '../content/objects.js';
import { STARTER_GEAR } from '../content/gear.js';
import { ARENAS, TWISTS, STARTER_TWISTS } from '../content/arenas.js';
import { UNLOCKS } from '../content/unlocks.js';

export const CATEGORIES = {
  reliable: { name: 'Reliable', text: 'A plain job at this Threat.', mult: 1 },
  targeted: { name: 'Targeted', text: 'Tougher, and one reward is guaranteed.', mult: 1 },
  anomaly:  { name: 'Anomaly',  text: 'An extra arena twist. Pays half again.', mult: 1.5 },
};

// Everything that may appear, given what has been bought.
export function poolFor(unlocks) {
  const bought = (type) => UNLOCKS.filter((u) => u.type === type && unlocks.includes(u.id)).map((u) => u.id);
  return {
    creatures: [...STARTER_CREATURES, ...bought('creature')],
    objects: [...STARTER_OBJECTS, ...bought('object')],
    gear: [...STARTER_GEAR, ...bought('gear')],
    twists: [...STARTER_TWISTS, ...bought('twist')],
  };
}

// What Threat adds. New rules arrive up to about Threat 20; a Big One every fifth.
// Tightened after the first balance runs, where a dodging bot won two fights in three past Threat 20.
export function threatPlan(threat) {
  const bigOne = threat % 5 === 0;
  return {
    bigOne,
    roles: bigOne ? (threat >= 20 ? 2 : threat >= 10 ? 1 : 0) : threat < 6 ? 1 : threat < 14 ? 2 : 3,
    twists: threat < 4 ? 0 : threat < 12 ? 1 : 2,
    mods: threat < 8 ? 0 : threat < 16 ? 1 : 2,
  };
}

function buildContract({ threat, category, pool, held, seed, lead }) {
  const rng = makeRng(seed);
  const plan = threatPlan(threat);
  const mult = CATEGORIES[category].mult;

  // Roles: distinct, and each card on a board leads with a different one where it can.
  const order = rng.shuffle(pool.creatures);
  if (lead && order.includes(lead)) { order.splice(order.indexOf(lead), 1); order.unshift(lead); }
  const kinds = order.slice(0, plan.roles);
  const creatures = [];
  if (plan.bigOne) creatures.push({ kind: 'bigone' });
  for (const kind of kinds) {
    const entry = { kind };
    // A Swarm sharing the room is smaller than one on its own.
    if (kind === 'swarm') entry.count = kinds.length + (plan.bigOne ? 1 : 0) > 1 ? 5 : CREATURES.swarm.count;
    creatures.push(entry);
  }

  // Elite modifiers go on single creatures only. Targeted contracts get one a step early.
  let mods = plan.mods + (category === 'targeted' && threat >= 4 ? 1 : 0);
  const eligible = rng.shuffle(creatures.filter((c) => c.kind !== 'swarm' && c.kind !== 'bigone'));
  for (const c of eligible) {
    if (mods <= 0) break;
    c.mod = rng.pick(Object.keys(MODIFIERS));
    mods -= 1;
  }

  const twistCount = Math.min(pool.twists.length, plan.twists + (category === 'anomaly' ? 1 : 0));
  const twists = rng.shuffle(pool.twists).slice(0, twistCount);
  const arena = threat < 4 ? 'open' : rng.pick(Object.keys(ARENAS));

  // Objects: always two crates and a tire (the tire is a way round a Shell's armour),
  // more when a Thrower needs something to throw, and metal when a Magnet Glove is held.
  const hasThrower = creatures.some((c) => c.kind === 'thrower');
  const objects = ['crate', 'crate', 'tire'];
  const total = 6 + (hasThrower ? 2 : 0);
  while (objects.length < total) objects.push(rng.pick(pool.objects));
  if (held.includes('magnet') && !objects.some((k) => OBJECTS[k].metal)) objects[objects.length - 1] = 'barrel';

  const base = creatures.reduce((sum, c) => sum + CREATURES[c.kind].score, 0);
  const contract = {
    seed: rng.seed(), threat, category, mult, arena, twists, creatures, objects,
    guaranteedGear: null, score: Math.round(base * threat * mult),
  };
  if (category === 'targeted') {
    const wanted = pool.gear.filter((id) => !held.includes(id));
    if (wanted.length) contract.guaranteedGear = rng.pick(wanted);
  }
  return contract;
}

export function generateBoard({ threat, unlocks, held = [], seed }) {
  const pool = poolFor(unlocks);
  const rng = makeRng(seed);
  const leads = rng.shuffle(pool.creatures);
  // The very first contract of a streak always offers a lone Charger: the intro fight.
  if (threat === 1) { leads.splice(leads.indexOf('charger'), 1); leads.unshift('charger'); }
  return ['reliable', 'targeted', 'anomaly'].map((category, i) => buildContract({
    threat, category, pool, held, seed: rng.seed(), lead: leads[i % leads.length],
  }));
}

// Three gear to choose from, never one already held. If the pool runs short, the gap is
// filled with a score bonus so a pick is never wasted.
export function rewardOffers({ contract, unlocks, held, seed }) {
  const rng = makeRng(seed);
  const pool = poolFor(unlocks).gear.filter((id) => !held.includes(id));
  const offers = [];
  if (contract.guaranteedGear && pool.includes(contract.guaranteedGear)) offers.push(contract.guaranteedGear);
  for (const id of rng.shuffle(pool)) {
    if (offers.length >= 3) break;
    if (!offers.includes(id)) offers.push(id);
  }
  const out = offers.map((id) => ({ gear: id }));
  while (out.length < 3) out.push({ bonus: 50 * contract.threat });
  return out;
}

// The rules a generated contract must obey. Returns a list of what is wrong.
export function checkContract(contract, { unlocks, held = [] }) {
  const pool = poolFor(unlocks);
  const plan = threatPlan(contract.threat);
  const wrong = [];
  const kinds = contract.creatures.map((c) => c.kind);
  if (kinds.length === 0) wrong.push('no creatures');
  if (new Set(kinds).size !== kinds.length) wrong.push('a role appears twice');
  if (kinds.includes('bigone') !== plan.bigOne) wrong.push('Big One at the wrong Threat');
  for (const c of contract.creatures) {
    if (c.kind !== 'bigone' && !pool.creatures.includes(c.kind)) wrong.push(`${c.kind} is not unlocked`);
    if (c.mod && (c.kind === 'swarm' || c.kind === 'bigone')) wrong.push(`${c.mod} on ${c.kind}`);
    if (c.mod && !MODIFIERS[c.mod]) wrong.push(`unknown modifier ${c.mod}`);
  }
  if (contract.creatures.filter((c) => c.mod).length > plan.mods + 1) wrong.push('too many modifiers');
  for (const id of contract.twists) if (!pool.twists.includes(id) || !TWISTS[id]) wrong.push(`twist ${id} is not unlocked`);
  if (new Set(contract.twists).size !== contract.twists.length) wrong.push('a twist appears twice');
  if (contract.twists.length > plan.twists + 1) wrong.push('too many twists');
  if (!ARENAS[contract.arena]) wrong.push('unknown arena');
  for (const k of contract.objects) if (!pool.objects.includes(k)) wrong.push(`object ${k} is not unlocked`);
  if (contract.objects.filter((k) => k === 'crate').length < 2) wrong.push('fewer than two crates');
  if (kinds.includes('shell') && !contract.objects.includes('tire') && !contract.twists.includes('spikes') && !contract.twists.includes('bumpers')) wrong.push('no way behind the Shell');
  if (kinds.includes('thrower') && contract.objects.length < 4) wrong.push('Thrower with too few objects');
  if (held.includes('magnet') && !contract.objects.some((k) => OBJECTS[k].metal)) wrong.push('Magnet Glove with no metal');
  if (contract.guaranteedGear && held.includes(contract.guaranteedGear)) wrong.push('guaranteed gear is already held');
  if (!(contract.score > 0)) wrong.push('no score');
  return wrong;
}
