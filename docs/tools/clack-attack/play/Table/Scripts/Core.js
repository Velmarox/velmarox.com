// The table (the Roleplaything, moved into the Warrior Codex: its Dashboard and story sidebar): shared namespace, this device's storage, the
// event bus and the settings every other Table module reads. Loaded first. Settings are this device's own (your
// colour, dice look, layout, templates); who you are and your modifiers come from the Codex and its sheets.
window.RP = window.RP || {};

(() => {
  const PREFIX = 'rp.';

  RP.store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(PREFIX + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* storage off */ }
    },
  };

  // Tiny pub/sub so panels don't need to know about each other.
  const handlers = {};
  RP.on = (evt, fn) => { (handlers[evt] ||= []).push(fn); };
  RP.emit = (evt, data) => { (handlers[evt] || []).forEach(fn => { try { fn(data); } catch (e) { console.error(evt, e); } }); };

  RP.DEFAULT_TEMPLATES = {
    do: '**{name}** {text}',
    say: '**{name}** {verb}, "{text}"',
    sayLang: '**{name}** {verb} in {lang}, "{text}"',
    ooc: '(({text}))',
    roll: '**{name}** rolls {label}: {detail} = **{total}**',
  };

  const DEFAULTS = {
    mode: 'say',              // 'do' | 'say' | 'ooc'
    lang: '',
    verb: '',                 // custom speech verb for Say lines ('' = "says")
    verbOnce: true,           // the custom verb goes back to "says" after posting
    languages: ['Clan tongue', 'Twoleg', 'Dog'],
    to: 'all',                // who my lines go to: 'all', 'gm' or a player cat (the GM's whispers)
    speakAs: '',              // the GM's page: the cat it speaks as ('' = the narrator)
    chime: true,              // the GM's page: a soft chime when something new lands in the logs
    chimeVolume: 0.25,        // v6.0.0: quieter by default (and a soft pop, not a bell)
    templates: { ...RP.DEFAULT_TEMPLATES },
    theme: { preset: 'arcane', accent: '#6157e8', mode: 'dark', logFont: 'serif' },   // accent: your colour
    quickDice: ['1d4', '1d6', '1d8', '1d10', '1d12', '1d20', '1d100'],
    critHighlight: true,
    stripMarkdownOnCopy: false,
    enterToPost: true,
    dice3d: true,             // throw 3D dice across the window
    partnerDice: true,        // also throw the partner's dice on this screen
    diceSound: true,
    /* v6.14.0: the dice update (the look travels with each roll; the table and tray are this device's own) */
    diceColor2: '#e8d9b0',     // the second colour: Two-tone swirl and Smoke glass
    diceInclusion: 'none',    // none | leaf | feather | moss | bone | paw: hanging inside the die
    diceWear: 0,              // 0 to 1: weathered edges and worn numbers
    diceNumberStyle: 'print', // print | engraved
    diceNumberOutline: 'auto', // auto (on skins and stripes) | on | off: an edge round each number so it reads on a busy face
    diceStripes: [],          // colours of stripes across the whole die, top to bottom ([] = none; see RP.DICE_STRIPES)
    diceTopSymbol: 'none',    // none | paw | claw | moon | star | clan | … | custom:<id>: in place of the highest number
    diceLowSymbol: 'skull',   // v6.20.0: the same, in place of the 1
    diceFaceIcons: 'none',    // v6.20.0: none | high | low | both: which faces get an icon
    diceCrit: true,           // a soft flare on a natural 20 or 1
    diceCritColor: '#ffd27a',
    diceTrail: 'none',        // none | moonlight | embers | mist
    dicePuff: 'none',         // none | auto (by season) | dust | leaves | snow
    diceSurface: 'auto',      // auto | wood | stone | glass | bone | tile: how the dice sound
    diceMixedOn: false,       // a mixed set: each die type its own colour and finish
    diceMixed: {},            // { 20: { c: '#…', f: 'glossy' }, … }
    diceTable: 'none',        // none | auto (by season) | forest | rock | wood | snow
    diceTrayShape: 'plain',   // plain | log | bowl | leaf
    diceTheme: 'none',        // v6.14.1: a themed tray (Dice_Themes.js) in place of the table and tray above
    diceVolume: 0.7,
    diceLinger: 2.5,          // seconds the dice stay after landing
    diceKeep: 'mine',         // earlier rolls stay out (three at most): off | mine
    diceScale: 1,
    // 3D dice look
    diceColorMode: 'theme',   // 'theme' | 'custom'
    diceColor: '#6157e8',
    diceNumberMode: 'auto',   // 'auto' | 'custom'
    diceNumberColor: '#ffffff',
    diceFinish: 'satin',      // see RP.DICE_FINISHES
    diceSkin: 'none',         // none | marble | galaxy | wood | stone | custom
    diceSkinTint: 0.35,       // how much of the dice colour is blended into the skin
    diceGlitter: 1,
    // music (volume is per-PC; the host controls playback; vibes point at library tracks)
    musicVolume: 60,
    musicMuted: false,
    musicVibes: [
      { id: 'v1', label: 'Battle', fileId: '' },
      { id: 'v2', label: 'Sad', fileId: '' },
      { id: 'v3', label: 'Happy', fileId: '' },
      { id: 'v4', label: 'Tavern', fileId: '' },
      { id: 'v5', label: 'Mystery', fileId: '' },
      { id: 'v6', label: 'Calm', fileId: '' },
    ],           // glitter strength: 0.2 (a hint) to 2 (maximum sparkle)
    d100Style: 'pair',        // 'pair' (tens die + d10) | 'sphere' (one 100-faced die)
    diceHighlight: true,      // frame the result face on d100 dice once they land
    diceFont: 'sans',         // see RP.DICE_FONTS
    diceMulticolor: false,    // each die type gets its own hue
    diceOutline: true,
    diceShadows: true,
    // 3D dice throw
    diceStrength: 1,
    diceBounce: 1,
    diceSpeed: 1,
    diceFrom: 'random',       // random | left | right | top | bottom
    partnerDiceStyle: 'theirs', // 'theirs' | 'mine'
    // v5.10.0: Display
    uiZoom: 1,                // the whole app's size (the desktop apps): 0.8 to 1.5
    logScale: 1,              // the story's text size: 0.9, 1, 1.15, 1.3
    reduceMotion: 'auto',    // 'auto' follows Windows | 'on' always calm
  };

  // Settings are stored as one object; missing keys are filled from DEFAULTS
  // so adding a new setting later never breaks an old install.
  const saved = RP.store.get('settings', {});
  RP.settings = { ...structuredClone(DEFAULTS), ...saved };
  RP.settings.templates = { ...RP.DEFAULT_TEMPLATES, ...(saved.templates || {}) };
  // Before {verb} existed the Say templates had "says" written in. Untouched
  // ones become the new defaults; edited ones keep their wording and get
  // their "says" swapped for the verb when a line is built.
  const OLD_SAY = { say: '**{name}** says, "{text}"', sayLang: '**{name}** says in {lang}, "{text}"' };
  for (const k of Object.keys(OLD_SAY)) if (RP.settings.templates[k] === OLD_SAY[k]) RP.settings.templates[k] = RP.DEFAULT_TEMPLATES[k];
  RP.settings.theme = { ...DEFAULTS.theme, ...(saved.theme || {}) };
  if (RP.settings.diceFinish === 'glitter') RP.settings.diceFinish = 'metal';   // v6.9.0: Glitter is gone
  /* v6.20.0: no more "inside the die": what was inside goes on the highest face instead (if that was still the number) */
  /* v6.20.0: Icon faces (none, high, low, both): someone who already had a symbol on the highest face keeps it */
  if (saved.diceFaceIcons === undefined) RP.settings.diceFaceIcons = (saved.diceTopSymbol || 'none') !== 'none' || (saved.diceInclusion || 'none') !== 'none' ? 'high' : 'none';
  if (RP.settings.diceInclusion && RP.settings.diceInclusion !== 'none') { if (!RP.settings.diceTopSymbol || RP.settings.diceTopSymbol === 'none') RP.settings.diceTopSymbol = RP.settings.diceInclusion; RP.settings.diceInclusion = 'none'; }
  /* v6.0.0: the new pop starts quiet even where the old bell was turned up; once */
  if (!saved.popSound) { RP.settings.chimeVolume = Math.min(RP.settings.chimeVolume ?? 0.25, 0.25); RP.settings.popSound = true; RP.store.set('settings', RP.settings); }

  let saveTimer;
  RP.save = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => RP.store.set('settings', RP.settings), 150);
  };

  // Change a setting, persist it and tell whoever cares.
  RP.set = (key, value) => {
    RP.settings[key] = value;
    RP.save();
    RP.emit('setting', { key, value });
    RP.emit('setting:' + key, value);
  };

  // The look of my dice, sent along with each roll so my partner can show
  // them the same way.
  RP.myDiceStyle = () => {
    const s = RP.settings;
    return {
      color: s.diceColorMode === 'custom' ? s.diceColor : s.theme.accent,
      number: s.diceNumberMode === 'custom' ? s.diceNumberColor : '',
      finish: s.diceFinish, font: s.diceFont, multi: !!s.diceMulticolor, outline: !!s.diceOutline,
      skin: s.diceSkin || 'none', tint: s.diceSkinTint ?? 0.35, d100: s.d100Style || 'pair', glitter: s.diceGlitter ?? 1,
      skinHash: s.diceSkin === 'custom' ? (RP.skins?.myCustomHash() || '') : '',
      /* v6.14.0 */
      color2: s.diceColor2 || '', inclusion: s.diceInclusion || 'none', wear: +s.diceWear || 0, numStyle: s.diceNumberStyle || 'print',
      stripes: Array.isArray(s.diceStripes) && s.diceStripes.length > 1 ? s.diceStripes : undefined, numOutline: s.diceNumberOutline || 'auto',
      /* v6.20.0: an icon on the highest face, the lowest, both or neither (Settings > Dice > Icon faces) */
      ...(() => {
        const m = RP.faceMode(s), top = /high|both/.test(m) ? (s.diceTopSymbol || 'none') : 'none', low = /low|both/.test(m) ? (s.diceLowSymbol || 'none') : 'none';
        const pic = (v) => (String(v).startsWith('custom:') ? (RP.diceIcons?.get(v.slice(7))?.src || '') : '');
        return { top, low, topIcon: pic(top), lowIcon: pic(low), clan: top === 'clan' || low === 'clan' ? (RP.codex?.factionOf?.(RP.codex?.me?.().name) || '') : '' };
      })(),
      crit: s.diceCrit !== false, critColor: s.diceCritColor || '', trail: s.diceTrail || 'none', puff: s.dicePuff || 'none', surface: s.diceSurface || 'auto',
      mixed: s.diceMixedOn && s.diceMixed && Object.keys(s.diceMixed).length ? s.diceMixed : undefined,
    };
  };

  /** v6.20.0: a look to send to the table: everything but your icon's picture (that goes once, in your live data). */
  RP.shareStyle = (st) => { const o = { ...(st || {}) }; delete o.topIcon; delete o.lowIcon; return o; };
  /** v6.20.0: which faces get an icon: a saved mode, or (an older look) the highest one if it names a symbol. */
  RP.faceMode = (v) => v.diceFaceIcons || ((v.diceTopSymbol || 'none') !== 'none' ? 'high' : 'none');

  // Who this page is at the table: 'gm' on the GM's Codex, the player cat's name on a player's device.
  RP.mySeat = () => RP.sync?.seat || '';
  /* v6.5.0: the GM's page in the Players view is a player's page in every way (speaks only as its cat, no GM tools,
     no GM cards); the GM's seat itself (RP.isGMSeat) still keeps the music in step for everyone. */
  RP.isGMSeat = () => RP.mySeat() === 'gm';
  RP.isGM = () => RP.isGMSeat() && !RP.codex?.playersView?.();
  RP.isHost = RP.isGMSeat;
  /** v6.0.0: the sound's mute button and volume slider, for a log's header (GM only). Changes are this device's own. */
  let sndHooked = false;
  RP.soundControl = () => {   // (made here so the Story Log, which loads before Table.js, can use it; RP.chime is in Table.js)
    const { h } = RP;
    const btn = h('button.btn.small.icon-btn.snd-btn', { type: 'button' });
    const vol = h('input.snd-vol', { type: 'range', min: 0.05, max: 1, step: 0.05, value: RP.settings.chimeVolume ?? 0.25, 'aria-label': 'Volume of the sound for new lines' });
    const paint = () => {
      const on = !!RP.settings.chime;
      btn.innerHTML = on ? '&#x1F514;' : '&#x1F515;';
      btn.title = on ? 'A soft pop when a new line lands (click to mute)' : 'Muted: no sound for new lines (click to turn on)';
      btn.setAttribute('aria-pressed', String(on)); vol.disabled = !on; vol.value = RP.settings.chimeVolume ?? 0.25;
    };
    btn.addEventListener('click', () => { RP.set('chime', !RP.settings.chime); paint(); if (RP.settings.chime) RP.chime('story', true); });
    vol.addEventListener('input', () => RP.set('chimeVolume', parseFloat(vol.value)));
    vol.addEventListener('change', () => RP.chime('story', true));
    paint();
    const box = h('span.snd-ctl', null, btn, vol); box._paint = paint;
    if (!sndHooked) { sndHooked = true; const all = () => document.querySelectorAll('.snd-ctl').forEach(x => x._paint?.()); RP.on('setting:chime', all); RP.on('setting:chimeVolume', all); }   // one listener for every control on the page
    return box;
  };

  /** v5.10.0: less movement: Windows asks for it, or Settings > Display says always. */
  RP.calm = () => RP.settings.reduceMotion === 'on' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  RP.uid = () => Math.random().toString(36).slice(2, 10);

  // Class names the Codex uses for its own things go by rp-… here, so neither page's styles reach the other's.
  const RENAMED = new Set(['wrap', 'modal', 'toast', 'preview', 'seg', 'field', 'hint', 'drop']);

  // Small DOM helper: h('div.cls', {attrs}, children...)
  RP.h = (sel, attrs, ...kids) => {
    // Allow h('div', child, child) as well as h('div', {attrs}, child).
    if (attrs instanceof Node || Array.isArray(attrs) || typeof attrs !== 'object') {
      if (attrs !== null && attrs !== undefined) kids.unshift(attrs);
      attrs = null;
    }
    const [tag, ...classes] = sel.split('.');
    const el = document.createElement(tag || 'div');
    if (classes.length) el.className = classes.map(c => (RENAMED.has(c) ? 'rp-' + c : c)).join(' ');
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === undefined || v === null || v === false) continue;
        if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else if (k === 'text') el.textContent = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'value') el.value = v;          // textarea ignores the attribute
        else if (k in el && typeof v !== 'string') el[k] = v;
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const kid of kids.flat()) {
      if (kid === null || kid === undefined || kid === false) continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  };

  RP.copy = text => navigator.clipboard.writeText(text);

  // Brief message at the bottom of the window, with an optional action button.
  RP.toast = (msg, action, ms = 3500) => {
    let host = document.getElementById('rp-toasts');
    if (!host) { host = RP.h('div.rp.rp-toasts', { id: 'rp-toasts' }); document.body.append(host); }
    const el = RP.h('div.toast', null, RP.h('span', { text: msg }));
    if (action) {
      el.append(RP.h('button.btn.small', { text: action.label, onclick: () => { action.run(); el.remove(); } }));
    }
    host.append(el);
    setTimeout(() => el.classList.add('out'), ms);
    setTimeout(() => el.remove(), ms + 400);
  };
})();
