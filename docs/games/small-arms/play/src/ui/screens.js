// The menus and the status bar: plain HTML text, buttons, and cards over the arena. Each
// function returns the markup for one screen; main.js puts it on the page and answers the
// buttons, which name what they do with data-action. How it all looks is in css/style.css.

import { WEAPONS, WEAPON_ORDER, MAX_LEVEL, MAX_WEAPONS, MASTERY, MASTERY_MAX, weaponStats, upgradeCost, masteryCost, masteryKeys, dps, isMelee } from '../content/weapons.js';
import { ENEMIES } from '../content/enemies.js';
import { ABILITIES, POWERS, MAX_ABILITIES, MAX_POWERS, DECK_NAMES } from '../content/cards.js';
import { HATS, SKINS, RUNES, TOKEN_PRICE, PRIZES, RUNE_TIERS, TIER_NAMES, MERGE_COUNT, SOCKET_COST } from '../content/loot.js';
import { cardEffect, canUpgrade, upgradePrice, isBossWave, maxHealth, rerollCost, canPatch, patchCost, PATCH_HP } from '../game/run.js';
import { hatBonus, rankOf, canBuyRank, runeCount, socketsOf, socketRune, infusedRunes, bestTier, canMerge, canOpenSocket, spareRunes } from '../game/meta.js';
import { LOOKS } from './skins.js';

const n = (value) => Math.round(value).toLocaleString('en-US');
const cash = (value) => `$${n(value)}`;
const hex = (value) => `#${value.toString(16).padStart(6, '0')}`;
const button = (action, label, { data = '', primary = false, disabled = false, quiet = false, title = '' } = {}) =>
  `<button type="button" data-action="${action}" ${data} class="${primary ? 'primary' : quiet ? 'quiet' : ''}" ${disabled ? 'disabled' : ''} ${title ? `title="${title}"` : ''}>${label}</button>`;

const notice = (text) => (text ? `<p class="notice" role="status">${text}</p>` : '');
const stat = (label, value, extra = '') => `<div class="stat ${extra}"><span>${label}</span><b>${value}</b></div>`;
const head = (kicker, title, sub = '') => `
  <header class="head">
    <p class="kicker">${kicker}</p>
    <h2>${title}</h2>
    ${sub ? `<p class="sub">${sub}</p>` : ''}
  </header>`;
const icon = (icons, id) => (icons?.[id] ? `<img class="gunicon" src="${icons[id]}" alt="">` : '<i class="gunicon"></i>');
const pips = (level, unlocked = level) => `<span class="lv" aria-label="Level ${level} of ${MAX_LEVEL}">${Array.from({ length: MAX_LEVEL }, (_, i) => `<i class="${i < level ? 'on' : i < unlocked ? 'open' : ''}"></i>`).join('')}</span>`;
const classLabel = (id) => ({ handgun: 'Handgun', long: 'Long gun', melee: 'Melee' })[WEAPONS[id].class];
const runeName = (r) => `<b class="rune" style="color:${hex(RUNES[r.id].color)}">${RUNES[r.id].name} ${TIER_NAMES[r.tier]}</b>`;
// The runes in a weapon's sockets, as coloured names.
const runeTags = (meta, id) => infusedRunes(meta, id).map(runeName).join(' ');

// Simple shapes for the cards' pictures, drawn in the pixel font's fallback.
const GLYPH = { ring: '&#9678;', ball: '&#9679;', tower: '&#9650;', bolt: '&#991;', bubble: '&#9711;', clock: '&#9719;', arrow: '&#10140;', drop: '&#9660;', guy: '&#9786;', mine: '&#10039;', flake: '&#10033;', ammo: '&#9646;', heart: '&#9829;' };
const POWER_GLYPH = { medkit: '&#10010;', grenade: '&#9679;', adrenaline: '&#991;', plate: '&#9635;', coinbag: '$', ammo: '&#9646;', smoke: '&#9729;', icebomb: '&#10033;', molotov: '&#9832;', rage: '&#9733;', tesla: '&#991;', airstrike: '&#10148;', mystery: '?', revive: '&#9829;', nuke: '&#10040;' };

