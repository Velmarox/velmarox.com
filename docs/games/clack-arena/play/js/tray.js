// Clack Arena: the shared tray. Built the way Clack Attack's Dice_Tray.js works: every throw is simulated in full
// with cannon-es first (off-screen, instantly), then the recording is played back on screen with the sounds at the
// recorded impacts. Unlike Clack Attack nothing is relabelled: the face that ends up on top is the result.
//
// The player's side of the tray is the near edge (+z), the enemy's the far edge (-z). Everything here that isn't
// physics is there to make the tray readable: the throwing zones, a ring under each die in its owner's colour, the
// slingshot band and arrow, sparks and a moment of slow motion on a hard Clack, and the ghost paths of the throws
// an enemy tried and threw away.
(() => {
  const A = window.ARENA;
  const STEP = 1 / 60, MAX_SIM = 60 * 8, FLAT = 0.985;
  const TRAY_BORDER = 0.14;
  let trayPic = '/tools/clack-attack/play/Table/Trays/Green_Felt.jpg';   // setTray() swaps it
  const SOUNDS = { hit: '/tools/clack-attack/play/Table/Sounds/Die_Hit.wav', clatter: '/tools/clack-attack/play/Table/Sounds/Dice_Clatter.wav' };
  const FRAME = 1.7;               // painted frame width round the floor, world units
  const ZONE = 0.3;                // share of the tray's depth that is your throwing zone

  let renderer, scene, camera, canvas, host, tray, raf = 0, onFrame = null;
  let dims = { w: 20, d: 13 };
  const dice = new Map();          // key -> { mesh, shape, die, mats, ring }
  let play = null;                 // the throw being played back
  let zones = null, aim = null, tipping = null;
  const fx = [];                   // sparks, flashes and ghost paths, each with its own update

  const rand = (a, b) => a + Math.random() * (b - a);
  const lenOf = (v) => Math.hypot(v[0], v[1], v[2]);

  // ---------- scene ----------
  function studioEnvironment(r) {   // from Clack Attack: a dark room with softbox panels, so gloss reads as gloss
    const env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16), new THREE.MeshBasicMaterial({ color: 0x17171c, side: THREE.BackSide })));
    const panel = (w, h, pos, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(...pos); m.lookAt(0, 0, 0); env.add(m); };
    panel(14, 8, [0, 16, 10], 2.2); panel(4, 16, [-18, 8, 2], 3); panel(6, 10, [16, 10, -8], 2.2); panel(20, 3, [0, 6, -20], 1.5);
    const pmrem = new THREE.PMREMGenerator(r), tex = pmrem.fromScene(env, 0.02).texture; pmrem.dispose();
    return tex;
  }

  function init(el) {
    host = el;
    canvas = document.createElement('canvas'); canvas.className = 'tray-canvas';
    host.prepend(canvas);
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    scene = new THREE.Scene();
    scene.environment = studioEnvironment(renderer);
    camera = new THREE.PerspectiveCamera(36, 1, 0.5, 400);
    scene.add(new THREE.AmbientLight(0xffffff, 0.18));
    scene.add(new THREE.HemisphereLight(0xffffff, 0x303038, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.5);
    key.position.set(-20, 26, 10); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 4;
    const sc = key.shadow.camera; sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 90;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35); fill.position.set(12, 8, -6); scene.add(fill);

    tray = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 }));
    tray.rotation.x = -Math.PI / 2; tray.receiveShadow = true; scene.add(tray);

    zones = makeZones();
    aim = makeAim();

    new ResizeObserver(() => layout()).observe(host);
    layout();
    const loop = (now) => { raf = requestAnimationFrame(loop); tick(now); };
    raf = requestAnimationFrame(loop);
  }

  // The floor's shape follows the screen: wide on a wide screen, tall on a phone held upright.
  function layout() {
    if (!renderer) return;
    const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const want = w / h >= 1 ? { w: 20, d: 13 } : { w: 13, d: 18 };
    if (want.w !== dims.w || !tray.material.map) { dims = want; paintTray(); placeZones(); }
    fitCamera();
  }

  function paintTray() {
    const W = dims.w + 2 * FRAME, D = dims.d + 2 * FRAME;
    tray.scale.set(W, D, 1);
    const img = new Image();
    const want = trayPic;
    img.onload = () => {
      if (want !== trayPic) return;   // swapped again while this one loaded
      const PW = 1400, PH = Math.round(PW * D / W), fx2 = Math.round(PW * FRAME / W), fy = Math.round(PH * FRAME / D);
      const c = document.createElement('canvas'); c.width = PW; c.height = PH;
      const g = c.getContext('2d'), S = img.naturalWidth, T = img.naturalHeight, B = Math.round(TRAY_BORDER * Math.min(S, T)), iw = S - 2 * B, ih = T - 2 * B;
      const fw = PW - 2 * fx2, fh = PH - 2 * fy;
      let sw = iw, sh = iw * fh / fw; if (sh > ih) { sh = ih; sw = ih * fw / fh; }   // nine-sliced, as Clack Attack does it
      g.drawImage(img, B + (iw - sw) / 2, B + (ih - sh) / 2, sw, sh, fx2, fy, fw, fh);
      g.drawImage(img, B, 0, iw, B, fx2, 0, fw, fy); g.drawImage(img, B, T - B, iw, B, fx2, PH - fy, fw, fy);
      g.drawImage(img, 0, B, B, ih, 0, fy, fx2, fh); g.drawImage(img, S - B, B, B, ih, PW - fx2, fy, fx2, fh);
      g.drawImage(img, 0, 0, B, B, 0, 0, fx2, fy); g.drawImage(img, S - B, 0, B, B, PW - fx2, 0, fx2, fy);
      g.drawImage(img, 0, T - B, B, B, 0, PH - fy, fx2, fy); g.drawImage(img, S - B, T - B, B, B, PW - fx2, PH - fy, fx2, fy);
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      if (tray.material.map) tray.material.map.dispose();
      tray.material.map = tex; tray.material.color.set(0xffffff); tray.material.needsUpdate = true;
    };
    tray.material.color.set(0x1f4a2c);
    img.src = trayPic;
  }

  // Back the camera off until the whole tray, frame included, fits the screen.
  function fitCamera() {
    const tilt = 0.36, hw = dims.w / 2 + FRAME, hd = dims.d / 2 + FRAME;
    const corners = [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]].map(([x, z]) => new THREE.Vector3(x, 0, z));
    const fits = (dist) => {
      camera.position.set(0, dist * Math.cos(tilt), dist * Math.sin(tilt) + 0.6);
      camera.lookAt(0, 0, 0.6); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
      return corners.every((c) => { const p = c.clone().project(camera); return Math.abs(p.x) <= 0.97 && Math.abs(p.y) <= 0.95; });
    };
    let lo = 5, hi = 300;
    for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
    fits(hi);
  }

  // ---------- zones: where each side throws from ----------
  function stripeTexture(color) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = color; g.globalAlpha = 0.16; g.fillRect(0, 0, 256, 64);
    g.globalAlpha = 0.34;
    for (let x = -64; x < 256 + 64; x += 24) { g.beginPath(); g.moveTo(x, 64); g.lineTo(x + 12, 64); g.lineTo(x + 12 + 64, 0); g.lineTo(x + 64, 0); g.closePath(); g.fill(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  function makeZones() {
    const mk = (color) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: stripeTexture(color), transparent: true, depthWrite: false, opacity: 0.9 }));
      m.rotation.x = -Math.PI / 2; m.position.y = 0.012; m.renderOrder = 1; m.visible = false; scene.add(m);
      const edge = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, opacity: 0.85 }));
      edge.rotation.x = -Math.PI / 2; edge.position.y = 0.014; edge.renderOrder = 1; edge.visible = false; scene.add(edge);
      return { m, edge };
    };
    return { p: mk(A.PLAYER_OUTLINE), e: mk('#ff2a43'), show: false, pulse: false };
  }
  function zoneBounds(side = 'p') {
    const hd = dims.d / 2, depth = dims.d * (side === 'p' ? ZONE : 0.16);
    return side === 'p' ? { x0: -dims.w / 2, x1: dims.w / 2, z0: hd - depth, z1: hd } : { x0: -dims.w / 2, x1: dims.w / 2, z0: -hd, z1: -hd + depth };
  }
  function placeZones() {
    if (!zones) return;
    ['p', 'e'].forEach((s) => {
      const b = zoneBounds(s), z = zones[s], w = b.x1 - b.x0, d = b.z1 - b.z0;
      z.m.scale.set(w, d, 1); z.m.position.set(0, 0.012, (b.z0 + b.z1) / 2);
      z.m.material.map.repeat.set(w / 3, 1);
      z.edge.scale.set(w, 0.08, 1); z.edge.position.set(0, 0.014, s === 'p' ? b.z0 : b.z1);
    });
  }
  function setZones(show, pulse) {
    zones.show = show; zones.pulse = pulse;
    ['p', 'e'].forEach((s) => { zones[s].m.visible = show; zones[s].edge.visible = show; });
  }

  // ---------- dice ----------
  function material(map, look) {
    const fin = A.FINISHES[look.finish] || A.FINISHES.satin, glass = (fin.bgAlpha ?? 1) < 1;
    return new THREE.MeshPhysicalMaterial({
      map, transparent: glass, roughness: fin.roughness, metalness: fin.metalness, envMapIntensity: fin.env ?? 1,
      clearcoat: fin.clearcoat || 0, clearcoatRoughness: fin.clearcoatRoughness ?? 0.08,
      sheen: fin.sheen || 0, sheenRoughness: fin.sheenRoughness ?? 0.5, sheenColor: new THREE.Color(0xffffff),
      iridescence: fin.iridescence || 0, iridescenceIOR: 1.35, depthWrite: !glass, emissive: new THREE.Color(0x000000),
    });
  }

  const inRadius = (shape) => (shape.inR ??= Math.min(...shape.faces.map((f, i) => { const v = shape.verts[f[0]], n = shape.normals[i]; return v[0] * n[0] + v[1] * n[1] + v[2] * n[2]; })));
  const outRadius = (shape) => (shape.outR ??= Math.max(...shape.verts.map(lenOf)));

  // Direction (in the die's own frame) that points up when game face `fi` is the result.
  function faceDir(shape, fi) {
    if (shape.sides === 4) { const v = shape.verts[fi], l = lenOf(v); return new THREE.Vector3(v[0] / l, v[1] / l, v[2] / l); }
    return new THREE.Vector3(...shape.normals[fi]);
  }
  A.faceDir = faceDir;

  // Faces next to face fi (for Nudge): sharing an edge, or on a d4 every other corner.
  A.neighbours = (sides, fi) => {
    const shape = RP.dieShape(sides);
    if (sides === 4) return [0, 1, 2, 3].filter((v) => v !== fi);
    const mine = new Set(shape.faces[fi]);
    return shape.faces.map((f, i) => (i !== fi && f.filter((v) => mine.has(v)).length >= 2 ? i : -1)).filter((i) => i >= 0);
  };

  function ringMesh(color, r) {
    const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.92, r * 1.12, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.02; m.renderOrder = 2; scene.add(m);
    return m;
  }

  /** Adds (or rebuilds) a die. die = { sides, faces, look }; opts = { outline, chalk, ring } */
  function setDie(key, die, opts = {}) {
    const old = dice.get(key), keepPos = old && { p: old.mesh.position.clone(), q: old.mesh.quaternion.clone() };
    removeDie(key);
    const shape = RP.dieShape(die.sides);
    const mats = shape.faces.map((_, fi) => material(A.faceTexture(shape, fi, die, { chalk: opts.chalk }), die.look));
    const mesh = new THREE.Mesh(RP.dieGeometry(shape), mats);
    mesh.castShadow = true;
    const extra = [];
    if (opts.outline) {
      const hull = new THREE.Mesh(RP.dieGeometry(shape), new THREE.MeshBasicMaterial({ color: opts.outline, side: THREE.BackSide }));
      hull.scale.setScalar(1.09); mesh.add(hull); extra.push(hull.material);
    }
    scene.add(mesh);
    const ring = opts.ring ? ringMesh(opts.ring, outRadius(shape) * 0.95) : null;
    const d = { mesh, shape, die, mats, extra, ring, flash: 0, flashColor: new THREE.Color() };
    dice.set(key, d);
    if (keepPos) { mesh.position.copy(keepPos.p); mesh.quaternion.copy(keepPos.q); } else restAt(key, 0, 0, 0);
    return d;
  }
  function removeDie(key) {
    const d = dice.get(key); if (!d) return;
    scene.remove(d.mesh); [...d.mats, ...d.extra].forEach((m) => { m.map?.dispose(); m.dispose(); });
    if (d.ring) { scene.remove(d.ring); d.ring.geometry.dispose(); d.ring.material.dispose(); }
    dice.delete(key);
  }
  function clearDice() { [...dice.keys()].forEach(removeDie); clearFx(); hideAim(); }

  // Sits a die flat on the table at x, z with game face fi up.
  function restAt(key, x, z, fi, spin = 0) {
    const d = dice.get(key); if (!d) return;
    const q = new THREE.Quaternion().setFromUnitVectors(faceDir(d.shape, fi), new THREE.Vector3(0, 1, 0));
    q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spin));
    d.mesh.quaternion.copy(q);
    d.mesh.position.set(x, inRadius(d.shape), z);
    d.mesh.visible = true;
  }
  function hover(key, x, z, t, lift = 2.4) {
    const d = dice.get(key); if (!d) return;
    d.mesh.position.set(x, lift + Math.sin(t * 3) * 0.2, z);
    d.mesh.quaternion.setFromEuler(new THREE.Euler(t * 1.3, t * 1.7, t * 0.9));
  }
  const posOf = (key) => { const d = dice.get(key); return d ? { x: d.mesh.position.x, y: d.mesh.position.y, z: d.mesh.position.z } : null; };

  // A short glow on a die (who's acting right now).
  function flash(key, color = '#ffffff', strength = 0.55) {
    const d = dice.get(key); if (!d) return;
    d.flash = strength; d.flashColor.set(color);
  }

  // ---------- simulation ----------
  const G_TABLE = 1, G_DIE = 2;
  /**
   * throws: [{ key, phys, pos: [x, y, z], vel: [x, y, z], ang: [x, y, z], quat: [x, y, z, w] }]
   * Returns { frames, sounds, clacks: [{ a, b, v, from, to, frame }], up, status, on, settled }
   *   status per die: 'ok' (flat), 'pinned' (leaning on another die: on = its index) or 'lean' (on a wall, or never settled)
   */
  function simulate(throws) {
    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -60, 0) });
    world.allowSleep = true; world.broadphase = new CANNON.NaiveBroadphase(); world.solver.iterations = 14;
    const tableMat = new CANNON.Material('table'), wallMat = new CANNON.Material('wall');
    const mats = throws.map((t, i) => new CANNON.Material('die' + i));
    const ph = throws.map((t) => ({ ...A.PHYS, ...(t.phys || {}) }));
    throws.forEach((t, i) => {
      const p = ph[i];
      world.addContactMaterial(new CANNON.ContactMaterial(mats[i], tableMat, { friction: 0.35 * p.grip, restitution: Math.min(0.92, 0.38 * p.bounce) }));
      world.addContactMaterial(new CANNON.ContactMaterial(mats[i], wallMat, { friction: 0.05 * p.grip, restitution: Math.min(0.92, 0.6 * p.bounce) }));
      for (let j = i + 1; j < throws.length; j++) {
        const q = ph[j];
        world.addContactMaterial(new CANNON.ContactMaterial(mats[i], mats[j], { friction: 0.2 * (p.grip + q.grip) / 2, restitution: Math.min(0.92, 0.5 * (p.bounce + q.bounce) / 2) }));
      }
    });
    const plane = (mat, pos, axis, angle) => {
      const b = new CANNON.Body({ mass: 0, material: mat, shape: new CANNON.Plane() });
      b.shapes[0].collisionFilterGroup = G_TABLE; b.shapes[0].collisionFilterMask = G_DIE;
      b.position.set(...pos); if (axis) b.quaternion.setFromAxisAngle(new CANNON.Vec3(...axis), angle);
      b.userData = { kind: mat === tableMat ? 'table' : 'wall' }; world.addBody(b);
    };
    const hw = dims.w / 2, hd = dims.d / 2;
    plane(tableMat, [0, 0, 0], [1, 0, 0], -Math.PI / 2);
    plane(wallMat, [-hw, 0, 0], [0, 1, 0], Math.PI / 2);
    plane(wallMat, [hw, 0, 0], [0, 1, 0], -Math.PI / 2);
    plane(wallMat, [0, 0, -hd], null, 0);
    plane(wallMat, [0, 0, hd], [0, 1, 0], Math.PI);

    const sounds = [], hits = new Map();
    const bodies = throws.map((t, i) => {
      const shape = RP.dieShape(dice.get(t.key).shape.sides);
      const body = new CANNON.Body({ mass: ph[i].mass, material: mats[i], linearDamping: 0.12, angularDamping: 0.12, sleepSpeedLimit: 0.25, sleepTimeLimit: 0.25 });
      const poly = RP.dieBodyShape(shape); poly.collisionFilterGroup = G_DIE; poly.collisionFilterMask = G_TABLE | G_DIE;
      body.addShape(poly);
      body.position.set(...t.pos); body.velocity.set(...t.vel); body.angularVelocity.set(...t.ang); body.quaternion.set(...t.quat);
      body.userData = { kind: 'die', index: i };
      body.addEventListener('collide', (e) => {
        const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
        const o = e.body.userData || {};
        if (o.kind === 'die') {
          if (o.index < i) return;   // each pair once
          const j = o.index, key = i + ':' + j, mine = body.velocity.length(), theirs = e.body.velocity.length();
          const prev = hits.get(key);
          if (!prev || v > prev.v) hits.set(key, { a: i, b: j, v, from: mine >= theirs ? i : j, to: mine >= theirs ? j : i, frame: world.stepnumber });
        }
        if (v >= 1.2) sounds.push({ frame: world.stepnumber, v, other: o.kind, i });
      });
      world.addBody(body);
      return { body, shape };
    });

    const frames = [];
    let calm = 0, settled = false;
    for (let f = 0; f < MAX_SIM; f++) {
      world.step(STEP);
      frames.push(bodies.map(({ body: b }) => [b.position.x, b.position.y, b.position.z, b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w]));
      const still = bodies.every(({ body: b }) => b.sleepState === CANNON.Body.SLEEPING || (b.velocity.length() < 0.05 && b.angularVelocity.length() < 0.05));
      calm = still ? calm + 1 : 0;
      if (calm > 12) { settled = true; break; }
    }

    const status = [], on = [];
    const up = bodies.map(({ body, shape }, i) => {
      const q = new THREE.Quaternion(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);
      const ns = shape.normals.map((n) => new THREE.Vector3(...n).applyQuaternion(q)), ys = ns.map((n) => n.y);
      let face, flat;
      if (shape.sides === 4) {
        const bottom = ys.indexOf(Math.min(...ys));
        face = [0, 1, 2, 3].find((v) => !shape.faces[bottom].includes(v)); flat = ys[bottom] <= -FLAT;
      } else { face = ys.indexOf(Math.max(...ys)); flat = ys[face] >= FLAT; }
      on[i] = -1;
      if (settled && flat) status[i] = 'ok';
      else {
        // Leaning: on another die if their centres are close enough to touch.
        const p = body.position;
        let best = -1, bd = Infinity;
        bodies.forEach(({ body: b2, shape: s2 }, j) => {
          if (j === i) return;
          const dd = p.distanceTo(b2.position);
          if (dd < (outRadius(shape) + outRadius(s2)) * 0.98 && dd < bd) { bd = dd; best = j; }
        });
        status[i] = settled && best >= 0 ? 'pinned' : 'lean';
        on[i] = best;
      }
      return face;
    });
    const clacks = [...hits.values()];
    return { frames, sounds, clacks, up, status, on, settled };
  }

  // ---------- throws ----------
  // A throw from a launch point in a direction with power 0..1. Spin is random (fixed once chosen).
  function makeThrow(key, phys, x, z, dx, dz, power, spinSeed) {
    const l = Math.hypot(dx, dz) || 1, speed = 9 + power * 25;
    const s = spinSeed || [rand(-1, 1), rand(-1, 1), rand(-1, 1), rand(0, 6.3), rand(0, 6.3), rand(0, 6.3)];
    const spin = 8 + power * 18;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(s[3], s[4], s[5]));
    return { key, phys, pos: [x, 2.6, z], vel: [dx / l * speed, 1.5 + power * 2, dz / l * speed], ang: [s[0] * spin, s[1] * spin, s[2] * spin], quat: [q.x, q.y, q.z, q.w], seed: s };
  }

  // ---------- playback ----------
  // Time runs on its own clock so a hard Clack can freeze it for a beat (hit-stop).
  function playback(sim, throws, cb = {}) {
    throws.forEach((t) => { const d = dice.get(t.key); if (d) d.mesh.visible = true; });
    play = { sim, throws, t: 0, last: performance.now(), slowUntil: 0, next: 0, nextClack: 0, clacks: [...sim.clacks].sort((a, b) => a.frame - b.frame), cb, landed: false, speed: 1.1 * (A.playSpeed || 1) };
  }

  function advance(now) {
    const a = play, dt = Math.max(0, Math.min(0.2, (now - a.last) / 1000)); a.last = Math.max(a.last, now);   // rAF time can trail performance.now()
    a.t += dt * a.speed * (now < a.slowUntil ? 0.08 : 1);
    const fi = Math.min(a.sim.frames.length - 1, Math.floor(a.t / STEP)), fr = a.sim.frames[fi];
    a.throws.forEach((th, i) => { const m = dice.get(th.key)?.mesh; if (!m) return; const p = fr[i]; m.position.set(p[0], p[1], p[2]); m.quaternion.set(p[3], p[4], p[5], p[6]); });
    while (a.next < a.sim.sounds.length && a.sim.sounds[a.next].frame <= fi) {
      const e = a.sim.sounds[a.next++], k = Math.min(1, e.v / 14);
      sound(e.other === 'die' ? 'clatter' : 'hit', e.other === 'wall' ? k * 0.6 : k);
    }
    while (a.nextClack < a.clacks.length && a.clacks[a.nextClack].frame <= fi) {
      const c = a.clacks[a.nextClack++];
      const pa = fr[c.a], pb = fr[c.b];
      const at = new THREE.Vector3((pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, (pa[2] + pb[2]) / 2);
      const dmg = a.cb.onClack?.(c, at) || 0;
      if (dmg > 0) { spark(at, dmg); if (!A.settings?.reduceMotion) a.slowUntil = now + 70 + dmg * 70; }
    }
    if (!a.landed && fi >= a.sim.frames.length - 1) { a.landed = true; const cb = a.cb.onLand; play = null; cb?.(); }
  }

  // Nudge: tip a resting die so face fi is up (a short hop and turn).
  function tip(key, fi, ms = 380) {
    return new Promise((done) => {
      const d = dice.get(key); if (!d) return done();
      const from = d.mesh.quaternion.clone(), y0 = d.mesh.position.y;
      const cur = faceDir(d.shape, fi).applyQuaternion(from);
      const to = new THREE.Quaternion().setFromUnitVectors(cur, new THREE.Vector3(0, 1, 0)).multiply(from);
      tipping = { d, from, to, y0, t0: performance.now(), ms, done };
    });
  }
  function stepTip(now) {
    const k = Math.min(1, (now - tipping.t0) / tipping.ms), e = k * k * (3 - 2 * k);
    tipping.d.mesh.quaternion.slerpQuaternions(tipping.from, tipping.to, e);
    tipping.d.mesh.position.y = tipping.y0 + Math.sin(Math.PI * k) * 1.2;
    if (k >= 1) { const done = tipping.done; tipping = null; done(); }
  }

  // ---------- effects ----------
  let glowTex = null;
  function softDot() {
    if (glowTex) return glowTex;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.4, 'rgba(255,255,255,0.6)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    return (glowTex = new THREE.CanvasTexture(c));
  }
  // A burst where two dice met: a flash, a ring on the felt and sparks thrown outwards. Bigger hit, bigger burst.
  function spark(at, power = 1) {
    const t0 = performance.now(), color = power >= 3 ? '#ff2a43' : power >= 2 ? '#ff8a1f' : '#f5e400';
    const flashS = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    flashS.position.copy(at); scene.add(flashS);
    const ringM = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.85, 40), new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false }));
    ringM.rotation.x = -Math.PI / 2; ringM.position.set(at.x, 0.03, at.z); scene.add(ringM);
    const bits = Array.from({ length: 8 + power * 6 }, () => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      const a = Math.random() * Math.PI * 2, sp = 6 + Math.random() * 8 * power;
      s.position.copy(at); s.scale.setScalar(0.35); scene.add(s);
      return { s, v: new THREE.Vector3(Math.cos(a) * sp, 4 + Math.random() * 8, Math.sin(a) * sp) };
    });
    let last = t0;
    fx.push({
      update(now) {
        const k = (now - t0) / 520, dt = (now - last) / 1000; last = now;
        flashS.scale.setScalar(2 + power * 2.2 * Math.min(1, k * 4)); flashS.material.opacity = Math.max(0, 1 - k * 1.6);
        ringM.scale.setScalar(1 + k * (3 + power * 2)); ringM.material.opacity = Math.max(0, 0.9 - k);
        bits.forEach((b) => { b.v.y -= 40 * dt; b.s.position.addScaledVector(b.v, dt); b.s.position.y = Math.max(0.05, b.s.position.y); b.s.material.opacity = Math.max(0, 1 - k); });
        return k < 1;
      },
      dispose() { [flashS, ringM, ...bits.map((b) => b.s)].forEach((o) => { scene.remove(o); o.material.dispose(); }); ringM.geometry.dispose(); },   // sprites share one geometry: leave it
    });
  }

  // The throws an enemy tried in secret and didn't keep: faint dashed paths that fade as the real throw starts.
  function ghosts(paths, color = '#ff2a43', ms = 2400) {
    const t0 = performance.now();
    const lines = paths.filter((p) => p.length > 1).map((p) => {
      // A trail of dots (WebGL lines are one pixel thin, too faint to read on the felt).
      const g = new THREE.BufferGeometry().setFromPoints(p.map(([x, z]) => new THREE.Vector3(x, 0.08, z)));
      const l = new THREE.Points(g, new THREE.PointsMaterial({ color, map: softDot(), size: 0.55, transparent: true, opacity: 0.85, depthWrite: false }));
      l.renderOrder = 3; scene.add(l);
      const end = p[p.length - 1];
      const x = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 4), new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false }));
      x.rotation.x = -Math.PI / 2; x.position.set(end[0], 0.06, end[1]); scene.add(x);
      return [l, x];
    }).flat();
    fx.push({
      update(now) { const k = (now - t0) / ms; lines.forEach((o) => { o.material.opacity = 0.85 * Math.max(0, 1 - k * k); }); return k < 1; },
      dispose() { lines.forEach((o) => { scene.remove(o); o.geometry.dispose(); o.material.dispose(); }); },
    });
  }
  function clearFx() { fx.splice(0).forEach((f) => f.dispose()); }

  // ---------- aiming: slingshot band, arrow and launch marker ----------
  // Change the tray picture. Repaints at once if the tray is already up. (Nothing calls it yet: other trays are kept
  // for difficulty levels.)
  function setTray(url) { if (url === trayPic) return; trayPic = url; if (tray?.material.map) paintTray(); }

  function makeAim() {
    const s = new THREE.Shape();
    s.moveTo(0, -0.18); s.lineTo(0.82, -0.18); s.lineTo(0.82, -0.46); s.lineTo(1.25, 0); s.lineTo(0.82, 0.46); s.lineTo(0.82, 0.18); s.lineTo(0, 0.18); s.closePath();
    const arrow = new THREE.Mesh(new THREE.ShapeGeometry(s), new THREE.MeshBasicMaterial({ color: A.PLAYER_OUTLINE, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
    arrow.rotation.x = -Math.PI / 2;
    const arrowG = new THREE.Group(); arrowG.add(arrow); arrowG.visible = false; scene.add(arrowG); arrow.renderOrder = 4;
    const band = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false }));
    band.visible = false; band.renderOrder = 4; scene.add(band);
    const mark = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.2, 40), new THREE.MeshBasicMaterial({ color: A.PLAYER_OUTLINE, transparent: true, opacity: 0.9, depthWrite: false }));
    mark.rotation.x = -Math.PI / 2; mark.position.y = 0.03; mark.visible = false; mark.renderOrder = 4; scene.add(mark);
    return { arrowG, arrow, band, mark };
  }
  /** o = { x, z, dx, dz, power, pull: {x, z} | null, arrow: bool } */
  function showAim(o) {
    aim.mark.visible = true; aim.mark.position.x = o.x; aim.mark.position.z = o.z;
    const has = o.power > 0.01;
    aim.arrowG.visible = has && o.arrow !== false;
    if (has) {
      aim.arrowG.position.set(o.x, 0.05, o.z);
      aim.arrowG.rotation.y = Math.atan2(-o.dz, o.dx);
      const L = 1.5 + o.power * Math.min(dims.w, dims.d) * 0.6;
      aim.arrow.scale.set(L / 1.25, 0.8 + o.power * 0.6, 1);
      aim.arrow.material.color.set(o.power > 0.85 ? '#ff2a43' : o.power > 0.55 ? '#ff8a1f' : A.PLAYER_OUTLINE);
    }
    aim.band.visible = !!o.pull && has;
    if (o.pull) aim.band.geometry.setFromPoints([new THREE.Vector3(o.x, 1.6, o.z), new THREE.Vector3(o.pull.x, 0.05, o.pull.z)]);
  }
  function hideAim() { if (!aim) return; aim.arrowG.visible = false; aim.band.visible = false; aim.mark.visible = false; }

  // Where a screen point lands on the table (y = 0), or null.
  function tableAt(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    const v = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(v, camera);
    const hit = new THREE.Vector3();
    return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit) ? { x: hit.x, z: hit.z } : null;
  }
  // Screen position (relative to the tray box) of a point, or of a die.
  function screenAt(x, y, z) {
    const p = new THREE.Vector3(x, y, z).project(camera);
    return { x: (p.x + 1) / 2 * host.clientWidth, y: (1 - p.y) / 2 * host.clientHeight };
  }
  function screenOf(key, lift = 1.6) {
    const d = dice.get(key); if (!d) return null;
    return screenAt(d.mesh.position.x, d.mesh.position.y + lift, d.mesh.position.z);
  }

  // ---------- sound ----------
  const pools = {}; let lastSound = 0;
  function sound(name, strength) {
    if (A.settings && !A.settings.sound) return;
    const now = performance.now(); if (now - lastSound < 28) return; lastSound = now;
    const pool = (pools[name] ||= []);
    let a = pool.find((x) => x.paused || x.ended);
    if (!a) { if (pool.length >= 8) return; a = new Audio(SOUNDS[name]); a.preservesPitch = false; pool.push(a); }
    a.volume = Math.max(0, Math.min(1, strength * 0.8)); a.playbackRate = 0.88 + Math.random() * 0.28; a.currentTime = 0;
    a.play().catch(() => {});
  }

  function tick(now) {
    if (play) advance(now);
    if (tipping) stepTip(now);
    for (let i = fx.length - 1; i >= 0; i--) if (!fx[i].update(now)) { fx[i].dispose(); fx.splice(i, 1); }
    dice.forEach((d) => {
      if (d.ring) {
        const p = d.mesh.position, h = Math.max(0, p.y - inRadius(d.shape));
        d.ring.position.x = p.x; d.ring.position.z = p.z; d.ring.visible = d.mesh.visible;
        d.ring.material.opacity = Math.max(0.15, 0.75 - h * 0.12); d.ring.scale.setScalar(1 + h * 0.06);
      }
      if (d.flash > 0) { d.flash = Math.max(0, d.flash - 0.018); d.mats.forEach((m) => m.emissive.copy(d.flashColor).multiplyScalar(d.flash)); }
    });
    if (zones?.show) {
      const k = zones.pulse ? 0.55 + 0.45 * Math.sin(now / 260) : 0.45;
      zones.p.m.material.opacity = k; zones.p.edge.material.opacity = 0.4 + 0.5 * k;
      zones.p.m.material.map.offset.x = zones.pulse ? (now / 4000) % 1 : 0;
      zones.e.m.material.opacity = 0.35; zones.e.edge.material.opacity = 0.5;
    }
    onFrame?.(now);
    renderer.render(scene, camera);
  }

  A.tray = {
    init, setTray, layout, setDie, removeDie, clearDice, restAt, hover, simulate, makeThrow, playback, tip, flash, ghosts, spark,
    showAim, hideAim, tableAt, screenAt, screenOf, sound, setZones, zoneBounds, posOf,
    get dims() { return dims; },
    get busy() { return !!play || !!tipping; },
    set onFrame(fn) { onFrame = fn; },
    die: (key) => dice.get(key),
    inRadius, outRadius,
  };
})();
