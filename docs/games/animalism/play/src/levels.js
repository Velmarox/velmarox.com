// ---------------------------------------------------------------------------
// Level data.
//
// Design rule, borrowed from Mega Man X: no tutorial text anywhere. The first
// encounters ARE the teaching, arranged so the lesson is unavoidable but the
// stakes are low, and the later encounters assume the lesson landed.
//
//   1-1  one punk walks at you, camera never locks. You can fight it or walk
//        past it. Either way you learn what the attack button does with zero
//        pressure and no way to lose.
//   1-2  two punks, camera LOCKS. The GO arrow vanishing is the only thing
//        that tells you the rules changed. You learn "clear the screen".
//   1-3  three punks. Trading single hits stops working, so the crowd is what
//        makes you find the combo finisher.
//   1-4  a runner joins. It refuses to stand still, so you learn the belt has
//        depth and that you can step out of a lane.
//
//   2-1  runners only - depth dodging under real pressure.
//   2-2  a single bruiser, alone, so its long telegraph is readable. This is
//        where you learn to wait and punish instead of mashing.
//   2-3+ bruiser plus chaff: the punish window now has to be taken while
//        being harassed.
//
//   3-*  everything at once. Nothing new is introduced - level 3 is the exam.
//
//   4    Josh Benson. One screen, no card, no story. Everything the first
//        three rounds taught, against something that does not flinch.
//
// `at`   player x that triggers the wave
// `side` which edge the enemy walks in from
// `z`    lane across the belt, 0 (far) .. 52 (near kerb)
// `bgX`  horizontal window into the backdrop art; bgX + len must stay <= 4330
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// The story. Arcade-length on purpose: three cards, skippable, then you're
// punching. Shown once when you hit START GAME.
// ---------------------------------------------------------------------------
const STORY = [
  ['THEY TOOK HER.', 'Walked into the market in broad daylight', 'and walked out with your wife.'],
  ['NOBODY SAW ANYTHING.', 'Nobody ever does around here.', 'The cops filed it and went to lunch.'],
  ['SO IT IS ON YOU.', 'Three districts between you and her.', 'Start walking. Start swinging.'],
];

const ENDING = [
  ['SHE IS SAFE.', 'You found her on the top floor,', 'guarded by men who are no longer standing.'],
  ['THE STREET IS QUIET.', 'For tonight, anyway.', ''],
];

// ---------------------------------------------------------------------------
// Quips. Condition-checked lines fire instead of a generic when their moment
// hits; the generics rotate randomly (never the same one twice in a row).
// Selection logic lives in game.js - this is just the words.
//
// Unused lines, kept for when the mechanics exist:
//   pit/hazard death: "Not even a dude. A hole."
//   boss death:       "He felt that one. Not enough, but he felt it."
//   boss last-hit:    "Cruel. Go again."
// ---------------------------------------------------------------------------
const QUIPS = {
  death: [
    'DUDES: 1. YOU: 0.',
    'TURNS OUT THEY PUNCH BACK.',
    "THAT'S ONE FOR THEM.",
    'GUARD WAS DOWN.',
    'THE FLOOR WON.',
    'YOU GOT OUTPUNCHED. HAPPENS.',
    'SOMEBODY HAD TO LOSE TODAY.',
    "YOU'LL WANT THAT ONE BACK.",
    'WELL. THAT HAPPENED.',
    'TRY LEADING WITH THE OTHER FIST.',
  ],
  deathCond: {
    wall:    "THE WALL'S NOT MOVING. YOU'RE GONNA HAVE TO.",
    fast:    'NEW RECORD. WRONG DIRECTION.',
    almost:  'ONE MORE HIT. THAT WAS ALL IT WAS.',
    crowd:   "OUTNUMBERED ISN'T THE SAME AS OUTMATCHED. USUALLY.",
    scrub:   "HE WASN'T EVEN ONE OF THE GOOD ONES.",
    level1:  'LEVEL ONE. BOLD CHOICE.',
  },
  clear: [
    'CLEARED. NEXT BLOCK.',
    'NOBODY LEFT STANDING. KEEP WALKING.',
    "NOT BAD FOR A GUY WHO LIKES PUNCHIN' DUDES.",
    'HANDS STILL WORK.',
    "THEY'LL SEND MORE.",
    'NO SURVIVORS. NONE CONSCIOUS, ANYWAY.',
    "THAT'S HOW IT'S DONE.",
  ],
  clearCond: {
    perfect: 'UNTOUCHED. SHOW-OFF.',
    clutch:  "DON'T DO THAT AGAIN.",
    revenge: "FINALLY. TOLD YOU THE WALL WASN'T MOVING.",
    fast:    "THEY DIDN'T GET A TURN.",
    combo:   'THAT WAS MEAN. DO IT MORE.',
    oneLife: 'WHOLE LEVEL, ONE LIFE. NOTED.',
  },
  win: [
    'NICE.',
    'NOTHING LEFT TO PUNCH. GO HOME.',
    "TURNS OUT YOU DID LIKE PUNCHIN' DUDES.",
    'HANDS: UNDEFEATED.',
    'DUDES: PUNCHED.',
  ],
};

