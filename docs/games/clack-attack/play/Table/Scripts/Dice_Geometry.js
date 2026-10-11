// Die shapes for the 3D dice tray. Each die is described once (vertices +
// faces) and that description feeds both the Three.js mesh and the
// cannon-es collision shape, so what you see is exactly what collides.
// Faces get number textures drawn on a canvas, in the owner's colour.
(() => {
  const PHI = (1 + Math.sqrt(5)) / 2;
  const IPHI = 1 / PHI;

  // ---------- small vector helpers (plain arrays) ----------
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = a => Math.hypot(a[0], a[1], a[2]);
  const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const centroid = pts => scale(pts.reduce((c, p) => [c[0] + p[0], c[1] + p[1], c[2] + p[2]], [0, 0, 0]), 1 / pts.length);

  const cubeCorners = () => { const o = []; for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) o.push([x, y, z]); return o; };
  const axes = () => [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const icosaVerts = () => {
    const o = [];
    for (const a of [-1, 1]) for (const b of [-PHI, PHI]) o.push([0, a, b], [a, b, 0], [b, 0, a]);
    return o;
  };
  const dodecaVerts = () => {
    const o = cubeCorners();
    for (const a of [-IPHI, IPHI]) for (const b of [-PHI, PHI]) o.push([0, a, b], [a, b, 0], [b, 0, a]);
    return o;
  };

  // Faces of a convex solid: every plane through three vertices that has
  // all other vertices on one side is a face; its members are the vertices
  // lying on that plane. Works for every die shape, no lookup tables.
  function hullFaces(verts) {
    const eps = 1e-6 * Math.max(...verts.map(len));
    const seen = new Map();
    for (let i = 0; i < verts.length; i++) for (let j = i + 1; j < verts.length; j++) for (let k = j + 1; k < verts.length; k++) {
      let n = cross(sub(verts[j], verts[i]), sub(verts[k], verts[i]));
      if (len(n) < 1e-9) continue;
      n = norm(n);
      let d = dot(n, verts[i]);
      const side = verts.map(v => dot(n, v) - d);
      if (side.every(x => x <= 1e-5)) { /* outward already */ }
      else if (side.every(x => x >= -1e-5)) { n = scale(n, -1); d = -d; }
      else continue;
      const key = n.map(x => Math.round(x * 1e4)).join(',');
      if (seen.has(key)) continue;
      seen.set(key, verts.map((v, idx) => (Math.abs(dot(n, v) - d) < 1e-4 + eps ? idx : -1)).filter(idx => idx >= 0));
    }
    return [...seen.values()];
  }

  // Order each face's vertices counter-clockwise seen from outside
  // (what cannon-es expects, and what gives outward mesh normals).
  function orderFaces(verts, faces) {
    return faces.map(f => {
      const pts = f.map(i => verts[i]);
      const c = centroid(pts);
      const n = norm(c);
      const a = norm(sub(pts[0], c));
      const b = cross(n, a);
      return f.map(i => {
        const d = sub(verts[i], c);
        return { i, ang: Math.atan2(dot(d, b), dot(d, a)) };
      }).sort((p, q) => p.ang - q.ang).map(p => p.i);
    });
  }

  // Pentagonal trapezohedron (d10): 10 kite faces around a vertical axis.
  function d10Shape() {
    const e = 0.1056, H = 1;           // e chosen so every kite is flat
    const up = [], lo = [];
    for (let k = 0; k < 5; k++) {
      const a1 = (k * 72) * Math.PI / 180, a2 = (k * 72 + 36) * Math.PI / 180;
      up.push([Math.cos(a1), e, Math.sin(a1)]);
      lo.push([Math.cos(a2), -e, Math.sin(a2)]);
    }
    const verts = [...up, ...lo, [0, H, 0], [0, -H, 0]];
    const T = 10, B = 11, U = k => k % 5, L = k => 5 + (k % 5);
    const faces = [];
    for (let k = 0; k < 5; k++) faces.push([T, U(k), L(k), U(k + 1)]);
    for (let k = 0; k < 5; k++) faces.push([B, L(k), U(k + 1), L(k + 1)]);
    return { verts, faces };
  }

  // d100 ("the Sphere"): 100 evenly spread directions (a Fibonacci spiral),
  // with a flat face cut square to each one. The corners are where three
  // neighbouring faces meet, found from the triangles joining neighbouring
  // directions. Result: 100 flat faces (mostly 5 and 6 sided) that it can
  // land on like any other die.
  function d100Shape() {
    const dirs = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < 100; i++) {
      const y = 1 - (i + 0.5) / 50, r = Math.sqrt(1 - y * y), a = i * golden;
      dirs.push([Math.cos(a) * r, y, Math.sin(a) * r]);
    }
    const tris = hullFaces(dirs);                     // triangles between neighbouring directions
    // Corner for each triangle: the point p with p.n = 1 for all three normals.
    const solve = (a, b, c) => {
      const bc = cross(b, c), ca = cross(c, a), ab = cross(a, b);
      const det = dot(a, bc);
      return scale([bc[0] + ca[0] + ab[0], bc[1] + ca[1] + ab[1], bc[2] + ca[2] + ab[2]], 1 / det);
    };
    const verts = tris.map(t => solve(dirs[t[0]], dirs[t[1]], dirs[t[2]]));
    const faces = dirs.map((_, i) => tris.map((t, ti) => (t.includes(i) ? ti : -1)).filter(ti => ti >= 0));
    return { verts, faces, normals: dirs };
  }

  // Visual size of each die (circumradius in world units).
  const SIZE = { 4: 1.35, 6: 1.05, 8: 1.12, 10: 1.16, 12: 1.2, 20: 1.28, 100: 2.3 };

  function makeShape(sides) {
    let verts, faces;
    if (sides === 4) verts = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
    else if (sides === 6) verts = cubeCorners();
    else if (sides === 8) verts = axes();
    else if (sides === 12) verts = dodecaVerts();
    else if (sides === 20) verts = icosaVerts();
    else if (sides === 10) ({ verts, faces } = d10Shape());
    else if (sides === 100) ({ verts, faces } = d100Shape());
    else return null;
    faces ||= hullFaces(verts);
    if (faces.length !== sides) console.warn('d' + sides + ' has', faces.length, 'faces');

    const r = Math.max(...verts.map(len));
    verts = verts.map(v => scale(v, SIZE[sides] / r));
    faces = orderFaces(verts, faces);
    const normals = faces.map(f => norm(centroid(f.map(i => verts[i]))));
    if (sides === 10) {
      // Kite centroids aren't on the face normal; use the true plane normal.
      faces.forEach((f, i) => {
        const [a, b, c] = f.map(j => verts[j]);
        normals[i] = norm(cross(sub(b, a), sub(c, a)));
      });
    }
    return { sides, verts, faces, normals };
  }

  const shapes = {};
  RP.dieShape = sides => (shapes[sides] ||= makeShape(sides));
  RP.canRender3D = sides => [4, 6, 8, 10, 12, 20, 100].includes(sides);
  // The d100 takes a moment to work out, so build it while the app is idle.
  setTimeout(() => (window.requestIdleCallback || setTimeout)(() => RP.dieShape(100)), 2500);

  // ---------- face textures ----------
  const TEX = 256;
  const texCache = new Map();

  function readableOn(hex) {
    const n = parseInt((hex || '#6157e8').slice(1), 16);
    const lum = 0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
    return lum > 150 ? '#1a1620' : '#ffffff';
  }

  // Lay each face flat in 2D: returns per-vertex 2D points (face units),
  // a radius R that contains the face, and how much room the centre has.
  function faceLayout(shape, fi) {
    const f = shape.faces[fi];
    const pts = f.map(i => shape.verts[i]);
    const n = shape.normals[fi];
    const c = centroid(pts);
    // "Up" for the numbers points at the vertex farthest from the centre
    // (the pole on d10 kites; any vertex on regular faces).
    let far = 0;
    pts.forEach((p, i) => { if (len(sub(p, c)) > len(sub(pts[far], c)) + 1e-6) far = i; });
    const upv = norm(sub(pts[far], c));
    const right = cross(upv, n);
    const p2 = pts.map(p => { const d = sub(p, c); return [dot(d, right), dot(d, upv)]; });
    const R = Math.max(...p2.map(p => Math.hypot(p[0], p[1])));
    // Distance from centre to the nearest edge = room for the number.
    let inR = Infinity;
    for (let i = 0; i < p2.length; i++) {
      const a = p2[i], b = p2[(i + 1) % p2.length];
      const ex = b[0] - a[0], ey = b[1] - a[1];
      inR = Math.min(inR, Math.abs(ex * a[1] - ey * a[0]) / Math.hypot(ex, ey));
    }
    return { c, right, upv, p2, R, inR };
  }

  // Number fonts that ship with Windows, so they work offline.
  RP.DICE_FONTS = {
    sans: { label: 'Clean (Segoe UI)', css: "700 {s}px 'Segoe UI', system-ui, sans-serif" },
    serif: { label: 'Book (Georgia)', css: "700 {s}px Georgia, serif" },
    classic: { label: 'Classic (Palatino)', css: "700 {s}px 'Palatino Linotype', 'Book Antiqua', serif" },
    mono: { label: 'Typewriter (Consolas)', css: "700 {s}px Consolas, monospace" },
    heavy: { label: 'Heavy (Impact)', css: "400 {s}px Impact, 'Arial Black', sans-serif" },
    script: { label: 'Fancy (Gabriola)', css: "700 {s}px Gabriola, 'Segoe Script', cursive" },
  };

  // outline: colour for a thin edge around the number (for busy skins), or null.
  function drawLabel(ctx, text, x, y, size, rot, font, outline, engraved) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.font = (RP.DICE_FONTS[font] || RP.DICE_FONTS.sans).css.replace('{s}', size.toFixed(1));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width;
    const bar = (text === '6' || text === '9') ? [-w / 2, size * 0.42, w, Math.max(2, size * 0.07)] : null;   // tell 6 from 9
    if (engraved) {   // v6.14.0: cut into the die and inked: a shadow on the upper edge, light on the lower, then the ink
      const ink = ctx.fillStyle, o = Math.max(1, size * 0.04);
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(text, -o * 0.6, size * 0.04 - o); if (bar) ctx.fillRect(bar[0] - o * 0.6, bar[1] - o, bar[2], bar[3]);
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillText(text, o * 0.6, size * 0.04 + o); if (bar) ctx.fillRect(bar[0] + o * 0.6, bar[1] + o, bar[2], bar[3]);
      ctx.fillStyle = ink; outline = null;
    }
    if (outline) {
      ctx.strokeStyle = outline;
      ctx.lineWidth = Math.max(2, size * 0.1);
      ctx.lineJoin = 'round';
      ctx.strokeText(text, 0, size * 0.04);
      if (bar) ctx.strokeRect(...bar);
    }
    ctx.fillText(text, 0, size * 0.04);
    if (bar) ctx.fillRect(...bar);
    ctx.restore();
  }

  const lumOf = hex => {
    const n = parseInt((hex || '#000000').slice(1), 16);
    return 0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
  };

  // Face background: plain colour, or a skin image (a different patch of it
  // per face so faces don't look identical), tinted towards the dice colour,
  // plus glitter specks for the Glitter finish. Returns the canvas and its
  // average brightness (used to pick a readable number colour).
  function faceBackground(fi, look) {
    const c = document.createElement('canvas');
    c.width = c.height = TEX;
    const g = c.getContext('2d');
    if (look.skinCanvas) {
      const S = look.skinCanvas.width, part = S / 2;
      const ox = ((fi * 97) % 100) / 100 * (S - part), oy = ((fi * 53) % 100) / 100 * (S - part);
      g.drawImage(look.skinCanvas, ox, oy, part, part, 0, 0, TEX, TEX);
      if (look.tint > 0) {
        g.globalCompositeOperation = 'multiply';       // stain the skin with the dice colour, keeping its pattern
        g.globalAlpha = look.tint;
        g.fillStyle = look.color;
        g.fillRect(0, 0, TEX, TEX);
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 1;
      }
    } else {
      g.fillStyle = look.color;
      g.fillRect(0, 0, TEX, TEX);
    }
    /* v6.14.0: smoke hanging in glass, a gemstone's facets, and wear */
    if (look.smoke && RP.skins?.smoke) {
      const S2 = RP.skins.smoke(look.color2 || '#d8d8d8'), part = S2.width / 2, ox = ((fi * 61) % 100) / 100 * part, oy = ((fi * 37) % 100) / 100 * part;
      g.drawImage(S2, ox, oy, part, part, 0, 0, TEX, TEX);
    }
    if (look.gem) {   // facets: wedges of light and shade from the middle, and one bright edge
      const n = 7, cx = TEX / 2, cy = TEX / 2, R = TEX * 0.75;
      for (let k = 0; k < n; k++) {
        const a0 = (k / n) * Math.PI * 2 + fi, a1 = ((k + 1) / n) * Math.PI * 2 + fi;
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + R * Math.cos(a0), cy + R * Math.sin(a0)); g.lineTo(cx + R * Math.cos(a1), cy + R * Math.sin(a1)); g.closePath();
        g.fillStyle = k % 2 ? `rgba(255,255,255,${0.1 + (k % 3) * 0.05})` : `rgba(0,0,0,${0.12 + (k % 3) * 0.05})`; g.fill();
      }
      const grd = g.createLinearGradient(0, 0, TEX, TEX); grd.addColorStop(0.42, 'rgba(255,255,255,0)'); grd.addColorStop(0.5, 'rgba(255,255,255,0.28)'); grd.addColorStop(0.58, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.fillRect(0, 0, TEX, TEX);
    }
    if (look.wear > 0) {   // weathered: grime toward the edges, pale chips at the rim, scuffs (seeded, so it's the same every throw)
      const w = Math.min(1, look.wear), grd = g.createRadialGradient(TEX / 2, TEX / 2, TEX * 0.18, TEX / 2, TEX / 2, TEX * 0.62);
      grd.addColorStop(0, 'rgba(40,30,20,0)'); grd.addColorStop(1, `rgba(40,30,20,${0.55 * w})`);
      g.fillStyle = grd; g.fillRect(0, 0, TEX, TEX);
      let seed = fi * 7919 + 17; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 260 * w; i++) {
        const x = rnd() * TEX, y = rnd() * TEX, d = Math.hypot(x - TEX / 2, y - TEX / 2) / (TEX / 2), r = 0.6 + rnd() * 2.2;
        g.fillStyle = d > 0.55 && rnd() < 0.5 ? `rgba(235,225,205,${0.25 * w + rnd() * 0.25})` : `rgba(30,22,15,${0.12 * w + rnd() * 0.15})`;
        g.fillRect(x, y, r, r);
      }
      for (let i = 0; i < 9 * w; i++) {
        const a = rnd() * Math.PI * 2, x = TEX / 2 + Math.cos(a) * TEX * 0.44, y = TEX / 2 + Math.sin(a) * TEX * 0.44, r = 4 + rnd() * 9;
        g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { const b = rnd() * Math.PI * 2; g.lineTo(x + Math.cos(b) * r, y + Math.sin(b) * r); }
        g.closePath(); g.fillStyle = `rgba(225,215,195,${0.35 + 0.3 * w})`; g.fill();
      }
    }
    if (look.speckle) {
      const amt = typeof look.speckle === 'number' ? look.speckle : 1;
      for (let i = 0; i < 2600 * amt; i++) {
        const r = Math.random();
        g.fillStyle = r < 0.5 ? `rgba(255,255,255,${0.5 + Math.random() * 0.5})`
          : r < 0.8 ? `rgba(255,236,190,${0.45 + Math.random() * 0.5})` : r < 0.92 ? `rgba(200,230,255,${0.4 + Math.random() * 0.5})` : `rgba(0,0,0,${0.15 + Math.random() * 0.25})`;
        const w = 0.8 + Math.random() * 2.4;
        g.fillRect(Math.random() * TEX, Math.random() * TEX, w, w);
      }
      // a few bigger four-point star glints
      g.strokeStyle = 'rgba(255,255,255,0.85)';
      g.lineWidth = 1;
      for (let i = 0; i < 10 * amt; i++) {
        const x = Math.random() * TEX, y = Math.random() * TEX, r = 2 + Math.random() * 4;
        g.beginPath(); g.moveTo(x - r, y); g.lineTo(x + r, y); g.moveTo(x, y - r); g.lineTo(x, y + r); g.stroke();
      }
    }
    const px = document.createElement('canvas'); px.width = px.height = 1;
    const pg = px.getContext('2d'); pg.drawImage(c, 0, 0, 1, 1);
    const [r, gr, b] = pg.getImageData(0, 0, 1, 1).data;
    return { canvas: c, lum: 0.2126 * r + 0.7152 * gr + 0.0722 * b };
  }

  /* v6.14.0: small painted things for the dice update. color null: an inclusion's own natural colours (leaf, feather,
     moss, bone, paw); a colour: the top face's symbol, in the number's colour (paw, claw, moon, star, clan). */
  function drawSymbol(ctx, kind, x, y, size, rot, color, look, iconSrc) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(size / 100, size / 100);
    const fill = (c) => { ctx.fillStyle = color || c; ctx.fill(); }, stroke = (c, w) => { ctx.strokeStyle = color || c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.stroke(); };
    if (kind === 'leaf') {
      ctx.beginPath(); ctx.moveTo(0, -78); ctx.bezierCurveTo(52, -50, 48, 40, 0, 78); ctx.bezierCurveTo(-48, 40, -52, -50, 0, -78); fill('#6f7f37');
      ctx.beginPath(); ctx.moveTo(0, -70); ctx.lineTo(0, 82); stroke('#47521f', 4);
      for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(0, k * 18); ctx.lineTo(28, k * 18 - 16); ctx.moveTo(0, k * 18); ctx.lineTo(-28, k * 18 - 16); stroke('#4f5c23', 2); }
    } else if (kind === 'feather') {
      ctx.beginPath(); ctx.moveTo(-6, 84); ctx.quadraticCurveTo(4, 0, 2, -84); stroke('#8b857a', 4);
      for (let k = -70; k < 70; k += 7) { const w = 34 * Math.cos((k / 80) * 1.4); ctx.beginPath(); ctx.moveTo(2, k); ctx.lineTo(2 + w, k - 14); ctx.moveTo(2, k); ctx.lineTo(2 - w * 0.8, k - 12); stroke('#ddd6c8', 2.2); }
    } else if (kind === 'moss') {
      let seed = 77; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 46; i++) { const a = rnd() * 6.3, d = rnd() * 56; ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d * 0.7, 6 + rnd() * 10, 0, 6.3); fill(i % 3 ? '#5f7d39' : '#86a04f'); }
    } else if (kind === 'bone') {
      ctx.beginPath(); ctx.roundRect(-58, -11, 116, 22, 10); fill('#e8dfcb');
      [[-60, -14], [-60, 14], [60, -14], [60, 14]].forEach(([bx, by]) => { ctx.beginPath(); ctx.arc(bx, by, 16, 0, 6.3); fill('#e8dfcb'); });
    } else if (kind === 'paw') {
      ctx.beginPath(); ctx.ellipse(0, 26, 34, 28, 0, 0, 6.3); fill('#3a2c22');
      [[-40, -18, 13, 17], [-14, -46, 13, 17], [14, -46, 13, 17], [40, -18, 13, 17]].forEach(([bx, by, rx, ry]) => { ctx.beginPath(); ctx.ellipse(bx, by, rx, ry, bx * 0.008, 0, 6.3); fill('#3a2c22'); });
    } else if (kind === 'claw') {
      [-34, 0, 34].forEach((dx) => { ctx.beginPath(); ctx.moveTo(dx - 22, -70); ctx.quadraticCurveTo(dx + 18, -10, dx - 8, 72); stroke('#3a2c22', 15); });
    } else if (kind === 'moon') {
      const off = document.createElement('canvas'); off.width = off.height = 220; const og = off.getContext('2d');
      og.fillStyle = color || '#f2ead2'; og.beginPath(); og.arc(110, 110, 82, 0, 6.3); og.fill();
      og.globalCompositeOperation = 'destination-out'; og.beginPath(); og.arc(150, 88, 70, 0, 6.3); og.fill();
      ctx.drawImage(off, -110, -110);
    } else if (kind === 'star') {
      ctx.beginPath();
      for (let k = 0; k < 10; k++) { const r = k % 2 ? 34 : 82, a = -Math.PI / 2 + (k * Math.PI) / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath(); fill('#f2ead2');
    } else if (SHAPES[kind]) {   // v6.20.0: heart, skull, cat's eye, flame, sun, crown, fish, drop
      SHAPES[kind](ctx, color || SHAPE_COLOR[kind] || '#f2ead2');
    } else if (kind === 'custom') {   // v6.20.0: your own picture, in its own colours, fitted to the face
      const im = RP.diceIcon?.(iconSrc || (look && look.topIcon));
      if (im) { const k = Math.min(128 / im.width, 128 / im.height), w = im.width * k, h = im.height * k; ctx.drawImage(im, -w / 2, -h / 2, w, h); }   // 128: a square picture stays inside a triangle face
    } else if (kind === 'clan') {
      const em = RP.diceEmblem?.(look && look.clan);
      if (em) {   // the emblem as a silhouette in the number's colour
        const off = document.createElement('canvas'); off.width = off.height = 200; const og = off.getContext('2d');
        const k = Math.min(170 / em.width, 170 / em.height), w = em.width * k, h = em.height * k;
        og.drawImage(em, (200 - w) / 2, (200 - h) / 2, w, h); og.globalCompositeOperation = 'source-in'; og.fillStyle = color || '#ffffff'; og.fillRect(0, 0, 200, 200);
        ctx.drawImage(off, -100, -100);
      }
    }
    ctx.restore();
  }
  RP.drawDiceSymbol = drawSymbol;
  /* v6.20.0: more symbols for the faces. Each draws in about ±80 around the centre; holes (a skull's eyes, a fish's eye,
     a cat's-eye slit) are cut on a canvas of their own so the face shows through. */
  const cut = (ctx, color, solid, holes) => {
    const off = document.createElement('canvas'); off.width = off.height = 220; const g = off.getContext('2d');
    g.translate(110, 110); g.fillStyle = color; solid(g); g.fill();
    if (holes) { g.globalCompositeOperation = 'destination-out'; holes(g); g.fill(); }
    ctx.drawImage(off, -110, -110);
  };
  const SHAPE_COLOR = { heart: '#d8433a', flame: '#f08a24', drop: '#5aa7e0', sun: '#f2c14e', crown: '#e2b84f', fish: '#9fb6c8' };
  const SHAPES = {
    heart: (ctx, c) => cut(ctx, c, (g) => { g.beginPath(); g.moveTo(0, 70); g.bezierCurveTo(-96, 6, -62, -78, 0, -30); g.bezierCurveTo(62, -78, 96, 6, 0, 70); }),
    skull: (ctx, c) => cut(ctx, c, (g) => { g.beginPath(); g.ellipse(0, -14, 62, 56, 0, 0, 6.3); g.roundRect(-34, 22, 68, 42, 10); },
      (g) => { g.beginPath(); g.ellipse(-24, -12, 15, 17, 0, 0, 6.3); g.ellipse(24, -12, 15, 17, 0, 0, 6.3); g.moveTo(0, 12); g.lineTo(-8, 26); g.lineTo(8, 26); g.closePath(); [-16, 0, 16].forEach((x) => g.rect(x - 3, 42, 6, 22)); }),
    eye: (ctx, c) => cut(ctx, c, (g) => { g.beginPath(); g.moveTo(-84, 0); g.quadraticCurveTo(0, -70, 84, 0); g.quadraticCurveTo(0, 70, -84, 0); },
      (g) => { g.beginPath(); g.ellipse(0, 0, 11, 44, 0, 0, 6.3); }),
    flame: (ctx, c) => cut(ctx, c, (g) => { g.beginPath(); g.moveTo(4, -84); g.bezierCurveTo(70, -20, 64, 48, 0, 78); g.bezierCurveTo(-64, 48, -66, -6, -22, -36); g.bezierCurveTo(-18, -8, -4, 2, 6, -10); g.bezierCurveTo(16, -36, 2, -60, 4, -84); },
      (g) => { g.beginPath(); g.moveTo(0, 6); g.bezierCurveTo(30, 30, 24, 60, 0, 66); g.bezierCurveTo(-24, 60, -26, 34, 0, 6); }),
    sun: (ctx, c) => cut(ctx, c, (g) => { g.beginPath(); g.arc(0, 0, 36, 0, 6.3); for (let k = 0; k < 10; k++) { const a = (k * Math.PI) / 5; g.moveTo(Math.cos(a - 0.16) * 46, Math.sin(a - 0.16) * 46); g.lineTo(Math.cos(a) * 82, Math.sin(a) * 82); g.lineTo(Math.cos(a + 0.16) * 46, Math.sin(a + 0.16) * 46); g.closePath(); } }),
    crown: (ctx, c) => cut(ctx, c, (g) => { g.beginPath(); g.moveTo(-74, 46); g.lineTo(-74, -34); g.lineTo(-36, 4); g.lineTo(0, -56); g.lineTo(36, 4); g.lineTo(74, -34); g.lineTo(74, 46); g.closePath(); g.rect(-74, 52, 148, 18); },
      (g) => { g.beginPath(); [-40, 0, 40].forEach((x) => { g.moveTo(x + 9, 26); g.arc(x, 26, 9, 0, 6.3); }); }),
    fish: (ctx, c) => cut(ctx, c, (g) => { g.beginPath(); g.ellipse(-14, 0, 58, 32, 0, 0, 6.3); g.moveTo(34, 0); g.lineTo(82, -36); g.lineTo(82, 36); g.closePath(); },
      (g) => { g.beginPath(); g.arc(-46, -6, 7, 0, 6.3); }),
    drop: (ctx, c) => cut(ctx, c, (g) => { g.beginPath(); g.moveTo(0, -84); g.bezierCurveTo(30, -34, 62, 0, 58, 30); g.bezierCurveTo(54, 74, -54, 74, -58, 30); g.bezierCurveTo(-62, 0, -30, -34, 0, -84); },
      (g) => { g.beginPath(); g.ellipse(-24, 26, 8, 16, -0.4, 0, 6.3); }),
  };
  RP.DICE_SYMBOLS = [['paw', 'A pawprint'], ['claw', 'Claw marks'], ['moon', 'A moon'], ['star', 'A star'], ['sun', 'A sun'], ['heart', 'A heart'], ['skull', 'A skull'], ['eye', "A cat's eye"],
    ['flame', 'A flame'], ['drop', 'A drop of water'], ['crown', 'A crown'], ['fish', 'A fish'], ['leaf', 'A leaf'], ['feather', 'A feather'], ['moss', 'Moss'], ['bone', 'A tiny bone'], ['clan', "My cat's clan emblem"]];
  /* v6.20.0: on the highest face these keep their own colours; the rest take the number's colour */
  const NATURAL_TOP = new Set(['leaf', 'feather', 'moss', 'bone', 'custom']);

  // One texture per (die, face, labels, look); reused across throws.
  // look: { color, number (text colour, '' = automatic), font, bgAlpha }
  // rot: turns the number on its face (radians, clockwise), used to stand the
  // result upright on screen. Ignored on the d4, whose numbers sit in corners.
  RP.faceTexture = (shape, fi, labels, look, rot = 0) => {
    const { color, font = 'sans', bgAlpha = 1 } = look;
    const isD4 = shape.sides === 4;
    const faceLabels = isD4 ? shape.faces[fi].map(v => labels[v]) : [labels[fi]];
    rot = isD4 ? 0 : Math.round(rot * 50) / 50;
    // Turned numbers are one-offs for a single throw: not cached, freed with the throw.
    const key = `${shape.sides}|${fi}|${faceLabels.join(',')}|${color}|${look.number}|${font}|${bgAlpha}|${look.skinKey || ''}|${look.tint}|${look.speckle || 0}|${rot}|${look.sig || ''}`;
    if (!rot && texCache.has(key)) return texCache.get(key);
    let oneOff = !!rot;

    const L = faceLayout(shape, fi);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = TEX;
    const ctx = canvas.getContext('2d');
    const bg = faceBackground(fi, look);
    ctx.globalAlpha = bgAlpha;             // glass dice: see-through body, solid numbers
    ctx.drawImage(bg.canvas, 0, 0);
    ctx.globalAlpha = 1;
    if (look.inclusion && look.inclusion !== 'none') {   // v6.14.0: something hanging inside the die, behind the number
      ctx.save(); ctx.globalAlpha = look.bgAlpha < 1 ? 0.75 : 0.42;
      drawSymbol(ctx, look.inclusion, TEX / 2 + Math.cos(fi * 2.3) * TEX * 0.06, TEX / 2 + Math.sin(fi * 1.7) * TEX * 0.06, TEX * 0.34, fi * 0.9, null, look);
      ctx.restore();
    }
    const numberColor = look.number || (bg.lum > 150 ? '#1a1620' : '#ffffff');
    // Busy backgrounds get an outline round the numbers so they stay readable.
    const outline = (look.skinCanvas || look.speckle) ? (lumOf(numberColor) > 128 ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)') : null;
    ctx.fillStyle = numberColor;
    const px = TEX / (2 * L.R);                       // face units -> pixels
    const toCanvas = p => [TEX / 2 + p[0] * px, TEX / 2 - p[1] * px];

    if (isD4) {
      // d4: each corner carries the number that reads as the result
      // when that corner points up.
      L.p2.forEach((p, i) => {
        const [x, y] = toCanvas(scale([p[0], p[1], 0], 0.58));
        const rot = Math.atan2(p[0], p[1]);
        drawLabel(ctx, faceLabels[i], x, y, L.inR * px * 0.62, rot, font, outline, look.numStyle === 'engraved');
      });
    } else {
      const text = faceLabels[0];
      const room = L.inR * px * 2;
      // Bigger numbers on dice whose faces are small (d10, d12, d20, d100).
      const FILL = { 10: [0.8, 0.68, 0.5], 12: [0.8, 0.7, 0.5], 20: [0.8, 0.7, 0.5], 100: [0.86, 0.76, 0.56] };
      const fill = FILL[shape.sides] || [0.62, 0.5, 0.5];
      const size = room * fill[Math.min(text.length, 3) - 1];
      /* v6.14.0: a symbol in place of the highest number (a pawprint, claw marks, a moon, a star, or the cat's clan emblem) */
      /* v6.20.0: the highest face's icon, or the lowest's (the 1) */
      const pick = look.top && look.top !== 'none' && text === look.topLabel ? [look.top, look.topIcon] : look.low && look.low !== 'none' && text === look.lowLabel ? [look.low, look.lowIcon] : null;
      const sym = !!pick, kind = pick ? (String(pick[0]).startsWith('custom') ? 'custom' : pick[0]) : '', icon = pick ? pick[1] : '';   // custom:<id>
      if (sym && ((kind === 'clan' && !RP.diceEmblem?.(look.clan)) || (kind === 'custom' && !RP.diceIcon?.(icon)))) { oneOff = true; drawLabel(ctx, text, TEX / 2, TEX / 2, size, rot, font, outline, look.numStyle === 'engraved'); }   // the emblem is still loading
      else if (sym) drawSymbol(ctx, kind, TEX / 2, TEX / 2, room * 0.72, rot, NATURAL_TOP.has(kind) ? null : numberColor, look, icon);   // v6.20.0: a leaf or a feather in its own colours
      else drawLabel(ctx, text, TEX / 2, TEX / 2, size, rot, font, outline, look.numStyle === 'engraved');
    }
    if (look.wear > 0) {   // worn paint on the numbers: flecks of the body colour over them
      let seed = fi * 104729 + 3; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      ctx.fillStyle = color;
      for (let i = 0; i < 140 * Math.min(1, look.wear); i++) { const a = rnd() * Math.PI * 2, d = rnd() * TEX * 0.24, r = 0.8 + rnd() * 2.4; ctx.globalAlpha = 0.35 + rnd() * 0.4; ctx.fillRect(TEX / 2 + Math.cos(a) * d, TEX / 2 + Math.sin(a) * d, r, r); }
      ctx.globalAlpha = 1;
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    if (oneOff) { tex.userData.oneOff = true; return tex; }
    texCache.set(key, tex);
    if (texCache.size > 600) {
      // Free the GPU copy too; three.js uploads it again if a die still uses it.
      const oldest = texCache.keys().next().value;
      texCache.get(oldest).dispose();
      texCache.delete(oldest);
    }
    return tex;
  };

  // Mesh: flat-shaded, one material group per face, UVs matching faceLayout.
  RP.dieGeometry = shape => {
    if (shape.geometry) return shape.geometry;
    const pos = [], nor = [], uv = [];
    const g = new THREE.BufferGeometry();
    let start = 0;
    shape.faces.forEach((f, fi) => {
      const L = faceLayout(shape, fi);
      const n = shape.normals[fi];
      const toUv = i => [0.5 + L.p2[i][0] / (2 * L.R), 0.5 + L.p2[i][1] / (2 * L.R)];
      let count = 0;
      for (let k = 1; k < f.length - 1; k++) {
        for (const idx of [0, k, k + 1]) {
          pos.push(...shape.verts[f[idx]]);
          nor.push(...n);
          uv.push(...toUv(idx));
          count++;
        }
      }
      g.addGroup(start, count, fi);
      start += count;
    });
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    shape.geometry = g;
    shape.edges = new THREE.EdgesGeometry(g, 1);
    return g;
  };

  RP.dieBodyShape = shape => new CANNON.ConvexPolyhedron({
    vertices: shape.verts.map(v => new CANNON.Vec3(v[0], v[1], v[2])),
    faces: shape.faces,
  });

  RP.faceLayout = faceLayout;
  RP.readableOn = readableOn;
  RP.diceFaceBackground = faceBackground;
  RP.drawDiceLabel = drawLabel;
  RP.diceLum = lumOf;
})();
