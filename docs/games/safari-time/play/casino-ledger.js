/* CASINO LEDGER -- the one-way meter every casino game reports to, and the door to the
 * cross-game leaderboard.
 *
 * Identical copy in each game's deploy folder (Wyrmhoard Keno, Safari Time). Elo's Hoard
 * has its own older ledger at machine/global with the same idea; this module is the
 * generalisation of it for games that had no Firebase of their own.
 *
 * WHAT IT RECORDS. One document per game, ledgers/{game}: plays, wagered, paid and
 * feature triggers, split by calendar day and by "cell" (the game's own name for a
 * bet configuration -- denomination/tier/spots for keno, bet level for the slot). The
 * console compares the observed return per cell with the return the game's own maths
 * says that cell should produce. Nothing here ever reads the ledger back: the game does
 * not know its own history and cannot act on it. Every play stays independent.
 *
 * WHO WRITES. By default the session signs in anonymously to the elos-hoard Firebase
 * project -- no name, no account, nothing about the player. That sign-in exists purely
 * so the security rules can insist a writer is a session at all, and cap what one write
 * may do (one play, at most $2 wagered, counters only ever go up).
 *
 * THE BOARD. A small pill in the corner lets a player sign in with the name and passcode
 * of their Elo's Hoard account (accounts are created there). While signed in, each play
 * also lands on boards/{uid}: a name and per-game plays / wagered / paid, never a
 * balance. That row plus Elo's own leaderboard row is what the cross-game board shows.
 *
 * If anonymous sign-in is off, or the SDK fails to load, or the network is down, every
 * call here is a no-op and the game plays exactly as before. A play is never delayed or
 * blocked by this file.
 *
 * Load it as a module: <script type="module" src="casino-ledger.js"></script>
 * Then from game code, at the moment a round settles:
 *     window.CasinoLedger && CasinoLedger.report('keno', { bet, paid, bonus, cell })
 * bet and paid in DOLLARS (not cents), bonus 0 or 1, cell a short token with no dots.
 */
const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';
const CFG = {
  apiKey: 'AIzaSyBsF95vNPpWbgYHHMEhYKxdJaMzceO-rz8',   // public client id, not a secret
  authDomain: 'elos-hoard.firebaseapp.com',
  projectId: 'elos-hoard',
  appId: '1:555085175615:web:c485b0d13b18c05cbad18a'
};
const GAMES = ['keno', 'safari'];
const DOMAIN = '@players.elos-hoard';          // Elo's Hoard turns a name into an email this way
const CREATE_URL = '/games/elos-hoard/play/';
const BOARD_URL = '/games/elos-hoard/play/';

let fb = null, ready = null, user = null, playerName = null;
const pending = [];

function day() { return new Date().toISOString().slice(0, 10); }
function isPlayer(u) {
  return !!(u && !u.isAnonymous && u.providerData && u.providerData.some(p => p.providerId === 'password'));
}

async function boot() {
  const [app, auth, fs] = await Promise.all([
    import(SDK + '/firebase-app.js'),
    import(SDK + '/firebase-auth.js'),
    import(SDK + '/firebase-firestore.js')
  ]);
  const a = app.initializeApp(CFG, 'casino-ledger');
  fb = { auth: auth.getAuth(a), db: fs.getFirestore(a), ...auth, ...fs };
  await fb.setPersistence(fb.auth, fb.browserLocalPersistence).catch(() => {});
  await new Promise(res => {
    let done = false;
    fb.onAuthStateChanged(fb.auth, async u => {
      user = u;
      if (u) {
        playerName = null;
        if (isPlayer(u)) {
          // The name shown on the board is the one Elo's Hoard knows; fall back to the
          // sign-in name if the player has never been on that leaderboard.
          try {
            const s = await fb.getDoc(fb.doc(fb.db, 'leaderboard', u.uid));
            if (s.exists() && s.data().name) playerName = String(s.data().name);
          } catch (e) {}
          if (!playerName) playerName = (u.email || '').split('@')[0] || 'player';
        }
        paintPill();
        if (!done) { done = true; res(); }
        return;
      }
      paintPill();
      try { await fb.signInAnonymously(fb.auth); }
      catch (e) { if (!done) { done = true; res(); } }
    });
  });
}

