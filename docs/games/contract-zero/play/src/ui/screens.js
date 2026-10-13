// The menus: plain HTML text, buttons, and cards over the arena. Each function returns
// the markup for one screen; main.js puts it on the page and answers the buttons, which
// name what they do with data-action. How it all looks is in css/style.css.

import { CATEGORIES } from '../game/contractGen.js';
import { canBuy } from '../game/save.js';
import { CREATURES, MODIFIERS } from '../content/creatures.js';
import { OBJECTS } from '../content/objects.js';
import { GEAR, GEAR_SLOTS, INJURIES, MAX_INJURIES } from '../content/gear.js';
import { ARENAS, TWISTS } from '../content/arenas.js';
import { UNLOCKS, TIER_COST, tierOpen, titleFor, TITLES } from '../content/unlocks.js';
import { LOOKS } from './skins.js';

const n = (value) => Math.round(value).toLocaleString('en-US');
const hex = (value) => `#${value.toString(16).padStart(6, '0')}`;
const button = (action, label, { data = '', primary = false, disabled = false, quiet = false } = {}) =>
  `<button type="button" data-action="${action}" ${data} class="${primary ? 'primary' : quiet ? 'quiet' : ''}" ${disabled ? 'disabled' : ''}>${label}</button>`;

const notice = (text) => (text ? `<p class="notice" role="status">${text}</p>` : '');
const stat = (label, value, extra = '') => `<div class="stat ${extra}"><span>${label}</span><b>${value}</b></div>`;
const head = (kicker, title, sub = '') => `
  <header class="head">
    <p class="kicker">${kicker}</p>
    <h2>${title}</h2>
    ${sub ? `<p class="sub">${sub}</p>` : ''}
  </header>`;

// A square in the creature's own colours, sized by how big it really is in the fight.
function swatch(kind) {
  const look = LOOKS[kind];
  const size = Math.round(14 + Math.min(1.6, CREATURES[kind].r) * 22);
  return `<i class="swatch" style="width:${size}px;height:${size}px;background:${hex(look.top)};border-bottom-color:${hex(look.belly)}" aria-hidden="true"></i>`;
}

export function home({ save, status, problem }) {
  const title = titleFor(save.repLifetime);
  const next = TITLES.find((t) => t.at > save.repLifetime);
  const warn = status === 'restored' ? 'Your last save could not be read, so the backup was loaded.'
    : status === 'broken' ? `Your save could not be read (${problem}). Nothing has been overwritten. Starting a streak will begin a new save.`
    : '';
  return `
    <header class="title">
      <p class="kicker">Creature bounties. One guy. Throw stuff.</p>
      <h1>Contract<br><span>Zero</span></h1>
    </header>
    ${notice(warn)}
    <div class="stats">
      ${stat('Rank', title)}
      ${stat('Rep', n(save.rep))}
      ${stat('Best streak', n(save.records.bestScore))}
    </div>
    ${next ? `<p class="hint centre">${n(next.at - save.repLifetime)} more lifetime Rep to reach ${next.name}.</p>` : ''}
    <nav class="stack">
      ${save.streak ? button('continue', `Continue streak &middot; Threat ${save.streak.threat}`, { primary: true }) : button('start', save.tutorialDone ? 'Start a streak' : 'Start', { primary: true })}
      ${button('practice', 'Practice room')}
      ${button('unlocks', 'Unlocks')}
      ${button('records', 'Records')}
      ${button('settings', 'Settings')}
    </nav>`;
}

function creatureLine(c) {
  const def = CREATURES[c.kind];
  const count = c.count ?? def.count;
  return `
    <li>
      ${swatch(c.kind)}
      <div>
        <b>${def.name}${count ? ` <span class="count">&times;${count}</span>` : ''}</b>
        ${c.mod ? `<span class="mod">${MODIFIERS[c.mod].name}</span>` : ''}
        <small>${c.mod ? MODIFIERS[c.mod].text : def.ask}</small>
      </div>
    </li>`;
}

function objectSummary(kinds) {
  const counts = {};
  for (const k of kinds) counts[k] = (counts[k] ?? 0) + 1;
  return Object.entries(counts).map(([k, c]) => `${c} ${OBJECTS[k].name.toLowerCase()}${c > 1 ? 's' : ''}`).join(', ');
}

