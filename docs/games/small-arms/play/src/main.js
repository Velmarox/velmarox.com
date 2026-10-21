// Small Arms. Ties the pieces together: the save, the run, the fight, the card pick, the
// between-rounds screens, and the menus.

import { createSim } from './sim/world.js';
import { STEP, tuning, ROOM } from './sim/tuning.js';
import { createRenderer3d } from './ui/render3d.js';
import { createInput } from './ui/input.js';
import { createAudio } from './ui/audio.js';
import { makeGunIcons } from './ui/gunIcons.js';
import * as screens from './ui/screens.js';
import { newRun, deal, takeCard, resolvePending, upgradeWeapon, dropAbility, dropPower, buyTokens, waveSetup, finishWave, isBossWave, maxHealth } from './game/run.js';
import { buyRank, infuse, equipHat, equipSkin, hatBonus } from './game/meta.js';
import { spin } from './game/slots.js';
import { loadSave, writeSave, freshSave, bankRun } from './game/save.js';
import { SYMBOLS } from './content/loot.js';
import { WEAPONS } from './content/weapons.js';

const stage = document.getElementById('stage');
const overlay = document.getElementById('overlay');
const screenEl = document.getElementById('screen');
const hudEl = document.getElementById('hud');
const gunsEl = document.getElementById('guns');
const cardsEl = document.getElementById('cardbar');
const bannerEl = document.getElementById('banner');
const helpEl = document.getElementById('help');
const renderer = createRenderer3d(document.getElementById('arena3d'), overlay);
const input = createInput(stage, (x, y) => renderer.toWorld(x, y));
const audio = createAudio();

// The browser can refuse storage (private windows, blocked site data). The game still
// plays; it just won't remember.
const storage = (() => {
  try {
    window.localStorage.getItem('loaded-probe');
    return window.localStorage;
  } catch {
    const data = {};
    return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = v; } };
  }
})();

const loaded = loadSave(storage);
const state = {
  save: loaded.save,
  status: loaded.status,
  problem: loaded.problem,
  // A save that could not be read is never overwritten until the player starts again.
  canWrite: loaded.status !== 'broken',
  screen: 'home',
  view: {},
  back: [],           // where Back goes from the screens you can open from more than one place
  sim: null,
  fighting: false,
  paused: false,
  endAt: 0,
  bannerUntil: 0,
  icons: null,
};

function persist() {
  if (!state.canWrite) return;
  try { writeSave(storage, state.save); } catch { /* storage full or blocked: keep playing */ }
}

function applySettings() {
  const s = state.save.settings;
  renderer.options.shake = s.shake;
  renderer.options.numbers = s.numbers;
  audio.setVolume(s.volume);
}
applySettings();
renderer.setLook({ skin: state.save.meta.skin, hat: state.save.meta.hat });

// Behind the menus he stands in the room holding his weapon, looking round slowly.
function menuSim() {
  const run = state.save.run;
  const meta = state.save.meta;
  const loadout = run ? run.weapons.map((w) => ({ id: w.id, level: w.level, rune: meta.infused[w.id] ?? null })) : [{ id: 'pistol', level: 1, rune: meta.infused.pistol ?? null }];
  return createSim({ idle: true, loadout, held: run?.held ?? 0, ranks: meta.ranks, bonus: hatBonus(meta) });
}
const refreshBackdrop = () => { state.sim = menuSim(); };

// ----- screens -----
function show(name, view = {}) {
  state.screen = name;
  state.view = view;
  const inArena = name === 'arena';
  screenEl.hidden = inArena;
  for (const el of [hudEl, gunsEl, cardsEl, helpEl]) el.hidden = !inArena;
  if (inArena) { screenEl.innerHTML = ''; input.reset(); return; }
  const data = { save: state.save, status: state.status, problem: state.problem, icons: state.icons, ...view };
  const keep = name === state.lastScreen ? screenEl.scrollTop : 0;
  screenEl.innerHTML = `<div class="panel ${name}">${screens[name](data)}</div>`;
  screenEl.scrollTop = keep;
  state.lastScreen = name;
  if (!keep) {
    const first = screenEl.querySelector('button.primary:not([disabled])') ?? screenEl.querySelector('button:not([disabled])');
    if (first) first.focus({ preventScroll: true });
  }
}
const redraw = () => show(state.screen, state.view);

