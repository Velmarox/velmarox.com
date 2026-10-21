// Every sound is made here from noise and tones, so there are no audio files to license.
// Sounds are rate-limited per kind: six guns firing at once shouldn't be six times as loud.

const SHOTS = {
  pistol:   { noise: 0.09, cut: 2600, body: 180, drop: 60, gain: 0.5 },
  revolver: { noise: 0.16, cut: 1800, body: 120, drop: 45, gain: 0.75 },
  smg:      { noise: 0.06, cut: 3200, body: 220, drop: 90, gain: 0.32 },
  shotgun:  { noise: 0.24, cut: 1300, body: 90, drop: 40, gain: 0.85 },
  rifle:    { noise: 0.1, cut: 2400, body: 150, drop: 55, gain: 0.5 },
  heavy:    { noise: 0.11, cut: 1900, body: 110, drop: 45, gain: 0.5 },
  sniper:   { noise: 0.4, cut: 1500, body: 70, drop: 30, gain: 1.0, tail: true },
  launcher: { noise: 0.12, cut: 700, body: 140, drop: 90, gain: 0.6, thunk: true },
  rocket:   { noise: 0.5, cut: 900, body: 80, drop: 40, gain: 0.7, tail: true },
};

// muted: never make a sound or start the browser's audio at all (?mute, for testing).
export function createAudio({ muted = false } = {}) {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let volume = 0.7;
  const last = new Map();

  function wake() {
    if (muted) return;
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    ctx = new Ctx();
    master = ctx.createGain();
    master.gain.value = volume;
    // A gentle limiter, so a big volley crunches instead of clipping.
    const squash = ctx.createDynamicsCompressor();
    squash.threshold.value = -14;
    squash.ratio.value = 6;
    master.connect(squash).connect(ctx.destination);
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  // Browsers only allow sound after the player has touched something.
  for (const type of ['pointerdown', 'keydown']) window.addEventListener(type, wake, { capture: true });

  // True if this kind of sound may play now.
  function allow(kind, gap) {
    if (!ctx || volume <= 0) return false;
    const t = ctx.currentTime;
    if (t - (last.get(kind) ?? -1) < gap) return false;
    last.set(kind, t);
    return true;
  }

  function noise(duration, { cut = 2000, q = 0.7, gain = 0.5, type = 'lowpass', delay = 0, sweep = 0 } = {}) {
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(cut, t);
    if (sweep) filter.frequency.exponentialRampToValueAtTime(Math.max(60, cut * sweep), t + duration);
    filter.Q.value = q;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.0008, t + duration);
    src.connect(filter).connect(amp).connect(master);
    src.start(t, Math.random() * 0.5, duration + 0.05);
  }

  function tone(freq, duration, { to = freq, gain = 0.3, type = 'sine', delay = 0 } = {}) {
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + duration);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.0008, t + duration);
    osc.connect(amp).connect(master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  function shot(kind) {
    const s = SHOTS[kind] ?? SHOTS.pistol;
    if (!allow(`shot-${kind}`, kind === 'smg' || kind === 'heavy' ? 0.05 : 0.03)) return;
    const pitch = 0.92 + Math.random() * 0.16;
    if (s.thunk) {
      tone(s.body * pitch, 0.12, { to: s.drop, gain: s.gain, type: 'triangle' });
      noise(0.08, { cut: s.cut, gain: s.gain * 0.5 });
      return;
    }
    noise(s.noise, { cut: s.cut * pitch, gain: s.gain, sweep: 0.3 });
    noise(0.025, { cut: 6000, gain: s.gain * 0.5, type: 'highpass' });
    tone(s.body * pitch, s.noise * 0.9, { to: s.drop, gain: s.gain * 0.7, type: 'triangle' });
    if (s.tail) noise(0.6, { cut: 500, gain: s.gain * 0.35, delay: 0.03, sweep: 0.4 });
  }

  const play = {
    reload() { if (allow('reload', 0.08)) { noise(0.04, { cut: 3500, q: 4, type: 'bandpass', gain: 0.25 }); noise(0.04, { cut: 2500, q: 4, type: 'bandpass', gain: 0.25, delay: 0.09 }); } },
    reloaded() { if (allow('reloaded', 0.08)) { noise(0.03, { cut: 4200, q: 5, type: 'bandpass', gain: 0.3 }); tone(900, 0.04, { gain: 0.06, type: 'square' }); } },
    hit() { if (allow('hit', 0.035)) noise(0.05, { cut: 900, gain: 0.22, q: 2, type: 'bandpass' }); },
    clang() { if (allow('clang', 0.06)) { tone(1800 + Math.random() * 600, 0.15, { to: 1400, gain: 0.12, type: 'square' }); tone(2700, 0.08, { gain: 0.06, type: 'triangle' }); } },
    death(big) { if (allow('death', 0.04)) { tone(big ? 220 : 520, big ? 0.6 : 0.18, { to: big ? 40 : 120, gain: 0.3, type: 'square' }); noise(big ? 0.7 : 0.15, { cut: 1400, gain: 0.35, sweep: 0.2 }); } },
    blast() { if (allow('blast', 0.05)) { noise(0.9, { cut: 900, gain: 0.9, sweep: 0.12 }); tone(120, 0.5, { to: 35, gain: 0.7 }); } },
    splat() { if (allow('splat', 0.05)) { noise(0.22, { cut: 600, gain: 0.35, q: 3, type: 'bandpass', sweep: 0.4 }); tone(260, 0.15, { to: 90, gain: 0.15 }); } },
    hurt() { if (allow('hurt', 0.1)) { tone(330, 0.25, { to: 110, gain: 0.35, type: 'sawtooth' }); noise(0.2, { cut: 1200, gain: 0.3 }); } },
    dead() { tone(440, 0.9, { to: 55, gain: 0.4, type: 'sawtooth' }); noise(1.0, { cut: 800, gain: 0.4, sweep: 0.2 }); },
    coin() { if (allow('coin', 0.045)) { const f = 1300 + Math.random() * 300; tone(f, 0.06, { gain: 0.09, type: 'square' }); tone(f * 1.5, 0.09, { gain: 0.07, type: 'square', delay: 0.05 }); } },
    dash() { if (allow('dash', 0.1)) noise(0.18, { cut: 1800, gain: 0.25, type: 'bandpass', q: 1.5, sweep: 0.4 }); },
    crash() { if (allow('crash', 0.1)) { noise(0.4, { cut: 500, gain: 0.6, sweep: 0.3 }); tone(90, 0.3, { to: 40, gain: 0.5 }); } },
    windup() { if (allow('windup', 0.25)) tone(180, 0.35, { to: 420, gain: 0.08, type: 'sawtooth' }); },
    incoming() { if (allow('incoming', 0.3)) { tone(660, 0.08, { gain: 0.08, type: 'square' }); tone(880, 0.08, { gain: 0.08, type: 'square', delay: 0.1 }); } },
    shieldbreak() { if (allow('shield', 0.1)) { noise(0.3, { cut: 5000, type: 'highpass', gain: 0.25 }); tone(1200, 0.25, { to: 300, gain: 0.12, type: 'triangle' }); } },
    phase() { tone(110, 0.8, { to: 70, gain: 0.5, type: 'sawtooth' }); },
    cleared() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, { gain: 0.14, type: 'square', delay: i * 0.09 })); },
    buy() { if (allow('buy', 0.05)) { tone(880, 0.07, { gain: 0.12, type: 'square' }); tone(1320, 0.12, { gain: 0.1, type: 'square', delay: 0.07 }); } },
    nope() { if (allow('nope', 0.1)) tone(160, 0.15, { gain: 0.15, type: 'square' }); },
    start() { [392, 523, 659].forEach((f, i) => tone(f, 0.12, { gain: 0.12, type: 'square', delay: i * 0.07 })); },
    deal() { [0, 1, 2].forEach((i) => noise(0.05, { cut: 3000, q: 2, type: 'bandpass', gain: 0.3, delay: i * 0.12 })); },
    tick() { if (allow('tick', 0.06)) tone(1400 + Math.random() * 400, 0.025, { gain: 0.05, type: 'square' }); },
    jackpot() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.16, { gain: 0.14, type: 'square', delay: i * 0.08 })); },
    swing(kind) {
      if (!allow('swing', 0.05)) return;
      if (kind === 'stab') noise(0.08, { cut: 2600, q: 3, type: 'bandpass', gain: 0.3, sweep: 1.8 });
      else noise(kind === 'slice' ? 0.14 : 0.2, { cut: kind === 'slice' ? 3200 : 1200, q: 2, type: 'bandpass', gain: 0.35, sweep: 2.2 });
    },
    smack() { if (allow('smack', 0.05)) { noise(0.09, { cut: 700, gain: 0.5 }); tone(160, 0.1, { to: 60, gain: 0.4, type: 'triangle' }); } },
    saw() { if (allow('saw', 0.07)) { tone(95 + Math.random() * 20, 0.09, { gain: 0.12, type: 'sawtooth' }); noise(0.08, { cut: 1600, q: 4, type: 'bandpass', gain: 0.15 }); } },
    parry() { if (allow('parry', 0.06)) { tone(2200, 0.1, { to: 1700, gain: 0.12, type: 'square' }); } },
    zap() { if (allow('zap', 0.05)) { noise(0.12, { cut: 4500, type: 'highpass', gain: 0.25 }); tone(900, 0.1, { to: 200, gain: 0.1, type: 'sawtooth' }); } },
    shockwave() { noise(0.5, { cut: 600, gain: 0.7, sweep: 0.2 }); tone(80, 0.4, { to: 40, gain: 0.5 }); },
    freeze() { noise(0.5, { cut: 6000, type: 'highpass', gain: 0.3, sweep: 0.5 }); tone(1800, 0.3, { to: 2400, gain: 0.06, type: 'triangle' }); },
    blink() { tone(400, 0.15, { to: 1600, gain: 0.12, type: 'triangle' }); },
    token() { [988, 1319, 1760].forEach((f, i) => tone(f, 0.08, { gain: 0.1, type: 'square', delay: i * 0.05 })); },
    heal() { if (allow('heal', 0.2)) tone(660, 0.2, { to: 990, gain: 0.08, type: 'triangle' }); },
    revive() { [392, 523, 784].forEach((f, i) => tone(f, 0.25, { gain: 0.14, type: 'triangle', delay: i * 0.1 })); },
    ability() { tone(520, 0.08, { to: 780, gain: 0.08, type: 'square' }); },
    power() { tone(330, 0.1, { to: 660, gain: 0.1, type: 'square' }); },
    plate() { if (allow('plate', 0.1)) tone(900, 0.12, { to: 700, gain: 0.12, type: 'square' }); },
    landing() { noise(0.4, { cut: 500, gain: 0.7, sweep: 0.3 }); tone(70, 0.3, { to: 35, gain: 0.6 }); },
    nuke() { noise(1.4, { cut: 1200, gain: 1, sweep: 0.08 }); tone(60, 1.0, { to: 25, gain: 0.8 }); },
  };

  return {
    // Plays whatever the fight's events call for.
    onEvents(events) {
      if (!ctx) return;
      for (const e of events) {
        if (e.type === 'shot') shot(e.sound);
        else if (e.type === 'swing') play.swing(e.sound);
        else if (e.type === 'death') play.death(e.boss);
        else if (e.type === 'blast') play.blast();
        else if (play[e.type] && !['start', 'swing', 'deal', 'tick', 'jackpot'].includes(e.type)) play[e.type]();
      }
    },
    play: (name) => { wake(); if (ctx && play[name]) play[name](); },
    setVolume(v) { volume = v; if (master) master.gain.value = v; },
  };
}
