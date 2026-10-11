// ---------------------------------------------------------------------------
// Sprite atlas.
//
// Frame counts / cell sizes were solved from the source sheets by scanning
// column occupancy, not guessed. `ax`/`ay` are the anchor: ax is the body
// centre, ay is the ground line (lowest opaque pixel in the animation).
// Drawing every animation against that anchor is what keeps him from
// jittering when cells differ in size (they range 20x49 .. 50x48).
//
// Data is inlined rather than fetched so index.html works from file://
// with no server. assets/atlas/animal.json holds the same numbers.
// ---------------------------------------------------------------------------

const ANIM = {
  idle:          { file: 'idle.png',          frames: 4,  fw: 25, fh: 53, ax: 13.0, ay: 50 },
  stance:        { file: 'stance.png',        frames: 6,  fw: 22, fh: 47, ax: 11.5, ay: 47 },
  walk:          { file: 'walk.png',          frames: 6,  fw: 27, fh: 48, ax: 12.8, ay: 48 },
  run:           { file: 'run.png',           frames: 6,  fw: 30, fh: 49, ax: 14.6, ay: 49 },
  // Derived, not hand-drawn: punch_low's upper body spliced onto stance's
  // standing legs at the waistband. See README - a hand-drawn sheet would
  // still be better, but this is real art from the same hand and palette.
  punch:         { file: 'punch.png',         frames: 3,  fw: 33, fh: 49, ax: 13.5, ay: 49 },
  kick:          { file: 'kick.png',          frames: 5,  fw: 40, fh: 48, ax: 18.5, ay: 48 },
  spinkick:      { file: 'spinkick.png',      frames: 10, fw: 50, fh: 48, ax: 11.5, ay: 48 },
  punch_low:     { file: 'punch_low.png',     frames: 3,  fw: 33, fh: 41, ax: 12.0, ay: 41 },
  crouch:        { file: 'crouch.png',        frames: 5,  fw: 20, fh: 49, ax: 8.5,  ay: 49 },
  crouch_stance: { file: 'crouch_stance.png', frames: 6,  fw: 25, fh: 53, ax: 12.0, ay: 43 },
  jump:          { file: 'jump.png',          frames: 6,  fw: 27, fh: 58, ax: 15.5, ay: 58 },
  hurt:          { file: 'hurt.png',          frames: 6,  fw: 32, fh: 49, ax: 19.5, ay: 49 },
  stunned:       { file: 'stunned.png',       frames: 4,  fw: 22, fh: 53, ax: 11.1, ay: 53 },
  death:         { file: 'death.png',         frames: 6,  fw: 47, fh: 49, ax: 38.5, ay: 49 },
  getup:         { file: 'getup.png',         frames: 5,  fw: 20, fh: 49, ax: 8.5,  ay: 49 },
};

// Animal uses the full ANIM set above. Enemies are real characters from the
// NES/SMS BRAWLER packs, extracted by tools/make_enemies.py at 1.5x so they
// stand ~45px next to Animal's 47. Each enemy skin has its OWN frame geometry
// (SKIN_ANIM below), which overrides ANIM for that skin.
//
// Both packs draw every cell - 16, 24, 32 and 40 wide - with the head centred
// on the same column and the feet on the same row, so ax/ay below all trace
// back to one anchor. That is why the varying ax per animation is right rather
// than suspicious: the cells are trimmed to their artwork, so a kick that
// reaches further forward starts closer to the anchor on its left edge.
// Do not hand-edit these - rerun tools/make_enemies.py and paste its output.
const SKINS = ['animal'];
// brute = the boss, from the Mutant Brute pack via tools/make_boss.py. He is
// cut at an INTEGER 2x, not 1.5x like the street enemies: every frame in that
// pack lives in one 184x184 cell with the character registered identically, so
// there is no per-animation offset to correct, and doubling keeps his pixels
// exactly twice the size of everyone else's rather than an uneven mix.
const ENEMY_SKINS = ['renegade', 'soldier', 'hood', 'brute'];   // hood = recoloured renegade