// A square in the creature's own colours, sized by how big it really is in the fight.
function swatch(kind) {
  const look = LOOKS[kind];
  const size = Math.round(14 + Math.min(1.6, ENEMIES[kind].r) * 22);
  return `<i class="swatch" style="width:${size}px;height:${size}px;background:${hex(look.top)};border-bottom-color:${hex(look.belly)}" aria-hidden="true"></i>`;
}

const keyList = `
  <ul class="keys">
    <li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>Move</span></li>
    <li><kbd>Mouse</kbd><span>Aim</span></li>
    <li><kbd>Hold left mouse</kbd><span>Shoot or swing</span></li>
    <li><kbd>Space</kbd> or <kbd>Right mouse</kbd><span>Dash. You can't be hurt mid-dash</span></li>
    <li><kbd>Wheel</kbd> <kbd>Tab</kbd> <kbd>1</kbd>-<kbd>4</kbd><span>Swap weapon</span></li>
    <li><kbd>Q</kbd><kbd>E</kbd><kbd>F</kbd><span>Abilities</span></li>
    <li><kbd>Z</kbd><kbd>X</kbd><kbd>C</kbd><span>Use a power</span></li>
    <li><kbd>R</kbd><span>Reload</span></li>
    <li><kbd>Esc</kbd><span>Pause</span></li>
  </ul>
  <p class="hint">Controller: left stick moves, right stick aims, RT attacks, LT dashes, bumpers swap, A B Y abilities, D-pad left up right powers, X reloads.</p>`;

export function home({ save, status, problem, icons }) {
  const warn = status === 'restored' ? 'Your last save could not be read, so the backup was loaded.'
    : status === 'broken' ? `Your save could not be read (${problem}). Nothing has been overwritten. Starting a run will begin a new save.`
    : '';
  const r = save.records;
  const run = save.run;
  return `
    <header class="title">
      <p class="kicker">A Contract Zero game. One guy. A lot of weapons.</p>
      <h1>Small<br><span>Arms</span></h1>
      <div class="lineup">${['pistol', 'pump', 'katana', 'bazooka'].map((id) => icon(icons, id)).join('')}</div>
    </header>
    ${notice(warn)}
    <div class="stats">
      ${stat('Best round', r.bestWave ? n(r.bestWave) : '-')}
      ${stat('Runs', n(r.runs))}
      ${stat('Slot tokens', n(save.meta.tokens))}
    </div>
    <nav class="stack">
      ${run ? button('continue', `Continue &middot; Round ${run.wave}`, { primary: true }) : ''}
      ${button('newrun', run ? 'New run (ends this one)' : 'Start a run', { primary: !run })}
      ${button('armory', 'Armory')}
      ${button('wardrobe', 'Wardrobe')}
      ${button('howto', 'How to play')}
      ${button('settings', 'Settings')}
    </nav>`;
}

export function howto() {
  return `
    ${head('How to play', 'Shoot, swing, survive')}
    <p class="hint">Rounds of creatures never stop coming. After each round, three cards are dealt: one weapon, one ability, one power. Take one.</p>
    <p class="hint">Weapons: carry up to ${MAX_WEAPONS} and hold one at a time. Draw a weapon you already have and its next level gets cheap; without a duplicate you can still force it, for more coins. Coins also buy a new deal of cards and a patch-up between rounds.</p>
    <p class="hint">Abilities (up to ${MAX_ABILITIES}) run on a cooldown. Powers (up to ${MAX_POWERS}) are used once. Both are gone when the run ends.</p>
    <p class="hint">Weapons earn XP as you use them, and XP buys permanent ranks in the Armory. Slot tokens, runes, hats, and skins last between runs too.</p>
    ${keyList}
    <section>
      <h3>Who you'll meet</h3>
      <ul class="targets">
        ${Object.entries(ENEMIES).map(([kind, def]) => `<li>${swatch(kind)}<div><b>${def.name}</b> <span class="from">from round ${def.from}</span><small>${def.blurb}</small></div></li>`).join('')}
      </ul>
    </section>
    <nav class="row">${button('back', 'Back', { primary: true })}</nav>`;
}