// Opens a screen that Back should return from.
function open(name, view = {}) {
  state.back.push({ name: state.screen, view: state.view });
  show(name, view);
}
function goBack() {
  const to = state.back.pop() ?? { name: state.save.run ? 'camp' : 'home', view: {} };
  show(to.name, to.view);
}

// Where a run in progress picks up: the cards on the table, a card waiting for room, or camp.
function resumeRun() {
  const run = state.save.run;
  state.back = [];
  refreshBackdrop();
  if (run.pending) show('replace');
  else if (run.offer) show('pick');
  else show('camp');
}

function startRun() {
  if (!state.canWrite) {
    // The player chose to begin again over an unreadable save.
    state.save = freshSave();
    state.canWrite = true;
    state.status = 'ok';
  }
  if (state.save.run) bankRun(state.save, state.save.run);
  state.save.run = newRun((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);
  persist();
  startWave();
}

function startWave() {
  const run = state.save.run;
  persist();
  state.back = [];
  state.sim = createSim(waveSetup(run, state.save.meta));
  state.fighting = true;
  state.paused = false;
  state.endAt = 0;
  banner(isBossWave(run.wave) ? `Round ${run.wave} &middot; Boss` : `Round ${run.wave}`, 1400);
  audio.play('start');
  show('arena');
}

function banner(text, ms, result = '') {
  bannerEl.innerHTML = text;
  bannerEl.dataset.result = result;
  bannerEl.hidden = false;
  state.bannerUntil = performance.now() + ms;
}

// The round is over one way or the other: bank it, then the cards or the end of the run.
function endWave() {
  const run = state.save.run;
  const meta = state.save.meta;
  const sim = state.sim;
  state.fighting = false;
  const summary = finishWave(run, sim, meta);
  bannerEl.hidden = true;
  if (!summary.won) {
    const before = state.save.records.bestWave;
    const result = { wave: run.wave, kills: run.stats.kills, earned: run.stats.earned, xp: run.stats.xp, cards: run.stats.cards, record: run.wave - 1 > before };
    bankRun(state.save, run);
    persist();
    refreshBackdrop();
    show('over', { result });
    return;
  }
  deal(run);
  persist();
  refreshBackdrop();
  audio.play('deal');
  show('pick', { summary });
}

// A buy, a swap, an equip: run it, sound it, save it, and show the screen again.
function act(fn, { backdrop = false } = {}) {
  const result = fn();
  audio.play(result.ok ? 'buy' : 'nope');
  if (result.ok) {
    persist();
    if (backdrop) refreshBackdrop();
  }
  redraw();
  return result;
}

// ----- the slot machine: the result is decided at once, then the reels catch up -----
let spinTimer = null;
function runSlots() {
  const meta = state.save.meta;
  const result = spin(meta, state.save.run);
  if (!result.ok) { audio.play('nope'); return; }
  persist();
  const view = { spin: { ...result, shown: ['7', '7', '7'], done: false }, spinning: true };
  const started = performance.now();
  clearInterval(spinTimer);
  spinTimer = setInterval(() => {
    const t = performance.now() - started;
    // Each reel stops in turn on its result; the rest keep rolling.
    view.spin.shown = result.reels.map((s, i) => (t > 700 + i * 350 ? s : SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]));
    audio.play('tick');
    if (t > 700 + 2 * 350 + 100) {
      clearInterval(spinTimer);
      view.spinning = false;
      view.spin.done = true;
      audio.play(result.kind === 'power' || result.kind === 'coins' ? 'buy' : 'jackpot');
      if (result.kind === 'skin' || result.kind === 'hat') refreshBackdrop();
    }
    if (state.screen === 'slotmachine') show('slotmachine', view);
  }, 90);
}