const SKIN_ANIM = {
  renegade: {
    stance:  { frames: 4, fw: 23, fh: 45, ax: 12.8, ay: 45.5 },
    walk:    { frames: 4, fw: 25, fh: 45, ax: 14.8, ay: 45.5 },
    punch:   { frames: 3, fw: 28, fh: 45, ax: 12.8, ay: 45.5 },
    kick:    { frames: 3, fw: 33, fh: 45, ax: 9.8, ay: 45.5 },
    hurt:    { frames: 3, fw: 23, fh: 45, ax: 12.8, ay: 45.5 },
    stunned: { frames: 4, fw: 25, fh: 54, ax: 12.8, ay: 54.5 },
    death:   { frames: 2, fw: 44, fh: 34, ax: 36.0, ay: 34.5 },
    getup:   { frames: 3, fw: 23, fh: 45, ax: 12.8, ay: 45.5 },
  },
  soldier: {
    stance:  { frames: 4, fw: 21, fh: 45, ax: 10.8, ay: 45.5 },
    walk:    { frames: 4, fw: 23, fh: 45, ax: 12.8, ay: 45.5 },
    punch:   { frames: 3, fw: 26, fh: 45, ax: 10.8, ay: 45.5 },
    kick:    { frames: 3, fw: 33, fh: 45, ax: 9.8, ay: 45.5 },
    hurt:    { frames: 3, fw: 21, fh: 45, ax: 10.8, ay: 45.5 },
    stunned: { frames: 4, fw: 25, fh: 54, ax: 12.8, ay: 54.5 },
    death:   { frames: 2, fw: 44, fh: 35, ax: 35.0, ay: 33.5 },
    getup:   { frames: 3, fw: 21, fh: 45, ax: 10.8, ay: 45.5 },
  },
  hood: {
    stance:  { frames: 4, fw: 23, fh: 45, ax: 12.8, ay: 45.5 },
    walk:    { frames: 4, fw: 25, fh: 45, ax: 14.8, ay: 45.5 },
    punch:   { frames: 3, fw: 28, fh: 45, ax: 12.8, ay: 45.5 },
    kick:    { frames: 3, fw: 33, fh: 45, ax: 9.8, ay: 45.5 },
    hurt:    { frames: 3, fw: 23, fh: 45, ax: 12.8, ay: 45.5 },
    stunned: { frames: 4, fw: 25, fh: 54, ax: 12.8, ay: 54.5 },
    death:   { frames: 2, fw: 44, fh: 34, ax: 36.0, ay: 34.5 },
    getup:   { frames: 3, fw: 23, fh: 45, ax: 12.8, ay: 45.5 },
  },
  // The boss. No 'kick' - he only has the haymaker, and ENEMY_MOVES.haymaker
  // is the only move that points at him. The punch cell is enormous (226x190)
  // because the swing travels: fist cocked back past his left shoulder, landed
  // out past his right. ay 158 means the charge plume stands 158px above his
  // feet, so at the very back of the belt its tip clips the top of the screen.
  brute: {
    stance:  { frames: 6, fw: 120, fh: 84,  ax: 54,  ay: 84 },
    walk:    { frames: 7, fw: 136, fh: 90,  ax: 52,  ay: 92 },
    punch:   { frames: 6, fw: 226, fh: 190, ax: 110, ay: 158 },
    hurt:    { frames: 3, fw: 126, fh: 88,  ax: 60,  ay: 88 },
    stunned: { frames: 4, fw: 90,  fh: 80,  ax: 38,  ay: 80 },
    death:   { frames: 4, fw: 120, fh: 68,  ax: 52,  ay: 66 },
    getup:   { frames: 3, fw: 124, fh: 88,  ax: 60,  ay: 86 },
  },
};

// Velma. Her own 4-frame idle, from Velma.gif - already drawn at Animal's
// scale (15x50 native vs his 21x47), so no rescaling was needed. She shows up
// on the ending, which is the whole point of the three rounds.
const VELMA = { frames: 4, fw: 15, fh: 50, ax: 7.5, ay: 50, t: 12 };

const SHEETS = {};   // SHEETS[skin][animKey] = HTMLImageElement

