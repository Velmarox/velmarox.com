// Clack Arena: the run. Title, map, fights, Forge, Tavern, Rest and the end screens. The tray (tray.js) throws
// the dice; the rules (rules.js) say what they did; the kit (ui.js) draws the panels; this file runs the turns.
//
// Readability rules this file follows: every turn says whose move it is; every number that changes is shown
// changing, where it happens, in the order the rules apply it; every face can be tapped to read; nothing new
// is explained with a wall of text when a one-time tip at the right moment will do.
(() => {
  const A = window.ARENA, U = () => A.ui, esc = (s) => A.esc(s), px = (...a) => A.px(...a);
  const $ = (s, el = document) => el.querySelector(s);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pace = () => (A.timeScale ?? 1) * (A.settings.fast ? 0.6 : 1);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms * pace() * (skipping ? 0.15 : 1)));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const sfx = (name, ...a) => A.sfx?.[name]?.(...a);

  let run = null, fight = null;
  let phase = 'title';          // title | map | aim | sim | play | landed | resolve | screen
  let aiming = null, skipping = false;
  const el = {};

  // ---------- settings ----------
  function loadSettings() {
    let s = {};
    try { s = JSON.parse(localStorage.getItem('clackArena.settings') || '{}'); } catch { /* storage off */ }
    A.settings = { ...A.SETTINGS_DEFAULT, ...s };
    if (s.reduceMotion == null && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) A.settings.reduceMotion = true;
    A.playSpeed = A.settings.fast ? 1.6 : 1;
  }
  function saveSettings() {
    try { localStorage.setItem('clackArena.settings', JSON.stringify(A.settings)); } catch { /* storage off */ }
    A.playSpeed = A.settings.fast ? 1.6 : 1;
  }

  // ---------- run ----------
  function newRun() {
    fight = null; A.tray.clearDice(); A.tray.setZones(false); clearLabels(); el.log.innerHTML = ''; el.after.className = 'after'; hint(''); U().phases(null);
    run = {
      hp: A.PLAYER_START.hp, max: A.PLAYER_START.hp, die: clone(A.PLAYER_START.die),
      relics: [], items: ['nudge', 'chalk'], chips: 0, step: 0, map: makeMap(), path: [],
      stats: { fights: 0, turns: 0, clacks: 0, dealt: 0, taken: 0 },
    };
    drawCards();
    showMap();
  }

  function makeMap() {
    const steps = [[{ type: 'fight', enemy: 'pips' }]];
    const stage = (i) => (i <= 2 ? 0 : i <= 5 ? 1 : 2);
    for (let i = 1; i <= 7; i++) {
      const types = ['fight', 'fight', 'forge', 'tavern', 'rest'];
      if (i >= 3) types.push('elite', 'elite');
      const opts = shuffle(types).filter((t, k, a) => a.indexOf(t) === k).slice(0, i % 3 === 0 ? 3 : 2);
      const must = { 2: 'forge', 4: 'tavern', 7: 'rest' }[i];
      if (must && !opts.includes(must)) opts[opts.length - 1] = must;
      if (i === 1 && !opts.includes('fight')) opts[0] = 'fight';
      steps.push(opts.map((type) => ({ type, enemy: type === 'fight' ? pick(A.FIGHT_POOL[stage(i)]) : type === 'elite' ? pick(A.ELITE_POOL) : undefined })));
    }
    steps.push([{ type: 'boss', enemy: A.BOSS }]);
    return steps;
  }

  // ---------- screens ----------
  function screen(html, cls = '') {
    U().closePop(); U().clearCoach();
    el.overlay.onPick = null; el.overlay.onHover = null;
    el.overlay.className = 'overlay show ' + cls;
    el.overlay.innerHTML = '<div class="sheet">' + html + '</div>';
    el.overlay.scrollTop = 0;
  }
  function closeScreen() { el.overlay.className = 'overlay'; el.overlay.innerHTML = ''; }
  const btn = (label, act, cls = '', extra = '') => `<button type="button" class="pbtn ${cls}" data-act="${act}" ${extra}>${label}</button>`;

  // What a screen is for, at the top of it, the first time it comes up. It stays through re-draws (buying at the
  // Tavern) until Got it or until you move on, then never again on this device. Show tips again brings it back.
  const SCREEN_TIPS = {
    map: ['The map', 'Your route across the Green Felt. At each stop you pick one card below, and the strip at the top shows where you have been and what is ahead. Fights pay chips, Elites give a relic, the Forge changes your faces, the Tavern sells things, Rest repairs pips. The House waits at the last stop.'],
    forge: ['The Forge', 'One job per visit. Engrave: pick a new face, then the face it covers (the bars show your odds before and after). Sand off a Skull to make it blank. Or grow to a d6: more faces, but each one comes up less often.'],
    tavern: ['The Tavern', 'Spend chips here. Items go in your bag (3 slots) and are used once, during a fight. Relics work for the rest of the run. Mend repairs pips and you can buy it more than once. A grey button says why you can\'t buy.'],
    rest: ['Rest', 'Resting repairs up to 4 in 10 of your pips, never past your max. That\'s all it does: move on when you\'re ready.'],
    reward: ['After a fight', 'Every win pays chips for the Tavern. Fights sometimes drop an item into your bag. Elites let you take one relic. Your die panel shows what you have.'],
  };
  const tipsUp = new Set();
  function screenTip(id) {
    if (!A.settings.tips || U().seen('screen-' + id)) return '';
    tipsUp.add(id);
    const [title, text] = SCREEN_TIPS[id];
    return `<div class="screen-tip" data-tip="${id}">${px('pointer', 2, 'screen-tip-ico')}<div><b>${esc(title)}</b><p>${esc(text)}</p></div><button type="button" class="pbtn small" data-act="tip-ok" data-tip="${id}">Got it</button></div>`;
  }
  function tipDone(id) { tipsUp.delete(id); U().markSeen('screen-' + id); }

  const itemInfo = (id) => A.CONSUMABLES[id];
  function playerCard(o = {}) {
    const st = fight?.st.p;
    const tags = [U().tag('d' + run.die.sides, 'dim')];
    if (st?.charged) tags.push(U().tag('Charged ×2', 'hot', 'Your next face with a number is doubled'));
    if (fight?.lead) tags.push(U().tag('Lead Shot', 'hot', "This throw can't settle on Skull or Smooth"));
    if (o.guard) tags.push(U().tag('Guard ' + o.guard, 'blue'));
    const items = run.items.map((id, k) => {
      const it = itemInfo(id), usable = fight && it.when === 'before' && phase === 'aim' && !(id === 'lead' && fight.lead);
      return `<button type="button" class="item-btn${usable ? ' ready' : ''}" data-item="${k}" data-name="${esc(it.name)}" data-text="${esc(it.text)}" data-odds="${it.when === 'before' ? 'Use it before you throw.' : 'Use it after your die lands.'}">${px(A.ITEM_ICON[id], 2)}<span><b>${esc(it.name)}</b><small>${it.when === 'before' ? 'before a throw' : 'after landing'}</small></span></button>`;
    }).join('') + Array.from({ length: A.MAX_CONSUMABLES - run.items.length }, () => '<span class="item-slot"></span>').join('');
    const relics = run.relics.map((r) => `<button type="button" class="relic" data-inspect="1" data-name="${esc(A.RELICS[r].name)}" data-text="${esc(A.RELICS[r].text)}" data-odds="Relic: lasts the whole run.">${px(A.RELIC_ICON, 2)}${esc(A.RELICS[r].name)}</button>`).join('');
    return U().card({
      side: 'p', name: A.PLAYER_START.name, badge: '', tags,
      hp: fight ? fight.shown.p : run.hp, max: fight ? fight.st.p.max : run.max, prev: o.prev,
      dice: [{ die: run.die, chalk: st?.chalk }],
      foot: `<div class="ffoot"><div class="items">${items}</div><div class="relics">${relics}</div><span class="chips">${px('btn-yellow', 2)}<b>${run.chips}</b> chips</span></div>`,
    });
  }
  function enemyCard(o = {}) {
    const def = fight.def, st = fight.st.e;
    const tags = [];
    if (def.boss) tags.push(U().tag('Boss', ''));
    else if (def.elite) tags.push(U().tag('Elite', ''));
    if (def.previews > 1) tags.push(`<button type="button" class="tag dim" data-inspect="1" data-name="Previews ×${def.previews}" data-text="${esc(`Tries ${def.previews} throws in secret against yours and keeps the one that's best for it. The faint red paths are the ones it threw away.`)}">Previews ×${def.previews}</button>`);
    if (st.charged) tags.push(U().tag('Charged ×2', 'hot', 'Its next face with a number is doubled'));
    if (o.guard) tags.push(U().tag('Guard ' + o.guard, 'blue'));
    if (def.clack) tags.push(U().tag(`Clack ${def.clack.deal >= 0 ? '+' : ''}${def.clack.deal} / takes ${def.clack.take >= 0 ? '+' : ''}${def.clack.take}`, 'dim', 'Changes Clack damage it deals and takes'));
    const badge = def.boss ? px('crest-red', 2, 'badge') : def.elite ? px('shield-red', 2, 'badge') : '';
    return U().card({ side: 'e', name: def.name, badge, tags, hp: fight.shown.e, max: st.max, prev: o.prev, dice: def.dice.map((d) => ({ die: d, name: d.name })), threat: true });
  }
  function drawCards(o = {}) {
    if (!fight) { el.enemy.innerHTML = ''; el.player.innerHTML = ''; return; }
    el.enemy.innerHTML = enemyCard(o.e || {});
    el.player.innerHTML = playerCard(o.p || {});
  }

  // ---------- title, rules, settings ----------
  function showTitle() {
    phase = 'title';
    screen(`
      <div class="title-art">${px('wings-silver', 3, 'wings')}<h1 class="pxfont">Clack <em>Arena</em></h1><span class="hz"></span></div>
      <p class="lead">You are a die. Everyone else is too.</p>
      <p>Throw into a shared tray. Crash into the enemy. Whatever face you land on is what you do. Between fights, engrave new faces onto yourself.</p>
      <div class="row center">${btn('Start a run', 'start', 'big primary')}${btn('How to play', 'rules')}${btn('Settings', 'settings')}</div>
      <p class="small center">Early build · the Green Felt · d4 and d6 · six enemies</p>`, 'title');
  }

  // The first time you press Start a run, a short how-to comes before the map. Once per device, like the tips.
  function showHowTo() {
    phase = 'title';
    const aim = A.settings.aim === 'point'
      ? 'Drag from your die the way you want it to go, then let go.'
      : 'Press your die, pull back like a slingshot, let go. Longer pull, harder throw.';
    const steps = [
      ['Throw', aim],
      ['Land', 'The face on top is your move this turn: hit, guard, heal and more. Tap any face to read it.'],
      ['Clack', "Smash into the enemy's die while it tumbles and it takes damage straight away."],
      ['Between fights', 'Pick your next stop on the map. Fights pay chips, the Forge engraves new faces onto you, the Tavern sells items, Rest repairs pips.'],
      ['Win', 'Beat The House at the end of the Green Felt. Run out of pips and the run is over.'],
    ];
    screen(`
      <h2 class="pxfont">How to play</h2>
      <ol class="howto">${steps.map(([k, v]) => `<li><b>${esc(k)}</b><span>${esc(v)}</span></li>`).join('')}</ol>
      <div class="row center">${btn("Let's go", 'howto-go', 'big primary')}${btn('Full rules', 'rules')}</div>`, 'rules');
  }

  function showRules() {
    const faces = Object.entries(A.FACE_TYPES).map(([t, T]) => {
      const f = A.F(t, T.valued ? 3 : 0);
      return `<div class="rule-face"><img alt="" src="${A.faceChip(f, { color: '#2a2a33', ink: '#ffffff' })}"><div><b style="color:${T.color}">${esc(T.name)}</b><small>${esc(T.text(3).replace('3', 'X'))}</small></div></div>`;
    }).join('');
    screen(`
      <h2 class="pxfont">How to play</h2>
      <dl class="gloss">${A.GLOSSARY.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      <h3>Faces</h3><div class="rule-faces">${faces}</div>
      <div class="row">${btn('Back', 'back', 'primary')}</div>`, 'rules');
  }

  function showSettings() {
    const s = A.settings;
    const opt = (key, val, label) => `<button type="button" class="seg${s[key] === val ? ' on' : ''}" data-set="${key}" data-val="${JSON.stringify(val).replace(/"/g, '&quot;')}">${label}</button>`;
    screen(`
      <h2 class="pxfont">Settings</h2>
      <div class="setting"><div><b>Aim</b><small>Slingshot: press your die, pull back, let go to fling it the other way. Point: drag the way you want to throw.</small></div><div class="segs">${opt('aim', 'sling', 'Slingshot')}${opt('aim', 'point', 'Point')}</div></div>
      <div class="setting"><div><b>Aim arrow</b><small>The arrow showing where your throw will go.</small></div><div class="segs">${opt('arrow', true, 'On')}${opt('arrow', false, 'Off')}</div></div>
      <div class="setting"><div><b>Sound</b></div><div class="segs">${opt('sound', true, 'On')}${opt('sound', false, 'Off')}</div></div>
      <div class="setting"><div><b>Dice speed</b><small>Fast plays throws and results quicker.</small></div><div class="segs">${opt('fast', false, 'Normal')}${opt('fast', true, 'Fast')}</div></div>
      <div class="setting"><div><b>Reduce motion</b><small>No screen shake or slow-motion on hits.</small></div><div class="segs">${opt('reduceMotion', false, 'Off')}${opt('reduceMotion', true, 'On')}</div></div>
      <div class="setting"><div><b>Tips</b><small>One-time tips the first time something comes up.</small></div><div class="segs">${opt('tips', true, 'On')}${opt('tips', false, 'Off')}</div></div>
      <div class="row">${btn('Back', 'back', 'primary')}${btn('Show tips again', 'reset-tips')}</div>`, 'settings');
  }
  // Rules and Settings open on top of whatever you were doing; Back returns to it.
  let behind = null;
  function openSide(which) {
    if (!behind) behind = { html: el.overlay.innerHTML, cls: el.overlay.className, onPick: el.overlay.onPick, onHover: el.overlay.onHover, stamps: el.overlay.dataset.stamps };
    if (phase === 'aim' && aiming) cancelAim();
    which === 'rules' ? showRules() : showSettings();
  }
  function back() {
    const b = behind; behind = null;
    if (!b) return showTitle();
    if (b.html) { el.overlay.className = b.cls; el.overlay.innerHTML = b.html; el.overlay.onPick = b.onPick; el.overlay.onHover = b.onHover; if (b.stamps) el.overlay.dataset.stamps = b.stamps; }
    else closeScreen();
    if (fight) { drawCards(); if (phase === 'aim') toAim(true); }
  }

  // ---------- map ----------
  function showMap() {
    phase = 'map';
    const i = run.step, opts = run.map[i];
    const route = run.map.map((s, k) => `<div class="stop ${k < i ? 'done' : k === i ? 'now' : 'later'}">${s.map((n, j) => `<span class="mini-node${k < i && run.path[k] === j ? ' taken' : ''}" title="${esc(A.NODES[n.type].name)}">${px(A.NODES[n.type].icon, 2)}</span>`).join('')}<small>${k === run.map.length - 1 ? 'Boss' : k + 1}</small></div>`).join('<i class="link"></i>');
    screen(`
      <div class="map-head"><h2 class="pxfont">Green Felt</h2><span class="dim">Stop ${i + 1} of ${run.map.length}</span></div>
      ${screenTip('map')}
      <div class="route">${route}</div>
      <h3>Pick your next stop</h3>
      <div class="nodes">${opts.map((n, k) => nodeCard(n, k)).join('')}</div>
      <h3>Your die</h3>${playerCard()}`, 'map');
  }
  function nodeCard(n, k) {
    const N = A.NODES[n.type];
    let body = `<small>${esc(N.text)}</small>`;
    if (n.enemy) {
      const e = A.ENEMIES[n.enemy];
      const dice = e.dice.map((d) => `<span class="dshape">d${d.sides}</span>`).join('');
      const hit = e.dice.reduce((s, d) => s + U().avgHit(d), 0);
      body = `<span class="who">${esc(e.name)}</span>
        <span class="facts">${dice}<span>${px('heart', 2, 'ico')}${e.hp}</span><span title="Average damage its faces deal">hits ~${hit.toFixed(1)}</span>${e.previews > 1 ? `<span class="warn">previews ×${e.previews}</span>` : ''}</span>
        <small>${n.type === 'elite' ? 'Win a relic.' : n.type === 'boss' ? 'Beat it to clear the Green Felt.' : `Win ${e.chips}-${e.chips + 3} chips.`}</small>`;
    } else if (n.type === 'rest') body = `<small>Repair ${Math.min(run.max - run.hp, Math.ceil(run.max * A.REST_SHARE))} pips (you're at ${run.hp}/${run.max}).</small>`;
    else if (n.type === 'tavern') body = `<small>${esc(N.text)} You have ${run.chips} chips.</small>`;
    return `<button type="button" class="node ${n.type}" data-node="${k}">${px(N.icon, 2, 'node-ico')}<span class="node-text"><b>${esc(N.name)}</b>${body}</span></button>`;
  }

  function enterNode(k) {
    sfx('click');
    tipsUp.forEach(tipDone);
    run.path[run.step] = k;
    const n = run.map[run.step][k];
    if (n.type === 'fight' || n.type === 'elite' || n.type === 'boss') startFight(n.enemy, n.type);
    else if (n.type === 'forge') showForge();
    else if (n.type === 'tavern') showTavern();
    else if (n.type === 'rest') showRest();
  }
  function nextStep() { tipsUp.forEach(tipDone); run.step++; showMap(); }

  // ---------- Forge ----------
  function showForge() {
    phase = 'screen';
    const stamps = run.forgeStamps || (run.forgeStamps = shuffle(A.STAMPS).slice(0, 3));
    const hasSkull = run.die.faces.some((f) => f.t === 'skull');
    screen(`
      <h2 class="pxfont">Forge</h2>
      ${screenTip('forge')}
      <p>One job per visit. Engrave a new face over an old one, sand off a Skull, or grow your die.</p>
      ${forgeDie()}
      <h3>Engrave</h3>
      <div class="stamps">${stamps.map((f, k) => `<button type="button" class="stamp" data-stamp="${k}"><img alt="" src="${A.faceChip(f, run.die.look)}"><span><b>${esc(A.faceLabel(f))}</b><small>${esc(A.faceText(f))}</small></span></button>`).join('')}</div>
      <h3>Or</h3>
      <div class="stamps">
        ${hasSkull ? `<button type="button" class="stamp" data-act="sand">${px('down-orange', 3)}<span><b>Sand off a Skull</b><small>It becomes Smooth (blank): ready to engrave next time.</small></span></button>` : ''}
        ${run.die.sides === 4 ? `<button type="button" class="stamp" data-act="grow">${px('up-green', 3)}<span><b>Grow to a d6</b><small>Two new Smooth faces. Each face: 25% → 17%.</small></span></button>` : ''}
      </div>
      <div class="row">${btn('Leave', 'leave')}</div>`, 'forge');
    el.overlay.dataset.stamps = JSON.stringify(stamps);
  }
  const forgeDie = (die = run.die) => `<div class="forge-die"><div class="fdie" style="--faces:${die.faces.length}">${U().oddsBar(die)}${U().net(die)}</div></div>`;

  // Pick which face a stamp goes on. Hovering a face previews the odds after.
  function engrave(f) {
    screen(`
      <h2 class="pxfont">Engrave ${esc(A.faceLabel(f))}</h2>
      <p>Pick the face it replaces.</p>
      <div class="compare"><div style="--faces:${run.die.faces.length}"><small>Now</small>${U().oddsBar(run.die)}</div><div style="--faces:${run.die.faces.length}"><small>After</small><div id="after-odds">${U().oddsBar(run.die)}</div></div></div>
      ${U().net(run.die, { pickable: true })}
      <div class="row">${btn('Back', 'back-forge')}</div>`, 'forge');
    el.overlay.onHover = (i) => { const d = clone(run.die); d.faces[i] = f; $('#after-odds').innerHTML = U().oddsBar(d); };
    el.overlay.onPick = (i) => { run.die.faces[i] = f; sfx('forge'); forgeDone(`Engraved <b>${esc(A.faceLabel(f))}</b>.`); };
  }
  function grow() {
    const d = clone(run.die); d.sides = 6; d.faces.push(A.F('smooth'), A.F('smooth'));
    screen(`
      <h2 class="pxfont">Grow to a d6?</h2>
      <p>You keep your four faces and gain two Smooth (blank) ones. Room for a bigger build. But every face comes up less often, so your best face lands 1 time in 6 instead of 1 in 4.</p>
      <div class="compare"><div style="--faces:4"><small>d4 now</small>${U().oddsBar(run.die)}${U().net(run.die)}</div><div style="--faces:6"><small>d6 after</small>${U().oddsBar(d)}${U().net(d)}</div></div>
      <div class="row">${btn('Grow', 'grow-yes', 'primary')}${btn('Back', 'back-forge')}</div>`, 'forge');
  }
  function forgeDone(msg) {
    run.forgeStamps = null;
    screen(`<h2 class="pxfont">Done.</h2><p>${msg}</p>${forgeDie()}<div class="row">${btn('Move on', 'leave', 'big primary')}</div>`, 'forge');
  }

  // ---------- Tavern ----------
  function showTavern() {
    phase = 'screen';
    if (!run.tavern || run.tavern.step !== run.step) {
      const goods = [];
      shuffle(Object.keys(A.CONSUMABLES)).slice(0, 2).forEach((id) => goods.push({ kind: 'item', id, price: A.PRICES.consumable }));
      const relic = shuffle(Object.keys(A.RELICS).filter((r) => !run.relics.includes(r)))[0];
      if (relic) goods.push({ kind: 'relic', id: relic, price: A.PRICES.relic });
      goods.push({ kind: 'mend', price: A.PRICES.mend });
      run.tavern = { step: run.step, goods };
    }
    const g = run.tavern.goods;
    screen(`
      <h2 class="pxfont">Tavern</h2>
      ${screenTip('tavern')}
      <p class="npc">“${run.chips >= 18 ? 'Big spender. Sit down.' : run.chips >= 7 ? "You've got enough for something." : 'Not much on you. Look anyway.'}”</p>
      <div class="purse">${px('btn-yellow', 2)}<b>${run.chips}</b> chips</div>
      <div class="goods">${g.map((x, k) => {
        const name = x.kind === 'item' ? itemInfo(x.id).name : x.kind === 'relic' ? A.RELICS[x.id].name : `Mend ${A.MEND_AMOUNT} pips`;
        const text = x.kind === 'item' ? itemInfo(x.id).text : x.kind === 'relic' ? A.RELICS[x.id].text : `Back up to ${Math.min(run.max, run.hp + A.MEND_AMOUNT)} / ${run.max}.`;
        const icon = x.kind === 'item' ? A.ITEM_ICON[x.id] : x.kind === 'relic' ? A.RELIC_ICON : 'heart';
        const full = x.kind === 'item' && run.items.length >= A.MAX_CONSUMABLES, topped = x.kind === 'mend' && run.hp >= run.max;
        const short = x.price - run.chips;
        const why = x.sold ? (x.kind === 'mend' ? '' : 'Sold') : full ? 'Bag full' : topped ? 'Pips full' : short > 0 ? `Need ${short} more` : '';
        const can = !why;
        return `<div class="good ${x.kind}${x.sold && x.kind !== 'mend' ? ' sold' : ''}">${px(icon, 2, 'good-ico')}<div class="good-text"><b>${esc(name)}</b><small><em>${x.kind === 'relic' ? 'Relic, lasts the run' : x.kind === 'item' ? `Item, ${itemInfo(x.id).when === 'before' ? 'before a throw' : 'after landing'}` : 'Service'}</em> · ${esc(text)}</small></div>
          <button type="button" class="pbtn${can ? ' primary' : ' off'}" data-buy="${k}" ${can ? '' : 'disabled'}>${can ? `${x.price} chips` : why}</button></div>`;
      }).join('')}</div>
      <h3>Your die</h3>${playerCard()}
      <div class="row">${btn('Leave', 'leave')}</div>`, 'tavern');
  }
  function buy(k) {
    const x = run.tavern.goods[k]; if (!x || x.sold || run.chips < x.price) return;
    if (x.kind === 'item') { if (run.items.length >= A.MAX_CONSUMABLES) return; run.items.push(x.id); x.sold = true; }
    else if (x.kind === 'relic') { gainRelic(x.id); x.sold = true; }
    else { run.hp = Math.min(run.max, run.hp + A.MEND_AMOUNT); }
    run.chips -= x.price;
    sfx('buy');
    showTavern();
  }
  function gainRelic(id) {
    run.relics.push(id);
    if (id === 'cracked') { run.max = Math.max(1, run.max - 5); run.hp = Math.min(run.hp, run.max); }
  }

  // ---------- Rest ----------
  function showRest() {
    phase = 'screen';
    const before = run.hp, n = Math.min(run.max - run.hp, Math.ceil(run.max * A.REST_SHARE));
    run.hp += n;
    sfx('heal');
    screen(`<h2 class="pxfont">Rest</h2>${screenTip('rest')}<p>You sit in the corner of the tray for a while.</p>
      <div class="rest-gain">${px('heart', 3)}<b class="pxfont">+${n}</b><span>${before} → ${run.hp} / ${run.max}</span></div>
      ${playerCard()}<div class="row">${btn('Move on', 'leave', 'big primary')}</div>`, 'rest');
  }

  // ---------- fights ----------
  const PKEY = 'p0', EKEY = (i) => 'e' + i;
  const keyOf = (r) => (r.side === 'p' ? PKEY : EKEY(r.die));

  function startFight(id, type) {
    const def = A.ENEMIES[id];
    const relic = (r) => run.relics.includes(r);
    const { d } = A.tray.dims;
    fight = {
      id, def, type, turn: 1, lead: false, outcome: null, sim: null, throws: null,
      from: { x: 0, z: d / 2 - d * 0.15 },
      st: {
        p: { hp: run.hp, max: run.max, dice: [run.die], relics: [...run.relics], chalk: [], charged: false, clackDeal: relic('leadcore') ? 1 : 0, clackTake: relic('leadcore') ? -1 : 0 },
        e: { hp: def.hp, max: def.hp, dice: def.dice, charged: false, clackDeal: def.clack?.deal || 0, clackTake: def.clack?.take || 0 },
      },
    };
    fight.shown = { p: run.hp, e: def.hp };
    run.stats.fights++;
    closeScreen();
    A.tray.clearDice();
    buildPlayerDie();
    def.dice.forEach((dd, i) => A.tray.setDie(EKEY(i), dd, { ring: '#ff2a43' }));
    readyDice();
    el.log.innerHTML = '';
    log(`<b>${esc(def.name)}</b> rolls into the tray.`);
    say(def.line);
    drawCards();
    U().banner(def.boss ? 'Boss' : def.elite ? 'Elite' : 'Fight', esc(def.name), def.boss || def.elite ? 'red' : '', 1300);
    setTimeout(() => toAim(), 900 * pace());
  }
  function buildPlayerDie() {
    A.tray.setDie(PKEY, run.die, { outline: A.PLAYER_OUTLINE, chalk: fight ? fight.st.p.chalk : [], ring: A.PLAYER_OUTLINE });
  }
  function playerPhys() {
    const p = { ...A.PHYS };
    if (run.relics.includes('leadcore')) p.mass = 2;
    if (run.relics.includes('rubber')) p.bounce = 1.7;
    return p;
  }

  // Dice wait at their own edges between throws; yours sits where you last threw from.
  function readyDice() {
    const { d } = A.tray.dims, n = fight.def.dice.length;
    fight.def.dice.forEach((_, i) => {
      const x = n === 1 ? 0 : (i - (n - 1) / 2) * 3.2;
      const keep = fight.outcome ? fight.outcome.dice[i + 1]?.face ?? 0 : 0;
      A.tray.restAt(EKEY(i), x, -d / 2 + 1.6, keep, 0.4 * i);
    });
    A.tray.restAt(PKEY, fight.from.x, fight.from.z, fight.outcome ? fight.outcome.dice[0].face : 0);
  }

  function toAim(resume = false) {
    phase = 'aim';
    clearLabels();
    el.after.className = 'after';
    U().phases(null);
    A.tray.setZones(true, true);
    drawCards();
    const sling = A.settings.aim === 'sling';
    hint((fight.lead ? 'Lead Shot loaded. ' : '') + (sling ? 'Press your die, pull back, let go.' : 'Press in the yellow zone, drag where to throw, let go.'));
    if (!resume) { U().banner('Your throw', `Turn ${fight.turn}`, 'yellow', 900); sfx('turn'); }
    // First fight: show how to throw.
    if (!resume) setTimeout(() => {
      if (phase !== 'aim' || aiming) return;
      const at = A.tray.screenOf(PKEY, 0.4), top = A.tray.screenOf(PKEY, 3.2), r = el.trayWrap.getBoundingClientRect();
      if (!at) return;
      const p = { x: r.left + at.x, y: r.top + at.y }, above = { x: p.x, y: r.top + top.y };
      const shown = coachAt('aim', sling
        ? '<b>This is you.</b> Press your die and pull <b>back</b>, like a slingshot. Let go to fling it the other way. Longer pull, harder throw.'
        : '<b>This is you.</b> Press in the yellow zone and drag the way you want to throw. Let go to throw.', above, 'above', { button: false });
      if (shown) U().hand(p, sling ? { x: p.x + 20, y: p.y + 90 } : { x: p.x + 10, y: p.y - 140 });
      else if (fight.turn === 2) coachAt('clack', '<b>Clack!</b> Hit their die hard while it tumbles and it takes damage. Aim at it.', enemyScreen(), 'below');
    }, 950 * pace());
  }
  const enemyScreen = () => { const at = A.tray.screenOf(EKEY(0), 0.4), r = el.trayWrap.getBoundingClientRect(); return at ? { x: r.left + at.x, y: r.top + at.y } : { x: innerWidth / 2, y: 100 }; };

  // Tips: once per device, at the moment they matter.
  function coachAt(id, html, at, place = 'above', opts = {}) {
    let p = at;
    if (typeof at === 'string') { const n = $(at); if (!n) return false; const r = n.getBoundingClientRect(); p = { x: r.left + r.width / 2, y: place === 'above' ? r.top : r.bottom }; }
    return U().coach(id, html, p, place, opts);
  }

  // ---------- aiming ----------
  function inZone(p) { const b = A.tray.zoneBounds('p'); return p.z >= b.z0 - 0.4 && p.z <= b.z1 && p.x >= b.x0 && p.x <= b.x1; }
  function clampStart(p) {
    const b = A.tray.zoneBounds('p');
    return { x: Math.max(b.x0 + 1.3, Math.min(b.x1 - 1.3, p.x)), z: Math.max(b.z0 + 0.9, Math.min(b.z1 - 1.3, p.z)) };
  }
  function onDown(e) {
    if (phase === 'resolve') { skipping = true; return; }
    if (phase !== 'aim' || e.button > 0) return;
    const p = A.tray.tableAt(e.clientX, e.clientY); if (!p) return;
    const start = inZone(p) ? clampStart(p) : { ...fight.from };
    fight.from = start;
    const press = A.tray.tableAt(e.clientX, e.clientY);
    aiming = { start, press, cx: e.clientX, cy: e.clientY, dx: 0, dz: 0, power: 0, id: e.pointerId, lastTick: 0 };
    el.trayWrap.setPointerCapture?.(e.pointerId);
    A.tray.showAim({ x: start.x, z: start.z, dx: 0, dz: 0, power: 0 });
    if (['aim', 'clack'].includes(U().coachId())) U().doneCoach(U().coachId());
    e.preventDefault();
  }
  function onMove(e) {
    if (!aiming || e.pointerId !== aiming.id) return;
    const p = A.tray.tableAt(e.clientX, e.clientY); if (!p) return;
    const r = el.trayWrap.getBoundingClientRect(), maxPull = Math.max(110, Math.min(240, Math.min(r.width, r.height) * 0.36));
    const sling = A.settings.aim === 'sling';
    const vx = p.x - aiming.press.x, vz = p.z - aiming.press.z;
    aiming.dx = sling ? -vx : vx; aiming.dz = sling ? -vz : vz;
    aiming.power = Math.min(1, Math.hypot(e.clientX - aiming.cx, e.clientY - aiming.cy) / maxPull);
    const k = aiming.power, s = aiming.start;
    A.tray.showAim({ x: s.x, z: s.z, dx: aiming.dx, dz: aiming.dz, power: k, pull: sling ? { x: s.x + vx * 0.6, z: s.z + vz * 0.6 } : null, arrow: A.settings.arrow });
    const at = A.tray.screenAt(s.x, 0, s.z);
    U().power({ x: at.x, y: at.y }, k);
    const step = Math.floor(k * 10); if (step !== aiming.lastTick) { aiming.lastTick = step; sfx('pull', k); }
    hint(k < 0.06 ? (sling ? 'Pull further.' : 'Drag further.') : k > 0.85 ? 'Full power.' : '');
  }
  function onUp(e) {
    if (!aiming || e.pointerId !== aiming.id) return;
    const a = aiming; aiming = null;
    A.tray.hideAim(); U().power(null);
    if (a.power < 0.06) { readyDice(); hint(A.settings.aim === 'sling' ? 'Pull further to throw.' : 'Drag further to throw.'); return; }
    throwTurn(a);
  }
  function cancelAim() { aiming = null; A.tray.hideAim(); U().power(null); readyDice(); }

  function enemyThrows(pThrow) {
    const { w, d } = A.tray.dims, n = fight.def.dice.length;
    return fight.def.dice.map((die, i) => {
      const x = Math.max(-w / 2 + 1.3, Math.min(w / 2 - 1.3, (n === 1 ? 0 : (i - (n - 1) / 2) * 3.4) + (Math.random() - 0.5) * w * 0.6));
      const z = -d / 2 + 1.3 + Math.random() * 1.2;
      let tx, tz;
      if (Math.random() < 0.55) {   // go for your die's path
        const t = 0.25 + Math.random() * 0.5, sp = Math.hypot(pThrow.vel[0], pThrow.vel[2]) || 1;
        tx = pThrow.pos[0] + (pThrow.vel[0] / sp) * d * t; tz = pThrow.pos[2] + (pThrow.vel[2] / sp) * d * t;
      } else { tx = (Math.random() - 0.5) * w * 0.8; tz = (Math.random() - 0.3) * d * 0.6; }
      return A.tray.makeThrow(EKEY(i), die.phys, x, z, tx - x, tz - z, 0.35 + Math.random() * 0.55);
    });
  }

  function outcomeOf(sim) {
    const ref = (i) => (i === 0 ? { side: 'p', die: 0 } : { side: 'e', die: i - 1 });
    return {
      dice: sim.up.map((face, i) => ({ ...ref(i), face, status: sim.status[i] === 'pinned' ? 'pinned' : 'ok', on: sim.on[i] })),
      clacks: sim.clacks.map((c) => ({ from: ref(c.from), to: ref(c.to), v: c.v, frame: c.frame })),
    };
  }

  async function throwTurn(a) {
    phase = 'sim';
    A.tray.setZones(true, false);
    hint('');
    sfx('release');
    const N = fight.def.previews;
    if (N > 1) {
      U().thinking(true, `${fight.def.name} tries ${N} throws against yours…`);
      for (let k = 0; k < N; k++) { sfx('think'); await wait(260); }
    } else await wait(30);
    const chosen = chooseThrow(a);
    U().thinking(false);
    fight.lead = false;
    fight.sim = chosen.sim; fight.throws = chosen.throws; fight.outcome = outcomeOf(chosen.sim);
    run.stats.turns++;
    phase = 'play';
    drawCards();
    if (chosen.rejected?.length) {
      const paths = chosen.rejected.flatMap((r) => r.throws.slice(1).map((_, i) => r.sim.frames.filter((_, f) => f % 3 === 0).map((fr) => [fr[i + 1][0], fr[i + 1][2]])));
      A.tray.ghosts(paths);
      U().banner(`Best of ${N}`, `${esc(fight.def.name)} threw away ${chosen.rejected.length}`, 'red small', 1200);
    }
    A.tray.playback(chosen.sim, chosen.throws, { onClack, onLand });
  }

  // Your throw is locked in; the enemy tries its previews against it and keeps the one that's best for it.
  function chooseThrow(a) {
    let pThrow = A.tray.makeThrow(PKEY, playerPhys(), a.start.x, a.start.z, a.dx, a.dz, a.power);
    const want = Math.max(1, fight.def.previews);
    const good = [];
    let last = null, sims = 0;
    const leadOk = (sim) => !fight.lead || !['skull', 'smooth'].includes(run.die.faces[sim.up[0]].t) || sim.status[0] !== 'ok';
    while (good.length < want && sims < want + 14) {
      const throws = [pThrow, ...enemyThrows(pThrow)];
      const sim = A.tray.simulate(throws); sims++;
      last = { sim, throws };
      const playerBad = sim.status[0] === 'lean' || !leadOk(sim);
      if (playerBad) {   // the same throw, a hair different, so your die lands cleanly (or, with Lead Shot, on a real face)
        const s = pThrow.seed.map((v, k) => (k < 3 ? v + (Math.random() - 0.5) * 0.12 : v + (Math.random() - 0.5) * 0.4));
        pThrow = A.tray.makeThrow(PKEY, playerPhys(), a.start.x, a.start.z, a.dx, a.dz, a.power, s);
        good.length = 0;   // earlier previews were against a throw you didn't make
        continue;
      }
      if (sim.status.some((s) => s === 'lean')) continue;
      good.push({ sim, throws, score: A.scoreForEnemy(fight.st, outcomeOf(sim)) });
    }
    if (!good.length) return last;
    const best = good.reduce((b, x) => (x.score > b.score ? x : b));
    return { ...best, rejected: good.filter((g) => g !== best) };
  }

  // A Clack mid-tumble: damage lands now, where it happened. Returns the damage (the tray sparks and slows on it).
  function onClack(c, at) {
    const ref = (i) => (i === 0 ? { side: 'p', die: 0 } : { side: 'e', die: i - 1 });
    const from = ref(c.from), to = ref(c.to);
    if (from.side === to.side) return 0;
    const atk = fight.st[from.side], def = fight.st[to.side];
    let n = A.clackBase(c.v); if (!n) return 0;
    n = Math.max(0, n + (atk.clackDeal || 0) + (def.clackTake || 0)); if (!n) return 0;
    const prev = fight.shown[to.side];
    fight.shown[to.side] = Math.max(0, prev - n);
    const s = A.tray.screenAt(at.x, at.y + 1, at.z);
    floatAt(s, `CLACK −${n}`, 'clack' + (n >= 3 ? ' big' : ''));
    sfx('clack', n);
    if (!A.settings.reduceMotion) shake(n);
    drawCards({ [to.side]: { prev } });
    return n;
  }

  function onLand() {
    phase = 'landed';
    showFaceLabels();
    fight.outcome.dice.forEach((d) => A.tray.flash(keyOf(d), d.side === 'p' ? A.PLAYER_OUTLINE : '#ff2a43', 0.35));
    const ok = fight.outcome.dice[0].status === 'ok';
    const canNudge = ok && run.items.includes('nudge'), canTalc = run.items.includes('talc');
    if (canNudge || canTalc) {
      const f = A.effFace(fight.st, 'p', 0, fight.outcome.dice[0].face);
      el.after.className = 'after show';
      el.after.innerHTML = `<span class="after-q">You rolled <b>${ok ? esc(A.faceLabel(f)) : 'Pinned'}</b>. Use an item?</span>
        ${canNudge ? `<button type="button" class="pbtn" data-act="nudge">${px('chevron', 2)}Nudge</button>` : ''}
        ${canTalc ? `<button type="button" class="pbtn" data-act="talc" title="Call off the throw. Everyone throws again.">${px('gem-green', 2)}Talc</button>` : ''}
        <button type="button" class="pbtn primary go" data-act="go">Go ▸</button>`;
    } else setTimeout(resolveTurn, 700 * pace());
    if (fight.turn === 1) setTimeout(() => {
      if (phase !== 'landed' && phase !== 'resolve') return;
      coachAt('faces', 'The face on top is each die\'s move this turn. <b>Tap any face</b> in these panels to read it. The coloured bars show the odds.', '#enemy-bar .fdice', 'below');
    }, 300);
  }

  function showNudge() {
    const cur = fight.outcome.dice[0].face, nb = A.neighbours(run.die.sides, cur);
    el.after.innerHTML = `<span class="after-q">Tip onto a face next to it:</span>${nb.map((i) => `<button type="button" class="chip big" data-nudge="${i}" title="${esc(A.faceLabel(run.die.faces[i]) + ': ' + A.faceText(run.die.faces[i]))}"><img alt="${esc(A.faceLabel(run.die.faces[i]))}" src="${A.faceChip(run.die.faces[i], run.die.look)}"></button>`).join('')}<button type="button" class="pbtn" data-act="go">Keep it</button>`;
  }
  async function doNudge(i) {
    useItem('nudge');
    el.after.className = 'after';
    clearLabels();
    sfx('click');
    await A.tray.tip(PKEY, i);
    fight.outcome.dice[0].face = i;
    log(`You nudge onto <b>${esc(A.faceLabel(run.die.faces[i]))}</b>.`);
    showFaceLabels();
    setTimeout(resolveTurn, 450 * pace());
  }
  function doTalc() {
    useItem('talc');
    fight.shown = { p: fight.st.p.hp, e: fight.st.e.hp };
    log('Talc. The throw is called off.');
    fight.outcome = null;
    readyDice();
    toAim();
  }
  function useItem(id) { const k = run.items.indexOf(id); if (k >= 0) run.items.splice(k, 1); drawCards(); }

  // ---------- resolving a turn, one beat at a time ----------
  async function resolveTurn() {
    if (phase !== 'landed') return;
    phase = 'resolve';
    skipping = false;
    U().doneCoach(U().coachId());
    el.after.className = 'after';
    const before = { p: fight.st.p.hp, e: fight.st.e.hp };
    const ev = A.resolve(fight.st, fight.outcome);
    run.stats.dealt += Math.max(0, before.e - fight.st.e.hp);
    run.stats.taken += Math.max(0, before.p - fight.st.p.hp);
    const has = {
      clack: ev.some((e) => e.k === 'clack'),
      guard: ev.some((e) => e.k === 'guard'),
      hits: ev.some((e) => (e.k === 'dmg' && e.why !== 'clack' && e.why !== 'thorn') || e.k === 'heal' || e.k === 'blocked' || e.k === 'charge'),
      thorn: ev.some((e) => e.k === 'thorn'),
    };
    const guard = { p: 0, e: 0 };
    const dieKeys = (side) => (side === 'p' ? [PKEY] : fight.def.dice.map((_, i) => EKEY(i)));
    const onDie = (side) => dieKeys(side)[0];

    // Clack damage already landed during the throw; it gets a log line here.
    ev.filter((e) => e.k === 'clack').forEach((e) => { if (e.from.side === 'p') run.stats.clacks++; log(`Clack! ${who(e.from)} ${e.from.side === 'p' ? 'hit' : 'hits'} ${who(e.to, true)} for <b>${e.n}</b>.`); });
    ev.filter((e) => e.k === 'pinned').forEach((e) => log(`${who(e.at)} ${e.at.side === 'p' ? 'are' : 'is'} <b>Pinned</b>: no move this turn.`));
    ev.filter((e) => e.k === 'face' && e.face.t !== 'smooth').forEach((e) => log(`${who(e.at)}: <b>${esc(A.faceLabel(e.face))}</b>${e.times > 1 ? ' ×2 (chalk)' : ''}${e.face.charged ? ' (charged ×2)' : ''}${e.pinBonus ? ` (+${e.pinBonus} from a pin)` : ''}.`));

    if (has.clack) { U().phases('clack', has); await wait(350); }
    if (has.guard) {
      U().phases('guard', has);
      for (const e of ev.filter((x) => x.k === 'guard')) {
        guard[e.side] = e.n;
        dieKeys(e.side).forEach((k) => A.tray.flash(k, '#4fa3ff', 0.6));
        floatOn(onDie(e.side), `GUARD ${e.n}`, 'guard'); sfx('guard');
        drawCards({ p: { guard: guard.p }, e: { guard: guard.e } });
        await wait(420);
      }
    }
    if (has.hits) {
      U().phases('hits', has);
      for (const e of ev) {
        if (e.k === 'blocked') {
          guard[e.side] = Math.max(0, guard[e.side] - e.n);
          floatOn(onDie(e.side), `BLOCKED ${e.n}`, 'guard'); sfx('block');
          log(`${e.side === 'p' ? 'You block' : `${esc(fight.def.name)} blocks`} <b>${e.n}</b>.`);
          await wait(320);
        } else if (e.k === 'dmg' && (e.why === 'strike' || e.why === 'pierce')) {
          if (e.at) A.tray.flash(keyOf(e.at), '#ffffff', 0.7);
          const prev = fight.shown[e.side];
          fight.shown[e.side] = Math.max(0, prev - e.n);
          floatOn(onDie(e.side), `−${e.n}`, 'dmg' + (e.why === 'pierce' ? ' pierce' : ''));
          if (e.side === 'p') { sfx('hurt', e.n); if (!A.settings.reduceMotion) shake(1); } else sfx('hit', e.n);
          drawCards({ [e.side]: { prev, guard: guard[e.side] }, [e.side === 'p' ? 'e' : 'p']: { guard: guard[e.side === 'p' ? 'e' : 'p'] } });
          await wait(460);
        } else if (e.k === 'heal' && e.n) {
          fight.shown[e.side] = Math.min(fight.st[e.side].max, fight.shown[e.side] + e.n);
          floatOn(onDie(e.side), `+${e.n}`, 'heal'); sfx('heal');
          if (e.why === 'snakeoil') log('Snake Oil: <b>+2</b>.');
          drawCards({ p: { guard: guard.p }, e: { guard: guard.e } });
          await wait(400);
        } else if (e.k === 'charge') {
          floatOn(onDie(e.side), 'CHARGED', 'charge'); sfx('charge');
          log(`${e.side === 'p' ? 'You are' : `${esc(fight.def.name)} is`} <b>charged</b>: next face ×2.`);
          drawCards({ p: { guard: guard.p }, e: { guard: guard.e } });
          await wait(380);
        }
      }
    }
    if (has.thorn) {
      U().phases('thorn', has);
      for (const e of ev.filter((x) => x.k === 'thorn')) {
        const hurt = e.side === 'p' ? 'e' : 'p', prev = fight.shown[hurt];
        fight.shown[hurt] = Math.max(0, prev - e.n);
        floatOn(onDie(hurt), `THORN −${e.n}`, 'thorn'); sfx('thorn');
        log(`Thorns: <b>${e.n}</b> back.`);
        drawCards({ [hurt]: { prev } });
        await wait(420);
      }
    }
    if (!has.hits && !has.thorn && !has.guard && !has.clack) { floatOn(PKEY, 'NOTHING', 'none'); sfx('fizzle'); await wait(420); }

    fight.shown = { p: Math.max(0, fight.st.p.hp), e: Math.max(0, fight.st.e.hp) };
    U().phases(null);
    const dealt = before.e - fight.st.e.hp, taken = before.p - fight.st.p.hp;
    log(`<span class="sum">Turn ${fight.turn}: you dealt <b>${Math.max(0, dealt)}</b>, took <b>${Math.max(0, taken)}</b>.</span>`);
    drawCards();
    skipping = false;
    await wait(500);
    if (fight.st.e.hp <= 0) return winFight();
    if (fight.st.p.hp <= 0) return loseFight();
    fight.turn++;
    readyDice();
    toAim();
  }
  const who = (r, lower) => { const s = r.side === 'p' ? 'you' : (fight.def.dice[r.die].name || fight.def.name); return lower ? s : s.charAt(0).toUpperCase() + s.slice(1); };

  async function winFight() {
    phase = 'screen';
    say(fight.def.lose);
    A.tray.setZones(false);
    U().banner('Win', `${esc(fight.def.name)} is out`, 'yellow big', 1300);
    sfx('win');
    run.hp = fight.st.p.hp;
    await wait(1300);
    if (fight.type === 'boss') return endRun(true);
    const chips = fight.def.chips + Math.floor(Math.random() * 4);
    run.chips += chips;
    let found = '', relicChoice = '';
    if (fight.type === 'elite') {
      const opts = shuffle(Object.keys(A.RELICS).filter((r) => !run.relics.includes(r))).slice(0, 2);
      if (opts.length) relicChoice = `<h3>Take a relic</h3><div class="goods" id="relic-pick">${opts.map((r) => `<div class="good relic">${px(A.RELIC_ICON, 2, 'good-ico')}<div class="good-text"><b>${esc(A.RELICS[r].name)}</b><small>${esc(A.RELICS[r].text)}</small></div><button type="button" class="pbtn primary" data-relic="${r}">Take</button></div>`).join('')}</div>`;
    } else if (Math.random() < 0.5) {
      const id = pick(Object.keys(A.CONSUMABLES));
      if (run.items.length < A.MAX_CONSUMABLES) { run.items.push(id); found = `<div class="good item">${px(A.ITEM_ICON[id], 2, 'good-ico')}<div class="good-text"><b>Found ${esc(itemInfo(id).name)}</b><small>${esc(itemInfo(id).text)}</small></div></div>`; }
      else found = `<p class="small">Found ${esc(itemInfo(id).name)}, but your bag is full.</p>`;
    }
    A.tray.clearDice();
    clearLabels();
    const name = fight.def.name;
    fight = null; drawCards(); el.log.innerHTML = '';
    sfx('coin');
    screen(`<h2 class="pxfont">${esc(name)} is out.</h2>
      ${screenTip('reward')}
      <div class="reward">${px('btn-yellow', 3)}<b class="pxfont">+${chips}</b><span>chips (you have ${run.chips})</span></div>
      ${found}${relicChoice}
      <h3>Your die</h3>${playerCard()}
      <div class="row">${btn('Move on', 'leave', 'big primary')}</div>`, 'reward-screen');
  }

  async function loseFight() {
    phase = 'screen';
    say(fight.def.win);
    A.tray.setZones(false);
    U().banner('Knocked out', '', 'red big', 1400);
    sfx('lose');
    await wait(1500);
    endRun(false);
  }

  function endRun(won) {
    A.tray.clearDice(); clearLabels();
    const s = run.stats, share = run.hp / run.max;
    const stars = won ? (share >= 0.6 ? 3 : share >= 0.3 ? 2 : 1) : 0;
    screen(`
      <div class="end-art">${won ? px('crest-blue', 3) : px('shield-red', 3)}</div>
      <h2 class="pxfont center">${won ? 'The House is out.' : `${esc(fight.def.name)} wins.`}</h2>
      <p class="lead center">${won ? 'You cleared the Green Felt.' : `Knocked out at stop ${run.step + 1} of ${run.map.length}.`}</p>
      ${won ? `<div class="stars center">${[0, 1, 2].map((k) => px(k < stars ? 'star' : 'star-empty', 3)).join('')}</div><p class="small center">Stars for pips left: ${run.hp} / ${run.max}</p>` : ''}
      <div class="stats"><div><b class="pxfont">${s.fights}</b><small>fights</small></div><div><b class="pxfont">${s.turns}</b><small>throws</small></div><div><b class="pxfont">${s.clacks}</b><small>clacks landed</small></div><div><b class="pxfont">${s.dealt}</b><small>damage dealt</small></div></div>
      <h3>Your die</h3>${forgeDie()}
      <div class="row center">${btn('New run', 'start', 'big primary')}${btn('Title', 'title')}</div>`, won ? 'won' : 'lost');
    run = null; fight = null; drawCards(); el.log.innerHTML = '';
  }

  // ---------- tray overlays ----------
  function hint(s) { el.hint.textContent = s; el.hint.style.display = s ? '' : 'none'; }
  function log(html) {
    const p = document.createElement('p'); p.innerHTML = html; el.log.append(p);
    while (el.log.children.length > 7) el.log.firstChild.remove();
  }
  function say(line) {
    if (!line) return;
    el.say.innerHTML = `<b>${esc(fight?.def.name || '')}</b>“${esc(line)}”`; el.say.className = 'say show';
    clearTimeout(say.t); say.t = setTimeout(() => (el.say.className = 'say'), 2800);
  }
  function shake(n = 1) { el.trayWrap.style.setProperty('--shake', Math.min(3, n) * 3 + 'px'); el.trayWrap.classList.remove('shake'); void el.trayWrap.offsetWidth; el.trayWrap.classList.add('shake'); }

  function floatAt(p, text, cls) {
    const d = document.createElement('div'); d.className = 'float pxfont ' + cls; d.textContent = text;
    d.style.left = p.x + 'px'; d.style.top = p.y + 'px';
    el.labels.append(d); setTimeout(() => d.remove(), 1400);
  }
  // Effects float up beside the die (its label sits above it); several at once stack instead of overlapping.
  const recent = {};
  function floatOn(key, text, cls) {
    const p = A.tray.screenOf(key, 0.5); if (!p) return;
    const now = performance.now(), r = recent[key] && now - recent[key].t < 700 ? recent[key].n + 1 : 0;
    recent[key] = { t: now, n: r };
    floatAt({ x: p.x + 44, y: p.y + r * 40 }, text, cls + ' side');
  }

  // A label over each landed die saying what it rolled, in its owner's colour.
  let labels = [];
  function showFaceLabels() {
    clearLabels();
    fight.outcome.dice.forEach((d) => {
      const key = keyOf(d), dieDef = fight.st[d.side].dice[d.die];
      const f = A.effFace(fight.st, d.side, d.die, d.face);
      const chalk = d.side === 'p' && fight.st.p.chalk.includes(d.face);
      const div = document.createElement('div');
      div.className = 'face-label ' + (d.side === 'p' ? 'mine' : 'theirs') + (d.status === 'pinned' ? ' pinned' : '');
      div.innerHTML = d.status === 'pinned' ? '<b>PINNED</b><small>no move</small>' : `<img alt="" src="${A.faceChip(f, dieDef.look, 28)}"><b>${esc(A.faceLabel(f))}</b>${chalk ? '<small>×2</small>' : ''}`;
      el.labels.append(div);
      labels.push({ key, div });
    });
  }
  function clearLabels() { labels.forEach((l) => l.div.remove()); labels = []; }
  function onFrame(now) {
    labels.forEach((l) => { const p = A.tray.screenOf(l.key, 1.5); if (p) { l.div.style.left = p.x + 'px'; l.div.style.top = p.y + 'px'; } });
    if (phase === 'aim' && aiming) A.tray.hover(PKEY, aiming.start.x, aiming.start.z, now / 1000, 1.6 + aiming.power * 0.8);
  }

  // ---------- items during a fight ----------
  function useBefore(k, btnEl) {
    const id = run.items[k]; if (!id) return;
    const it = itemInfo(id);
    if (it.when !== 'before' || phase !== 'aim' || (id === 'lead' && fight.lead)) { U().inspect(btnEl); return; }
    if (id === 'lead') { useItem('lead'); fight.lead = true; sfx('charge'); log('Lead Shot loaded: no Skull or Smooth this throw.'); toAim(true); }
    else if (id === 'chalk') {
      phase = 'screen';
      screen(`<h2 class="pxfont">Chalk a face</h2><p>If it comes up this fight, it triggers twice.</p>${U().net(run.die, { pickable: true, chalk: fight.st.p.chalk, only: (f, i) => !fight.st.p.chalk.includes(i) })}<div class="row">${btn('Cancel', 'back-fight')}</div>`, 'chalk');
      el.overlay.onPick = (i) => {
        if (fight.st.p.chalk.includes(i)) return;
        useItem('chalk'); fight.st.p.chalk.push(i);
        closeScreen(); buildPlayerDie(); readyDice();
        sfx('forge');
        log(`Chalked <b>${esc(A.faceLabel(run.die.faces[i]))}</b>.`);
        toAim(true);
      };
    }
  }

  // ---------- wiring ----------
  function onClick(e) {
    const b = e.target.closest('button');
    if (!b) { if (!e.target.closest('.pop')) U().closePop(); return; }
    const act = b.dataset.act;
    if (act !== 'coach-ok' && !b.closest('.pop')) U().closePop();
    if (act) sfx('click');
    if (act === 'coach-ok') { U().doneCoach(U().coachId()); return; }
    if (act === 'tip-ok') { tipDone(b.dataset.tip); b.closest('.screen-tip').remove(); return; }
    if (act === 'start') {
      if (A.settings.tips && !U().seen('howto')) { showHowTo(); return; }
      sfx('unlock'); newRun(); return;
    }
    if (act === 'howto-go') { U().doneCoach('howto'); sfx('unlock'); newRun(); return; }
    if (act === 'title') { showTitle(); return; }
    if (act === 'rules' || act === 'settings') { openSide(act); return; }
    if (act === 'back') { back(); return; }
    if (b.dataset.set) {
      A.settings[b.dataset.set] = JSON.parse(b.dataset.val); saveSettings();
      const hold = behind; showSettings(); behind = hold; return;
    }
    if (act === 'reset-tips') { U().resetTips(); b.textContent = 'Tips will show again'; return; }
    if (act === 'leave') { nextStep(); return; }
    if (b.dataset.node != null && phase === 'map') { enterNode(+b.dataset.node); return; }
    if (b.dataset.buy != null) { buy(+b.dataset.buy); return; }
    if (b.dataset.relic) { gainRelic(b.dataset.relic); sfx('buy'); $('#relic-pick').innerHTML = `<p>Took <b>${esc(A.RELICS[b.dataset.relic].name)}</b>.</p>`; return; }
    if (b.dataset.stamp != null) { engrave(JSON.parse(el.overlay.dataset.stamps)[+b.dataset.stamp]); return; }
    if (act === 'sand') {
      screen(`<h2 class="pxfont">Sand off which Skull?</h2>${U().net(run.die, { pickable: true, only: (f) => f.t === 'skull' })}<div class="row">${btn('Back', 'back-forge')}</div>`, 'forge');
      el.overlay.onPick = (i) => { if (run.die.faces[i].t !== 'skull') return; run.die.faces[i] = A.F('smooth'); sfx('forge'); forgeDone('Sanded the Skull off. That face is Smooth now.'); };
      return;
    }
    if (act === 'grow') { grow(); return; }
    if (act === 'grow-yes') { run.die.sides = 6; run.die.faces.push(A.F('smooth'), A.F('smooth')); sfx('forge'); forgeDone('You are a <b>d6</b> now. Two Smooth faces are waiting for stamps.'); return; }
    if (act === 'back-forge') { showForge(); return; }
    if (act === 'back-fight') { closeScreen(); toAim(true); return; }
    if (b.dataset.face != null && el.overlay.onPick && b.closest('.pickable')) { if (!b.classList.contains('off')) el.overlay.onPick(+b.dataset.face); return; }
    if (act === 'nudge' && phase === 'landed') { showNudge(); return; }
    if (b.dataset.nudge != null && phase === 'landed') { doNudge(+b.dataset.nudge); return; }
    if (act === 'talc' && phase === 'landed') { doTalc(); return; }
    if (act === 'go' && phase === 'landed') { resolveTurn(); return; }
    if (b.dataset.item != null && run) { if (fight) useBefore(+b.dataset.item, b); else U().inspect(b); return; }
    if (b.dataset.inspect) { U().inspect(b); return; }
  }
  function onOver(e) {
    const b = e.target.closest?.('.pickable .chip'); if (!b || !el.overlay.onHover) return;
    el.overlay.onHover(+b.dataset.face);
  }

  function boot() {
    loadSettings();
    Object.assign(el, {
      overlay: $('#overlay'), enemy: $('#enemy-bar'), player: $('#player-bar'), trayWrap: $('#tray-wrap'), labels: $('#labels'),
      hint: $('#hint'), log: $('#log'), after: $('#after'), say: $('#say'),
    });
    if (!window.THREE || !window.CANNON || !window.RP?.dieShape) { el.overlay.className = 'overlay show'; el.overlay.innerHTML = '<div class="sheet"><h2>Couldn\'t load the dice.</h2><p>The 3D engine didn\'t load. Check your connection and reload.</p></div>'; return; }
    try { A.tray.init(el.trayWrap); } catch (err) { console.error(err); el.overlay.className = 'overlay show'; el.overlay.innerHTML = '<div class="sheet"><h2>No 3D here.</h2><p>This browser can\'t draw WebGL, which the tray needs.</p></div>'; return; }
    A.tray.onFrame = onFrame;
    document.addEventListener('click', onClick);
    document.addEventListener('mouseover', onOver);
    el.trayWrap.addEventListener('pointerdown', onDown);
    el.trayWrap.addEventListener('pointermove', onMove);
    el.trayWrap.addEventListener('pointerup', onUp);
    el.trayWrap.addEventListener('pointercancel', () => { if (aiming) cancelAim(); });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (aiming) cancelAim(); U().closePop(); } });
    showTitle();
  }

  // For the desktop app's menu bar (desktop/clack-arena): the commands it can send the game.
  A.menu = {
    get inRun() { return !!run; },
    get sound() { return A.settings.sound; },
    newRun: () => { sfx('unlock'); behind = null; newRun(); },
    title: () => { behind = null; if (fight) { A.tray.clearDice(); A.tray.setZones(false); clearLabels(); fight = null; drawCards(); } run = null; showTitle(); },
    rules: () => openSide('rules'),
    settings: () => openSide('settings'),
    toggleSound: () => { A.settings.sound = !A.settings.sound; saveSettings(); return A.settings.sound; },
  };

  // For checks from dev tools.
  A.debug = { get run() { return run; }, get fight() { return fight; }, get phase() { return phase; }, throwTurn, chooseThrow, outcomeOf, newRun, startFight, showMap, resolveTurn };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