async function write(game, o) {
  if (!fb || !user) return;
  const inc = fb.increment, ref = fb.doc(fb.db, 'ledgers', game), d = day();
  const bet = Math.max(0, Math.min(2, Number(o.bet) || 0));
  const paid = Math.max(0, Number(o.paid) || 0);
  const bonus = o.bonus ? 1 : 0;
  const cell = String(o.cell || 'x').replace(/[^A-Za-z0-9_-]/g, '_');
  const patch = {
    plays: inc(1), wagered: inc(bet), paid: inc(paid), bonuses: inc(bonus),
    updatedAt: fb.serverTimestamp()
  };
  patch['days.' + d + '.n'] = inc(1);
  patch['days.' + d + '.w'] = inc(bet);
  patch['days.' + d + '.p'] = inc(paid);
  patch['days.' + d + '.b'] = inc(bonus);
  patch['cells.' + cell + '.n'] = inc(1);
  patch['cells.' + cell + '.w'] = inc(bet);
  patch['cells.' + cell + '.p'] = inc(paid);
  patch['cells.' + cell + '.b'] = inc(bonus);
  try {
    await fb.updateDoc(ref, patch);
  } catch (e) {
    // First play ever for this game: the document does not exist yet. Create it empty
    // (the rules only allow a zeroed create) and apply the same patch again.
    try {
      await fb.setDoc(ref, { plays: 0, wagered: 0, paid: 0, bonuses: 0, days: {}, cells: {},
                             createdAt: fb.serverTimestamp(), updatedAt: fb.serverTimestamp() });
      await fb.updateDoc(ref, patch);
    } catch (e2) { /* unrecorded; the game is unaffected */ }
  }
  // The player's own row on the cross-game board, only for a signed-in account.
  if (isPlayer(user) && playerName) {
    const row = { name: playerName.slice(0, 14), updatedAt: fb.serverTimestamp() };
    row[game] = { n: inc(1), w: inc(bet), p: inc(paid) };
    try { await fb.setDoc(fb.doc(fb.db, 'boards', user.uid), row, { merge: true }); } catch (e) {}
  }
}

function report(game, o) {
  if (!GAMES.includes(game) || !o) return;
  if (!ready) ready = boot().catch(() => {});
  pending.push([game, o]);
  ready.then(async () => {
    while (pending.length) { const [g, p] = pending.shift(); await write(g, p); }
  });
}

/* ------------------------------------------------------------- the pill
   A corner button: "Leaderboard · sign in" or "name · sign out". Kept deliberately
   plain and small so it sits over any game's layout without joining it. */