const LEVELS = [
  {
    name: 'EAST MARKET',
    round: '1',
    len: 3300,
    bgX: 384,                    // opens on the shopfront stretch
    startX: 60, startZ: 34,
    // Breakables. Kept off the wave trigger points so a fight never starts
    // with scenery in the middle of it.
    props: [
      { t: 'barrel',     x: 340,  z: 44 },
      { t: 'crate',   x: 470,  z: 22 },
      { t: 'stone', x: 620,  z: 46 },
      { t: 'barrel',   x: 1120, z: 20 },
      { t: 'barrel',     x: 1250, z: 45 },
      { t: 'crate',      x: 1900, z: 24 },
      { t: 'barrel',     x: 2050, z: 46 },
      { t: 'crate',   x: 2180, z: 18 },
      { t: 'stone', x: 2900, z: 44 },
      { t: 'barrel',   x: 3050, z: 22 },
    ],
    waves: [
      { at: 200, lock: false, spawn: [ { t: 'punk', side: 'r', z: 34 } ] },
      { at: 780, lock: true, spawn: [
          { t: 'punk', side: 'r', z: 20 },
          { t: 'punk', side: 'r', z: 44 },
      ] },
      { at: 1540, lock: true, spawn: [
          { t: 'punk', side: 'r', z: 16 },
          { t: 'punk', side: 'r', z: 40 },
          { t: 'punk', side: 'l', z: 30 },
      ] },
      { at: 2420, lock: true, spawn: [
          { t: 'punk',   side: 'r', z: 26 },
          { t: 'punk',   side: 'l', z: 44 },
          { t: 'runner', side: 'r', z: 12 },
      ] },
    ],
  },
  {
    name: 'DOCK ROAD',
    round: '2',
    len: 3150,
    bgX: 1100,                   // the warehouse / loading-bay stretch
    startX: 60, startZ: 34,
    grade: '#ffd8b4',            // dusk
    props: [
      { t: 'crate',      x: 420,  z: 20 },
      { t: 'barrel',     x: 560,  z: 46 },
      { t: 'barrel',     x: 600,  z: 30 },
      { t: 'stone', x: 1200, z: 44 },
      { t: 'barrel',   x: 1400, z: 18 },
      { t: 'crate',      x: 2000, z: 22 },
      { t: 'barrel',     x: 2150, z: 46 },
      { t: 'crate',   x: 2900, z: 20 },
      { t: 'barrel',     x: 3000, z: 44 },
    ],
    waves: [
      { at: 250, lock: true, spawn: [
          { t: 'runner', side: 'r', z: 16 },
          { t: 'runner', side: 'r', z: 42 },
      ] },
      { at: 930, lock: true, spawn: [
          { t: 'bruiser', side: 'r', z: 30 },
      ] },
      { at: 1720, lock: true, spawn: [
          { t: 'bruiser', side: 'r', z: 26 },
          { t: 'punk',    side: 'l', z: 14 },
          { t: 'punk',    side: 'r', z: 44 },
      ] },
      { at: 2520, lock: true, spawn: [
          { t: 'runner', side: 'r', z: 18 },
          { t: 'runner', side: 'l', z: 38 },
          { t: 'runner', side: 'r', z: 48 },
          { t: 'punk',   side: 'l', z: 28 },
      ] },
    ],
  },
  {
    name: 'NIGHT SHIFT',
    round: '3',
    len: 3300,
    bgX: 700,
    startX: 60, startZ: 34,
    grade: '#5f74b8',            // night
    props: [
      { t: 'barrel',     x: 430,  z: 44 },
      { t: 'crate',   x: 560,  z: 20 },
      { t: 'crate',      x: 1350, z: 22 },
      { t: 'stone', x: 1500, z: 46 },
      { t: 'barrel',   x: 1600, z: 18 },
      { t: 'barrel',     x: 2200, z: 44 },
      { t: 'barrel',     x: 2300, z: 28 },
      { t: 'crate',      x: 2400, z: 20 },
      { t: 'stone', x: 3100, z: 45 },
    ],
    waves: [
      { at: 240, lock: true, spawn: [
          { t: 'punk',   side: 'r', z: 22 },
          { t: 'punk',   side: 'r', z: 42 },
          { t: 'runner', side: 'l', z: 32 },
      ] },
      { at: 1040, lock: true, spawn: [
          { t: 'bruiser', side: 'r', z: 20 },
          { t: 'bruiser', side: 'l', z: 40 },
      ] },
      { at: 1880, lock: true, spawn: [
          { t: 'punk',    side: 'r', z: 16 },
          { t: 'punk',    side: 'l', z: 46 },
          { t: 'runner',  side: 'r', z: 34 },
          { t: 'runner',  side: 'l', z: 26 },
          { t: 'bruiser', side: 'r', z: 38 },
      ] },
      { at: 2760, lock: true, spawn: [
          { t: 'bruiser', side: 'r', z: 18 },
          { t: 'bruiser', side: 'r', z: 38 },
          { t: 'bruiser', side: 'l', z: 28 },
      ] },
    ],
  },

  // ---------------------------------------------------------------------------
  // The boss. No round card, no story, no explanation - round 3 clears and he
  // is simply there. `boss: true` is what game.js reads to skip the intro, hang
  // the big bar across the top, and end the level the moment he goes down
  // instead of making you walk to a finish line in an arena with no exit.
  //
  // One screen wide and locked from the first tick, so there is nowhere to
  // retreat to. Two barrels and nothing else: they are the only health in the
  // fight, which makes when to spend them part of it.
  // ---------------------------------------------------------------------------
  {
    name: 'JOSH BENSON',
    round: '4',
    len: 384,
    bgX: 2400,
    startX: 70, startZ: 46,
    grade: '#5f74b8',            // still night - it is the same evening
    boss: true,
    props: [
      { t: 'barrel', x: 40,  z: 12 },
      { t: 'barrel', x: 344, z: 12 },
    ],
    waves: [
      { at: 0, lock: true, spawn: [ { t: 'boss', side: 'r', z: 40 } ] },
    ],
  },
];