// The strip that shows where the streak stands.
export function streakBar(streak) {
  const slots = [];
  for (let i = 0; i < GEAR_SLOTS; i++) {
    const id = streak.gear[i];
    slots.push(`<span class="slot ${id ? '' : 'empty'}">${id ? GEAR[id].name : 'Empty'}</span>`);
  }
  const marks = [];
  for (let i = 0; i < MAX_INJURIES; i++) {
    const id = streak.injuries[i];
    marks.push(`<span class="mark ${id ? 'hit' : ''}">${id ? INJURIES[id].name : '&nbsp;'}</span>`);
  }
  return `
    <div class="bar">
      ${stat('Threat', streak.threat)}
      ${stat('Streak score', n(streak.score))}
      <div class="stat wide"><span>Gear</span><div class="slots">${slots.join('')}</div></div>
      <div class="stat wide"><span>Injuries (the third ends the streak)</span><div class="slots">${marks.join('')}</div></div>
    </div>`;
}

export function board({ streak, confirmCash }) {
  const cards = streak.board.map((contract, i) => `
    <article class="card contract ${contract.category}">
      <header><h3>${CATEGORIES[contract.category].name}</h3><p>${CATEGORIES[contract.category].text}</p></header>
      <ul class="targets">${contract.creatures.map(creatureLine).join('')}</ul>
      <dl>
        <dt>Room</dt><dd>${ARENAS[contract.arena].name}</dd>
        ${contract.twists.map((id) => `<dt>${TWISTS[id].name}</dt><dd>${TWISTS[id].text}</dd>`).join('')}
        <dt>Lying around</dt><dd>${objectSummary(contract.objects)}</dd>
        ${contract.guaranteedGear ? `<dt>Guaranteed reward</dt><dd><b>${GEAR[contract.guaranteedGear].name}</b></dd>` : ''}
      </dl>
      <footer>
        <p class="pay"><span>Pays</span> ${n(contract.score)}</p>
        ${button('pick', 'Take it', { data: `data-index="${i}"`, primary: true })}
      </footer>
    </article>`).join('');
  const foot = confirmCash
    ? `<p class="ask">Bank <b>${n(streak.score)}</b> and end the streak?</p> ${button('cash-yes', 'Yes, cash out', { primary: true })} ${button('cash-no', 'Keep going')}`
    : `${button('cash', `Cash out &middot; bank ${n(streak.score)}`, { disabled: streak.score === 0 && streak.played === 0 })} ${button('reroll', streak.rerollUsed ? 'Board already redrawn' : 'Redraw the board (once)', { disabled: streak.rerollUsed })} ${button('home', 'Save and leave', { quiet: true })}`;
  return `
    ${head('The board', 'Pick a contract')}
    ${streakBar(streak)}
    <div class="cards three">${cards}</div>
    <div class="row">${foot}</div>`;
}

export function reward({ streak, chosen }) {
  const pending = streak.pending;
  const full = streak.gear.length >= GEAR_SLOTS;
  if (chosen !== null && pending.offers[chosen].gear && full) {
    const wanted = GEAR[pending.offers[chosen].gear];
    return `
      ${head('Reward', 'Your hands are full', `Taking <b>${wanted.name}</b> means dropping one of these.`)}
      <div class="cards three">${streak.gear.map((id) => `
        <article class="card"><header><h3>${GEAR[id].name}</h3></header><p>${GEAR[id].text}</p>
        <footer>${button('drop', `Drop it`, { data: `data-drop="${id}"`, primary: true })}</footer></article>`).join('')}</div>
      <div class="row">${button('reward-back', 'Choose something else')}</div>`;
  }
  const cards = pending.offers.map((offer, i) => (offer.gear
    ? `<article class="card gear"><header><h3>${GEAR[offer.gear].name}</h3></header><p>${GEAR[offer.gear].text}</p><footer>${button('take', 'Take it', { data: `data-index="${i}"`, primary: true })}</footer></article>`
    : `<article class="card"><header><h3>Bonus pay</h3></header><p>Nothing new to offer, so the client pays extra: <b>${n(offer.bonus)}</b> score.</p><footer>${button('take', 'Take it', { data: `data-index="${i}"`, primary: true })}</footer></article>`)).join('');
  return `
    ${head('Contract complete', `+${n(pending.earned)}`, 'Pick one reward.')}
    ${streakBar(streak)}
    <div class="cards three">${cards}</div>`;
}

export function injury({ streak }) {
  const cards = streak.pending.options.map((id) => `
    <article class="card hurt"><header><h3>${INJURIES[id].name}</h3></header><p>${INJURIES[id].text}</p>
    <footer>${button('injury', 'Take this one', { data: `data-id="${id}"`, primary: true })}</footer></article>`).join('');
  return `
    ${head('No pay', 'You went down', 'Pick the injury you carry for the rest of the streak.')}
    ${streakBar(streak)}
    <div class="cards two">${cards}</div>`;
}

