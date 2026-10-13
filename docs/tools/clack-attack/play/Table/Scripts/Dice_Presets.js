// Dice presets: named, saved dice looks. Templates ship with the app; your own
// presets live in local storage (a custom skin picture is saved inside the
// preset, so it survives changing your current picture later).
(() => {
  const s = RP.settings;

  // Everything that makes up a dice "look".
  const KEYS = ['diceColorMode', 'diceColor', 'diceNumberMode', 'diceNumberColor', 'diceFinish', 'diceFont',
    'diceMulticolor', 'diceOutline', 'diceSkin', 'diceSkinTint', 'd100Style',
    'diceStripes', 'diceNumberOutline',
    'diceColor2', 'diceInclusion', 'diceWear', 'diceNumberStyle', 'diceTopSymbol', 'diceLowSymbol', 'diceFaceIcons', 'diceCrit', 'diceCritColor', 'diceTrail', 'dicePuff', 'diceSurface', 'diceMixedOn', 'diceMixed'];   // v6.14.0
  RP.DICE_LOOK_KEYS = KEYS;

  const base = { diceColorMode: 'custom', diceNumberMode: 'auto', diceNumberColor: '#ffffff', diceFont: 'sans', diceMulticolor: false, diceOutline: true, diceSkin: 'none', diceSkinTint: 0.35, diceStripes: [], diceNumberOutline: 'auto',
    diceColor2: '#e8d9b0', diceInclusion: 'none', diceWear: 0, diceNumberStyle: 'print', diceTopSymbol: 'none', diceLowSymbol: 'skull', diceFaceIcons: 'none', diceCrit: true, diceCritColor: '#ffd27a', diceTrail: 'none', dicePuff: 'none', diceSurface: 'auto', diceMixedOn: false, diceMixed: {} };
  const T = (id, name, v) => ({ id: 't-' + id, name, template: true, values: { ...base, ...(v.diceTopSymbol && v.diceTopSymbol !== 'none' ? { diceFaceIcons: 'high' } : {}), ...v } });   // v6.20.0
  const TEMPLATES = [
    T('ivory', 'Classic Ivory', { diceColor: '#f1ead8', diceNumberMode: 'custom', diceNumberColor: '#2a2320', diceFinish: 'satin', diceFont: 'classic' }),
    T('obsidian', 'Obsidian & Gold', { diceColor: '#1d1b22', diceNumberMode: 'custom', diceNumberColor: '#e2b84f', diceFinish: 'glossy', diceFont: 'serif' }),
    T('pinkglitter', 'Pink Gloss', { diceColor: '#ff5fa2', diceFinish: 'glossy' }),   // v6.9.0: no more glitter
    T('galaxy', 'Galaxy', { diceColor: '#6b4bd6', diceSkin: 'galaxy', diceSkinTint: 0, diceFinish: 'glossy', diceNumberMode: 'custom', diceNumberColor: '#ffffff' }),
    /* v6.9.0: the Dragonglass theme's own set: polished obsidian in its glass stone, numbers in its fired plum, serif figures */
    T('dragonglass', 'Dragonglass', { diceColor: '#2A3034', diceFinish: 'glossy', diceNumberMode: 'custom', diceNumberColor: '#B98CA0', diceFont: 'serif', diceOutline: true }),
    T('gold', 'Gold Metal', { diceColor: '#d4a73a', diceFinish: 'metal', diceNumberMode: 'custom', diceNumberColor: '#3b2a06', diceFont: 'heavy' }),
    T('marble', 'Marble', { diceColor: '#ffffff', diceSkin: 'marble', diceSkinTint: 0.1, diceFinish: 'glossy', diceNumberMode: 'custom', diceNumberColor: '#33302e', diceFont: 'classic' }),
    T('frost', 'Frost Glass', { diceColor: '#8fd3ff', diceFinish: 'glass', diceNumberMode: 'custom', diceNumberColor: '#ffffff' }),
    T('wood', 'Forest Wood', { diceColor: '#b07a45', diceSkin: 'wood', diceSkinTint: 0, diceFinish: 'matte', diceNumberMode: 'custom', diceNumberColor: '#f3e2c4', diceFont: 'serif' }),
    T('rune', 'Rune Stone', { diceColor: '#8d8f93', diceSkin: 'stone', diceSkinTint: 0, diceFinish: 'matte', diceNumberMode: 'custom', diceNumberColor: '#9fe3ff', diceFont: 'mono' }),
    T('pearl', 'Pearl', { diceColor: '#f4e9f0', diceFinish: 'pearl', diceNumberMode: 'custom', diceNumberColor: '#6b4a60', diceFont: 'script' }),
    T('rainbow', 'Rainbow', { diceColor: '#e0663a', diceMulticolor: true, diceFinish: 'glossy' }),
    /* v6.14.0: the dice update */
    T('mossswirl', 'Moss Swirl', { diceColor: '#4f6b2c', diceColor2: '#c9b98a', diceSkin: 'swirl', diceSkinTint: 0, diceFinish: 'glossy', diceNumberMode: 'custom', diceNumberColor: '#f4ecd6', diceFont: 'serif', diceNumberStyle: 'engraved' }),
    T('amber', 'Amber Gem', { diceColor: '#c77a1c', diceFinish: 'gem', diceNumberMode: 'custom', diceNumberColor: '#fff2d6', diceFont: 'classic', diceTopSymbol: 'star', diceCritColor: '#ffc46b' }),
    T('riverbone', 'River Bone', { diceColor: '#e2d7bf', diceFinish: 'matte', diceWear: 0.7, diceNumberMode: 'custom', diceNumberColor: '#4a3626', diceFont: 'classic', diceNumberStyle: 'engraved', diceSurface: 'bone', diceTopSymbol: 'paw' }),
    T('leafglass', 'Leaf in Glass', { diceColor: '#cfe3c4', diceFinish: 'glass', diceTopSymbol: 'leaf', diceNumberMode: 'custom', diceNumberColor: '#2f4a22', diceFont: 'serif', dicePuff: 'leaves' }),
    T('smokemoon', 'Smoke and Moon', { diceColor: '#2b2f3a', diceColor2: '#c8d2e6', diceFinish: 'smoke', diceNumberMode: 'custom', diceNumberColor: '#eef2ff', diceFont: 'serif', diceTopSymbol: 'moon', diceTrail: 'moonlight', diceCritColor: '#cfe0ff' }),
  ];

  // Stripe sets: bands of colour across the whole die, top to bottom (Settings > Dice > Look > Stripes).
  RP.DICE_STRIPES = {
    pride: ['Pride', ['#f23d2e', '#e0935a', '#e8cf45', '#5db27a', '#4ab5d4', '#5b7fe8', '#c0228f']],
    transgender: ['Transgender', ['#5bcefa', '#f5a9b8', '#ffffff', '#f5a9b8', '#5bcefa']],
    nonbinary: ['Nonbinary', ['#5bcefa', '#ffffff', '#9a5ad3', '#2b2b2b']],
    agender: ['Agender', ['#2b2b2b', '#bac2c2', '#eaefef', '#b5f57d', '#eaefef', '#bac2c2', '#2b2b2b']],
    genderfluid: ['Genderfluid', ['#ff76a3', '#ffffff', '#bf17d5', '#2c1a2e', '#323ebc']],
    genderqueer: ['Genderqueer', ['#b497dd', '#ffffff', '#6a8f3a']],
  };
  /* Sketch dice: a drawing of a die (flat ink, inked edges, hatching), plain and in striped sets. The ink is the number colour. */
  const SK = { diceFinish: 'sketch', diceFont: 'hand', diceOutline: false, diceNumberMode: 'custom', diceNumberColor: '#141414' };
  const striped = (id, color) => T(id, RP.DICE_STRIPES[id][0], { ...SK, diceColor: color, diceStripes: [...RP.DICE_STRIPES[id][1]] });
  TEMPLATES.push(
    T('sketch', 'Sketch', { ...SK, diceColor: '#ffffff' }),
    T('sketchinked', 'Sketch, Inked', { ...SK, diceColor: '#050505', diceNumberColor: '#f4f4f4' }),
    T('sketchrose', 'Sketch, Rose', { ...SK, diceColor: '#dfe3fb', diceNumberColor: '#c0228f' }),
    striped('agender', '#b5f57d'), striped('genderfluid', '#bf17d5'), striped('genderqueer', '#b497dd'),
    striped('nonbinary', '#9a5ad3'), striped('pride', '#e8cf45'), striped('transgender', '#5bcefa'));

  /* v6.12.0: the Spillmoor group dice, one look per group. v6.12.2: they're templates now (they used to be copied
     into the GM's own presets). A group with no look picked in NPC dice throws its own template, matched by the
     group's name (the part before " - "). */
  const GROUP_DICE = [
    {"name": "BriarClan - Thornwood", "values": {"diceColorMode": "custom", "diceColor": "#3f5a2e", "diceNumberMode": "custom", "diceNumberColor": "#e9d9b0", "diceFinish": "satin", "diceFont": "serif", "diceMulticolor": false, "diceOutline": true, "diceSkin": "wood", "diceSkinTint": 0.55}},
    {"name": "GorseClan - Heath Bloom", "values": {"diceColorMode": "custom", "diceColor": "#e0b52a", "diceNumberMode": "custom", "diceNumberColor": "#4a2e10", "diceFinish": "satin", "diceFont": "heavy", "diceMulticolor": false, "diceOutline": true, "diceSkin": "none", "diceSkinTint": 0.35}},
    {"name": "RushClan - Floodwater", "values": {"diceColorMode": "custom", "diceColor": "#4f7f78", "diceNumberMode": "custom", "diceNumberColor": "#f2fbf8", "diceFinish": "glass", "diceFont": "serif", "diceMulticolor": false, "diceOutline": true, "diceSkin": "none", "diceSkinTint": 0.35}},
    {"name": "HearthClan - Rusted Tin", "values": {"diceColorMode": "custom", "diceColor": "#9c5a34", "diceNumberMode": "custom", "diceNumberColor": "#f0dcc0", "diceFinish": "metal", "diceFont": "mono", "diceMulticolor": false, "diceOutline": true, "diceSkin": "none", "diceSkinTint": 0.35}},
    {"name": "Former Kittypets - Collar Pink", "values": {"diceColorMode": "custom", "diceColor": "#f6d6e2", "diceNumberMode": "custom", "diceNumberColor": "#7a3b5a", "diceFinish": "pearl", "diceFont": "script", "diceMulticolor": false, "diceOutline": true, "diceSkin": "none", "diceSkinTint": 0.35}},
    {"name": "Loners - Roadside Stone", "values": {"diceColorMode": "custom", "diceColor": "#7a7570", "diceNumberMode": "custom", "diceNumberColor": "#e8e2d6", "diceFinish": "matte", "diceFont": "mono", "diceMulticolor": false, "diceOutline": true, "diceSkin": "stone", "diceSkinTint": 0.15}},
    {"name": "Barn and Attic - Hayloft", "values": {"diceColorMode": "custom", "diceColor": "#c9a25a", "diceNumberMode": "custom", "diceNumberColor": "#3a2410", "diceFinish": "matte", "diceFont": "classic", "diceMulticolor": false, "diceOutline": true, "diceSkin": "wood", "diceSkinTint": 0.2}},
    {"name": "Porch Elders - Weathered Step", "values": {"diceColorMode": "custom", "diceColor": "#d9d2c3", "diceNumberMode": "custom", "diceNumberColor": "#5a4a3a", "diceFinish": "satin", "diceFont": "classic", "diceMulticolor": false, "diceOutline": true, "diceSkin": "marble", "diceSkinTint": 0.3}},
    {"name": "StarClan - Silverpelt", "values": {"diceColorMode": "custom", "diceColor": "#2b3a7a", "diceNumberMode": "custom", "diceNumberColor": "#e8f0ff", "diceFinish": "glossy", "diceFont": "serif", "diceMulticolor": false, "diceOutline": true, "diceSkin": "galaxy", "diceSkinTint": 0.1}},
    {"name": "TarClan - Dark Forest", "values": {"diceColorMode": "custom", "diceColor": "#141216", "diceNumberMode": "custom", "diceNumberColor": "#9b3b5a", "diceFinish": "glossy", "diceFont": "heavy", "diceMulticolor": false, "diceOutline": true, "diceSkin": "none", "diceSkinTint": 0.35}},
    {"name": "The Defectors - Patchwork", "values": {"diceColorMode": "custom", "diceColor": "#7a6b9a", "diceNumberMode": "auto", "diceNumberColor": "#ffffff", "diceFinish": "satin", "diceFont": "sans", "diceMulticolor": true, "diceOutline": true, "diceSkin": "none", "diceSkinTint": 0.35}}
  ];
  const groupKey = n => String(n || '').split(' - ')[0].trim().toLowerCase();
  const GROUP_TEMPLATES = GROUP_DICE.map(g => ({ ...T('grp-' + groupKey(g.name).replace(/[^a-z0-9]+/g, '-'), g.name, g.values), group: groupKey(g.name) }));
  TEMPLATES.push(...GROUP_TEMPLATES);
  // The group template for a group id in the open world, if it has one.
  const groupTemplate = gid => {
    const g = gid && (RP.codex?.groups?.() || []).find(x => x.id === gid);
    return g ? GROUP_TEMPLATES.find(t => t.group === groupKey(g.name)) : null;
  };

  const load = () => RP.store.get('dicePresets', []);
  const save = list => { RP.store.set('dicePresets', list); RP.emit('presets:changed'); };
  const current = () => Object.fromEntries(KEYS.map(k => [k, s[k]]));

  // The style a preset would produce (for portraits), same shape as RP.myDiceStyle().
  function styleOf(p) {
    const v = { ...base, ...p.values };
    return {
      color: v.diceColorMode === 'custom' ? v.diceColor : s.theme.accent,
      number: v.diceNumberMode === 'custom' ? v.diceNumberColor : '',
      finish: v.diceFinish, font: v.diceFont, multi: !!v.diceMulticolor, outline: v.diceOutline !== false,
      skin: v.diceSkin || 'none', tint: v.diceSkinTint ?? 0.35, d100: v.d100Style || s.d100Style, glitter: v.diceGlitter ?? 1,
      skinUrl: v.diceSkin === 'custom' ? (p.skinImage || RP.skins.myCustomUrl()) : undefined,
      /* v6.14.0 */
      color2: v.diceColor2 || '', inclusion: v.diceInclusion || 'none', wear: +v.diceWear || 0, numStyle: v.diceNumberStyle || 'print',
      stripes: Array.isArray(v.diceStripes) && v.diceStripes.length > 1 ? v.diceStripes : undefined, numOutline: v.diceNumberOutline || 'auto',
      ...(() => { const m = RP.faceMode(v), pic = (x) => (String(x).startsWith('custom:') ? (RP.diceIcons?.get(x.slice(7))?.src || '') : ''), t = /high|both/.test(m) && v.diceTopSymbol !== 'clan' ? (v.diceTopSymbol || 'none') : 'none', l = /low|both/.test(m) && v.diceLowSymbol !== 'clan' ? (v.diceLowSymbol || 'none') : 'none';
        return { top: t, low: l, topIcon: pic(t), lowIcon: pic(l) }; })(),   // v6.20.0: high, low or both
      crit: v.diceCrit !== false, critColor: v.diceCritColor || '', trail: v.diceTrail || 'none', puff: v.dicePuff || 'none', surface: v.diceSurface || 'auto',
      mixed: v.diceMixedOn && v.diceMixed && Object.keys(v.diceMixed).length ? v.diceMixed : undefined,
    };
  }

  // While a preset is being applied, don't treat the changes as manual edits.
  let applying = false;
  RP.on('setting', ({ key }) => {
    if (!applying && KEYS.includes(key) && s.activeDicePreset) { s.activeDicePreset = ''; RP.save(); RP.emit('presets:changed'); }
  });

  /* v6.6.0: NPC dice. The GM picks a look (any preset, or "mine") for every NPC, for each group, and for any one
     cat (Settings > Dice > NPC dice): a cat's own wins over its group's, its group's over the default. */
  const NPC_DEFAULT = 't-rune';
  RP.npcDicePick = name => {
    const nd = s.npcDice || {}, own = (nd.cats || {})[name];
    if (own) return own;
    const g = RP.codex?.groupOf?.(name);
    return (g && ((nd.groups || {})[g] || groupTemplate(g)?.id)) || nd.default || NPC_DEFAULT;
  };
  RP.npcDiceStyleFor = id => {
    if (id === 'mine') return RP.myDiceStyle();
    const p = [...load(), ...TEMPLATES].find(x => x.id === id);
    return p ? styleOf(p) : RP.myDiceStyle();
  };
  RP.npcDiceStyle = name => RP.npcDiceStyleFor(RP.npcDicePick(name));

  RP.dicePresets = {
    templates: () => TEMPLATES,
    mine: load,
    all: () => [...load(), ...TEMPLATES],
    styleOf,
    activeId: () => s.activeDicePreset || '',

    async apply(p) {
      applying = true;
      try {
        if (p.values.diceSkin === 'custom' && p.skinImage) await RP.skins.setCustomUrl(p.skinImage);
        const v = { diceStripes: [], diceNumberOutline: 'auto', ...p.values };   // a preset saved before stripes existed has none
        for (const k of KEYS) if (v[k] !== undefined) RP.set(k, k === 'diceFinish' && v[k] === 'glitter' ? 'metal' : v[k]);   // v6.9.0: no glitter
        s.activeDicePreset = p.id;
        RP.save();
      } finally { applying = false; }
      RP.emit('presets:changed');
      RP.emit('dice:look');
    },

    saveCurrent(name) {
      const p = { id: 'p-' + RP.uid(), name: name.trim() || 'My dice', values: current() };
      if (s.diceSkin === 'custom') p.skinImage = RP.skins.myCustomUrl();
      const list = load();
      list.unshift(p);
      s.activeDicePreset = p.id; RP.save();
      save(list);
      return p;
    },

    // Keep a template as a starting point of your own.
    copy(p, name) {
      const c = { id: 'p-' + RP.uid(), name: name || p.name + ' (copy)', values: { ...p.values } };
      if (p.skinImage) c.skinImage = p.skinImage;
      const list = load(); list.unshift(c); save(list);
      return c;
    },

    rename(id, name) { const list = load(); const p = list.find(x => x.id === id); if (p && name.trim()) { p.name = name.trim(); save(list); } },

    update(id) {
      const list = load(); const p = list.find(x => x.id === id);
      if (!p) return;
      p.values = current();
      if (s.diceSkin === 'custom') p.skinImage = RP.skins.myCustomUrl(); else delete p.skinImage;
      s.activeDicePreset = id; RP.save();
      save(list);
    },

    remove(id) {
      const list = load(); const i = list.findIndex(x => x.id === id);
      if (i < 0) return null;
      const [gone] = list.splice(i, 1);
      save(list);
      return { gone, restore: () => { const l = load(); l.splice(i, 0, gone); save(l); } };
    },

    exportFile() {
      const blob = new Blob([JSON.stringify({ app: 'Roleplaything', dicePresets: load() }, null, 2)], { type: 'application/json' });
      const a = RP.h('a', { href: URL.createObjectURL(blob), download: 'Dice_Presets.json' });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    },

    async importFile(file) {
      const data = JSON.parse(await file.text());
      const incoming = Array.isArray(data) ? data : data.dicePresets;
      if (!Array.isArray(incoming)) throw new Error('No dice presets in that file.');
      const clean = incoming.filter(p => p && p.values).map(p => ({
        id: 'p-' + RP.uid(), name: String(p.name || 'Imported dice').slice(0, 60),
        values: Object.fromEntries(KEYS.filter(k => p.values[k] !== undefined).map(k => [k, p.values[k]])),
        ...(typeof p.skinImage === 'string' && p.skinImage.startsWith('data:image/') ? { skinImage: p.skinImage } : {}),
      }));
      save([...clean, ...load()]);
      return clean.length;
    },
  };

  /* v6.12.2: v6.12.0 copied the group dice into the GM's own presets. A copy still exactly as it came (same name,
     same look) is taken out of My presets, and whatever used it (NPC dice, the current look) points at its template.
     A copy that was renamed or changed is the GM's own and stays. Runs whenever presets may have arrived (this
     device's store, or settings brought back from the Codex), and does nothing once there are no copies left. */
  const sameLook = (a, b) => KEYS.every(k => JSON.stringify(a[k]) === JSON.stringify(b[k]));
  RP.moveGroupDiceToTemplates = () => {
    const list = load(), moved = {};
    const keep = list.filter(p => {
      const t = !p.skinImage && GROUP_TEMPLATES.find(x => x.name === p.name && sameLook({ ...base, ...p.values }, x.values));
      if (t) moved[p.id] = t.id;
      return !t;
    });
    if (!Object.keys(moved).length) return 0;
    const to = id => moved[id] || id, nd = JSON.parse(JSON.stringify(s.npcDice || {}));
    if (nd.default) nd.default = to(nd.default);
    for (const k of ['groups', 'cats']) for (const n of Object.keys(nd[k] || {})) nd[k][n] = to(nd[k][n]);
    if (moved[s.activeDicePreset]) { s.activeDicePreset = moved[s.activeDicePreset]; RP.save(); }
    save(keep); RP.set('npcDice', nd);
    return Object.keys(moved).length;
  };
  RP.moveGroupDiceToTemplates();
  RP.on('sync:started', RP.moveGroupDiceToTemplates);
  RP.on('presets:changed', () => { if (load().some(p => GROUP_TEMPLATES.some(t => t.name === p.name))) RP.moveGroupDiceToTemplates(); });
})();