let pill = null, panel = null;
function el(tag, attrs, html) {
  const e = document.createElement(tag);
  Object.keys(attrs || {}).forEach(k => e.setAttribute(k, attrs[k]));
  if (html !== undefined) e.innerHTML = html;
  return e;
}
function css() {
  if (document.getElementById('casino-ledger-css')) return;
  const s = el('style', { id: 'casino-ledger-css' });
  s.textContent =
    '#cl-pill{position:fixed;left:10px;bottom:10px;z-index:2147483000;font:600 12px/1 Inter,system-ui,sans-serif;' +
      'letter-spacing:.02em;color:#f4f1ea;background:rgba(12,11,15,.82);border:1px solid rgba(255,255,255,.16);' +
      'border-radius:999px;padding:8px 12px;cursor:pointer;backdrop-filter:blur(6px);opacity:.85;transition:opacity .15s}' +
    '#cl-pill:hover{opacity:1}' +
    '#cl-panel{position:fixed;left:10px;bottom:46px;z-index:2147483000;width:min(280px,calc(100vw - 20px));' +
      'font:14px/1.5 Inter,system-ui,sans-serif;color:#f4f1ea;background:#15131b;border:1px solid rgba(255,255,255,.14);' +
      'border-radius:14px;padding:14px;box-shadow:0 20px 50px rgba(0,0,0,.5)}' +
    '#cl-panel h4{margin:0 0 6px;font-size:14px}#cl-panel p{margin:0 0 10px;font-size:12px;color:#cfc9be}' +
    '#cl-panel input{width:100%;box-sizing:border-box;margin:0 0 8px;padding:9px 10px;border-radius:8px;' +
      'border:1px solid rgba(255,255,255,.18);background:#0c0b0f;color:#f4f1ea;font:inherit}' +
    '#cl-panel button{width:100%;padding:9px;border:0;border-radius:8px;font:600 13px Inter,system-ui,sans-serif;' +
      'background:linear-gradient(135deg,#ff9f45,#ff7a2f);color:#1a1006;cursor:pointer}' +
    '#cl-panel .cl-msg{min-height:1.2em;font-size:12px;color:#ff9f45;margin-top:8px}' +
    '#cl-panel a{color:#cfc9be}';
  document.head.appendChild(s);
}
function paintPill() {
  if (!document.body) return;
  css();
  if (!pill) {
    pill = el('button', { id: 'cl-pill', type: 'button', 'aria-haspopup': 'dialog' });
    pill.onclick = togglePanel;
    document.body.appendChild(pill);
  }
  pill.textContent = isPlayer(user) ? '\u{1F3C6} ' + (playerName || 'player') + ' · sign out'
                                    : '\u{1F3C6} Leaderboard · sign in';
}
function togglePanel() {
  if (isPlayer(user)) { fb.signOut(fb.auth).catch(() => {}); closePanel(); return; }
  if (panel) { closePanel(); return; }
  panel = el('div', { id: 'cl-panel', role: 'dialog', 'aria-label': 'Leaderboard sign in' },
    '<h4>Get on the board</h4>' +
    '<p>Sign in with your Elo’s Hoard name and passcode and your plays here count on the ' +
    '<a href="' + BOARD_URL + '" target="_blank" rel="noopener">Elo’s Hoard leaderboard</a>.</p>' +
    '<input id="cl-u" placeholder="Name" autocomplete="username" autocapitalize="off" spellcheck="false">' +
    '<input id="cl-p" placeholder="Passcode" type="password" autocomplete="current-password">' +
    '<button type="button" id="cl-go">Sign in</button>' +
    '<div class="cl-msg" id="cl-msg"></div>' +
    '<p style="margin:8px 0 0">No account? <a href="' + CREATE_URL + '" target="_blank" rel="noopener">Create one in Elo’s Hoard</a>.</p>');
  document.body.appendChild(panel);
  panel.querySelector('#cl-go').onclick = signIn;
  panel.querySelector('#cl-p').addEventListener('keydown', e => { if (e.key === 'Enter') signIn(); });
  panel.querySelector('#cl-u').focus();
}
function closePanel() { if (panel) { panel.remove(); panel = null; } }
async function signIn() {
  if (!fb) return;
  const n = (panel.querySelector('#cl-u').value || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  const p = panel.querySelector('#cl-p').value;
  const msg = panel.querySelector('#cl-msg');
  if (!n || !p) { msg.textContent = 'Name and passcode, please.'; return; }
  msg.textContent = 'Signing in…';
  try {
    await fb.signInWithEmailAndPassword(fb.auth, n + DOMAIN, p);
    closePanel();
  } catch (e) {
    msg.textContent = 'Sign-in failed — ' + ((e && e.code) || 'error').replace('auth/', '');
  }
}

window.CasinoLedger = { report };

// Boot early so the pill is there before the first play, but never block the game on it.
if (!ready) ready = boot().catch(() => {});
