// 3D dice that get thrown across the whole window.
//
// How the result stays honest: the roll engine picks the numbers first.
// The tray then simulates the throw in cannon-es (instantly, off-screen),
// sees which face each die comes to rest on, and swaps the face labels so
// that face shows the rolled number. The recorded motion is then played
// back on screen, with impact sounds at the recorded collision moments.
(() => {
  const s = RP.settings;
  const STEP = 1 / 60;
  const MAX_SIM = 60 * 9;            // frames
  const MAX_DICE = 14;

  let renderer, scene, camera, floorMesh, light, canvas, glint, surfaceMesh;

  // Surface finishes. The differences come mostly from how much of the room
  // reflection each one shows (env) and how sharp that reflection is.
  // bgAlpha < 1 makes the body see-through (numbers stay solid).
  RP.DICE_FINISHES = {
    matte: { label: 'Matte (chalky)', roughness: 1, metalness: 0, env: 0.08 },
    satin: { label: 'Satin (soft sheen)', roughness: 0.55, metalness: 0, env: 0.55, sheen: 1, sheenRoughness: 0.3 },
    glossy: { label: 'Glossy (shiny)', roughness: 0.25, metalness: 0, env: 1.3, clearcoat: 1, clearcoatRoughness: 0.03 },
    metal: { label: 'Metal', roughness: 0.22, metalness: 1, env: 1.6 },
    pearl: { label: 'Pearl (colour-shift)', roughness: 0.3, metalness: 0.1, env: 1.2, clearcoat: 0.8, iridescence: 1 },
    glass: { label: 'Glass (see-through)', roughness: 0.05, metalness: 0, env: 1.4, clearcoat: 1, clearcoatRoughness: 0.02, bgAlpha: 0.42 },
    /* v6.14.0: clouds hanging in glass (in the second colour), and a cut gemstone */
    smoke: { label: 'Smoke glass (clouds inside)', roughness: 0.06, metalness: 0, env: 1.4, clearcoat: 1, clearcoatRoughness: 0.02, bgAlpha: 0.6, smoke: true },
    gem: { label: 'Gemstone (facets)', roughness: 0.02, metalness: 0, env: 2.2, clearcoat: 1, clearcoatRoughness: 0.01, bgAlpha: 0.72, gem: true, iridescence: 0.25 },
  };
  const FINISHES = RP.DICE_FINISHES;
  /* v6.9.0: Glitter is gone; a look that still names it (an old preset, someone else's roll) gets Metal */
  RP.diceFinish = f => FINISHES[f === 'glitter' ? 'metal' : f] || FINISHES.satin;
  const GLITTER_TIME = { value: 0 };             // drives the glitter twinkle

  // "Multicolour set": each die type gets its own hue, starting from your colour.
  const MULTI_HUE = { 4: 0, 6: 55, 8: 110, 10: 165, 12: 220, 20: 290, 100: 330 };
  function shiftHue(hex, deg) {
    if (!deg) return hex;
    const c = new THREE.Color(hex), hsl = {};
    c.getHSL(hsl);
    c.setHSL((hsl.h + deg / 360) % 1, Math.max(hsl.s, 0.45), hsl.l);
    return '#' + c.getHexString();
  }
  let bounds = { w: 20, d: 12 };
  // Throws on screen, one per owner ('me' / 'partner'). A new throw only
  // replaces the same owner's previous one, so both players' dice can be
  // tumbling at the same time.
  const throws = new Map();
  let raf = 0;
  let lastSim = null;                // what the latest throw settled on (for debug())
  const pending = new Set();         // log keys waiting for dice to land

  // ---------- scene ----------
  // What shiny dice reflect: a dark room with a few bright softbox panels,
  // like a photo studio. The contrast is what makes gloss read as gloss.
  function studioEnvironment(r) {
    const env = new THREE.Scene();
    const room = new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16), new THREE.MeshBasicMaterial({ color: 0x17171c, side: THREE.BackSide }));
    env.add(room);
    const panel = (w, h, pos, strength) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(strength), side: THREE.DoubleSide }));
      m.position.set(...pos);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    panel(14, 8, [0, 16, 10], 2.2);    // above and behind the camera: what top faces reflect
    panel(4, 16, [-18, 8, 2], 3);      // tall strip on the left
    panel(6, 10, [16, 10, -8], 2.2);   // right back
    panel(20, 3, [0, 6, -20], 1.5);    // low strip at the far side, for rim glints
    const pmrem = new THREE.PMREMGenerator(r);
    const tex = pmrem.fromScene(env, 0.02).texture;
    pmrem.dispose();
    return tex;
  }

  function ensureScene() {
    if (renderer) return true;
    if (!window.THREE || !window.CANNON) return false;
    canvas = document.createElement('canvas');
    canvas.id = 'dice-tray';
    document.body.append(canvas);
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch (e) {
      console.warn('WebGL unavailable, 3D dice disabled', e);
      canvas.remove(); canvas = null;
      return false;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));   // v6.20.0: 1.5 at most: sharp enough, far lighter on a big screen
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    scene = new THREE.Scene();
    scene.environment = studioEnvironment(renderer);
    camera = new THREE.PerspectiveCamera(38, 1, 0.5, 400);
    // Lighting is deliberately uneven (strong key from one side, weak fill,
    // little ambient): flat even light makes every finish look the same.
    scene.add(new THREE.AmbientLight(0xffffff, 0.12));
    scene.add(new THREE.HemisphereLight(0xffffff, 0x303038, 0.55));
    light = new THREE.DirectionalLight(0xffffff, 2.6);
    light.position.set(-26, 15, 8);     // low and to the side, so its highlight doesn't glare off top faces
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);   // v6.20.0: was 2048; the shadows look the same at dice size
    light.shadow.radius = 4;
    scene.add(light);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(12, 8, -6);
    scene.add(fill);
    glint = new THREE.PointLight(0xffffff, 0, 0, 0);
    scene.add(glint);
    floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.32 }));
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);
    /* v6.14.0: the table under the dice (forest floor, flat rock, a Twoleg table, snow), shaped as a tray if asked */
    surfaceMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ transparent: true, opacity: 0, roughness: 0.95, metalness: 0, depthWrite: false }));
    surfaceMesh.rotation.x = -Math.PI / 2; surfaceMesh.position.y = -0.02; surfaceMesh.renderOrder = -1; surfaceMesh.visible = false;
    scene.add(surfaceMesh);
    window.addEventListener('resize', () => { if (throws.size) layout(); });
    return true;
  }

  /* v6.1.0: the dice landed in their own lane (the Dice panel, the story log...).
     v6.20.0: the whole window, always: the Dice tray window is the place for a lane of their own. In the tray window
     itself the bar along its top stays clear (it's the page's .top). */
  function laneRect() {
    /* Clack Attack: the dice land inside the tray area of the window (the roll bar and log sit beside it). */
    const area = window.CLACK_ATTACK ? document.querySelector('.tray-area') : null;
    if (area) {
      const r = area.getBoundingClientRect(), drawer = document.querySelector('.look-drawer');   // the Dice look drawer open: the dice keep to what it leaves clear
      const dr = drawer && drawer.getBoundingClientRect();   // velmarox.com: a drawer below the tray (phones) leaves it whole
      const w = dr && dr.top < r.bottom - 40 ? Math.min(r.width, dr.left - r.left) : r.width;
      return { left: r.left, top: Math.max(1, r.top), width: Math.max(160, w), height: Math.max(120, r.height) };
    }
    const head = window.DICE_POPOUT ? document.querySelector('.top') : null, top = head ? head.getBoundingClientRect().bottom : 0;
    return { left: 0, top, width: window.innerWidth, height: Math.max(120, window.innerHeight - top) };
  }
  RP.diceLane = laneRect;

  // Fit the camera so dice are a sensible pixel size, and work out how much
  // floor is visible so the invisible walls sit exactly at the lane's edges.
  function layout() {
    const lane = laneRect();
    const w = Math.max(1, Math.round(lane.width)), h = Math.max(1, Math.round(lane.height));
    Object.assign(canvas.style, { left: Math.round(lane.left) + 'px', top: Math.round(lane.top) + 'px', width: w + 'px', height: h + 'px' });
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const pxPerUnit = 30 * (s.diceScale || 1) * Math.min(1, Math.max(0.6, Math.min(w, h) / 420));   // a narrow lane: smaller dice, room to tumble
    const visH = h / pxPerUnit;
    const tilt = 0.32;                                  // radians from straight down
    const dist = (visH / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.set(0, dist * Math.cos(tilt), dist * Math.sin(tilt));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();          // raycasts below need the new pose

    // Visible floor: cast the four screen corners onto y = 0, keep the inner box.
    const ray = new THREE.Raycaster(), hit = new THREE.Vector3();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    // Pull the walls in by about a die's width so a die resting against one is
    // still fully in the lane (the lane already sits below the title bar).
    const topNdc = lane.top > 0 ? 1 : 1 - 2 * ((document.querySelector('.menubar')?.offsetHeight || 0) + (document.querySelector('.top')?.offsetHeight || 0)) / h;
    const pts = [[-1, -1], [1, -1], [-1, topNdc], [1, topNdc]].map(([x, y]) => {
      ray.setFromCamera(new THREE.Vector2(x, y), camera);
      return ray.ray.intersectPlane(plane, hit) ? hit.clone() : new THREE.Vector3(x * 10, 0, -y * 10);
    });
    const halfW = Math.min(...pts.map(p => Math.abs(p.x))) - 1.3;
    const zs = pts.map(p => p.z);
    bounds = { w: halfW * 2, zMin: Math.max(...zs.filter(z => z < 0)) + 2.2, zMax: Math.min(...zs.filter(z => z > 0)) - 1.2 };
    bounds.d = bounds.zMax - bounds.zMin;
    /* v6.14.1: a themed tray needs room for its frame: the walls step in a little */
    const thm = s.diceTheme && s.diceTheme !== 'none' ? RP.TRAY_THEMES?.[s.diceTheme] : null;
    bounds.inset = !thm ? 0 : thm.frame   // Clack Attack v1.2.0: a painted tray's walls sit at its frame's inner edge
      ? Math.max(0.4, Math.min(bounds.d * 0.2, thm.frame * Math.min(bounds.w + 2.6, bounds.d + 3.4) - 1.25))
      : Math.min(1.1, bounds.d * 0.08);
    if (bounds.inset) { bounds.w -= 2 * bounds.inset; bounds.zMin += bounds.inset; bounds.zMax -= bounds.inset; bounds.d = bounds.zMax - bounds.zMin; }
    floorMesh.scale.set(bounds.w * 3, bounds.d * 3, 1);
    const sc = light.shadow.camera;
    sc.left = -bounds.w; sc.right = bounds.w; sc.top = bounds.d; sc.bottom = -bounds.d;
    sc.near = 1; sc.far = 80;
    sc.updateProjectionMatrix();
  }

  // ---------- sound ----------
  const clips = { hit: 'Table/Sounds/Die_Hit.wav', clatter: 'Table/Sounds/Dice_Clatter.wav' };
  const pools = {};
  let lastSound = 0;
  /* v6.14.0: how a set sounds on landing: pitch and weight by material, and a small ring for glass */
  const SURF = { wood: [0.8, 0.14, 0.95], stone: [0.6, 0.1, 1], glass: [1.32, 0.2, 0.8], bone: [1.12, 0.14, 0.9], tile: [1.0, 0.1, 1], '': [0.88, 0.28, 1] };
  let actx = null;
  function ping(strength) {
    try {
      actx ||= new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime, v = Math.min(0.12, 0.09 * strength * (s.diceVolume ?? 0.7));
      o.type = 'sine'; o.frequency.value = 2300 + Math.random() * 1400;
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.2);
    } catch { /* no Web Audio */ }
  }
  function playSound(name, strength, surface = '') {
    if (!s.diceSound) return;
    const now = performance.now();
    if (now - lastSound < 28) return;                 // don't stack dozens at once
    lastSound = now;
    const pool = (pools[name] ||= []);
    let a = pool.find(x => x.paused || x.ended);
    if (!a) {
      if (pool.length >= 8) return;
      a = new Audio(clips[name]);
      a.preservesPitch = false;
      pool.push(a);
    }
    const sf = SURF[surface] || SURF[''];
    a.volume = Math.max(0, Math.min(1, strength * sf[2] * (s.diceVolume ?? 0.7)));
    a.playbackRate = sf[0] + Math.random() * sf[1];
    a.currentTime = 0;
    a.play().catch(() => {});
    if (surface === 'glass' && strength > 0.25) ping(strength);
  }
  /** The set's sound: chosen, or worked out from its finish and skin. */
  function surfaceOf(style, finish) {
    if (style.surface && style.surface !== 'auto') return style.surface;
    if ((finish.bgAlpha ?? 1) < 1) return 'glass';
    if (finish.metalness > 0.5) return 'tile';
    if (style.skin === 'wood') return 'wood';
    if (style.skin === 'stone' || style.skin === 'marble' || (style.wear || 0) > 0.3) return 'stone';
    return '';
  }

  // ---------- simulation ----------
  // Everything the face textures need for one die in a given style.
  function lookFor(style, sides, finish, die) {
    const mix = style.mixed && style.mixed[sides];   // v6.14.0: a mixed set's own colour for this die type
    const color = mix && mix.c ? mix.c : style.multi ? shiftHue(style.color, MULTI_HUE[sides] ?? 0) : style.color;
    const topLabel = (die && die.set) || sides === 4 ? '' : String(sides), lowLabel = topLabel ? '1' : '';   // v6.20.0: the 1, for the low face's icon
    const extra = { color2: style.color2 || '', smoke: !!finish.smoke, gem: !!finish.gem, inclusion: style.inclusion || 'none', wear: +style.wear || 0, numStyle: style.numStyle || 'print', top: style.top || 'none', topIcon: style.topIcon || '', topLabel, low: style.low || 'none', lowIcon: style.lowIcon || '', lowLabel, clan: style.clan || '' };
    // No skin key until the skin image has loaded, so plain stand-in faces
    // aren't cached under the skin's name.
    const skinCanvas = RP.skins?.canvasFor(style);
    return {
      color, number: style.number, font: style.font, bgAlpha: finish.bgAlpha ?? 1,
      skinCanvas, skinKey: skinCanvas ? RP.skins?.keyFor(style) : '', tint: style.tint ?? 0.35,
      speckle: finish.glitter ? (style.glitter ?? 1) : 0,
      ...extra, sig: [extra.smoke ? extra.color2 : '', extra.gem, extra.inclusion, extra.wear, extra.numStyle, extra.top, extra.top === 'clan' ? extra.clan : '', extra.topLabel, extra.low, extra.low === 'clan' ? extra.clan : '', extra.lowLabel].join('|'),
    };
  }
  /** v6.14.0: a mixed set's own finish for this die type, or the set's. */
  const finishOf = (style, sides) => { const mix = style.mixed && style.mixed[sides]; return RP.diceFinish(mix && mix.f ? mix.f : style.finish); };

  // amount: glitter strength (0.2 = a hint, 1 = normal, 2 = maximum sparkle)
  function makeMaterial(map, finish, base, amount = 1) {
    const m = new THREE.MeshPhysicalMaterial({
      map, transparent: true, opacity: base,
      roughness: finish.roughness, metalness: finish.metalness, envMapIntensity: (finish.env ?? 1) * (finish.glitter ? 0.55 + 0.45 * amount : 1),
      clearcoat: finish.clearcoat || 0, clearcoatRoughness: finish.clearcoatRoughness ?? 0.08,
      sheen: finish.sheen || 0, sheenRoughness: finish.sheenRoughness ?? 0.5, sheenColor: new THREE.Color(0xffffff),
      iridescence: finish.iridescence || 0, iridescenceIOR: 1.35,
      depthWrite: finish.bgAlpha === undefined,
    });
    if (finish.glitter) {
      // Every flake is tilted and shiny on its own, so they glint as the die turns.
      const gm = RP.skins.glitterMaps();
      const tilt = 0.4 + 0.9 * amount;
      m.normalMap = gm.normal; m.normalScale = new THREE.Vector2(tilt, tilt);
      m.roughnessMap = gm.orm; m.metalnessMap = gm.orm;
      m.onBeforeCompile = shader => {
        shader.uniforms.uTime = GLITTER_TIME;
        shader.uniforms.uTwinkle = { value: gm.twinkle };
        shader.uniforms.uAmount = { value: amount };
        shader.fragmentShader = 'uniform float uTime;\nuniform sampler2D uTwinkle;\nuniform float uAmount;\n' + shader.fragmentShader.replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          #ifdef USE_MAP
            vec4 tw = texture2D(uTwinkle, vMapUv);
            // more glitter = more flakes flashing, and brighter
            float flash = pow(0.5 + 0.5 * sin(uTime * 2.6 + tw.g * 40.0), 22.0 - 8.0 * uAmount) * tw.r * uAmount;
            totalEmissiveRadiance += flash * mix(vec3(1.0), diffuseColor.rgb, 0.25) * 3.0;
          #endif`);
      };
      m.customProgramCacheKey = () => 'glitter-twinkle';
    }
    m.userData.base = base;
    return m;
  }

  function expandDice(list, style = {}) {
    // d100 is either a tens die plus a units die, or the sphere.
    const out = [];
    for (const d of list) {
      if (out.length >= MAX_DICE) break;
      if (d.sides === 100 && style.d100 === 'sphere') {
        out.push({ sides: 100, label: String(d.value), dim: d.kept === false });
      } else if (d.sides === 100) {
        if (out.length + 2 > MAX_DICE) break;            // never show half a percentile pair
        const v = d.value % 100;
        const dim = d.kept === false;
        out.push({ sides: 10, label: String(Math.floor(v / 10) * 10).padStart(2, '0'), set: 'tens', dim });
        out.push({ sides: 10, label: String(v % 10), set: 'units', dim });
      } else if (RP.canRender3D(d.sides)) {
        out.push({ sides: d.sides, label: String(d.value), dim: d.kept === false });
      }
    }
    return out.slice(0, MAX_DICE);
  }

  function defaultLabels(die) {
    if (die.set === 'tens') return Array.from({ length: 10 }, (_, i) => String(i * 10).padStart(2, '0'));
    if (die.set === 'units') return Array.from({ length: 10 }, (_, i) => String(i));
    const count = die.sides === 4 ? 4 : die.sides;
    return Array.from({ length: count }, (_, i) => String(i + 1));
  }

  const rand = (a, b) => a + Math.random() * (b - a);

  // Collision groups. The d100's 100-faced shape only touches the table and
  // walls (cheap: points against flat planes). For bumping into other dice it
  // uses a ball that fits exactly inside it. 100 faces against 100 faces was
  // what made several d100s freeze the app.
  const G_TABLE = 1, G_DIE = 2, G_BIG = 4;
  const inRadius = shape => (shape.inR ??= Math.min(...shape.faces.map((f, i) => {
    const v = shape.verts[f[0]], n = shape.normals[i];
    return v[0] * n[0] + v[1] * n[1] + v[2] * n[2];
  })));

  function simulate(dice, forceFrom = null) {
    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -60, 0) });
    world.allowSleep = true;
    world.broadphase = new CANNON.NaiveBroadphase();
    world.solver.iterations = 14;
    const dieMat = new CANNON.Material('die'), tableMat = new CANNON.Material('table'), wallMat = new CANNON.Material('wall');
    const bounce = s.diceBounce ?? 1;
    const rest = r => Math.min(0.92, r * bounce);
    world.addContactMaterial(new CANNON.ContactMaterial(dieMat, tableMat, { friction: 0.35, restitution: rest(0.38) }));
    world.addContactMaterial(new CANNON.ContactMaterial(dieMat, dieMat, { friction: 0.2, restitution: rest(0.5) }));
    world.addContactMaterial(new CANNON.ContactMaterial(dieMat, wallMat, { friction: 0.05, restitution: rest(0.6) }));

    const addPlane = (mat, pos, axis, angle) => {
      const plane = new CANNON.Plane();
      plane.collisionFilterGroup = G_TABLE; plane.collisionFilterMask = G_DIE | G_BIG;
      const b = new CANNON.Body({ mass: 0, material: mat, shape: plane });
      b.position.set(...pos);
      if (axis) b.quaternion.setFromAxisAngle(new CANNON.Vec3(...axis), angle);
      b.userData = { kind: mat === tableMat ? 'table' : 'wall' };
      world.addBody(b);
    };
    addPlane(tableMat, [0, 0, 0], [1, 0, 0], -Math.PI / 2);
    const hw = bounds.w / 2;
    addPlane(wallMat, [-hw, 0, 0], [0, 1, 0], Math.PI / 2);
    addPlane(wallMat, [hw, 0, 0], [0, 1, 0], -Math.PI / 2);
    addPlane(wallMat, [0, 0, bounds.zMin], null, 0);
    addPlane(wallMat, [0, 0, bounds.zMax], [0, 1, 0], Math.PI);

    // Throw from one edge, fanned out, towards the middle.
    let from = forceFrom || s.diceFrom || 'random';
    if (from === 'random') from = ['left', 'right', 'left', 'right', 'bottom'][Math.floor(Math.random() * 5)];
    const alongX = from === 'left' || from === 'right';
    const dir = from === 'left' || from === 'top' ? 1 : -1;     // +x = rightwards, +z = towards the viewer
    const zMid = (bounds.zMin + bounds.zMax) / 2;
    const hd = bounds.d / 2;
    const spread = alongX ? Math.min(bounds.d * 0.6, 1.4 * dice.length + 1) : Math.min(bounds.w * 0.5, 1.6 * dice.length + 1);
    const strength = s.diceStrength ?? 1;
    const events = [];
    const bodies = dice.map((die, i) => {
      const shape = RP.dieShape(die.sides);
      // The d100 is nearly round, so it gets extra drag to roll to a stop.
      const big = die.sides === 100;
      const body = new CANNON.Body({
        mass: big ? 2 : 1, material: dieMat,
        linearDamping: big ? 0.3 : 0.12, angularDamping: big ? 0.45 : 0.12,
        sleepSpeedLimit: 0.25, sleepTimeLimit: 0.25,
      });
      if (big) {
        const poly = RP.dieBodyShape(shape);
        poly.collisionFilterGroup = G_BIG; poly.collisionFilterMask = G_TABLE;
        const ball = new CANNON.Sphere(inRadius(shape));
        ball.collisionFilterGroup = G_DIE; ball.collisionFilterMask = G_DIE;
        body.addShape(poly);
        body.addShape(ball);
      } else {
        const poly = RP.dieBodyShape(shape);
        poly.collisionFilterGroup = G_DIE; poly.collisionFilterMask = G_TABLE | G_DIE;
        body.addShape(poly);
      }
      const row = dice.length === 1 ? 0 : (i / (dice.length - 1) - 0.5);
      body.quaternion.setFromEuler(rand(0, 6.3), rand(0, 6.3), rand(0, 6.3));
      const spin = 22 * Math.sqrt(strength);
      body.angularVelocity.set(rand(-spin, spin), rand(-spin, spin), rand(-spin, spin));
      if (alongX) {
        body.position.set(dir * -(hw - 2.2) + rand(-0.6, 0.6), rand(3, 6), zMid + row * spread + rand(-0.4, 0.4));
        const speed = Math.min(hw * 1.7, 26) * strength * rand(0.8, 1.15);
        body.velocity.set(dir * speed, rand(-3, 2), rand(-4, 4));
      } else {
        body.position.set(row * spread + rand(-0.4, 0.4), rand(3, 6), zMid - dir * (hd - 2.2) + rand(-0.5, 0.5));
        const speed = Math.min(hd * 1.9, 24) * strength * rand(0.8, 1.15);
        body.velocity.set(rand(-4, 4), rand(-3, 2), dir * speed);
      }
      body.userData = { kind: 'die', index: i };
      body.addEventListener('collide', e => {
        const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
        if (v < 1.2) return;
        const other = e.body.userData?.kind;
        if (other === 'die' && e.body.userData.index < i) return;   // count each pair once
        events.push({ frame: world.stepnumber, v, other, i });
      });
      world.addBody(body);
      return { body, shape };
    });

    const frames = [];
    let calmFrames = 0, settled = false;
    for (let f = 0; f < MAX_SIM; f++) {
      world.step(STEP);
      frames.push(bodies.map(({ body: b }) => [b.position.x, b.position.y, b.position.z, b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w]));
      const calm = bodies.every(({ body: b }) => b.sleepState === CANNON.Body.SLEEPING || (b.velocity.length() < 0.05 && b.angularVelocity.length() < 0.05));
      calmFrames = calm ? calmFrames + 1 : 0;
      if (calmFrames > 12) { settled = true; break; }
    }

    // Which face (or, for a d4, which corner) ended up on top? A die that
    // came to rest leaning on another die or a wall has no clear top face;
    // those count as bad and the caller throws again.
    let bad = settled ? 0 : dice.length;
    const up = bodies.map(({ body, shape }, i) => {
      const q = new THREE.Quaternion(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);
      const ns = shape.normals.map(n => new THREE.Vector3(...n).applyQuaternion(q));
      const ys = ns.map(n => n.y);
      const bottom = ys.indexOf(Math.min(...ys));
      if (shape.sides === 4) {
        if (ys[bottom] > -FLAT) bad++;
        return [0, 1, 2, 3].find(v => !shape.faces[bottom].includes(v));
      }
      if (shape.sides === 100) {
        // The Sphere's faces don't come in opposite pairs, so no face is ever
        // exactly level on top. Take the face pointing most at the viewer and
        // roll it the last few degrees to face them square as the die stops.
        const p = body.position;
        const toCam = camera.position.clone().sub(new THREE.Vector3(p.x, p.y, p.z)).normalize();
        const best = ns.reduce((bi, n, fi) => (n.dot(toCam) > ns[bi].dot(toCam) ? fi : bi), 0);
        settleFacing(frames, i, ns[best], toCam);
        return best;
      }
      const top = ys.indexOf(Math.max(...ys));
      if (ys[top] < FLAT) bad++;
      return top;
    });
    frames.from = from;
    return { frames, events, up, bad };
  }

  const FLAT = 0.985;                // cos of ~10°: a resting face is within this of level
  const SETTLE_FRAMES = 45;

  // Blend a small extra turn into one die's last moving frames so `from`
  // (a face normal) ends up pointing exactly along `to`. Rotates about the
  // die's centre, so a nearly round die just looks like it rolled a touch further.
  function settleFacing(frames, i, from, to) {
    const fix = new THREE.Quaternion().setFromUnitVectors(from, to);
    const id = new THREE.Quaternion(), step = new THREE.Quaternion(), q = new THREE.Quaternion();
    const end = Math.max(1, frames.length - 12), start = Math.max(0, end - SETTLE_FRAMES);
    for (let f = start; f < frames.length; f++) {
      const t = Math.min(1, (f - start + 1) / (end - start));
      step.slerpQuaternions(id, fix, t * t * (3 - 2 * t));
      const p = frames[f][i];
      q.set(p[3], p[4], p[5], p[6]).premultiply(step);
      frames[f][i] = [p[0], p[1], p[2], q.x, q.y, q.z, q.w];
    }
  }

  // Run the throw again (new random start) until every die lands cleanly
  // flat. Keeps the cleanest attempt if none is perfect.
  function simulateClean(dice, forceFrom) {
    let best = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      const r = simulate(dice, forceFrom);
      r.attempts = attempt + 1;
      if (!best || r.bad < best.bad) best = r;
      if (!r.bad) break;
    }
    return best;
  }

  // How far to turn the number on the result face so it reads upright on
  // screen, given where the die finally rests.
  function uprightRotation(shape, fi, last) {
    const L = RP.faceLayout(shape, fi);
    const q = new THREE.Quaternion(last[3], last[4], last[5], last[6]);
    const pos = new THREE.Vector3(last[0], last[1], last[2]);
    const centre = new THREE.Vector3(...L.c).applyQuaternion(q).add(pos);
    const onScreen = v => v.clone().project(camera);
    const c0 = onScreen(centre);
    const sx = onScreen(centre.clone().add(new THREE.Vector3(...L.right).applyQuaternion(q).multiplyScalar(0.2))).sub(c0);
    const sy = onScreen(centre.clone().add(new THREE.Vector3(...L.upv).applyQuaternion(q).multiplyScalar(0.2))).sub(c0);
    sx.x *= camera.aspect; sy.x *= camera.aspect;          // NDC x is squashed by the window shape
    // Face direction (a, b) that lands on screen-up: solve a*sx + b*sy = (0, 1).
    const det = sx.x * sy.y - sy.x * sx.y;
    if (Math.abs(det) < 1e-9) return 0;
    const a = -sy.x / det, b = sx.x / det;
    return Math.atan2(a, b);
  }

  // A band just inside the edge of one face, lifted a hair off the surface.
  // Starts invisible; playback fades it in when the dice land.
  function resultRing(shape, fi, color) {
    const f = shape.faces[fi];
    const n = new THREE.Vector3(...shape.normals[fi]);
    const pts = f.map(i => new THREE.Vector3(...shape.verts[i]));
    const c = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / pts.length);
    const lift = n.clone().multiplyScalar(0.012 * shape.verts.reduce((m, v) => Math.max(m, Math.hypot(...v)), 0));
    const outer = pts.map(p => p.clone().lerp(c, 0.02).add(lift));
    const inner = pts.map(p => p.clone().lerp(c, shape.sides === 100 ? 0.14 : 0.2).add(lift));
    const pos = [];
    for (let k = 0; k < f.length; k++) {
      const k2 = (k + 1) % f.length;
      pos.push(...outer[k].toArray(), ...outer[k2].toArray(), ...inner[k2].toArray(),
        ...outer[k].toArray(), ...inner[k2].toArray(), ...inner[k].toArray());
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    m.userData.base = 0.95;
    const ring = new THREE.Mesh(g, m);
    ring.renderOrder = 2;
    return ring;
  }

  // ---------- v6.14.0: effects (a critical flare, a trail, a landing puff) and the table ----------
  const fxTex = {};
  function glowTex() {   // a soft round light, nothing sharp
    if (fxTex.glow) return fxTex.glow;
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.35, 'rgba(255,255,255,0.45)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    return (fxTex.glow = new THREE.CanvasTexture(c));
  }
  function leafTex() {
    if (fxTex.leaf) return fxTex.leaf;
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    g.translate(32, 32); g.beginPath(); g.moveTo(0, -26); g.bezierCurveTo(18, -16, 16, 14, 0, 26); g.bezierCurveTo(-16, 14, -18, -16, 0, -26); g.fillStyle = '#ffffff'; g.fill();
    return (fxTex.leaf = new THREE.CanvasTexture(c));
  }
  const TRAIL = { moonlight: ['#cfe0ff', 0.32, 0.9, 0.5], embers: ['#ff9a4a', 0.4, 0.55, 0.45], mist: ['#e6e6e6', 0.18, 1.6, 0.7] };
  const LEAF_COLS = ['#a0642c', '#c08a3a', '#7d6a2c', '#8f4a24'];
  function seasonPuff() { const se = String(RP.codex?.season?.() || '').toLowerCase(); return se.includes('bare') ? 'snow' : se.includes('fall') ? 'leaves' : 'dust'; }
  function spawn(a, o) {
    if (a.fx.length > 260) return;
    const m = new THREE.SpriteMaterial({ map: o.tex || glowTex(), color: new THREE.Color(o.color || '#ffffff'), transparent: true, opacity: o.op, depthWrite: false, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending, rotation: o.rot || 0 });
    const sp = new THREE.Sprite(m); sp.position.set(o.x, o.y, o.z); sp.scale.setScalar(o.s0); sp.renderOrder = 3; scene.add(sp);
    a.fx.push(Object.assign({ sp, born: a.nowT ?? performance.now(), vx: 0, vy: 0, vz: 0, grav: 0, spin: 0 }, o));   // the frame's own clock
  }
  function puffAt(a, x, z) {
    const kind = a.puff === 'auto' ? seasonPuff() : a.puff;
    for (let k = 0; k < 11; k++) {
      const ang = Math.random() * Math.PI * 2, sp = 1.2 + Math.random() * 2.4;
      if (kind === 'leaves') spawn(a, { tex: leafTex(), color: LEAF_COLS[k % 4], op: 0.9, x, y: 0.3, z, s0: 0.55, s1: 0.5, life: 1.2, vx: Math.cos(ang) * sp, vz: Math.sin(ang) * sp, vy: 3 + Math.random() * 3, grav: 9, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 6 });
      else if (kind === 'snow') spawn(a, { color: '#f4f8ff', op: 0.75, x, y: 0.25, z, s0: 0.35, s1: 0.3, life: 1.0, vx: Math.cos(ang) * sp * 0.8, vz: Math.sin(ang) * sp * 0.8, vy: 2.5 + Math.random() * 2, grav: 5 });
      else spawn(a, { color: '#b9ad9a', op: 0.32, x, y: 0.2, z, s0: 0.6, s1: 2.4, life: 0.8, vx: Math.cos(ang) * sp * 0.5, vz: Math.sin(ang) * sp * 0.5, vy: 0.6 });
    }
  }
  function stepFx(a, now) {
    const dt = Math.min(0.05, (now - (a.lastNow || now)) / 1000); a.lastNow = now;
    a.fx = a.fx.filter((f) => {
      const p = (now - f.born) / 1000 / f.life;
      if (p >= 1) { scene.remove(f.sp); f.sp.material.dispose(); return false; }
      f.vy -= f.grav * dt; f.sp.position.x += f.vx * dt; f.sp.position.y = Math.max(0.05, f.sp.position.y + f.vy * dt); f.sp.position.z += f.vz * dt;
      f.sp.scale.setScalar(f.s0 + (f.s1 - f.s0) * p); f.sp.material.opacity = f.op * (f.peak ? Math.sin(Math.PI * Math.min(1, p * 1.15)) : 1 - p);
      if (f.spin) f.sp.material.rotation += f.spin * dt;
      return true;
    });
  }
  const isCrit = (die) => !die.dim && ((die.sides === 20 && (die.label === '20' || die.label === '1')) || (die.sides === 100 && !die.set && (die.label === '100' || die.label === '1')));

  /* the table: a canvas painted with the surface, cut to the tray's shape, laid under the dice for the throw */
  const surfCache = new Map();
  function surfaceKind() {
    const k = s.diceTable || 'none'; if (k !== 'auto') return k;
    const se = String(RP.codex?.season?.() || '').toLowerCase();
    return se.includes('bare') ? 'snow' : se.includes('fall') ? 'forest' : 'moss';
  }
  function paintSurface(g, W, H, kind) {
    let seed = 9001; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const BASE = { forest: '#3b2f22', rock: '#6f6a64', wood: '#8a5d36', snow: '#e8eef6', moss: '#3d4a2a' };
    g.fillStyle = BASE[kind] || '#555'; g.fillRect(0, 0, W, H);
    if (kind === 'forest' || kind === 'moss') {
      for (let i = 0; i < 2600; i++) { g.strokeStyle = kind === 'moss' ? `rgba(${90 + rnd() * 50 | 0},${120 + rnd() * 50 | 0},${50 + rnd() * 30 | 0},${0.25 + rnd() * 0.3})` : `rgba(${100 + rnd() * 50 | 0},${70 + rnd() * 30 | 0},${35 + rnd() * 20 | 0},${0.35 + rnd() * 0.3})`; g.lineWidth = 1 + rnd() * 1.5; const x = rnd() * W, y = rnd() * H, a = rnd() * 6.3, l = 6 + rnd() * 16; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
      for (let i = 0; i < (kind === 'moss' ? 220 : 90); i++) { const x = rnd() * W, y = rnd() * H, r = 6 + rnd() * 14; g.save(); g.translate(x, y); g.rotate(rnd() * 6.3); g.beginPath(); g.ellipse(0, 0, r, r * 0.45, 0, 0, 6.3); g.fillStyle = kind === 'moss' ? (i % 2 ? '#5d7a35' : '#6f8f40') : ['#8a5a2b', '#a0702e', '#5d6a2c', '#6b4424'][i % 4]; g.globalAlpha = 0.85; g.fill(); g.restore(); }
    } else if (kind === 'rock') {
      for (let i = 0; i < 14000; i++) { const v = 70 + rnd() * 120 | 0; g.fillStyle = `rgba(${v},${v - 2},${v - 6},${0.15 + rnd() * 0.35})`; g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 3, 1 + rnd() * 3); }
      for (let i = 0; i < 8; i++) { const x = rnd() * W, y = rnd() * H, r = 80 + rnd() * 200, grd = g.createRadialGradient(x, y, 0, x, y, r); grd.addColorStop(0, 'rgba(40,38,36,0.22)'); grd.addColorStop(1, 'rgba(40,38,36,0)'); g.fillStyle = grd; g.fillRect(0, 0, W, H); }
      g.strokeStyle = 'rgba(35,33,30,0.5)'; for (let i = 0; i < 6; i++) { g.lineWidth = 0.6 + rnd(); g.beginPath(); let x = rnd() * W, y = rnd() * H; g.moveTo(x, y); for (let k = 0; k < 9; k++) { x += (rnd() - 0.5) * 70; y += (rnd() - 0.5) * 70; g.lineTo(x, y); } g.stroke(); }
    } else if (kind === 'wood') {
      const plank = H / 5;
      for (let r = 0; r < 5; r++) { g.fillStyle = r % 2 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.04)'; g.fillRect(0, r * plank, W, plank); g.fillStyle = 'rgba(40,24,10,0.55)'; g.fillRect(0, r * plank, W, 2);
        for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(60,35,15,${0.06 + rnd() * 0.14})`; g.fillRect(rnd() * W, r * plank + rnd() * plank, 20 + rnd() * 80, 1); } }
    } else if (kind === 'snow') {
      for (let i = 0; i < 10; i++) { const x = rnd() * W, y = rnd() * H, r = 100 + rnd() * 260, grd = g.createRadialGradient(x, y, 0, x, y, r); grd.addColorStop(0, 'rgba(170,190,220,0.25)'); grd.addColorStop(1, 'rgba(170,190,220,0)'); g.fillStyle = grd; g.fillRect(0, 0, W, H); }
      for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(200,212,230,${0.2 + rnd() * 0.3})`; g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 1 + rnd() * 2); }
    }
  }
  function trayPath(g, W, H, shape) {
    g.beginPath();
    if (shape === 'log') { const m = H * 0.08, r = (H - 2 * m) / 2; g.roundRect(W * 0.04, m, W * 0.92, H - 2 * m, r); }
    else if (shape === 'bowl') g.ellipse(W / 2, H / 2, W * 0.46, H * 0.44, 0, 0, 6.3);
    else if (shape === 'leaf') { g.moveTo(W * 0.03, H / 2); g.bezierCurveTo(W * 0.3, -H * 0.05, W * 0.7, -H * 0.05, W * 0.97, H / 2); g.bezierCurveTo(W * 0.7, H * 1.05, W * 0.3, H * 1.05, W * 0.03, H / 2); }
    else g.rect(0, 0, W, H);
  }
  function surfaceTexture(kind, shape, aspect) {
    const key = `${kind}|${shape}|${aspect.toFixed(2)}`; if (surfCache.has(key)) return surfCache.get(key);
    const W = 1024, H = Math.max(256, Math.min(1024, Math.round(W / aspect)));
    const base = document.createElement('canvas'); base.width = W; base.height = H; paintSurface(base.getContext('2d'), W, H, shape === 'leaf' ? 'leafy' : kind);
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    if (shape === 'leaf') {   // the dice land on a big leaf
      trayPath(g, W, H, 'leaf'); g.fillStyle = '#4f6b2c'; g.fill(); g.save(); g.clip();
      g.strokeStyle = 'rgba(30,45,15,0.55)'; g.lineWidth = 6; g.beginPath(); g.moveTo(W * 0.03, H / 2); g.lineTo(W * 0.97, H / 2); g.stroke();
      g.lineWidth = 3; for (let k = 1; k < 9; k++) { const x = W * (0.08 + k * 0.1); g.beginPath(); g.moveTo(x, H / 2); g.quadraticCurveTo(x + W * 0.05, H * 0.3, x + W * 0.1, H * 0.08); g.moveTo(x, H / 2); g.quadraticCurveTo(x + W * 0.05, H * 0.7, x + W * 0.1, H * 0.92); g.stroke(); }
      g.restore();
    } else {
      g.save(); trayPath(g, W, H, shape); g.clip(); g.drawImage(base, 0, 0); g.restore();
      if (shape === 'log' || shape === 'bowl') {   // the rim: bark round a log, stone round a bowl
        g.save(); trayPath(g, W, H, shape); g.lineWidth = H * 0.07; g.strokeStyle = shape === 'log' ? '#4a3524' : '#7c766e'; g.stroke();
        g.lineWidth = H * 0.018; g.strokeStyle = shape === 'log' ? 'rgba(25,15,8,0.6)' : 'rgba(40,38,35,0.5)'; g.setLineDash(shape === 'log' ? [H * 0.05, H * 0.03] : []); g.stroke(); g.restore();
      } else {   // a plain table fades out at its edges
        const fade = document.createElement('canvas'); fade.width = W; fade.height = H; const fg = fade.getContext('2d'), e = Math.min(W, H) * 0.08;
        fg.fillStyle = '#000'; fg.fillRect(e, e, W - 2 * e, H - 2 * e); fg.filter = `blur(${e / 2}px)`; fg.drawImage(fade, 0, 0);
        g.globalCompositeOperation = 'destination-in'; g.drawImage(fade, 0, 0); g.globalCompositeOperation = 'source-over';
      }
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    surfCache.set(key, t); if (surfCache.size > 12) { const k0 = surfCache.keys().next().value; surfCache.get(k0).dispose(); surfCache.delete(k0); }
    return t;
  }

  // ---------- playback ----------
  function clearThrow(t) {
    if (!t || !throws.has(t.owner) || throws.get(t.owner) !== t) return;
    (t.fx || []).forEach((f) => { scene.remove(f.sp); f.sp.material.dispose(); }); t.fx = [];
    t.meshes.forEach(m => {
      scene.remove(m);
      m.userData.mats.forEach(x => { if (x.map?.userData.oneOff) x.map.dispose(); x.dispose(); });
      m.userData.geos?.forEach(g => g.dispose());
    });
    t.keys.forEach(k => settle(k));
    throws.delete(t.owner);
  }
  const clearAll = () => [...throws.values()].forEach(clearThrow);

  function settle(key) {
    if (key && pending.delete(key)) RP.emit('dice:settled', key);
  }

  function frame(now) {
    if (!throws.size) { raf = 0; canvas.style.display = 'none'; return; }
    let glitterAmt = 0;
    for (const a of [...throws.values()]) { advance(a, now); if (a.glitter) glitterAmt = Math.max(glitterAmt, a.glitter); }
    GLITTER_TIME.value = now / 1000;
    if (glitterAmt) {
      const w = now / 1000;
      glint.position.set(Math.cos(w * 1.3) * 14, 18 + Math.sin(w * 0.7) * 4, Math.sin(w * 1.1) * 10);
      glint.intensity = 1.2 * glitterAmt + 0.4;
    } else glint.intensity = 0;
    if (surfaceMesh.visible) surfaceMesh.material.opacity = Math.max(0, ...[...throws.values()].map((a) => a.alpha ?? 0)) * 0.96;   // v6.14.0
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  // Move one throw's dice to where they are at time `now`.
  function advance(a, now) {
    a.nowT = now;
    // rAF timestamps can be slightly earlier than the throw's start time.
    const t = Math.max(0, (now - a.start) / 1000) * a.speed;
    const fi = Math.min(a.frames.length - 1, Math.floor(t / STEP));
    const fr = a.frames[fi];
    const prev = a.frames[Math.max(0, fi - 2)];
    a.meshes.forEach((m, i) => {
      const p = fr[i];
      m.position.set(p[0], p[1], p[2]);
      m.quaternion.set(p[3], p[4], p[5], p[6]);
      /* v6.14.0: a faint trail behind a moving die */
      const tr = a.trail && TRAIL[a.trail];
      if (tr && !a.landed && Math.hypot(p[0] - prev[i][0], p[1] - prev[i][1], p[2] - prev[i][2]) > 0.08) spawn(a, { color: tr[0], op: tr[1], x: p[0], y: p[1], z: p[2], s0: tr[2], s1: tr[2] * 0.6, life: tr[3] });
    });
    while (a.nextEvent < a.events.length && a.events[a.nextEvent].frame <= fi) {
      const e = a.events[a.nextEvent++];
      const strength = Math.min(1, e.v / 14);
      if (e.other === 'die') playSound('clatter', strength * 0.9, a.surface);
      else playSound(a.meshes.length > 1 && e.frame < 40 ? 'clatter' : 'hit', e.other === 'wall' ? strength * 0.6 : strength, a.surface);
      /* v6.14.0: a puff where a die first hits the table */
      if (e.other === 'table' && a.puff && a.puff !== 'none' && e.v > 3 && !a.puffed.has(e.i) && a.meshes[e.i]) { a.puffed.add(e.i); const q = a.meshes[e.i].position; puffAt(a, q.x, q.z); }
    }
    const doneAt = a.frames.length * STEP;
    if (t >= doneAt && !a.landed) {
      a.landed = true;
      a.keys.forEach(k => settle(k));
      a.onLand?.();
      /* v6.14.0: a natural 20 or 1 (or 100 or 1 on the Sphere): a soft flare of light rising from the die */
      if (a.crit) a.dice.forEach((die, i) => { if (!isCrit(die)) return; const q = a.meshes[i].position, hi = die.label !== '1';
        spawn(a, { color: a.critColor, op: hi ? 0.75 : 0.5, x: q.x, y: q.y + 0.6, z: q.z, s0: 1, s1: hi ? 9 : 5.5, life: hi ? 1.3 : 1, add: true, peak: true }); });
    }
    stepFx(a, now);
    a.alpha = Math.min(1, t / (0.25 * a.speed));
    // Linger and fade run in real seconds, whatever the playback speed.
    const linger = (s.diceLinger ?? 2.5) * a.speed;
    const fadeStart = doneAt + linger;
    if (a.rings.length && t <= fadeStart) {
      const appear = a.landed ? Math.min(1, (t - doneAt) / (0.3 * a.speed)) : 0;
      a.rings.forEach(m => { m.opacity = appear * m.userData.base; });
      a.glows.forEach(m => m.emissive.setScalar(appear * 0.13));
    }
    if (t > fadeStart) {
      const o = Math.max(0, 1 - (t - fadeStart) / (0.6 * a.speed));
      a.alpha = o;
      a.meshes.forEach(m => m.userData.mats.forEach(x => { x.opacity = o * x.userData.base; }));
      if (o <= 0) clearThrow(a);
    }
  }

  /**
   * throw(dice, { style, key, onLand, owner })
   *   dice: [{ sides, value, kept }] from RP.roll (or a log entry)
   *   key: log entry to keep hidden until the dice land
   *   owner: 'me' (default) or 'partner'; a throw only replaces its own owner's dice
   * Returns false when nothing could be shown (then nothing is pending).
   */
  function throwDice(list, opts = {}) {
    if (!s.dice3d || RP.calm() || !list?.length) return false;   // v5.10.0: no 3D dice while motion is reduced
    const style = { ...RP.myDiceStyle(), ...(opts.style || {}) };
    if (opts.color && !opts.style) style.color = opts.color;
    /* v6.20.0: the Dice tray window is open: the throw lands there, and this page does no 3D work */
    if (RP.dicePop?.alive?.()) { RP.dicePop.send(list, opts, style).forEach((k) => pending.add(k)); return true; }
    const dice = expandDice(list, style);
    if (!dice.length || !ensureScene()) return false;
    const owner = opts.owner || 'me';
    clearThrow(throws.get(owner));
    layout();

    // If the other player's dice are already rolling, come in from the other
    // side so the two throws don't pile into each other.
    const other = throws.get(owner === 'me' ? 'partner' : 'me');
    const { frames, events, up, bad, attempts } = simulateClean(dice, other && !other.landed ? (other.from === 'left' ? 'right' : 'left') : null);
    // For debug(): how squarely each result face ended up facing up (1 = exactly).
    const facing = (fi, i) => {
      const p = frames[frames.length - 1][i], sh = RP.dieShape(dice[i].sides);
      if (sh.sides === 4) return null;
      const n = new THREE.Vector3(...sh.normals[fi]).applyQuaternion(new THREE.Quaternion(p[3], p[4], p[5], p[6]));
      return +(sh.sides === 100 ? n.dot(camera.position.clone().sub(new THREE.Vector3(p[0], p[1], p[2])).normalize()) : n.y).toFixed(4);
    };
    lastSim = { attempts, bad, frames: frames.length, dice: up.map((fi, i) => ({ sides: dice[i].sides, label: dice[i].label, face: fi, facing: facing(fi, i) })) };
    const finish = RP.diceFinish(style.finish);
    renderer.shadowMap.enabled = !!s.diceShadows;
    floorMesh.visible = !!s.diceShadows;
    /* v6.14.0: the table under this throw (this device's own choice) */
    const sk = surfaceKind(), th = s.diceTheme && s.diceTheme !== 'none' && RP.TRAY_THEMES?.[s.diceTheme] ? s.diceTheme : '';
    if (th) {   // v6.14.1: a themed tray fills the lane's floor, its frame just outside the walls the dice bounce off
      const ins = bounds.inset || 0, vw = bounds.w + 2.6 + 2 * ins, vd = bounds.d + 3.4 + 2 * ins, Wp = 1024, Hp = Math.max(256, Math.min(1024, Math.round(Wp * vd / vw))), k = `theme|${th}|${Hp}|${ins.toFixed(2)}|${RP.trayPicsRev || 0}`;
      let tex = surfCache.get(k);
      if (!tex) { tex = new THREE.CanvasTexture(RP.paintTrayTheme(th, Wp, Hp, Math.round(Wp * (1.3 + ins) / vw), Math.round(Hp * (1.2 + ins) / vd))); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; surfCache.set(k, tex); }
      surfaceMesh.material.map = tex; surfaceMesh.material.needsUpdate = true;
      surfaceMesh.scale.set(vw, vd, 1); surfaceMesh.position.z = (bounds.zMin + bounds.zMax) / 2 - 0.5; surfaceMesh.visible = true;
    } else if (sk && sk !== 'none') {
      surfaceMesh.material.map = surfaceTexture(sk, s.diceTrayShape || 'plain', bounds.w / Math.max(1, bounds.d)); surfaceMesh.material.needsUpdate = true;
      surfaceMesh.scale.set(bounds.w + 2.4, bounds.d + 2.4, 1); surfaceMesh.position.z = (bounds.zMin + bounds.zMax) / 2; surfaceMesh.visible = true;
    } else surfaceMesh.visible = false;
    const last = frames[frames.length - 1];
    const rings = [], glows = [];
    const meshes = dice.map((die, i) => {
      const fin = finishOf(style, die.sides);   // v6.14.0: a mixed set's own finish per die type
      const look = lookFor(style, die.sides, fin, die);
      // Put the rolled number on whichever face/corner landed on top.
      const labels = defaultLabels(die);
      const want = labels.indexOf(die.label);
      if (want >= 0 && want !== up[i]) [labels[want], labels[up[i]]] = [labels[up[i]], labels[want]];
      const base = die.dim ? 0.5 : 1;
      const shape = RP.dieShape(die.sides);
      // ...turned so it reads the right way up from where you sit.
      const rot = shape.sides === 4 ? 0 : uprightRotation(shape, up[i], last[i]);
      const mats = shape.faces.map((_, fi) => {
        return makeMaterial(RP.faceTexture(shape, fi, labels, look, fi === up[i] ? rot : 0), fin, base, style.glitter ?? 1);
      });
      const mesh = new THREE.Mesh(RP.dieGeometry(shape), mats);
      mesh.castShadow = !!s.diceShadows;
      const allMats = [...mats];
      if (style.outline) {
        const edgeMat = new THREE.LineBasicMaterial({ color: style.number || RP.readableOn(look.color), transparent: true, opacity: 0.3 * base });
        edgeMat.userData.base = 0.3 * base;
        mesh.add(new THREE.LineSegments(shape.edges, edgeMat));
        allMats.push(edgeMat);
      }
      const geos = [];
      // d100 dice: frame the result face once they land, so there's no doubt which one counts.
      if (s.diceHighlight !== false && !die.dim && (die.sides === 100 || die.set)) {
        const ring = resultRing(shape, up[i], style.number || RP.readableOn(look.color));
        mesh.add(ring);
        rings.push(ring.material);
        glows.push(mats[up[i]]);            // and lift the face itself a little
        allMats.push(ring.material);
        geos.push(ring.geometry);
      }
      mesh.userData = { mats: allMats, dim: die.dim, geos };
      scene.add(mesh);
      return mesh;
    });

    const keys = opts.key ? [opts.key] : [];
    keys.forEach(k => { pending.add(k); setTimeout(() => settle(k), 30000); });   // a hidden page never draws: let the line show anyway
    throws.set(owner, { owner, meshes, frames, events, nextEvent: 0, start: performance.now(), keys, onLand: opts.onLand, landed: false,
      speed: s.diceSpeed || 1, glitter: finish.glitter ? (style.glitter ?? 1) : 0, from: frames.from, rings, glows,
      dice, fx: [], puffed: new Set(), trail: style.trail || 'none', puff: style.puff || 'none', crit: style.crit !== false, critColor: style.critColor || '#ffd27a', surface: surfaceOf(style, finish), alpha: 0 });
    canvas.style.display = 'block';
    if (!raf) raf = requestAnimationFrame(frame);
    return true;
  }

  // Shared with the d20 portraits (Dice_Portrait.js).
  RP.diceKit = { makeMaterial, lookFor, finishOf, studioEnvironment, FINISHES };

  RP.diceTray = {
    throw: throwDice,
    isPending: key => pending.has(key),
    // A roll the Codex is still rolling: its line waits ("is rolling…") until the dice are thrown, or let go.
    hold: key => { if (key && s.dice3d) { pending.add(key); setTimeout(() => settle(key), 30000); } },
    release: key => settle(key),
    clear: clearAll,
    snapshot: () => { if (!renderer) return ''; GLITTER_TIME.value = performance.now() / 1000; renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png'); },
    /* v6.14.0: for checks from dev tools: move every throw to ms after it started, and say what's on screen */
    stepTo: (ms) => [...throws.values()].map(a => { advance(a, a.start + ms); return { landed: a.landed, effects: a.fx.length, flares: a.fx.filter(f => f.peak).length, puffed: a.puffed.size, table: surfaceMesh?.visible ? +surfaceMesh.material.opacity.toFixed(2) : 0 }; }),
    // For troubleshooting from dev tools (F12): RP.diceTray.debug()
    debug: () => ({
      bounds, camera: camera?.position.toArray().map(n => +n.toFixed(2)),
      throws: [...throws.values()].map(t => ({ owner: t.owner, frames: t.frames.length, sounds: t.events.length, landed: t.landed, effects: (t.fx || []).length, flares: (t.fx || []).filter(f => f.peak).length, trail: t.trail, puff: t.puff, tableHits: t.events.filter(e => e.other === 'table').length })),
      lastSim,
    }),
  };

  // Set up WebGL (renderer, lighting, shaders) while idle, so the first roll
  // doesn't pause for it.
  setTimeout(() => (window.requestIdleCallback || setTimeout)(() => {
    if (s.dice3d && !RP.dicePop?.alive?.() && ensureScene()) { layout(); renderer.compile(scene, camera); }   // v6.20.0: not while the Dice tray window takes the throws
  }), 3000);

  // Tuck the dice away with Escape.
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && throws.size) clearAll(); });
})();
