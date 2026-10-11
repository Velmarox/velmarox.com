// Dice skins: image textures drawn under the numbers.
//  - Built-in skins are painted on a canvas at runtime (no image files needed).
//  - "Custom image" uses a picture you choose, shrunk to 512px and kept in
//    local storage. It's sent to your partner once (live/<seat>/diceSkin) so
//    your dice look the same on their screen.
// Also makes the glitter flake maps used by the Glitter finish.
(() => {
  const SIZE = 512;
  const s = RP.settings;

  const canvas = () => { const c = document.createElement('canvas'); c.width = c.height = SIZE; return c; };
  const rand = (a, b) => a + Math.random() * (b - a);

  // ---------- built-in skins ----------
  function marble() {
    const c = canvas(), g = c.getContext('2d');
    g.fillStyle = '#ecebe8'; g.fillRect(0, 0, SIZE, SIZE);
    // soft clouds
    for (let i = 0; i < 40; i++) {
      const x = rand(0, SIZE), y = rand(0, SIZE), r = rand(40, 140);
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, `rgba(160,160,165,${rand(0.05, 0.14)})`); grd.addColorStop(1, 'rgba(160,160,165,0)');
      g.fillStyle = grd; g.fillRect(0, 0, SIZE, SIZE);
    }
    // veins
    g.lineCap = 'round';
    for (let i = 0; i < 16; i++) {
      g.strokeStyle = `rgba(${rand(40, 90) | 0},${rand(40, 90) | 0},${rand(50, 100) | 0},${rand(0.25, 0.6)})`;
      g.lineWidth = rand(0.6, 2.6);
      g.filter = `blur(${rand(0, 1.2).toFixed(1)}px)`;
      g.beginPath();
      let x = rand(-50, SIZE), y = rand(-50, SIZE);
      g.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        const nx = x + rand(-40, 140), ny = y + rand(-40, 140);
        g.quadraticCurveTo(x + rand(-60, 60), y + rand(-60, 60), nx, ny);
        x = nx; y = ny;
      }
      g.stroke();
    }
    g.filter = 'none';
    return c;
  }

  function galaxy() {
    const c = canvas(), g = c.getContext('2d');
    g.fillStyle = '#0b0a1f'; g.fillRect(0, 0, SIZE, SIZE);
    g.globalCompositeOperation = 'lighter';
    const hues = [270, 300, 220, 190, 330];
    for (let i = 0; i < 26; i++) {
      const x = rand(0, SIZE), y = rand(0, SIZE), r = rand(50, 190), hue = hues[i % hues.length] + rand(-15, 15);
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, `hsla(${hue},80%,55%,${rand(0.12, 0.3)})`); grd.addColorStop(1, `hsla(${hue},80%,40%,0)`);
      g.fillStyle = grd; g.fillRect(0, 0, SIZE, SIZE);
    }
    for (let i = 0; i < 900; i++) {                      // stars
      const r = Math.random() < 0.94 ? rand(0.4, 1.1) : rand(1.4, 2.4);
      g.fillStyle = `rgba(255,255,255,${rand(0.4, 1)})`;
      g.beginPath(); g.arc(rand(0, SIZE), rand(0, SIZE), r, 0, 6.3); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    return c;
  }

  function wood() {
    const c = canvas(), g = c.getContext('2d');
    g.fillStyle = '#b07a45'; g.fillRect(0, 0, SIZE, SIZE);
    const phase = rand(0, 6);
    for (let y = 0; y < SIZE; y += 2) {                  // growth rings, wavy
      const band = Math.sin(y * 0.09 + Math.sin(y * 0.013 + phase) * 3);
      g.fillStyle = band > 0.55 ? 'rgba(95,55,25,0.35)' : band < -0.7 ? 'rgba(230,180,120,0.18)' : 'rgba(0,0,0,0)';
      g.fillRect(0, y, SIZE, 2);
    }
    for (let i = 0; i < 2600; i++) {                      // grain streaks
      g.fillStyle = `rgba(70,40,15,${rand(0.05, 0.18)})`;
      g.fillRect(rand(0, SIZE), rand(0, SIZE), rand(8, 40), 1);
    }
    return c;
  }

  function stone() {
    const c = canvas(), g = c.getContext('2d');
    g.fillStyle = '#8d8f93'; g.fillRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < 9000; i++) {
      const v = rand(60, 200) | 0;
      g.fillStyle = `rgba(${v},${v},${v + 4},${rand(0.15, 0.5)})`;
      g.fillRect(rand(0, SIZE), rand(0, SIZE), rand(1, 4), rand(1, 4));
    }
    g.filter = 'blur(0.6px)'; g.drawImage(c, 0, 0); g.filter = 'none';
    g.strokeStyle = 'rgba(40,40,45,0.45)';
    for (let i = 0; i < 5; i++) {                         // hairline cracks
      g.lineWidth = rand(0.5, 1.4);
      g.beginPath();
      let x = rand(0, SIZE), y = rand(0, SIZE); g.moveTo(x, y);
      for (let k = 0; k < 8; k++) { x += rand(-30, 30); y += rand(-30, 30); g.lineTo(x, y); }
      g.stroke();
    }
    return c;
  }

  const BUILT_IN = { marble: ['Marble', marble], galaxy: ['Galaxy', galaxy], wood: ['Wood', wood], stone: ['Stone', stone] };
  const builtCache = {};

  // ---------- custom images ----------
  let myCustom = null, myCustomUrl = RP.store.get('diceSkinImage', '');
  let partnerCustom = null, partnerUrl = '';

  // Cheap fingerprint so textures rebuild when the picture changes.
  const hash = str => { let x = 0; for (let i = 0; i < str.length; i += 97) x = (x * 31 + str.charCodeAt(i)) | 0; return (x >>> 0).toString(36) + str.length; };

  function loadInto(url, done) {
    if (!url) { done(null); return; }
    const img = new Image();
    img.onload = () => { const c = canvas(); c.getContext('2d').drawImage(img, 0, 0, SIZE, SIZE); done(c); };
    img.onerror = () => done(null);
    img.src = url;
  }
  loadInto(myCustomUrl, c => { myCustom = c; });

  // Shrink any picture to a 512px square (centre crop) as a compact JPEG.
  function fileToSkin(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) { reject(new Error('That isn\'t an image file.')); return; }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const c = canvas();
        c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Couldn\'t read that image.')); };
      img.src = url;
    });
  }

  // ---------- glitter flake maps (shared by every face) ----------
  let glitter = null;
  function glitterMaps() {
    if (glitter) return glitter;
    const n = canvas(), ng = n.getContext('2d');
    const orm = canvas(), og = orm.getContext('2d');
    ng.fillStyle = 'rgb(128,128,255)'; ng.fillRect(0, 0, SIZE, SIZE);     // flat
    og.fillStyle = 'rgb(255,185,25)'; og.fillRect(0, 0, SIZE, SIZE);       // G = roughness, B = metalness (dull base)
    for (let i = 0; i < 13000; i++) {
      const x = rand(0, SIZE), y = rand(0, SIZE), w = rand(1.5, 4.2);
      // Each flake tilted steeply its own way, so at any moment a few of them
      // line up with a light and flash.
      ng.fillStyle = `rgb(${rand(15, 240) | 0},${rand(15, 240) | 0},${rand(110, 255) | 0})`;
      ng.fillRect(x, y, w, w);
      og.fillStyle = `rgb(255,${rand(0, 22) | 0},${rand(225, 255) | 0})`;   // mirror-shiny + metallic
      og.fillRect(x, y, w, w);
    }
    const tw = canvas(), tg = tw.getContext('2d');
    tg.fillStyle = '#000'; tg.fillRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < 2200; i++) {
      tg.fillStyle = `rgb(255,${rand(0, 255) | 0},0)`;
      const w = rand(1.6, 3.6);
      tg.fillRect(rand(0, SIZE), rand(0, SIZE), w, w);
    }
    const mk = c => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4; return t; };
    const twinkle = mk(tw);
    twinkle.magFilter = THREE.NearestFilter;          // keep each flake's phase crisp
    glitter = { normal: mk(n), orm: mk(orm), twinkle };
    return glitter;
  }

  /* v6.14.0: the dice update's two looks made per colour pair: a two-tone swirl (resin poured in two colours) and
     smoke (clouds hanging in glass). Seeded, so a die looks the same every throw. */
  const hexRgb = h => { const n = parseInt(String(h || '#888888').slice(1), 16) || 0; return [n >> 16, (n >> 8) & 255, n & 255]; };
  function noise2(seed) {   // smooth value noise on a 64-cell grid that wraps
    const N = 64, v = new Float32Array(N * N); let x = seed * 9301 + 49297;
    for (let i = 0; i < v.length; i++) { x = (x * 9301 + 49297) % 233280; v[i] = x / 233280; }
    const at = (i, j) => v[(((j % N) + N) % N) * N + (((i % N) + N) % N)], sm = t => t * t * (3 - 2 * t);
    return (px, py) => {
      const i = Math.floor(px), j = Math.floor(py), fx = sm(px - i), fy = sm(py - j);
      const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1);
      return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
    };
  }
  const procCache = new Map();
  const keep = (k, c) => { procCache.set(k, c); if (procCache.size > 24) procCache.delete(procCache.keys().next().value); return c; };
  function swirl(c1, c2) {
    const k = 'swirl:' + c1 + c2; if (procCache.has(k)) return procCache.get(k);
    const c = canvas(), g = c.getContext('2d'), img = g.createImageData(SIZE, SIZE), A = hexRgb(c1), B = hexRgb(c2), n1 = noise2(7), n2 = noise2(13);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const wx = x / 64 + n1(x / 90, y / 90) * 3.2, wy = y / 64 + n2(x / 90, y / 90) * 3.2;
      const band = Math.sin((wx + wy) * 2.1 + n1(wx * 0.7, wy * 0.7) * 6);
      let t = Math.min(1, Math.max(0, (band + 0.15) * 2.4)); t = t * t * (3 - 2 * t);   // mostly one or the other, soft where they meet
      const i = (y * SIZE + x) * 4;
      img.data[i] = A[0] * t + B[0] * (1 - t); img.data[i + 1] = A[1] * t + B[1] * (1 - t); img.data[i + 2] = A[2] * t + B[2] * (1 - t); img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return keep(k, c);
  }
  function smoke(col) {
    const k = 'smoke:' + col; if (procCache.has(k)) return procCache.get(k);
    const c = canvas(), g = c.getContext('2d'), [r, gg, b] = hexRgb(col), n = noise2(29);
    let seed = 4242; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 70; i++) {
      const x = rnd() * SIZE, y = rnd() * SIZE, rad = 40 + rnd() * 110 + n(x / 60, y / 60) * 40;
      const grd = g.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, `rgba(${r},${gg},${b},${0.08 + rnd() * 0.16})`); grd.addColorStop(1, `rgba(${r},${gg},${b},0)`);
      g.fillStyle = grd; g.fillRect(0, 0, SIZE, SIZE);
    }
    g.filter = 'blur(6px)'; g.drawImage(c, 0, 0); g.filter = 'none';
    return keep(k, c);
  }

  RP.skins = {
    list: () => [['none', 'None (plain colour)'], ...Object.entries(BUILT_IN).map(([k, v]) => [k, v[0]]), ['swirl', 'Two-tone swirl (uses the second colour)'], ['custom', 'Custom image…']],
    smoke,

    // Canvas for a dice style, or null (plain colour / image not loaded yet).
    canvasFor(style) {
      const id = style?.skin;
      if (!id || id === 'none') return null;
      if (id === 'custom' && style.skinUrl) return canvasForUrl(style.skinUrl);   // a saved preset's own picture
      if (id === 'custom') return style.fromPartner ? partnerCustom : myCustom;
      if (id === 'swirl') return swirl(style.color || '#888888', style.color2 || '#e8d9b0');   // v6.14.0
      if (!BUILT_IN[id]) return null;
      return (builtCache[id] ||= BUILT_IN[id][1]());
    },
    keyFor(style) {
      if (!style?.skin || style.skin === 'none') return '';
      if (style.skin === 'custom' && style.skinUrl) return 'url:' + hash(style.skinUrl);
      if (style.skin === 'custom') return 'custom:' + (style.fromPartner ? hash(partnerUrl) : hash(myCustomUrl));
      if (style.skin === 'swirl') return 'swirl:' + style.color + (style.color2 || '');
      return style.skin;
    },

    myCustomUrl: () => myCustomUrl,
    myCustomHash: () => (myCustomUrl ? hash(myCustomUrl) : ''),
    partnerUrl: () => partnerUrl,   // v6.20.0: for the Dice tray window

    async setCustomFromFile(file) {
      const url = await fileToSkin(file);
      myCustomUrl = url;
      RP.store.set('diceSkinImage', url);
      await new Promise(r => loadInto(url, c => { myCustom = c; r(); }));
      RP.sync.setLive({ diceSkin: url });
      return url;
    },

    // Used when a preset carries its own picture.
    async setCustomUrl(url) {
      if (!url || url === myCustomUrl) return;
      myCustomUrl = url;
      RP.store.set('diceSkinImage', url);
      await new Promise(r => loadInto(url, c => { myCustom = c; r(); }));
      RP.sync.setLive({ diceSkin: url });
      RP.emit('skins:loaded');
    },

    clearCustom() {
      myCustomUrl = ''; myCustom = null;
      RP.store.set('diceSkinImage', '');
      RP.sync.setLive({ diceSkin: '' });
    },

    glitterMaps,
  };

  // Pictures stored inside presets, loaded on demand.
  const urlCache = new Map();
  function canvasForUrl(url) {
    const k = hash(url);
    if (urlCache.has(k)) return urlCache.get(k);
    urlCache.set(k, null);
    loadInto(url, c => { urlCache.set(k, c); RP.emit('skins:loaded'); });
    return null;
  }

  /* v6.20.0: your own pictures for the highest face. Kept on this device (and with your saved settings on the GM's
     Codex): up to 8, each trimmed of its empty edges and fitted in 160px, at most about 120 KB. */
  const ICON_MAX = 8, ICON_PX = 160, ICON_BYTES = 120e3, ICON_IN = 5e6;
  RP.diceIcons = {
    list: () => RP.store.get('diceIcons', []).filter((x) => x && x.id && /^data:image\/(png|webp);base64,/.test(x.src || '')),
    get: (id) => RP.diceIcons.list().find((x) => x.id === id) || null,
    remove(id) { RP.store.set('diceIcons', RP.diceIcons.list().filter((x) => x.id !== id)); },
    /** Reads a picture, trims and shrinks it, and keeps it. Says what went wrong in plain words. */
    async add(file) {
      if (!file) throw new Error('No picture chosen.');
      if (!/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(file.type)) throw new Error('Use a PNG, JPG, WebP, GIF or SVG picture.');
      if (file.size > ICON_IN) throw new Error('That picture is over 5 MB. Use a smaller one.');
      if (RP.diceIcons.list().length >= ICON_MAX) throw new Error(`You can keep ${ICON_MAX} icons. Remove one first.`);
      const url = URL.createObjectURL(file);
      let img;
      try { img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('That picture couldn\'t be read.')); i.src = url; }); }
      finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
      const w0 = img.naturalWidth || 512, h0 = img.naturalHeight || 512;
      if (w0 < 16 || h0 < 16) throw new Error('That picture is too small (it needs at least 16 pixels each way).');
      /* draw it big, find where the picture really is (not the empty edges), then fit that in 160px */
      const k0 = Math.min(1, 1024 / Math.max(w0, h0)), W0 = Math.round(w0 * k0), H0 = Math.round(h0 * k0);
      const a = document.createElement('canvas'); a.width = W0; a.height = H0; const ag = a.getContext('2d', { willReadFrequently: true }); ag.drawImage(img, 0, 0, W0, H0);
      const px = ag.getImageData(0, 0, W0, H0).data; let x0 = W0, y0 = H0, x1 = -1, y1 = -1;
      for (let y = 0; y < H0; y++) for (let x = 0; x < W0; x++) if (px[(y * W0 + x) * 4 + 3] > 12) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < 0) throw new Error('That picture is see-through all over.');
      const cw = x1 - x0 + 1, ch = y1 - y0 + 1, k = Math.min(ICON_PX / cw, ICON_PX / ch), w = Math.max(1, Math.round(cw * k)), h = Math.max(1, Math.round(ch * k));
      const b = document.createElement('canvas'); b.width = ICON_PX; b.height = ICON_PX; const bg = b.getContext('2d');
      bg.imageSmoothingQuality = 'high'; bg.drawImage(a, x0, y0, cw, ch, (ICON_PX - w) / 2, (ICON_PX - h) / 2, w, h);
      let src = b.toDataURL('image/png');
      if (src.length > ICON_BYTES) src = b.toDataURL('image/webp', 0.86);
      if (src.length > ICON_BYTES) src = b.toDataURL('image/webp', 0.7);
      if (src.length > ICON_BYTES || !/^data:image\/(png|webp)/.test(src)) throw new Error('That picture is too detailed to keep small. Try a simpler one.');
      const name = String(file.name || 'Icon').replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim().slice(0, 24) || 'Icon';
      const icon = { id: RP.uid(), name, src };
      RP.store.set('diceIcons', [...RP.diceIcons.list(), icon]);
      return icon;
    },
  };
  /** A face icon's picture, loaded once and kept; null until it has loaded. */
  const iconImgs = new Map();
  RP.diceIcon = (src) => {
    if (!src) return null;
    let i = iconImgs.get(src);
    if (!i) { i = new Image(); i.onload = () => RP.emit('skins:loaded'); i.src = src; iconImgs.set(src, i); if (iconImgs.size > 40) iconImgs.delete(iconImgs.keys().next().value); }
    return i.complete && i.naturalWidth ? i : null;
  };

  /* v6.20.0: each seat's icon picture, from its live data (a roll line carries only the icon's name) */
  const seatIcons = new Map();
  RP.on('table:live', ({ seat, live } = {}) => {
    if (!seat) return;
    const hi = (live && live.diceIcon) || '', lo = (live && live.diceLowIcon) || '';
    seatIcons.set(seat, hi); seatIcons.set(seat + '|low', lo); if (hi) RP.diceIcon(hi); if (lo) RP.diceIcon(lo);
  });
  RP.seatIcon = (seat, which) => seatIcons.get(which === 'low' ? seat + '|low' : seat) || '';
  /* your own icon, loaded as the page starts and whenever you pick another */
  const warmMine = () => [RP.settings.diceTopSymbol, RP.settings.diceLowSymbol].forEach((v) => { const t = String(v || ''); if (t.startsWith('custom:')) RP.diceIcon(RP.diceIcons.get(t.slice(7))?.src); });
  setTimeout(warmMine, 0); RP.on('setting', (x) => { if (!x || ['diceTopSymbol', 'diceLowSymbol', '*'].includes(x.key)) warmMine(); });

  /* v6.14.0: a group's emblem as a picture, for the clan symbol on a die's top face (loaded once, then kept) */
  const emblems = new Map();
  RP.diceEmblem = fac => {
    if (!fac) return null;
    /* v6.15.0: asked each time and kept by picture, so a group's new banner is on its dice at the next throw */
    const src = RP.codex?.emblemOf?.(fac) || '';
    let e = emblems.get(fac);
    if (!e || e.src !== src) {
      e = { src, img: null };
      if (src) { e.img = new Image(); e.img.onload = () => RP.emit('skins:loaded'); e.img.src = src; }
      emblems.set(fac, e);
    }
    return e.img && e.img.complete && e.img.naturalWidth ? e.img : null;
  };

  // Partner's custom skin arrives with their live data.
  RP.on('partner:live', v => {
    const url = v?.diceSkin || '';
    if (url === partnerUrl) return;
    partnerUrl = url;
    loadInto(url, c => { partnerCustom = c; RP.emit('skins:loaded'); });
  });
})();
