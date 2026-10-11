// v6.14.1: dice tray themes. Each one paints a whole tray on a canvas (its frame and the floor inside it), drawn
// in code, nothing loaded. Dice_Tray lays it under the dice; Settings > Dice shows them as a grid to choose from.
// fx, fy: the frame's thickness in pixels (left/right, top/bottom), so the dice land on the floor, not the frame.
(() => {
  let seedV = 1;
  const rnd = () => ((seedV = (seedV * 16807) % 2147483647) / 2147483647);
  const seed = (n) => { seedV = n; };
  const lin = (g, x0, y0, x1, y1, stops) => { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; };
  const rad = (g, x, y, r0, r1, stops) => { const gr = g.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; };

  /** The frame's four bars, each shaded across its width (outer edge to inner edge), with a dark lip inside. */
  function bars(g, W, H, fx, fy, outer, mid, inner, lip = 'rgba(0,0,0,0.45)') {
    const side = (x0, y0, x1, y1, rect) => { g.fillStyle = lin(g, x0, y0, x1, y1, [[0, outer], [0.5, mid], [1, inner]]); g.fillRect(...rect); };
    side(0, 0, 0, fy, [0, 0, W, fy]); side(0, H, 0, H - fy, [0, H - fy, W, fy]);
    side(0, 0, fx, 0, [0, 0, fx, H]); side(W, 0, W - fx, 0, [W - fx, 0, fx, H]);
    g.strokeStyle = lip; g.lineWidth = Math.max(2, Math.min(fx, fy) * 0.12); g.strokeRect(fx, fy, W - 2 * fx, H - 2 * fy);
  }
  /** Inner floor rectangle: fill it and run a painter clipped to it. */
  function floor(g, W, H, fx, fy, fill, paint) {
    g.save(); g.beginPath(); g.rect(fx, fy, W - 2 * fx, H - 2 * fy); g.clip();
    g.fillStyle = fill; g.fillRect(0, 0, W, H); if (paint) paint(fx, fy, W - 2 * fx, H - 2 * fy);
    g.fillStyle = rad(g, W / 2, H / 2, Math.min(W, H) * 0.25, Math.max(W, H) * 0.7, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.42)']]); g.fillRect(0, 0, W, H);   // a soft vignette
    g.restore();
  }
  const speck = (g, x, y, w, h, n, col, s0 = 0.6, s1 = 2) => { for (let i = 0; i < n; i++) { g.fillStyle = typeof col === 'function' ? col() : col; const s = s0 + rnd() * (s1 - s0); g.fillRect(x + rnd() * w, y + rnd() * h, s, s); } };
  const corners = (W, H, fx, fy) => [[fx / 2, fy / 2], [W - fx / 2, fy / 2], [fx / 2, H - fy / 2], [W - fx / 2, H - fy / 2]];
  const grainBar = (g, x, y, w, h, n, col) => { for (let i = 0; i < n; i++) { g.fillStyle = col; g.fillRect(x + rnd() * w, y + rnd() * h, 10 + rnd() * 40, 1); } };

  const THEMES = {
    tavern: { name: 'Fantasy Tavern', paint(g, W, H, fx, fy) {
      floor(g, W, H, fx, fy, '#6b4a2e', (x, y, w, h) => { speck(g, x, y, w, h, 5000, () => `rgba(${40 + rnd() * 30 | 0},${25 + rnd() * 20 | 0},${12},${0.15 + rnd() * 0.2})`, 1, 3); g.fillStyle = rad(g, x + w / 2, y + h / 2, 0, w * 0.6, [[0, 'rgba(160,110,60,0.35)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(x, y, w, h); });
      bars(g, W, H, fx, fy, '#3e2615', '#6d4626', '#4a2e18'); grainBar(g, 0, 0, W, fy, 300, 'rgba(30,18,8,0.35)'); grainBar(g, 0, H - fy, W, fy, 300, 'rgba(30,18,8,0.35)');
      corners(W, H, fx, fy).forEach(([cx, cy]) => { const s = Math.min(fx, fy) * 1.5; g.fillStyle = lin(g, cx - s / 2, cy - s / 2, cx + s / 2, cy + s / 2, [[0, '#8a8f96'], [1, '#3b3e44']]); g.fillRect(cx - s / 2, cy - s / 2, s, s); g.fillStyle = '#c9ccd2'; [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]].forEach(([a, b]) => { g.beginPath(); g.arc(cx + a * s, cy + b * s, s * 0.07, 0, 6.3); g.fill(); }); });
    } },
    cyberpunk: { name: 'Cyberpunk', paint(g, W, H, fx, fy) {
      floor(g, W, H, fx, fy, '#0c1230', (x, y, w, h) => { g.lineWidth = 2; for (let i = 0; i < 70; i++) { g.strokeStyle = rnd() < 0.5 ? 'rgba(0,220,255,0.35)' : 'rgba(255,60,220,0.3)'; let px = x + rnd() * w, py = y + rnd() * h; g.beginPath(); g.moveTo(px, py); for (let k = 0; k < 4; k++) { if (rnd() < 0.5) px += (rnd() - 0.5) * w * 0.3; else py += (rnd() - 0.5) * h * 0.3; g.lineTo(px, py); } g.stroke(); g.fillStyle = g.strokeStyle; g.fillRect(px - 3, py - 3, 6, 6); } });
      bars(g, W, H, fx, fy, '#05060c', '#141a2e', '#0a0d18');
      g.save(); g.lineWidth = Math.min(fx, fy) * 0.28; g.shadowBlur = Math.min(fx, fy) * 0.8;
      g.strokeStyle = g.shadowColor = '#18e4ff'; g.strokeRect(fx * 0.5, fy * 0.5, W - fx, H - fy);
      g.lineWidth = Math.min(fx, fy) * 0.1; g.strokeStyle = g.shadowColor = '#ff3fd8'; g.strokeRect(fx * 0.82, fy * 0.82, W - fx * 1.64, H - fy * 1.64); g.restore();
    } },
    druid: { name: 'Forest Druid', paint(g, W, H, fx, fy) {
      floor(g, W, H, fx, fy, '#3f5a2a', (x, y, w, h) => { speck(g, x, y, w, h, 6000, () => `rgba(${70 + rnd() * 40 | 0},${110 + rnd() * 40 | 0},${40},${0.25})`, 1, 3); for (let i = 0; i < 40; i++) { g.save(); g.translate(x + rnd() * w, y + rnd() * h); g.rotate(rnd() * 6.3); g.fillStyle = ['#6f8f3a', '#86a24a', '#5a6f2c', '#9a7a3a'][i % 4]; g.globalAlpha = 0.7; g.beginPath(); g.ellipse(0, 0, 14, 6, 0, 0, 6.3); g.fill(); g.restore(); } });
      bars(g, W, H, fx, fy, '#3a2817', '#5d4127', '#3d2a18');
      g.save(); g.lineCap = 'round'; for (let k = 0; k < 2; k++) { g.strokeStyle = k ? '#4d3520' : '#6e4e2e'; g.lineWidth = Math.min(fx, fy) * (k ? 0.22 : 0.32); g.beginPath(); for (let t = 0; t <= 1; t += 0.01) { const per = 2 * (W + H), d = t * per; let px, py; if (d < W) { px = d; py = fy / 2; } else if (d < W + H) { px = W - fx / 2; py = d - W; } else if (d < 2 * W + H) { px = W - (d - W - H); py = H - fy / 2; } else { px = fx / 2; py = H - (d - 2 * W - H); } const wob = Math.sin(t * 90 + k * 2) * Math.min(fx, fy) * 0.18; if (t === 0) g.moveTo(px + wob, py + wob); else g.lineTo(px + wob, py + wob); } g.stroke(); } g.restore();
      for (let i = 0; i < 70; i++) { const onX = rnd() < 0.5, px = onX ? rnd() * W : (rnd() < 0.5 ? fx * 0.5 : W - fx * 0.5), py = onX ? (rnd() < 0.5 ? fy * 0.5 : H - fy * 0.5) : rnd() * H; g.save(); g.translate(px, py); g.rotate(rnd() * 6.3); g.fillStyle = ['#5f8a2e', '#78a33a', '#4a6f24'][i % 3]; g.beginPath(); g.ellipse(0, 0, Math.min(fx, fy) * 0.32, Math.min(fx, fy) * 0.14, 0, 0, 6.3); g.fill(); g.restore(); }
    } },
    pirate: { name: 'Sea Pirate', paint(g, W, H, fx, fy) {
      floor(g, W, H, fx, fy, '#d8c08f', (x, y, w, h) => { for (let i = 0; i < 18; i++) { g.fillStyle = rad(g, x + rnd() * w, y + rnd() * h, 0, 40 + rnd() * 90, [[0, 'rgba(120,80,30,0.18)'], [1, 'rgba(120,80,30,0)']]); g.fillRect(x, y, w, h); }
        g.strokeStyle = 'rgba(120,40,20,0.6)'; g.setLineDash([8, 8]); g.lineWidth = 3; g.beginPath(); g.moveTo(x + w * 0.15, y + h * 0.75); g.bezierCurveTo(x + w * 0.4, y + h * 0.4, x + w * 0.6, y + h * 0.9, x + w * 0.82, y + h * 0.3); g.stroke(); g.setLineDash([]);
        g.strokeStyle = 'rgba(160,30,20,0.8)'; g.lineWidth = 5; const X = x + w * 0.82, Y = y + h * 0.3; g.beginPath(); g.moveTo(X - 12, Y - 12); g.lineTo(X + 12, Y + 12); g.moveTo(X + 12, Y - 12); g.lineTo(X - 12, Y + 12); g.stroke();
        g.strokeStyle = 'rgba(80,55,25,0.6)'; g.lineWidth = 2; const cx = x + w * 0.18, cy = y + h * 0.25, r = Math.min(w, h) * 0.12; g.beginPath(); g.arc(cx, cy, r, 0, 6.3); g.stroke(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, l = k % 2 ? r * 0.6 : r * 1.25; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l); g.stroke(); } });
      bars(g, W, H, fx, fy, '#4a3523', '#7a5a3a', '#55402a'); grainBar(g, 0, 0, W, fy, 250, 'rgba(40,25,10,0.4)');
      g.save(); g.strokeStyle = '#c9a66b'; g.lineWidth = Math.min(fx, fy) * 0.22; g.setLineDash([Math.min(fx, fy) * 0.35, Math.min(fx, fy) * 0.12]); g.strokeRect(fx * 0.88, fy * 0.88, W - fx * 1.76, H - fy * 1.76); g.restore();
    } },
    space: { name: 'Cosmic Space', paint(g, W, H, fx, fy) {
      floor(g, W, H, fx, fy, '#0a0820', (x, y, w, h) => { [[300, 70], [270, 55], [210, 50], [330, 60]].forEach(([hue], i) => { for (let k = 0; k < 4; k++) { const px = x + rnd() * w, py = y + rnd() * h, r = 60 + rnd() * Math.max(w, h) * 0.35; g.fillStyle = rad(g, px, py, 0, r, [[0, `hsla(${hue + rnd() * 20},80%,55%,${0.18 + rnd() * 0.12})`], [1, `hsla(${hue},80%,40%,0)`]]); g.fillRect(x, y, w, h); } }); speck(g, x, y, w, h, 700, () => `rgba(255,255,255,${0.4 + rnd() * 0.6})`, 0.6, 2.2); });
      bars(g, W, H, fx, fy, '#11132a', '#2a2e55', '#161a38'); g.strokeStyle = '#5a6cff'; g.lineWidth = Math.min(fx, fy) * 0.1; g.strokeRect(fx * 0.35, fy * 0.35, W - fx * 0.7, H - fy * 0.7);
      corners(W, H, fx, fy).forEach(([cx, cy]) => { g.fillStyle = '#8fa0ff'; g.beginPath(); for (let k = 0; k < 8; k++) { const r = k % 2 ? Math.min(fx, fy) * 0.12 : Math.min(fx, fy) * 0.38, a = -Math.PI / 2 + k * Math.PI / 4; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath(); g.fill(); });
    } },
    vampire: { name: 'Gothic Vampire', paint(g, W, H, fx, fy) {
      floor(g, W, H, fx, fy, '#6e0f1c', (x, y, w, h) => { g.fillStyle = rad(g, x + w / 2, y + h / 2, 0, Math.max(w, h) * 0.6, [[0, 'rgba(180,30,50,0.45)'], [1, 'rgba(30,0,5,0)']]); g.fillRect(x, y, w, h); speck(g, x, y, w, h, 9000, () => `rgba(${rnd() < 0.5 ? 0 : 200},0,${rnd() < 0.5 ? 10 : 30},0.06)`, 1, 2); });
      bars(g, W, H, fx, fy, '#08080a', '#26252a', '#121114');
      g.strokeStyle = '#3c3a40'; g.lineWidth = 2; for (let i = 0; i < 220; i++) { const onX = i % 2, px = onX ? rnd() * W : (rnd() < 0.5 ? rnd() * fx : W - rnd() * fx), py = onX ? (rnd() < 0.5 ? rnd() * fy : H - rnd() * fy) : rnd() * H, a = rnd() * 6.3, l = Math.min(fx, fy) * (0.2 + rnd() * 0.3); g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); g.stroke(); }
      corners(W, H, fx, fy).forEach(([cx, cy]) => { g.fillStyle = '#4a464e'; g.beginPath(); g.moveTo(cx, cy - fy * 0.6); g.lineTo(cx + fx * 0.25, cy); g.lineTo(cx, cy + fy * 0.6); g.lineTo(cx - fx * 0.25, cy); g.closePath(); g.fill(); });
    } },
    steampunk: { name: 'Steampunk', paint(g, W, H, fx, fy) {
      const gear = (cx, cy, r, teeth, col) => { g.fillStyle = col; g.beginPath(); for (let k = 0; k < teeth * 2; k++) { const a = (k / (teeth * 2)) * Math.PI * 2, rr = k % 2 ? r : r * 0.82; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.closePath(); g.fill(); g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(cx, cy, r * 0.32, 0, 6.3); g.fill(); };
      floor(g, W, H, fx, fy, '#c9a978', (x, y, w, h) => { for (let i = 0; i < 9; i++) { g.globalAlpha = 0.12; gear(x + rnd() * w, y + rnd() * h, 30 + rnd() * 70, 10 + (rnd() * 8 | 0), '#5a3a18'); } g.globalAlpha = 1; });
      bars(g, W, H, fx, fy, '#5a3a14', '#c4923e', '#7a5220');
      g.strokeStyle = '#e2b768'; g.lineWidth = Math.min(fx, fy) * 0.16; g.strokeRect(fx * 0.5, fy * 0.5, W - fx, H - fy);
      corners(W, H, fx, fy).forEach(([cx, cy]) => gear(cx, cy, Math.min(fx, fy) * 0.62, 10, '#b8873a'));
    } },
    candy: { name: 'Candy Sweet', paint(g, W, H, fx, fy) {
      floor(g, W, H, fx, fy, '#f8d6e2', (x, y, w, h) => { const cols = ['#ff6fa8', '#6fd3ff', '#ffe36f', '#9cff8f', '#c49bff', '#ffffff']; for (let i = 0; i < 260; i++) { g.save(); g.translate(x + rnd() * w, y + rnd() * h); g.rotate(rnd() * 6.3); g.fillStyle = cols[i % cols.length]; g.fillRect(-7, -2, 14, 4); g.restore(); } });
      g.save(); const stripe = (rect) => { g.save(); g.beginPath(); g.rect(...rect); g.clip(); g.fillStyle = '#ffffff'; g.fillRect(...rect); g.fillStyle = '#ff5c95'; const s = Math.min(fx, fy) * 0.55; for (let d = -H; d < W + H; d += s * 2) { g.beginPath(); g.moveTo(d, 0); g.lineTo(d + s, 0); g.lineTo(d + s - H, H); g.lineTo(d - H, H); g.closePath(); g.fill(); } g.restore(); };
      stripe([0, 0, W, fy]); stripe([0, H - fy, W, fy]); stripe([0, 0, fx, H]); stripe([W - fx, 0, fx, H]); g.restore();
      g.strokeStyle = 'rgba(160,40,90,0.45)'; g.lineWidth = 3; g.strokeRect(fx, fy, W - 2 * fx, H - 2 * fy);
      corners(W, H, fx, fy).forEach(([cx, cy]) => { const r = Math.min(fx, fy) * 0.7; g.fillStyle = rad(g, cx - r * 0.3, cy - r * 0.3, 0, r, [[0, '#ffffff'], [0.35, '#ff9cc4'], [1, '#e8457f']]); g.beginPath(); g.arc(cx, cy, r, 0, 6.3); g.fill(); });
    } },
    egypt: { name: 'Egyptian Gold', paint(g, W, H, fx, fy) {
      floor(g, W, H, fx, fy, '#d9b26a', (x, y, w, h) => { for (let i = 0; i < 30; i++) { g.strokeStyle = 'rgba(150,100,40,0.25)'; g.lineWidth = 2; const px = x + rnd() * w, py = y + rnd() * h; g.beginPath(); g.moveTo(px, py); g.quadraticCurveTo(px + 40, py - 10, px + 90, py + 4); g.stroke(); } speck(g, x, y, w, h, 3000, 'rgba(120,80,30,0.15)', 1, 2); });
      bars(g, W, H, fx, fy, '#7a5410', '#e3b84a', '#9c7018', 'rgba(60,35,5,0.6)');
      g.fillStyle = 'rgba(70,40,5,0.75)'; const band = (horiz) => { const n = horiz ? Math.floor(W / (fy * 0.8)) : Math.floor(H / (fx * 0.8)); for (let k = 1; k < n; k++) { const s = (horiz ? fy : fx) * 0.28, px = horiz ? k * (W / n) : fx / 2, py = horiz ? fy / 2 : k * (H / n), kind = k % 4; g.save(); g.translate(px, py); if (kind === 0) { g.fillRect(-s * 0.15, -s, s * 0.3, s * 2); } else if (kind === 1) { g.beginPath(); g.arc(0, 0, s * 0.7, 0, 6.3); g.fill(); } else if (kind === 2) { g.beginPath(); g.moveTo(-s, s * 0.6); g.lineTo(0, -s); g.lineTo(s, s * 0.6); g.closePath(); g.fill(); } else { g.beginPath(); g.ellipse(0, 0, s, s * 0.45, 0, 0, 6.3); g.fill(); } g.restore(); if (horiz) { g.save(); g.translate(px, H - fy / 2); g.fillRect(-s * 0.15, -s, s * 0.3, s * 2); g.restore(); } else { g.save(); g.translate(W - fx / 2, py); g.beginPath(); g.arc(0, 0, s * 0.6, 0, 6.3); g.fill(); g.restore(); } } };
      band(true); band(false);
    } },
    scifi: { name: 'Sci-Fi Mech', paint(g, W, H, fx, fy) {
      floor(g, W, H, fx, fy, '#0d3a3e', (x, y, w, h) => { g.strokeStyle = 'rgba(80,220,220,0.22)'; g.lineWidth = 1.5; const s = Math.min(w, h) / 9; for (let px = x; px < x + w; px += s) { g.beginPath(); g.moveTo(px, y); g.lineTo(px, y + h); g.stroke(); } for (let py = y; py < y + h; py += s) { g.beginPath(); g.moveTo(x, py); g.lineTo(x + w, py); g.stroke(); } g.strokeStyle = 'rgba(80,255,240,0.35)'; g.beginPath(); g.arc(x + w / 2, y + h / 2, Math.min(w, h) * 0.3, 0, 6.3); g.stroke(); });
      bars(g, W, H, fx, fy, '#2a2e33', '#5a6068', '#363b41');
      const hazard = (rect) => { g.save(); g.beginPath(); g.rect(...rect); g.clip(); g.fillStyle = '#f2c230'; g.fillRect(...rect); g.fillStyle = '#1a1a1a'; const s = rect[3] * 0.9; for (let d = rect[0] - s * 2; d < rect[0] + rect[2] + s; d += s * 2) { g.beginPath(); g.moveTo(d, rect[1]); g.lineTo(d + s, rect[1]); g.lineTo(d + s * 2, rect[1] + rect[3]); g.lineTo(d + s, rect[1] + rect[3]); g.closePath(); g.fill(); } g.restore(); };
      hazard([W * 0.3, fy * 0.18, W * 0.4, fy * 0.5]); hazard([W * 0.3, H - fy * 0.68, W * 0.4, fy * 0.5]);
      corners(W, H, fx, fy).forEach(([cx, cy]) => { const s = Math.min(fx, fy) * 1.3; g.fillStyle = '#4a5058'; g.fillRect(cx - s / 2, cy - s / 2, s, s); g.strokeStyle = '#7a828c'; g.lineWidth = 2; g.strokeRect(cx - s / 2 + 3, cy - s / 2 + 3, s - 6, s - 6); g.fillStyle = '#9aa2ac'; g.beginPath(); g.arc(cx, cy, s * 0.12, 0, 6.3); g.fill(); });
    } },
    eldritch: { name: 'Eldritch Horror', paint(g, W, H, fx, fy) {
      floor(g, W, H, fx, fy, '#1a0b2a', (x, y, w, h) => { for (let k = 0; k < 60; k++) { g.strokeStyle = `rgba(${140 + rnd() * 80 | 0},${40 + rnd() * 40 | 0},${200 + rnd() * 55 | 0},${0.12 + rnd() * 0.15})`; g.lineWidth = 3 + rnd() * 6; const cx = x + w / 2, cy = y + h / 2, a0 = rnd() * 6.3, r0 = rnd() * Math.min(w, h) * 0.5; g.beginPath(); g.arc(cx, cy, r0, a0, a0 + 1 + rnd() * 2); g.stroke(); } g.fillStyle = rad(g, x + w / 2, y + h / 2, 0, Math.min(w, h) * 0.35, [[0, 'rgba(200,120,255,0.35)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(x, y, w, h); });
      bars(g, W, H, fx, fy, '#1a0a26', '#3a1a52', '#22102f');
      for (let i = 0; i < 26; i++) { const t = i / 26, per = 2 * (W + H), d = t * per; let px, py, ang; if (d < W) { px = d; py = fy / 2; ang = 0; } else if (d < W + H) { px = W - fx / 2; py = d - W; ang = Math.PI / 2; } else if (d < 2 * W + H) { px = W - (d - W - H); py = H - fy / 2; ang = Math.PI; } else { px = fx / 2; py = H - (d - 2 * W - H); ang = -Math.PI / 2; }
        const s = Math.min(fx, fy); g.save(); g.translate(px, py); g.rotate(ang); g.strokeStyle = '#7a3aa8'; g.lineCap = 'round'; g.lineWidth = s * 0.34; g.beginPath(); g.moveTo(-s * 0.9, 0); g.bezierCurveTo(-s * 0.3, -s * 0.5, s * 0.3, s * 0.5, s * 0.9, 0); g.stroke(); g.fillStyle = '#d6a8f0'; for (let k = -2; k <= 2; k++) { g.beginPath(); g.arc(k * s * 0.3, Math.sin(k) * s * 0.1, s * 0.06, 0, 6.3); g.fill(); } g.restore(); }
    } },
    celestial: { name: 'Celestial Angel', paint(g, W, H, fx, fy) {
      floor(g, W, H, fx, fy, '#cfdcf2', (x, y, w, h) => { for (let i = 0; i < 22; i++) { const px = x + rnd() * w, py = y + rnd() * h, r = 40 + rnd() * 90; g.fillStyle = rad(g, px, py, 0, r, [[0, 'rgba(255,255,255,0.7)'], [1, 'rgba(255,255,255,0)']]); g.fillRect(x, y, w, h); } });
      bars(g, W, H, fx, fy, '#c8c4bc', '#f6f3ee', '#dcd8d0', 'rgba(150,120,60,0.6)');
      g.strokeStyle = '#d4a93c'; g.lineWidth = Math.min(fx, fy) * 0.1; g.strokeRect(fx * 0.25, fy * 0.25, W - fx * 0.5, H - fy * 0.5); g.strokeRect(fx * 0.85, fy * 0.85, W - fx * 1.7, H - fy * 1.7);
      corners(W, H, fx, fy).forEach(([cx, cy]) => { g.fillStyle = '#d4a93c'; const s = Math.min(fx, fy) * 0.55; for (let k = 0; k < 4; k++) { g.save(); g.translate(cx, cy); g.rotate(k * Math.PI / 2); g.beginPath(); g.ellipse(0, -s * 0.55, s * 0.22, s * 0.55, 0, 0, 6.3); g.fill(); g.restore(); } });
    } },
    autumn: { name: 'Autumn Harvest', paint(g, W, H, fx, fy) {
      floor(g, W, H, fx, fy, '#9a5418', (x, y, w, h) => { const cols = ['#c8641e', '#e08a2a', '#a8401a', '#d9a03a', '#7a3a12']; for (let i = 0; i < 160; i++) { g.save(); g.translate(x + rnd() * w, y + rnd() * h); g.rotate(rnd() * 6.3); g.fillStyle = cols[i % cols.length]; g.globalAlpha = 0.85; const s = 8 + rnd() * 10; g.beginPath(); g.moveTo(0, -s); g.bezierCurveTo(s * 0.8, -s * 0.4, s * 0.6, s * 0.6, 0, s); g.bezierCurveTo(-s * 0.6, s * 0.6, -s * 0.8, -s * 0.4, 0, -s); g.fill(); g.restore(); } });
      bars(g, W, H, fx, fy, '#7a5226', '#c99a58', '#8f6430');
      g.strokeStyle = 'rgba(70,45,15,0.55)'; g.lineWidth = 3; const plait = (x0, y0, x1, y1) => { const n = Math.hypot(x1 - x0, y1 - y0) / 14; for (let k = 0; k < n; k++) { const t = k / n, px = x0 + (x1 - x0) * t, py = y0 + (y1 - y0) * t, o = Math.min(fx, fy) * 0.3 * (k % 2 ? 1 : -1); g.beginPath(); g.moveTo(px - (y1 - y0 ? o : 0), py - (x1 - x0 ? o : 0)); g.lineTo(px + (y1 - y0 ? o : 0) + 6, py + (x1 - x0 ? o : 0) + 6); g.stroke(); } };
      plait(0, fy / 2, W, fy / 2); plait(0, H - fy / 2, W, H - fy / 2); plait(fx / 2, 0, fx / 2, H); plait(W - fx / 2, 0, W - fx / 2, H);
      corners(W, H, fx, fy).forEach(([cx, cy]) => { const r = Math.min(fx, fy) * 0.62; for (let k = -1; k <= 1; k++) { g.fillStyle = k ? '#d9661c' : '#ee7a26'; g.beginPath(); g.ellipse(cx + k * r * 0.4, cy, r * 0.5, r * 0.75, 0, 0, 6.3); g.fill(); } g.fillStyle = '#4a6a1e'; g.fillRect(cx - r * 0.08, cy - r * 0.95, r * 0.16, r * 0.3); });
    } },
    retro: { name: 'Retro 8-Bit', paint(g, W, H, fx, fy) {
      const px = Math.max(6, Math.round(Math.min(fx, fy) / 4));
      floor(g, W, H, fx, fy, '#1a1530', (x, y, w, h) => { const cols = ['#8a2be2', '#1e90ff', '#ff1493', '#32cd32', '#ffd700']; const s = Math.round(Math.min(w, h) / 6); for (let gx = 0; gx * s < w; gx++) for (let gy = 0; gy * s < h; gy++) { g.fillStyle = cols[(gx * 3 + gy * 2) % cols.length]; g.globalAlpha = 0.55; g.fillRect(x + gx * s + px / 2, y + gy * s + px / 2, s - px, s - px); } g.globalAlpha = 1; });
      g.imageSmoothingEnabled = false;
      for (let x = 0; x < W; x += px) for (let y = 0; y < H; y += px) { if (x >= fx && x < W - fx && y >= fy && y < H - fy) continue; g.fillStyle = ((x + y) / px) % 2 ? '#1c3faa' : '#2856d8'; g.fillRect(x, y, px, px); }
      g.fillStyle = '#ffd700'; for (let x = 0; x < W; x += px * 3) { g.fillRect(x, fy - px, px, px); g.fillRect(x, H - fy, px, px); }
      corners(W, H, fx, fy).forEach(([cx, cy]) => { g.fillStyle = '#e8303a'; g.fillRect(cx - px * 1.5, cy - px * 0.5, px * 3, px); g.fillRect(cx - px * 0.5, cy - px * 1.5, px, px * 3); });
    } },
    arctic: { name: 'Arctic Ice', paint(g, W, H, fx, fy) {
      floor(g, W, H, fx, fy, '#b9dcef', (x, y, w, h) => { g.fillStyle = lin(g, x, y, x + w, y + h, [[0, 'rgba(255,255,255,0.5)'], [1, 'rgba(120,170,210,0.3)']]); g.fillRect(x, y, w, h); g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1.5; for (let i = 0; i < 10; i++) { let cx = x + rnd() * w, cy = y + rnd() * h; g.beginPath(); g.moveTo(cx, cy); for (let k = 0; k < 6; k++) { cx += (rnd() - 0.5) * 60; cy += (rnd() - 0.5) * 60; g.lineTo(cx, cy); } g.stroke(); } });
      bars(g, W, H, fx, fy, '#7fb3d6', '#e8f6ff', '#a9d2ec', 'rgba(60,110,150,0.5)');
      g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 2; for (let i = 0; i < 40; i++) { const onX = i % 2, px0 = onX ? rnd() * W : (rnd() < 0.5 ? rnd() * fx : W - rnd() * fx), py0 = onX ? (rnd() < 0.5 ? rnd() * fy : H - rnd() * fy) : rnd() * H; g.beginPath(); g.moveTo(px0, py0); g.lineTo(px0 + (rnd() - 0.5) * 30, py0 + (rnd() - 0.5) * 30); g.stroke(); }
      g.fillStyle = 'rgba(225,245,255,0.95)'; for (let x = fx * 0.6; x < W - fx * 0.6; x += Math.min(fx, fy) * 0.9) { const l = Math.min(fx, fy) * (0.4 + rnd() * 0.8); g.beginPath(); g.moveTo(x - 7, fy); g.lineTo(x + 7, fy); g.lineTo(x, fy + l); g.closePath(); g.fill(); }
    } },
  };

  /* Clack Attack v1.2.0: painted trays. A picture in Table/Trays/ (a square tray seen from above) takes over a theme;
     frame is how far in its floor starts, as a share of the picture's side. It's drawn nine-sliced: the corners as they
     are, the edges stretched along their length, the floor cropped to fit. Until the picture loads (or if it's missing)
     the drawn-in-code tray above stands in, so a theme without a picture still works. */
  const PICS = {
    arctic: ['Arctic_Ice', 0.11], autumn: ['Autumn_Harvest', 0.10], candy: ['Candy_Sweet', 0.10], celestial: ['Celestial_Angel', 0.13],
    space: ['Cosmic_Space', 0.07], cyberpunk: ['Cyberpunk', 0.09], egypt: ['Egyptian_Gold', 0.12], eldritch: ['Eldritch_Horror', 0.15],
    tavern: ['Fantasy_Tavern', 0.14], vampire: ['Gothic_Vampire', 0.13], retro: ['Retro_8Bit', 0.13], scifi: ['SciFi_Mech', 0.13],
    pirate: ['Sea_Pirate', 0.13], steampunk: ['Steampunk', 0.15], druid: ['Forest_Druid', 0.11],
    felt_green: ['Green_Felt', 0.14, 'Green Felt', '#1f4a2c'], felt_magenta: ['Magenta_Felt', 0.14, 'Magenta Felt', '#7a2350'], nineties: ['Nineties', 0.18, 'Nineties', '#2a2f3a'],
  };
  RP.trayPicsRev = 0;   // goes up as pictures load, so a tray painted before its picture arrived is painted again
  function slice(g, img, b, W, H, fx, fy) {
    const S = img.naturalWidth, T = img.naturalHeight, B = Math.round(b * Math.min(S, T)), iw = S - 2 * B, ih = T - 2 * B;
    const w = W - 2 * fx, h = H - 2 * fy;
    let sw = iw, sh = iw * h / w; if (sh > ih) { sh = ih; sw = ih * w / h; }   // the floor: cropped, never squashed
    g.drawImage(img, B + (iw - sw) / 2, B + (ih - sh) / 2, sw, sh, fx, fy, w, h);
    g.drawImage(img, B, 0, iw, B, fx, 0, w, fy); g.drawImage(img, B, T - B, iw, B, fx, H - fy, w, fy);   // top, bottom
    g.drawImage(img, 0, B, B, ih, 0, fy, fx, h); g.drawImage(img, S - B, B, B, ih, W - fx, fy, fx, h);   // left, right
    g.drawImage(img, 0, 0, B, B, 0, 0, fx, fy); g.drawImage(img, S - B, 0, B, B, W - fx, 0, fx, fy);       // corners
    g.drawImage(img, 0, T - B, B, B, 0, H - fy, fx, fy); g.drawImage(img, S - B, T - B, B, B, W - fx, H - fy, fx, fy);
  }
  Object.entries(PICS).forEach(([id, [file, b, name, fill]]) => {
    const img = new Image(), drawn = THEMES[id]?.paint;
    img.onload = () => { RP.trayPicsRev++; RP.emit?.('trays:loaded', id); };
    img.src = `Table/Trays/${file}.jpg`;
    THEMES[id] = { name: name || THEMES[id]?.name || id, frame: b, paint(g, W, H, fx, fy) {
      if (img.complete && img.naturalWidth) return slice(g, img, b, W, H, fx, fy);
      if (drawn) return drawn(g, W, H, fx, fy);
      g.fillStyle = fill || '#333'; g.fillRect(0, 0, W, H);
    } };
  });

  RP.TRAY_THEMES = THEMES;
  /** Paints a theme on a new canvas W x H with the given frame thickness (default: the picture's own, or 11% of the shorter side). */
  RP.paintTrayTheme = (id, W, H, fx, fy) => {
    const t = THEMES[id]; if (!t) return null;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const f = Math.round(Math.min(W, H) * (t.frame || 0.11));
    seed(id.length * 9973 + 17);
    t.paint(c.getContext('2d'), W, H, fx ?? f, fy ?? f);
    return c;
  };
})();