const actions = {
  newrun() { startRun(); },
  continue() { resumeRun(); },
  home() { state.fighting = false; state.paused = false; state.back = []; bannerEl.hidden = true; refreshBackdrop(); show('home'); },
  howto() { open('howto'); },
  settings() { open('settings'); },
  armory() { open('armory', { picked: state.save.run?.weapons[state.save.run.held]?.id }); },
  wardrobe() { open('wardrobe'); },
  slots() { open('slotmachine', {}); },
  back() { goBack(); },
  fight() { startWave(); },

  take(el) {
    const result = takeCard(state.save.run, Number(el.dataset.card));
    audio.play(result.ok ? 'buy' : 'nope');
    persist();
    refreshBackdrop();
    if (result.needs) show('replace');
    else show('camp');
  },
  resolve(el) {
    const result = resolvePending(state.save.run, Number(el.dataset.slot));
    if (!result.ok) { audio.play('nope'); return; }
    audio.play('buy');
    persist();
    refreshBackdrop();
    show('camp');
  },
  upgrade(el) { act(() => upgradeWeapon(state.save.run, Number(el.dataset.slot)), { backdrop: true }); },
  hold(el) { act(() => { state.save.run.held = Number(el.dataset.slot); return { ok: true }; }, { backdrop: true }); },
  dropability(el) { act(() => dropAbility(state.save.run, Number(el.dataset.slot))); },
  droppower(el) { act(() => dropPower(state.save.run, Number(el.dataset.slot))); },

  spin() { runSlots(); },
  token() { act(() => buyTokens(state.save.run, state.save.meta, 1)); },
  token5() { act(() => buyTokens(state.save.run, state.save.meta, 5)); },

  pickgun(el) { show('armory', { picked: el.dataset.gun }); },
  rank(el) { act(() => buyRank(state.save.meta, el.dataset.gun, el.dataset.key), { backdrop: true }); },
  infuse(el) { act(() => infuse(state.save.meta, el.dataset.gun, el.dataset.rune), { backdrop: true }); },
  hat(el) {
    act(() => {
      const result = equipHat(state.save.meta, el.dataset.hat || null);
      // A hat that adds health takes effect now, and taking it off can't leave him over the top.
      const run = state.save.run;
      if (result.ok && run) run.hp = Math.min(run.hp, maxHealth(run, state.save.meta));
      return result;
    }, { backdrop: true });
    renderer.setLook({ hat: state.save.meta.hat });
  },
  skin(el) {
    act(() => equipSkin(state.save.meta, el.dataset.skin), { backdrop: true });
    renderer.setLook({ skin: state.save.meta.skin });
  },

  resume() { state.paused = false; show('arena'); },
  giveup() {
    // Counted as going down in this round.
    state.sim.guy.hp = 0;
    state.sim.state = 'dead';
    state.paused = false;
    endWave();
  },
};

screenEl.addEventListener('click', (e) => {
  const el = e.target.closest('button[data-action]');
  if (!el || el.disabled) return;
  actions[el.dataset.action]?.(el);
});
screenEl.addEventListener('change', (e) => {
  const key = e.target.dataset.setting;
  if (!key) return;
  state.save.settings[key] = e.target.type === 'checkbox' ? e.target.checked : Number(e.target.value);
  applySettings();
  persist();
});
screenEl.addEventListener('input', (e) => {
  if (e.target.dataset.setting === 'volume') audio.setVolume(Number(e.target.value));
});

