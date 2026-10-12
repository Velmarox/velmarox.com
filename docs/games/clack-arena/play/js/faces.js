// Clack Arena: how a face looks. One painter draws every face, both on the 3D dice (as a texture laid out with
// Clack Attack's RP.faceLayout) and as the flat chips in the panels, so a face reads the same in both places.
(() => {
  const A = window.ARENA;
  const TEX = 256;

  A.faceName = (f) => f.name || A.FACE_TYPES[f.t].name;
  A.faceLabel = (f) => A.faceName(f) + (A.FACE_TYPES[f.t].valued ? ' ' + f.v : '');
  A.faceText = (f) => A.FACE_TYPES[f.t].text(f.v);

  // Pixel icons (Franuka's Fantasy RPG Icon Pack, cut by tools/build_arena_art.py) for every face kind. They're 16x16
  // and drawn without smoothing so the pixels stay square at any size. A.iconsReady settles once they've loaded
  // (or failed: a missing icon falls back to the drawn one below).
  const PIXEL = {};
  A.iconsReady = Promise.all(['claw', 'arrow', 'shield', 'heart', 'flame', 'thorns', 'skull', 'crown'].map((name) => new Promise((done) => {
    const im = new Image();
    im.onload = () => { PIXEL[name] = im; done(); };
    im.onerror = () => done();
    im.src = 'icons/' + name + '.png';
  })));

  // Drawn icons, used where there's no pixel one (the plain pip) or it didn't load. The rest come from Clack
  // Attack's painter (RP.drawDiceSymbol), which draws in about ±80 at size 100.
  const OWN = {
    shield(g, c) {
      g.beginPath(); g.moveTo(0, -78); g.lineTo(64, -56); g.quadraticCurveTo(66, 30, 0, 80); g.quadraticCurveTo(-66, 30, -64, -56); g.closePath();
      g.fillStyle = c; g.fill();
      g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.moveTo(0, -50); g.lineTo(40, -36); g.quadraticCurveTo(40, 18, 0, 50); g.closePath(); g.fill();
      g.globalCompositeOperation = 'source-over';
    },
    arrow(g, c) {
      g.fillStyle = c; g.beginPath();
      g.moveTo(0, -82); g.lineTo(36, -30); g.lineTo(12, -30); g.lineTo(12, 60); g.lineTo(30, 82); g.lineTo(-30, 82); g.lineTo(-12, 60); g.lineTo(-12, -30); g.lineTo(-36, -30); g.closePath(); g.fill();
    },
    thorns(g, c) {
      g.fillStyle = c; g.beginPath(); g.arc(0, 0, 26, 0, 6.3); g.fill();
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a - 0.3) * 22, Math.sin(a - 0.3) * 22); g.lineTo(Math.cos(a) * 82, Math.sin(a) * 82); g.lineTo(Math.cos(a + 0.3) * 22, Math.sin(a + 0.3) * 22); g.closePath(); g.fill(); }
    },
    dot(g, c) { g.fillStyle = c; g.beginPath(); g.arc(0, 0, 44, 0, 6.3); g.fill(); },
  };

  // Draws an icon centred at x, y, about `size` across. Icons with holes are drawn on their own canvas first.
  function icon(ctx, kind, x, y, size, rot, color) {
    if (!kind) return;
    if (PIXEL[kind]) {
      const k = Math.max(1, Math.round(size / 16)) * 16;   // whole multiples of 16 keep every pixel the same size
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.imageSmoothingEnabled = false;
      ctx.drawImage(PIXEL[kind], -k / 2, -k / 2, k, k); ctx.restore();
    } else if (OWN[kind]) {
      const off = document.createElement('canvas'); off.width = off.height = 200;
      const g = off.getContext('2d'); g.translate(100, 100); OWN[kind](g, color);
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); const k = size / 170; ctx.scale(k, k); ctx.drawImage(off, -100, -100); ctx.restore();
    } else if (window.RP?.drawDiceSymbol) RP.drawDiceSymbol(ctx, kind, x, y, size / 1.7, rot, color);
  }
  A.drawIcon = icon;

  function text(ctx, s, x, y, size, rot, color) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.font = `800 ${size.toFixed(1)}px 'Saira Condensed', 'Arial Narrow', sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(2, size * 0.14); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.strokeText(s, 0, 0);
    ctx.fillStyle = color; ctx.fillText(s, 0, 0); ctx.restore();
  }

  // One face's mark (icon + value) in a box `room` across, centred at x, y.
  function mark(ctx, f, x, y, room, rot, ink) {
    const T = A.FACE_TYPES[f.t], ic = f.icon || T.icon, valued = T.valued;
    if (!ic && !valued) return;
    const c = Math.cos(rot), s = Math.sin(rot);
    const at = (dy) => [x - s * dy, y + c * dy];   // dy along the face's own "down"
    if (valued && !f.bare) {
      const [ix, iy] = at(-room * 0.16), [tx, ty] = at(room * 0.3);
      icon(ctx, ic, ix, iy, room * 0.56, rot, ink);
      text(ctx, String(f.v), tx, ty, room * 0.36, rot, ink);
    } else icon(ctx, ic, x, y, room * 0.72, rot, ink);
  }

  function background(g, look, alpha) {
    g.globalAlpha = alpha; g.fillStyle = look.color; g.fillRect(0, 0, TEX, TEX);
    const grd = g.createRadialGradient(TEX / 2, TEX / 2, TEX * 0.1, TEX / 2, TEX / 2, TEX * 0.72);
    grd.addColorStop(0, 'rgba(255,255,255,0.06)'); grd.addColorStop(1, 'rgba(0,0,0,0.22)');
    g.fillStyle = grd; g.fillRect(0, 0, TEX, TEX); g.globalAlpha = 1;
  }

  // Texture for one triangle/square/pentagon of a die mesh. On a d4 a triangle carries three corner marks (each the
  // face that counts when that corner points up); on every other die it carries its own face.
  A.faceTexture = (shape, fi, die, extra = {}) => {
    const L = RP.faceLayout(shape, fi);
    const look = die.look, fin = A.FINISHES[look.finish] || A.FINISHES.satin;
    const c = document.createElement('canvas'); c.width = c.height = TEX;
    const g = c.getContext('2d');
    background(g, look, fin.bgAlpha ?? 1);
    const px = TEX / (2 * L.R), ink = look.ink || '#ffffff';
    const chalk = extra.chalk || [];
    if (shape.sides === 4) {
      shape.faces[fi].forEach((v, k) => {
        const p = L.p2[k], f = die.faces[v];
        const rot = Math.atan2(p[0], p[1]);
        const x = TEX / 2 + p[0] * px * 0.5, y = TEX / 2 - p[1] * px * 0.5;
        mark(g, f, x, y, L.inR * px * 1.15, rot, ink);
        if (chalk.includes(v)) chalkMark(g, x, y, L.inR * px * 0.5);
      });
    } else {
      const f = die.faces[fi];
      mark(g, f, TEX / 2, TEX / 2, L.inR * px * 1.75, 0, ink);
      if (chalk.includes(fi)) chalkMark(g, TEX / 2, TEX / 2, L.inR * px * 0.95);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    return tex;
  };

  function chalkMark(g, x, y, r) {
    g.save(); g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = Math.max(2, r * 0.12); g.setLineDash([r * 0.25, r * 0.15]);
    g.beginPath(); g.arc(x, y, r, 0, 6.3); g.stroke(); g.restore();
  }

  // A flat chip for the panels: the face on the die's own colour, with a strip in the face type's colour.
  const chipCache = new Map();
  A.faceChip = (f, look, size = 64) => {
    const key = JSON.stringify([f, look.color, look.ink, size]);
    if (chipCache.has(key)) return chipCache.get(key);
    const c = document.createElement('canvas'); c.width = c.height = size * 2;
    const g = c.getContext('2d'), S = size * 2;
    g.fillStyle = look.color; g.fillRect(0, 0, S, S);
    const grd = g.createLinearGradient(0, 0, 0, S); grd.addColorStop(0, 'rgba(255,255,255,0.12)'); grd.addColorStop(1, 'rgba(0,0,0,0.25)');
    g.fillStyle = grd; g.fillRect(0, 0, S, S);
    mark(g, f, S / 2, S / 2, S * 0.92, 0, look.ink || '#fff');
    g.fillStyle = A.FACE_TYPES[f.t].color; g.fillRect(0, S - S * 0.08, S, S * 0.08);
    const url = c.toDataURL();
    chipCache.set(key, url);
    return url;
  };
})();
