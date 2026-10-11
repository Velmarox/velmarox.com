// ---------------------------------------------------------------------------
// Sound: real samples from assets/sounds, music from assets/music.
//
// WHY HTMLAudioElement AND NOT WEBAUDIO BUFFERS: decoding into WebAudio needs
// fetch/XHR, and both are blocked on file:// - which is exactly how play.bat
// runs the game. Audio elements load from file:// like <img> does, so this
// works whether the game is served or opened straight off the disk.
//
// Overlapping sounds (rapid punches) are handled with a small pool of clones
// per sample; the synth fallbacks are kept for anything with no sample file.
// ---------------------------------------------------------------------------

const SFX_FILES = {
  punch: 'punch.wav',
  hurt: 'hurt.wav',
  jump: 'jump.wav',
  land: 'fall_quick.wav',
  menu: 'menu_blip.wav',
  coin: 'coin.wav',
  powerUp: 'power_up.wav',
  powerBig: 'power_up_2.wav',
  breakSmall: 'explosion_small.wav',
  breakBig: 'explosion_medium.wav',
  ko: 'explosion_quick.wav',
  lose: 'lose.wav',
  whoosh: 'throw.wav',
  wobble: 'wobble.wav',
};

const POOL = 4;          // simultaneous copies of any one sample

const Sfx = {
  ctx: null,
  enabled: true,
  master: null,
  volume: 0.55,
  samples: {},           // name -> [HTMLAudioElement pool]
  cursor: {},
  ready: false,

  setVolume(v) { this.volume = Math.max(0, Math.min(1, Math.round(v * 100) / 100)); },

  // Preload every sample. Never rejects - a missing file just falls back to
  // the synth version so the game always boots.
  preload() {
    for (const name in SFX_FILES) {
      const pool = [];
      for (let i = 0; i < POOL; i++) {
        const a = new Audio('assets/sounds/' + SFX_FILES[name]);
        a.preload = 'auto';
        pool.push(a);
      }
      this.samples[name] = pool;
      this.cursor[name] = 0;
    }
    this.ready = true;
  },

  play(name, vol, rate) {
    if (!this.enabled) return false;
    const pool = this.samples[name];
    if (!pool) return false;
    const i = this.cursor[name] = (this.cursor[name] + 1) % pool.length;
    const a = pool[i];
    try {
      a.currentTime = 0;
      a.volume = Math.max(0, Math.min(1, (vol === undefined ? 1 : vol) * this.volume));
      a.playbackRate = rate || 1;
      const p = a.play();
      if (p && p.catch) p.catch(() => {});
      return true;
    } catch (e) { return false; }
  },

  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.30;
    this.master.connect(this.ctx.destination);
  },

  // ---- synth fallbacks -------------------------------------------------
  _noise(dur) {
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    return s;
  },

  thud(freq, dur, vol, type) {
    if (!this.enabled) return;
    this.ensure();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this._noise(dur);
    const f = this.ctx.createBiquadFilter();
    f.type = type || 'lowpass';
    f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.25), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur);
  },

  blip(f0, f1, dur, vol, wave) {
    if (!this.enabled) return;
    this.ensure();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = wave || 'square';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur);
  },

  // ---- game events (same names the rest of the code already calls) -----
  // Slight random pitch on the repeated ones so a combo doesn't machine-gun
  // the identical sample.
  _r(a, b) { return a + Math.random() * (b - a); },

  whiff()      { if (!this.play('whoosh', 0.30, this._r(1.25, 1.4))) this.thud(1800, 0.07, 0.14, 'bandpass'); },
  whiffHeavy() { if (!this.play('whoosh', 0.45, this._r(0.95, 1.05))) this.thud(1200, 0.13, 0.20, 'bandpass'); },
  hit()        { if (!this.play('punch', 0.9, this._r(0.94, 1.12))) { this.thud(700, 0.11, 0.55); } },
  hitHeavy()   { if (!this.play('punch', 1.0, this._r(0.72, 0.82))) { this.thud(420, 0.20, 0.75); } },
  jump()       { if (!this.play('jump', 0.5, this._r(0.98, 1.06))) this.blip(300, 620, 0.10, 0.13, 'square'); },
  land()       { if (!this.play('land', 0.35, this._r(0.9, 1.1))) this.thud(300, 0.07, 0.22); },
  step()       { this.thud(420, 0.04, 0.10); },              // synth: too frequent for a sample
  ko()         { if (!this.play('ko', 0.8)) { this.thud(260, 0.35, 0.6); } },
  hurt()       { if (!this.play('hurt', 0.8, this._r(0.95, 1.05))) this.blip(400, 120, 0.16, 0.20, 'sawtooth'); },
  menu()       { if (!this.play('menu', 0.7)) this.blip(520, 780, 0.07, 0.16, 'square'); },
  start()      { if (!this.play('powerUp', 0.7)) this.blip(400, 900, 0.16, 0.20, 'square'); },
  propHit()    { if (!this.play('wobble', 0.5, this._r(1.0, 1.2))) this.thud(900, 0.06, 0.28, 'bandpass'); },
  // A guarded hit wants to read as "stopped", not "hurt" - short, hard and
  // pitched well above the flesh sounds so it never gets mistaken for damage.
  block()      { if (!this.play('punch', 0.55, this._r(1.5, 1.65))) this.thud(1500, 0.07, 0.26, 'bandpass'); },
  propBreak()  { if (!this.play('breakSmall', 0.7, this._r(0.92, 1.08))) this.thud(500, 0.16, 0.5); },
  pickup()     { if (!this.play('coin', 0.7)) this.blip(660, 990, 0.10, 0.18, 'square'); },
  powerUp()    { if (!this.play('powerBig', 0.8)) this.blip(300, 900, 0.22, 0.22, 'square'); },
  bigHit()     { if (!this.play('breakBig', 0.9)) this.thud(300, 0.3, 0.6); },
  gameOver()   { if (!this.play('lose', 0.8)) this.blip(220, 60, 0.5, 0.2, 'sawtooth'); },

  clear() {
    if (!this.enabled) return;
    if (this.play('powerBig', 0.8)) return;
    this.ensure(); if (!this.ctx) return;
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f, f, 0.13, 0.17, 'square'), i * 110));
  },
};