function statLines(s, next) {
  const line = (label, now, then, fmt = (v) => n(v)) => `<dt>${label}</dt><dd>${fmt(now)}${then !== undefined && fmt(then) !== fmt(now) ? ` <b>&rarr; ${fmt(then)}</b>` : ''}</dd>`;
  const dmg = (x) => `${n(x.damage)}${x.pellets ? ` &times;${x.pellets}` : ''}`;
  if (s.class === 'melee') {
    return `<dl class="gunstats">
      ${line('Damage', s, next, dmg)}
      ${line('Hits a second', s.rate, next?.rate, (v) => v.toFixed(1))}
      ${line('Reach', s.reach, next?.reach, (v) => `${v.toFixed(1)}m`)}
      ${line('Damage a second', dps(s), next ? dps(next) : undefined)}
    </dl>`;
  }
  return `<dl class="gunstats">
    ${line('Damage', s, next, dmg)}
    ${line('Shots a second', s.rate, next?.rate, (v) => v.toFixed(1))}
    ${line('Magazine', s.mag, next?.mag)}
    ${line('Reload', s.reload, next?.reload, (v) => `${v.toFixed(1)}s`)}
    ${line('Damage a second', dps(s), next ? dps(next) : undefined)}
  </dl>`;
}

// ----- the card pick -----
function cardFace(card, i, run, save, icons) {
  const effect = cardEffect(run, card);
  let body = '';
  let picture = '';
  let name = '';
  if (card.deck === 'weapon') {
    const w = WEAPONS[card.id];
    const have = run.weapons.find((x) => x.id === card.id);
    name = w.name;
    picture = icon(icons, card.id);
    const runes = runeTags(save.meta, card.id);
    body = `<p class="cardtext">${classLabel(card.id)}. ${w.blurb}${runes ? ` ${runes}` : ''}</p>
      ${statLines(weaponStats(card.id, have?.level ?? 1, save.meta.ranks[card.id] ?? {}, hatBonus(save.meta)))}`;
  } else if (card.deck === 'ability') {
    const a = ABILITIES[card.id];
    name = a.name;
    picture = `<i class="glyph">${GLYPH[a.icon] ?? '&#9679;'}</i>`;
    body = `<p class="cardtext">${a.text}</p><p class="cardtext dim">Cooldown ${a.cooldown}s</p>`;
  } else {
    const p = POWERS[card.id];
    name = p.name;
    picture = `<i class="glyph">${POWER_GLYPH[card.id] ?? '?'}</i>`;
    body = `<p class="cardtext">${p.text}</p><p class="cardtext dim">Single use &middot; ${p.rarity}</p>`;
  }
  return `
    <article class="card deal ${card.deck}">
      <header><p class="deck">${DECK_NAMES[card.deck]}</p>${picture}<h3>${name}</h3></header>
      ${body}
      <footer><p class="effect ${effect.kind}">${effect.text}</p>${button('take', 'Take', { data: `data-card="${i}"`, primary: true })}</footer>
    </article>`;
}

export function pick({ save, icons, summary }) {
  const run = save.run;
  const result = summary?.won
    ? `<p class="hint">Picked up ${cash(summary.pickedUp)} &middot; round bonus ${cash(summary.bonus)}${summary.clean ? ` &middot; <b>no-hit bonus ${cash(summary.clean)}</b>` : ''} &middot; ${n(summary.xp)} weapon XP${summary.tokens ? ` &middot; <b>${summary.tokens} slot token${summary.tokens > 1 ? 's' : ''}</b>` : ''}${summary.healed ? ` &middot; healed ${summary.healed}` : ''}</p>`
    : '';
  return `
    ${head(summary?.won ? `Round ${summary.wave} cleared` : 'Choose a card', 'Pick one')}
    ${result}
    <div class="cards three dealt">${run.offer.map((c, i) => cardFace(c, i, run, save, icons)).join('')}</div>
    <nav class="row">${button('reroll', `Deal again ${cash(rerollCost(run))}`, { disabled: run.coins < rerollCost(run), title: 'Three new cards; the price doubles each time until the next round' })}<span class="tagline">${cash(run.coins)} to spend</span></nav>`;
}

