// What Rep buys. Every unlock adds something to the pool that contracts and rewards are
// drawn from. None makes the guy stronger, so a new player can still post a top score.

export const TIER_COST = { 1: 5, 2: 10 };

export const UNLOCKS = [
  { id: 'thrower', tier: 1, type: 'creature', name: 'Thrower', text: 'A creature that throws your own objects back.' },
  { id: 'anvil',   tier: 1, type: 'object',   name: 'Anvil',   text: 'Never breaks. Slow, and shoves everything.' },
  { id: 'magnet',  tier: 1, type: 'gear',     name: 'Magnet Glove', text: 'Pull metal objects to you.' },
  { id: 'pit',     tier: 1, type: 'twist',    name: 'Pit',     text: 'A hole in the floor. Slide things in.' },
  { id: 'shell',   tier: 2, type: 'creature', name: 'Shell',   text: 'Armoured across the front.' },
  { id: 'pipe',    tier: 2, type: 'object',   name: 'Pipe',    text: 'Long. Spins and sweeps a wide path.' },
  { id: 'spring',  tier: 2, type: 'gear',     name: 'Spring Arm', text: 'Full-charge throws bounce at full speed.' },
  { id: 'mitts',   tier: 2, type: 'gear',     name: 'Big Mitts',  text: 'Pick up bigger stunned creatures.' },
  { id: 'bumpers', tier: 2, type: 'twist',    name: 'Bumpers', text: 'Posts that fling things back.' },
  { id: 'ice',     tier: 2, type: 'twist',    name: 'Ice',     text: 'A slick band across the room.' },
];

// A tier opens once half of the tier before it has been bought.
export function tierOpen(tier, owned) {
  if (tier === 1) return true;
  const below = UNLOCKS.filter((u) => u.tier === tier - 1);
  return below.filter((u) => owned.includes(u.id)).length * 2 >= below.length;
}

// Promotion: a title from lifetime Rep. It changes nothing else.
export const TITLES = [
  { at: 0, name: 'Rookie' }, { at: 50, name: 'Regular' }, { at: 150, name: 'Pro' },
  { at: 400, name: 'Veteran' }, { at: 1000, name: 'Legend' },
];

export function titleFor(lifetimeRep) {
  let name = TITLES[0].name;
  for (const t of TITLES) if (lifetimeRep >= t.at) name = t.name;
  return name;
}
