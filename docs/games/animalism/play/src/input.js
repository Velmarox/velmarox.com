// ---------------------------------------------------------------------------
// Input: keyboard + Gamepad API, unified behind one action set.
//
// Every action exposes `held` (current) and `pressed` (edge this tick), so the
// game code never cares which device produced it.
//
// BINDINGS. Rebindable at runtime (settings > controls). Stored as
// action -> [key codes] / action -> [button indices], persisted in
// localStorage. Rebinding an input steals it from whatever action held it.
// Enter/Escape (start/back) and the pad's Start/Select/d-pad stay fixed so a
// bad remap can never lock you out of the menus.
//
// INPUT MODE. `Input.mode` is 'keyboard' or 'pad' and drives every on-screen
// prompt: pad connects -> pad; disconnects -> keyboard; afterwards whichever
// device is actually USED wins. Both devices always keep working.
// ---------------------------------------------------------------------------

const ACTIONS = ['left', 'right', 'up', 'down', 'light', 'heavy', 'jump', 'crouch',
                'block', 'start', 'back'];

const REBIND_KEY = ['light', 'heavy', 'jump', 'crouch', 'block', 'left', 'right', 'up', 'down'];
const REBIND_PAD = ['light', 'heavy', 'jump', 'crouch', 'block'];
const ACTION_LABEL = {
  light: 'PUNCH', heavy: 'HEAVY', jump: 'JUMP', crouch: 'CROUCH', block: 'BLOCK',
  left: 'LEFT', right: 'RIGHT', up: 'UP', down: 'DOWN',
};

const DEFAULT_KEY_BINDS = {
  left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
  light: ['KeyJ', 'KeyZ'], heavy: ['KeyK', 'KeyX'],
  jump: ['Space', 'KeyL'], crouch: ['ShiftLeft', 'ShiftRight', 'KeyC'],
  // I sits above J/K for the right hand, V next to C/X for the left one -
  // whichever hand you already have on the attack keys can reach it
  block: ['KeyI', 'KeyV'],
};
const FIXED_KEYS = { Enter: 'start', Escape: 'back', KeyP: 'back' };

// Crouch defaults to RT (7). RB (5) stays heavy, faces are X/B punch, Y heavy.
// Block goes on LB (4) - it and LT were the only buttons the pad had spare, and
// a guard belongs under the left hand where it is not competing with attacks.
const DEFAULT_PAD_BINDS = { light: [2, 1], heavy: [3, 5], jump: [0], crouch: [7], block: [4] };
const FIXED_PAD = { 9: 'start', 8: 'back', 12: 'up', 13: 'down', 14: 'left', 15: 'right' };
// buttons that may never be rebound (menu nav + movement)
const PAD_RESERVED = [8, 9, 12, 13, 14, 15];

const PAD_BTN_NAME = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT',
                      'SELECT', 'START', 'L3', 'R3', 'UP', 'DOWN', 'LEFT', 'RIGHT'];

const KEY_NAME = {
  ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', ArrowUp: 'UP', ArrowDown: 'DOWN',
  Space: 'SPACE', ShiftLeft: 'SHIFT', ShiftRight: 'R-SHIFT',
  ControlLeft: 'CTRL', ControlRight: 'R-CTRL', AltLeft: 'ALT',
  Tab: 'TAB', Backspace: 'BKSP', CapsLock: 'CAPS',
  Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/',
};

const DEADZONE = 0.35;        // for actually moving
const MODE_AXIS = 0.55;       // higher bar to switch prompt mode (stick drift)