// A card that needs room: pick what goes.
export function replace({ save, icons }) {
  const run = save.run;
  const card = run.pending;
  let options = '';
  let title = '';
  if (card.deck === 'weapon') {
    title = `Make room for the ${WEAPONS[card.id].name}`;
    options = run.weapons.map((w, i) => `
      <article class="card gun">
        <header>${icon(icons, w.id)}<h3>${WEAPONS[w.id].name}</h3><p>${classLabel(w.id)} &middot; ${pips(w.level, w.unlocked)}</p></header>
        <footer><span></span>${button('resolve', 'Drop this one', { data: `data-slot="${i}"` })}</footer>
      </article>`).join('');
  } else {
    const list = card.deck === 'ability' ? run.abilities : run.powers;
    const def = card.deck === 'ability' ? ABILITIES : POWERS;
    title = `Make room for ${def[card.id].name}`;
    options = list.map((id, i) => `
      <article class="card perk">
        <header><h3>${def[id].name}</h3><p>${def[id].text}</p></header>
        <footer><span></span>${button('resolve', 'Drop this one', { data: `data-slot="${i}"` })}</footer>
      </article>`).join('');
  }
  return `
    ${head('Hands full', title)}
    <div class="cards small">${options}</div>
    <nav class="row">${button('resolve', 'Keep what I have', { data: 'data-slot="-1"', quiet: true })}</nav>`;
}

// ----- between rounds -----
export function camp({ save, icons }) {
  const run = save.run;
  const meta = save.meta;
  const boss = isBossWave(run.wave);
  const bonus = hatBonus(meta);
  const weapons = run.weapons.map((w, slot) => {
    const ranks = meta.ranks[w.id] ?? {};
    const stats = weaponStats(w.id, w.level, ranks, bonus);
    const next = w.level < MAX_LEVEL ? weaponStats(w.id, w.level + 1, ranks, bonus) : undefined;
    const up = canUpgrade(run, slot);
    const runes = runeTags(meta, w.id);
    // Without a duplicate the next level still sells, at a premium.
    const label = w.level >= MAX_LEVEL ? 'Maxed' : w.level >= w.unlocked ? `Force it ${cash(upgradePrice(w))}` : `Upgrade ${cash(upgradePrice(w))}`;
    return `
      <article class="card gun ${slot === run.held ? 'held' : ''}">
        <header>${icon(icons, w.id)}<h3>${WEAPONS[w.id].name}</h3><p>${classLabel(w.id)} &middot; ${pips(w.level, w.unlocked)}${runes ? ` &middot; ${runes}` : ''}</p></header>
        ${statLines(stats, next)}
        <footer>${button('upgrade', label, { data: `data-slot="${slot}"`, disabled: !up.ok, primary: up.ok })}${slot === run.held ? '<span class="tagline">In hand</span>' : button('hold', 'Hold first', { data: `data-slot="${slot}"`, quiet: true })}</footer>
      </article>`;
  });
  for (let i = run.weapons.length; i < MAX_WEAPONS; i++) weapons.push('<article class="card gun empty"><header><i class="gunicon"></i><h3>Empty</h3><p>Weapon cards fill this</p></header></article>');
  const slots = (list, max, def, action) => {
    const out = list.map((id, i) => `
      <article class="card perk">
        <header><h3>${def[id].name}</h3><p>${def[id].text}</p></header>
        <footer><span class="tagline">${action === 'dropability' ? ['Q', 'E', 'F'][i] : ['Z', 'X', 'C'][i]}</span>${button(action, 'Drop', { data: `data-slot="${i}"`, quiet: true })}</footer>
      </article>`);
    for (let i = list.length; i < max; i++) out.push('<article class="card perk empty"><header><h3>Empty</h3><p>Cards fill this</p></header></article>');
    return out.join('');
  };
  const top = maxHealth(run, meta);
  return `
    ${head(`Before round ${run.wave}`, 'Catch your breath')}
    <div class="bar">
      ${stat('Coins', cash(run.coins), 'gold')}
      ${stat('Health', `${n(run.hp)}/${n(top)}`, run.hp / top < 0.35 ? 'low' : '')}
      ${stat('Next', `Round ${run.wave}${boss ? '<em>Boss</em>' : ''}`, 'wide')}
      ${stat('Tokens', n(meta.tokens))}
    </div>
    <nav class="stack top">
      ${button('fight', `Start round ${run.wave}`, { primary: true })}
      ${button('patch', run.hp >= top ? 'Patch up (at full health)' : `Patch up +${PATCH_HP} health ${cash(patchCost(run))}`, { disabled: !canPatch(run, meta).ok })}
      ${button('slots', 'Slot machine')}
      ${button('armory', 'Armory')}
      ${button('wardrobe', 'Wardrobe')}
    </nav>
    <section><h3>Weapons</h3><div class="cards small">${weapons.join('')}</div></section>
    <section><h3>Abilities</h3><div class="cards small">${slots(run.abilities, MAX_ABILITIES, ABILITIES, 'dropability')}</div></section>
    <section><h3>Powers</h3><div class="cards small">${slots(run.powers, MAX_POWERS, POWERS, 'droppower')}</div></section>
    <nav class="row">
      ${button('fight', `Start round ${run.wave}`, { primary: true })}
      ${button('home', 'Save and quit', { quiet: true })}
    </nav>`;
}

