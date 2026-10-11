// ---------------------------------------------------------------------------
// Main loop, screen states, camera, combat resolution, HUD.
// ---------------------------------------------------------------------------

const TICK = 1000 / 60;
// How many enemies may commit to an attack at once. Two kept small fights
// readable but made big waves feel like a polite queue, so it now scales with
// the crowd - three attackers against five men is pressure, not unfairness,
// because every attack still has an uncancellable telegraph.
function maxTokens(aliveCount) {
  if (aliveCount >= 4) return 3;
  return 2;
}

// The one menu button. No options screen, no save slots - you start, and you
// play until you die or win, like the machines this is pretending to be.
// Sat over the empty street on the right so it doesn't cover the artwork.
const START_BUTTON = { x: 234, y: 126, w: 124, h: 22 };
const SETTINGS_BUTTON = { x: 234, y: 154, w: 124, h: 16 };
const QUIT_BUTTON = { x: 234, y: 174, w: 124, h: 16 };
// QUIT only exists where quitting is actually possible. The desktop launcher
// opens the game in an app-mode window that will close on request; a tab on the
// public web build will not, and a button whose only outcome is an apology is
// worse than no button. Local file:// and localhost are the launcher's world,
// anything else is the web.
const CAN_QUIT = (function () {
  try {
    if (location.protocol === 'file:') return true;
    const h = location.hostname;
    return h === '' || h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
  } catch (e) {
    return false;
  }
})();
// Settings rows: window mode / music / sound / keyboard / controller, then
// BACK. Generated so adding a row doesn't mean re-typing coordinates.
function settingsRow(i) { return { x: 52, y: 44 + i * 20, w: 280, h: 17 }; }
const SET_WM = 0, SET_MUSIC = 1, SET_SFX = 2, SET_KB = 3, SET_PAD = 4;
const SET_ROWS = 5;
const BACK_BUTTON = { x: 142, y: 158, w: 100, h: 18 };
const VOL_STEP = 0.1;

// Pause menu buttons.
const PAUSE_RESUME = { x: 130, y: 106, w: 124, h: 18 };
const PAUSE_QUIT = { x: 130, y: 128, w: 124, h: 18 };
// bindings screen
// 9 keyboard rows since BLOCK joined, so the pitch tightened from 17 to 15 to
// keep the last one clear of RESET DEFAULTS at y186.
function bindRowRect(i) { return { x: 40, y: 44 + i * 15, w: 304, h: 14 }; }
const RESET_BTN = { x: 56, y: 186, w: 124, h: 16 };
const BBACK_BTN = { x: 204, y: 186, w: 124, h: 16 };

// ---------------------------------------------------------------------------
// Controller diagram (pad bindings screen).
//
// assets/ui/controller.svg is drawn 1:1 at its own viewBox size, so every
// coordinate below is straight out of that file and needs re-measuring if the
// art changes. The template's sixteen callout lines already run out to the
// left and right edges of the drawing; all this table does is say which
// control each one ends at, so a label can be hung off the outer end and a
// marker dropped on the inner tip.
//
// `tip` is where the line actually stops - for the eight that kink, that is
// the far end of the elbow, not the end of the horizontal run.
// `btn` is a gamepad button index (see PAD_BTN_NAME); null means the line
// points at something with no single button behind it.
// ---------------------------------------------------------------------------
const PAD_X = 97, PAD_Y = 20, PAD_W = 188.69779, PAD_H = 141.55354;

const PAD_CALLOUTS = [
  { side: -1, y: 10.9, tip: [39.8, 10.9], btn: 6 },     // LT
  { side: -1, y: 26.0, tip: [39.9, 33.0], btn: 4 },     // LB
  { side: -1, y: 44.5, tip: [80.8, 54.0], btn: 8 },     // back / select
  { side: -1, y: 53.5, tip: [39.4, 53.5], btn: null, dpad: true },
  { side: -1, y: 63.2, tip: [47.8, 63.2], btn: null, dpad: true },
  { side: -1, y: 72.9, tip: [31.2, 70.4], btn: null, dpad: true },
  { side: -1, y: 82.3, tip: [43.1, 79.7], btn: null, dpad: true },
  { side: -1, y: 110.5, tip: [59.2, 89.4], btn: null, text: 'LS  MOVE' },
  { side: 1, y: 10.9, tip: [149.3, 10.9], btn: 7 },     // RT
  { side: 1, y: 26.0, tip: [149.2, 33.0], btn: 5 },     // RB
  { side: 1, y: 44.5, tip: [107.9, 54.0], btn: 9 },     // start
  { side: 1, y: 53.5, tip: [149.3, 53.5], btn: 3 },     // Y  (top face)
  { side: 1, y: 63.2, tip: [137.9, 63.2], btn: 2 },     // X  (far face, long line)
  { side: 1, y: 72.9, tip: [157.9, 70.4], btn: 1 },     // B  (right face)
  { side: 1, y: 82.3, tip: [146.0, 79.7], btn: 0 },     // A  (bottom face)
  { side: 1, y: 110.5, tip: [129.9, 89.4], btn: null, text: 'RS  —' },
];

// The template letters LT/RT/LB/RB/LS/RS in a font the player will not have,
// so make_controller.py strips them and the triggers get relettered here in
// ThaleahFat. Centres, measured off the stripped <text> elements.
//
// Only the triggers. drawTextOps floors the font at 8px, and the template sets
// these at 5.8-6.2 units against a drawing we render 1:1 - so on the bumpers
// (a swept wedge ~6px thick) and inside the stick hubs (13px across) the
// letters come out bigger than the shape holding them and read as blobs. The
// callouts already name every one of those buttons.
const PAD_BAKED_LABELS = [
  ['LT', 54.8, 20.3, 8], ['RT', 134.9, 20.3, 8],
];

function padChipRect(i) { return { x: 10 + i * 74, y: 166, w: 68, h: 16 }; }

function inRect(m, r) {
  return m.x >= r.x && m.x <= r.x + r.w && m.y >= r.y && m.y <= r.y + r.h;
}

// How big to draw the display canvas. Works in DEVICE pixels (CSS px times
// devicePixelRatio) so Windows display scaling can't land the art on
// fractional pixels. Fills the window up to the 16:9 aspect; `n` is the
// integer prescale factor the sharp-bilinear pipeline uses.
function computeLayout(cw, ch, dpr, vw, vh) {
  const availW = Math.max(1, Math.round(cw * dpr));
  const availH = Math.max(1, Math.round(ch * dpr));
  const s = Math.min(availW / vw, availH / vh);
  const devW = Math.min(availW, Math.round(vw * s));
  const devH = Math.min(availH, Math.round(vh * s));
  return {
    devW, devH,
    cssW: devW / dpr, cssH: devH / dpr,
    n: Math.max(1, Math.floor(s)),
  };
}