const Input = {
  held: {}, prev: {}, pressed: {},
  mode: 'keyboard',
  padIndex: null,
  padName: '',
  padConnected: false,
  keyBinds: null, padBinds: null,
  wantKeyCapture: false,       // settings screen: next keydown is captured
  capturedKey: null,
  rawPadPressed: null,         // freshly pressed raw button index this tick

  init() {
    for (const a of ACTIONS) { this.held[a] = false; this.prev[a] = false; this.pressed[a] = false; }
    this._keys = {};
    this._padPrevRaw = [];
    this.loadBinds();

    addEventListener('keydown', (e) => {
      if (this.wantKeyCapture && e.code !== 'F11' && e.code !== 'F1') {
        this.capturedKey = e.code;
        e.preventDefault();
        this.mode = 'keyboard';
        return;
      }
      const a = this._keymap[e.code];
      if (a) { this._keys[a] = true; e.preventDefault(); }
      this.mode = 'keyboard';
    });
    addEventListener('keyup', (e) => {
      const a = this._keymap[e.code];
      if (a) { this._keys[a] = false; e.preventDefault(); }
    });
    addEventListener('blur', () => { this._keys = {}; });

    addEventListener('gamepadconnected', (e) => {
      this.padIndex = e.gamepad.index;
      this.padName = e.gamepad.id;
      this.padConnected = true;
      this.mode = 'pad';
    });
    addEventListener('gamepaddisconnected', (e) => {
      if (this.padIndex === e.gamepad.index) {
        this.padIndex = null; this.padName = ''; this.padConnected = false;
        this.mode = 'keyboard';
      }
    });
  },

  // ---- bindings --------------------------------------------------------
  loadBinds() {
    this.keyBinds = JSON.parse(JSON.stringify(DEFAULT_KEY_BINDS));
    this.padBinds = JSON.parse(JSON.stringify(DEFAULT_PAD_BINDS));
    try {
      const raw = localStorage.getItem('animalism-binds');
      if (raw) {
        const saved = JSON.parse(raw);
        for (const a of REBIND_KEY) {
          if (saved.key && Array.isArray(saved.key[a]) && saved.key[a].length) {
            this.keyBinds[a] = saved.key[a];
          }
        }
        for (const a of REBIND_PAD) {
          if (saved.pad && Array.isArray(saved.pad[a]) && saved.pad[a].length) {
            this.padBinds[a] = saved.pad[a].filter((i) => PAD_RESERVED.indexOf(i) < 0);
            if (!this.padBinds[a].length) this.padBinds[a] = DEFAULT_PAD_BINDS[a].slice();
          }
        }
      }
    } catch (e) { }
    this.rebuildMaps();
  },

  saveBinds() {
    try {
      localStorage.setItem('animalism-binds',
        JSON.stringify({ key: this.keyBinds, pad: this.padBinds }));
    } catch (e) { }
  },

  rebuildMaps() {
    this._keymap = Object.assign({}, FIXED_KEYS);
    for (const a of REBIND_KEY) {
      for (const code of this.keyBinds[a]) this._keymap[code] = a;
    }
    this._padmap = Object.assign({}, FIXED_PAD);
    for (const a in this.padBinds) {
      for (const i of this.padBinds[a]) this._padmap[i] = a;
    }
  },

  // Assign an input to an action, stealing it from any other action.
  setBind(kind, action, code) {
    const binds = kind === 'key' ? this.keyBinds : this.padBinds;
    if (kind === 'pad' && PAD_RESERVED.indexOf(code) >= 0) return false;
    if (kind === 'key' && (code === 'Enter' || code === 'Escape')) return false;
    for (const a in binds) binds[a] = binds[a].filter((c) => c !== code);
    binds[action] = [code];
    // an action can end up empty after a steal - give it back its default
    for (const a in binds) {
      if (!binds[a].length) {
        const def = (kind === 'key' ? DEFAULT_KEY_BINDS : DEFAULT_PAD_BINDS)[a];
        binds[a] = def.filter((c) => c !== code);
        if (!binds[a].length) binds[a] = [def[0]]; // worst case: shared (visible in UI)
      }
    }
    this._keys = {};
    this.rebuildMaps();
    this.saveBinds();
    return true;
  },

  resetBinds(kind) {
    if (kind === 'key') this.keyBinds = JSON.parse(JSON.stringify(DEFAULT_KEY_BINDS));
    else this.padBinds = JSON.parse(JSON.stringify(DEFAULT_PAD_BINDS));
    this._keys = {};
    this.rebuildMaps();
    this.saveBinds();
  },

  keyLabel(code) {
    if (KEY_NAME[code]) return KEY_NAME[code];
    if (code.indexOf('Key') === 0) return code.slice(3);
    if (code.indexOf('Digit') === 0) return code.slice(5);
    if (code.indexOf('Numpad') === 0) return 'NUM ' + code.slice(6);
    return code.toUpperCase();
  },

  padBtnLabel(i) { return PAD_BTN_NAME[i] || 'BTN' + i; },

  // What a physical pad button does right now, for the controller diagram on
  // the bindings screen. Reserved buttons report their fixed job; anything the
  // player has left empty reports null so the diagram can grey it out.
  padAction(b) {
    if (FIXED_PAD[b]) {
      const f = FIXED_PAD[b];
      if (f === 'start') return 'PAUSE';
      if (f === 'back') return 'BACK';
      return 'MOVE';
    }
    const a = this._padmap[b];
    return a ? ACTION_LABEL[a] : null;
  },

  // Which buttons an action currently sits on - the diagram highlights these
  // when that action is the selected one.
  padButtons(action) { return (this.padBinds[action] || []).slice(); },

  bindLabel(kind, action) {
    if (kind === 'key') {
      return this.keyBinds[action].slice(0, 2).map((c) => this.keyLabel(c)).join(' or ');
    }
    return this.padBinds[action].slice(0, 2).map((i) => this.padBtnLabel(i)).join(' or ');
  },

  // ---- prompts ---------------------------------------------------------
  // Built from the live bindings so the UI can never disagree with them.
  prompts() {
    if (this.mode === 'pad') {
      return {
        device: 'CONTROLLER',
        rows: [
          ['MOVE', 'STICK / D-PAD'],
          ['PUNCH', this.bindLabel('pad', 'light')],
          ['HEAVY', this.bindLabel('pad', 'heavy')],
          ['JUMP', this.bindLabel('pad', 'jump')],
          ['CROUCH', this.bindLabel('pad', 'crouch')],
          ['BLOCK', this.bindLabel('pad', 'block')],
          ['RUN', 'TAP DIRECTION TWICE'],
          ['PAUSE', 'START'],
        ],
        start: 'PRESS START',
        unpause: 'PRESS START',
      };
    }
    return {
      device: 'KEYBOARD',
      rows: [
        ['MOVE', 'ARROWS / WASD'],
        ['PUNCH', this.bindLabel('key', 'light')],
        ['HEAVY', this.bindLabel('key', 'heavy')],
        ['JUMP', this.bindLabel('key', 'jump')],
        ['CROUCH', this.bindLabel('key', 'crouch')],
        ['BLOCK', this.bindLabel('key', 'block')],
        ['RUN', 'TAP DIRECTION TWICE'],
        ['PAUSE', 'ESC'],
      ],
      start: 'PRESS ENTER',
      unpause: 'PRESS ENTER / ESC',
    };
  },

  // Gamepad ids carry vendor noise; show a clean name on the menu.
  padLabel() {
    if (!this.padName) return 'CONTROLLER';
    let s = this.padName.replace(/\([^)]*\)?/g, ' ')
                        .replace(/\b(?:vendor|product)\s*:?\s*[0-9a-f]{4}\b/gi, ' ')
                        .replace(/[-_]+/g, ' ')
                        .replace(/\s+/g, ' ')
                        .trim();
    if (!s) s = 'CONTROLLER';
    if (s.length > 26) s = s.slice(0, 25).trim() + '…';
    return s.toUpperCase();
  },

  // ---- per-tick --------------------------------------------------------
  update() {
    const now = {};
    for (const a of ACTIONS) now[a] = !!this._keys[a];
    this.rawPadPressed = null;

    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = this.padIndex !== null ? pads[this.padIndex] : null;
    if (!pad) {
      for (const p of pads) {
        if (p && p.connected) { pad = p; this.padIndex = p.index; this.padName = p.id; break; }
      }
    }

    const wasConnected = this.padConnected;
    this.padConnected = !!pad;
    if (this.padConnected && !wasConnected) this.mode = 'pad';
    if (!this.padConnected && wasConnected) { this.mode = 'keyboard'; this.padName = ''; this.padIndex = null; }

    if (pad) {
      let padActivity = false;
      const raw = [];
      for (let i = 0; i < pad.buttons.length; i++) {
        const b = pad.buttons[i];
        const on = typeof b === 'object' ? (b.pressed || b.value > 0.5) : b > 0.5;
        raw[i] = on;
        if (on) {
          padActivity = true;
          if (!this._padPrevRaw[i] && this.rawPadPressed === null) this.rawPadPressed = i;
          const a = this._padmap[i];
          if (a) now[a] = true;
        }
      }
      this._padPrevRaw = raw;
      const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
      if (ax < -DEADZONE) now.left = true;
      if (ax > DEADZONE) now.right = true;
      if (ay < -DEADZONE) now.up = true;
      if (ay > DEADZONE) now.down = true;
      if (Math.abs(ax) > MODE_AXIS || Math.abs(ay) > MODE_AXIS) padActivity = true;
      if (padActivity) this.mode = 'pad';
    } else {
      this._padPrevRaw = [];
    }

    for (const a of ACTIONS) {
      this.prev[a] = this.held[a];
      this.held[a] = now[a];
      this.pressed[a] = now[a] && !this.prev[a];
    }
  },

  anyPressed() {
    for (const a of ACTIONS) if (this.pressed[a]) return true;
    return false;
  },
};
