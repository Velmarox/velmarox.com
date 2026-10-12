// Clack Arena: the run. Title, map, fights, Forge, Tavern, Rest and the end screens. The tray (tray.js) throws
// the dice; the rules (rules.js) say what they did; this file runs the turns and draws the panels.
(() => {
  const A = window.ARENA;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms * (A.timeScale ?? 1)));
  const clone = (o) => JSON.parse(JSON.stringify(o));

  let run = null, fight = null;
  let phase = 'title';          // title | map | aim | sim | play | landed | resolve | screen
  let aiming = null;

  const el = {};

  // ---------- run ----------
  function newRun() {
    run = {
      hp: A.PLAYER_START.hp, max: A.PLAYER_START.hp, die: clone(A.PLAYER_START.die),
      relics: [], items: ['nudge', 'chalk'], chips: 0, step: 0, map: makeMap(),
      stats: { fights: 0, turns: 0, clacks: 0, dealt: 0, taken: 0 },
    };
    showMap();
  }

  function makeMap() {
    const steps = [[{ type: 'fight', enemy: 'pips' }]];
    const stage = (i) => (i <= 2 ? 0 : i <= 5 ? 1 : 2);
    for (let i = 1; i <= 7; i++) {
      const types = ['fight', 'fight', 'forge', 'tavern', 'rest'];
      if (i >= 3) types.push('elite', 'elite');
      let opts = shuffle(types).filter((t, k, a) => a.indexOf(t) === k).slice(0, i % 3 === 0 ? 3 : 2);
      const must = { 2: 'forge', 4: 'tavern', 7: 'rest' }[i];
      if (must && !opts.includes(must)) opts[opts.length - 1] = must;
      if (i === 1 && !opts.includes('fight')) opts[0] = 'fight';
      steps.push(opts.map((type) => ({
        type,
        enemy: type === 'fight' ? pick(A.FIGHT_POOL[stage(i)]) : type === 'elite' ? pick(A.ELITE_POOL) : undefined,
      })));
    }
    steps.push([{ type: 'boss', enemy: A.BOSS }]);
    return steps;
  }

  const NODE = {
    fight: ['Fight', 'A die looking for trouble.'], elite: ['Elite', 'A hard fight. Drops a relic.'], forge: ['Forge', 'Engrave a face, sand off a Skull, or grow.'],
    tavern: ['Tavern', 'Spend chips on items and relics.'], rest: ['Rest', 'Repair some pips.'], boss: ['The House', 'The boss of the Green Felt.'],
  };

  // ---------- screens ----------
  function screen(html, cls = '') {
    el.overlay.onPick = null;
    el.overlay.className = 'overlay show ' + cls;
    el.overlay.innerHTML = '<div class="sheet">' + html + '</div>';
    el.overlay.scrollTop = 0;
  }
  function closeScreen() { el.overlay.className = 'overlay'; el.overlay.innerHTML = ''; }

  function dieNet(die, opts = {}) {
    const chalk = opts.chalk || [];
    return '<div class="net' + (opts.pickable ? ' pickable' : '') + '">' + die.faces.map((f, i) =>
      `<button type="button" class="chip${chalk.includes(i) ? ' chalked' : ''}${opts.only && !opts.only(f, i) ? ' off' : ''}" data-face="${i}" title="${esc(A.faceLabel(f) + ': ' + A.faceText(f))}"><img alt="${esc(A.faceLabel(f))}" src="${A.faceChip(f, die.look)}"></button>`).join('') + '</div>';
  }
  const itemInfo = (id) => A.CONSUMABLES[id];
  const relicTags = () => run.relics.map((r) => `<span class="relic" title="${esc(A.RELICS[r].text)}">${esc(A.RELICS[r].name)}</span>`).join('');

  function showTitle() {
    phase = 'title';
    screen(`
      <div class="title-art"><span class="hz"></span><h1>Clack <em>Arena</em></h1><span class="hz"></span></div>
      <p class="lead">You are a die. Everyone else is too.</p>
      <p>You and the enemy throw into the same tray at the same time. The dice crash into each other, and whatever face you land on is what you do. Between fights you engrave new faces onto yourself.</p>
      <div class="howto">
        <h3>How to play</h3>
        <ol>
          <li><b>Aim.</b> Press on your side of the tray (the near edge) and drag the way you want to throw. Longer drag, harder throw. Let go to throw.</li>
          <li><b>Clack.</b> Hit an enemy die hard while it's tumbling and it takes damage. You can knock it off its best face.</li>
          <li><b>Read the faces.</b> Strike deals damage, Guard blocks it, Pierce ignores Guard, Mend heals, Charge doubles your next face, Thorn hurts whoever hits you. Skull and Smooth do nothing.</li>
          <li><b>Pinned.</b> A die left leaning on another die does nothing, and the die under it gets +1.</li>
          <li><b>Grow, or don't.</b> A d6 has room for more faces, but every face comes up less often.</li>
        </ol>
      </div>
      <div class="row"><button type="button" class="btn big" data-act="start">Start a run</button></div>
      <p class="small">Early build. One tray, the d4 and the d6, six enemies. Nothing carries between runs yet.</p>`, 'title');
  }

  function showMap() {
    phase = 'map';
    const i = run.step, opts = run.map[i];
    const trail = run.map.map((s, k) => `<span class="pip ${k < i ? 'done' : k === i ? 'now' : ''}${k === run.map.length - 1 ? ' boss' : ''}"></span>`).join('');
    screen(`
      <h2>Green Felt <span class="dim">· stop ${i + 1} of ${run.map.length}</span></h2>
      <div class="trail">${trail}</div>
      ${statusBlock()}
      <h3>Where next?</h3>
      <div class="nodes">${opts.map((n, k) => {
        const [title, sub] = NODE[n.type];
        const who = n.enemy ? A.ENEMIES[n.enemy].name : '';
        return `<button type="button" class="node ${n.type}" data-node="${k}"><b>${esc(title)}</b>${who && n.type !== 'boss' ? `<span class="who">${esc(who)}</span>` : ''}<small>${esc(sub)}</small></button>`;
      }).join('')}</div>`);
  }

  function statusBlock() {
    return `<div class="status">
      <div><span class="k">Pips</span> <b>${run.hp} / ${run.max}</b></div>
      <div><span class="k">Chips</span> <b>${run.chips}</b></div>
      <div><span class="k">Die</span> <b>${esc(A.PLAYER_START.name)} · d${run.die.sides}</b></div>
    </div>
    ${dieNet(run.die)}
    <div class="inv">${run.items.map((id) => `<span class="item" title="${esc(itemInfo(id).text)}">${esc(itemInfo(id).name)}</span>`).join('') || '<span class="dim">No items</span>'} ${relicTags()}</div>`;
  }

  function enterNode(k) {
    const n = run.map[run.step][k];
    if (n.type === 'fight' || n.type === 'elite' || n.type === 'boss') startFight(n.enemy, n.type);
    else if (n.type === 'forge') showForge();
    else if (n.type === 'tavern') showTavern();
    else if (n.type === 'rest') showRest();
  }
  function nextStep() { run.step++; showMap(); }

  // ---------- Forge ----------
  function showForge() {
    phase = 'screen';
    const stamps = shuffle(A.STAMPS).slice(0, 3);
    const hasSkull = run.die.faces.some((f) => f.t === 'skull');
    screen(`
      <h2>Forge</h2>
      <p>One job per visit. Pick a stamp, then the face it goes on. It replaces whatever was there.</p>
      ${dieNet(run.die)}
      <h3>Engrave</h3>
      <div class="stamps">${stamps.map((f, k) => `<button type="button" class="stamp" data-stamp="${k}"><img alt="" src="${A.faceChip(f, run.die.look)}"><b>${esc(A.faceLabel(f))}</b><small>${esc(A.faceText(f))}</small></button>`).join('')}</div>
      <h3>Or</h3>
      <div class="row">
        ${hasSkull ? '<button type="button" class="btn ghost" data-act="sand">Sand off a Skull</button>' : ''}
        ${run.die.sides === 4 ? '<button type="button" class="btn ghost" data-act="grow">Grow to a d6</button>' : ''}
        <button type="button" class="btn ghost" data-act="leave">Leave</button>
      </div>
      ${run.die.sides === 4 ? '<p class="small">Growing keeps your four faces and adds two Smooth (blank) ones. More room for a build, but each face comes up 1 time in 6 instead of 1 in 4.</p>' : ''}`);
    el.overlay.dataset.stamps = JSON.stringify(stamps);
  }
  function pickFace(title, only, then) {
    screen(`<h2>${esc(title)}</h2>${dieNet(run.die, { pickable: true, only })}<div class="row"><button type="button" class="btn ghost" data-act="back-forge">Cancel</button></div>`);
    el.overlay.onPick = (i) => { if (only && !only(run.die.faces[i], i)) return; then(i); };
  }

  // ---------- Tavern ----------
  function showTavern() {
    phase = 'screen';
    const goods = [];
    shuffle(Object.keys(A.CONSUMABLES)).slice(0, 2).forEach((id) => goods.push({ kind: 'item', id, price: A.PRICES.consumable }));
    const relic = shuffle(Object.keys(A.RELICS).filter((r) => !run.relics.includes(r)))[0];
    if (relic) goods.push({ kind: 'relic', id: relic, price: A.PRICES.relic });
    goods.push({ kind: 'mend', price: A.PRICES.mend });
    run.tavern = goods;
    drawTavern();
  }
  function drawTavern() {
    const g = run.tavern;
    screen(`
      <h2>Tavern</h2>
      <p class="npc">"You've got <b>${run.chips}</b> chips. Spend them or don't."</p>
      <div class="goods">${g.map((x, k) => {
        const name = x.kind === 'item' ? itemInfo(x.id).name : x.kind === 'relic' ? A.RELICS[x.id].name : `Mend ${A.MEND_AMOUNT} pips`;
        const text = x.kind === 'item' ? itemInfo(x.id).text : x.kind === 'relic' ? A.RELICS[x.id].text : `Back up to ${Math.min(run.max, run.hp + A.MEND_AMOUNT)} / ${run.max}.`;
        const full = x.kind === 'item' && run.items.length >= A.MAX_CONSUMABLES;
        const can = !x.sold && run.chips >= x.price && !full && !(x.kind === 'mend' && run.hp >= run.max);
        return `<div class="good ${x.kind}${x.sold ? ' sold' : ''}"><div><b>${esc(name)}</b><small>${x.kind === 'relic' ? 'Relic · ' : x.kind === 'item' ? 'Item · ' : ''}${esc(text)}</small></div>
          <button type="button" class="btn${can ? '' : ' off'}" data-buy="${k}" ${can ? '' : 'disabled'}>${x.sold ? 'Sold' : full ? 'Bag full' : x.price + ' chips'}</button></div>`;
      }).join('')}</div>
      ${statusBlock()}
      <div class="row"><button type="button" class="btn ghost" data-act="leave">Leave</button></div>`);
  }
  function buy(k) {
    const x = run.tavern[k]; if (!x || x.sold || run.chips < x.price) return;
    if (x.kind === 'item') { if (run.items.length >= A.MAX_CONSUMABLES) return; run.items.push(x.id); x.sold = true; }
    else if (x.kind === 'relic') { gainRelic(x.id); x.sold = true; }
    else { run.hp = Math.min(run.max, run.hp + A.MEND_AMOUNT); }
    run.chips -= x.price;
    drawTavern();
  }
  function gainRelic(id) {
    run.relics.push(id);
    if (id === 'cracked') { run.max = Math.max(1, run.max - 5); run.hp = Math.min(run.hp, run.max); }
  }

  // ---------- Rest ----------
  function showRest() {
    phase = 'screen';
    const n = Math.min(run.max - run.hp, Math.ceil(run.max * A.REST_SHARE));
    run.hp += n;
    screen(`<h2>Rest</h2><p>You sit in the corner of the tray for a while. <b>+${n} pips.</b></p>${statusBlock()}<div class="row"><button type="button" class="btn big" data-act="leave">Move on</button></div>`);
  }

  // ---------- fights ----------
  const PKEY = 'p0', EKEY = (i) => 'e' + i;

  function startFight(id, type) {
    const def = A.ENEMIES[id];
    const relic = (r) => run.relics.includes(r);
    fight = {
      id, def, type, turn: 1, lead: false, outcome: null, sim: null, throws: null,
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
    def.dice.forEach((d, i) => A.tray.setDie(EKEY(i), d));
    readyDice();
    el.log.innerHTML = '';
    log(`<b>${esc(def.name)}</b> rolls into the tray.`);
    say(def.line);
    drawBars();
    toAim();
  }
  function buildPlayerDie() {
    A.tray.setDie(PKEY, run.die, { outline: A.PLAYER_OUTLINE, chalk: fight ? fight.st.p.chalk : [] });
  }
  function playerPhys() {
    const p = { ...A.PHYS };
    if (run.relics.includes('leadcore')) p.mass = 2;
    if (run.relics.includes('rubber')) p.bounce = 1.7;
    return p;
  }

  // Dice wait at their own edges between throws.
  function readyDice() {
    const { w, d } = A.tray.dims, n = fight.def.dice.length;
    fight.def.dice.forEach((_, i) => {
      const x = n === 1 ? 0 : (i - (n - 1) / 2) * 3.2;
      const keep = fight.outcome ? fight.outcome.dice[i + 1]?.face ?? 0 : 0;
      A.tray.restAt(EKEY(i), x, -d / 2 + 1.6, keep, 0.4 * i);
    });
    A.tray.restAt(PKEY, 0, d / 2 - 1.6, fight.outcome ? fight.outcome.dice[0].face : 0);
    void w;
  }

  function toAim() {
    phase = 'aim';
    fight.outcome = fight.outcome || null;
    clearLabels();
    el.after.className = 'after';
    hint(fight.lead ? 'Lead Shot loaded. Drag from your edge of the tray to throw.' : 'Drag from your edge of the tray to throw. Longer drag, harder throw.');
    drawBars();
  }

  // Launch points are kept inside your strip of the tray (the near edge); enemies throw from the far edge.
  function clampStart(p) {
    const { w, d } = A.tray.dims;
    return { x: Math.max(-w / 2 + 1.3, Math.min(w / 2 - 1.3, p.x)), z: Math.max(d / 2 - d * 0.28, Math.min(d / 2 - 1.3, p.z)) };
  }

  function onDown(e) {
    if (phase !== 'aim' || e.button > 0) return;
    const p = A.tray.tableAt(e.clientX, e.clientY); if (!p) return;
    aiming = { start: clampStart(p), dx: 0, dz: 0, power: 0, id: e.pointerId };
    el.trayWrap.setPointerCapture?.(e.pointerId);
    A.tray.showAim(aiming.start.x, aiming.start.z, 0, 0, 0);
    e.preventDefault();
  }
  function onMove(e) {
    if (!aiming || e.pointerId !== aiming.id) return;
    const p = A.tray.tableAt(e.clientX, e.clientY); if (!p) return;
    const { w, d } = A.tray.dims;
    aiming.dx = p.x - aiming.start.x; aiming.dz = p.z - aiming.start.z;
    aiming.power = Math.min(1, Math.hypot(aiming.dx, aiming.dz) / (Math.min(w, d) * 0.72));
    A.tray.showAim(aiming.start.x, aiming.start.z, aiming.dx, aiming.dz, aiming.power);
    hint(aiming.power > 0.85 ? 'Full power.' : `Power ${Math.round(aiming.power * 100)}%`);
  }
  function onUp(e) {
    if (!aiming || e.pointerId !== aiming.id) return;
    const a = aiming; aiming = null;
    A.tray.hideAim();
    if (a.power < 0.06) { hint('Drag further to throw.'); return; }
    throwTurn(a);
  }

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
    hint(fight.def.previews > 1 ? `${fight.def.name} is thinking it over…` : '');
    await wait(30);
    const chosen = chooseThrow(a);
    fight.lead = false;
    fight.sim = chosen.sim; fight.throws = chosen.throws; fight.outcome = outcomeOf(chosen.sim);
    run.stats.turns++;
    phase = 'play';
    hint('');
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
        continue;
      }
      if (sim.status.some((s) => s === 'lean')) continue;
      good.push({ sim, throws, score: A.scoreForEnemy(fight.st, outcomeOf(sim)) });
    }
    return good.length ? good.reduce((b, x) => (x.score > b.score ? x : b)) : last;
  }

  function onClack(c) {
    const ref = (i) => (i === 0 ? { side: 'p', die: 0 } : { side: 'e', die: i - 1 });
    const from = ref(c.from), to = ref(c.to);
    if (from.side === to.side) return;
    const atk = fight.st[from.side], def = fight.st[to.side];
    let n = A.clackBase(c.v); if (!n) return;
    n = Math.max(0, n + (atk.clackDeal || 0) + (def.clackTake || 0)); if (!n) return;
    fight.shown[to.side] = Math.max(0, fight.shown[to.side] - n);
    float(keyOf(to), `CLACK −${n}`, 'clack');
    shake();
    drawBars();
  }
  const keyOf = (r) => (r.side === 'p' ? PKEY : EKEY(r.die));

  function onLand() {
    phase = 'landed';
    showFaceLabels();
    const ok = fight.outcome.dice[0].status === 'ok';
    const canNudge = ok && run.items.includes('nudge'), canTalc = run.items.includes('talc');
    if (canNudge || canTalc) {
      el.after.className = 'after show';
      el.after.innerHTML = `<span>Landed.</span>
        ${canNudge ? '<button type="button" class="btn" data-act="nudge">Nudge</button>' : ''}
        ${canTalc ? '<button type="button" class="btn" data-act="talc" title="Call off the throw. Everyone throws again.">Talc</button>' : ''}
        <button type="button" class="btn ghost" data-act="go">Go</button>`;
    } else setTimeout(resolveTurn, 650 * (A.timeScale ?? 1));
  }

  function showNudge() {
    const cur = fight.outcome.dice[0].face, nb = A.neighbours(run.die.sides, cur);
    el.after.innerHTML = `<span>Tip onto:</span>${nb.map((i) => `<button type="button" class="chip" data-nudge="${i}" title="${esc(A.faceLabel(run.die.faces[i]))}"><img alt="${esc(A.faceLabel(run.die.faces[i]))}" src="${A.faceChip(run.die.faces[i], run.die.look)}"></button>`).join('')}<button type="button" class="btn ghost" data-act="go">Keep it</button>`;
  }
  async function doNudge(i) {
    useItem('nudge');
    el.after.className = 'after';
    clearLabels();
    await A.tray.tip(PKEY, i);
    fight.outcome.dice[0].face = i;
    log(`You nudge onto <b>${esc(A.faceLabel(run.die.faces[i]))}</b>.`);
    showFaceLabels();
    setTimeout(resolveTurn, 450 * (A.timeScale ?? 1));
  }
  function doTalc() {
    useItem('talc');
    fight.shown = { p: fight.st.p.hp, e: fight.st.e.hp };
    log('Talc. The throw is called off.');
    fight.outcome = null;
    readyDice();
    toAim();
  }
  function useItem(id) { const k = run.items.indexOf(id); if (k >= 0) run.items.splice(k, 1); drawBars(); }

  async function resolveTurn() {
    if (phase !== 'landed') return;
    phase = 'resolve';
    el.after.className = 'after';
    const before = { p: fight.st.p.hp, e: fight.st.e.hp };
    const ev = A.resolve(fight.st, fight.outcome);
    fight.shown = { p: Math.max(0, fight.st.p.hp), e: Math.max(0, fight.st.e.hp) };
    run.stats.dealt += Math.max(0, before.e - fight.st.e.hp);
    run.stats.taken += Math.max(0, before.p - fight.st.p.hp);
    narrate(ev);
    drawBars();
    await wait(1100);
    if (fight.st.e.hp <= 0) return winFight();
    if (fight.st.p.hp <= 0) return loseFight();
    fight.turn++;
    readyDice();
    toAim();
  }

  // What happened, as floating numbers on the dice and lines in the log.
  function narrate(ev) {
    const name = (side) => (side === 'p' ? 'You' : fight.def.name);
    const dieName = (r) => (r.side === 'p' ? 'you' : fight.def.dice[r.die].name || fight.def.name);
    ev.forEach((e) => {
      if (e.k === 'clack') { if (e.from.side === 'p') run.stats.clacks++; log(`Clack! ${cap(dieName(e.from))} ${e.from.side === 'p' ? 'hit' : 'hits'} ${dieName(e.to)} for <b>${e.n}</b>.`); }
      else if (e.k === 'pinned') log(`${cap(dieName(e.at))} ${e.at.side === 'p' ? 'are' : 'is'} <b>Pinned</b>.`);
      else if (e.k === 'face' && e.face.t !== 'smooth') log(`${cap(dieName(e.at))}: <b>${esc(A.faceLabel(e.face))}</b>${e.times > 1 ? ' ×2 (chalk)' : ''}${e.face.charged ? ' (charged)' : ''}${e.pinBonus ? ` (+${e.pinBonus} pin)` : ''}.`);
      else if (e.k === 'dmg' && e.why !== 'clack') float(e.side === 'p' ? PKEY : EKEY(0), `−${e.n}`, 'dmg');
      else if (e.k === 'heal' && e.n) { float(e.side === 'p' ? PKEY : EKEY(0), `+${e.n}`, 'heal'); if (e.why === 'snakeoil') log('Snake Oil: +2.'); }
      else if (e.k === 'blocked') log(`${name(e.side)} block${e.side === 'p' ? '' : 's'} <b>${e.n}</b>.`);
      else if (e.k === 'thorn') log(`Thorns: <b>${e.n}</b> back.`);
      else if (e.k === 'charge') log(`${name(e.side)} ${e.side === 'p' ? 'are' : 'is'} charged.`);
    });
  }
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  async function winFight() {
    phase = 'screen';
    say(fight.def.lose);
    run.hp = fight.st.p.hp;
    await wait(900);
    if (fight.type === 'boss') return endRun(true);
    const chips = fight.def.chips + Math.floor(Math.random() * 4);
    run.chips += chips;
    const lines = [`<b>+${chips} chips.</b>`];
    let relicChoice = '';
    if (fight.type === 'elite') {
      const opts = shuffle(Object.keys(A.RELICS).filter((r) => !run.relics.includes(r))).slice(0, 2);
      if (opts.length) relicChoice = `<h3>Take a relic</h3><div class="goods">${opts.map((r) => `<div class="good relic"><div><b>${esc(A.RELICS[r].name)}</b><small>${esc(A.RELICS[r].text)}</small></div><button type="button" class="btn" data-relic="${r}">Take</button></div>`).join('')}</div>`;
    } else if (Math.random() < 0.5) {
      const id = pick(Object.keys(A.CONSUMABLES));
      if (run.items.length < A.MAX_CONSUMABLES) { run.items.push(id); lines.push(`Found <b>${esc(itemInfo(id).name)}</b>.`); }
      else lines.push(`Found ${esc(itemInfo(id).name)}, but your bag is full.`);
    }
    A.tray.clearDice();
    clearLabels();
    const name = fight.def.name;
    fight = null; drawBars(); el.log.innerHTML = '';
    screen(`<h2>${esc(name)} is out.</h2><p>${lines.join(' ')}</p>${relicChoice}${statusBlock()}<div class="row"><button type="button" class="btn big" data-act="leave">Move on</button></div>`);
  }

  async function loseFight() {
    phase = 'screen';
    say(fight.def.win);
    await wait(1200);
    endRun(false);
  }

  function endRun(won) {
    A.tray.clearDice(); clearLabels();
    const s = run.stats;
    screen(`
      <h2>${won ? 'The House is out.' : `${esc(fight.def.name)} wins.`}</h2>
      <p class="lead">${won ? 'You cleared the Green Felt.' : `Knocked out at stop ${run.step + 1} of ${run.map.length}.`}</p>
      <h3>Your die</h3>${dieNet(run.die)}
      <div class="inv">${relicTags()}</div>
      <div class="status"><div><span class="k">Fights</span> <b>${s.fights}</b></div><div><span class="k">Throws</span> <b>${s.turns}</b></div><div><span class="k">Clacks landed</span> <b>${s.clacks}</b></div><div><span class="k">Damage dealt</span> <b>${s.dealt}</b></div></div>
      <div class="row"><button type="button" class="btn big" data-act="start">New run</button><button type="button" class="btn ghost" data-act="title">Title</button></div>`, won ? 'won' : 'lost');
    run = null; fight = null; drawBars(); el.log.innerHTML = '';
  }

  // ---------- panels ----------
  function drawBars() {
    if (!fight) { el.enemy.innerHTML = ''; el.player.innerHTML = ''; return; }
    const st = fight.st, def = fight.def;
    const bar = (hp, max) => `<div class="hp"><span style="width:${Math.max(0, hp) / max * 100}%"></span><em>${Math.max(0, hp)} / ${max}</em></div>`;
    el.enemy.innerHTML = `
      <div class="who"><b>${esc(def.name)}</b>${def.boss ? '<span class="tag">Boss</span>' : def.elite ? '<span class="tag">Elite</span>' : ''}${st.e.charged ? '<span class="tag hot">Charged</span>' : ''}
        ${def.previews > 1 ? `<span class="tag dim" title="Tries ${def.previews} throws in secret against yours and keeps the best">Previews ×${def.previews}</span>` : ''}</div>
      ${bar(fight.shown.e, st.e.max)}
      <div class="nets">${def.dice.map((d) => `<div class="mini">${d.name ? `<small>${esc(d.name)}</small>` : ''}${dieNet(d)}</div>`).join('')}</div>`;
    const before = run.items.map((id, k) => {
      const it = itemInfo(id), usable = (it.when === 'before' && phase === 'aim' && !(id === 'lead' && fight.lead));
      return `<button type="button" class="item-btn${usable ? '' : ' off'}" data-item="${k}" title="${esc(it.name + ': ' + it.text)}"><b>${esc(it.name)}</b><small>${it.when === 'before' ? 'before a throw' : 'after landing'}</small></button>`;
    }).join('');
    el.player.innerHTML = `
      <div class="who"><b>${esc(A.PLAYER_START.name)}</b><span class="tag dim">d${run.die.sides}</span>${st.p.charged ? '<span class="tag hot">Charged</span>' : ''}${fight.lead ? '<span class="tag hot">Lead Shot</span>' : ''}<span class="chips">${run.chips} chips</span></div>
      ${bar(fight.shown.p, st.p.max)}
      <div class="pnet">${dieNet(run.die, { chalk: st.p.chalk })}<div class="items">${before}${relicTags()}</div></div>`;
  }

  function hint(s) { el.hint.textContent = s; el.hint.style.display = s ? '' : 'none'; }
  function log(html) {
    const p = document.createElement('p'); p.innerHTML = html; el.log.append(p);
    while (el.log.children.length > 6) el.log.firstChild.remove();
  }
  function say(line) {
    if (!line) return;
    el.say.textContent = '“' + line + '”'; el.say.className = 'say show';
    clearTimeout(say.t); say.t = setTimeout(() => (el.say.className = 'say'), 2600);
  }
  function shake() { el.trayWrap.classList.remove('shake'); void el.trayWrap.offsetWidth; el.trayWrap.classList.add('shake'); }

  // Floating text on a die.
  function float(key, text, cls) {
    const p = A.tray.screenOf(key, 1.2); if (!p) return;
    const d = document.createElement('div'); d.className = 'float ' + cls; d.textContent = text;
    d.style.left = p.x + 'px'; d.style.top = p.y + 'px';
    el.labels.append(d); setTimeout(() => d.remove(), 1300);
  }
  // A label over each landed die saying what it rolled.
  let labels = [];
  function showFaceLabels() {
    clearLabels();
    fight.outcome.dice.forEach((d) => {
      const key = keyOf(d), dieDef = fight.st[d.side].dice[d.die];
      const f = A.effFace(fight.st, d.side, d.die, d.face);
      const div = document.createElement('div');
      div.className = 'face-label ' + (d.side === 'p' ? 'mine' : 'theirs') + (d.status === 'pinned' ? ' pinned' : '');
      div.innerHTML = d.status === 'pinned' ? 'PINNED' : `<img alt="" src="${A.faceChip(f, dieDef.look, 28)}">${esc(A.faceLabel(f))}`;
      el.labels.append(div);
      labels.push({ key, div });
    });
  }
  function clearLabels() { labels.forEach((l) => l.div.remove()); labels = []; }
  function placeLabels(now) {
    labels.forEach((l) => { const p = A.tray.screenOf(l.key, 1.5); if (p) { l.div.style.left = p.x + 'px'; l.div.style.top = p.y + 'px'; } });
    if (phase === 'aim' && aiming) A.tray.hover(PKEY, aiming.start.x, aiming.start.z, now / 1000);
  }

  // ---------- items during a fight ----------
  function useBefore(k) {
    const id = run.items[k]; if (!id || phase !== 'aim') return;
    if (id === 'lead') { if (fight.lead) return; useItem('lead'); fight.lead = true; log('Lead Shot loaded.'); toAim(); }
    else if (id === 'chalk') {
      phase = 'screen';
      screen(`<h2>Chalk a face</h2><p>If it comes up this fight, it triggers twice.</p>${dieNet(run.die, { pickable: true, chalk: fight.st.p.chalk, only: (f, i) => !fight.st.p.chalk.includes(i) })}<div class="row"><button type="button" class="btn ghost" data-act="back-fight">Cancel</button></div>`);
      el.overlay.onPick = (i) => {
        if (fight.st.p.chalk.includes(i)) return;
        useItem('chalk'); fight.st.p.chalk.push(i);
        closeScreen(); buildPlayerDie(); readyDice();
        log(`Chalked <b>${esc(A.faceLabel(run.die.faces[i]))}</b>.`);
        toAim();
      };
    }
  }

  // ---------- wiring ----------
  function onClick(e) {
    const b = e.target.closest('button'); if (!b) return;
    const act = b.dataset.act;
    if (act === 'start') { A.unlockAudio?.(); newRun(); return; }
    if (act === 'title') { showTitle(); return; }
    if (act === 'leave') { nextStep(); return; }
    if (b.dataset.node != null && phase === 'map') { enterNode(+b.dataset.node); return; }
    if (b.dataset.buy != null) { buy(+b.dataset.buy); return; }
    if (b.dataset.relic) { gainRelic(b.dataset.relic); b.closest('.goods').innerHTML = `<p>Took <b>${esc(A.RELICS[b.dataset.relic].name)}</b>.</p>`; return; }
    if (b.dataset.stamp != null) {
      const f = JSON.parse(el.overlay.dataset.stamps)[+b.dataset.stamp];
      pickFace(`Engrave ${A.faceLabel(f)} on…`, null, (i) => { run.die.faces[i] = f; nextStep(); });
      return;
    }
    if (act === 'sand') { pickFace('Sand off which Skull?', (f) => f.t === 'skull', (i) => { run.die.faces[i] = A.F('smooth'); nextStep(); }); return; }
    if (act === 'grow') { run.die.sides = 6; run.die.faces.push(A.F('smooth'), A.F('smooth')); nextStep(); return; }
    if (act === 'back-forge') { showForge(); return; }
    if (act === 'back-fight') { closeScreen(); toAim(); return; }
    if (b.dataset.face != null && el.overlay.onPick && b.closest('.pickable')) { const fn = el.overlay.onPick; fn(+b.dataset.face); if (!el.overlay.classList.contains('show')) el.overlay.onPick = null; return; }
    if (act === 'nudge' && phase === 'landed') { showNudge(); return; }
    if (b.dataset.nudge != null && phase === 'landed') { doNudge(+b.dataset.nudge); return; }
    if (act === 'talc' && phase === 'landed') { doTalc(); return; }
    if (act === 'go' && phase === 'landed') { resolveTurn(); return; }
    if (b.dataset.item != null && fight) { useBefore(+b.dataset.item); return; }
    if (act === 'mute') { A.muted = !A.muted; b.classList.toggle('on', A.muted); b.textContent = A.muted ? 'Sound off' : 'Sound on'; try { localStorage.setItem('clackArena.muted', A.muted ? '1' : ''); } catch { /* storage off */ } }
  }

  function boot() {
    Object.assign(el, {
      overlay: $('#overlay'), enemy: $('#enemy-bar'), player: $('#player-bar'), trayWrap: $('#tray-wrap'), labels: $('#labels'),
      hint: $('#hint'), log: $('#log'), after: $('#after'), say: $('#say'),
    });
    try { A.muted = localStorage.getItem('clackArena.muted') === '1'; } catch { A.muted = false; }
    const mute = $('[data-act="mute"]'); mute.classList.toggle('on', A.muted); mute.textContent = A.muted ? 'Sound off' : 'Sound on';
    if (!window.THREE || !window.CANNON || !window.RP?.dieShape) { el.overlay.className = 'overlay show'; el.overlay.innerHTML = '<div class="sheet"><h2>Couldn\'t load the dice.</h2><p>The 3D engine didn\'t load. Check your connection and reload.</p></div>'; return; }
    try { A.tray.init(el.trayWrap); } catch (err) { console.error(err); el.overlay.className = 'overlay show'; el.overlay.innerHTML = '<div class="sheet"><h2>No 3D here.</h2><p>This browser can\'t draw WebGL, which the tray needs.</p></div>'; return; }
    A.tray.onFrame = placeLabels;
    document.addEventListener('click', onClick);
    el.trayWrap.addEventListener('pointerdown', onDown);
    el.trayWrap.addEventListener('pointermove', onMove);
    el.trayWrap.addEventListener('pointerup', onUp);
    el.trayWrap.addEventListener('pointercancel', () => { aiming = null; A.tray.hideAim(); });
    showTitle();
  }

  // For checks from dev tools.
  A.debug = { get run() { return run; }, get fight() { return fight; }, get phase() { return phase; }, throwTurn, chooseThrow, outcomeOf, newRun, startFight, showMap };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
