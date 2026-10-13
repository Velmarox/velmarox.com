// Things to throw. Data only.
// size: 1 small, 2 medium. hx/hy are half-widths of a box; r is a radius.
// slide and spin are floor drag; throwSpeed is the top speed at full charge.

export const OBJECTS = {
  crate:  { name: 'Crate',  shape: 'box',    hx: 0.4,  hy: 0.4,  mass: 4,  bounce: 0.2,  slide: 1.2, spin: 1.5, throwSpeed: 30, durability: 1, metal: false, size: 1 },
  tire:   { name: 'Tire',   shape: 'circle', r: 0.42,            mass: 6,  bounce: 0.85, slide: 0.5, spin: 0.5, throwSpeed: 26, durability: 4, metal: false, size: 1 },
  barrel: { name: 'Barrel', shape: 'circle', r: 0.55,            mass: 14, bounce: 0.3,  slide: 0.4, spin: 0.4, throwSpeed: 18, durability: 2, metal: true,  size: 2 },
  // Long, thrown sideways and spinning, so it sweeps a wide path.
  pipe:   { name: 'Pipe',   shape: 'box',    hx: 1.0,  hy: 0.14, mass: 9,  bounce: 0.25, slide: 0.9, spin: 0.6, throwSpeed: 22, durability: 3, metal: true,  size: 2, sideways: true, throwSpin: 14 },
  // Never breaks. Slow to throw, and shoves whatever it meets.
  anvil:  { name: 'Anvil',  shape: 'box',    hx: 0.45, hy: 0.32, mass: 40, bounce: 0.05, slide: 3,   spin: 4,   throwSpeed: 15, durability: Infinity, metal: true, size: 2 },
};

export const STARTER_OBJECTS = ['crate', 'tire', 'barrel'];
