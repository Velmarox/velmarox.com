// Clack Attack: the "Dice look" panel. Taken from the Warrior Codex's Settings > Dice page (Table/Scripts/Settings.js),
// with the Codex-only parts (NPC dice, the table link, layout, the GM's desk) left out. The rows and what they change
// are the Codex's own: colours, finishes, skins, face icons, presets, tray themes, throw feel.
(() => {
  const { h } = RP;
  const s = RP.settings;
  // ---------- rows: a name and a note on the left, the control on the right ----------
  const row = (label, help, control, { wide = false, tag = 'div' } = {}) =>
    h(`${tag}.srow${wide ? '.wide' : ''}`, { 'data-find': `${label} ${help || ''}`.toLowerCase() },
      h('span.srow-l', null, h('span.srow-name', { text: label }), help && h('span.srow-note', { text: help })),
      control && h('span.srow-c', null, control));
  const field = (label, input, help) => row(label, help, input, { wide: input && /^(TEXTAREA|DIV)$/.test(input.tagName) && input.classList.contains('rp-wrap') });
  const slider = (label, key, min, max, step, fmt, help) => {
    const out = h('span.srow-val', { text: fmt(s[key]) });
    const inp = h('input', { type: 'range', min, max, step, value: s[key], 'aria-label': label });
    inp.addEventListener('input', () => { RP.set(key, parseFloat(inp.value)); out.textContent = fmt(s[key]); });
    return row(label, help, h('span.srow-range', null, inp, out));
  };
  const toggle = (label, key, help, onChange) => {
    const cb = h('input.sw', { type: 'checkbox', role: 'switch', checked: !!s[key], onchange: e => { RP.set(key, e.target.checked); onChange?.(e.target.checked); } });
    return row(label, help, cb, { tag: 'label' });
  };
  /** A switch for anything (not only a table setting): get() reads it, set(on) changes it. */
  const switchRow = (label, help, get, set) => {
    const cb = h('input.sw', { type: 'checkbox', role: 'switch', checked: !!get(), onchange: e => set(e.target.checked) });
    return row(label, help, cb, { tag: 'label' });
  };
  /** Side-by-side choices for a short list (up to five); a dropdown for longer ones. */
  const chips = (label, help, options, get, set) => {
    const short = options.length <= 6 && options.every(([, t]) => String(t).length <= 16);
    if (!short) {
      const sel = h('select.field.small', { 'aria-label': label }, options.map(([v, t]) => h('option', { value: v, text: t })));
      sel.value = String(get()); sel.addEventListener('change', () => set(options.find(([v]) => String(v) === sel.value)[0]));
      return row(label, help, sel);
    }
    const box = h('span.chips', { role: 'radiogroup', 'aria-label': label });
    const mark = () => box.querySelectorAll('.chip').forEach(b => { const on = b.dataset.v === String(get()); b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
    options.forEach(([v, t]) => box.append(h('button.chip', { type: 'button', role: 'radio', 'data-v': String(v), text: t, onclick: () => { set(v); mark(); } })));
    mark();
    return row(label, help, box);
  };
  const select = (label, key, options, help, onChange) => chips(label, help, options, () => s[key], v => { RP.set(key, v); onChange?.(v); });
  const section = (title, ...kids) => h('section.sgroup', null, h('h3', { text: title }), ...kids);
  const note = text => h('p.fld-help', { text });
  const pct = v => Math.round(v * 100) + '%';

  // Colour with an automatic option: modeKey holds autoValue or 'custom'.
  function colourChoice(label, modeKey, colourKey, autoValue, autoLabel, help) {
    const pick = h('input', { type: 'color', value: s[colourKey], disabled: s[modeKey] !== 'custom', 'aria-label': label });
    const mode = h('select.field.small', { 'aria-label': label + ': automatic or custom' }, h('option', { value: autoValue, text: autoLabel }), h('option', { value: 'custom', text: 'Custom' }));
    mode.value = s[modeKey];
    mode.addEventListener('change', () => { RP.set(modeKey, mode.value); pick.disabled = mode.value !== 'custom'; });
    pick.addEventListener('input', () => RP.set(colourKey, pick.value));
    return row(label, help, h('span.row', null, mode, pick));
  }

  /* v6.14.0: a plain colour row, and the mixed set's row per die type (its own colour and finish) */
  const colourRow = (label, key, help) => { const inp = h('input', { type: 'color', value: s[key] || '#ffffff', 'aria-label': label }); inp.addEventListener('input', () => RP.set(key, inp.value)); return row(label, help, inp); };
  function trayThemeGrid() {
    const grid = h('div.traygrid', { role: 'radiogroup', 'aria-label': 'Dice tray theme' });
    const opts = [['none', 'None (the table below)'], ...Object.entries(RP.TRAY_THEMES || {}).map(([k, v]) => [k, v.name])];
    const mark = () => grid.querySelectorAll('.traytile').forEach(b => { const on = b.dataset.v === (s.diceTheme || 'none'); b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
    opts.forEach(([v, name]) => {
      let pic = null;
      if (v !== 'none') { const c = RP.paintTrayTheme(v, 240, 160); pic = h('img', { src: c.toDataURL('image/jpeg', 0.85), alt: '' }); }
      else pic = h('span.traynone', { text: 'No tray' });
      grid.append(h('button.traytile', { type: 'button', role: 'radio', 'data-v': v, onclick: () => { RP.set('diceTheme', v); mark(); } }, pic, h('span.trayname', { text: name })));
    });
    mark();
    return h('div.srow.wide', { 'data-find': 'dice tray theme tavern cyberpunk druid pirate space vampire steampunk candy egyptian sci-fi eldritch celestial autumn retro arctic' }, grid);
  }
  function mixedRows() {
    const fins = Object.entries(RP.DICE_FINISHES || {}).map(([k, v]) => [k, v.label]);
    const put = (sides, patch) => { const m = JSON.parse(JSON.stringify(s.diceMixed || {})); m[sides] = Object.assign({ c: s.diceColor, f: s.diceFinish }, m[sides], patch); RP.set('diceMixed', m); };
    return [4, 6, 8, 10, 12, 20, 100].map(sides => {
      const cur = (s.diceMixed || {})[sides] || {};
      const col = h('input', { type: 'color', value: cur.c || s.diceColor || '#6157e8', 'aria-label': `d${sides} colour` });
      col.addEventListener('input', () => put(sides, { c: col.value }));
      const fin = h('select.field.small', { 'aria-label': `d${sides} finish` }, fins.map(([v, t]) => h('option', { value: v, text: t })));
      fin.value = cur.f || s.diceFinish || 'satin'; fin.addEventListener('change', () => put(sides, { f: fin.value }));
      return row(`d${sides}`, null, h('span.row', null, col, fin));
    });
  }

  /* v6.20.0: Icon faces: none, the highest, the lowest or both. Each gets its picker (one of ours or your own picture:
     Add custom trims and shrinks it to 160px so it uploads small and looks crisp on the die), and only the pickers for
     the faces chosen show. */
  function faceIconRows() {
    const hi = faceRow('Highest face icon', 'diceTopSymbol', 'star', 'In place of the 20 on a d20 (the 6 on a d6, and so on).');
    const lo = faceRow('Lowest face icon', 'diceLowSymbol', 'skull', 'In place of the 1.');
    const show = () => { const m = RP.faceMode(s); hi.hidden = !/high|both/.test(m); lo.hidden = !/low|both/.test(m); };
    const mode = chips('Icon faces', 'An icon in place of a number. Not on a d4 or a d100 pair.', [['none', 'None'], ['high', 'Highest'], ['low', 'Lowest'], ['both', 'Both']],
      () => RP.faceMode(s), (v) => {
        if (/high|both/.test(v) && (s.diceTopSymbol || 'none') === 'none') RP.set('diceTopSymbol', 'star');
        if (/low|both/.test(v) && (s.diceLowSymbol || 'none') === 'none') RP.set('diceLowSymbol', 'skull');
        RP.set('diceFaceIcons', v); show(); hi.refresh(); lo.refresh();
      });
    show();
    return [mode, hi, lo];
  }
  function faceRow(label, key, fallback, help) {
    const BUILT = RP.DICE_SYMBOLS || [['star', 'A star']];
    const file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml', hidden: true });
    const sel = h('select.field.small', { 'aria-label': label });
    const thumb = h('img.icon-thumb', { alt: '', width: 40, height: 40, style: 'width:40px;height:40px;object-fit:contain;border:1px solid rgba(128,128,128,.35);background:rgba(0,0,0,.15)' });
    const addBtn = h('button.btn.small', { type: 'button', text: 'Add custom…', title: 'PNG, JPG, WebP, GIF or SVG, up to 5 MB. Kept small: trimmed and fitted in 160px.', onclick: () => file.click() });
    const rmBtn = h('button.btn.small', { type: 'button', text: 'Remove', title: 'Remove this picture from your icons' });
    const fill = () => {
      const mine = RP.diceIcons.list();
      sel.replaceChildren(...BUILT.map(([v, t]) => h('option', { value: v, text: t })), ...(mine.length ? [h('optgroup', { label: 'My icons' }, mine.map((x) => h('option', { value: 'custom:' + x.id, text: x.name })))] : []));
      const cur = s[key] || fallback;
      sel.value = [...sel.options].some((o) => o.value === cur) ? cur : fallback;
      const icon = sel.value.startsWith('custom:') ? RP.diceIcons.get(sel.value.slice(7)) : null;
      thumb.hidden = !icon; if (icon) thumb.src = icon.src; rmBtn.hidden = !icon;
      addBtn.disabled = mine.length >= 8; addBtn.title = mine.length >= 8 ? 'You have 8 icons: remove one to add another.' : 'PNG, JPG, WebP, GIF or SVG, up to 5 MB. Kept small: trimmed and fitted in 160px.';
    };
    sel.addEventListener('change', () => { RP.set(key, sel.value); fill(); });
    rmBtn.addEventListener('click', () => {
      const id = sel.value.slice(7); RP.diceIcons.remove(id);
      ['diceTopSymbol', 'diceLowSymbol'].forEach((k) => { if (s[k] === 'custom:' + id) RP.set(k, k === 'diceTopSymbol' ? 'star' : 'skull'); });
      RP.emit('faceicons:changed'); RP.toast('Icon removed.');
    });
    file.addEventListener('change', async () => {
      const f = file.files[0]; file.value = ''; if (!f) return;
      try { const icon = await RP.diceIcons.add(f); RP.set(key, 'custom:' + icon.id); RP.emit('faceicons:changed'); RP.toast(`${icon.name} is on your ${key === 'diceLowSymbol' ? 'lowest' : 'highest'} face. Try a Test throw.`); }
      catch (e) { RP.toast(e.message || 'That picture didn\'t work.'); }
    });
    fill();
    RP.on('faceicons:changed', fill);   // the other picker's new or removed picture shows here too
    const r = field(label, h('div.row.wrap', null, sel, thumb, addBtn, rmBtn, file), help + ' Add custom: your own picture, trimmed and shrunk to 160px.');
    r.refresh = fill;
    return r;
  }

  // Skin picker: built-in skins, or your own picture (with a preview).
  function skinChooser() {
    const file = h('input', { type: 'file', accept: 'image/*', hidden: true });
    const thumb = h('div.skin-thumb');
    const sel = h('select.field.small', null, RP.skins.list().map(([v, t]) => h('option', { value: v, text: t })));
    const pickBtn = h('button.btn.small', { text: 'Choose image…', onclick: () => file.click() });
    const clearBtn = h('button.btn.small', { text: 'Remove', onclick: () => { RP.skins.clearCustom(); RP.set('diceSkin', 'none'); sel.value = 'none'; refresh(); } });
    const refresh = () => {
      const url = RP.skins.myCustomUrl();
      const custom = sel.value === 'custom';
      pickBtn.hidden = !custom; clearBtn.hidden = !custom || !url;
      const c = RP.skins.canvasFor({ skin: sel.value });
      thumb.style.backgroundImage = custom && url ? `url("${url}")` : c ? `url("${c.toDataURL('image/jpeg', 0.7)}")` : 'none';
      thumb.hidden = !(custom ? url : c);
    };
    sel.value = s.diceSkin;
    sel.addEventListener('change', () => {
      if (sel.value === 'custom' && !RP.skins.myCustomUrl()) { refresh(); file.click(); return; }
      RP.set('diceSkin', sel.value); refresh();
    });
    file.addEventListener('change', async () => {
      const f = file.files[0]; file.value = '';
      if (!f) return;
      try { await RP.skins.setCustomFromFile(f); RP.set('diceSkin', 'custom'); sel.value = 'custom'; refresh(); RP.toast('Custom skin set. Try a Test throw.'); }
      catch (e) { RP.toast(e.message); }
    });
    refresh();
    return field('Skin', h('div.row.wrap', null, sel, pickBtn, clearBtn, thumb, file),
      'An image under the numbers. Custom images are shrunk to 512px and shown to the table.');
  }

  function presetsSection() {
    const P = RP.dicePresets;
    const wrap = h('div.presets');
    const nameIn = h('input.field', { type: 'text', placeholder: 'Name this look, e.g. "Mira\'s lucky set"' });
    const saveBtn = h('button.btn.primary.small', { text: 'Save current look', onclick: () => {
      const p = P.saveCurrent(nameIn.value || 'My dice');
      nameIn.value = '';
      RP.toast(`Saved "${p.name}"`);
    } });
    nameIn.addEventListener('keydown', e => { if (e.key === 'Enter') saveBtn.click(); });
    const importIn = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
    importIn.addEventListener('change', async () => {
      const f = importIn.files[0]; importIn.value = '';
      if (!f) return;
      try { RP.toast(`Imported ${await P.importFile(f)} preset(s)`); } catch (e) { RP.toast('Import failed: ' + e.message); }
    });

    const card = (p, mine) => {
      const img = h('img.die-portrait.big', { alt: '' });
      RP.diePortrait(img, P.styleOf(p));
      const title = h('div.preset-name', { text: p.name, title: p.name });
      const buttons = h('div.preset-btns', null,
        h('button.btn.small.primary', { text: 'Apply', onclick: async () => { await P.apply(p); RP.toast(`Dice look: ${p.name}`); } }));
      if (mine) {
        buttons.append(
          h('button.icon-btn', { title: 'Save the current look into this preset', html: '&#x21E9;', onclick: () => { P.update(p.id); RP.toast(`Updated "${p.name}"`); } }),
          h('button.icon-btn', { title: 'Rename', html: '&#x270E;', onclick: () => {
            const inp = h('input.field.small', { type: 'text', value: p.name });
            title.replaceChildren(inp); inp.focus(); inp.select();
            const done = () => P.rename(p.id, inp.value);
            inp.addEventListener('keydown', e => { if (e.key === 'Enter') done(); if (e.key === 'Escape') render(); });
            inp.addEventListener('blur', done);
          } }),
          h('button.icon-btn', { title: 'Delete', html: '&#x2715;', onclick: () => {
            const r = P.remove(p.id);
            if (r) RP.toast(`Deleted "${p.name}"`, { label: 'Undo', run: r.restore }, 8000);
          } }));
      } else {
        buttons.append(h('button.icon-btn', { title: 'Copy into my presets (to tweak and keep)', html: '&#x2398;', onclick: () => { P.copy(p); RP.toast(`Copied "${p.name}" to your presets`); } }));
      }
      return h('div.preset-card' + (P.activeId() === p.id ? '.on' : ''), null, img, title, buttons);
    };

    function render() {
      const mine = P.mine();
      wrap.replaceChildren(
        h('div.row', null, nameIn, saveBtn),
        h('span.fld-label', { text: 'My presets' }),
        mine.length ? h('div.preset-grid', null, mine.map(p => card(p, true)))
          : h('p.fld-help', { text: 'Nothing saved yet. Set up a look below (or apply a template), then save it here.' }),
        h('span.fld-label', { text: 'Templates' }),
        h('div.preset-grid', null, P.templates().map(p => card(p, false))),
        h('div.row.wrap', null,
          h('button.btn.small', { text: 'Export my presets', onclick: () => P.exportFile(), disabled: !mine.length }),
          h('button.btn.small', { text: 'Import presets', onclick: () => importIn.click() }),
          importIn,
          h('span.fld-help', { text: 'Export makes a file you can send to someone at the table.' })));
    }
    render();
    // Keep the cards current while the settings window is open. The
    // listeners are added once; each build of the tab just swaps the target.
    refreshPresets = () => { if (wrap.isConnected) render(); };
    if (!presetsHooked) {
      presetsHooked = true;
      RP.on('presets:changed', () => refreshPresets?.());
      RP.on('portraits:stale', () => refreshPresets?.());
    }
    return section('Presets', wrap);
  }

  let refreshPresets = null, presetsHooked = false;

  /* v6.20.0: Max roll / Min roll: the test set lands every die on its highest (or lowest) face, to see its icon */
  let maxRoll = false, minRoll = false;
  function testThrow() {
    const dice = [4, 6, 8, 10, 12, 20, 100].map(sd => ({ sides: sd, value: maxRoll ? sd : minRoll ? 1 : 1 + Math.floor(Math.random() * sd), kept: true }));
    if (!RP.diceTray.throw(dice)) RP.toast('3D dice are switched off (On / off, above) or unavailable.');
  }

  // ---------- the page ----------
  function page() {
      const finishes = Object.entries(RP.DICE_FINISHES || {}).map(([k, v]) => [k, v.label]);
      const fonts = Object.entries(RP.DICE_FONTS || {}).map(([k, v]) => [k, v.label]);
      const quick = h('input.field.mono', { type: 'text', value: s.quickDice.join(', '), spellcheck: false, 'aria-label': 'Quick dice buttons' });
      quick.addEventListener('change', () => RP.set('quickDice', quick.value.split(',').map(x => x.trim()).filter(x => x && RP.validDice(x))));
      return [
        h('div.row.test-row', null,
          h('button.btn.primary.small', { text: 'Test throw', onclick: testThrow }),
          h('label.switch', { title: 'Every die in the test set lands on its highest face: see your icon, and the flare on a 20' },
            h('input.sw', { type: 'checkbox', role: 'switch', checked: maxRoll, onchange: e => { maxRoll = e.target.checked; if (maxRoll) { minRoll = false; const o = e.target.closest('.test-row')?.querySelector('[data-min]'); if (o) o.checked = false; } } }), ' Max roll'),
          h('label.switch', { title: 'Every die in the test set lands on its lowest face: see your low icon' },
            h('input.sw', { type: 'checkbox', role: 'switch', 'data-min': '1', checked: minRoll, onchange: e => { minRoll = e.target.checked; if (minRoll) { maxRoll = false; const o = e.target.closest('.test-row')?.querySelector('input:not([data-min])'); if (o) o.checked = false; } } }), ' Min roll'),
          h('span.fld-help', { text: RP.calm() ? 'Reduce motion is on (Display), so the 3D dice stay still.' : 'Change anything below, then throw a test set. Esc clears the dice.' })),
        section('Quick dice',
          row('Quick dice buttons', 'Comma separated. Any notation: 1d6, 2d6, 4d6kh3, 1d8+2.', quick),
          toggle('Highlight a natural 20 or 1', 'critHighlight', 'Only when exactly one d20 is rolled.')),
        section('3D dice: on or off',
          toggle('Throw 3D dice across the tray', 'dice3d', 'd4 to d20 and d100. The result shows once they land.')),
        presetsSection(),
        section('Dice set',
          select('d100 rolls use', 'd100Style', [['pair', 'A pair'], ['sphere', 'The Sphere']], 'A pair is a tens die and a d10. The Sphere is one die with 100 faces; the face pointing up is the result.'),
          toggle('Frame the result face on d100 dice', 'diceHighlight', 'A bright border round the face that counts.')),
        section('Look',
          colourChoice('Dice colour', 'diceColorMode', 'diceColor', 'theme', 'Your colour'),
          colourChoice('Number colour', 'diceNumberMode', 'diceNumberColor', 'auto', 'Automatic', 'Automatic picks white or dark, whichever reads better.'),
          select('Finish', 'diceFinish', finishes, 'Glass is see-through with solid numbers.'),
          skinChooser(),
          slider('Skin tint', 'diceSkinTint', 0, 1, 0.05, pct),
          select('Number font', 'diceFont', fonts),
          toggle('Multicolour set', 'diceMulticolor', 'Each die type gets its own colour, starting from yours.'),
          toggle('Edge outlines', 'diceOutline'),
          toggle('Shadows', 'diceShadows')),
        /* v6.14.0: the dice update */
        section('Material',
          colourRow('Second colour', 'diceColor2', 'For the Two-tone swirl skin and the Smoke glass finish (the smoke).'),
          slider('Weathered', 'diceWear', 0, 1, 0.05, v => (v ? pct(v) : 'new'), 'Chipped edges, grime and worn paint in the numbers, like old bone or river stone.')),
        section('Numbers',
          select('Numbers are', 'diceNumberStyle', [['print', 'Printed'], ['engraved', 'Engraved and inked']], 'Engraved numbers are cut in and filled with the number colour: try gold or silver.'),
          ...faceIconRows()),
        section('When you roll',
          toggle('A flare on a natural 20 or 1', 'diceCrit', 'A soft light rising from the die (100 or 1 on the Sphere).'),
          colourRow('Flare colour', 'diceCritColor'),
          select('Trail', 'diceTrail', [['none', 'None'], ['moonlight', 'Moonlight'], ['embers', 'Embers'], ['mist', 'Mist']], 'A faint streak behind each die as it tumbles.'),
          select('Landing puff', 'dicePuff', [['none', 'None'], ['auto', 'By season'], ['dust', 'Dust'], ['leaves', 'Leaves'], ['snow', 'Snow']], 'Where a die first hits the table. By season: snow in leaf-bare, leaves in leaf-fall, dust otherwise.'),
          select('Sound', 'diceSurface', [['auto', 'By material'], ['wood', 'Wood'], ['stone', 'Stone'], ['glass', 'Glass'], ['bone', 'Bone'], ['tile', 'Tile']], 'How the dice sound landing. By material: glass for see-through finishes, stone for stone and marble, and so on.')),
        section('Mixed set',
          toggle('Each die type its own colour and finish', 'diceMixedOn', 'Overrides the set colour and finish per die type.', () => RP.emit('settings:redraw')),
          ...(s.diceMixedOn ? mixedRows() : [])),
        /* v6.14.1: choose your dice tray: a themed frame and floor, drawn in the Codex */
        section('Dice tray theme (this device only)',
          note('A themed tray replaces the table and tray below. It shows while dice are out: in the Dice tray window, the Dice panel or the story.'),
          trayThemeGrid()),
        section('The table (this device only)',
          select('Table under the dice', 'diceTable', [['none', 'None'], ['auto', 'By season'], ['forest', 'Forest floor'], ['rock', 'Flat rock'], ['wood', 'Twoleg table'], ['snow', 'Snow']], 'Only while dice are out. By season: snow in leaf-bare, forest floor in leaf-fall, moss otherwise.'),
          select('Tray', 'diceTrayShape', [['plain', 'Open table'], ['log', 'Hollow log'], ['bowl', 'Stone bowl'], ['leaf', 'A big leaf']], 'The shape the table takes under the dice.')),
        section('Throw',
          slider('Throw strength', 'diceStrength', 0.5, 1.6, 0.05, pct),
          slider('Bounciness', 'diceBounce', 0.3, 1.8, 0.05, pct),
          slider('Speed', 'diceSpeed', 0.4, 1.6, 0.05, v => (v < 0.95 ? 'slow-mo ' : '') + pct(v)),
          select('Thrown from', 'diceFrom', [['random', 'Random'], ['left', 'Left'], ['right', 'Right'], ['bottom', 'Bottom'], ['top', 'Top']]),
          slider('Dice size', 'diceScale', 0.6, 1.8, 0.05, pct),
          slider('Stay on screen for', 'diceLinger', 0.5, 10, 0.5, v => v + 's')),
        section('Sound', toggle('Dice sounds', 'diceSound'), slider('Dice volume', 'diceVolume', 0, 1, 0.05, pct)),
      ];
    }

  // ---------- the drawer: it slides over the roll bar and the log, so the tray stays in view for Test throw ----------
  let drawer = null, redrawNow = null;
  RP.on('settings:redraw', () => redrawNow?.());
  function close() { if (!drawer) return; drawer.remove(); drawer = null; redrawNow = null; document.removeEventListener('keydown', onKey, true); document.body.classList.remove('look-open'); RP.emit('look:closed'); }
  function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }
  RP.openDiceLook = () => {
    if (drawer) return close();
    const main = h('div.smain');
    const redraw = () => { if (!drawer) return; const y = main.scrollTop; main.replaceChildren(...page()); main.scrollTop = y; };
    main.replaceChildren(...page());
    const card = h('div.settings2.look', { role: 'dialog', 'aria-label': 'Dice look' },
      h('div.shead', null, h('h2', { text: 'Dice look' }), h('button.icon-btn', { html: '&#x2715;', title: 'Close (Esc)', onclick: close })),
      main);
    drawer = h('div.rp.look-drawer', null, card);
    document.body.append(drawer); document.body.classList.add('look-open');
    document.addEventListener('keydown', onKey, true);
    redrawNow = redraw;
  };
  RP.closeDiceLook = close;
})();