export function summary({ result, save }) {
  return `
    ${head(result.bust ? 'Three injuries' : 'Cashed out', result.bust ? 'Streak over' : 'Paid in full', result.bust ? 'You keep half of what you had earned.' : 'You keep all of it.')}
    <div class="stats big">
      ${stat('Banked', `${n(result.banked)}${result.newBest ? ' <em>New best</em>' : ''}`, 'lead')}
      ${stat('Contracts won', result.won)}
      ${stat('Reached Threat', result.reached)}
      ${stat('Rep earned', `+${n(result.rep)}`)}
      ${stat('Rank', `${result.title}${result.promoted ? ' <em>Promoted</em>' : ''}`)}
    </div>
    <div class="row">${button('unlocks', `Spend Rep &middot; ${n(save.rep)}`, { primary: true })} ${button('start', 'Start another streak')} ${button('home', 'Home', { quiet: true })}</div>`;
}

export function unlocks({ save }) {
  const tiers = [1, 2].map((tier) => {
    const open = tierOpen(tier, save.unlocks);
    const items = UNLOCKS.filter((u) => u.tier === tier).map((u) => {
      const owned = save.unlocks.includes(u.id);
      return `<article class="card ${owned ? 'owned' : ''}"><header><h3>${u.name}</h3><p>${u.type}</p></header><p>${u.text}</p>
        <footer>${owned ? '<p class="pay">Owned</p>' : button('buy', `Buy &middot; ${TIER_COST[tier]} Rep`, { data: `data-id="${u.id}"`, primary: true, disabled: !canBuy(save, u.id) })}</footer></article>`;
    }).join('');
    return `<h3 class="tier">Tier ${tier}${open ? '' : ' <span>Locked until half of the tier before it is bought</span>'}</h3><div class="cards small">${items}</div>`;
  }).join('');
  const left = UNLOCKS.filter((u) => !save.unlocks.includes(u.id)).length;
  return `
    ${head(`${n(save.rep)} Rep to spend`, 'Unlocks', 'Unlocks add new things to future streaks. None of them makes you stronger.')}
    ${left === 0 ? notice('Everything is unlocked.') : ''}
    ${tiers}
    <div class="row">${button('home', 'Back')}</div>`;
}

