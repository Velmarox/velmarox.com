// The 3D look: Contract Zero's low-poly room, guy, and creatures, plus his weapons. Sim x is
// three.js x, sim y is three.js z, and y is up. Reads the sim and never changes it.
// The characters (makeCharacter, animate, the skins) are Contract Zero's, with one addition:
// arms can reach for a point, which is how he holds things.

import * as THREE from '../../lib/three.module.js';
import { ROOM } from '../sim/tuning.js';
import { HOLD } from '../sim/world.js';
import { MODIFIERS } from '../content/enemies.js';
import { SKINS, RUNES, DEFAULT_SKIN } from '../content/loot.js';
import { guySkin, creatureSkin, LOOKS } from './skins.js';
import { loadGunModels, gunMesh } from './gunModels.js';
import { makeHat } from './hats.js';

const COLORS = {
  sky: 0xd9bcc8, floor: 0xdfc4ce, grid: 0xcbaab8, wall: 0x9a7a8c,
  hurt: 0xc2264b, ink: 0x4a3040, dark: 0x2b1f30, bone: 0xfff3e6, ice: 0x9ad8ff,
  gold: 0xf8c838, token: 0x38d8c8, brass: 0xd8a640, flash: 0xffc46a, tracer: 0xffe9a0, goo: 0x9bd04a,
  rock: 0x7d7088, blast: 0xff8a3a, zap: 0xcfe8ff, fire: 0xff7a1a, friendly: 0xe8a020, heal: 0x58d068,
};
const MAX_PARTICLES = 800;
const MAX_TRACERS = 400;
const MAX_COINS = 300;
const ARM_LENGTH = 0.22;

const css = (hex) => `#${hex.toString(16).padStart(6, '0')}`;
const ease = (t) => t * t * (3 - 2 * t);