// ----- the loop -----
// ?timer drives the loop from a timer instead of animation frames, for checking the game
// in a browser view that doesn't paint while it's hidden.
const nextFrame = location.search.includes('timer') ? (fn) => setTimeout(() => fn(performance.now()), 16) : requestAnimationFrame;
let last = performance.now();
let owed = 0;
let hudAt = 0;
const shown = { hud: '', guns: '', cards: '' };
let menuAngle = 0;

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const inArena = state.screen === 'arena';

  // Prompts show keys or controller buttons, whichever was touched last.
  if (document.body.dataset.device !== input.device()) document.body.dataset.device = input.device();

  // A controller walks the cursor through a menu's options, confirms with A, backs out with B.
  if (!inArena) {
    const pad = input.menu();
    const options = [...screenEl.querySelectorAll('button:not([disabled]), input')];
    if (pad && options.length) {
      const at = options.indexOf(document.activeElement);
      if (pad.step) options[(Math.max(0, at) + pad.step + options.length) % options.length].focus();
      else if (pad.confirm && at >= 0) options[at].click();
      else if (pad.back) {
        if (state.screen === 'pause') actions.resume();
        else if (screenEl.querySelector('[data-action="back"]')) goBack();
      }
    }
  }

  for (const code of input.takePressed()) {
    if (code === 'Escape' && inArena && state.fighting && state.sim.state === 'fight') { state.paused = true; show('pause'); }
    else if (code === 'Escape' && state.screen === 'pause') actions.resume();
  }

  const sim = state.sim;
  const running = inArena && state.fighting && !state.paused && !state.frozen;
  if (running) {
    owed += dt;
    let steps = 0;
    while (owed >= STEP && steps < 6) {
      const events = sim.step(state.bot ? state.bot(sim) : input.sample(sim));
      renderer.onEvents(events);
      audio.onEvents(events);
      for (const e of events) {
        if (e.type === 'cleared') banner('Round clear!', 1500, 'won');
        if (e.type === 'dead') { banner('Down!', 1800, 'lost'); state.endAt = now + 1800; }
      }
      owed -= STEP;
      steps += 1;
    }
    if (steps === 6) owed = 0;
    if (sim.state === 'done' && !state.endAt) state.endAt = now + 200;
    if (state.endAt && now >= state.endAt) endWave();

    if (now - hudAt > 66 && state.screen === 'arena') {
      hudAt = now;
      const device = input.device();
      const parts = {
        hud: screens.hud({ sim, run: state.save.run, meta: state.save.meta }),
        guns: screens.weaponList({ sim, device }),
        cards: screens.cardBar({ sim, device }),
      };
      if (parts.hud !== shown.hud) { hudEl.innerHTML = parts.hud; shown.hud = parts.hud; }
      if (parts.guns !== shown.guns) { gunsEl.innerHTML = parts.guns; shown.guns = parts.guns; }
      if (parts.cards !== shown.cards) { cardsEl.innerHTML = parts.cards; shown.cards = parts.cards; }
    }
  } else if (!inArena && sim && !state.frozen) {
    // Behind a menu: he idles and looks round, so what he's holding is on show.
    menuAngle += dt * 0.6;
    sim.step({ aimX: sim.guy.x + Math.cos(menuAngle) * 6, aimY: sim.guy.y + Math.sin(menuAngle) * 3 });
  }
  if (!bannerEl.hidden && now > state.bannerUntil && !state.endAt) bannerEl.hidden = true;

  if (sim) renderer.draw(sim, state.paused ? 0 : dt);
  nextFrame(frame);
}

refreshBackdrop();
show('home');