// ----- the slot machine -----
export function slotmachine({ save, spin, spinning }) {
  const run = save.run;
  const meta = save.meta;
  const reels = spin?.shown ?? ['7', '7', '7'];
  const odds = PRIZES.map((p) => `${p.kind === 'power' ? 'Powers' : p.kind === 'coins' ? 'Coins' : p.kind === 'rune' ? 'Runes' : p.kind === 'hat' ? 'Hats' : p.kind === 'skin' ? 'Skins' : 'Jackpot'} ${p.weight}%`).join(' &middot; ');
  return `
    ${head('Between rounds', 'Slot machine')}
    <div class="bar">
      ${stat('Tokens', n(meta.tokens), 'gold')}
      ${stat('Coins', cash(run?.coins ?? 0))}
      ${stat('Token price', cash(TOKEN_PRICE), 'wide')}
      ${stat('Powers', `${run?.powers.length ?? 0}/${MAX_POWERS}`)}
    </div>
    <div class="machine ${spinning ? 'spinning' : ''} ${spin?.done && spin.kind !== 'power' && spin.kind !== 'coins' ? 'win' : ''}">
      <div class="reels">${reels.map((s) => `<div class="reel"><b class="sym-${s}">${s}</b></div>`).join('')}</div>
      <p class="payout" role="status">${spin?.done ? spin.text : spinning ? '...' : 'One token a spin.'}</p>
    </div>
    <nav class="stack">
      ${button('spin', 'Spin (1 token)', { primary: true, disabled: spinning || meta.tokens < 1 })}
      ${button('token', `Buy a token ${cash(TOKEN_PRICE)}`, { disabled: spinning || !run || run.coins < TOKEN_PRICE })}
      ${button('token5', `Buy 5 tokens ${cash(TOKEN_PRICE * 5)}`, { disabled: spinning || !run || run.coins < TOKEN_PRICE * 5 })}
      ${button('back', 'Back', { quiet: true, disabled: spinning })}
    </nav>
    <p class="hint centre">${odds}. Hats, skins, and runes are yours for good; powers go in your three power slots.</p>`;
}