export function createRenderer3d(canvas, overlay) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.sky);

  // Nearly overhead, leaning back just enough for the models to show their sides.
  const camera = new THREE.PerspectiveCamera(22, 1, 0.1, 600);
  const lookAt = new THREE.Vector3(ROOM.w / 2, 0, ROOM.h / 2 + 0.4);
  const viewDir = new THREE.Vector3(0, 1, 0.3).normalize();
  const cameraHome = new THREE.Vector3();
  const options = { shake: !window.matchMedia('(prefers-reduced-motion: reduce)').matches, numbers: true, focus: null };
  let shake = 0;

  scene.add(new THREE.HemisphereLight(0xfff1f1, 0x9a7fa8, 1.9));
  const sun = new THREE.DirectionalLight(0xfff1e0, 1.9);
  // Lit from the camera side, so the faces you see are bright and shadows fall away from you.
  sun.position.set(ROOM.w / 2 - 10, 30, ROOM.h / 2 + 12);
  sun.target.position.set(ROOM.w / 2, 0, ROOM.h / 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 18, bottom: -18, near: 1, far: 80 });
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);
  // One light that jumps when guns go off, so a volley lights the floor round him.
  const gunLight = new THREE.PointLight(COLORS.flash, 0, 7, 2);
  scene.add(gunLight);

  const flat = (color, extra) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0.05, ...extra });
  const glow = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: false });
  const additive = (color, map, opacity = 1) => new THREE.MeshBasicMaterial({ color, map, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  function solid(geometry, material, x = 0, y = 0, z = 0) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
  // A 1 by 1 patch lying on the floor, starting at the origin and running along +x.
  const floorPatch = () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0.5, 0, 0);
  const floorDisc = (r, segments = 28) => new THREE.CircleGeometry(r, segments).rotateX(-Math.PI / 2);
  const outline = (points, color) => new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(points.map(([x, z]) => new THREE.Vector3(x, 0.02, z))),
    new THREE.LineBasicMaterial({ color }),
  );

  // ----- the room that never changes -----
  const floor = solid(new THREE.PlaneGeometry(ROOM.w, ROOM.h).rotateX(-Math.PI / 2), flat(COLORS.floor), ROOM.w / 2, 0, ROOM.h / 2);
  floor.castShadow = false;
  scene.add(floor);
  const gridPoints = [];
  for (let x = 2; x < ROOM.w; x += 2) gridPoints.push(x, 0.01, 0, x, 0.01, ROOM.h);
  for (let z = 2; z < ROOM.h; z += 2) gridPoints.push(0, 0.01, z, ROOM.w, 0.01, z);
  const gridGeometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(gridPoints, 3));
  scene.add(new THREE.LineSegments(gridGeometry, new THREE.LineBasicMaterial({ color: COLORS.grid })));
  const wallMat = flat(COLORS.wall);
  const high = 1.3;
  // The wall nearest the camera is low so it never hides what is standing behind it.
  const low = 0.35;
  scene.add(
    solid(new THREE.BoxGeometry(ROOM.w + 2, high, 1), wallMat, ROOM.w / 2, high / 2, -0.5),
    solid(new THREE.BoxGeometry(ROOM.w + 2, low, 1), wallMat, ROOM.w / 2, low / 2, ROOM.h + 0.5),
    solid(new THREE.BoxGeometry(1, high, ROOM.h), wallMat, -0.5, high / 2, ROOM.h / 2),
    solid(new THREE.BoxGeometry(1, high, ROOM.h), wallMat, ROOM.w + 0.5, high / 2, ROOM.h / 2),
  );

  let arena = new THREE.Group();
  scene.add(arena);
  function buildArena(sim) {
    scene.remove(arena);
    arena = new THREE.Group();
    for (const b of sim.blocks) arena.add(solid(new THREE.BoxGeometry(b.hx * 2, 1.5, b.hy * 2), wallMat, b.x, 0.75, b.y));
    scene.add(arena);
  }

  // ----- characters: a skinned ball that bobs, legs that step, arms on springs -----
  // Everyone faces along +x. Faces are part of the skin; limbs, horns, and spikes are parts.
  const UP = new THREE.Vector3(0, 1, 0);
  // Loose springs: at play distance a tight arm reads as no movement at all.
  const ARM_SPRING = 85;
  const ARM_DAMPING = 4.5;

  // A faceted ball wearing a skin: one painted picture wrapped round it (see skins.js).
  // The ball is turned so the middle of the picture, where the face is, points along +x.
  function blob(radius, skin, extra) {
    const geometry = new THREE.IcosahedronGeometry(radius, 1).rotateY(Math.PI);
    return solid(geometry, flat(0xffffff, { ...skin, ...extra }));
  }

  // A point on a ball: turn is the angle round from straight ahead, rise the angle up from the middle.
  function onBall(radius, turn, rise) {
    return new THREE.Vector3(Math.cos(rise) * Math.cos(turn), Math.sin(rise), Math.cos(rise) * Math.sin(turn)).multiplyScalar(radius);
  }

  // Stand a part on the ball's surface, pointing straight out.
  function stud(mesh, centre, radius, turn, rise) {
    const out = onBall(1, turn, rise);
    mesh.position.copy(centre).addScaledVector(out, radius);
    mesh.quaternion.setFromUnitVectors(UP, out);
    return mesh;
  }

  // A white copy of a body over the body, shown for a moment when it's hit.
  const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });

  function makeCharacter({ r, skin, bodyExtra, limbColor, arm, leg, claws, decorate }) {
    const group = new THREE.Group();
    const inner = new THREE.Group();
    group.add(inner);
    const centre = new THREE.Vector3(0, r * 0.9 + leg.length - 0.12 * (r / 0.5), 0);
    const body = blob(r, skin, bodyExtra);
    body.position.copy(centre);
    body.scale.set(1, 0.92, 1);
    inner.add(body);
    const limb = flat(limbColor);
    const rig = { group, inner, body, centre, r, armLength: arm.length, size: r / 0.5, arms: [], legs: [], phase: 0, lastForward: 0, lunge: 0, lastFoot: 0, lift: 0 };
    for (const side of [-1, 1]) {
      // Each leg hangs from a hip so it can swing.
      const hip = new THREE.Group();
      hip.position.set(0, leg.length, side * r * leg.spread);
      hip.add(solid(new THREE.CylinderGeometry(leg.top, leg.bottom, leg.length, 5).translate(0, -leg.length / 2, 0), limb));
      inner.add(hip);
      rig.legs.push({ hip, side });

      // Each arm hangs from a shoulder on the body and is steered by a spring.
      const rest = onBall(1, side * arm.turn, arm.rise);
      const shoulder = new THREE.Group();
      shoulder.position.copy(centre).addScaledVector(rest, r * 0.9);
      shoulder.add(solid(new THREE.CylinderGeometry(arm.tip, arm.root, arm.length, 5).translate(0, arm.length / 2, 0), limb));
      if (claws) shoulder.add(solid(new THREE.ConeGeometry(0.07 * r / 0.85, 0.2 * r / 0.85, 4).translate(0, arm.length + 0.08 * r / 0.85, 0), flat(claws)));
      inner.add(shoulder);
      rig.arms.push({ shoulder, rest, side, swing: 0, lift: 0, swingSpeed: 0, liftSpeed: 0, turn: arm.turn, baseTurn: arm.turn, rise: arm.rise, stretch: 1 });
    }
    if (decorate) decorate(inner, centre, r);
    return rig;
  }

  const reachDir = new THREE.Vector3();
  const reachQuat = new THREE.Quaternion();

  // Moves one character for one frame. velocity is in metres a second; pose may give
  // arms(arm) -> { swing, lift } to wave them about, reach(arm) -> a point (in the
  // character's own space) for the arm to point at, shoulders (how far round the front the
  // shoulders sit), plus lean, sway, squash, and twist.
  function animate(rig, dt, velocity, facing, pose = {}) {
    const step = Math.min(dt, 1 / 30);
    const speed = Math.hypot(velocity.x, velocity.y);
    const forward = velocity.x * Math.cos(facing) + velocity.y * Math.sin(facing);
    const effort = Math.min(1, speed / 5);
    rig.phase += Math.min(speed * 2.2, 22) * step;
    const stride = Math.sin(rig.phase);

    // The run, played big enough to read from the play camera: a high bounce on every
    // footfall, squash on landing and stretch at the top, a waddle from side to side,
    // and a hard lean into it.
    rig.lunge *= Math.pow(0.001, step);
    const air = Math.abs(stride);
    const squash = (pose.squash ?? 0) + (0.5 - air) * 0.3 * effort - 0.3 * rig.lunge;
    rig.inner.position.y = air * 0.34 * effort * rig.size + rig.lunge * 0.25;
    rig.inner.scale.set(1 + squash * 0.6, 1 - squash, 1 + squash * 0.6);
    rig.inner.rotation.z = -0.38 * Math.max(-1, Math.min(1, forward / 7)) + (pose.lean ?? 0) - 0.7 * rig.lunge;
    rig.inner.rotation.x = (pose.sway ?? 0) + stride * 0.24 * effort;
    rig.inner.rotation.y += ((pose.twist ?? 0) - rig.inner.rotation.y) * Math.min(1, step * 18);
    for (const leg of rig.legs) leg.hip.rotation.z = leg.side * stride * 1.15 * effort;
    // A puff of dust each time a foot comes down.
    const foot = Math.floor(rig.phase / Math.PI);
    if (foot !== rig.lastFoot && effort > 0.4 && rig.size > 0.6) burst(rig.group.position.x, rig.group.position.z, 4, COLORS.grid, 2.2, 0.08);
    rig.lastFoot = foot;

    // Arms lag behind when the body speeds up and overshoot when it stops: that is the wobble.
    const push = step > 0 ? Math.max(-150, Math.min(150, (forward - rig.lastForward) / step)) : 0;
    rig.lastForward = forward;
    for (const arm of rig.arms) {
      // Shoulders slide round toward the front to hold something out in front.
      const turn = pose.shoulders ?? arm.baseTurn;
      if (Math.abs(turn - arm.turn) > 1e-3) {
        arm.turn += (turn - arm.turn) * Math.min(1, step * 14);
        arm.rest = onBall(1, arm.side * arm.turn, arm.rise);
        arm.shoulder.position.copy(rig.centre).addScaledVector(arm.rest, rig.r * 0.9);
      }
      const target = pose.reach && pose.reach(arm);
      if (target) {
        // Point straight at the target and stretch to it, the way a cartoon's little arms
        // do; past a point they stop stretching and just reach toward it.
        reachDir.copy(target).sub(arm.shoulder.position);
        const stretch = Math.min(2.1, Math.max(1, reachDir.length() / rig.armLength));
        reachQuat.setFromUnitVectors(UP, reachDir.normalize());
        arm.shoulder.quaternion.slerp(reachQuat, Math.min(1, step * 22));
        arm.stretch += (stretch - arm.stretch) * Math.min(1, step * 20);
        arm.shoulder.scale.set(1, arm.stretch, 1);
        arm.swing = arm.lift = arm.swingSpeed = arm.liftSpeed = 0;
        continue;
      }
      if (arm.stretch !== 1) {
        arm.stretch += (1 - arm.stretch) * Math.min(1, step * 20);
        if (Math.abs(arm.stretch - 1) < 0.01) arm.stretch = 1;
        arm.shoulder.scale.set(1, arm.stretch, 1);
      }
      const want = (pose.arms && pose.arms(arm)) || { swing: -arm.side * stride * 1.5 * effort, lift: air * 0.9 * effort };
      arm.swingSpeed += (ARM_SPRING * (want.swing - arm.swing) - ARM_DAMPING * arm.swingSpeed - push * 1.3) * step;
      arm.liftSpeed += (ARM_SPRING * (want.lift - arm.lift) - ARM_DAMPING * arm.liftSpeed) * step;
      arm.swing = Math.max(-3, Math.min(3, arm.swing + arm.swingSpeed * step));
      arm.lift = Math.max(-3, Math.min(3, arm.lift + arm.liftSpeed * step));
      const dir = arm.rest.clone();
      dir.x += arm.swing;
      dir.y += arm.lift;
      arm.shoulder.quaternion.setFromUnitVectors(UP, dir.normalize());
    }
  }

  // A sudden shove to both arms, for hits.
  function jolt(rig, swing, lift = 0) {
    if (!rig) return;
    for (const arm of rig.arms) { arm.swingSpeed += swing; arm.liftSpeed += lift; }
  }

  const skins = {};

  function makeGuy(skinId = DEFAULT_SKIN, extra = {}) {
    const look = SKINS[skinId] ?? SKINS[DEFAULT_SKIN];
    return makeCharacter({
      r: 0.5, skin: { ...guySkin(look), ...extra }, limbColor: look.limb,
      arm: { length: ARM_LENGTH, root: 0.12, tip: 0.08, turn: 1.45, rise: -0.25 },
      leg: { length: 0.3, top: 0.1, bottom: 0.06, spread: 0.4 },
    });
  }

  // Enemy types are told apart by size and colour (see LOOKS in skins.js).
  function makeCreature(e) {
    const look = LOOKS[e.kind];
    if (!skins[e.kind]) skins[e.kind] = creatureSkin(look);
    const r = e.r;
    return makeCharacter({
      r, skin: skins[e.kind], bodyExtra: { emissive: 0xffffff, emissiveIntensity: 1.2 },
      limbColor: look.limb, claws: look.spike,
      arm: { length: r * 0.34, root: r * 0.2, tip: r * 0.14, turn: 1.4, rise: -0.3 },
      leg: { length: r * 0.5, top: r * 0.19, bottom: r * 0.12, spread: 0.42 },
      decorate(inner, centre) {
        const spike = flat(look.spike);
        const cone = (w, h, material = spike) => solid(new THREE.ConeGeometry(w * r, h * r, 4), material);
        // Two horns up front, then spikes over the back and sides.
        for (const side of [-1, 1]) {
          inner.add(stud(cone(0.13, 0.42), centre, r * 1.12, side * 0.55, 1.05));
          inner.add(stud(cone(0.09, 0.28), centre, r * 1.07, side * 1.9, 0.75));
          inner.add(stud(cone(0.09, 0.28), centre, r * 1.07, side * 2.6, 0.3));
          inner.add(stud(cone(0.09, 0.28), centre, r * 1.07, side * 2.2, -0.15));
          inner.add(stud(cone(0.08, 0.24), centre, r * 1.06, side * 1.2, 0.95));
        }
        // The Shell's armour is a plate across the front: the side bullets bounce off.
        if (e.def.armour) {
          const plate = new THREE.SphereGeometry(r * 1.1, 8, 5, Math.PI - e.def.armour, e.def.armour * 2, 0.5, 2.0);
          const mesh = solid(plate, flat(look.spike, { metalness: 0.4, roughness: 0.4 }));
          mesh.position.copy(centre);
          mesh.scale.set(1, 0.92, 1);
          inner.add(mesh);
        }
        // Elite modifiers each add one visible part.
        if (e.mod === 'spiky') {
          const tip = flat(COLORS.bone);
          for (let i = 0; i < 10; i++) inner.add(stud(cone(0.1, 0.5, tip), centre, r * 1.2, (i / 10) * Math.PI * 2 + 0.3, 0.1));
        }
        if (e.mod === 'heavy') {
          const band = solid(new THREE.TorusGeometry(r * 0.98, r * 0.09, 4, 12).rotateX(Math.PI / 2), flat(0x3c3f4a, { metalness: 0.5 }));
          band.position.copy(centre);
          band.position.y -= r * 0.25;
          inner.add(band);
        }
        if (e.mod === 'splitting') {
          const seam = solid(new THREE.TorusGeometry(r * 0.97, r * 0.05, 4, 14).rotateY(Math.PI / 2), flat(COLORS.bone));
          seam.position.copy(centre);
          inner.add(seam);
        }
      },
    });
  }

  // ----- weapons -----
  let gunModels = null;
  const ready = loadGunModels().then((models) => { gunModels = models; });

  // The muzzle flash textures (greyscale on black, so they glow when added on top).
  const loader = new THREE.TextureLoader();
  const flashTex = (name) => { const t = loader.load(new URL(`../../models/flash/${name}.png`, import.meta.url).href); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const sideTex = [1, 2, 4].map((i) => flashTex(`flash_side_0${i}`));
  const frontTex = [1, 2, 3].map((i) => flashTex(`flash_front_0${i}`));
  const flashMats = new Map();
  // Flash materials in a colour: the usual orange, or the weapon's rune colour.
  function flashMaterial(set, i, color) {
    const key = `${set}${i}:${color}`;
    if (!flashMats.has(key)) flashMats.set(key, additive(color, (set === 's' ? sideTex : frontTex)[i]));
    return flashMats.get(key);
  }
  const sidePlane = new THREE.PlaneGeometry(1, 0.6).translate(0.5, 0, 0);
  const flatSide = sidePlane.clone().rotateX(-Math.PI / 2);
  const frontPlane = new THREE.PlaneGeometry(1, 1);

  function makeFlash() {
    const group = new THREE.Group();
    const lying = new THREE.Mesh(flatSide);
    const standing = new THREE.Mesh(sidePlane);
    const star = new THREE.Mesh(frontPlane.clone().rotateY(Math.PI / 2));
    const starTop = new THREE.Mesh(frontPlane.clone().rotateX(-Math.PI / 2));
    for (const m of [lying, standing, star, starTop]) { m.renderOrder = 5; group.add(m); }
    group.visible = false;
    group.userData = { lying, standing, star, starTop, life: 0 };
    return group;
  }

  // ----- the guy, his hat, and what he's holding -----
  let look = { skin: DEFAULT_SKIN, hat: null };
  let guyRig = makeGuy();
  let guyModel = guyRig.group;
  scene.add(guyModel);
  let hatMesh = null;
  // The held weapon: holder sits at the hand, model inside it is the weapon itself.
  let held = null;
  let heldKey = '';

  function wearHat() {
    if (hatMesh) hatMesh.parent?.remove(hatMesh);
    hatMesh = look.hat ? makeHat(look.hat) : null;
    if (hatMesh) {
      hatMesh.position.copy(guyRig.centre).add(new THREE.Vector3(-0.03, guyRig.r * 0.84, 0));
      hatMesh.rotation.z = 0.12;
      // A touch small, so from overhead it sits on him rather than hiding him.
      hatMesh.scale.setScalar(0.78);
      guyRig.inner.add(hatMesh);
    }
  }

  // Changes his skin or hat; the body is rebuilt for a new skin.
  function setLook(next) {
    const skinChanged = next.skin !== look.skin;
    look = { ...look, ...next };
    if (skinChanged) {
      const old = guyModel;
      guyRig = makeGuy(look.skin);
      guyModel = guyRig.group;
      guyModel.position.copy(old.position);
      scene.remove(old);
      scene.add(guyModel);
      heldKey = '';
    }
    wearHat();
  }

  function syncHeld(sim) {
    const w = sim.heldWeapon();
    const key = `${w.id}:${w.rune}:${guyModel.uuid}`;
    if (key === heldKey || !gunModels) return;
    heldKey = key;
    if (held) held.holder.parent?.remove(held.holder);
    const holder = new THREE.Group();
    const runeColor = w.rune ? RUNES[w.rune].color : null;
    const model = gunMesh(gunModels, w.id, runeColor);
    holder.add(model);
    const flash = makeFlash();
    flash.position.copy(model.userData.muzzle);
    model.add(flash);
    guyModel.add(holder);
    held = { id: w.id, holder, model, flash, color: runeColor ?? COLORS.flash, size: 0.45 + (w.stats.knock ?? 3) * 0.05, pellets: w.stats.pellets ?? 1, kick: 0, spin: 0, pop: 1, length: model.userData.length };
  }

  function fireFlash(sound) {
    if (!held) return;
    const f = held.flash.userData;
    const i = Math.floor(Math.random() * 3);
    f.lying.material = f.standing.material = flashMaterial('s', i, held.color);
    f.star.material = f.starTop.material = flashMaterial('f', Math.floor(Math.random() * 3), held.color);
    const s = held.size * (0.85 + Math.random() * 0.3);
    const wide = held.pellets > 1 ? 1.6 : 1;
    f.lying.scale.set(s, 1, s * wide);
    f.standing.scale.set(s, s * wide, 1);
    f.star.scale.setScalar(s * 0.7 * wide);
    f.starTop.scale.setScalar(s * 0.7 * wide);
    held.flash.rotation.x = Math.random() * Math.PI;
    held.flash.visible = true;
    f.life = sound === 'sniper' || sound === 'rocket' ? 0.08 : 0.045;
  }

  // ----- markings on the floor -----
  const reticle = new THREE.Group();
  reticle.add(new THREE.Mesh(new THREE.RingGeometry(0.28, 0.36, 4).rotateX(-Math.PI / 2).rotateY(Math.PI / 4), glow(COLORS.ink, 0.75)));
  reticle.add(new THREE.Mesh(new THREE.CircleGeometry(0.06, 4).rotateX(-Math.PI / 2), glow(COLORS.ink, 0.75)));
  reticle.position.y = 0.03;
  scene.add(reticle);

  // A telegraph is the whole area of the attack: an outlined shape that fills as the
  // wind-up runs out. Shape and fill carry the warning, so it doesn't depend on colour.
  const pools = { line: [], circle: [], spawn: [], friendly: [] };
  function lineTele(i) {
    while (pools.line.length <= i) {
      const group = new THREE.Group();
      const base = new THREE.Mesh(floorPatch(), glow(COLORS.hurt, 0.2));
      const fill = new THREE.Mesh(floorPatch(), glow(COLORS.hurt, 0.55));
      fill.position.y = 0.01;
      const edge = outline([[0, -0.5], [1, -0.5], [1, 0.5], [0, 0.5]], COLORS.hurt);
      group.add(base, fill, edge);
      group.userData = { base, fill, edge };
      scene.add(group);
      pools.line.push(group);
    }
    return pools.line[i];
  }
  function circleTele(kind, i, color) {
    const pool = pools[kind];
    while (pool.length <= i) {
      const group = new THREE.Group();
      const base = new THREE.Mesh(floorDisc(1), glow(color, 0.2));
      const fill = new THREE.Mesh(floorDisc(1), glow(color, 0.5));
      fill.position.y = 0.01;
      const edge = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 32).rotateX(-Math.PI / 2), glow(color));
      edge.position.y = 0.02;
      group.add(base, fill, edge);
      group.userData = { fill };
      scene.add(group);
      pool.push(group);
    }
    return pool[i];
  }

  // ----- particles: chips, dust, flames, and spent brass -----
  const particleMesh = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.13, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX_PARTICLES);
  particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  particleMesh.frustumCulled = false;
  scene.add(particleMesh);
  const particles = [];
  const scratch = new THREE.Object3D();
  const tint = new THREE.Color();

  function burst(x, z, count, color, speed, height = 0.5) {
    for (let i = 0; i < count && particles.length < MAX_PARTICLES; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      particles.push({
        x, y: height, z, vx: Math.cos(a) * s, vy: 2 + Math.random() * speed * 0.6, vz: Math.sin(a) * s,
        spin: Math.random() * 6, life: 0.5 + Math.random() * 0.4, age: 0, color, size: 1,
      });
    }
  }
  // Rises and fades: flames, smoke, poison bubbles.
  function wisp(x, y, z, color, size = 1, life = 0.5) {
    if (particles.length >= MAX_PARTICLES) return;
    particles.push({ x, y, z, vx: (Math.random() - 0.5) * 0.8, vy: 1.2 + Math.random(), vz: (Math.random() - 0.5) * 0.8, spin: 3, life, age: 0, color, size, float: true });
  }
  // A spent case flips out of the side of the gun and rattles on the floor for a while.
  function brass(x, y, z, angle) {
    if (particles.length >= MAX_PARTICLES) return;
    const side = angle - Math.PI / 2 + (Math.random() - 0.5) * 0.6;
    const s = 2 + Math.random() * 2;
    particles.push({ x, y, z, vx: Math.cos(side) * s, vy: 3 + Math.random() * 2, vz: Math.sin(side) * s, spin: 14, life: 1.4, age: 0, color: COLORS.brass, size: 0.45 });
  }

  // ----- bullets, grenades, rockets, goo, rocks -----
  const tracerMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.07, 0.07).translate(-0.5, 0, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX_TRACERS);
  tracerMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  tracerMesh.frustumCulled = false;
  scene.add(tracerMesh);
  const grenadeGeo = new THREE.IcosahedronGeometry(0.16, 0);
  const grenadeMat = flat(0x4f6b35);
  const bombMat = flat(0x2b1f30);
  const rocketGeo = new THREE.CylinderGeometry(0.09, 0.12, 0.55, 6).rotateZ(Math.PI / 2);
  const rocketMat = flat(0x6a7a52);
  const gooGeo = new THREE.IcosahedronGeometry(0.28, 0);
  const gooMat = flat(COLORS.goo, { emissive: COLORS.goo, emissiveIntensity: 0.4 });
  const rockGeo = new THREE.DodecahedronGeometry(0.32, 0);
  const rockMat = flat(COLORS.rock);
  const shadowGeo = floorDisc(0.25, 10);
  const shadowMat = glow(COLORS.dark, 0.3);
  const projectileModels = new Map();

  function projectileModel(key, make) {
    let m = projectileModels.get(key);
    if (!m) { m = make(); scene.add(m); projectileModels.set(key, m); }
    m.userData.seen = true;
    return m;
  }

  const shotHeight = (cls) => (cls === 'turret' ? 0.55 : HOLD[cls]?.h ?? 0.6);

  function syncProjectiles(sim, now) {
    for (const m of projectileModels.values()) m.userData.seen = false;
    let n = 0;
    for (const b of sim.bullets) {
      if (b.lob) {
        const big = b.gun === 'bomb';
        const m = projectileModel(`b${b.id}`, () => { const g = new THREE.Group(); g.add(solid(grenadeGeo, big ? bombMat : grenadeMat)); const s = new THREE.Mesh(shadowGeo, shadowMat); g.add(s); g.userData.shadow = s; if (big) g.children[0].scale.setScalar(1.8); return g; });
        const t = 1 - b.life / b.flight;
        const h = shotHeight(b.cls) * (1 - t) + Math.sin(t * Math.PI) * 2.2 + 0.15;
        m.position.set(b.x, 0, b.y);
        m.children[0].position.y = h;
        m.children[0].rotation.set(now * 9, now * 7, 0);
        m.userData.shadow.position.y = 0.03;
        continue;
      }
      if (b.blast) {
        const m = projectileModel(`b${b.id}`, () => solid(rocketGeo, rocketMat));
        m.position.set(b.x, 0.7, b.y);
        m.rotation.y = -Math.atan2(b.vy, b.vx);
        if (Math.random() < 0.7) wisp(b.x - b.vx * 0.02, 0.7, b.y - b.vy * 0.02, 0xe8e0e8, 1.3, 0.5);
        continue;
      }
      if (n >= MAX_TRACERS) continue;
      const speed = Math.hypot(b.vx, b.vy);
      const angle = Math.atan2(b.vy, b.vx);
      const h = shotHeight(b.cls) + (0.6 - shotHeight(b.cls)) * Math.min(1, b.age * 5);
      const thick = b.gun === 'awm' ? 1.8 : 1;
      scratch.position.set(b.x, h, b.y);
      scratch.rotation.set(0, -angle, 0);
      scratch.scale.set(Math.min(Math.max(speed * 0.028, 0.35), Math.max(0.35, b.age * speed)), thick, thick);
      scratch.updateMatrix();
      tracerMesh.setMatrixAt(n, scratch.matrix);
      tracerMesh.setColorAt(n, tint.set(b.rune ? RUNES[b.rune].color : b.gun === 'awm' ? 0xffffff : COLORS.tracer));
      n++;
    }
    tracerMesh.count = n;
    tracerMesh.instanceMatrix.needsUpdate = true;
    if (tracerMesh.instanceColor) tracerMesh.instanceColor.needsUpdate = true;

    for (const s of sim.shots) {
      if (s.kind === 'glob') {
        const m = projectileModel(`s${s.id}`, () => { const g = new THREE.Group(); g.add(solid(gooGeo, gooMat)); g.add(new THREE.Mesh(shadowGeo, shadowMat)); return g; });
        m.position.set(s.x, 0, s.y);
        m.children[0].position.y = 0.5 + (s.height ?? 0);
        m.children[0].rotation.set(now * 5, now * 3, 0);
        m.children[1].position.y = 0.03;
      } else {
        const m = projectileModel(`s${s.id}`, () => solid(rockGeo, rockMat));
        m.position.set(s.x, 0.75, s.y);
        m.rotation.set(now * 11, now * 8, 0);
      }
    }
    for (const [key, m] of projectileModels) {
      if (!m.userData.seen) { scene.remove(m); projectileModels.delete(key); }
    }
  }

  // ----- coins and tokens -----
  const coinGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.06, 10).rotateX(Math.PI / 2);
  const coinMesh = new THREE.InstancedMesh(coinGeo, flat(0xffffff, { emissive: 0x403010, emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.3 }), MAX_COINS);
  coinMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  coinMesh.frustumCulled = false;
  coinMesh.castShadow = true;
  scene.add(coinMesh);
  function syncCoins(sim, now) {
    const count = Math.min(MAX_COINS, sim.coins.length);
    for (let i = 0; i < count; i++) {
      const c = sim.coins[i];
      const hop = Math.max(0, 1 - c.age * 2.5);
      scratch.position.set(c.x, 0.25 + Math.abs(Math.sin(now * 4 + c.id)) * 0.12 + hop * Math.sin(c.age * 12) * 0.8, c.y);
      scratch.rotation.set(0, now * 5 + c.id, 0);
      scratch.scale.setScalar(c.kind === 'token' ? 1.5 : 1);
      scratch.updateMatrix();
      coinMesh.setMatrixAt(i, scratch.matrix);
      coinMesh.setColorAt(i, tint.set(c.kind === 'token' ? COLORS.token : COLORS.gold));
    }
    coinMesh.count = count;
    coinMesh.instanceMatrix.needsUpdate = true;
    if (coinMesh.instanceColor) coinMesh.instanceColor.needsUpdate = true;
  }

  // ----- blasts: a flash of light and a ring that runs out along the floor -----
  const blasts = [];
  const blastDisc = floorDisc(1, 24);
  const blastBall = new THREE.IcosahedronGeometry(1, 1);
  function addBlast(x, z, r, color = COLORS.blast, ball = true) {
    const disc = new THREE.Mesh(blastDisc, additive(color, null, 0.8));
    disc.position.set(x, 0.05, z);
    scene.add(disc);
    let orb = null;
    if (ball) {
      orb = new THREE.Mesh(blastBall, additive(0xffe0a0, null, 0.9));
      orb.position.set(x, 0.6, z);
      scene.add(orb);
    }
    blasts.push({ disc, ball: orb, r, age: 0 });
  }
  function stepBlasts(dt) {
    for (let i = blasts.length - 1; i >= 0; i--) {
      const b = blasts[i];
      b.age += dt;
      const t = b.age / 0.35;
      if (t >= 1) {
        scene.remove(b.disc);
        b.disc.material.dispose();
        if (b.ball) { scene.remove(b.ball); b.ball.material.dispose(); }
        blasts.splice(i, 1);
        continue;
      }
      b.disc.scale.setScalar(b.r * (0.4 + t * 0.7));
      b.disc.material.opacity = 0.8 * (1 - t);
      if (b.ball) {
        b.ball.scale.setScalar(b.r * 0.6 * (0.5 + t * 0.6));
        b.ball.material.opacity = 0.9 * (1 - t) * (1 - t);
      }
    }
  }

  // ----- lightning: a jagged line that flickers for a moment -----
  const zaps = [];
  const zapMat = new THREE.LineBasicMaterial({ color: COLORS.zap, transparent: true });
  function addZap(points, small) {
    const pts = [];
    for (let i = 0; i < points.length - 1; i++) {
      const [x1, z1] = points[i];
      const [x2, z2] = points[i + 1];
      const segs = 6;
      for (let s = 0; s <= segs; s++) {
        const t = s / segs;
        const j = s === 0 || s === segs ? 0 : (Math.random() - 0.5) * 0.6;
        pts.push(new THREE.Vector3(x1 + (x2 - x1) * t + j, 0.8 + Math.random() * 0.3, z1 + (z2 - z1) * t + j));
      }
    }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), zapMat.clone());
    line.frustumCulled = false;
    scene.add(line);
    zaps.push({ line, age: 0, life: small ? 0.08 : 0.16 });
    const [ex, ez] = points[points.length - 1];
    burst(ex, ez, small ? 2 : 6, COLORS.zap, 6, 0.8);
  }
  function stepZaps(dt) {
    for (let i = zaps.length - 1; i >= 0; i--) {
      const z = zaps[i];
      z.age += dt;
      if (z.age >= z.life) { scene.remove(z.line); z.line.geometry.dispose(); z.line.material.dispose(); zaps.splice(i, 1); continue; }
      z.line.material.opacity = 1 - z.age / z.life;
    }
  }

  // ----- what he leaves about: turrets, coils, decoys, smoke, mines, fire -----
  const allyModels = new Map();
  const mineModels = new Map();
  const zoneModels = new Map();
  const mineGeo = new THREE.CylinderGeometry(0.22, 0.26, 0.1, 8);
  const mineMat = flat(0x3c3f4a, { metalness: 0.5 });
  const mineLight = new THREE.SphereGeometry(0.06, 6, 4);
  function makeAlly(a) {
    const group = new THREE.Group();
    if (a.kind === 'turret') {
      const dark = flat(0x3c3f4a, { metalness: 0.4 });
      for (let i = 0; i < 3; i++) {
        const leg = solid(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 4), dark);
        leg.position.set(Math.cos(i * 2.1) * 0.15, 0.25, Math.sin(i * 2.1) * 0.15);
        leg.rotation.set(Math.sin(i * 2.1) * 0.4, 0, -Math.cos(i * 2.1) * 0.4);
        group.add(leg);
      }
      const head = new THREE.Group();
      head.position.y = 0.55;
      if (gunModels) { const g = gunMesh(gunModels, 'smg'); g.position.x = -0.1; head.add(g); }
      group.add(head);
      group.userData.head = head;
    } else if (a.kind === 'tesla') {
      group.add(solid(new THREE.CylinderGeometry(0.18, 0.28, 0.9, 6), flat(0x5a6270, { metalness: 0.5 }), 0, 0.45, 0));
      const orb = solid(new THREE.IcosahedronGeometry(0.22, 1), flat(COLORS.zap, { emissive: 0x6fe3ff, emissiveIntensity: 1.2 }), 0, 1.0, 0);
      group.add(orb);
      group.userData.orb = orb;
    } else if (a.kind === 'decoy') {
      // An inflatable him: the same body, see-through and wobbling.
      const rig = makeGuy(look.skin, { transparent: true, opacity: 0.7 });
      group.add(rig.group);
      group.userData.rig = rig;
    } else {
      for (let i = 0; i < 7; i++) {
        const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6 + Math.random() * 0.5, 1), new THREE.MeshStandardMaterial({ color: 0xc8c0cc, transparent: true, opacity: 0.6, flatShading: true, depthWrite: false }));
        puff.position.set((Math.random() - 0.5) * 2, 0.4 + Math.random() * 0.6, (Math.random() - 0.5) * 2);
        group.add(puff);
      }
    }
    return group;
  }
  function syncLeftovers(sim, now, dt) {
    const seen = new Set();
    for (const a of sim.allies) {
      seen.add(a.id);
      let m = allyModels.get(a.id);
      if (!m) { m = makeAlly(a); allyModels.set(a.id, m); scene.add(m); m.userData.born = now; }
      m.position.set(a.x, 0, a.y);
      const grow = Math.min(1, (now - m.userData.born) * 4) * Math.min(1, a.life * 3);
      if (a.kind === 'turret') m.userData.head.rotation.y = -(a.aim ?? 0);
      if (a.kind === 'tesla') m.userData.orb.scale.setScalar(1 + Math.sin(now * 20) * 0.1);
      if (a.kind === 'decoy') {
        animate(m.userData.rig, dt, { x: 0, y: 0 }, 0, { sway: Math.sin(now * 5) * 0.25, squash: Math.sin(now * 7) * 0.08 });
        m.rotation.y = -Math.atan2(sim.guy.y - a.y, sim.guy.x - a.x);
      }
      if (a.kind === 'smoke') m.children.forEach((p, i) => { p.position.y = 0.4 + Math.sin(now + i) * 0.15; p.rotation.y = now * 0.3 + i; });
      m.scale.setScalar(a.kind === 'smoke' ? 0.6 + grow * 0.7 : grow);
    }
    for (const [key, m] of allyModels) if (!seen.has(key)) { scene.remove(m); allyModels.delete(key); }

    seen.clear();
    for (const mine of sim.mines) {
      seen.add(mine.id);
      let m = mineModels.get(mine.id);
      if (!m) {
        m = new THREE.Group();
        m.add(solid(mineGeo, mineMat, 0, 0.05, 0));
        const light = new THREE.Mesh(mineLight, glow(COLORS.hurt));
        light.position.y = 0.13;
        m.add(light);
        m.userData.light = light;
        mineModels.set(mine.id, m);
        scene.add(m);
      }
      m.position.set(mine.x, 0, mine.y);
      m.userData.light.visible = mine.age < 0.5 || Math.floor(now * 4) % 2 === 0;
    }
    for (const [key, m] of mineModels) if (!seen.has(key)) { scene.remove(m); mineModels.delete(key); }

    seen.clear();
    for (const z of sim.zones) {
      seen.add(z.id);
      let m = zoneModels.get(z.id);
      if (!m) { m = new THREE.Mesh(floorDisc(1, 20), additive(COLORS.fire, null, 0.5)); zoneModels.set(z.id, m); scene.add(m); }
      m.position.set(z.x, 0.04, z.y);
      m.scale.setScalar(z.r * (0.92 + Math.sin(now * 13) * 0.05));
      m.material.opacity = 0.35 + Math.sin(now * 17) * 0.1;
      if (Math.random() < 0.6) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * z.r;
        wisp(z.x + Math.cos(a) * r, 0.1, z.y + Math.sin(a) * r, Math.random() < 0.5 ? COLORS.fire : 0xffd23f, 1.2, 0.45);
      }
    }
    for (const [key, m] of zoneModels) if (!seen.has(key)) { scene.remove(m); zoneModels.delete(key); }
  }

  // ----- buffs he's wearing: a bubble, a plate ring, an aura -----
  const bubble = new THREE.Mesh(new THREE.IcosahedronGeometry(0.95, 1), new THREE.MeshBasicMaterial({ color: COLORS.ice, transparent: true, opacity: 0.25, depthWrite: false }));
  const plateRing = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 4, 16).rotateX(Math.PI / 2), flat(0x8a93a6, { metalness: 0.7, roughness: 0.3 }));
  const aura = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.85, 24).rotateX(-Math.PI / 2), additive(0xffffff, null, 0.6));
  scene.add(bubble, plateRing, aura);

  // ----- words and numbers sit in HTML over the canvas -----
  const popups = [];
  const projected = new THREE.Vector3();

  function popup(x, z, text, { color = COLORS.ink, size = 18, kind = 'word', rise = 1.6 } = {}) {
    const el = document.createElement('div');
    el.className = `popup ${kind}`;
    el.textContent = text;
    el.style.color = css(color);
    el.style.fontSize = `${size}px`;
    overlay.append(el);
    popups.push({ el, x: x + (kind === 'number' ? (Math.random() - 0.5) * 0.6 : 0), z, age: 0, rise });
    if (popups.length > 30) popups.shift().el.remove();
  }

  function place(el, x, y, z) {
    projected.set(x, y, z).project(camera);
    el.style.transform = `translate(-50%, -50%) translate(${((projected.x + 1) / 2) * canvas.clientWidth}px, ${((1 - projected.y) / 2) * canvas.clientHeight}px)`;
  }

  // Damage is added up per creature for a moment, so a shotgun shows one number, not eight.
  // Burning and poison ticks are added up for longer, and shown in their own colour.
  const tallies = new Map();
  function tally(e) {
    const key = `${e.id}${e.dot ? 'd' : ''}`;
    let t = tallies.get(key);
    if (!t) { t = { amount: 0, age: 0, x: e.x, z: e.y, stunned: false, dot: e.dot, rune: e.rune }; tallies.set(key, t); }
    t.amount += e.amount;
    t.x = e.x;
    t.z = e.y;
    t.stunned ||= e.stunned;
  }
  function stepTallies(dt) {
    for (const [key, t] of tallies) {
      t.age += dt;
      if (t.age < (t.dot ? 0.6 : 0.12)) continue;
      if (options.numbers && t.amount >= 1) {
        const big = t.amount >= 100;
        const color = t.dot ? (t.rune === 'venom' ? 0x4f8a20 : 0xd85a10) : t.stunned ? 0xe8590c : big ? 0xc2185b : COLORS.ink;
        popup(t.x, t.z, String(Math.round(t.amount)), { kind: 'number', color, size: t.dot ? 13 : big ? 26 : 16, rise: 1.2 });
      }
      tallies.delete(key);
    }
  }

  const creatureModels = new Map();
  const rigOf = (id) => creatureModels.get(id)?.rig;
  const bump = (amount) => { if (options.shake) shake = Math.max(shake, amount); };
  let lightPulse = 0;
  const clanged = new Map();

  function onEvents(events) {
    for (const e of events) {
      if (e.type === 'shot') {
        if (e.ally) { burst(e.x, e.y, 1, COLORS.flash, 2, 0.6); continue; }
        fireFlash(e.sound);
        const heavy = e.sound === 'sniper' || e.sound === 'rocket' || e.sound === 'launcher' || e.sound === 'shotgun';
        lightPulse = Math.min(2, lightPulse + (heavy ? 1.2 : 0.35));
        if (held) held.kick = heavy ? 1 : 0.6;
        if (heavy) { guyRig.lunge = Math.max(guyRig.lunge, 0.25); bump(e.sound === 'sniper' ? 0.18 : 0.1); }
        if (e.sound !== 'launcher' && e.sound !== 'rocket') brass(e.x, shotHeight(e.cls) + 0.1, e.y, e.angle);
      } else if (e.type === 'swing') {
        guyRig.lunge = Math.max(guyRig.lunge, e.style === 'thrust' ? 0.45 : 0.2);
      } else if (e.type === 'smack') {
        burst(e.x, e.y, 6 + e.landed * 3, COLORS.bone, 7, 0.6);
        bump(0.08 + e.landed * 0.03);
        if (e.gun === 'bat' && Math.random() < 0.5) popup(e.x, e.y, 'BONK', { color: 0xe8590c, size: 22 });
      } else if (e.type === 'saw') {
        if (e.landed) { burst(e.x + Math.cos(sawAngle) * 1.2, e.y + Math.sin(sawAngle) * 1.2, 3, COLORS.hurt, 6, 0.5); bump(0.05); }
      } else if (e.type === 'parry') {
        burst(e.x, e.y, 8, COLORS.bone, 7, 0.8);
        popup(e.x, e.y, 'SWAT', { color: 0x2f8ea8, size: 18 });
      } else if (e.type === 'swap') {
        if (held) held.pop = 0.3;
      } else if (e.type === 'hit') {
        tally(e);
        if (e.dot) continue;
        const entry = creatureModels.get(e.id);
        if (entry) entry.hitFlash = 0.07;
        if (Math.random() < 0.6) burst(e.x, e.y, 2, e.rune ? RUNES[e.rune].color : LOOKS[entry?.kind]?.belly ?? COLORS.hurt, 5);
      } else if (e.type === 'death') {
        const look = LOOKS[e.kind];
        burst(e.x, e.y, e.boss ? 120 : Math.round(16 + e.r * 30), look.top, e.boss ? 18 : 11);
        burst(e.x, e.y, e.boss ? 40 : Math.round(6 + e.r * 10), look.belly, 9);
        bump(e.boss ? 0.9 : 0.12 + e.r * 0.15);
        if (e.boss) { addBlast(e.x, e.y, 5, look.belly); popup(e.x, e.y, 'BIG ONE DOWN!', { color: 0xc2185b, size: 40 }); }
      } else if (e.type === 'hurt') {
        burst(e.x, e.y, 20, COLORS.hurt, 9);
        popup(e.x, e.y, 'OUCH', { color: COLORS.hurt, size: 34 });
        jolt(guyRig, -34, 40);
        bump(0.4);
      } else if (e.type === 'plate') {
        burst(e.x, e.y, 10, 0x8a93a6, 7);
        popup(e.x, e.y, e.left > 0 ? 'CLONK' : 'PLATE GONE', { color: 0x5a6270, size: 20 });
      } else if (e.type === 'dead') {
        guyRig.dead = 0.001;
        burst(e.x, e.y, 50, SKINS[look.skin]?.limb ?? 0xe58f7c, 10);
        bump(0.8);
      } else if (e.type === 'revive') {
        addBlast(e.x, e.y, 5, COLORS.heal);
        burst(e.x, e.y, 40, COLORS.heal, 10);
        popup(e.x, e.y, 'SPARE HEART!', { color: 0x1f8038, size: 34 });
      } else if (e.type === 'heal') {
        if (e.amount >= 5) popup(e.x, e.y, `+${Math.round(e.amount)}`, { color: 0x1f8038, size: 20, kind: 'number' });
        burst(e.x, e.y, 6, COLORS.heal, 4);
      } else if (e.type === 'clang') {
        burst(e.x, e.y, 3, COLORS.bone, 8, 0.6);
        // One word per Shell every so often; a volley into its front is still one CLANG.
        const now = performance.now();
        if ((clanged.get(e.id) ?? 0) < now - 600) { clanged.set(e.id, now); popup(e.x, e.y, 'CLANG', { color: 0x8a7080, size: 18 }); }
      } else if (e.type === 'spark') {
        burst(e.x, e.y, 2, COLORS.bone, 5, 0.6);
      } else if (e.type === 'shieldbreak') {
        burst(e.x, e.y, 20, COLORS.ice, 9);
        popup(e.x, e.y, 'SHIELD DOWN', { color: 0x2f8ea8, size: 22 });
      } else if (e.type === 'crash') {
        jolt(rigOf(e.id), -30, 36);
        burst(e.x, e.y, 14, COLORS.wall, 7);
        popup(e.x, e.y, 'CRASH!', { color: 0xe8590c, size: 30 });
        bump(0.35);
      } else if (e.type === 'blast') {
        const color = e.rune ? RUNES[e.rune].color : COLORS.blast;
        addBlast(e.x, e.y, e.r, color);
        burst(e.x, e.y, 26, color, 11);
        burst(e.x, e.y, 10, COLORS.dark, 6);
        lightPulse = 2;
        bump(0.25 + e.r * 0.05);
      } else if (e.type === 'splat') {
        addBlast(e.x, e.y, e.r, COLORS.goo, false);
        burst(e.x, e.y, 16, COLORS.goo, 7, 0.2);
      } else if (e.type === 'crumble') {
        burst(e.x, e.y, 10, COLORS.rock, 6);
      } else if (e.type === 'phase') {
        popup(e.x, e.y, e.phase === 3 ? 'ENRAGED' : 'ANGRY', { color: 0xc2185b, size: 36 });
        bump(0.5);
      } else if (e.type === 'dash') {
        burst(e.x, e.y, 10, COLORS.grid, 5, 0.1);
        guyRig.lunge = 0.6;
      } else if (e.type === 'coin') {
        if (e.value >= 100) popup(e.x, e.y, `+$${e.value}`, { color: 0xa07808, size: 24 });
        else if (Math.random() < 0.35) popup(e.x, e.y, `+$${e.value}`, { color: 0xa07808, size: 14, kind: 'number', rise: 1 });
      } else if (e.type === 'token') {
        popup(e.x, e.y, '+1 TOKEN', { color: 0x1f8a80, size: 20 });
        burst(e.x, e.y, 10, COLORS.token, 6);
      } else if (e.type === 'arrive') {
        burst(e.x, e.y, 10, COLORS.ink, 5, 0.1);
      } else if (e.type === 'reload') {
        if (held) held.spin = 1;
      } else if (e.type === 'zap') {
        addZap(e.points, e.small);
      } else if (e.type === 'shockwave') {
        addBlast(e.x, e.y, e.r, 0xffffff, false);
        burst(e.x, e.y, 30, COLORS.bone, 12, 0.3);
        bump(0.3);
      } else if (e.type === 'freeze') {
        addBlast(e.x, e.y, e.r, COLORS.ice, false);
        burst(e.x, e.y, 30, COLORS.ice, 8, 0.4);
      } else if (e.type === 'blink') {
        burst(e.fromX, e.fromY, 16, 0xc9a8f0, 6);
        burst(e.x, e.y, 16, 0xc9a8f0, 6);
      } else if (e.type === 'landing') {
        bump(0.5);
        burst(e.x, e.y, 30, COLORS.wall, 9, 0.1);
      } else if (e.type === 'molotov') {
        burst(e.x, e.y, 20, COLORS.fire, 8);
      } else if (e.type === 'nuke') {
        overlay.classList.remove('nuke');
        void overlay.offsetWidth;
        overlay.classList.add('nuke');
        bump(1);
      } else if (e.type === 'ability' || e.type === 'power' || e.type === 'note') {
        if (e.type !== 'ability') popup(e.x, e.y, e.name ?? e.text, { color: 0x2f8ea8, size: 20 });
      } else if (e.type === 'pop') {
        burst(e.x, e.y, 12, e.kind === 'smoke' ? 0xc8c0cc : COLORS.ink, 5);
      }
    }
  }

  // ----- camera -----
  function fitCamera() {
    const corners = [];
    for (const x of [-1.2, ROOM.w + 1.2]) {
      for (const z of [-1.2, ROOM.h + 1.2]) corners.push(new THREE.Vector3(x, 0, z), new THREE.Vector3(x, 1.4, z));
    }
    const fits = (distance) => {
      camera.position.copy(lookAt).addScaledVector(viewDir, distance);
      camera.lookAt(lookAt);
      camera.updateMatrixWorld();
      // The top and bottom keep a little room for the status bar and the weapon list.
      return corners.every((c) => {
        const p = c.clone().project(camera);
        return Math.abs(p.x) <= 0.97 && p.y <= 0.86 && p.y >= -0.9;
      });
    };
    let near = 5;
    let far = 500;
    for (let i = 0; i < 24; i++) {
      const mid = (near + far) / 2;
      if (fits(mid)) far = mid; else near = mid;
    }
    fits(far);
    cameraHome.copy(camera.position);
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    fitCamera();
  }
  window.addEventListener('resize', resize);
  resize();

  const raycaster = new THREE.Raycaster();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.6);
  const pointer = new THREE.Vector2();
  const groundHit = new THREE.Vector3();
  const lastWorld = { x: ROOM.w / 2 + 4, y: ROOM.h / 2 };

  // The cursor aims at the spot it points to, at about the height bullets fly.
  function toWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return lastWorld;
    pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    camera.position.copy(cameraHome);
    camera.updateMatrixWorld();
    raycaster.setFromCamera(pointer, camera);
    if (raycaster.ray.intersectPlane(ground, groundHit)) {
      lastWorld.x = groundHit.x;
      lastWorld.y = groundHit.z;
    }
    return lastWorld;
  }

  // ----- keeping the models in step with the sim -----
  const barBack = new THREE.MeshBasicMaterial({ color: COLORS.dark, depthTest: false, transparent: true });
  const barFill = new THREE.MeshBasicMaterial({ color: COLORS.hurt, depthTest: false, transparent: true });
  const barShield = new THREE.MeshBasicMaterial({ color: COLORS.ice, depthTest: false, transparent: true });
  const barGeo = new THREE.PlaneGeometry(1, 1).translate(0.5, 0, 0);

  function makeBar(width) {
    const group = new THREE.Group();
    const back = new THREE.Mesh(barGeo, barBack);
    back.scale.set(width + 0.08, 0.2, 1);
    back.position.x = -0.04;
    const fill = new THREE.Mesh(barGeo, barFill);
    fill.scale.set(width, 0.12, 1);
    fill.position.z = 0.001;
    const shield = new THREE.Mesh(barGeo, barShield);
    shield.scale.set(width, 0.06, 1);
    shield.position.set(0, -0.03, 0.002);
    for (const m of [back, fill, shield]) m.renderOrder = 10;
    group.add(back, fill, shield);
    group.userData = { fill, shield, width };
    return group;
  }

  function dropCreature(entry) {
    scene.remove(entry.group, entry.bar, entry.ring);
    if (entry.bubble) scene.remove(entry.bubble);
    if (entry.tag) entry.tag.remove();
  }

  function clearModels() {
    for (const entry of creatureModels.values()) dropCreature(entry);
    creatureModels.clear();
    for (const p of popups.splice(0)) p.el.remove();
    for (const map of [projectileModels, allyModels, mineModels, zoneModels]) { for (const m of map.values()) scene.remove(m); map.clear(); }
    tallies.clear();
    particles.length = 0;
    guyRig.dead = 0;
    guyRig.inner.rotation.set(0, 0, 0);
    heldKey = '';
  }

  function creaturePose(e, now) {
    if (e.frozen > 0) return { squash: 0, arms: () => ({ swing: 0, lift: 0 }) };
    if (e.state === 'windup' || e.state === 'spitwind') {
      // It rears back and shakes harder and harder, so the warning is on the body as well as the floor.
      return { lean: 0.55 * e.progress, squash: 0.12 * e.progress, sway: Math.sin(now * 38) * 0.07 * e.progress, arms: () => ({ swing: -2.2 * e.progress, lift: 1.0 }) };
    }
    if (e.state === 'charge' || e.state === 'lunge') return { lean: -0.3, arms: () => ({ swing: 2.4, lift: 0.5 }) };
    if (e.state === 'recover') return { squash: 0.1, lean: 0.25, arms: () => ({ swing: -0.6, lift: -1.4 }) };
    if (e.state === 'stunned') return { squash: 0.14, sway: Math.sin(now * 7) * 0.32, arms: (arm) => ({ swing: Math.sin(now * 7 + arm.side) * 0.9, lift: -1.6 }) };
    return {};
  }

  function syncCreatures(sim, now, dt) {
    const seen = new Set();
    for (const e of sim.enemies) {
      seen.add(e.id);
      let entry = creatureModels.get(e.id);
      if (!entry) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.06, 4, 10).rotateX(Math.PI / 2), glow(COLORS.ink));
        ring.scale.setScalar(e.r / 0.85);
        const rig = makeCreature(e);
        const flash = new THREE.Mesh(rig.body.geometry, flashMat.clone());
        flash.scale.setScalar(1.04);
        rig.body.add(flash);
        entry = { rig, kind: e.kind, group: rig.group, ring, flash, hitFlash: 0, bar: makeBar(Math.max(0.7, e.r * 1.5)), born: now };
        if (e.mod === 'shielded') {
          entry.bubble = new THREE.Mesh(new THREE.IcosahedronGeometry(e.r * 1.45, 1), new THREE.MeshBasicMaterial({ color: COLORS.ice, transparent: true, opacity: 0.3, depthWrite: false }));
          scene.add(entry.bubble);
        }
        if (e.mod) {
          entry.tag = document.createElement('div');
          entry.tag.className = 'tag';
          entry.tag.textContent = MODIFIERS[e.mod].name;
          overlay.append(entry.tag);
        }
        creatureModels.set(e.id, entry);
        scene.add(entry.group, entry.bar, entry.ring);
      }
      entry.group.position.set(e.x, 0, e.y);
      entry.group.rotation.y = -e.angle;
      // It pops up out of the floor when it arrives.
      const grow = Math.min(1, (now - entry.born) * 5);
      entry.group.scale.setScalar((e.state === 'windup' ? 1 + e.progress * 0.2 : 1) * (0.3 + 0.7 * grow));
      const slow = (sim.buffs.slowmo > 0 ? 0.35 : 1) * (e.slowT > 0 ? 0.5 : 1) * (e.frozen > 0 ? 0 : 1);
      animate(entry.rig, dt * slow, { x: e.vx + e.kx, y: e.vy + e.ky }, e.angle, creaturePose(e, now));
      // White for a hit, ice for frozen, a blue tint for slowed.
      entry.hitFlash = Math.max(0, entry.hitFlash - dt);
      const m = entry.flash.material;
      if (entry.hitFlash > 0) { m.color.set(0xffffff); m.opacity = 0.75; }
      else if (e.frozen > 0) { m.color.set(COLORS.ice); m.opacity = 0.6; }
      else if (e.slowT > 0) { m.color.set(COLORS.ice); m.opacity = 0.25; }
      else m.opacity = 0;
      // Burning and poisoned creatures trail flames and bubbles.
      if (e.burn > 0 && Math.random() < 0.5) wisp(e.x + (Math.random() - 0.5) * e.r, e.r * 1.2, e.y + (Math.random() - 0.5) * e.r, Math.random() < 0.5 ? COLORS.fire : 0xffd23f, 0.9, 0.4);
      if (e.poison.length && Math.random() < 0.25) wisp(e.x + (Math.random() - 0.5) * e.r, e.r, e.y, 0x8fe040, 0.6, 0.6);

      const top = e.r * 2.1 + 0.5;
      const showBar = e.hp < e.maxHp && e.kind !== 'bigone';
      entry.bar.visible = showBar;
      if (showBar) {
        const w = entry.bar.userData.width;
        entry.bar.position.set(e.x - w / 2, top, e.y - e.r - 0.1);
        entry.bar.quaternion.copy(camera.quaternion);
        entry.bar.userData.fill.scale.x = Math.max(0.001, w * (e.hp / e.maxHp));
        entry.bar.userData.shield.visible = e.shieldMax > 0 && e.shield > 0;
        entry.bar.userData.shield.scale.x = Math.max(0.001, w * (e.shield / Math.max(1, e.shieldMax)));
      }
      entry.ring.visible = e.state === 'stunned';
      entry.ring.position.set(e.x, e.r * 1.8 + 0.5, e.y);
      entry.ring.rotation.y = now * 3;
      if (entry.bubble) {
        entry.bubble.visible = e.shield > 0;
        entry.bubble.position.set(e.x, e.r + 0.3, e.y);
        entry.bubble.rotation.y = now;
        entry.bubble.material.opacity = 0.12 + 0.25 * (e.shield / e.shieldMax);
      }
      if (entry.tag) place(entry.tag, e.x, top + 0.45, e.y - e.r - 0.15);
    }
    for (const [id, entry] of creatureModels) {
      if (!seen.has(id)) { dropCreature(entry); creatureModels.delete(id); }
    }
  }

  function syncTelegraphs(sim, now) {
    const used = { line: 0, circle: 0, spawn: 0, friendly: 0 };
    for (const t of sim.telegraphs()) {
      if (t.type === 'line') {
        const group = lineTele(used.line++);
        const dx = t.x2 - t.x1;
        const dz = t.y2 - t.y1;
        const length = Math.hypot(dx, dz);
        group.visible = true;
        group.position.set(t.x1, 0.03, t.y1);
        group.rotation.y = -Math.atan2(dz, dx);
        group.userData.base.scale.set(length, 1, t.width);
        group.userData.edge.scale.set(length, 1, t.width);
        group.userData.fill.scale.set(Math.max(0.001, length * t.progress), 1, t.width);
      } else {
        const kind = t.type === 'spawn' ? 'spawn' : t.type === 'friendly' ? 'friendly' : 'circle';
        const color = kind === 'spawn' ? COLORS.ink : kind === 'friendly' ? COLORS.friendly : COLORS.hurt;
        const group = circleTele(kind, used[kind]++, color);
        group.visible = true;
        group.position.set(t.x, 0.03, t.y);
        const r = kind === 'spawn' ? t.r * (1 + Math.sin(now * 14) * 0.08) : t.r;
        group.scale.set(r, 1, r);
        const fill = Math.max(0.001, Math.min(1, t.progress));
        group.userData.fill.scale.set(fill, 1, fill);
      }
    }
    for (const kind of Object.keys(pools)) for (let i = used[kind]; i < pools[kind].length; i++) pools[kind][i].visible = false;
  }

  // ----- how he holds things -----
  // Every pose is worked out in his body's own space (x forward, z to his right). yaw is
  // how far his body turns away from the aim: none for a handgun, side-on for a long gun.
  const fistL = new THREE.Vector3();
  const fistR = new THREE.Vector3();
  const local = new THREE.Vector3();
  let sawAngle = 0;

  // A point given in the aim's frame (fwd along the aim, side to the right), in body space.
  function fromAim(fwd, side, h, delta, out) {
    return out.set(fwd * Math.cos(delta) - side * Math.sin(delta), h, fwd * Math.sin(delta) + side * Math.cos(delta));
  }

  function heldPose(sim, w, now) {
    const g = sim.guy;
    const st = w.stats;
    const a = g.attack;
    const pose = { yaw: 0, shoulders: undefined, twist: 0, lean: 0 };
    let grip;          // where the weapon's grip sits, in the aim frame
    let pointing = 0;  // the weapon's direction, relative to the aim
    let raise = 0;     // the weapon tipped up off level
    let both = true;   // both hands on it
    let fore = 0.3;    // how far along it the front hand goes, as a share of its length
    if (st.class === 'handgun') {
      // Out in front in both little fists, arms reaching forward.
      grip = { fwd: HOLD.handgun.fwd, side: HOLD.handgun.side, h: HOLD.handgun.h };
      pose.shoulders = 0.75;
      fore = 0;
    } else if (st.class === 'long') {
      // Side-on: his body turns away so the gun runs along the aim past his front, the
      // back hand on the grip and the front hand out along the barrel.
      pose.yaw = 1.05;
      grip = { fwd: HOLD.long.fwd, side: HOLD.long.side, h: HOLD.long.h };
      pose.shoulders = 1.1;
      fore = 0.32;
    } else if (st.style === 'saw') {
      grip = { fwd: 0.5, side: 0.12, h: 0.55 };
      pose.shoulders = 1.0;
      fore = 0.18;
      if (a) { grip.fwd += Math.sin(now * 60) * 0.02; grip.side += Math.cos(now * 47) * 0.02; pose.lean = -0.15; }
      sawAngle = g.aim;
    } else if (st.style === 'thrust') {
      // Pulled back a little, then shoved straight out along the aim.
      const p = a ? Math.min(1, a.t / a.dur) : 0;
      const out = a ? (p < 0.4 ? -0.2 + ease(p / 0.4) * 1.2 : 1 - ease((p - 0.4) / 0.6)) : 0;
      grip = { fwd: 0.36 + out * 0.5, side: st.reach > 2 ? 0.08 : 0.3, h: 0.55 };
      both = st.reach > 2;
      fore = 0.25;
      pose.shoulders = both ? 1.0 : undefined;
      pose.lean = -0.25 * out;
      raise = a ? 0 : (both ? 0.15 : 0.5);
      if (!a && !both) pointing = 0.45;
    } else {
      // A swing: wound back across one side, then round in a wide arc to the other, his
      // body twisting into it. Swings alternate, forehand then backhand.
      both = false;
      if (a) {
        const p = Math.min(1, a.t / a.dur);
        const from = a.dir * 1.9;
        const to = -a.dir * 1.6;
        const arc = p < 0.25 ? from + a.dir * 0.3 * ease(p / 0.25) : from + a.dir * 0.3 + (to - from - a.dir * 0.3) * ease((p - 0.25) / 0.75);
        pointing = arc;
        grip = { fwd: Math.cos(arc) * 0.55, side: Math.sin(arc) * 0.55, h: 0.58 };
        pose.twist = -arc * 0.35;
        raise = 0.1;
      } else {
        // Held ready at his side, pointing forward and a little out.
        grip = { fwd: HOLD.melee.fwd, side: HOLD.melee.side, h: HOLD.melee.h };
        pointing = 0.45;
        raise = 0.3;
      }
    }
    return { pose, grip, pointing, raise, both, fore };
  }

  function syncGuy(sim, dt, now) {
    const g = sim.guy;
    const jumpH = g.jump ? Math.sin(Math.min(1, g.jump.t / g.jump.dur) * Math.PI) * 2 : 0;
    guyModel.position.set(g.x, jumpH, g.y);
    // He flickers while he can't be hurt.
    guyModel.visible = guyRig.dead > 0 || !(g.safe > 0 && Math.floor(g.safe * 12) % 2 === 0);
    if (guyRig.dead > 0) {
      guyRig.dead = Math.min(1, guyRig.dead + dt * 3);
      guyRig.inner.rotation.z = guyRig.dead * 1.4;
      guyRig.inner.position.y = 0;
      return;
    }
    syncHeld(sim);
    const w = sim.heldWeapon();
    const hp = heldPose(sim, w, now);
    const bodyYaw = g.aim + hp.pose.yaw;
    guyModel.rotation.y = -bodyYaw;
    const delta = -hp.pose.yaw;  // the aim, seen from his body

    // Arms reach for the weapon: the right hand to its grip, the left to the grip as well
    // (handguns) or out along it (long guns, spears, chainsaw), or swinging free.
    let gripLocal = null;
    let dirLocal = 0;
    if (held) {
      const kick = held.kick;
      fromAim(hp.grip.fwd - kick * 0.12, hp.grip.side, hp.grip.h, delta, local);
      gripLocal = local.clone();
      dirLocal = delta + hp.pointing;
    }
    const toInner = (v, out) => {
      guyModel.updateMatrixWorld(true);
      out.copy(v);
      guyModel.localToWorld(out);
      return guyRig.inner.worldToLocal(out);
    };
    if (gripLocal) {
      toInner(gripLocal, fistR);
      if (hp.both) {
        const along = held.length * hp.fore;
        const fore = gripLocal.clone().add(new THREE.Vector3(Math.cos(dirLocal) * along, 0.02, Math.sin(dirLocal) * along));
        if (hp.fore === 0) fore.z -= 0.08;
        toInner(fore, fistL);
      }
    }
    animate(guyRig, dt, { x: g.vx, y: g.vy }, g.aim, {
      shoulders: hp.pose.shoulders,
      twist: hp.pose.twist,
      lean: hp.pose.lean,
      reach: (arm) => {
        if (!gripLocal) return null;
        if (arm.side > 0) return fistR;
        return hp.both ? fistL : null;
      },
      arms: (arm) => (arm.side < 0 && !hp.both ? { swing: 0.6, lift: 0.2 } : null),
    });

    if (held) {
      held.kick = Math.max(0, held.kick - dt * 8);
      held.spin = Math.max(0, held.spin - dt * 2.5);
      held.pop = Math.min(1, held.pop + dt * 5);
      held.holder.position.copy(gripLocal);
      held.holder.rotation.set(0, -dirLocal, 0);
      held.holder.scale.setScalar(held.pop);
      // Muzzle climbs on a kick; the gun dips and turns during a reload; melee tips up at rest.
      const reloading = w.reloadT > 0 ? Math.sin(Math.min(1, 1 - w.reloadT / w.stats.reload) * Math.PI) : 0;
      held.model.rotation.set(reloading * 0.9, 0, held.kick * 0.3 + hp.raise - reloading * 0.5);
      const f = held.flash.userData;
      if (held.flash.visible && !options.focus) { f.life -= dt; if (f.life <= 0) held.flash.visible = false; }
    }
  }

  function syncBuffs(sim, now) {
    const g = sim.guy;
    const b = sim.buffs;
    bubble.visible = b.bubble > 0;
    bubble.position.set(g.x, 0.6, g.y);
    bubble.rotation.y = now;
    bubble.material.opacity = 0.18 + Math.sin(now * 8) * 0.06;
    plateRing.visible = g.plate > 0;
    plateRing.position.set(g.x, 0.35, g.y);
    const auraColor = b.rage > 0 ? COLORS.hurt : b.overdrive > 0 || b.adrenaline > 0 ? COLORS.gold : b.vampire > 0 ? 0xe0203c : b.bottomless > 0 ? COLORS.token : null;
    aura.visible = auraColor !== null;
    if (auraColor !== null) {
      aura.material.color.set(auraColor);
      aura.position.set(g.x, 0.05, g.y);
      aura.scale.setScalar(1 + Math.sin(now * 10) * 0.08);
    }
    overlay.classList.toggle('slow', b.slowmo > 0);
  }

  function stepParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt;
      if (p.age >= p.life) { particles.splice(i, 1); continue; }
      if (p.float) { p.vy += 1 * dt; } else { p.vy -= 22 * dt; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.04) { p.y = 0.04; p.vy *= -0.4; p.vx *= 0.6; p.vz *= 0.6; p.spin *= 0.6; }
    }
    particles.forEach((p, i) => {
      scratch.position.set(p.x, p.y, p.z);
      scratch.rotation.set(p.age * p.spin, p.age * p.spin * 0.7, 0);
      const fade = p.size < 1 ? Math.min(1, (p.life - p.age) * 3) : 1 - p.age / p.life;
      scratch.scale.set(p.size * fade, p.size * fade * (p.size < 1 ? 0.6 : 1), p.size * fade);
      scratch.updateMatrix();
      particleMesh.setMatrixAt(i, scratch.matrix);
      particleMesh.setColorAt(i, tint.set(p.color));
    });
    particleMesh.count = particles.length;
    particleMesh.instanceMatrix.needsUpdate = true;
    if (particleMesh.instanceColor) particleMesh.instanceColor.needsUpdate = true;
  }

  function stepPopups(dt) {
    for (let i = popups.length - 1; i >= 0; i--) {
      const p = popups[i];
      p.age += dt;
      if (p.age >= 1) { p.el.remove(); popups.splice(i, 1); continue; }
      place(p.el, p.x, 1.6 + p.age * p.rise, p.z);
      p.el.style.opacity = String(1 - p.age * p.age);
    }
  }

  let lastSim = null;
  function draw(sim, dt) {
    if (sim !== lastSim) { clearModels(); buildArena(sim); lastSim = sim; }
    const now = performance.now() / 1000;

    camera.position.copy(cameraHome);
    // Picture mode can pull the camera in on a spot, keeping the same angle.
    const f = options.focus;
    if (f) camera.position.set(f.x + (cameraHome.x - lookAt.x) * f.zoom, cameraHome.y * f.zoom, f.z + (cameraHome.z - lookAt.z) * f.zoom);
    if (shake > 0.005) {
      camera.position.x += (Math.random() - 0.5) * shake;
      camera.position.z += (Math.random() - 0.5) * shake;
      shake *= Math.pow(0.002, dt);
    }
    camera.updateMatrixWorld();

    syncGuy(sim, dt, now);
    syncCreatures(sim, now, dt);
    syncProjectiles(sim, now);
    syncCoins(sim, now);
    syncLeftovers(sim, now, dt);
    syncBuffs(sim, now);
    syncTelegraphs(sim, now);
    reticle.visible = sim.state === 'fight' && !sim.idle;
    reticle.position.set(sim.aimX ?? 0, 0.03, sim.aimY ?? 0);
    reticle.rotation.y = now * 1.5;
    gunLight.position.set(sim.guy.x + Math.cos(sim.guy.aim) * 0.8, 1.2, sim.guy.y + Math.sin(sim.guy.aim) * 0.8);
    gunLight.intensity = lightPulse * 2.2;
    lightPulse *= Math.pow(0.0005, dt);
    stepParticles(dt);
    stepBlasts(dt);
    stepZaps(dt);
    stepTallies(dt);
    stepPopups(dt);
    renderer.render(scene, camera);
  }

  // debug lets the browser console move the camera for a closer look at a model.
  return { draw, onEvents, toWorld, resize, options, ready, setLook, debug: { camera, cameraHome, scene, creatureModels, guyRig: () => guyRig, held: () => held } };
}
