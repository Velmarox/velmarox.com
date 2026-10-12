// Clack Arena: little synthesized sounds, one per kind of event, so you can hear what happened without looking:
// a thump for a hit, a clink for a block, a rising chime for a heal, a zap for thorns. No files; Web Audio only.
(() => {
  const A = window.ARENA;
  let ctx = null, master = null;

  function audio() {
    if (A.settings && !A.settings.sound) return null;
    try {
      if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination); }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch { return null; }
  }

  // One tone: type, frequency (start, end), length, volume, delay.
  function tone(type, f0, f1, len, vol = 0.3, delay = 0) {
    const c = audio(); if (!c) return;
    const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + len);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(master); o.start(t); o.stop(t + len + 0.02);
  }
  // A burst of filtered noise (impacts).
  function noise(len, vol = 0.3, freq = 900, delay = 0) {
    const c = audio(); if (!c) return;
    const t = c.currentTime + delay, buf = c.createBuffer(1, Math.ceil(c.sampleRate * len), c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf; f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = vol;
    s.connect(f).connect(g).connect(master); s.start(t);
  }

  A.sfx = {
    unlock: () => audio(),
    click: () => tone('square', 520, 480, 0.05, 0.08),
    hover: () => tone('square', 900, 900, 0.025, 0.03),
    pull: (k) => tone('triangle', 180 + k * 420, 200 + k * 420, 0.04, 0.05),
    release: () => { noise(0.12, 0.25, 2400); tone('sawtooth', 300, 900, 0.12, 0.06); },
    turn: () => { tone('square', 660, 660, 0.06, 0.09); tone('square', 990, 990, 0.08, 0.09, 0.07); },
    think: () => tone('sine', 440, 460, 0.07, 0.05),
    clack: (n) => { noise(0.18, 0.5, 1800 + n * 800); tone('square', 200 - n * 30, 60, 0.18, 0.18); },
    hit: (n) => { noise(0.16, 0.45, 700); tone('sine', 160, 50, 0.22 + n * 0.02, 0.35); },
    hurt: (n) => { noise(0.2, 0.5, 500); tone('sawtooth', 140, 40, 0.28, 0.2 + Math.min(0.2, n * 0.03)); },
    guard: () => { tone('square', 1300, 1250, 0.09, 0.08); tone('triangle', 2600, 2500, 0.15, 0.06, 0.02); },
    block: () => { tone('square', 900, 700, 0.08, 0.1); noise(0.06, 0.2, 4000); },
    heal: () => { [523, 659, 784].forEach((f, i) => tone('sine', f, f, 0.16, 0.12, i * 0.06)); },
    thorn: () => tone('sawtooth', 1400, 200, 0.16, 0.1),
    charge: () => tone('sawtooth', 200, 1200, 0.3, 0.08),
    fizzle: () => tone('triangle', 300, 120, 0.2, 0.08),
    coin: () => { tone('square', 988, 988, 0.06, 0.08); tone('square', 1319, 1319, 0.12, 0.08, 0.06); },
    buy: () => { tone('square', 784, 784, 0.05, 0.08); tone('square', 1046, 1046, 0.1, 0.08, 0.05); },
    forge: () => { noise(0.1, 0.4, 3000); tone('square', 1500, 1400, 0.12, 0.08); noise(0.1, 0.4, 3000, 0.16); tone('square', 1700, 1600, 0.14, 0.08, 0.16); },
    win: () => { [523, 659, 784, 1046].forEach((f, i) => tone('square', f, f, 0.14, 0.09, i * 0.1)); },
    lose: () => { [392, 330, 262, 196].forEach((f, i) => tone('triangle', f, f * 0.98, 0.22, 0.12, i * 0.16)); },
  };
})();