// ----- the armory: permanent ranks, bought with each weapon's own XP, and runes -----
export function armory({ save, icons, picked }) {
  const meta = save.meta;
  const owned = new Set(save.run?.weapons.map((w) => w.id) ?? []);
  const seen = WEAPON_ORDER.filter((id) => owned.has(id) || (meta.xp[id] ?? 0) > 0 || meta.ranks[id] || meta.infused[id]);
  const list = seen.length ? seen : ['pistol', 'knife'];
  const id = picked && WEAPONS[picked] ? picked : list[0];
  const ranks = masteryKeys(id).map((key) => {
    const rank = rankOf(meta, id, key);
    const can = canBuyRank(meta, id, key);
    return `<li><span class="rank">${MASTERY[key].name} ${pips(rank)}</span><small>+${Math.round(MASTERY[key].per * 100)}% each</small>${button('rank', rank >= MASTERY_MAX ? 'Maxed' : `${n(masteryCost(rank))} XP`, { data: `data-gun="${id}" data-key="${key}"`, disabled: !can.ok, primary: can.ok })}</li>`;
  }).join('');
  // The weapon's sockets: what's in each, and the second one's price until it's open.
  const open = socketsOf(meta, id);
  const sockets = [0, 1].map((s) => {
    if (s >= open) {
      const can = canOpenSocket(meta, id);
      return `<li><span class="rank">Socket ${s + 1}</span><small>Locked. Opens for ${SOCKET_COST} tier I runes of any kind (you have ${n(spareRunes(meta))}). Two different runes work together.</small>${button('socket', `Open ${SOCKET_COST} runes`, { data: `data-gun="${id}"`, disabled: !can.ok, primary: can.ok })}</li>`;
    }
    const r = socketRune(meta, id, s);
    return `<li><span class="rank">Socket ${s + 1} ${r ? runeName(r) : ''}</span><small>${r ? RUNES[r.id].tiers[r.tier].text : 'Empty. Infuse a rune from the bag below.'}</small>${r ? button('takeout', 'Take out', { data: `data-gun="${id}" data-socket="${s}"`, quiet: true }) : '<span class="tagline">Empty</span>'}</li>`;
  }).join('');
  // The bag: counts by tier, merging, and infusing the best tier into a socket.
  const runes = Object.entries(RUNES).map(([rid, r]) => {
    const best = bestTier(meta, rid);
    const counts = TIER_NAMES.map((t, i) => `${t}&times;${runeCount(meta, rid, i)}`).join(' &middot; ');
    const merges = Array.from({ length: RUNE_TIERS - 1 }, (_, t) => (runeCount(meta, rid, t) >= MERGE_COUNT
      ? button('merge', `Merge ${MERGE_COUNT} ${TIER_NAMES[t]} &rarr; ${TIER_NAMES[t + 1]}`, { data: `data-rune="${rid}" data-tier="${t}"`, disabled: !canMerge(meta, rid, t).ok }) : '')).join('');
    const infuses = best < 0 ? '' : Array.from({ length: open }, (_, s) => {
      const here = socketRune(meta, id, s);
      const elsewhere = socketRune(meta, id, 1 - s)?.id === rid;
      const done = here?.id === rid && here.tier >= best;
      return button('infuse', `${TIER_NAMES[best]} &rarr; socket ${s + 1}`, { data: `data-gun="${id}" data-rune="${rid}" data-socket="${s}"`, disabled: done || elsewhere, primary: !here && !elsewhere });
    }).join('');
    return `<li><span><b style="color:${hex(r.color)}">${r.name}</b> <span class="count tiers">${counts}</span></span><small>${r.tiers[Math.max(0, best)].text}${best < RUNE_TIERS - 1 ? ` Next tier: ${r.tiers[Math.max(0, best) + 1].text}` : ''}</small><span class="btns">${merges}${infuses || '<span class="tagline">None in the bag</span>'}</span></li>`;
  }).join('');
  return `
    ${head('Lasts between runs', 'Armory', 'Each weapon earns its own XP from the damage it does and the creatures it finishes. Ranks last for good.')}
    <div class="armorygrid">
      <nav class="picker">${list.map((w) => `<button type="button" data-action="pickgun" data-gun="${w}" class="${w === id ? 'primary' : ''}">${icon(icons, w)}<span>${WEAPONS[w].name}</span><small>${n(meta.xp[w] ?? 0)} XP</small></button>`).join('')}</nav>
      <div class="detail">
        <header class="gunhead">${icon(icons, id)}<div><h3>${WEAPONS[id].name}</h3><p class="sub">${classLabel(id)} &middot; <b>${n(meta.xp[id] ?? 0)} XP</b> to spend</p></div></header>
        <ul class="ranks">${ranks}</ul>
        <h3 class="tier">Sockets <span>Infused for good. A rune taken out goes back in the bag.</span></h3>
        <ul class="ranks">${sockets}</ul>
        <h3 class="tier">Rune bag <span>${MERGE_COUNT} of a tier merge into one of the next. Infusing uses the best tier you have.</span></h3>
        <ul class="ranks">${runes}</ul>
      </div>
    </div>
    <nav class="row">${button('back', 'Back', { primary: true })}</nav>`;
}