// ---------------------------------------------------------------------------
// Move table.
//
// THE CHAIN. Two jabs, then the finisher you asked for:
//
//   punch, punch, punch   ->  jab, jab, standing kick
//   punch, punch, HEAVY   ->  jab, jab, SPIN KICK
//   heavy from neutral    ->  standing kick (never the spin kick)
//
// The spin kick is the only move in the game that knocks down and the only one
// that breaks an enemy's poise, and it is now reachable ONLY by pressing heavy
// as the third link. That is deliberate: it used to sit on the end of the punch
// chain, so mashing one button handed you the interrupt tool ~27% of the time
// without you ever choosing it - measured, and it was why a masher beat the
// game taking 118 damage and why Josh Benson never landed a single hit.
// Everything else in the chain is light-class: it hurts, it does not interrupt.
//
//   dur     ticks each animation frame is held (60 ticks/sec)
//   hit     frames = which animation frames are active
//           x/w    = hitbox offset ahead of the body, and its width
//           zt     = depth tolerance; belt is 64px deep
//   drift   forward push per animation frame, gives attacks their weight
//   cancel  tick after which the next combo input is accepted
//   onLight/onHeavy  what this link chains into, per button. Either may be
//                    null, which ends the chain on that button.
// ---------------------------------------------------------------------------
const MOVES = {
  // 1st hit: a fast jab. Short, cheap, cancels early.
  light: {
    anim: 'punch',
    dur:  [3, 4, 6],
    drift: [0, 0.8, 0],
    hit:  { frames: [1], x: 13, w: 20, zt: 15, dmg: 6, kbx: 1.4, lift: 0, hitstop: 4, heavy: false },
    cancel: 5,
    onLight: 'light2', onHeavy: 'light2',
    sfx: 'whiff',
  },
  // 2nd hit: the same jab again. This is the fork - punch takes you to the
  // kick, heavy takes you to the spin kick.
  light2: {
    anim: 'punch',
    dur:  [3, 4, 6],
    drift: [0, 0.9, 0],
    hit:  { frames: [1], x: 13, w: 21, zt: 15, dmg: 7, kbx: 1.6, lift: 0, hitstop: 4, heavy: false },
    cancel: 5,
    onLight: 'kick', onHeavy: 'spin',
    sfx: 'whiff',
  },
  // The standing kick. Third punch of the chain, and what the heavy button
  // does on its own. Longer reach and more push than a jab, but light-class:
  // no knockdown, and it will not interrupt a committed enemy.
  kick: {
    anim: 'kick',
    dur:  [2, 3, 4, 5, 6],
    drift: [0, 1.1, 0.5, 0, 0],
    hit:  { frames: [1, 2], x: 14, w: 21, zt: 15, dmg: 9, kbx: 2.0, lift: 0, hitstop: 5, heavy: false },
    cancel: -1,
    onLight: null, onHeavy: null,
    sfx: 'whiff',
  },
  // The finisher. Knocks down, breaks poise, and costs you a committed
  // three-input sequence to get at.
  spin: {
    anim: 'spinkick',
    dur:  [2, 2, 2, 2, 3, 4, 4, 4, 4, 4],
    drift: [0, 0.3, 0.5, 0.6, 0.8, 1.4, 1.0, 0, 0, 0],
    hit:  { frames: [5, 6], x: 16, w: 26, zt: 17, dmg: 15, kbx: 3.4, lift: 2.8, hitstop: 8, heavy: true },
    cancel: -1,
    onLight: null, onHeavy: null,
    sfx: 'whiff_heavy',
  },
  low: {
    anim: 'punch_low',
    dur:  [3, 5, 7],
    drift: [0, 0.5, 0],
    hit:  { frames: [1], x: 13, w: 18, zt: 16, dmg: 5, kbx: 1.2, lift: 0, hitstop: 4, heavy: false },
    cancel: -1,
    onLight: null, onHeavy: null,
    sfx: 'whiff',
  },
  air: {
    anim: 'kick',
    dur:  [2, 8, 8, 5, 5],
    drift: [0, 0, 0, 0, 0],
    hit:  { frames: [1, 2], x: 14, w: 20, zt: 15, dmg: 9, kbx: 2.2, lift: 0, hitstop: 6, heavy: false },
    cancel: -1,
    onLight: null, onHeavy: null,
    sfx: 'whiff',
  },
};

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------
function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('failed to load ' + src));
    im.src = src;
  });
}

async function loadAssets(onProgress) {
  const jobs = [];
  for (const skin of SKINS) {
    SHEETS[skin] = {};
    for (const key in ANIM) {
      jobs.push({ skin, key, src: `assets/sprites/${skin}/${ANIM[key].file}` });
    }
  }
  for (const skin of ENEMY_SKINS) {
    SHEETS[skin] = {};
    for (const key in SKIN_ANIM[skin]) {
      jobs.push({ skin, key, src: `assets/sprites/${skin}/${key}.png` });
    }
  }
  jobs.push({ bg: 'street', src: 'assets/tiles/urban-half.png' });
  jobs.push({ bg: 'streetFg', src: 'assets/tiles/urban-half-fg.png' });
  jobs.push({ bg: 'menu', src: 'assets/menu/menu-bg.png' });
  jobs.push({ bg: 'ncs', src: 'assets/menu/ncs-badge.png' });
  jobs.push({ bg: 'props', src: 'assets/props/props.png' });
  jobs.push({ bg: 'velma', src: 'assets/sprites/velma/idle.png' });
  jobs.push({ bg: 'powerups', src: 'assets/props/powerups.png' });
  // Vector, not pixel art - it is line art on a settings screen, and it is
  // rasterised 1:1 at the px size baked in by tools/make_controller.py.
  jobs.push({ bg: 'pad', src: 'assets/ui/controller.svg' });

  let done = 0;
  const total = jobs.length;
  const extra = {};
  await Promise.all(jobs.map(async (j) => {
    const im = await loadImage(j.src);
    if (j.bg) extra[j.bg] = im;
    else SHEETS[j.skin][j.key] = im;
    done++;
    if (onProgress) onProgress(done, total);
  }));
  return extra;
}
