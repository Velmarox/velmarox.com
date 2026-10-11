/* WYRMHOARD KENO -- audio mixer
 *
 * Twenty-one one-shots, one master fader, and the rules that keep a keno draw from
 * sounding like a fire alarm.  See docs/70-AUDIO.md.
 *
 * Three things this file exists to do, none of which a bare `new Audio().play()`
 * can do:
 *
 *   1. TRIM.  make_sfx.py normalises every cue to -1 dBFS peak, so out of the box
 *      a coin missing is exactly as loud as the dragon waking up.  Each cue
 *      carries a dB trim that pulls it to a target loudness for its class.  Every
 *      trim is negative -- nothing here is ever boosted, so nothing can clip.
 *   2. GATE.  Twenty coins land in about three seconds, and in Turbo closer to
 *      one.  Each cue has a minimum retrigger gap and the bus has a voice cap.
 *   3. DUCK.  A stinger pulls the chatter down under itself instead of fighting
 *      it.  This is the single biggest reason the mix reads as loud when it isn't.
 *
 * Nothing in here throws.  A machine with no audio device, a blocked
 * AudioContext or a file:// page that cannot fetch must still play keno --
 * every failure path ends at "silent", never at an exception and never at a
 * console error (game/drive.js fails the build on console errors).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WyrmAudio = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // The UMD wrapper above does not pass the global into the factory, matching
  // engine.js.  Everything here that reaches for a browser global goes through
  // this, so the file also loads under Node without an AudioContext.
  var root = (typeof self !== 'undefined') ? self
           : (typeof globalThis !== 'undefined') ? globalThis : {};

  var BASE = 'assets/sfx/';

  /* ------------------------------------------------------------------ mix */

  /* Class loudness targets, dBFS RMS, measured on the v3 set.  The spread from
     chatter to stinger is 14 dB, which is what makes a win feel like a win
     without any single cue being loud in absolute terms. */
  var TARGET = { chatter: -32, ui: -27, feedback: -24, reward: -22, event: -20, stinger: -18 };

  /* name: [class, measured RMS dBFS, minimum gap ms]
     trim is computed, not typed -- TARGET[class] minus the measurement.  Remeasure
     with Docs/measure_sfx.py after any change to make_sfx.py and paste the column. */
  var CUES = {
    miss_1:          ['chatter',  -17.26,  40],
    miss_2:          ['chatter',  -16.87,  40],
    miss_3:          ['chatter',  -17.41,  40],
    rollup_tick:     ['chatter',  -20.75,  45],
    pick_on:         ['ui',       -19.02,  25],
    pick_off:        ['ui',       -17.01,  25],
    bet:             ['ui',       -14.59,   0],
    draw_start:      ['ui',       -15.00,   0],
    hit_1:           ['feedback', -15.94,  40],
    hit_2:           ['feedback', -15.26,  40],
    hit_3:           ['feedback', -16.40,  40],
    hoard_pile_gold: ['feedback', -21.02,  60],
    win:             ['reward',   -18.75,   0],
    rollup_end:      ['reward',   -15.59,   0],
    cashout:         ['reward',   -12.97,   0],
    egg_hit:         ['event',    -18.86,   0],
    mult_hit:        ['event',    -12.90,   0],
    x_hit:           ['event',    -14.28,   0],
    hoard_wake:      ['event',    -13.18,   0],
    bonus_trigger:   ['stinger',  -13.62,   0],
    big_win:         ['stinger',  -11.93,   0],
    hoard_award:     ['stinger',  -13.31,   0]
  };

  var PRIORITY = { chatter: 0, ui: 1, feedback: 2, reward: 3, event: 4, stinger: 5 };
  var VOICE_CAP = 12;            // hard ceiling on concurrent sources
  var DUCK_TO   = 0.34;          // chatter/ui/feedback bus level under a stinger
  var DUCK_HOLD = 1.1;           // seconds a duck holds before it releases

  /* Master fader.  The button cycles these; Normal is the default and Normal is
     0.5, which is the level the whole trim table was balanced against. */
  var LEVELS = [
    { name: 'Off',    v: 0.00 },
    { name: 'Quiet',  v: 0.22 },
    { name: 'Normal', v: 0.50 },
    { name: 'Loud',   v: 1.00 }
  ];
  var DEFAULT_LEVEL = 2;
  var STORE = 'wyrm.audio.level';

  function dbToGain(db) { return Math.pow(10, db / 20); }
  function trimOf(name) {
    var c = CUES[name];
    return c ? dbToGain(TARGET[c[0]] - c[1]) : 1;
  }

  /* ---------------------------------------------------------------- state */

  var ctx = null, master = null, busChatter = null, busLoud = null;
  var buffers = {}, pending = {}, elems = {};
  var mode = 'idle';             // idle | webaudio | element | dead
  var level = DEFAULT_LEVEL, started = false;
  var lastAt = {}, voices = [], duckUntil = 0;
  var bags = {};

  try {
    var s = root.localStorage && root.localStorage.getItem(STORE);
    if (s !== null && s !== undefined && LEVELS[+s]) level = +s;
  } catch (e) { /* private mode, storage disabled -- default level */ }

  function now() { return ctx ? ctx.currentTime : (Date.now() / 1000); }

  /* -------------------------------------------------------------- loading */

  /* Fetch every cue as raw bytes.  Started at load so the bytes are usually
     there by the time the player touches anything; decoding waits for the
     gesture because there is no AudioContext to decode into before it. */
  function prefetch() {
    if (typeof fetch !== 'function') return;
    Object.keys(CUES).forEach(function (name) {
      try {
        pending[name] = fetch(BASE + name + '.wav')
          .then(function (r) { return r.ok ? r.arrayBuffer() : null; })
          .catch(function () { return null; });
      } catch (e) { pending[name] = Promise.resolve(null); }
    });
  }

  /* HTMLAudio fallback.  file:// pages cannot fetch their own assets, but a
     media element loads them fine, which is the whole reason this path exists:
     game/drive.js runs the machine off file://. */
  function useElements() {
    mode = 'element';
    Object.keys(CUES).forEach(function (name) {
      elems[name] = [];
      for (var i = 0; i < 3; i++) {                    // three voices per cue
        try {
          var a = new Audio(BASE + name + '.wav');
          a.preload = 'auto';
          elems[name].push(a);
        } catch (e) { /* no Audio constructor -- stays silent */ }
      }
    });
  }

  function decodeAll() {
    var names = Object.keys(pending);
    Promise.all(names.map(function (name) {
      return pending[name].then(function (buf) {
        if (!buf || !ctx) return null;
        return new Promise(function (res) {
          // callback form: Safari still does not return a promise here
          try { ctx.decodeAudioData(buf, res, function () { res(null); }); }
          catch (e) { res(null); }
        });
      }).then(function (decoded) {
        if (decoded) buffers[name] = decoded;
      }).catch(function () { /* one cue short, the rest still play */ });
    })).then(function () {
      /* A file:// page cannot fetch its own assets, but its AudioContext builds
         perfectly well -- so "the context came up" is not evidence that anything
         can be heard.  If nothing decoded, the WebAudio path is a silent one and
         the media-element path is the working one.  This also covers a browser
         with no fetch at all, where `pending` is empty. */
      if (!Object.keys(buffers).length) useElements();
    }).catch(function () { useElements(); });
  }

  /* ---------------------------------------------------------------- start */

  /* Must be called from inside a real user gesture.  Safe to call repeatedly. */
  function start() {
    if (started) { resume(); return; }
    started = true;
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) { useElements(); applyLevel(); return; }
    try {
      ctx = new AC();
      master     = ctx.createGain();
      busChatter = ctx.createGain();   // chatter + ui + feedback, duckable
      busLoud    = ctx.createGain();   // reward + event + stinger, never ducked
      busChatter.connect(master);
      busLoud.connect(master);
      master.connect(ctx.destination);
      mode = 'webaudio';
      applyLevel();
      decodeAll();
      resume();
    } catch (e) {
      ctx = null;
      useElements();
      applyLevel();
    }
  }

  function resume() {
    try { if (ctx && ctx.state === 'suspended') ctx.resume().catch(function () {}); }
    catch (e) { /* nothing to do */ }
  }

  /* ---------------------------------------------------------------- level */

  function applyLevel() {
    var v = LEVELS[level].v;
    if (master) {
      try { master.gain.setTargetAtTime(v, now(), 0.01); } catch (e) { master.gain.value = v; }
    }
  }
  function setLevel(i) {
    level = ((i % LEVELS.length) + LEVELS.length) % LEVELS.length;
    applyLevel();
    try { root.localStorage && root.localStorage.setItem(STORE, String(level)); } catch (e) {}
    return LEVELS[level];
  }
  function cycle() { return setLevel(level + 1); }
  function levelName() { return LEVELS[level].name; }
  function muted() { return LEVELS[level].v === 0; }

  /* ----------------------------------------------------------------- bags */

  /* Round-robin without repeats.  `hit` and `miss` have three variants each and
     a plain random pick will say the same one twice in a row often enough to be
     audible as a glitch, which is exactly what the variants exist to prevent. */
  function bag(stem, n) {
    var b = bags[stem];
    if (!b || !b.length) {
      b = bags[stem] = [];
      for (var i = 1; i <= n; i++) b.push(stem + '_' + i);
      for (i = b.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1)), t = b[i]; b[i] = b[j]; b[j] = t;
      }
    }
    return b.pop();
  }

  /* ----------------------------------------------------------------- play */

  function gate(name, t) {
    var min = CUES[name] ? CUES[name][2] : 0;
    if (!min) return true;
    if (lastAt[name] && (t - lastAt[name]) * 1000 < min) return false;
    lastAt[name] = t;
    return true;
  }

  function reap(t) {
    voices = voices.filter(function (v) { return v.until > t; });
  }

  /* opts: { rate, gain, semitones }  -- rate and semitones both shift pitch,
     semitones is just the musical spelling of the same thing. */
  function play(name, opts) {
    if (mode === 'dead' || muted()) return;
    if (!CUES[name]) return;
    if (!started) return;                       // no gesture yet, nothing to hear
    opts = opts || {};
    var t = now();
    if (!gate(name, t)) return;

    var cls  = CUES[name][0];
    var rate = opts.rate || (opts.semitones ? Math.pow(2, opts.semitones / 12) : 1);
    var g    = trimOf(name) * (opts.gain === undefined ? 1 : opts.gain);

    if (mode === 'webaudio') return playBuffer(name, cls, g, rate, t);
    if (mode === 'element')  return playElement(name, g, rate);
  }

  function playBuffer(name, cls, g, rate, t) {
    var buf = buffers[name];
    if (!buf || !ctx) return;
    reap(t);

    var pri = PRIORITY[cls];
    if (voices.length >= VOICE_CAP) {
      // steal the oldest voice at or below this priority; if there is none, the
      // new sound is the least important thing in flight and is simply dropped
      var victim = -1;
      for (var i = 0; i < voices.length; i++)
        if (voices[i].pri <= pri && (victim < 0 || voices[i].at < voices[victim].at)) victim = i;
      if (victim < 0) return;
      try { voices[victim].src.stop(); } catch (e) {}
      voices.splice(victim, 1);
    }

    var src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    var vg = ctx.createGain();
    vg.gain.value = g;
    src.connect(vg);
    vg.connect(pri >= PRIORITY.reward ? busLoud : busChatter);

    // a stinger pulls the small stuff down under it rather than shouting over it
    if (cls === 'stinger' || cls === 'event') {
      var hold = Math.min(DUCK_HOLD, buf.duration / rate);
      duckUntil = Math.max(duckUntil, t + hold);
      try {
        busChatter.gain.cancelScheduledValues(t);
        busChatter.gain.setTargetAtTime(DUCK_TO, t, 0.03);
        busChatter.gain.setTargetAtTime(1, duckUntil, 0.25);
      } catch (e) { busChatter.gain.value = DUCK_TO; }
    }

    try { src.start(); } catch (e) { return; }
    voices.push({ src: src, pri: pri, at: t, until: t + buf.duration / rate });
    src.onended = function () { reap(now()); };
  }

  function playElement(name, g, rate) {
    var pool = elems[name];
    if (!pool || !pool.length) return;
    var a = null;
    for (var i = 0; i < pool.length; i++) if (pool[i].paused || pool[i].ended) { a = pool[i]; break; }
    if (!a) a = pool[0];
    try {
      a.currentTime = 0;
      a.volume = Math.max(0, Math.min(1, g * LEVELS[level].v));   // no master node here
      if ('preservesPitch' in a) a.preservesPitch = false;
      a.playbackRate = rate;
      var p = a.play();
      if (p && p.catch) p.catch(function () {});                  // autoplay block, no device
    } catch (e) { /* silent */ }
  }

  /* -------------------------------------------------------- named helpers */

  var hitStep = 0;
  function hit() { play(bag('hit', 3), { semitones: Math.min(hitStep++, 7) }); }
  function miss() { play(bag('miss', 3)); }
  function resetLadder() { hitStep = 0; }

  function stopAll() {
    voices.forEach(function (v) { try { v.src.stop(); } catch (e) {} });
    voices = [];
    Object.keys(elems).forEach(function (n) {
      elems[n].forEach(function (a) { try { a.pause(); a.currentTime = 0; } catch (e) {} });
    });
  }

  prefetch();

  return {
    start: start, resume: resume, play: play, stopAll: stopAll,
    hit: hit, miss: miss, resetLadder: resetLadder,
    cycle: cycle, setLevel: setLevel, levelName: levelName, muted: muted,
    levels: LEVELS, get level() { return level; },
    get mode() { return mode; },
    get loaded() { return Object.keys(buffers).length; },
    // exposed so docs/70-AUDIO.md's trim table can be asserted rather than trusted
    trims: function () {
      var out = {};
      Object.keys(CUES).forEach(function (n) {
        out[n] = Math.round((TARGET[CUES[n][0]] - CUES[n][1]) * 10) / 10;
      });
      return out;
    }
  };
});