const Game = {
  canvas: null, ctx: null,
  state: 'boot',
  tick: 0,
  stateT: 0,

  level: null, levelIndex: 0,
  boss: null, bossDownT: 0, bossInT: 0,   // see drawBossBar()
  player: null,
  enemies: [],
  props: [],
  pickups: [],
  camX: 0,
  locked: false, lockX: 0,
  waves: [],
  tokens: new Set(),
  debug: false,
  score: 0, lives: 3,
  menuIndex: 0,
  toast: '', toastT: 0, toastCol: '#7fe08a',
  // full-screen banner - see banner() / drawBanner()
  bannerText: '', bannerSub: '', bannerT: 0, bannerMax: 1,
  _padWas: false,
  storyPage: 0,

  // quip machinery - the words live in QUIPS in levels.js
  quip: '', quipT: 0,          // shown in-world right after a death
  lastDeathQuip: '',           // repeated on the game-over card
  clearQuip: '', winQuip: '',
  _qd: -1, _qc: -1, _qw: -1,   // last generic index used, to avoid repeats
  totalDeaths: 0, levelDeaths: 0,
  dmgTakenThisLevel: 0, maxCombo: 0,
  playStartTick: 0,

  seenPickups: {},             // pickup kinds collected this run
  statNote: null,              // { lines, t } - first-pickup note over his head
  settings: { windowMode: 'fullscreen' },
  selIdx: 0,                   // keyboard/pad cursor on menu screens
  bindKind: 'key',             // which device the bindings screen is editing
  bindAction: null,            // action awaiting capture
  textOps: [],                 // deferred text, drawn at display res in present()
  menuBg: null,
  ncsBadge: null,
  padImg: null,
  mouse: { x: -1, y: -1, over: false, clicked: false },

  // ---- boot ------------------------------------------------------------
  async boot() {
    // Three-canvas pipeline ("sharp bilinear"):
    //   gameCv  384x216      - everything renders here, untouched
    //   midCv   384*N x 216*N - nearest-neighbour integer prescale
    //   #screen               - midCv stretched the last fraction with
    //                           bilinear, sized in real DEVICE pixels
    // Straight integer CSS scaling looked wrong on real monitors: Windows
    // display scaling (125%/150%) makes CSS px != device px, so "5x" landed on
    // fractional pixels and blurred, and non-1080p screens got big black bars.
    // This fills the screen on any resolution and stays crisp, because the
    // blur of the final stretch is spread across N-times-smaller pixels.
    this.canvas = document.getElementById('screen');
    this.view = this.canvas.getContext('2d');
    this.gameCv = document.createElement('canvas');
    this.gameCv.width = VW; this.gameCv.height = VH;
    this.ctx = this.gameCv.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.midCv = document.createElement('canvas');
    this.midCx = this.midCv.getContext('2d');
    this.intScale = 1;
    // Persisted settings. localStorage can throw on some file:// setups.
    try {
      const wm = localStorage.getItem('animalism-windowMode');
      if (wm === 'windowed' || wm === 'fullscreen') this.settings.windowMode = wm;
      const mv = parseFloat(localStorage.getItem('animalism-musicVol'));
      if (!isNaN(mv)) Music.setVolume(mv);
      const sv = parseFloat(localStorage.getItem('animalism-sfxVol'));
      if (!isNaN(sv)) Sfx.setVolume(sv);
    } catch (e) { }
    Input.init();

    const boot = document.getElementById('boot');
    // Make sure the pixel font is ready before the first frame, or the menu
    // would flash Courier for an instant. A failure just falls back.
    try { await document.fonts.load('16px ThaleahFat'); } catch (e) { }
    let extra;
    try {
      extra = await loadAssets((d, t) => { boot.textContent = `LOADING ${d}/${t}`; });
    } catch (e) {
      boot.className = 'err';
      boot.textContent = 'ASSET LOAD FAILED\n\n' + e.message +
        '\n\nIf you opened this from a file:// path and your browser blocks it,\nrun a local server instead:\n\n    python -m http.server 8000';
      return;
    }
    Sfx.preload();
    Stage.init(extra.street, extra.streetFg);
    this.menuBg = extra.menu;
    this.ncsBadge = extra.ncs;
    initProps(extra.props, extra.powerups);
    this.velmaImg = extra.velma;
    this.padImg = extra.pad;
    boot.style.display = 'none';

    // Mouse, so START GAME is clickable. Canvas pixels != CSS pixels (it is
    // scaled by a whole number to fit), so map through the bounding rect.
    const toVirtual = (e) => {
      const r = this.canvas.getBoundingClientRect();
      return {
        x: (e.clientX - r.left) * (VW / r.width),
        y: (e.clientY - r.top) * (VH / r.height),
      };
    };
    this.canvas.addEventListener('mousemove', (e) => {
      const p = toVirtual(e);
      this.mouse.x = p.x; this.mouse.y = p.y;
    });
    this.canvas.addEventListener('mousedown', (e) => {
      const p = toVirtual(e);
      this.mouse.x = p.x; this.mouse.y = p.y;
      this.mouse.clicked = true;
      Sfx.ensure();
    });
    this.canvas.style.cursor = 'pointer';

    this.resize();
    addEventListener('resize', () => this.resize());
    addEventListener('fullscreenchange', () => this.resize());
    addEventListener('keydown', (e) => {
      if (e.code === 'F1') { this.debug = !this.debug; e.preventDefault(); }
      // F11 / Alt+Enter - matters most in the packaged exe, where the point is
      // to fill a TV. Integer scaling is preserved, so it stays crisp.
      if (e.code === 'F11' || (e.altKey && e.code === 'Enter')) {
        e.preventDefault();
        this.toggleFullscreen();
      }
    });
    // First user gesture: unlock audio AND apply the window mode. Fullscreen
    // needs a gesture, so "launch in borderless fullscreen" means "the first
    // key or click goes fullscreen" - the soonest a browser window allows.
    const unlock = (e) => {
      Sfx.ensure();
      Music.unlock();                                        // start any held-back track
      if (!(e && e.code === 'F11')) this.applyWindowMode();  // F11 is its own toggle
      removeEventListener('keydown', unlock);
      removeEventListener('pointerdown', unlock);
    };
    addEventListener('keydown', unlock);
    addEventListener('pointerdown', unlock);

    this.setState('title');
    Music.play('menu');
    this.last = performance.now();
    this.acc = 0;
    requestAnimationFrame((t) => this.frame(t));
  },

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const L = computeLayout(innerWidth, innerHeight, dpr, VW, VH);
    this.canvas.width = L.devW;                  // backing store in device px
    this.canvas.height = L.devH;
    this.canvas.style.width = L.cssW + 'px';     // fractional CSS px is fine -
    this.canvas.style.height = L.cssH + 'px';    // it maps to whole device px
    this.intScale = L.n;
    if (this.midCv.width !== VW * L.n || this.midCv.height !== VH * L.n) {
      this.midCv.width = VW * L.n;
      this.midCv.height = VH * L.n;
    }
    if (this.present) this.present();            // no black flash on resize
  },

  // Blit the finished frame out to the display canvas, then lay the deferred
  // text over it at native resolution so it stays sharp at any scale.
  present() {
    const n = this.intScale;
    this.midCx.imageSmoothingEnabled = false;
    this.midCx.drawImage(this.gameCv, 0, 0, VW * n, VH * n);
    this.view.imageSmoothingEnabled = true;
    this.view.imageSmoothingQuality = 'high';
    this.view.drawImage(this.midCv, 0, 0, this.canvas.width, this.canvas.height);
    this.drawTextOps(this.view, this.canvas.width / VW, this.canvas.height / VH);
  },

  // Make reality match the saved window-mode setting. Only ever called from a
  // user gesture, because that's the only time the browser will obey.
  applyWindowMode() {
    const wantFs = this.settings.windowMode !== 'windowed';
    const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if (wantFs !== isFs) this.toggleFullscreen();
  },

  saveSettings() {
    try {
      localStorage.setItem('animalism-windowMode', this.settings.windowMode);
      localStorage.setItem('animalism-musicVol', String(Music.volume));
      localStorage.setItem('animalism-sfxVol', String(Sfx.volume));
    } catch (e) { }
  },

  // Browsers only let scripts close windows they opened, but app-mode windows
  // usually allow it. If it's refused, tell the player the real way out.
  quitGame() {
    try { window.close(); } catch (e) { }
    setTimeout(() => {
      this.toast = 'BROWSER SAYS NO - USE ALT+F4';
      this.toastCol = '#ffd25a';
      this.toastT = 240;
    }, 300);
  },

  toggleFullscreen() {
    const el = document.documentElement;
    try {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        const req = el.requestFullscreen || el.webkitRequestFullscreen;
        if (req) {
          const p = req.call(el);
          if (p && p.catch) p.catch(() => {});   // no gesture = quiet no-op
        }
      } else {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) exit.call(document);
      }
    } catch (e) { /* fullscreen denied - stay windowed */ }
  },

  setState(s) { this.state = s; this.stateT = 0; },

  frame(now) {
    let dt = now - this.last;
    this.last = now;
    if (dt > 200) dt = 200;             // don't simulate a whole lost tab
    this.acc += dt;
    let steps = 0;
    while (this.acc >= TICK && steps < 5) {
      this.acc -= TICK;
      this.update();
      steps++;
    }
    this.draw();
    requestAnimationFrame((t) => this.frame(t));
  },

  // ---- level setup -----------------------------------------------------
  startLevel(i) {
    this.levelIndex = i;
    this.level = LEVELS[i];
    this.player = this.player || new Player(this.level.startX, this.level.startZ);
    this.player.x = this.level.startX;
    this.player.z = this.level.startZ;
    this.player.y = 0; this.player.vx = this.player.vy = this.player.vz = 0;
    this.player.hp = this.player.maxhp;
    this.player.setState('idle');
    this.player.setAnim('idle', { restart: true });
    this.player.facing = 1;
    this.enemies.length = 0;
    this.pickups.length = 0;
    this.props = (this.level.props || []).map((p) => new Prop(p.t, p.x, p.z));
    this.tokens.clear();
    this.camX = 0;
    this.locked = false;
    this.waves = this.level.waves.map((w) => ({ ...w, spawned: false, cleared: false }));
    this.boss = null;
    this.bossDownT = 0;
    this.bossInT = 0;
    this._bossGhost = undefined;
    this.levelDeaths = 0;
    this.dmgTakenThisLevel = 0;
    this.maxCombo = 0;
    this.clearQuip = '';
    this.quipT = 0;
    Fx.reset();
    Music.play(this.level.round);          // a different track per level
    // The boss gets no round card. Round 3 clears and he is just standing
    // there - no title, no explanation, nothing to read.
    this.setState(this.level.boss ? 'play' : 'intro');
  },

  newGame() {
    this.score = 0;
    this.totalDeaths = 0;
    this.quip = ''; this.lastDeathQuip = ''; this.winQuip = '';
    this.seenPickups = {};
    this.statNote = null;
    this.player = new Player(0, 40);
    this.player.lives = START_LIVES;
    this.bannerT = 0;
    this.startLevel(0);
  },

  // ---------------------------------------------------------------------------
  // Boss bar.
  //
  // Sits across the top under the player's own HUD, full width, so it reads as
  // a different class of thing to the little damage bars the street enemies get
  // over their heads. It slides in over the first half-second, tracks his
  // health with a lagging "damage" ghost behind the fill so a big combo is
  // visible as a chunk coming off, and stays up while he dies rather than
  // vanishing the instant his HP hits zero.
  // ---------------------------------------------------------------------------
  drawBossBar(ctx) {
    const b = this.boss;
    if (!b) return;

    const X = 12, Y = 32, W = VW - 24, H = 22;
    const slide = Math.min(1, this.bossInT / 30);      // drop in on arrival
    const y = Math.round(Y - (1 - slide) * 26);

    ctx.fillStyle = 'rgba(6,4,10,0.78)';
    ctx.fillRect(X, y, W, H);
    ctx.strokeStyle = '#8a2b2b';
    ctx.strokeRect(X + 0.5, y + 0.5, W - 1, H - 1);

    const bx = X + 4, bw = W - 8, by = y + 12, bh = 7;
    ctx.fillStyle = '#2a1010';
    ctx.fillRect(bx, by, bw, bh);

    const hp = Math.max(0, b.hp / b.maxhp);
    ctx.fillStyle = '#e0b040';                       // ghost, ticked in updatePlay
    ctx.fillRect(bx, by, Math.round(bw * (this._bossGhost || 0)), bh);

    // flashes when he is nearly finished
    const low = hp < 0.25 && (this.tick % 10) < 5;
    ctx.fillStyle = low ? '#ff8a6a' : '#c4302b';
    ctx.fillRect(bx, by, Math.round(bw * hp), bh);
    ctx.strokeStyle = 'rgba(255,255,255,0.30)';
    ctx.strokeRect(bx - 0.5, by - 0.5, bw + 1, bh + 1);

    this.text(ctx, b.t.name, VW / 2, y + 10, 9, '#ffe15a', 'center');
  },

  // ---------------------------------------------------------------------------
  // Full-screen banner.
  //
  // The toast in the corner is for housekeeping - a pad connecting, the browser
  // refusing to close. Finding a Django is the rarest thing that happens in a
  // run and it was being announced in 7px type at the bottom of the screen,
  // where you would never see it mid-fight. This is the other extreme: a band
  // across the full width, flashing, unmissable, and it fires every time rather
  // than only when there was nobody left to knock down.
  // ---------------------------------------------------------------------------
  banner(text, sub, ticks) {
    this.bannerText = text;
    this.bannerSub = sub || '';
    this.bannerT = ticks || 180;
    this.bannerMax = this.bannerT;
  },

  drawBanner(ctx) {
    if (this.bannerT <= 0) return;
    const age = this.bannerMax - this.bannerT;
    // slam in, hold, fade out - so it never just blinks out mid-flash
    const a = Math.min(1, age / 5, this.bannerT / 22);
    const on = (this.bannerT % 8) < 4;

    ctx.globalAlpha = a;
    // Both flash states stay dark and the TEXT does the flashing. Alternating
    // the band light/dark instead looked right over the road but the light
    // frame vanished against the pale sky at the top of the level, which is
    // exactly where this thing has to be readable.
    ctx.fillStyle = on ? 'rgba(58,20,2,0.80)' : 'rgba(6,4,10,0.76)';
    ctx.fillRect(0, 78, VW, 48);
    ctx.fillStyle = on ? '#fff' : '#ffb45a';
    ctx.fillRect(0, 78, VW, 1);
    ctx.fillRect(0, 125, VW, 1);

    this.text(ctx, this.bannerText, VW / 2, 108, 22,
              on ? '#fff' : '#ffb45a', 'center');
    if (this.bannerSub) {
      this.text(ctx, this.bannerSub, VW / 2, 121, 8, '#ffe15a', 'center');
    }
    ctx.globalAlpha = 1;
  },

  // random pick that never repeats the previous one
  pickQuip(arr, lastKey) {
    let i = (Math.random() * arr.length) | 0;
    if (arr.length > 1 && i === this[lastKey]) i = (i + 1) % arr.length;
    this[lastKey] = i;
    return arr[i];
  },

  // Called the moment a hit kills the player. Most specific condition wins;
  // otherwise rotate the generics.
  onPlayerDied(killer) {
    this.totalDeaths++;
    this.levelDeaths++;
    const alive = this.enemies.filter((e) => e.alive);
    let q;
    if (this.levelDeaths >= 3)                             q = QUIPS.deathCond.wall;
    else if (this.tick - this.playStartTick < 900)         q = QUIPS.deathCond.fast;
    else if (alive.some((e) => e.hp / e.maxhp <= 0.12))    q = QUIPS.deathCond.almost;
    else if (alive.length >= 4)                            q = QUIPS.deathCond.crowd;
    else if (killer && killer.typeKey === 'punk')          q = QUIPS.deathCond.scrub;
    else if (this.level.round === '1')                     q = QUIPS.deathCond.level1;
    else                                                   q = this.pickQuip(QUIPS.death, '_qd');
    this.quip = q;
    this.quipT = 210;
    this.lastDeathQuip = q;
  },

  pickClearQuip() {
    const p = this.player;
    const elapsed = this.tick - this.playStartTick;
    if (this.dmgTakenThisLevel === 0)                      return QUIPS.clearCond.perfect;
    if (p.hp <= 15)                                        return QUIPS.clearCond.clutch;
    if (this.levelDeaths >= 3)                             return QUIPS.clearCond.revenge;
    if (elapsed < 2400)                                    return QUIPS.clearCond.fast;
    if (this.maxCombo >= 12)                               return QUIPS.clearCond.combo;
    if (this.levelDeaths === 0 && this.totalDeaths > 0)    return QUIPS.clearCond.oneLife;
    return this.pickQuip(QUIPS.clear, '_qc');
  },

  // ---- attack tokens ---------------------------------------------------
  requestToken(e) {
    if (this.tokens.has(e)) return true;
    const alive = this.enemies.reduce((n, x) => n + (x.alive ? 1 : 0), 0);
    if (this.tokens.size >= maxTokens(alive)) return false;
    this.tokens.add(e);
    e.hasToken = true;
    return true;
  },
  releaseToken(e) {
    if (this.tokens.delete(e)) e.hasToken = false;
    else e.hasToken = false;
  },

  onEnemyKilled(e) {
    this.score += e.t.score;
    Fx.popup(e.x, e.screenY - 50, '+' + e.t.score, '#ffe15a');
  },

  // ---- update ----------------------------------------------------------
  update() {
    Input.update();
    this.tick++;
    this.stateT++;

    // watch for a controller arriving or leaving
    if (Input.padConnected !== this._padWas) {
      this._padWas = Input.padConnected;
      if (Input.padConnected) {
        this.toast = 'CONTROLLER CONNECTED';
        this.toastCol = '#7fe08a';
      } else {
        this.toast = 'CONTROLLER REMOVED - USING KEYBOARD';
        this.toastCol = '#ffd25a';
      }
      this.toastT = 180;
    }
    if (this.toastT > 0) this.toastT--;
    if (this.bannerT > 0) this.bannerT--;

    switch (this.state) {
      case 'title': {
        // Click the button, or just press start / punch / jump.
        const b = START_BUTTON;
        const over = this.mouse.x >= b.x && this.mouse.x <= b.x + b.w &&
                     this.mouse.y >= b.y && this.mouse.y <= b.y + b.h;
        this.mouse.over = over;
        if ((over && this.mouse.clicked) ||
            Input.pressed.start || Input.pressed.light || Input.pressed.jump) {
          Sfx.start();
          // A gesture, so the window mode can be enforced (no-op if the
          // trigger was a gamepad - browsers don't count that as a gesture).
          this.applyWindowMode();
          this.storyPage = 0;
          this.setState('story');
        }
        // settings button
        const sb = SETTINGS_BUTTON;
        this.mouse.overSettings =
          this.mouse.x >= sb.x && this.mouse.x <= sb.x + sb.w &&
          this.mouse.y >= sb.y && this.mouse.y <= sb.y + sb.h;
        if (this.mouse.overSettings && this.mouse.clicked) {
          Sfx.menu();
          this.selIdx = 0;
          this.setState('settings');
        }
        // quit button - absent on the web build, so nothing to hit there
        const qb = QUIT_BUTTON;
        this.mouse.overQuit = CAN_QUIT &&
          this.mouse.x >= qb.x && this.mouse.x <= qb.x + qb.w &&
          this.mouse.y >= qb.y && this.mouse.y <= qb.y + qb.h;
        if (this.mouse.overQuit && this.mouse.clicked) {
          this.quitGame();
        }
        break;
      }

      case 'settings': {
        // Navigable by mouse OR up/down + punch, so a pad alone can drive it.
        const n = SET_ROWS + 1;                       // + BACK
        this.mouse.hoverIdx = -1;
        for (let i = 0; i < SET_ROWS; i++) {
          if (inRect(this.mouse, settingsRow(i))) { this.mouse.hoverIdx = i; this.selIdx = i; }
        }
        if (inRect(this.mouse, BACK_BUTTON)) { this.mouse.hoverIdx = SET_ROWS; this.selIdx = SET_ROWS; }
        if (Input.pressed.up) { this.selIdx = (this.selIdx + n - 1) % n; Sfx.menu(); }
        if (Input.pressed.down) { this.selIdx = (this.selIdx + 1) % n; Sfx.menu(); }

        // Volume rows take left/right to nudge, and a click on the left or
        // right half of the row does the same - that's what the < > mean.
        const volRow = this.selIdx === SET_MUSIC || this.selIdx === SET_SFX;
        let delta = 0;
        if (volRow) {
          if (Input.pressed.left) delta = -VOL_STEP;
          if (Input.pressed.right) delta = VOL_STEP;
          if (this.mouse.clicked && this.mouse.hoverIdx === this.selIdx) {
            const r = settingsRow(this.selIdx);
            delta = this.mouse.x < r.x + r.w / 2 ? -VOL_STEP : VOL_STEP;
          }
        }
        if (delta !== 0) {
          if (this.selIdx === SET_MUSIC) Music.setVolume(Music.volume + delta);
          else Sfx.setVolume(Sfx.volume + delta);
          this.saveSettings();
          Sfx.menu();                                  // audible at the new level
          break;
        }

        const act = (this.mouse.clicked && this.mouse.hoverIdx >= 0) ||
                    Input.pressed.light || Input.pressed.start;
        if (act) {
          Sfx.menu();
          const i = this.mouse.clicked && this.mouse.hoverIdx >= 0 ? this.mouse.hoverIdx : this.selIdx;
          if (i === SET_WM) {
            this.settings.windowMode =
              this.settings.windowMode === 'windowed' ? 'fullscreen' : 'windowed';
            this.saveSettings();
            this.applyWindowMode();    // click/key = gesture, applies instantly
          } else if (i === SET_KB) { this.bindKind = 'key'; this.selIdx = 0; this.setState('bindings'); }
          else if (i === SET_PAD) { this.bindKind = 'pad'; this.selIdx = 0; this.setState('bindings'); }
          else if (i === SET_ROWS) { this.setState('title'); }
        }
        if (Input.pressed.back) { Sfx.menu(); this.setState('title'); }
        break;
      }

      case 'bindings': {
        const actions = this.bindKind === 'key' ? REBIND_KEY : REBIND_PAD;
        const n = actions.length + 2;                    // + reset + back
        this.mouse.hoverIdx = -1;
        // pad bindings are chips under the controller diagram, keys are rows
        const rowRect = this.bindKind === 'key' ? bindRowRect : padChipRect;
        for (let i = 0; i < actions.length; i++) {
          if (inRect(this.mouse, rowRect(i))) { this.mouse.hoverIdx = i; this.selIdx = i; }
        }
        if (inRect(this.mouse, RESET_BTN)) { this.mouse.hoverIdx = actions.length; this.selIdx = actions.length; }
        if (inRect(this.mouse, BBACK_BTN)) { this.mouse.hoverIdx = actions.length + 1; this.selIdx = actions.length + 1; }
        // the pad chips sit in a row, so left/right walks them too
        const bPrev = Input.pressed.up || (this.bindKind === 'pad' && Input.pressed.left);
        const bNext = Input.pressed.down || (this.bindKind === 'pad' && Input.pressed.right);
        if (bPrev) { this.selIdx = (this.selIdx + n - 1) % n; Sfx.menu(); }
        if (bNext) { this.selIdx = (this.selIdx + 1) % n; Sfx.menu(); }
        const act = (this.mouse.clicked && this.mouse.hoverIdx >= 0) ||
                    Input.pressed.light || Input.pressed.start;
        if (act) {
          const i = this.mouse.clicked && this.mouse.hoverIdx >= 0 ? this.mouse.hoverIdx : this.selIdx;
          Sfx.menu();
          if (i < actions.length) {
            this.bindAction = actions[i];
            if (this.bindKind === 'key') { Input.wantKeyCapture = true; Input.capturedKey = null; }
            this.setState('bindcapture');
          } else if (i === actions.length) {
            Input.resetBinds(this.bindKind);
          } else {
            this.selIdx = this.bindKind === 'key' ? 1 : 2;
            this.setState('settings');
          }
        }
        if (Input.pressed.back) {
          Sfx.menu();
          this.selIdx = this.bindKind === 'key' ? 1 : 2;
          this.setState('settings');
        }
        break;
      }

      case 'bindcapture': {
        if (this.bindKind === 'key') {
          if (Input.capturedKey) {
            const code = Input.capturedKey;
            Input.capturedKey = null;
            Input.wantKeyCapture = false;
            if (code !== 'Escape') {
              Input.setBind('key', this.bindAction, code);
              Sfx.pickup();
            }
            this.setState('bindings');
          }
        } else {
          const b = Input.rawPadPressed;
          if (b !== null && PAD_RESERVED.indexOf(b) < 0) {
            Input.setBind('pad', this.bindAction, b);
            Sfx.pickup();
            this.setState('bindings');
          } else if (Input.pressed.back) {   // Esc or Select cancels
            this.setState('bindings');
          }
        }
        // mouse click outside = cancel too
        if (this.state === 'bindcapture' && this.mouse.clicked) {
          Input.wantKeyCapture = false; Input.capturedKey = null;
          this.setState('bindings');
        }
        break;
      }

      case 'story':
        // any input advances; runs out into the game
        if (this.stateT > 12 && (Input.anyPressed() || this.mouse.clicked)) {
          this.storyPage++;
          Sfx.menu();
          this.stateT = 0;
          if (this.storyPage >= STORY.length) this.newGame();
        }
        break;

      case 'outro':
        if (this.stateT > 12 && (Input.anyPressed() || this.mouse.clicked)) {
          this.storyPage++;
          Sfx.menu();
          this.stateT = 0;
          if (this.storyPage >= ENDING.length) { Music.duck(false); this.setState('ending'); }
        }
        break;

      case 'intro':
        if (this.stateT > 108 || Input.pressed.start) {
          this.setState('play');
          this.playStartTick = this.tick;    // quip timers measure from here
        }
        break;

      case 'play':    this.updatePlay(); break;

      case 'clear':
        if (this.stateT > 150 || Input.pressed.start) {
          if (this.levelIndex + 1 < LEVELS.length) this.startLevel(this.levelIndex + 1);
          else {
            this.storyPage = 0;
            this.winQuip = this.pickQuip(QUIPS.win, '_qw');
            Music.duck(true);              // let the outro cards breathe
            this.setState('outro');
          }
        }
        break;

      case 'ending':
      case 'gameover':
        if (this.stateT > 90 && (Input.pressed.start || Input.pressed.light)) {
          Music.play('menu');
          this.setState('title');
        }
        break;

      case 'pause': {
        const btns = [PAUSE_RESUME, PAUSE_QUIT];
        this.mouse.hoverIdx = -1;
        for (let i = 0; i < btns.length; i++) {
          if (inRect(this.mouse, btns[i])) { this.mouse.hoverIdx = i; this.selIdx = i; }
        }
        if (Input.pressed.up) { this.selIdx = (this.selIdx + 1) % 2; Sfx.menu(); }
        if (Input.pressed.down) { this.selIdx = (this.selIdx + 1) % 2; Sfx.menu(); }
        // Esc/Start always resumes, so pausing can never trap you
        if (Input.pressed.back) { Sfx.menu(); Music.duck(false); this.setState('play'); break; }
        const act = (this.mouse.clicked && this.mouse.hoverIdx >= 0) ||
                    Input.pressed.light || Input.pressed.start;
        if (act) {
          const i = this.mouse.clicked && this.mouse.hoverIdx >= 0 ? this.mouse.hoverIdx : this.selIdx;
          Sfx.menu();
          if (i === 0) { Music.duck(false); this.setState('play'); }
          else { Music.duck(false); Music.play('menu'); this.setState('title'); }
        }
        break;
      }
    }

    Fx.update();
    if (this.quipT > 0) this.quipT--;
    this.mouse.clicked = false;      // consume the click after everyone's seen it
  },

  updatePlay() {
    if (Input.pressed.back) {
      Sfx.menu();
      Music.duck(true);              // drop the music under the pause menu
      this.selIdx = 0;
      this.setState('pause');
      return;
    }

    // hitstop: freeze the simulation but keep sparks and shake alive
    if (Fx.hitstop > 0) { Fx.hitstop--; return; }

    const p = this.player;

    // ---- respawn / game over ----
    if (p.state === 'dead') {
      if (p.stateT > 110) {
        p.lives--;
        if (p.lives < 0) { Music.stop(); Sfx.gameOver(); this.setState('gameover'); return; }
        p.reviveAt(this.camX + 60, 42);
      }
    }

    // ---- waves ----
    for (const w of this.waves) {
      if (!w.spawned && p.x >= w.at) {
        w.spawned = true;
        if (w.lock) { this.locked = true; this.lockX = Math.round(this.camX); }
        for (const s of w.spawn) {
          const z = s.z == null ? Math.random() * BELT_DEPTH : s.z;
          const x = s.side === 'l' ? this.camX - 24 : this.camX + VW + 24;
          const e = new Enemy(s.t, x, z);
          // Held separately from this.enemies so the bar survives him being
          // filtered out after his body fades.
          if (e.t.boss) this.boss = e;
          this.enemies.push(e);
        }
      }
    }
    if (this.boss) {
      this.bossInT++;
      if (!this.boss.alive) this.bossDownT++;
      // Lagging "damage" ghost behind the health fill, so a combo reads as a
      // chunk coming off rather than the bar just being shorter. Ticked here
      // and not in drawBossBar because a draw-rate decay drifts with the frame
      // rate - and left the bar sitting full-yellow over his corpse.
      const hp = Math.max(0, this.boss.hp / this.boss.maxhp);
      if (this._bossGhost === undefined || this._bossGhost < hp) this._bossGhost = hp;
      this._bossGhost = Math.max(hp, this._bossGhost - (this.boss.alive ? 0.006 : 0.03));
    }
    if (this.locked && this.enemies.filter((e) => e.alive).length === 0) {
      const cur = this.waves.filter((w) => w.spawned && !w.cleared);
      cur.forEach((w) => { w.cleared = true; });
      this.locked = false;
    }

    // ---- camera ----
    const camMax = Math.min(this.level.len - VW, Stage.maxCamX(this.level));
    if (this.locked) {
      this.camX = Math.max(0, Math.min(camMax, this.lockX));
    } else {
      const want = p.x - VW * 0.42;
      this.camX += (want - this.camX) * 0.12;
      this.camX = Math.max(0, Math.min(camMax, this.camX));
    }

    // ---- actors ----
    const pBounds = [this.camX + 10, this.camX + VW - 10];
    const threat = this.enemies.some((e) => e.alive && Math.abs(e.x - p.x) < 74);
    p.update(pBounds, threat);

    const eBounds = [this.camX - 40, this.camX + VW + 40];
    for (const e of this.enemies) e.update(this, p, eBounds);

    for (const pr of this.props) pr.update();
    for (const pu of this.pickups) pu.update(p, this);
    this.pickups = this.pickups.filter((pu) => !pu.dead);
    if (this.statNote && this.statNote.t > 0) this.statNote.t--;

    this.separate();
    this.resolveHits();

    this.enemies = this.enemies.filter((e) => {
      if (e.removeMe) { this.tokens.delete(e); return false; }
      return true;
    });

    // ---- level complete ----
    // Normally you have to walk to the end of the street. The boss arena is one
    // screen wide with nowhere to walk to, so it ends when he does - and with a
    // beat of delay, so his collapse actually plays out on screen.
    const allDone = this.waves.every((w) => w.spawned && (!w.lock || w.cleared));
    const done = this.level.boss
      ? (allDone && !this.locked && this.bossDownT > 70)
      : (allDone && !this.locked && p.x >= this.level.len - 70);
    if (done && p.state !== 'dead') {
      this.clearQuip = this.pickClearQuip();
      Sfx.clear();
      this.setState('clear');
    }
  },

  // Keep bodies from occupying the same spot - stops enemies stacking into
  // one silhouette, which would make the crowd unreadable.
  separate() {
    const all = [this.player, ...this.enemies].filter(
      (a) => a.state !== 'dead' && a.y < 12);
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j];
        if (Math.abs(a.z - b.z) > 10) continue;
        const minD = (a.bodyW + b.bodyW) * 0.45;
        const d = b.x - a.x;
        const ad = Math.abs(d);
        if (ad >= minD || ad < 0.001) continue;
        const push = (minD - ad) * 0.5;
        const s = Math.sign(d) || 1;
        // the player shoves, rather than being shoved
        if (a === this.player) { b.x += push * s * 1.6; }
        else if (b === this.player) { a.x -= push * s * 1.6; }
        else { a.x -= push * s; b.x += push * s; }
      }
    }
  },

  resolveHits() {
    const p = this.player;

    // player -> enemies
    if (p.state === 'attack' && p.move) {
      const hb = p.activeHitbox(p.move);
      if (hb) {
        for (const e of this.enemies) {
          if (!e.alive || p.hitSet.has(e)) continue;
          if (!boxesOverlap(hb, e.hurtbox())) continue;
          p.hitSet.add(e);
          // Iron Grip scales the damage, not the knockback or the hitstop
          const spec = p.dmgMult === 1
            ? hb.spec
            : Object.assign({}, hb.spec, { dmg: Math.round(hb.spec.dmg * p.dmgMult) });
          if (e.takeHit(spec, p.x, this)) {
            const ix = (p.x + e.x) / 2 + p.facing * 4;
            const iy = e.screenY - 26 - Math.random() * 8;
            Fx.spark(ix, iy, spec.heavy);
            Fx.stop(spec.hitstop);
            Fx.shake(spec.heavy ? 3.2 : 1.6, spec.heavy ? 12 : 7);
            if (spec.heavy) Sfx.hitHeavy(); else Sfx.hit();
            // combo = hits landed without getting hit back
            p._combo = (p._combo || 0) + 1;
            if (p._combo > this.maxCombo) this.maxCombo = p._combo;
          }
        }
        // same swing smashes scenery
        for (const pr of this.props) {
          if (!pr.hittable || p.hitSet.has(pr)) continue;
          if (!boxesOverlap(hb, pr.hurtbox())) continue;
          p.hitSet.add(pr);
          if (pr.hit(hb.spec, this)) {
            Fx.stop(3);
            Fx.spark((p.x + pr.x) / 2, pr.screenY - pr.d.h * 0.6, false);
          }
        }
      }
    }

    // enemies -> player
    for (const e of this.enemies) {
      if (e.state !== 'attack') continue;
      const hb = e.activeHitbox(e.move);
      if (!hb) continue;
      if (e.hitSet.has(p)) continue;
      if (!boxesOverlap(hb, p.hurtbox())) continue;
      e.hitSet.add(p);
      const spec = hb.spec;
      if (p.takeHit(spec, e.x)) {
        const ix = (p.x + e.x) / 2;
        Fx.spark(ix, p.screenY - 26, false);
        Fx.stop(spec.hitstop);
        Fx.flash = 3;
        this.dmgTakenThisLevel += spec.dmg;
        p._combo = 0;
        if (p.state === 'dead') this.onPlayerDied(e);
      }
    }
  },

  // ---- draw ------------------------------------------------------------
  draw() {
    this.textOps.length = 0;   // text is deferred and drawn crisp in present()
    this.render();
    this.present();
  },

  // For tests/captures: the full frame (world + text) composited at 1x.
  snapshot() {
    const cv = document.createElement('canvas');
    cv.width = VW; cv.height = VH;
    const cx = cv.getContext('2d');
    cx.imageSmoothingEnabled = false;
    cx.drawImage(this.gameCv, 0, 0);
    this.drawTextOps(cx, 1, 1);
    return cv;
  },

  drawTextOps(ctx, sx, sy) {
    const shadowPx = Math.max(1, Math.round(sy));
    for (const o of this.textOps) {
      // ThaleahFat is a pixel font - blocky at any size, no bold synthesis
      // needed (it's already fat). Its glyphs run small for their em size, so
      // scale up a third to match the old Courier layout metrics.
      ctx.font = `${Math.max(8, Math.round(o.size * 1.34 * sy))}px ThaleahFat, "Courier New", monospace`;
      ctx.textAlign = o.align || 'left';
      const x = o.x * sx, y = o.y * sy;
      ctx.globalAlpha = o.alpha;
      if (o.shadow) {
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillText(o.s, x + shadowPx, y + shadowPx);
      }
      ctx.fillStyle = o.col;
      ctx.fillText(o.s, x, y);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left';
  },

  render() {
    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, VW, VH);

    if (this.state === 'title') { this.drawTitle(ctx); ctx.restore(); return; }
    if (this.state === 'settings') { this.drawSettings(ctx); ctx.restore(); return; }
    if (this.state === 'bindings' || this.state === 'bindcapture') {
      this.drawBindings(ctx); ctx.restore(); return;
    }
    if (this.state === 'story') { this.drawStory(ctx, STORY[this.storyPage], STORY.length); ctx.restore(); return; }
    if (this.state === 'outro') { this.drawStory(ctx, ENDING[this.storyPage], ENDING.length, true); ctx.restore(); return; }
    if (this.state === 'gameover') {
      ctx.fillStyle = '#0a0a12';                  // canvas is cleared to
      ctx.fillRect(0, 0, VW, VH);                 // transparent, so paint it
      this.drawCenterCard(ctx, 'GAME OVER', '#e04040', Input.prompts().start);
      if (this.lastDeathQuip) {
        this.text(ctx, this.lastDeathQuip, VW / 2, 118, 8, '#9aa8ba', 'center');
      }
      ctx.restore(); return;
    }
    if (this.state === 'ending') { this.drawEnding(ctx); ctx.restore(); return; }

    const sh = Fx.shakeOffset();
    ctx.translate(Math.round(sh.x), Math.round(sh.y));

    Stage.draw(ctx, this.camX, this.level);

    // Everything on the belt sorted back-to-front, with the foreground layer
    // (lamp posts, tree trunks) slotted in at its own depth FG_Z: stand behind
    // a lamp and it covers you, walk into the street in front of it and you
    // cover it.
    const paint = [this.player, ...this.enemies,
                   ...this.props.filter((p) => !p.dead), ...this.pickups]
      .sort((a, b) => a.z - b.z);
    for (const a of paint) if (a.drawShadow) a.drawShadow(ctx, this.camX);
    for (const a of paint) if (a.z < FG_Z) a.draw(ctx, this.camX);
    Stage.drawForeground(ctx, this.camX, this.level);
    for (const a of paint) if (a.z >= FG_Z) a.draw(ctx, this.camX);

    Fx.draw(ctx, this.camX);

    // first-pickup stat note, floating over his head
    if (this.statNote && this.statNote.t > 0 && this.player) {
      const n = this.statNote;
      const a = Math.min(1, n.t / 30);
      // clamped so the longest line ("FLATTENS EVERY DUDE ON SCREEN") stays
      // fully on screen when he's near an edge
      const sx = Math.max(76, Math.min(VW - 76,
        Math.round(this.player.x - this.camX)));
      const sy = Math.round(this.player.screenY - this.player.bodyH - 24);
      ctx.globalAlpha = a;
      this.text(ctx, n.lines[0], sx, sy, 9, '#ffe15a', 'center');
      if (n.lines[1]) this.text(ctx, n.lines[1], sx, sy + 11, 7, '#dfe7f2', 'center');
      ctx.globalAlpha = 1;
    }

    Stage.drawGrade(ctx, this.level);

    if (this.debug) this.drawDebug(ctx);

    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (Fx.flash > 0) {
      ctx.fillStyle = 'rgba(255,90,90,0.22)';
      ctx.fillRect(0, 0, VW, VH);
    }

    this.drawHud(ctx);
    this.drawBanner(ctx);

    // death commentary, on the street while he's down
    if (this.quipT > 0 && this.state === 'play') {
      const a = Math.min(1, this.quipT / 30);
      ctx.globalAlpha = a;
      this.text(ctx, this.quip, VW / 2, VH - 10, 8, '#ffd8a8', 'center');
      ctx.globalAlpha = 1;
    }

    if (this.state === 'intro') this.drawIntro(ctx);
    if (this.state === 'clear') {
      this.drawCenterCard(ctx, 'ROUND CLEAR', '#ffe15a', null);
      if (this.clearQuip) {
        this.text(ctx, this.clearQuip, VW / 2, 146, 8, '#c8d6e8', 'center');
      }
    }
    if (this.state === 'pause') {
      ctx.fillStyle = 'rgba(0,0,0,0.62)';
      ctx.fillRect(0, 0, VW, VH);
      this.text(ctx, 'PAUSED', VW / 2, 84, 14, '#fff', 'center');
      const items = [[PAUSE_RESUME, 'RESUME', 0], [PAUSE_QUIT, 'MAIN MENU', 1]];
      for (const [r, label, idx] of items) {
        const hot = this.selIdx === idx || this.mouse.hoverIdx === idx;
        ctx.fillStyle = hot ? 'rgba(255,225,90,0.90)' : 'rgba(10,14,24,0.72)';
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.strokeStyle = hot ? '#fff' : '#7f96b8';
        ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
        this.text(ctx, label, r.x + r.w / 2, r.y + 13, 9,
                  hot ? '#1a1206' : '#c8d6e8', 'center');
      }
      this.text(ctx, 'MAIN MENU ENDS THIS RUN', VW / 2, 156, 7, '#7f96b8', 'center');
    }

    ctx.restore();
  },

  // Text is NOT drawn into the 384x216 world canvas - 8px glyphs upscaled 5x
  // came out as antialiased mush. Calls are recorded here and drawn once, at
  // full display resolution, in present(). Coordinates stay in virtual space,
  // so no layout changed; the current globalAlpha is captured for fades.
  text(ctx, s, x, y, size, col, align, shadow) {
    this.textOps.push({
      s: String(s), x, y, size, col,
      align: align || 'left',
      shadow: shadow !== false,
      alpha: ctx.globalAlpha,
    });
  },

  drawHud(ctx) {
    const p = this.player;
    // health
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fillRect(6, 6, 122, 22);
    this.text(ctx, 'ANIMAL', 10, 16, 8, '#ffe15a');
    const w = 106, hp = Math.max(0, p.hp / p.maxhp);
    ctx.fillStyle = '#2a1010';
    ctx.fillRect(10, 19, w, 6);
    ctx.fillStyle = hp > 0.3 ? '#41d24a' : '#e04040';
    ctx.fillRect(10, 19, Math.round(w * hp), 6);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.strokeRect(9.5, 18.5, w + 1, 7);

    // lives
    for (let i = 0; i < Math.max(0, p.lives); i++) {
      ctx.fillStyle = '#ffe15a';
      ctx.fillRect(132 + i * 7, 20, 4, 5);
    }

    // Iron Grip timer, so you know how long you've got
    if (p.grippyT > 0) {
      const frac = p.grippyT / GRIPPY_TICKS;
      ctx.fillStyle = 'rgba(0,0,0,0.62)';
      ctx.fillRect(6, 31, 62, 11);
      this.text(ctx, 'GRIP', 9, 40, 7, '#ffe15a');
      ctx.fillStyle = '#3a2f10';
      ctx.fillRect(34, 34, 30, 5);
      ctx.fillStyle = p.grippyT < 120 && (this.tick % 8) < 4 ? '#fff' : '#ffe15a';
      ctx.fillRect(34, 34, Math.round(30 * frac), 5);
    }

    // score + round
    this.text(ctx, String(this.score).padStart(6, '0'), VW - 8, 16, 9, '#fff', 'right');
    this.text(ctx, `ROUND ${this.level.round}`, VW - 8, 27, 7, '#9ac', 'right');

    this.drawBossBar(ctx);

    // GO arrow - the only progression cue, and it teaches the lock rule.
    // Never on the boss screen: there is nowhere to go, and it would flash up
    // in the gap between him dying and the level ending.
    const allDone = this.waves.every((w) => w.spawned && (!w.lock || w.cleared));
    if (!this.level.boss && !this.locked && this.state === 'play' && (this.tick % 40) < 26) {
      const atEnd = allDone && p.x >= this.level.len - 260;
      this.text(ctx, atEnd ? 'GO!' : 'GO', VW - 34, 56, 13, '#ffe15a', 'center');
      ctx.fillStyle = '#ffe15a';
      ctx.beginPath();
      ctx.moveTo(VW - 18, 46); ctx.lineTo(VW - 8, 51); ctx.lineTo(VW - 18, 56);
      ctx.closePath(); ctx.fill();
    }
    // How many are left to clear. Suppressed on the boss screen - "1 LEFT"
    // over his name bar is both obvious and in the way.
    if (this.locked && this.state === 'play' && !this.level.boss) {
      const n = this.enemies.filter((e) => e.alive).length;
      this.text(ctx, `${n} LEFT`, VW / 2, 20, 9, '#ff8a8a', 'center');
    }

    // Acknowledge a pad being plugged in or pulled out mid-game, so the player
    // knows which control set is live without pausing to check the title.
    if (this.toastT > 0) {
      this.text(ctx, this.toast, 6, VH - 6, 7, this.toastCol, 'left');
    }
  },

  // shared row chrome for the settings screens
  drawRow(ctx, r, hot, label, value) {
    ctx.fillStyle = hot ? 'rgba(255,225,90,0.14)' : 'rgba(255,255,255,0.05)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = hot ? '#ffe15a' : 'rgba(255,255,255,0.25)';
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    this.text(ctx, label, r.x + 8, r.y + r.h - 5, 8, hot ? '#dfe7f2' : '#7f96b8', 'left');
    if (value) this.text(ctx, value, r.x + r.w - 8, r.y + r.h - 5, 8, '#ffe15a', 'right');
  },

  drawSettings(ctx) {
    if (this.menuBg) ctx.drawImage(this.menuBg, 0, 0, VW, VH);
    ctx.fillStyle = 'rgba(4,6,14,0.86)';
    ctx.fillRect(0, 0, VW, VH);
    this.text(ctx, 'SETTINGS', VW / 2, 32, 16, '#ffe15a', 'center');

    const hi = (i) => this.selIdx === i || this.mouse.hoverIdx === i;
    const pct = (v) => Math.round(v * 100) + '%';
    const wmVal = this.settings.windowMode === 'windowed' ? 'WINDOWED' : 'BORDERLESS FULLSCREEN';
    this.drawRow(ctx, settingsRow(SET_WM), hi(SET_WM), 'WINDOW MODE', '< ' + wmVal + ' >');
    this.drawRow(ctx, settingsRow(SET_MUSIC), hi(SET_MUSIC), 'MUSIC VOLUME', '< ' + pct(Music.volume) + ' >');
    this.drawRow(ctx, settingsRow(SET_SFX), hi(SET_SFX), 'SOUND VOLUME', '< ' + pct(Sfx.volume) + ' >');
    this.drawRow(ctx, settingsRow(SET_KB), hi(SET_KB), 'KEYBOARD CONTROLS', '>');
    this.drawRow(ctx, settingsRow(SET_PAD), hi(SET_PAD), 'CONTROLLER CONTROLS', '>');

    // volume meters, drawn inside their rows so the level is visible at a glance
    for (const [idx, v] of [[SET_MUSIC, Music.volume], [SET_SFX, Sfx.volume]]) {
      const r = settingsRow(idx);
      const bw = 60, bx = r.x + r.w - 108, by = r.y + r.h / 2 - 2;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(bx, by, bw, 4);
      ctx.fillStyle = '#ffe15a';
      ctx.fillRect(bx, by, Math.round(bw * v), 4);
    }

    this.text(ctx, 'F11 TOGGLES FULLSCREEN ANYTIME', VW / 2, 148, 7, '#5f7490', 'center');

    const bk = BACK_BUTTON, bHot = hi(SET_ROWS);
    ctx.fillStyle = bHot ? 'rgba(200,214,232,0.88)' : 'rgba(10,14,24,0.62)';
    ctx.fillRect(bk.x, bk.y, bk.w, bk.h);
    ctx.strokeStyle = bHot ? '#fff' : '#7f96b8';
    ctx.strokeRect(bk.x + 0.5, bk.y + 0.5, bk.w - 1, bk.h - 1);
    this.text(ctx, 'BACK', bk.x + bk.w / 2, bk.y + 13, 8,
              bHot ? '#1a1206' : '#c8d6e8', 'center');
  },

  drawBindings(ctx) {
    if (this.menuBg) ctx.drawImage(this.menuBg, 0, 0, VW, VH);
    ctx.fillStyle = 'rgba(4,6,14,0.90)';
    ctx.fillRect(0, 0, VW, VH);
    const kb = this.bindKind === 'key';
    // The diagram needs nearly the full height, so its title tucks up against
    // the top edge instead of sitting in the keyboard screen's roomier gap.
    this.text(ctx, kb ? 'KEYBOARD CONTROLS' : 'CONTROLLER CONTROLS',
              VW / 2, kb ? 30 : 13, 13, '#ffe15a', 'center');

    const actions = kb ? REBIND_KEY : REBIND_PAD;
    const hi = (i) => this.selIdx === i || this.mouse.hoverIdx === i;
    if (kb) {
      for (let i = 0; i < actions.length; i++) {
        this.drawRow(ctx, bindRowRect(i), hi(i),
                     ACTION_LABEL[actions[i]], Input.bindLabel('key', actions[i]));
      }
    } else {
      this.drawPadDiagram(ctx, actions, hi);
    }
    for (const [r, label, idx] of [[RESET_BTN, 'RESET DEFAULTS', actions.length],
                                   [BBACK_BTN, 'BACK', actions.length + 1]]) {
      const hot = hi(idx);
      ctx.fillStyle = hot ? 'rgba(200,214,232,0.88)' : 'rgba(10,14,24,0.62)';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = hot ? '#fff' : '#7f96b8';
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      this.text(ctx, label, r.x + r.w / 2, r.y + 12, 8, hot ? '#1a1206' : '#c8d6e8', 'center');
    }

    if (this.state === 'bindcapture') {
      ctx.fillStyle = 'rgba(4,6,14,0.85)';
      ctx.fillRect(0, 0, VW, VH);
      const what = kb ? 'PRESS A KEY' : 'PRESS A BUTTON';
      this.text(ctx, what + ' FOR ' + ACTION_LABEL[this.bindAction],
                VW / 2, 100, 12, '#fff', 'center');
      this.text(ctx, 'ESC CANCELS', VW / 2, 122, 8, '#7f96b8', 'center');
    }
  },

  // ---------------------------------------------------------------------------
  // The controller half of the bindings screen.
  //
  // A list of four rows told you which button an action was on but not where
  // that button is, which is the thing you actually want to know while holding
  // the pad. The diagram answers both: every callout reads "<BUTTON>  <WHAT IT
  // DOES>", live from the current binds, and picking an action lights up the
  // button(s) it is sitting on so you can see it before you rebind it.
  // ---------------------------------------------------------------------------
  drawPadDiagram(ctx, actions, hi) {
    const sel = this.selIdx < actions.length ? actions[this.selIdx] : null;
    const lit = sel ? Input.padButtons(sel) : [];
    const px = (x) => PAD_X + x, py = (y) => PAD_Y + y;

    if (this.padImg) ctx.drawImage(this.padImg, PAD_X, PAD_Y, PAD_W, PAD_H);

    // LT / RT / LB / RB / LS / RS, back on in the game's own font
    for (const [s, x, y, size] of PAD_BAKED_LABELS) {
      this.text(ctx, s, px(x), py(y), size, '#22262c', 'center', false);
    }

    // The four d-pad callouts share one label, bracketed together - they all
    // do the same job and four copies of MOVE reads like a mistake.
    const dp = PAD_CALLOUTS.filter((c) => c.dpad);
    const dy0 = py(dp[0].y), dy1 = py(dp[dp.length - 1].y);
    ctx.fillStyle = '#7f96b8';
    ctx.fillRect(PAD_X - 4, dy0, 1, dy1 - dy0);

    for (const c of PAD_CALLOUTS) {
      const right = c.side > 0;
      let label = c.text;
      if (label === undefined) {
        const what = Input.padAction(c.btn);
        label = PAD_BTN_NAME[c.btn] + '  ' + (what || '—');
      }
      const on = c.btn !== null && lit.indexOf(c.btn) >= 0;
      const col = on ? '#ffe15a' : (label.endsWith('—') ? '#5f6b7d' : '#c8d6e8');

      if (c.dpad) {
        // one label for the group, on the middle of the bracket
        if (c !== dp[1]) continue;
        this.text(ctx, 'D-PAD  MOVE', PAD_X - 8, (dy0 + dy1) / 2 + 6, 6, '#c8d6e8', 'right');
        continue;
      }
      this.text(ctx, label, right ? PAD_X + PAD_W + 5 : PAD_X - 5, py(c.y) + 3,
                6, col, right ? 'left' : 'right');

      // marker on the inner tip, so a lit callout is traceable to its button
      if (on) {
        ctx.fillStyle = '#ffe15a';
        ctx.fillRect(Math.round(px(c.tip[0])) - 1, Math.round(py(c.tip[1])) - 1, 3, 3);
      }
    }

    // action chips
    for (let i = 0; i < actions.length; i++) {
      const r = padChipRect(i), hot = hi(i);
      ctx.fillStyle = hot ? 'rgba(255,225,90,0.90)' : 'rgba(10,14,24,0.62)';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = hot ? '#fff' : '#7f96b8';
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      this.text(ctx, ACTION_LABEL[actions[i]], r.x + 4, r.y + 11, 7,
                hot ? '#1a1206' : '#c8d6e8');
      this.text(ctx, Input.bindLabel('pad', actions[i]), r.x + r.w - 4, r.y + 11, 6,
                hot ? '#3a2c08' : '#8fa4bd', 'right');
    }
  },

  // Story cards. Dim the menu art behind them so it still feels like the
  // same night rather than cutting to a black screen.
  drawStory(ctx, page, total, warm) {
    if (this.menuBg) {
      ctx.drawImage(this.menuBg, 0, 0, VW, VH);
      ctx.fillStyle = warm ? 'rgba(14,10,6,0.82)' : 'rgba(4,6,14,0.86)';
    } else {
      ctx.fillStyle = '#05070e';
    }
    ctx.fillRect(0, 0, VW, VH);
    if (!page) return;

    this.text(ctx, page[0], VW / 2, 78, 15, warm ? '#ffe15a' : '#e0e6f2', 'center');
    this.text(ctx, page[1] || '', VW / 2, 106, 8, '#b8c6da', 'center');
    this.text(ctx, page[2] || '', VW / 2, 120, 8, '#b8c6da', 'center');

    // page pips
    for (let i = 0; i < total; i++) {
      ctx.fillStyle = i === this.storyPage ? '#ffe15a' : 'rgba(255,255,255,0.28)';
      ctx.fillRect(VW / 2 - (total * 6) / 2 + i * 6, 150, 4, 3);
    }
    if (this.stateT > 26 && (this.tick % 54) < 34) {
      this.text(ctx, 'PRESS ANYTHING', VW / 2, VH - 16, 8, '#fff', 'center');
    }
  },

  drawIntro(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,' + (this.stateT < 90 ? 0.6 : 0.6 * (1 - (this.stateT - 90) / 18)) + ')';
    ctx.fillRect(0, 0, VW, VH);
    this.text(ctx, 'ROUND ' + this.level.round, VW / 2, 94, 11, '#9ac', 'center');
    this.text(ctx, this.level.name, VW / 2, 118, 18, '#ffe15a', 'center');
  },

  drawCenterCard(ctx, title, col, sub) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, VW, VH);
    this.text(ctx, title, VW / 2, 102, 18, col, 'center');
    if (sub && this.stateT > 90 && (this.tick % 50) < 32) {
      this.text(ctx, sub, VW / 2, 130, 9, '#fff', 'center');
    }
    if (title === 'ROUND CLEAR') {
      this.text(ctx, 'SCORE ' + String(this.score).padStart(6, '0'), VW / 2, 126, 9, '#fff', 'center');
    }
  },

  drawEnding(ctx) {
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, VW, VH);
    this.text(ctx, 'YOU GOT HER BACK', VW / 2, 42, 14, '#ffe15a', 'center');
    if (this.winQuip) {
      this.text(ctx, this.winQuip, VW / 2, 58, 8, '#8fa6c8', 'center');
    }

    // The two of them, side by side, both idling. This is the payoff.
    const groundY = 152;
    const gap = 13;
    if (this.velmaImg) {
      const vf = Math.floor(this.tick / VELMA.t) % VELMA.frames;
      ctx.drawImage(this.velmaImg, vf * VELMA.fw, 0, VELMA.fw, VELMA.fh,
                    Math.round(VW / 2 + gap), groundY - VELMA.fh, VELMA.fw, VELMA.fh);
    }
    const ai = SHEETS.animal && SHEETS.animal.idle;
    if (ai) {
      const a = ANIM.idle;
      const af = Math.floor(this.tick / 10) % a.frames;
      ctx.drawImage(ai, af * a.fw, 0, a.fw, a.fh,
                    Math.round(VW / 2 - gap - a.fw), groundY - a.ay, a.fw, a.fh);
    }
    // a bit of ground under them
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(VW / 2 - 66, groundY, 132, 1);

    this.text(ctx, 'FINAL SCORE ' + String(this.score).padStart(6, '0'), VW / 2, 174, 10, '#fff', 'center');
    this.text(ctx, 'FOR A GUY WHO LIKES PUNCHING DUDES', VW / 2, 190, 8, '#7f96b8', 'center');
    if (this.stateT > 90 && (this.tick % 50) < 32) {
      this.text(ctx, Input.prompts().start, VW / 2, 206, 9, '#fff', 'center');
    }
  },

  drawTitle(ctx) {
    if (this.menuBg) ctx.drawImage(this.menuBg, 0, 0, VW, VH);
    else { ctx.fillStyle = '#0b0f16'; ctx.fillRect(0, 0, VW, VH); }

    // Darken the top and bottom only, so the artwork stays visible but the
    // title and button still read against it.
    let g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, 'rgba(6,8,16,0.80)');
    g.addColorStop(0.28, 'rgba(6,8,16,0.10)');
    g.addColorStop(0.62, 'rgba(6,8,16,0.10)');
    g.addColorStop(1, 'rgba(6,8,16,0.86)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);

    this.text(ctx, 'ANIMALISM', VW / 2, 38, 30, '#ffe15a', 'center');
    this.text(ctx, 'A ROCK EM SOCK EM PICTURE', VW / 2, 52, 8, '#a8bcd8', 'center');

    // ---- START GAME button ----
    const b = START_BUTTON;
    const hot = this.mouse.over;
    ctx.fillStyle = hot ? 'rgba(255,225,90,0.92)' : 'rgba(10,14,24,0.78)';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = hot ? '#fff' : '#ffe15a';
    ctx.lineWidth = 1;
    ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
    this.text(ctx, 'START GAME', b.x + b.w / 2, b.y + 15, 11,
              hot ? '#1a1206' : '#ffe15a', 'center');

    // settings + quit, styled quieter than start
    const smalls = [
      [SETTINGS_BUTTON, 'SETTINGS', this.mouse.overSettings],
    ];
    if (CAN_QUIT) smalls.push([QUIT_BUTTON, 'QUIT', this.mouse.overQuit]);
    for (const [r, label, hot2] of smalls) {
      ctx.fillStyle = hot2 ? 'rgba(200,214,232,0.88)' : 'rgba(10,14,24,0.62)';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = hot2 ? '#fff' : '#7f96b8';
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      this.text(ctx, label, r.x + r.w / 2, r.y + 12, 8,
                hot2 ? '#1a1206' : '#c8d6e8', 'center');
    }
    // toast (quit refusal etc.) - normally only drawn in the HUD
    if (this.toastT > 0) {
      this.text(ctx, this.toast, 6, VH - 34, 7, this.toastCol, 'left');
    }

    // "Native controller support!" starburst, top-right and clear of the logo.
    // Bobs a couple of pixels so it reads as a sticker slapped on the flyer.
    if (this.ncsBadge) {
      const bob = Math.round(Math.sin(this.tick / 26) * 2);
      ctx.drawImage(this.ncsBadge, VW - this.ncsBadge.width - 4, 6 + bob);
    }

    // no controls dump here - bindings live in SETTINGS now
    if ((this.tick % 54) < 34) {
      this.text(ctx, 'CLICK  OR  ' + Input.prompts().start, VW / 2, VH - 6, 7, '#fff', 'center');
    }
  },

  drawDebug(ctx) {
    Stage.drawBeltDebug(ctx);
    const all = [this.player, ...this.enemies];
    for (const a of all) {
      const hb = a.hurtbox();
      ctx.strokeStyle = 'rgba(80,180,255,0.8)';
      ctx.strokeRect(Math.round(hb.x0 - this.camX), Math.round(a.screenY - a.bodyH),
                     hb.x1 - hb.x0, a.bodyH);
      if (a.state === 'attack' && a.move) {
        const h = a.activeHitbox(a.move);
        if (h) {
          ctx.strokeStyle = 'rgba(255,60,60,0.95)';
          ctx.strokeRect(Math.round(h.x0 - this.camX), Math.round(a.screenY - 34),
                         h.x1 - h.x0, 30);
        }
      }
      if (a.hasToken) {
        ctx.fillStyle = '#ff0';
        ctx.fillRect(Math.round(a.x - this.camX) - 1, Math.round(a.screenY - a.bodyH) - 6, 3, 3);
      }
    }
    this.text(ctx, `cam ${Math.round(this.camX)} px ${Math.round(this.player.x)} pz ${Math.round(this.player.z)} ` +
                   `st ${this.player.state} en ${this.enemies.length} tok ${this.tokens.size}`,
              6, VH - 16, 7, '#0f0', 'left');
  },
};

Game.boot();
