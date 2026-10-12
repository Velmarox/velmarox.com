// The window's own title bar and menu bar. Window buttons and View commands go to the app (window.desktop, from
// preload.js); game commands go to the game in the frame (its ARENA.menu).
(() => {
  const $ = (s) => document.querySelector(s);
  const D = window.desktop || { win: () => {}, info: async () => ({ version: '' }), onState: () => {} };   // also opens in a plain browser, for testing
  const frame = $('#game');
  const game = () => frame.contentWindow?.ARENA;
  let info = { version: '' };

  // ---------- window state ----------
  function setState(s) {
    document.body.classList.toggle('maximized', !!s.maximized);
    document.body.classList.toggle('fullscreen', !!s.fullscreen);
    if (s.focused != null) document.body.classList.toggle('blurred', !s.focused);
    $('[data-win="max"]').title = s.maximized ? 'Restore' : 'Maximize';
    if (s.fullscreen) { $('#fs-hint').classList.add('show'); setTimeout(() => $('#fs-hint').classList.remove('show'), 2500); }
  }
  D.onState(setState);
  D.info().then((i) => { info = i; $('#ver').textContent = i.version ? 'v' + i.version : ''; setState(i); });
  $('#titlebar').addEventListener('dblclick', (e) => { if (!e.target.closest('.win-btns')) D.win('max'); });
  document.querySelectorAll('[data-win]').forEach((b) => b.addEventListener('click', () => D.win(b.dataset.win)));

  // ---------- menus ----------
  let open = null;
  function openMenu(m) {
    if (open && open !== m) open.classList.remove('open');
    open = m; if (!m) return;
    m.classList.add('open');
    const sound = m.querySelector('[data-cmd="sound"]');
    if (sound) sound.classList.toggle('on', !!game()?.menu?.sound);
  }
  function closeMenus() { if (open) open.classList.remove('open'); open = null; document.body.classList.remove('alt'); }
  document.querySelectorAll('.menu').forEach((m) => {
    const top = m.querySelector('.menu-top');
    top.addEventListener('mousedown', (e) => { e.preventDefault(); open === m ? closeMenus() : openMenu(m); });
    top.addEventListener('mouseenter', () => { if (open && open !== m) openMenu(m); });
  });
  document.querySelectorAll('.drop button').forEach((b) => b.addEventListener('click', () => { closeMenus(); run(b.dataset.cmd); }));
  document.addEventListener('mousedown', (e) => { if (open && !e.target.closest('.menu')) closeMenus(); });
  window.addEventListener('blur', () => setTimeout(() => { if (document.activeElement === frame) closeMenus(); }, 0));   // a click into the game

  // ---------- commands ----------
  const COMMANDS = {
    newRun() {
      const g = game(); if (!g?.menu) return;
      if (g.menu.inRun) confirm('Start a new run?', 'Your current run will be lost.', 'New run', () => g.menu.newRun());
      else g.menu.newRun();
    },
    title() {
      const g = game(); if (!g?.menu) return;
      if (g.menu.inRun) confirm('Back to the title?', 'Your current run will be lost.', 'Leave run', () => g.menu.title());
      else g.menu.title();
    },
    quit: () => D.win('close'),
    fullscreen: () => D.win('fullscreen'),
    zoomIn: () => D.win('zoom', 1), zoomOut: () => D.win('zoom', -1), zoomReset: () => D.win('zoom', 0),
    reload: () => D.win('reload'),
    settings: () => game()?.menu?.settings(),
    sound: () => game()?.menu?.toggleSound(),
    rules: () => game()?.menu?.rules(),
    site: () => D.win('open', 'https://velmarox.com/games/clack-arena/'),
    about,
    devtools: () => D.win('devtools'),
  };
  function run(cmd) { COMMANDS[cmd]?.(); frame.focus(); }

  // ---------- keyboard: the same shortcuts work whether the game or the bar has focus ----------
  const KEYS = [
    [(e) => e.ctrlKey && e.key.toLowerCase() === 'n', 'newRun'], [(e) => e.ctrlKey && e.key.toLowerCase() === 't', 'title'],
    [(e) => e.ctrlKey && e.key.toLowerCase() === 'q', 'quit'], [(e) => e.key === 'F11', 'fullscreen'],
    [(e) => e.ctrlKey && (e.key === '=' || e.key === '+'), 'zoomIn'], [(e) => e.ctrlKey && e.key === '-', 'zoomOut'], [(e) => e.ctrlKey && e.key === '0', 'zoomReset'],
    [(e) => e.ctrlKey && e.key.toLowerCase() === 'r', 'reload'], [(e) => e.ctrlKey && e.key === ',', 'settings'],
    [(e) => e.ctrlKey && e.key.toLowerCase() === 'm', 'sound'], [(e) => e.key === 'F1', 'rules'],
    [(e) => e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'i', 'devtools'],
  ];
  const MNEMONIC = { g: 'game', v: 'view', o: 'options', h: 'help' };
  function onKey(e) {
    if (e.key === 'Escape' && open) { closeMenus(); e.preventDefault(); return; }
    if (e.altKey && MNEMONIC[e.key.toLowerCase()]) { openMenu($(`.menu[data-menu="${MNEMONIC[e.key.toLowerCase()]}"]`)); document.body.classList.add('alt'); e.preventDefault(); return; }
    if (e.key === 'Alt') { document.body.classList.toggle('alt'); return; }
    if (open && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      const all = [...document.querySelectorAll('.menu')], i = all.indexOf(open);
      openMenu(all[(i + (e.key === 'ArrowRight' ? 1 : all.length - 1)) % all.length]); e.preventDefault(); return;
    }
    if (open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      const items = [...open.querySelectorAll('.drop button')], i = items.indexOf(document.activeElement);
      items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1 + (i < 0 ? 1 : 0))) % items.length].focus(); e.preventDefault(); return;
    }
    const hit = KEYS.find(([test]) => test(e));
    if (hit) { e.preventDefault(); closeMenus(); run(hit[1]); }
  }
  window.addEventListener('keydown', onKey);

  // The game runs in the frame: give it the shortcuts too, and drop the bits a browser tab needs but the app doesn't
  // (the VRX badge linking back to the site, and the corner buttons the menu bar replaces).
  frame.addEventListener('load', () => {
    const doc = frame.contentDocument; if (!doc) return;
    doc.addEventListener('keydown', onKey);
    doc.addEventListener('mousedown', closeMenus);
    const st = doc.createElement('style');
    st.textContent = '.vrx-badge, .corner-btns { display: none !important; } #enemy-bar { padding-left: 10px; padding-right: 10px; }';
    doc.head.append(st);
    frame.focus();
  });

  // ---------- dialogs ----------
  const back = $('#dialog-back'), box = $('#dialog');
  function dialog(html, wire) {
    box.innerHTML = html; back.classList.add('show');
    const close = () => { back.classList.remove('show'); frame.focus(); };
    box.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
    wire?.(close);
    box.querySelector('.primary, button')?.focus();
  }
  back.addEventListener('mousedown', (e) => { if (e.target === back) back.classList.remove('show'); });
  function confirm(title, text, yes, then) {
    dialog(`<h2>${title}</h2><p>${text}</p><div class="row"><button type="button" class="pbtn" data-close>Cancel</button><button type="button" class="pbtn primary" id="yes">${yes}</button></div>`,
      (close) => box.querySelector('#yes').addEventListener('click', () => { close(); then(); }));
  }
  function about() {
    dialog(`<div class="about-head"><img src="icon.png" alt=""><div><h2>Clack Arena</h2><small>Version ${info.version || '?'} · VRX Games</small></div></div>
      <p>You are a die. Throw into a shared tray, crash into the enemy, engrave your faces.</p>
      <p><small>Dice engine and Green Felt tray from Clack Attack. GUI pieces from Pixel UI pack 3. Pixel font ThaleahFat.
      Built with three.js, cannon-es and Electron ${info.electron || ''}.</small></p>
      <div class="row"><button type="button" class="pbtn" id="site">velmarox.com</button><button type="button" class="pbtn primary" data-close>Close</button></div>`,
      () => box.querySelector('#site').addEventListener('click', () => D.win('open', 'https://velmarox.com/games/clack-arena/')));
  }
})();