// ----- the wardrobe: one hat, one skin -----
export function wardrobe({ save }) {
  const meta = save.meta;
  const hats = Object.entries(HATS).map(([id, h]) => {
    const mine = meta.hats.includes(id);
    const on = meta.hat === id;
    return `<article class="card perk ${mine ? '' : 'locked'}"><header><h3>${mine ? h.name : '???'}</h3><p>${mine ? h.text : 'Won on the slot machine'}</p></header>
      <footer><span></span>${on ? button('hat', 'Take off', { data: 'data-hat=""', quiet: true }) : button('hat', 'Wear', { data: `data-hat="${id}"`, disabled: !mine, primary: mine })}</footer></article>`;
  }).join('');
  const skins = Object.entries(SKINS).map(([id, s]) => {
    const mine = meta.skins.includes(id);
    const on = meta.skin === id;
    return `<article class="card perk ${mine ? '' : 'locked'}"><header><i class="skinswatch" style="background:${!mine ? 'linear-gradient(#5860a8, #141a52)' : s.png ? `url(${s.png}) -50px -6px / 147px 147px` : `linear-gradient(${s.top}, ${s.low})`}"></i><h3>${mine ? s.name : '???'}</h3></header>
      <footer><span></span>${on ? '<span class="tagline">Wearing</span>' : button('skin', 'Wear', { data: `data-skin="${id}"`, disabled: !mine, primary: mine })}</footer></article>`;
  }).join('');
  return `
    ${head('Lasts between runs', 'Wardrobe', 'With his build, a hat is the only gear that fits. One at a time.')}
    <section><h3>Hats</h3><div class="cards small">${hats}</div></section>
    <section><h3>Skins</h3><div class="cards small">${skins}</div></section>
    <nav class="row">${button('back', 'Back', { primary: true })}</nav>`;
}

export function over({ result }) {
  return `
    ${head('Run over', `Down in round ${result.wave}`)}
    <div class="stats big">
      ${stat('Rounds cleared', `${n(result.wave - 1)}${result.record ? '<em>Best yet</em>' : ''}`, 'lead')}
      ${stat('Creatures beaten', n(result.kills))}
      ${stat('Coins earned', cash(result.earned))}
      ${stat('Weapon XP', n(result.xp))}
      ${stat('Cards taken', n(result.cards))}
    </div>
    <p class="hint centre">Weapons, abilities, and powers from this run are gone. XP, tokens, runes, hats, and skins are kept.</p>
    <nav class="stack">
      ${button('newrun', 'Go again', { primary: true })}
      ${button('armory', 'Armory')}
      ${button('home', 'Title')}
    </nav>`;
}

export function pause({ save }) {
  return `
    ${head('Paused', `Round ${save.run?.wave ?? ''}`)}
    <nav class="stack">
      ${button('resume', 'Resume', { primary: true })}
      ${button('settings', 'Settings')}
      ${button('giveup', 'Give up this run', { quiet: true })}
    </nav>
    ${keyList}`;
}

export function settings({ save }) {
  const s = save.settings;
  const check = (key, label, text) => `
    <label class="check"><input type="checkbox" data-setting="${key}" ${s[key] ? 'checked' : ''}><span><b>${label}</b>${text}</span></label>`;
  return `
    ${head('Settings', 'Settings')}
    ${check('shake', 'Screen shake', 'The camera jolts on big hits and explosions.')}
    ${check('numbers', 'Damage numbers', 'Numbers pop up over creatures as you hit them.')}
    <label class="slider"><span><b>Volume</b></span><input type="range" min="0" max="1" step="0.05" value="${s.volume}" data-setting="volume"></label>
    <nav class="row">${button('back', 'Back', { primary: true })}</nav>`;
}

