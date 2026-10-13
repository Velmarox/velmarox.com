// Room layouts and arena twists. Data only. The room is 32 by 18 metres.

export const ARENAS = {
  open:    { name: 'Open floor', blocks: [] },
  // blocks: solid boxes, as centre and half-widths. A charge into one counts as a wall.
  pillars: { name: 'Four pillars', blocks: [{ x: 11, y: 5, hx: 0.8, hy: 0.8 }, { x: 11, y: 13, hx: 0.8, hy: 0.8 }, { x: 21, y: 5, hx: 0.8, hy: 0.8 }, { x: 20, y: 12.5, hx: 0.8, hy: 0.8 }] },
  divider: { name: 'Centre wall', blocks: [{ x: 16, y: 9, hx: 0.6, hy: 3 }] },
};

export const TWISTS = {
  spikes:  { name: 'Spike Wall', text: 'Hits against the east wall land one tier harder.' },
  pit:     { name: 'Pit',        text: 'Whatever slides in is gone. Thrown things fly over.' },
  bumpers: { name: 'Bumpers',    text: 'Posts that fling back whatever touches them.' },
  ice:     { name: 'Ice',        text: 'A slick band across the middle of the room.' },
};

export const STARTER_TWISTS = ['spikes'];

export const PIT = { x: 26, y: 13.5, r: 1.6 };
export const BUMPERS = [{ x: 16, y: 3.5, r: 0.7 }, { x: 13, y: 14.5, r: 0.7 }, { x: 24, y: 7, r: 0.7 }];
export const ICE = { x1: 13, x2: 21 };
export const DISPENSER = { x: 16, y: 1.3 };
// Walking into the exit ends the fight early: no score and no injury.
export const EXIT = { x: 1.3, y1: 7.5, y2: 10.5 };

export const GUY_START = { x: 6, y: 9 };
// Where objects and creatures may be placed. Chosen clear of every block, bumper, and the pit.
export const OBJECT_SLOTS = [
  { x: 7.5, y: 9 }, { x: 8, y: 5 }, { x: 8, y: 13 }, { x: 13, y: 8 }, { x: 13, y: 10.5 }, { x: 14, y: 5.5 },
  { x: 15, y: 12.5 }, { x: 18, y: 6 }, { x: 18, y: 12 }, { x: 19, y: 9 }, { x: 23, y: 10 }, { x: 24, y: 3 },
];
export const CREATURE_SLOTS = [
  { x: 25, y: 9 }, { x: 27, y: 5 }, { x: 28, y: 10.5 }, { x: 23, y: 15.5 }, { x: 23, y: 2.5 }, { x: 29, y: 7.5 },
];