// ---------------------------------------------------------------------------
// Looping background music. One track per level, plus the menu.
//
// Browsers won't start audio before a user gesture, so a track requested too
// early is remembered and started by the first key or click.
// ---------------------------------------------------------------------------
const Music = {
  TRACKS: {
    menu: 'assets/music/level2.mp3',      // the neon-street track suits the title
    1: 'assets/music/level1.mp3',
    2: 'assets/music/level2.mp3',
    3: 'assets/music/level3.mp3',
    4: 'assets/music/level3.mp3',        // boss - reuses the night track, but
                                         // mapping it explicitly restarts it
                                         // from the top instead of letting
                                         // round 3's loop run on underneath
  },
  volume: 0.42,                            // sits under the SFX
  el: null,
  current: null,
  pending: null,
  enabled: true,
  ducked: false,

  // Applies live, so dragging the setting is audible immediately.
  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, Math.round(v * 100) / 100));
    if (this.el) this.el.volume = this.volume * (this.ducked ? 0.35 : 1);
  },

  play(key) {
    if (!this.enabled) return;
    key = String(key);
    if (this.current === key && this.el && !this.el.paused) return;
    const src = this.TRACKS[key];
    if (!src) return;

    if (!this.el) {
      this.el = new Audio();
      this.el.loop = true;                 // seamless repeat, as asked
      this.el.preload = 'auto';
    }
    if (this.current !== key) {
      this.el.src = src;
      this.current = key;
    }
    this.el.volume = this.volume * (this.ducked ? 0.35 : 1);
    const p = this.el.play();
    if (p && p.catch) {
      // no gesture yet - remember it and let unlock() start it
      p.catch(() => { this.pending = key; });
    }
  },

  // Called from the first real user gesture.
  unlock() {
    if (this.pending) {
      const k = this.pending;
      this.pending = null;
      this.current = null;
      this.play(k);
    } else if (this.el && this.el.paused && this.current) {
      const p = this.el.play();
      if (p && p.catch) p.catch(() => {});
    }
  },

  stop() {
    this.pending = null;
    if (this.el) { try { this.el.pause(); this.el.currentTime = 0; } catch (e) { } }
    this.current = null;
  },

  duck(on) {                               // quieten under story/pause screens
    this.ducked = !!on;
    if (this.el) this.el.volume = this.volume * (this.ducked ? 0.35 : 1);
  },
};
