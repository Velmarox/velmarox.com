// Clack Attack: the shell around the Warrior Codex's dice. The tray fills the left of the window; the roll bar and the
// log sit beside it; "Dice look" slides the Codex's dice settings over them. Nothing else of the Codex is here.
(() => {
  const { h } = RP;
  const s = RP.settings;

  /* there is no table to join: the dice code asks these once or twice and gets "nobody" */
  RP.sync = { connected: false, seat: '', setLive() {} };
  RP.dicePop = { alive: () => false };

  /* ---------- the window ---------- */
  const brand = h('span.brand', { text: 'Clack Attack' });
  const themeSel = h('select', { 'aria-label': 'Tray theme', title: 'The tray under the dice' });
  const presetSel = h('select', { 'aria-label': 'Dice look preset', title: 'Switch between saved dice looks' });
  const lookBtn = h('button', { type: 'button', text: 'Dice look', title: 'Colours, skins, face icons, presets, throw feel', onclick: () => RP.openDiceLook() });
  const pinBtn = h('button', { type: 'button', text: 'Keep on top', 'aria-pressed': 'false', title: 'Keep this window above the others', hidden: true });
  const updBtn = h('button.update-bang', { type: 'button', text: '!', hidden: true, 'aria-label': 'Update ready' });
  const top = h('header.top', null, brand, h('span.grow'), presetSel, themeSel, lookBtn, pinBtn, updBtn);

  const idle = h('div.idle', null, h('div', null, h('p.big', { text: 'Your rolls land here.' }), h('p', { text: 'Type what to roll on the right, or press a dice button.' }), h('p', { text: 'Esc tucks the dice away.' })));
  const trayArea = h('section.tray-area', null, idle);

  /* ---------- the roll bar ---------- */
  /* v1.6.0: the words before what a roll is for ("Rolling to hit"). Yours to choose (Roll menu); the same words
     show in the result box, in the log and on the OBS overlay. '' = your words alone. */
  let phrase = RP.store.get('rollPhrase', 'Rolling to');
  if (typeof phrase !== 'string') phrase = 'Rolling to';
  const sayWhat = what => (phrase ? `${phrase} ${what}` : what);
  const labelHint = () => `${phrase || 'What it\'s for'}… (optional)`;
  const labelIn = h('input.field', { type: 'text', placeholder: labelHint(), value: RP.store.get('rollLabel', '') });
  const exprIn = h('input.field.mono.expr', { type: 'text', placeholder: '1d20', value: RP.store.get('rollExpr', '1d20'), spellcheck: false, 'aria-label': 'Dice to roll' });
  const rollBtn = h('button.btn.primary', { type: 'button', text: 'Roll', onclick: () => doRoll() });
  const quick = h('div.quick-dice');
  let adv = '';
  const advBtns = [['dis', 'Dis'], ['', 'Normal'], ['adv', 'Adv']].map(([v, t]) =>
    h('button.seg-btn' + (v === adv ? '.on' : ''), { 'data-v': v, type: 'button', text: t, title: v ? `Roll 2d20, keep the ${v === 'adv' ? 'higher' : 'lower'}` : 'Normal roll',
      onclick: () => { adv = v; advBtns.forEach(b => b.classList.toggle('on', b.dataset.v === v)); } }));
  let rollMode = RP.store.get('rollMode', 'sum') === 'list' ? 'list' : 'sum';
  const modeBtns = [['sum', 'Sum', 'Add all the dice into one total'], ['list', 'List', 'Each die on its own (several separate rolls)']].map(([v, t, tip]) =>
    h('button.seg-btn' + (v === rollMode ? '.on' : ''), { 'data-m': v, type: 'button', text: t, title: tip,
      onclick: () => { rollMode = v; RP.store.set('rollMode', v); modeBtns.forEach(b => b.classList.toggle('on', b.dataset.m === v)); } }));
  const result = h('div.result.muted', { text: 'No rolls yet.' });
  const roller = h('div.roller', null,
    h('div.row', null, labelIn),
    h('div.row', null, exprIn, rollBtn),
    quick,
    h('div.row.wrap', null, h('div.seg', null, advBtns), h('div.seg', null, modeBtns)),
    result);

  /* ---------- the log ---------- */
  const list = h('div.log-list');
  const empty = h('div.log-empty.muted', { text: 'Every roll is kept here.' });
  const scroller = h('div.log-scroll', null, empty, list);
  const copyBtn = h('button.btn.small', { type: 'button', text: 'Copy', title: 'Copy the whole log as plain text', onclick: copyLog });
  const clearBtn = h('button.btn.small.danger', { type: 'button', text: 'Clear', title: 'Clear the log', onclick: clearLog });
  const logbox = h('div.logbox', null, h('div.loghead', null, h('b', { text: 'Roll log' }), copyBtn, clearBtn), h('div.log', null, scroller));
  const side = h('aside.side', null, roller, logbox);

  document.body.append(top, h('main.stage', null, trayArea, side));

  /* ---------- rolling ---------- */
  function renderQuick() {
    quick.replaceChildren(...s.quickDice.filter(Boolean).map(d =>
      h('button.btn.small.mono', { type: 'button', text: d, title: `Roll ${d} (Shift-click to just fill it in)`, onclick: e => { exprIn.value = d; saveInputs(); if (!e.shiftKey) doRoll(); } })));
  }
  function saveInputs() { RP.store.set('rollExpr', exprIn.value); RP.store.set('rollLabel', labelIn.value); }

  /* the "Your rolls land here" hint steps aside whenever dice are out (a roll, or a Test throw in Dice look) */
  let calmTimer = 0;
  const throwIt = RP.diceTray.throw;
  RP.diceTray.throw = (...a) => {
    const ok = throwIt(...a);
    if (ok) { trayArea.classList.add('rolling'); clearTimeout(calmTimer); calmTimer = setTimeout(() => trayArea.classList.remove('rolling'), ((s.diceLinger || 2.5) + 4) * 1000); }
    return ok;
  };
  function doRoll() {
    saveInputs();
    let expr = exprIn.value.trim() || '1d20';
    if (adv) expr = expr.replace(/(^|[+-])\s*1?d20(?![\dkd!])/i, (m, sign) => `${sign}2d20${adv === 'adv' ? 'kh1' : 'kl1'}`);
    if (!RP.validDice(expr)) { exprIn.classList.add('bad'); RP.toast(`"${expr}" isn't dice notation Clack Attack can read.`); return; }
    exprIn.classList.remove('bad');
    let r;
    try { r = RP.roll({ expr }); } catch (e) { RP.toast(e.message); return; }
    const what = labelIn.value.trim(), label = what || expr;   // v1.6.0: what you said it's for reads "Rolling to …" wherever the roll shows
    result.className = 'result muted'; result.replaceChildren(h('span.detail', { text: 'Rolling…' }));
    let shown = false;
    const show = () => {
      if (shown) return; shown = true;
      result.className = 'result' + (r.crit && s.critHighlight ? ' crit-' + r.crit : '');
      result.replaceChildren(h('span.total', { text: r.total }), h('span.detail', null, what ? h('span.what', { text: sayWhat(what), 'data-what': what }) : '', h('span', { html: RP.renderMarkdown(r.detail) })));
      addEntry({ id: RP.uid(), ts: Date.now(), label, what, expr, detail: r.detail, total: r.total, crit: s.critHighlight ? r.crit : null });
    };
    const key = RP.uid();
    RP.diceTray.hold?.(key);
    const overlay = { total: r.total, detail: RP.stripMarkdown(r.detail).replace(/~~/g, ''), crit: r.crit || null, what };   // v1.5.0: what the OBS overlay's total tile says
    if (!RP.diceTray.throw(r.dice, { style: RP.myDiceStyle(), key, onLand: show, overlay })) { RP.diceTray.release?.(key); show(); }
    else setTimeout(show, 12000);   // whatever happens to the dice, the line is written in the end
  }

  /* ---------- log lines ---------- */
  const KEEP = 300;
  let entries = RP.store.get('clackLog', []).filter(e => e && e.id);
  const clock = ts => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  function buildRow(e) {
    const cls = ['entry', 'k-roll']; if (e.crit) cls.push('crit-' + e.crit);
    const body = `<span class="die">&#x2684;</span> ${e.what && phrase ? RP.renderMarkdown(phrase) + ' ' : ''}<strong>${RP.renderMarkdown(e.label)}</strong>: ${RP.renderMarkdown(e.detail)} = <strong>${e.total}</strong>`;
    return h('div.' + cls.join('.'), { title: new Date(e.ts).toLocaleString(), 'data-id': e.id },
      h('div.entry-body', { html: body }), h('span.when', { text: clock(e.ts) }),
      h('span.entry-actions', null, h('button.icon-btn', { type: 'button', title: 'Roll this again', html: '&#x21BB;', onclick: () => { exprIn.value = e.expr; labelIn.value = e.label === e.expr ? '' : e.label; doRoll(); } }),
        h('button.icon-btn', { type: 'button', title: 'Take this line out', html: '&#x2715;', onclick: () => { entries = entries.filter(x => x.id !== e.id); persist(); draw(); } })));
  }
  function persist() { RP.store.set('clackLog', entries.slice(-KEEP)); }
  function draw() {
    empty.hidden = entries.length > 0;
    list.replaceChildren(...entries.slice(-KEEP).map(buildRow));
    scroller.scrollTop = scroller.scrollHeight;
  }
  function addEntry(e) { entries.push(e); if (entries.length > KEEP) entries = entries.slice(-KEEP); persist(); draw(); }
  function plain(e) { return `[${clock(e.ts)}] ${e.what && phrase ? phrase + ' ' : ''}${RP.stripMarkdown(e.label)}: ${RP.stripMarkdown(e.detail).replace(/~~/g, '')} = ${e.total}`; }
  function copyLog() {
    if (!entries.length) return RP.toast('Nothing to copy yet.');
    RP.copy(entries.map(plain).join('\n')).then(() => RP.toast('Log copied.'), () => RP.toast('Couldn\'t copy.'));
  }
  let cleared = null;
  function clearLog() {
    if (!entries.length) return;
    cleared = entries; entries = []; persist(); draw();
    RP.toast('Log cleared.', { label: 'Undo', run: () => { entries = cleared.concat(entries); persist(); draw(); } }, 8000);
  }

  /* ---------- the bar: tray theme, saved looks, keep on top ---------- */
  function fillThemes() {
    const themes = Object.entries(RP.TRAY_THEMES || {});
    themeSel.replaceChildren(h('option', { value: 'none', text: 'Plain tray' }), ...themes.map(([k, t]) => h('option', { value: k, text: String(t.name || k) })));
    themeSel.value = s.diceTheme || 'none';
  }
  themeSel.addEventListener('change', () => RP.set('diceTheme', themeSel.value));
  RP.on('setting:diceTheme', v => { themeSel.value = v || 'none'; });
  function fillPresets() {
    const P = RP.dicePresets, active = P.activeId();
    const opt = p => h('option', { value: p.id, text: p.name });
    presetSel.replaceChildren(
      h('option', { value: '', text: active ? 'Dice look…' : 'Custom look' }),
      P.mine().length ? h('optgroup', { label: 'My looks' }, P.mine().map(opt)) : '',
      h('optgroup', { label: 'Templates' }, P.templates().map(opt)));
    presetSel.value = active && P.all().some(p => p.id === active) ? active : '';
  }
  presetSel.addEventListener('change', async () => {
    const p = RP.dicePresets.all().find(x => x.id === presetSel.value);
    if (p) { await RP.dicePresets.apply(p); RP.toast(`Dice look: ${p.name}`); }
  });
  RP.on('presets:changed', fillPresets);
  RP.on('look:closed', () => lookBtn.classList.remove('on'));

  const nat = window.clackNative;
  if (nat && nat.setOnTop) {
    pinBtn.hidden = false;
    nat.getOnTop().then(v => pinBtn.setAttribute('aria-pressed', String(!!v))).catch(() => {});
    pinBtn.addEventListener('click', async () => { const v = await nat.setOnTop(pinBtn.getAttribute('aria-pressed') !== 'true'); pinBtn.setAttribute('aria-pressed', String(!!v)); });
  }

  /* v1.1.0: the update "!" shows (and blinks) once a newer release is downloaded; one click swaps the exe and reopens it */
  if (nat && nat.updateState) {
    const showUpd = st => {
      if (!st) return;
      if (st.current) brand.title = `Clack Attack ${st.current}`;
      updBtn.hidden = !(st.ready || st.installing);
      updBtn.classList.toggle('installing', !!st.installing);
      updBtn.title = st.installing ? 'Updating… Clack Attack will reopen in a moment.'
        : `Clack Attack ${st.version} is ready (you have ${st.current}). Click to update: it closes and reopens by itself.` + (st.notes ? `\n\n${st.notes}` : '');
    };
    nat.onUpdate(showUpd);
    nat.updateState().then(showUpd).catch(() => {});
    updBtn.addEventListener('click', () => { updBtn.classList.add('installing'); nat.installUpdate().then(showUpd).catch(() => updBtn.classList.remove('installing')); });
  }

  /* v1.5.0: the OBS overlay. The app serves a see-through page on this computer; OBS shows it as a Browser Source.
     Every throw goes to it (the tray says 'dice:thrown'): as a fixed spot of dice in one corner, or as a mirror of
     the tray, the very same throw played back with the tray's edges as its edges. v1.6.0: its settings are in the
     menu bar's OBS menu. */
  const ov = { on: false, mode: 'spot', corner: 'bl', stay: true, lock: false, size: 1, whatAt: 'bc', ...RP.store.get('clackOverlay', {}) };
  let obsStatus = { on: false, url: '', file: '', clients: 0, size: null, error: '', said: '' }, sentConfig = '';
  const obsConfig = () => JSON.stringify({ mode: ov.mode, corner: ov.corner, stay: ov.stay, size: ov.size, whatAt: ov.whatAt, phrase });
  const obsState = () => obsStatus.error || (obsStatus.said ? `The overlay says: ${obsStatus.said}` : obsStatus.clients ? `OBS is showing it${obsStatus.size ? ` (${obsStatus.size.w} by ${obsStatus.size.h})` : ''}` : 'Waiting for OBS to open it');
  const obsExtra = () => ({ side: side.getBoundingClientRect().width, top: top.getBoundingClientRect().height });
  const applyObs = async () => {
    RP.store.set('clackOverlay', ov);
    if (!nat || !nat.overlaySet) return;
    try { obsStatus = await nat.overlaySet({ on: ov.on, lock: ov.lock && ov.mode === 'mirror' }); } catch { obsStatus = { ...obsStatus, error: 'The overlay couldn\'t start.' }; }
    if (ov.on) { sentConfig = obsConfig(); nat.overlaySend('config', sentConfig); nat.overlayFit(obsExtra()); }
    refreshMenu();
  };
  if (nat && nat.overlaySet) {
    const SENT = ['diceScale', 'diceSpeed', 'diceShadows', 'diceHighlight', 'diceLinger', 'diceKeep'];   // the settings a throw is drawn with
    const round = (k, v) => (typeof v === 'number' ? Math.round(v * 1e5) / 1e5 : v);
    nat.onOverlay(st => {
      if (st.said && st.said !== obsStatus.said) RP.toast(`OBS overlay: ${st.said}`, null, 10000);   // OBS shows no errors of its own
      obsStatus = st; refreshMenu();
    });
    let fitTimer = 0;
    window.addEventListener('resize', () => { clearTimeout(fitTimer); fitTimer = setTimeout(() => { if (ov.on && ov.lock && ov.mode === 'mirror') nat.overlayFit(obsExtra()); }, 200); });
    RP.on('dice:thrown', t => {
      if (!ov.on || !obsStatus.clients) return;
      if (obsConfig() !== sentConfig) { sentConfig = obsConfig(); nat.overlaySend('config', sentConfig); }
      const style = { ...t.style };
      if (style.skin === 'custom' && !style.skinUrl) style.skinUrl = RP.store.get('diceSkinImage', '');   // your own skin picture goes along
      nat.overlaySend('roll', JSON.stringify({ list: t.list, style, replay: ov.mode === 'mirror' ? t.replay : null, lane: t.lane, info: t.info,
        set: Object.fromEntries(SENT.map(k => [k, s[k]])) }, round));
    });
    RP.on('dice:cleared', () => { if (ov.on && obsStatus.clients) nat.overlaySend('clear', '{}'); });
  }

  /* v1.6.0: the menu bar. Every setting lives there: the dice look and saved looks, the tray, the OBS overlay, the
     log, Keep on top. The page describes the menus (labels, ticks, what each one does) and the window draws them;
     a click comes back by its id. The bar's own buttons step aside once the menus are up. */
  const menuRuns = new Map();
  let menuTimer = 0, onTop = false;
  function menuModel() {
    menuRuns.clear();
    let n = 0;
    const item = (label, run, more = {}) => { const id = 'm' + (++n); menuRuns.set(id, run); return { id, label, ...more }; };
    const check = (label, on, run, more = {}) => item(label, run, { type: 'checkbox', checked: !!on, ...more });
    const pick = (label, on, run) => item(label, run, { type: 'checkbox', checked: !!on });   // one of several: a tick, redrawn after every click
    const sub = (label, items, more = {}) => ({ label, items, ...more }), sep = { sep: true };
    const P = RP.dicePresets, active = P.activeId(), lookOf = p => pick(p.name, p.id === active, async () => { await P.apply(p); RP.toast(`Dice look: ${p.name}`); });
    const setOv = (k, v) => () => { ov[k] = v; applyObs(); };
    const themes = Object.entries(RP.TRAY_THEMES || {});
    return [
      sub('Dice', [
        item('Dice look…', () => RP.openDiceLook(), { key: 'Ctrl+L' }),
        sep,
        ...(P.mine().length ? [sub('My looks', P.mine().map(lookOf))] : []),
        sub('Templates', P.templates().map(lookOf)),
      ]),
      sub('Tray', [pick('Plain tray', (s.diceTheme || 'none') === 'none', () => RP.set('diceTheme', 'none')),
        ...themes.map(([k, t]) => pick(String(t.name || k), s.diceTheme === k, () => RP.set('diceTheme', k)))]),
      sub('Roll', [
        sub('Before what it\'s for, say', [
          ...PHRASES.map(([v, t]) => pick(t, phrase === v, () => setPhrase(v))),
          pick(PHRASES.some(([v]) => v === phrase) ? 'Your own words…' : `Your own words: "${phrase}"…`, !PHRASES.some(([v]) => v === phrase), askPhrase),
        ]),
      ]),
      sub('Log', [item('Copy the log', copyLog), item('Clear the log', clearLog)]),
      sub('OBS', [
        check('Show rolls in OBS', ov.on, () => { ov.on = !ov.on; applyObs(); }),
        ...(ov.on ? [item(obsState(), () => {}, { enabled: false })] : []),
        item('Copy the overlay file\'s path', () => RP.copy(obsStatus.file || '').then(() => RP.toast('Copied. In OBS: Sources, +, Browser, tick Local file, and paste it.', null, 8000), () => RP.toast('Couldn\'t copy.')), { enabled: !!obsStatus.file }),
        sep,
        sub('Show as', [pick('Fixed spot', ov.mode === 'spot', setOv('mode', 'spot')), pick('Mirror the tray', ov.mode === 'mirror', setOv('mode', 'mirror'))]),
        sub('Dice stay', [pick('Until the next roll', ov.stay, setOv('stay', true)), pick('Fade as in the app', !ov.stay, setOv('stay', false))]),
        sub(ov.mode === 'mirror' ? 'Total box sits' : 'Corner', [['bl', 'Bottom left'], ['br', 'Bottom right'], ['tl', 'Top left'], ['tr', 'Top right']].map(([v, t]) => pick(t, ov.corner === v, setOv('corner', v)))),
        sub('"Rolling to" box sits', [['bc', 'Bottom centre'], ['tc', 'Top centre'], ['bl', 'Bottom left'], ['br', 'Bottom right'], ['tl', 'Top left'], ['tr', 'Top right'], ['off', 'Hidden']].map(([v, t]) => pick(t, (ov.whatAt || 'bc') === v, setOv('whatAt', v)))),
        sub('Box size', [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3].map(v => pick(Math.round(v * 100) + '%', Math.abs((+ov.size || 1) - v) < 0.01, setOv('size', v)))),
        check('Hold the tray to the overlay\'s shape', ov.lock, () => { ov.lock = !ov.lock; applyObs(); }, { enabled: ov.mode === 'mirror' }),
      ]),
      sub('Window', [check('Keep on top', onTop, async () => { onTop = !!(await nat.setOnTop(!onTop)); refreshMenu(); })]),
    ];
  }
  const PHRASES = [['Rolling to', '"Rolling to hit"'], ['Rolling for', '"Rolling for hit"'], ['Rolling', '"Rolling hit"'], ['', 'Just what you typed: "hit"']];
  function setPhrase(v) {
    phrase = String(v || '').trim().slice(0, 40);
    RP.store.set('rollPhrase', phrase);
    labelIn.placeholder = labelHint();
    result.querySelectorAll('.what').forEach(el => { if (el.dataset.what) el.textContent = sayWhat(el.dataset.what); });
    draw(); applyObs();
  }
  /** Your own words: a small box over the window to type them in. */
  function askPhrase() {
    const inp = h('input.field', { type: 'text', value: phrase, maxLength: 40, placeholder: 'Rolling to', 'aria-label': 'The words before what a roll is for' });
    const close = () => box.remove(), ok = () => { setPhrase(inp.value); close(); };
    const box = h('div.ask', { onpointerdown: e => { if (e.target === box) close(); } }, h('div.ask-card', null,
      h('b', { text: 'The words before what a roll is for' }),
      h('p.muted', { text: 'With "Rolling to" and "hit" typed in the roll bar, a roll reads "Rolling to hit". Leave it empty for your words alone.' }),
      inp,
      h('div.ask-row', null, h('button.btn', { type: 'button', text: 'Cancel', onclick: close }), h('button.btn.primary', { type: 'button', text: 'Use these words', onclick: ok }))));
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ok(); } else if (e.key === 'Escape') { e.stopPropagation(); close(); } });
    document.body.append(box); inp.focus(); inp.select();
  }
  function refreshMenu() {
    if (!nat || !nat.setMenu) return;
    clearTimeout(menuTimer);
    menuTimer = setTimeout(() => nat.setMenu(menuModel()), 30);
  }
  if (nat && nat.setMenu) {
    [presetSel, themeSel, lookBtn, pinBtn].forEach(el => { el.hidden = true; });
    nat.onMenu(id => { try { menuRuns.get(id)?.(); } catch (e) { console.error(e); } refreshMenu(); });
    nat.getOnTop().then(v => { onTop = !!v; refreshMenu(); }).catch(() => {});
    RP.on('presets:changed', refreshMenu);
    RP.on('setting:diceTheme', refreshMenu);
    refreshMenu();
  }
  applyObs();

  exprIn.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doRoll(); } });
  labelIn.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doRoll(); } });
  exprIn.addEventListener('input', () => { exprIn.classList.toggle('bad', !!exprIn.value.trim() && !RP.validDice(exprIn.value)); saveInputs(); });
  labelIn.addEventListener('input', saveInputs);
  RP.on('setting:quickDice', renderQuick);
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && !document.querySelector('.look-drawer')) RP.diceTray.clear?.(); });

  renderQuick(); fillThemes(); fillPresets(); draw();
  if (!window.THREE) RP.toast('The 3D dice could not start here, so rolls will show as numbers only.', null, 8000);
})();