export function records({ save }) {
  const r = save.records;
  const rows = r.history.map((h) => `<tr><td>${n(h.banked)}</td><td>${h.threat}</td><td>${h.won}</td><td>${h.bust ? 'Bust' : 'Cashed out'}</td><td>${h.gear.map((id) => GEAR[id]?.name ?? id).join(', ') || 'None'}</td></tr>`).join('');
  return `
    ${head('On this computer', 'Records')}
    <div class="stats big">
      ${stat('Best streak', n(r.bestScore), 'lead')}
      ${stat('Highest Threat', r.bestThreat)}
      ${stat('Streaks finished', r.streaks)}
      ${stat('Rank', titleFor(save.repLifetime))}
      ${stat('Lifetime Rep', n(save.repLifetime))}
    </div>
    ${rows ? `<table><caption>Last ten streaks</caption><thead><tr><th>Banked</th><th>Threat</th><th>Won</th><th>Ended</th><th>Gear</th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="sub">No streaks yet.</p>'}
    <p class="hint">Scores are kept on this computer only. Shared scores are planned for later.</p>
    <div class="row">${button('home', 'Back')}</div>`;
}

const pad = (name, label) => `<img class="pad ${name}" src="img/pad/${name}.png" alt="${label}">`;

const keys = `
  <ul class="keys for-pad">
    <li>${pad('dpad', 'D-pad')} <span>Move, and aim the way you walk</span></li>
    <li>${pad('r', 'R')} <span>Hold to plant your feet and aim without walking</span></li>
    <li>${pad('a', 'A')} <span>Hold to grab and charge, release to throw</span></li>
    <li>${pad('y', 'Y')} <span>Shove, or drop what you hold</span></li>
    <li>${pad('start', 'Start')} <span>Pause</span></li>
  </ul>
  <ul class="keys for-keys">
    <li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> <span>Move</span></li>
    <li><kbd>Mouse</kbd> <span>Aim</span></li>
    <li><kbd>Hold left mouse</kbd> <span>Grab and charge</span></li>
    <li><kbd>Release</kbd> <span>Throw</span></li>
    <li><kbd>Space</kbd> / <kbd>Right mouse</kbd> <span>Shove, or drop what you hold</span></li>
    <li><kbd>Esc</kbd> <span>Pause</span></li>
    <li><kbd>Arrows</kbd> + <kbd>Enter</kbd> <span>Aim and throw with no mouse</span></li>
  </ul>
  <p class="hint">A controller works too: press any button on it and these prompts switch over.</p>`;

export function settings({ save, message, confirmReset }) {
  const check = (key, label, text) => `
    <label class="check"><input type="checkbox" data-setting="${key}" ${save.settings[key] ? 'checked' : ''}> <span><b>${label}</b>${text}</span></label>`;
  return `
    ${head('Options', 'Settings')}
    <section>
      ${check('shake', 'Screen shake', 'Shake the view on hard hits.')}
      ${check('takeYourTime', 'Take Your Time', 'The aim meter never runs out. For anyone who wants or needs more time to aim.')}
    </section>
    <section><h3>Controls</h3>${keys}</section>
    <section>
      <h3>Save</h3>
      <p class="hint">Your save lives in this browser. Copy it out to keep a spare, or paste one in to restore it.</p>
      <textarea id="save-text" rows="3" aria-label="Save text" spellcheck="false"></textarea>
      <div class="row tight">${button('export', 'Copy my save into the box')} ${button('import', 'Load the save in the box')}</div>
      ${notice(message)}
    </section>
    <div class="row">${confirmReset
    ? `<p class="ask">Erase all progress?</p> ${button('reset-yes', 'Yes, erase it', { primary: true })} ${button('reset-no', 'No')}`
    : `${button('home', 'Back', { primary: true })} ${button('reset', 'Erase all progress', { quiet: true })}`}</div>`;
}

export function pause({ mode }) {
  const leave = mode === 'fight' ? 'Give up this contract (no score, no injury)' : mode === 'tutorial' ? 'Skip the tutorial' : 'Leave the practice room';
  return `
    ${head('Time out', 'Paused')}
    <nav class="stack">
      ${button('resume', 'Resume', { primary: true })}
      ${button('leave', leave)}
    </nav>
    ${keys}`;
}

// The strip across the top of the arena.
export function hud({ sim, streak, mode }) {
  const g = sim.guy;
  let pips = '';
  for (let i = 0; i < 3; i++) pips += `<i class="${i < g.pips ? '' : 'spent'}"></i>`;
  const cells = [`<div class="cell pips" aria-label="Health ${Math.max(0, g.pips)} of 3"><span>You</span><div>${pips}</div></div>`];
  if (mode === 'fight' && streak) {
    cells.push(
      `<div class="cell"><span>Threat</span><b>${sim.contract.threat}</b></div>`,
      `<div class="cell"><span>This contract</span><b>${n(sim.contract.score)}</b></div>`,
      `<div class="cell"><span>Streak</span><b>${n(streak.score)}</b></div>`,
    );
    if (streak.gear.length) cells.push(`<div class="cell"><span>Gear</span><b>${streak.gear.map((id) => GEAR[id].name).join(' / ')}</b></div>`);
    if (streak.injuries.length) cells.push(`<div class="cell hurt"><span>Injuries</span><b>${streak.injuries.map((id) => INJURIES[id].name).join(' / ')}</b></div>`);
    const wait = Math.max(0, Math.ceil(20 - sim.time));
    cells.push(`<div class="cell exit ${sim.exitOpen ? 'open' : ''}"><span>Exit, west wall</span><b>${sim.exitOpen ? 'Open' : `${wait}s`}</b></div>`);
  } else if (mode === 'practice') {
    cells.push('<div class="cell"><span>Practice room</span><b>Esc to leave</b></div>');
  } else if (mode === 'tutorial') {
    cells.push('<div class="cell"><span>Contract Zero</span><b>Training</b></div>');
  }
  return cells.join('');
}

// What the tutorial asks for next.
export function tutorialPrompt(sim, progress, device = 'keys') {
  const onPad = device === 'pad';
  if (sim.result === 'won') return 'That is the whole job. Now for a real one.';
  if (sim.guy.held) {
    if (sim.guy.charge >= 1) return 'Fully charged. Aim at the target and <b>let go</b>.';
    return onPad ? `Keep holding to charge. Hold ${pad('r', 'R')} to stand still and aim with ${pad('dpad', 'the D-pad')}.` : 'Keep holding to charge the throw. Aim with the mouse.';
  }
  if (progress.throws === 0) {
    return onPad
      ? `${pad('dpad', 'D-pad')} to walk. Stand by a crate and <b>hold</b> ${pad('a', 'A')} to pick it up.`
      : '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> to walk. Stand by a crate and <b>hold the left mouse button</b> to pick it up.';
  }
  const left = sim.creatures[0]?.pips ?? 0;
  return `Knock off the target's last ${left} pip${left === 1 ? '' : 's'}. Time slows while you aim.`;
}