// Picture mode, for the website's images. Opening the game at #shot-cover (or -fight,
// -melee, -boss, -cards, -slots, -title) sets up a scene, plays it forward a fixed number of
// steps with the balance bot at the controls, and holds it still. Nothing is saved.
async function pictureMode(name) {
  state.canWrite = false;
  state.frozen = true;
  state.save = freshSave();
  const meta = state.save.meta;
  meta.hats.push('cowboy', 'crown', 'tophat');
  meta.tokens = 7;
  await renderer.ready;
  state.icons = await makeGunIcons();
  const run = newRun(4242);
  state.save.run = run;
  run.coins = 315;
  const hold = (list, held = 0) => { run.weapons = list.map((id) => ({ id, level: 2, unlocked: 3 })); run.held = held; };
  if (name === 'title') { refreshBackdrop(); show('home'); return; }
  if (name === 'cards') {
    hold(['pistol', 'knife', 'rifle']);
    run.wave = 4;
    run.offer = [{ deck: 'weapon', id: 'katana' }, { deck: 'ability', id: 'zap' }, { deck: 'power', id: 'airstrike' }];
    refreshBackdrop();
    show('pick', { summary: { won: true, wave: 3, pickedUp: 84, bonus: 41, clean: 0, xp: 212, tokens: 1, healed: 15 } });
    return;
  }
  if (name === 'slots') {
    hold(['pistol', 'knife', 'pump']);
    run.powers = ['medkit'];
    refreshBackdrop();
    show('slotmachine', { spin: { shown: ['HAT', 'HAT', 'HAT'], done: true, kind: 'hat', text: 'Top Hat! Wear it from the Wardrobe.' } });
    return;
  }
  // Each fight shot is staged: him in a set spot aiming at a set target, creatures placed
  // round him and held there, a moment of shooting or swinging, then everything holds still.
  const scenes = {
    cover: { wave: 6, weapons: ['m60', 'katana', 'pistol'], rune: ['m60', 'fire'], hat: null, at: [16, 11.2], aim: [24, 9.4], steps: 26, zoom: 0.42,
      foes: [['charger', 24, 9.4], ['swarm', 23.2, 12.6], ['swarm', 24.1, 13.1], ['swarm', 22.7, 13.4], ['spitter', 11, 7.8], ['shell', 11.2, 13.6], ['thrower', 19.4, 14.4]] },
    fight: { wave: 4, weapons: ['rifle', 'knife', 'pistol'], hat: null, at: [14, 10], aim: [22, 7], steps: 30, zoom: 0.6, abilities: ['shockwave', 'turret'], powers: ['medkit', 'molotov'],
      foes: [['charger', 22, 7], ['swarm', 20, 12], ['swarm', 20.6, 12.5], ['swarm', 21.2, 11.9], ['spitter', 7, 5], ['thrower', 8, 14]] },
    melee: { wave: 3, weapons: ['katana', 'pistol'], hat: null, at: [16, 9.4], aim: [18, 9.4], steps: 40, zoom: 0.4, swing: true,
      foes: [['swarm', 17.4, 9.0], ['swarm', 17.5, 10.0], ['swarm', 16.9, 8.4], ['charger', 19.5, 11.5]] },
    boss: { wave: 5, weapons: ['bazooka', 'spear', 'smg'], hat: 'tophat', at: [12, 11], aim: [21, 8], steps: 22, zoom: 0.6, abilities: ['freeze', 'blink', 'mines'],
      foes: [['bigone', 21, 8], ['swarm', 18, 13], ['swarm', 18.6, 13.4]] },
  };
  const scene = scenes[name] ?? scenes.fight;
  hold(scene.weapons);
  run.wave = scene.wave;
  run.abilities = scene.abilities ?? [];
  run.powers = scene.powers ?? [];
  meta.hat = scene.hat;
  if (scene.rune) meta.infused[scene.rune[0]] = scene.rune[1];
  renderer.setLook({ hat: meta.hat });
  run.hp = 100;
  const setup = waveSetup(run, meta);
  setup.plan = { blocks: [], groups: [] };
  setup.idle = true;
  state.sim = createSim(setup);
  state.fighting = true;
  show('arena');
  const sim = state.sim;
  sim.guy.x = scene.at[0];
  sim.guy.y = scene.at[1];
  const foes = scene.foes.map(([kind, x, y]) => ({ e: sim.makeEnemy(kind, null, x, y), x, y }));
  // Too tough to die mid-shot, but still hit hard enough to show a health bar.
  for (const f of foes) { f.e.maxHp *= 40; f.e.hp = f.e.maxHp; }
  renderer.options.focus = { x: scene.at[0] + (scene.aim[0] - scene.at[0]) * 0.25, z: scene.at[1] + 0.4 - (name === 'cover' ? 1.4 : 0), zoom: scene.zoom };
  renderer.options.shake = false;
  for (let i = 0; i < scene.steps + 90; i++) {
    const events = sim.step({ aimX: scene.aim[0], aimY: scene.aim[1], fire: i > 4 });
    // Everyone stays where they were put, facing him, alive.
    for (const f of foes) {
      f.e.x = f.x; f.e.y = f.y; f.e.vx = f.e.vy = f.e.kx = f.e.ky = 0;
      f.e.angle = Math.atan2(sim.guy.y - f.y, sim.guy.x - f.x);
    }
    sim.guy.x = scene.at[0]; sim.guy.y = scene.at[1]; sim.guy.vx = sim.guy.vy = 0; sim.guy.hp = 100; sim.guy.safe = 0;
    renderer.onEvents(events);
    renderer.draw(sim, STEP);
    // Hold on a swing well under way, or on the frame a gun goes off, so the flash shows.
    const shot = events.some((e) => e.type === 'shot');
    if (i >= scene.steps && (scene.swing ? sim.guy.attack && sim.guy.attack.t / sim.guy.attack.dur > 0.5 : shot)) break;
  }
  // A charger winding up, so a warning shows on the floor.
  const charger = foes.find((f) => f.e.kind === 'charger' || f.e.kind === 'bigone');
  if (charger && name !== 'melee') {
    const e = charger.e;
    e.state = 'windup'; e.progress = 0.6;
    const len = Math.hypot(sim.guy.x - e.x, sim.guy.y - e.y) + 3;
    e.tele = { type: 'line', x1: e.x, y1: e.y, x2: e.x + Math.cos(e.angle) * len, y2: e.y + Math.sin(e.angle) * len, width: e.r * 2 + 0.2, progress: 0.6 };
  }
  renderer.draw(sim, STEP);
  bannerEl.hidden = true;
  hudEl.innerHTML = screens.hud({ sim, run, meta });
  gunsEl.innerHTML = screens.weaponList({ sim, device: 'keys' });
  cardsEl.innerHTML = screens.cardBar({ sim, device: 'keys' });
  if (name === 'cover') {
    for (const el of [hudEl, gunsEl, cardsEl, helpEl]) el.hidden = true;
    const title = document.createElement('div');
    title.id = 'cover-title';
    title.innerHTML = '<h1>Small <span>Arms</span></h1><p>One little guy. A lot of weapons.</p>';
    document.body.append(title);
  }
}
if (location.hash.startsWith('#shot-')) pictureMode(location.hash.slice(6));