// ----- in the fight -----
// The status bar along the top.
export function hud({ sim, run, meta }) {
  const g = sim.guy;
  const share = Math.max(0, g.hp / g.maxHp);
  const boss = sim.enemies.find((e) => e.kind === 'bigone');
  const dash = g.dashCd <= 0 ? 'Ready' : `${g.dashCd.toFixed(1)}s`;
  return `
    <div class="cell hp ${share < 0.35 ? 'hurt' : ''}"><span>Health${g.plate > 0 ? ` + ${Math.ceil(g.plate)} plate` : ''}</span><div class="meter"><i style="width:${share * 100}%"></i></div><b>${Math.ceil(g.hp)}</b></div>
    <div class="cell"><span>Round</span><b>${sim.wave}</b></div>
    <div class="cell"><span>Coins</span><b>${cash(run.coins + sim.cash)}</b></div>
    <div class="cell"><span>Tokens</span><b>${meta.tokens + sim.tokens}</b></div>
    <div class="cell"><span>Left</span><b>${sim.enemiesLeft()}</b></div>
    <div class="cell ${g.dashCd <= 0 ? 'ready' : ''}"><span>Dash</span><b>${dash}</b></div>
    ${boss ? `<div class="cell boss"><span>Big One${boss.phase > 1 ? (boss.phase === 3 ? ' &middot; enraged' : ' &middot; angry') : ''}</span><div class="meter"><i style="width:${(boss.hp / boss.maxHp) * 100}%"></i></div></div>` : ''}`;
}

// The weapons, bottom left: the one in hand is marked.
export function weaponList({ sim, device }) {
  return sim.weapons.map((w, i) => {
    const s = w.stats;
    const holding = i === sim.held;
    const key = device === 'pad' ? '' : `<kbd>${i + 1}</kbd>`;
    if (s.class === 'melee') return `<div class="gunrow ${holding ? 'held' : ''}">${key}<span>${WEAPONS[w.id].name}</span><div class="meter melee"><i style="width:100%"></i></div><b>MELEE</b></div>`;
    const reloading = w.reloadT > 0;
    const fill = reloading ? 1 - w.reloadT / s.reload : w.ammo / s.mag;
    return `<div class="gunrow ${holding ? 'held' : ''} ${reloading ? 'reloading' : ''}">${key}<span>${WEAPONS[w.id].name}</span><div class="meter"><i style="width:${fill * 100}%"></i></div><b>${sim.buffs.bottomless > 0 ? '&infin;' : reloading ? 'RELOAD' : w.ammo}</b></div>`;
  }).join('');
}

// Abilities and powers, bottom right, with their keys and cooldowns.
export function cardBar({ sim, device }) {
  const pad = device === 'pad';
  const aKeys = pad ? ['A', 'B', 'Y'] : ['Q', 'E', 'F'];
  const pKeys = pad ? ['&larr;', '&uarr;', '&rarr;'] : ['Z', 'X', 'C'];
  const abilities = [0, 1, 2].map((i) => {
    const a = sim.abilities[i];
    if (!a) return `<div class="slotbox empty"><kbd>${aKeys[i]}</kbd><span>-</span></div>`;
    const cd = ABILITIES[a.id].cooldown;
    const ready = a.cd <= 0;
    return `<div class="slotbox ${ready ? 'ready' : ''}"><kbd>${aKeys[i]}</kbd><span>${ABILITIES[a.id].name}</span><div class="meter"><i style="width:${ready ? 100 : (1 - a.cd / cd) * 100}%"></i></div></div>`;
  }).join('');
  const powers = [0, 1, 2].map((i) => {
    const p = sim.powers[i];
    if (!p) return `<div class="slotbox empty power"><kbd>${pKeys[i]}</kbd><span>-</span></div>`;
    return `<div class="slotbox ready power"><kbd>${pKeys[i]}</kbd><span>${POWERS[p].name}</span></div>`;
  }).join('');
  return `<div class="slotrow">${abilities}</div><div class="slotrow">${powers}</div>`;
}

