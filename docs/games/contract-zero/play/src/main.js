// Contract Zero. Ties the pieces together: the save, the streak, the fight, and the menus.

import { createSim, PRACTICE_CONTRACT } from './sim/world.js';
import { STEP, tuning } from './sim/tuning.js';
import { TIER_NAMES } from './sim/impact.js';
import { createRenderer3d } from './ui/render3d.js';
import { createInput } from './ui/input.js';
import * as screens from './ui/screens.js';
import { newStreak, reroll, startFight, finishFight, takeReward, takeInjury, cashOut } from './game/streak.js';
import { loadSave, writeSave, freshSave, bankStreak, buyUnlock, exportSave, importSave } from './game/save.js';

const stage = document.getElementById('stage');
const overlay = document.getElementById('overlay');
const screenEl = document.getElementById('screen');
const hudEl = document.getElementById('hud');
const promptEl = document.getElementById('prompt');
const bannerEl = document.getElementById('banner');
const helpEl = document.getElementById('help');
const renderer = createRenderer3d(document.getElementById('arena3d'), overlay);
const input = createInput(stage, (x, y) => renderer.toWorld(x, y));

// The browser can refuse storage (private windows, blocked site data). The game still
// plays; it just won't remember.
const storage = (() => {
  try {
    window.localStorage.getItem('contract-zero-probe');
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
  mode: null,          // 'fight', 'tutorial', or 'practice' while in the arena
  sim: createSim({ practice: true }),
  paused: false,
  resultAt: 0,
  tutorial: { throws: 0 },
};

function persist() {
  if (!state.canWrite) return;
  try { writeSave(storage, state.save); } catch { /* storage full or blocked: keep playing */ }
}
if (loaded.closedFight) persist();

function applySettings() {
  renderer.options.shake = state.save.settings.shake;
}
applySettings();

// ----- screens -----
function show(name, view = {}) {
  state.screen = name;
  state.view = view;
  const inArena = name === 'arena';
  screenEl.hidden = inArena;
  hudEl.hidden = !inArena;
  helpEl.hidden = !inArena;
  promptEl.hidden = !(inArena && state.mode === 'tutorial');
  if (inArena) { screenEl.innerHTML = ''; input.reset(); return; }
  const data = { save: state.save, status: state.status, problem: state.problem, streak: state.save.streak, mode: state.mode, ...view };
  screenEl.innerHTML = `<div class="panel ${name}">${screens[name](data)}</div>`;
  screenEl.scrollTop = 0;
  const first = screenEl.querySelector('button.primary:not([disabled])') ?? screenEl.querySelector('button:not([disabled])');
  if (first) first.focus({ preventScroll: true });
}

function startArena(mode, sim) {
  state.mode = mode;
  state.sim = sim;
  state.paused = false;
  state.resultAt = 0;
  bannerEl.hidden = true;
  show('arena');
}

function startStreak() {
  if (!state.canWrite) {
    // The player chose to begin again over an unreadable save.
    state.save = freshSave();
    state.save.tutorialDone = true;
    state.canWrite = true;
    state.status = 'ok';
  }
  state.save.streak = newStreak((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0, state.save.unlocks);
  persist();
  show('board');
}

function startTutorial() {
  state.tutorial = { throws: 0 };
  startArena('tutorial', createSim({ contract: { ...PRACTICE_CONTRACT, tutorial: true, objects: ['crate', 'crate', 'crate', 'crate'] } }));
}

function startFightAt(index) {
  const streak = state.save.streak;
  const contract = startFight(streak, index);
  // Saved with the fight open: closing the game now counts as a bail on the next load.
  persist();
  startArena('fight', createSim({ contract, gear: streak.gear, injuries: streak.injuries, endlessAim: state.save.settings.takeYourTime }));
}

function afterStreakStep() {
  const streak = state.save.streak;
  if (streak.over) {
    const result = bankStreak(state.save, streak);
    persist();
    show('summary', { result });
    return;
  }
  persist();
  if (streak.pending?.type === 'reward') show('reward', { chosen: null });
  else if (streak.pending?.type === 'injury') show('injury');
  else show('board');
}

function endFight(result) {
  state.mode = null;
  if (result === 'tutorial-won') {
    state.save.tutorialDone = true;
    startStreak();
    return;
  }
  finishFight(state.save.streak, result, state.save.unlocks);
  afterStreakStep();
}

const actions = {
  start() { if (state.save.tutorialDone || !state.canWrite) startStreak(); else startTutorial(); },
  continue() { afterStreakStep(); },
  practice() { startArena('practice', createSim({ practice: true })); },
  home() { state.mode = null; show('home'); },
  unlocks() { show('unlocks'); },
  records() { show('records'); },
  settings() { show('settings'); },
  pick(d) { startFightAt(Number(d.index)); },
  reroll() { if (reroll(state.save.streak, state.save.unlocks)) { persist(); show('board'); } },
  cash() { show('board', { confirmCash: true }); },
  'cash-no'() { show('board'); },
  'cash-yes'() { if (cashOut(state.save.streak)) afterStreakStep(); },
  take(d) {
    const streak = state.save.streak;
    const index = Number(d.index);
    const offer = streak.pending.offers[index];
    if (offer.gear && streak.gear.length >= 3) { show('reward', { chosen: index }); return; }
    takeReward(streak, offer, null, state.save.unlocks);
    afterStreakStep();
  },
  drop(d) {
    const streak = state.save.streak;
    takeReward(streak, streak.pending.offers[state.view.chosen], d.drop, state.save.unlocks);
    afterStreakStep();
  },
  'reward-back'() { show('reward', { chosen: null }); },
  injury(d) { takeInjury(state.save.streak, d.id, state.save.unlocks); afterStreakStep(); },
  buy(d) { if (buyUnlock(state.save, d.id)) persist(); show('unlocks'); },
  export() { show('settings'); document.getElementById('save-text').value = exportSave(state.save); document.getElementById('save-text').select(); },
  import() {
    const result = importSave(document.getElementById('save-text').value);
    if (!result.save) { show('settings', { message: `That save could not be loaded: ${result.problem}.` }); return; }
    state.save = result.save;
    state.canWrite = true;
    state.status = 'ok';
    persist();
    applySettings();
    show('settings', { message: 'Save loaded.' });
  },
  reset() { show('settings', { confirmReset: true }); },
  'reset-no'() { show('settings'); },
  'reset-yes'() {
    state.save = freshSave();
    state.canWrite = true;
    state.status = 'ok';
    persist();
    applySettings();
    show('home');
  },
  resume() { state.paused = false; show('arena'); },
  leave() {
    state.paused = false;
    if (state.mode === 'fight') endFight('bailed');
    else if (state.mode === 'tutorial') endFight('tutorial-won');
    else actions.home();
  },
};

screenEl.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  actions[el.dataset.action]?.(el.dataset);
});
screenEl.addEventListener('change', (e) => {
  const key = e.target.dataset?.setting;
  if (!key) return;
  state.save.settings[key] = e.target.checked;
  persist();
  applySettings();
});

// ----- the details panel (T): live tuning and the last impact -----
const SLIDERS = [
  ['throwPower', 'Throw power', 0.4, 2, 0.05],
  ['chargeTime', 'Charge time (s)', 0.2, 2, 0.05],
  ['slowScale', 'Slow-motion speed', 0.1, 1, 0.05],
  ['aimMeterMax', 'Aim meter (s)', 0.5, 5, 0.1],
  ['guySpeed', 'Guy speed', 4, 16, 0.5],
  ['flightTime', 'Flight time (s)', 0.3, 3, 0.1],
  ['T1', 'Solid from', 50, 1000, 10],
  ['T2', 'Big from', 300, 3000, 50],
  ['T3', 'Massive from', 800, 6000, 100],
];
const panel = document.getElementById('panel');
const readout = document.getElementById('readout');
for (const [key, label, min, max, step] of SLIDERS) {
  const row = document.createElement('label');
  const out = document.createElement('output');
  const range = document.createElement('input');
  range.type = 'range';
  range.min = min; range.max = max; range.step = step; range.value = tuning[key];
  out.textContent = tuning[key];
  range.addEventListener('input', () => { tuning[key] = Number(range.value); out.textContent = range.value; });
  row.append(label, out, range);
  document.getElementById('sliders').append(row);
}
document.getElementById('copy').addEventListener('click', async (e) => {
  const text = SLIDERS.map(([key]) => `${key}: ${tuning[key]}`).join('\n');
  try { await navigator.clipboard.writeText(text); e.target.textContent = 'Copied'; } catch { readout.textContent = text; }
  setTimeout(() => { e.target.textContent = 'Copy these numbers'; }, 1200);
});

function showImpact(hit) {
  readout.textContent = `${hit.kinds.join(' into ')}\nclosing speed  ${hit.speed.toFixed(1)} m/s\nenergy         ${hit.energy.toFixed(0)}\ntier           ${TIER_NAMES[hit.tier]}`;
}

// ----- the loop -----
const RESULT_TEXT = { won: 'Contract complete', lost: 'You went down', bailed: 'You walked out' };
let last = performance.now();
let owed = 0;
let hudText = '';
let promptText = '';

function onResult(result) {
  bannerEl.textContent = RESULT_TEXT[result];
  bannerEl.dataset.result = result;
  bannerEl.hidden = false;
  state.resultAt = performance.now();
}

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const inArena = state.screen === 'arena';

  // Prompts show keys or controller buttons, whichever was touched last.
  if (document.body.dataset.device !== input.device()) document.body.dataset.device = input.device();

  // A controller walks the cursor through a menu's options and confirms with A or B.
  if (!inArena) {
    const pad = input.menu();
    const options = [...screenEl.querySelectorAll('button:not([disabled]), input[type="checkbox"]')];
    if (pad && options.length) {
      const at = options.indexOf(document.activeElement);
      if (pad.step) options[(Math.max(0, at) + pad.step + options.length) % options.length].focus();
      else if (pad.confirm && at >= 0) options[at].click();
      else if (pad.back && state.screen === 'pause') actions.resume();
    }
  }

  for (const code of input.takePressed()) {
    if (code === 'KeyT' && inArena) panel.hidden = !panel.hidden;
    if (code === 'Escape' && inArena && !state.sim.result) { state.paused = true; show('pause'); }
    else if (code === 'Escape' && state.screen === 'pause') actions.resume();
  }

  if (inArena && !state.paused && !state.frozen) {
    owed += dt;
    let steps = 0;
    while (owed >= STEP && steps < 5) {
      const events = state.sim.step(input.sample(state.sim.guy.body.getPosition()));
      renderer.onEvents(events);
      for (const e of events) {
        if (e.type === 'result') onResult(e.result);
        if (e.type === 'throw') state.tutorial.throws += 1;
      }
      owed -= STEP;
      steps += 1;
    }
    if (steps === 5) owed = 0;

    const text = screens.hud({ sim: state.sim, streak: state.save.streak, mode: state.mode });
    if (text !== hudText) { hudEl.innerHTML = text; hudText = text; }
    if (state.mode === 'tutorial') {
      const text = screens.tutorialPrompt(state.sim, state.tutorial, input.device());
      if (text !== promptText) { promptEl.innerHTML = text; promptText = text; }
    }
    if (!panel.hidden && state.sim.lastImpact) showImpact(state.sim.lastImpact);

    // The result stays on screen for a moment, then the game moves on by itself.
    if (state.resultAt && now - state.resultAt > 1500) {
      const result = state.sim.result;
      state.resultAt = 0;
      bannerEl.hidden = true;
      if (state.mode === 'practice') actions.home();
      else endFight(state.mode === 'tutorial' ? 'tutorial-won' : result);
    }
  }

  renderer.draw(state.sim, inArena && !state.paused && !state.frozen ? dt : 0);
  requestAnimationFrame(frame);
}

