// Little d20 "portraits": one die in a given style, rendered to an image.
// Used as each player's identifier (Partner and You panels) and on the
// preset cards. Uses its own small renderer so it never disturbs a throw.
(() => {
  const PX = 160;                       // rendered size; shown smaller, so it stays crisp
  let renderer, scene, camera, glint, failed = false;
  const cache = new Map();
  const queue = [];
  let queued = false;

  function ensure() {
    if (renderer || failed) return !!renderer;
    if (!window.THREE || !RP.diceKit) { failed = true; return false; }
    try {
      const c = document.createElement('canvas');
      c.width = c.height = PX;
      renderer = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true, preserveDrawingBuffer: true });
    } catch { failed = true; return false; }
    renderer.setSize(PX, PX, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    scene = new THREE.Scene();
    scene.environment = RP.diceKit.studioEnvironment(renderer);
    scene.add(new THREE.AmbientLight(0xffffff, 0.2));
    scene.add(new THREE.HemisphereLight(0xffffff, 0x303038, 0.5));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(-5, 4, 6);
    scene.add(key);
    glint = new THREE.PointLight(0xffffff, 0, 0, 0);
    glint.position.set(3, 3, 5);
    scene.add(glint);
    camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    camera.position.set(0, 0, 5.2);
    camera.lookAt(0, 0, 0);
    return true;
  }

  function keyOf(style) {
    return JSON.stringify([style.color, style.number, style.finish, style.font, style.multi, style.outline, RP.skins?.keyFor(style), style.tint, style.glitter,
      style.color2, style.inclusion, style.wear, style.numStyle, style.top, style.low, style.clan, style.mixed && style.mixed[20]]);   // v6.14.0
  }

  // Render right now; returns a PNG data URL ('' if 3D isn't available).
  function renderNow(style) {
    if (!ensure()) return '';
    const shape = RP.dieShape(20);
    const finish = RP.diceKit.finishOf ? RP.diceKit.finishOf(style, 20) : RP.diceFinish ? RP.diceFinish(style.finish) : RP.diceKit.FINISHES[style.finish] || RP.diceKit.FINISHES.satin;
    const look = RP.diceKit.lookFor(style, 20, finish);
    const labels = Array.from({ length: 20 }, (_, i) => String(i + 1));
    const mats = shape.faces.map((_, fi) => RP.diceKit.makeMaterial(RP.faceTexture(shape, fi, labels, look), finish, 1, style.glitter ?? 1));
    const mesh = new THREE.Mesh(RP.dieGeometry(shape), mats);
    if (style.outline) {
      const edge = new THREE.LineBasicMaterial({ color: style.number || RP.readableOn(look.color), transparent: true, opacity: 0.3 });
      mesh.add(new THREE.LineSegments(shape.edges, edge));
      mats.push(edge);
    }
    // Turn the "20" face towards the viewer, tipped back a little so it looks 3D.
    const n = new THREE.Vector3(...shape.normals[19]);
    mesh.quaternion.setFromUnitVectors(n, new THREE.Vector3(0.12, 0.22, 1).normalize());
    glint.intensity = finish.glitter ? 2 : 0;
    scene.add(mesh);
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/png');
    scene.remove(mesh);
    mats.forEach(m => m.dispose());
    return url;
  }

  // Fill an <img> with a portrait. Cached; renders are spread over frames
  // so a screen full of presets doesn't freeze the app.
  RP.diePortrait = (img, style) => {
    if (!style || !style.color) { img.removeAttribute('src'); return; }
    const k = keyOf(style);
    img.dataset.portrait = k;
    if (cache.has(k)) { img.src = cache.get(k); return; }
    queue.push({ img, style, k });
    if (!queued) { queued = true; requestAnimationFrame(drain); }
  };

  function drain() {
    const start = performance.now();
    while (queue.length && performance.now() - start < 24) {
      const { img, style, k } = queue.shift();
      if (!cache.has(k)) {
        try { cache.set(k, renderNow(style)); } catch (e) { console.warn('portrait failed', e); cache.set(k, ''); }
        if (cache.size > 80) cache.delete(cache.keys().next().value);
      }
      if (img.dataset.portrait === k && cache.get(k)) img.src = cache.get(k);
    }
    if (queue.length) requestAnimationFrame(drain); else queued = false;
  }

  // Forget cached portraits that used a skin image which just finished loading.
  RP.on('skins:loaded', () => {
    for (const k of [...cache.keys()]) if (k.includes('custom') || k.includes('url:')) cache.delete(k);
    RP.emit('portraits:stale');
  });
})();