renderer.ready.then(async () => {
  state.icons = await makeGunIcons();
  // Redraw the menu now the weapon pictures exist.
  if (state.screen !== 'arena' && !state.frozen) redraw();
});
nextFrame(frame);

// For poking at the game from the browser console.
// loaded.coins(5000), loaded.round(10), loaded.give('m60'), loaded.tokens(20), loaded.xp('rifle', 2000),
// loaded.autoplay() hands the controls to the balance bot.
window.loaded = {
  state, tuning, renderer, actions, ROOM, WEAPONS,
  coins(amount) { state.save.run.coins += amount; persist(); redraw(); },
  round(n) { state.save.run.wave = n; persist(); redraw(); },
  give(id, level = 1) { state.save.run.weapons.push({ id, level, unlocked: level }); persist(); refreshBackdrop(); redraw(); },
  tokens(n) { state.save.meta.tokens += n; persist(); redraw(); },
  xp(id, n) { state.save.meta.xp[id] = (state.save.meta.xp[id] ?? 0) + n; persist(); redraw(); },
  // A close look at him holding a weapon: loaded.closeup('rifle', 20) aims 20 degrees;
  // attack true keeps swinging or firing; again with no weapon puts the camera back.
  closeup(id, aimDeg = 20, attack = false) {
    const d = renderer.debug;
    state.home ??= d.cameraHome.clone();
    if (!id) { d.cameraHome.copy(state.home); screenEl.hidden = false; refreshBackdrop(); return 'back'; }
    const meta = state.save.meta;
    state.sim = createSim({ idle: true, loadout: [{ id, level: 1, rune: meta.infused[id] ?? null }], ranks: meta.ranks, bonus: hatBonus(meta) });
    const sim = state.sim;
    const step = sim.step;
    const a = (aimDeg * Math.PI) / 180;
    sim.step = (i) => step({ ...i, aimX: sim.guy.x + Math.cos(a) * 6, aimY: sim.guy.y + Math.sin(a) * 6, fire: attack });
    // Menu sims are idle, and idle ones still swing and shoot if told to.
    sim.state = 'fight';
    screenEl.hidden = true;
    const look = { x: ROOM.w / 2, y: 0, z: ROOM.h / 2 + 0.4 };
    d.cameraHome.set(look.x + (state.home.x - look.x) * 0.1, look.y + (state.home.y - look.y) * 0.1, look.z + (state.home.z - look.z) * 0.1);
    return 'ok';
  },
  async autoplay() {
    if (state.bot) { state.bot = null; return 'off'; }
    const { botInput } = await import('../tools/bot.mjs');
    state.bot = (sim) => botInput(sim, 1);
    return 'on';
  },
};