show('home');

// Picture mode, for the website's images. Opening index.html#shot-fight (or -boss, -board,
// -cover) sets up a scene, plays it forward a fixed number of steps, and holds it still.
// Nothing is saved while it is on.
function pictureMode(name) {
  state.canWrite = false;
  state.save = freshSave();
  state.save.tutorialDone = true;
  state.save.rep = 42;
  state.save.repLifetime = 180;
  state.save.records.bestScore = 12840;
  if (name === 'title') { show('home'); return; }
  const streak = newStreak(7, ['thrower', 'pit', 'anvil', 'shell', 'bumpers', 'ice']);
  Object.assign(streak, { threat: 9, played: 8, won: 7, score: 6400, gear: ['sticky', 'bungee'], injuries: ['limp'] });
  state.save.streak = streak;
  if (name === 'board') {
    streak.board = [];
    streak.threat = 9;
    reroll(streak, ['thrower', 'pit', 'anvil', 'shell', 'bumpers', 'ice']);
    show('board');
    return;
  }
  const boss = name === 'boss';
  if (boss) streak.threat = 10;
  const contract = boss
    ? { seed: 12, threat: 10, arena: 'open', twists: ['pit', 'ice'], category: 'reliable', score: 5000, creatures: [{ kind: 'bigone' }, { kind: 'swarm', count: 5 }], objects: ['crate', 'crate', 'tire', 'barrel', 'anvil', 'barrel'] }
    : { seed: 5, threat: 9, arena: 'pillars', twists: ['spikes', 'bumpers'], category: 'anomaly', score: 3780, creatures: [{ kind: 'charger', mod: 'spiky' }, { kind: 'spitter' }, { kind: 'thrower' }], objects: ['crate', 'crate', 'tire', 'barrel', 'pipe', 'crate', 'tire', 'barrel'] };
  startArena('fight', createSim({ contract, gear: streak.gear, injuries: [] }));
  const sim = state.sim;
  for (let i = 0; i < 190; i++) {
    const gp = sim.guy.body.getPosition();
    const target = sim.creatures[0].body.getPosition();
    const events = sim.step({ moveX: 0, moveY: 0, aimAngle: Math.atan2(target.y - gp.y, target.x - gp.x), hold: i > 85, shove: false });
    renderer.onEvents(events);
    renderer.draw(sim, STEP);
  }
  state.frozen = true;
  hudEl.innerHTML = screens.hud({ sim, streak, mode: 'fight' });
  if (name === 'cover') {
    helpEl.hidden = true;
    hudEl.hidden = true;
    const title = document.createElement('div');
    title.id = 'cover-title';
    title.innerHTML = '<h1>Contract <span>Zero</span></h1><p>Creature bounties. One guy. Throw stuff.</p>';
    document.body.append(title);
  }
}
if (location.hash.startsWith('#shot-')) pictureMode(location.hash.slice(6));

requestAnimationFrame(frame);

// For poking at the game from the browser console.
// cz.fight(contract, gear) drops straight into any fight, outside a streak, for checking content.
window.cz = {
  state, tuning, renderer, actions,
  fight: (contract, gear = []) => startArena('practice', createSim({ contract: { seed: 1, threat: 1, arena: 'open', twists: [], objects: ['crate', 'crate', 'tire', 'barrel'], ...contract }, gear })),
};
