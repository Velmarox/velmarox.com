// ---------------------------------------------------------------------------
// Screen feel: hit sparks, dust, screen shake, hitstop, damage flashes.
// These are what make a punch land, so they get their own module.
// ---------------------------------------------------------------------------

const Fx = {
  parts: [],
  shakeT: 0, shakeMag: 0,
  hitstop: 0,          // global freeze in ticks; FX still animate
  flash: 0,

  reset() { this.parts.length = 0; this.shakeT = 0; this.shakeMag = 0; this.hitstop = 0; this.flash = 0; },

  shake(mag, ticks) {
    // don't let a small hit shorten a big one
    if (mag >= this.shakeMag || this.shakeT <= 0) { this.shakeMag = mag; this.shakeT = ticks; }
  },

  stop(ticks) { if (ticks > this.hitstop) this.hitstop = ticks; },

  // white star burst at an impact point
  spark(x, y, heavy) {
    const n = heavy ? 10 : 6;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (heavy ? 2.4 : 1.5) * (0.4 + Math.random());
      this.parts.push({
        k: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.5,
        life: heavy ? 16 : 11, t: 0,
        col: heavy ? '#fff2a0' : '#ffffff',
      });
    }
    this.parts.push({ k: 'ring', x, y, life: heavy ? 10 : 7, t: 0, r: heavy ? 13 : 8 });
  },

  // Guard impact. Deliberately unlike spark(): a tight cyan ring and a few
  // shards thrown back the way the blow came, so an absorbed hit never reads
  // as a landed one.
  guard(x, y) {
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.0;
      const s = 1.1 * (0.5 + Math.random());
      this.parts.push({
        k: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.3,
        life: 10, t: 0, col: '#9fd8ff',
      });
    }
    this.parts.push({ k: 'ring', x, y, life: 9, t: 0, r: 11, rgb: '159,216,255' });
  },

  dust(x, y, dir) {
    for (let i = 0; i < 3; i++) {
      this.parts.push({
        k: 'dust', x: x - dir * 3, y,
        vx: -dir * (0.3 + Math.random() * 0.5), vy: -Math.random() * 0.35,
        life: 14 + Math.random() * 8, t: 0,
      });
    }
  },

  popup(x, y, text, col) {
    this.parts.push({ k: 'text', x, y, vy: -0.55, life: 34, t: 0, text, col: col || '#fff' });
  },

  update() {
    if (this.shakeT > 0) { this.shakeT--; if (this.shakeT <= 0) this.shakeMag = 0; }
    if (this.flash > 0) this.flash--;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.t++;
      if (p.k === 'spark') { p.x += p.vx; p.y += p.vy; p.vy += 0.14; }
      else if (p.k === 'debris') {
        p.x += p.vx; p.y += p.vy; p.vy += 0.22;
        if (p.y >= p.gy) {          // bounce off the pavement, then settle
          p.y = p.gy;
          p.vy = -p.vy * 0.32;
          p.vx *= 0.6;
          if (Math.abs(p.vy) < 0.4) { p.vy = 0; p.vx = 0; }
        }
      }
      else if (p.k === 'dust') { p.x += p.vx; p.y += p.vy; p.vx *= 0.93; }
      else if (p.k === 'text') { p.y += p.vy; p.vy *= 0.94; }
      if (p.t >= p.life) this.parts.splice(i, 1);
    }
  },

  shakeOffset() {
    if (this.shakeT <= 0) return { x: 0, y: 0 };
    const m = this.shakeMag * (this.shakeT / 12);
    return { x: (Math.random() * 2 - 1) * m, y: (Math.random() * 2 - 1) * m };
  },

  draw(ctx, camX) {
    for (const p of this.parts) {
      const sx = Math.round(p.x - camX), sy = Math.round(p.y);
      const k = 1 - p.t / p.life;
      if (p.k === 'spark') {
        ctx.fillStyle = p.col;
        const s = k > 0.5 ? 2 : 1;
        ctx.fillRect(sx, sy, s, s);
      } else if (p.k === 'ring') {
        const r = p.r * (p.t / p.life);
        ctx.strokeStyle = `rgba(${p.rgb || '255,255,255'},${k * 0.85})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(sx + 0.5, sy + 0.5, r, 0, Math.PI * 2); ctx.stroke();
      } else if (p.k === 'debris') {
        ctx.fillStyle = p.col;
        ctx.globalAlpha = k > 0.25 ? 1 : k * 4;
        ctx.fillRect(sx, sy, 2, 2);
        ctx.globalAlpha = 1;
      } else if (p.k === 'dust') {
        ctx.fillStyle = `rgba(206,206,190,${k * 0.5})`;
        ctx.fillRect(sx, sy, 2, 1);
      } else if (p.k === 'text') {
        ctx.font = '12px ThaleahFat, "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillText(p.text, sx + 1, sy + 1);
        ctx.fillStyle = p.col;
        ctx.globalAlpha = Math.min(1, k * 2);
        ctx.fillText(p.text, sx, sy);
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
      }
    }
  },
};
