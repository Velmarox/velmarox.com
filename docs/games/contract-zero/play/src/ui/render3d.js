// The 3D look: low-poly, flat-shaded models over the same 2D fight.
// Sim x is three.js x, sim y is three.js z, and y is up. Reads the sim and never changes it.

import * as THREE from '../../lib/three.module.js';
import { ROOM, tuning } from '../sim/tuning.js';
import { PIT, BUMPERS, ICE, DISPENSER, EXIT } from '../content/arenas.js';
import { MODIFIERS } from '../content/creatures.js';
import { guySkin, creatureSkin, LOOKS } from './skins.js';

const COLORS = {
  sky: 0xd9bcc8, floor: 0xdfc4ce, grid: 0xcbaab8, wall: 0x9a7a8c,
  guyLow: 0xe58f7c,
  crate: 0xc98f52, tire: 0x5d5468, barrel: 0x5fa3b5, pipe: 0x8a93a6, anvil: 0x3c3f4a, dummy: 0xe56b6f,
  hurt: 0xc2264b, ink: 0x4a3040, aim: 0x5a3550, aimFull: 0xe8590c, meter: 0x2f8ea8, dark: 0x2b1f30,
  bone: 0xfff3e6, ice: 0x9ad8ff, exit: 0x3fa66b, bumper: 0xf2b23c,
};
const TIER_COLORS = [0x8a7080, 0x4a3040, 0xe8590c, 0xc2185b];
const TIER_LABELS = ['weak', 'SOLID', 'BIG!', 'MASSIVE!!'];
const CARRY_HEIGHT = 0.95;
const MAX_PARTICLES = 360;

const css = (hex) => `#${hex.toString(16).padStart(6, '0')}`;

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
  const options = { shake: !window.matchMedia('(prefers-reduced-motion: reduce)').matches };
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

  const flat = (color, extra) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0.05, ...extra });
  const glow = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: false });
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

  // ----- the parts of the room a contract adds: blocks, twists, the exit -----
  let arena = new THREE.Group();
  let exitPad = null;
  let dispenserPad = null;
  scene.add(arena);

  function buildArena(sim) {
    scene.remove(arena);
    arena = new THREE.Group();
    for (const b of sim.blocks) arena.add(solid(new THREE.BoxGeometry(b.hx * 2, 1.5, b.hy * 2), wallMat, b.x, 0.75, b.y));
    if (sim.twists.has('spikes')) {
      const spike = flat(COLORS.bone);
      for (let z = 0.6; z < ROOM.h; z += 0.9) {
        arena.add(solid(new THREE.ConeGeometry(0.22, 0.7, 4).rotateZ(Math.PI / 2), spike, ROOM.w - 0.3, 0.55, z));
      }
    }
    if (sim.twists.has('pit')) {
      const hole = new THREE.Mesh(floorDisc(PIT.r), glow(0x1a1016));
      hole.position.set(PIT.x, 0.02, PIT.y);
      const rim = new THREE.Mesh(new THREE.RingGeometry(PIT.r, PIT.r + 0.18, 28).rotateX(-Math.PI / 2), glow(COLORS.ink));
      rim.position.set(PIT.x, 0.03, PIT.y);
      arena.add(hole, rim);
    }
    if (sim.twists.has('bumpers')) {
      for (const b of BUMPERS) {
        arena.add(
          solid(new THREE.CylinderGeometry(b.r, b.r * 1.1, 0.9, 8), flat(COLORS.bumper), b.x, 0.45, b.y),
          solid(new THREE.CylinderGeometry(b.r * 0.6, b.r * 0.6, 1.0, 8), flat(COLORS.bone), b.x, 0.5, b.y),
        );
      }
    }
    if (sim.twists.has('ice')) {
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(ICE.x2 - ICE.x1, ROOM.h).rotateX(-Math.PI / 2), glow(COLORS.ice, 0.45));
      sheet.position.set((ICE.x1 + ICE.x2) / 2, 0.015, ROOM.h / 2);
      arena.add(sheet);
      // Streaks, so the ice reads as ice without relying on its colour.
      for (let i = 0; i < 9; i++) {
        const streak = new THREE.Mesh(floorPatch(), glow(0xffffff, 0.6));
        streak.position.set(ICE.x1 + 0.6 + ((i * 2.3) % (ICE.x2 - ICE.x1 - 2)), 0.02, 1 + i * 1.9);
        streak.rotation.y = 0.5;
        streak.scale.set(1.4, 1, 0.07);
        arena.add(streak);
      }
    }
    exitPad = null;
    if (!sim.practice && !sim.contract.noExit) {
      exitPad = new THREE.Mesh(new THREE.PlaneGeometry(EXIT.x, EXIT.y2 - EXIT.y1).rotateX(-Math.PI / 2), glow(COLORS.grid, 0.8));
      exitPad.position.set(EXIT.x / 2, 0.02, (EXIT.y1 + EXIT.y2) / 2);
      arena.add(exitPad);
    }
    dispenserPad = null;
    if (!sim.practice) {
      dispenserPad = outline([[-0.7, -0.7], [0.7, -0.7], [0.7, 0.7], [-0.7, 0.7]], COLORS.grid);
      dispenserPad.position.set(DISPENSER.x, 0, DISPENSER.y);
      arena.add(dispenserPad);
    }
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
    const rig = { group, inner, centre, size: r / 0.5, arms: [], legs: [], phase: 0, lastForward: 0, lunge: 0, lastFoot: 0, lift: 0 };
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
      rig.arms.push({ shoulder, rest, side, swing: 0, lift: 0, swingSpeed: 0, liftSpeed: 0 });
    }
    if (decorate) decorate(inner, centre, r);
    return rig;
  }

  // Moves one character for one frame. velocity is in metres a second; pose may give
  // arms(arm) -> { swing, lift } to reach for something, plus lean, sway, and squash.
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
    for (const leg of rig.legs) leg.hip.rotation.z = leg.side * stride * 1.15 * effort;
    // A puff of dust each time a foot comes down.
    const foot = Math.floor(rig.phase / Math.PI);
    if (foot !== rig.lastFoot && effort > 0.4 && rig.size > 0.6) burst(rig.group.position.x, rig.group.position.z, 4, COLORS.grid, 2.2, 0.08);
    rig.lastFoot = foot;

    // Arms lag behind when the body speeds up and overshoot when it stops: that is the wobble.
    const push = step > 0 ? Math.max(-150, Math.min(150, (forward - rig.lastForward) / step)) : 0;
    rig.lastForward = forward;
    for (const arm of rig.arms) {
      const want = pose.arms ? pose.arms(arm) : { swing: -arm.side * stride * 1.5 * effort, lift: air * 0.9 * effort };
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

  // A sudden shove to both arms, for throws, grabs, and getting hit.
  function jolt(rig, swing, lift = 0) {
    if (!rig) return;
    for (const arm of rig.arms) { arm.swingSpeed += swing; arm.liftSpeed += lift; }
  }

  const skins = { guy: guySkin() };

  function makeGuy() {
    return makeCharacter({
      r: 0.5, skin: skins.guy, limbColor: COLORS.guyLow,
      arm: { length: 0.22, root: 0.12, tip: 0.08, turn: 1.45, rise: -0.25 },
      leg: { length: 0.3, top: 0.1, bottom: 0.06, spread: 0.4 },
    });
  }

  // Enemy types are told apart by size and colour (see LOOKS in skins.js). Size is the
  // creature's real radius in the fight, so a bigger enemy really is bigger.
  function makeCreature(c) {
    const look = LOOKS[c.kind];
    if (!skins[c.kind]) skins[c.kind] = creatureSkin(look);
    const r = c.r;
    return makeCharacter({
      r, skin: skins[c.kind], bodyExtra: { emissive: 0xffffff, emissiveIntensity: 1.2 },
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
        // The Shell's armour is a plate across the front: the side that ignores hits.
        if (c.def.armour) {
          const plate = new THREE.SphereGeometry(r * 1.1, 8, 5, Math.PI - c.def.armour, c.def.armour * 2, 0.5, 2.0);
          const mesh = solid(plate, flat(look.spike));
          mesh.position.copy(centre);
          mesh.scale.set(1, 0.92, 1);
          inner.add(mesh);
        }
        // Elite modifiers each add one visible part.
        if (c.mod === 'spiky') {
          const tip = flat(COLORS.bone);
          for (let i = 0; i < 10; i++) inner.add(stud(cone(0.1, 0.5, tip), centre, r * 1.2, (i / 10) * Math.PI * 2 + 0.3, 0.1));
        }
        if (c.mod === 'heavy') {
          const band = solid(new THREE.TorusGeometry(r * 0.98, r * 0.09, 4, 12).rotateX(Math.PI / 2), flat(0x3c3f4a, { metalness: 0.5 }));
          band.position.copy(centre);
          band.position.y -= r * 0.25;
          inner.add(band);
        }
        if (c.mod === 'splitting') {
          const seam = solid(new THREE.TorusGeometry(r * 0.97, r * 0.05, 4, 14).rotateY(Math.PI / 2), flat(COLORS.bone));
          seam.position.copy(centre);
          inner.add(seam);
        }
      },
    });
  }

  // The practice and tutorial target: it reads as "hit me" without any face.
  function makeDummy(r) {
    const group = new THREE.Group();
    group.add(
      solid(new THREE.CylinderGeometry(r, r, 0.6, 10), flat(COLORS.dummy), 0, 0.3, 0),
      solid(new THREE.CylinderGeometry(r * 0.66, r * 0.66, 0.68, 10), flat(COLORS.bone), 0, 0.34, 0),
      solid(new THREE.CylinderGeometry(r * 0.33, r * 0.33, 0.76, 10), flat(COLORS.dummy), 0, 0.38, 0),
    );
    return group;
  }

  function makeObject(kind) {
    const group = new THREE.Group();
    if (kind === 'crate') {
      const box = new THREE.BoxGeometry(0.8, 0.8, 0.8);
      group.add(solid(box, flat(COLORS.crate), 0, 0.4, 0));
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({ color: 0x6b4520 }));
      edges.position.y = 0.4;
      group.add(edges);
    } else if (kind === 'tire') {
      group.add(solid(new THREE.TorusGeometry(0.29, 0.13, 5, 9).rotateX(Math.PI / 2), flat(COLORS.tire), 0, 0.13, 0));
    } else if (kind === 'barrel') {
      group.add(
        solid(new THREE.CylinderGeometry(0.55, 0.55, 0.95, 8), flat(COLORS.barrel), 0, 0.475, 0),
        solid(new THREE.CylinderGeometry(0.58, 0.58, 0.12, 8), flat(0x8fd0e3), 0, 0.72, 0),
        solid(new THREE.CylinderGeometry(0.58, 0.58, 0.12, 8), flat(0x8fd0e3), 0, 0.23, 0),
      );
    } else if (kind === 'pipe') {
      const metal = flat(COLORS.pipe, { metalness: 0.5, roughness: 0.5 });
      group.add(
        solid(new THREE.CylinderGeometry(0.14, 0.14, 2.0, 6).rotateZ(Math.PI / 2), metal, 0, 0.14, 0),
        solid(new THREE.CylinderGeometry(0.19, 0.19, 0.12, 6).rotateZ(Math.PI / 2), metal, 0.92, 0.14, 0),
        solid(new THREE.CylinderGeometry(0.19, 0.19, 0.12, 6).rotateZ(Math.PI / 2), metal, -0.92, 0.14, 0),
      );
    } else {
      const iron = flat(COLORS.anvil, { metalness: 0.6, roughness: 0.5 });
      group.add(
        solid(new THREE.BoxGeometry(0.6, 0.25, 0.5), iron, 0, 0.125, 0),
        solid(new THREE.BoxGeometry(0.34, 0.2, 0.34), iron, 0, 0.35, 0),
        solid(new THREE.BoxGeometry(0.9, 0.22, 0.64), iron, 0, 0.56, 0),
      );
    }
    group.userData.lift = 0;
    return group;
  }

  // Health pips over a creature: bright cubes for health left, dark for health lost.
  function makePips(total, color) {
    const group = new THREE.Group();
    const lit = flat(color, { emissive: color, emissiveIntensity: 0.6 });
    const spent = flat(COLORS.dark);
    const cube = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    for (let i = 0; i < total; i++) group.add(solid(cube, lit, (i - (total - 1) / 2) * 0.42, 0, 0));
    group.userData = { lit, spent };
    return group;
  }

  const guyRig = makeGuy();
  const guyModel = guyRig.group;
  scene.add(guyModel);
  const objectModels = new Map();
  const creatureModels = new Map();
  let lastSim = null;

  // ----- markings on the floor -----
  const aimStrip = new THREE.Mesh(floorPatch(), glow(COLORS.aim, 0.9));
  aimStrip.visible = false;
  scene.add(aimStrip);

  const meterBack = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.86, 28).rotateX(-Math.PI / 2), glow(COLORS.meter, 0.28));
  const meterFill = new THREE.Mesh(new THREE.BufferGeometry(), glow(COLORS.meter));
  let meterShown = -1;
  scene.add(meterBack, meterFill);

  // Bungee Cord: a line from his hand to the object on the end of it.
  const cord = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: COLORS.ink }));
  cord.frustumCulled = false;
  cord.visible = false;
  scene.add(cord);

  // A telegraph is the whole area of the attack: an outlined shape that fills as the
  // wind-up runs out. Shape and fill carry the warning, so it doesn't depend on colour.
  const lineTeles = [];
  const circleTeles = [];
  function lineTele(i) {
    while (lineTeles.length <= i) {
      const group = new THREE.Group();
      const base = new THREE.Mesh(floorPatch(), glow(COLORS.hurt, 0.2));
      const fill = new THREE.Mesh(floorPatch(), glow(COLORS.hurt, 0.55));
      fill.position.y = 0.01;
      const edge = outline([[0, -0.5], [1, -0.5], [1, 0.5], [0, 0.5]], COLORS.hurt);
      group.add(base, fill, edge);
      group.userData = { base, fill, edge };
      scene.add(group);
      lineTeles.push(group);
    }
    return lineTeles[i];
  }
  function circleTele(i) {
    while (circleTeles.length <= i) {
      const group = new THREE.Group();
      const base = new THREE.Mesh(floorDisc(1), glow(COLORS.hurt, 0.2));
      const fill = new THREE.Mesh(floorDisc(1), glow(COLORS.hurt, 0.55));
      fill.position.y = 0.01;
      const edge = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 32).rotateX(-Math.PI / 2), glow(COLORS.hurt));
      edge.position.y = 0.02;
      group.add(base, fill, edge);
      group.userData = { fill };
      scene.add(group);
      circleTeles.push(group);
    }
    return circleTeles[i];
  }

  // ----- particles -----
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
        spin: Math.random() * 6, life: 0.5 + Math.random() * 0.4, age: 0, color,
      });
    }
  }

  // ----- words sit in HTML over the canvas -----
  const popups = [];
  const projected = new THREE.Vector3();

  function popup(x, z, text, tier) {
    const el = document.createElement('div');
    el.className = 'popup';
    el.textContent = text;
    el.style.color = css(TIER_COLORS[tier]);
    el.style.fontSize = `${18 + tier * 8}px`;
    overlay.append(el);
    popups.push({ el, x, z, age: 0 });
    if (popups.length > 14) popups.shift().el.remove();
  }

  function place(el, x, y, z) {
    projected.set(x, y, z).project(camera);
    el.style.transform = `translate(-50%, -50%) translate(${((projected.x + 1) / 2) * canvas.clientWidth}px, ${((1 - projected.y) / 2) * canvas.clientHeight}px)`;
  }

  const rigOf = (id) => creatureModels.get(id)?.rig;
  const bump = (amount) => { if (options.shake) shake = Math.max(shake, amount); };

  function onEvents(events) {
    for (const e of events) {
      if (e.type === 'impact') {
        if (e.onTarget || e.tier >= 1) popup(e.x, e.y, TIER_LABELS[e.tier], e.tier);
        burst(e.x, e.y, 3 + e.tier * 6, TIER_COLORS[e.tier], 4 + e.tier * 3);
        bump(e.tier * 0.14);
      } else if (e.type === 'throw') {
        // The throw: arms whip forward and the body lunges after them.
        jolt(guyRig, 42 + e.charge * 26, 10);
        guyRig.lunge = 0.6 + e.charge * 0.6;
      } else if (e.type === 'grab') {
        jolt(guyRig, 22, 16);
      } else if (e.type === 'drop') {
        jolt(guyRig, 6, -10);
      } else if (e.type === 'crash' || e.type === 'stagger') {
        jolt(rigOf(e.id), -30, 36);
      } else if (e.type === 'hostilethrow') {
        jolt(rigOf(e.id), 40, 8);
      } else if (e.type === 'break') {
        burst(e.x, e.y, 18, COLORS[e.kind], 8);
      } else if (e.type === 'death') {
        const look = LOOKS[e.kind];
        burst(e.x, e.y, 46, look ? look.top : COLORS.dummy, 12);
        burst(e.x, e.y, 14, look ? look.belly : COLORS.bone, 9);
        bump(0.45);
      } else if (e.type === 'hurt') {
        burst(e.x, e.y, 20, COLORS.hurt, 9);
        popup(e.x, e.y, 'OUCH', 3);
        jolt(guyRig, -34, 40);
        bump(0.4);
      } else if (e.type === 'block') {
        burst(e.x, e.y, 10, COLORS.ink, 7);
        popup(e.x, e.y, 'BLOCKED', 1);
      } else if (e.type === 'clang') {
        burst(e.x, e.y, 8, COLORS.bone, 8);
        popup(e.x, e.y, 'CLANG', 0);
      } else if (e.type === 'shieldbreak') {
        burst(e.x, e.y, 20, COLORS.ice, 9);
        popup(e.x, e.y, 'SHIELD DOWN', 1);
      } else if (e.type === 'stick') {
        const p = creatureModels.get(e.id)?.group.position;
        if (p) popup(p.x, p.z, 'STUCK', 1);
      } else if (e.type === 'spring') {
        popup(e.x, e.y, 'BOING', 2);
        burst(e.x, e.y, 10, COLORS.bumper, 8);
      } else if (e.type === 'blast') {
        burst(e.x, e.y, 30, COLORS.hurt, 10);
        bump(0.25);
      } else if (e.type === 'pitfall') {
        burst(e.x, e.y, 12, COLORS.dark, 4, 0.1);
      } else if (e.type === 'phase') {
        const p = creatureModels.get(e.id)?.group.position;
        if (p) popup(p.x, p.z, e.phase === 3 ? 'ENRAGED' : 'ANGRY', 3);
        bump(0.5);
      } else if (e.type === 'shove') {
        jolt(guyRig, 44, 8);
        guyRig.lunge = 0.5;
        for (let i = -3; i <= 3; i++) {
          const a = e.aim + i * 0.2;
          particles.push({ x: e.x, y: 0.5, z: e.y, vx: Math.cos(a) * 12, vy: 0.5, vz: Math.sin(a) * 12, spin: 3, life: 0.22, age: 0, color: COLORS.ink });
        }
      } else if (e.type === 'dispense') {
        burst(e.x, e.y, 10, COLORS.crate, 5);
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
      // The top and bottom keep a little room for the readout and the controls line.
      return corners.every((c) => {
        const p = c.clone().project(camera);
        return Math.abs(p.x) <= 0.97 && p.y <= 0.9 && p.y >= -0.9;
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
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const pointer = new THREE.Vector2();
  const groundHit = new THREE.Vector3();
  const lastWorld = { x: ROOM.w / 2, y: ROOM.h / 2 };

  // The cursor aims at the spot on the floor it points to.
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
  function dropCreature(entry) {
    scene.remove(entry.group, entry.pips, entry.ring);
    if (entry.bubble) scene.remove(entry.bubble);
    if (entry.tag) entry.tag.remove();
  }

  function clearModels() {
    for (const model of objectModels.values()) scene.remove(model);
    objectModels.clear();
    for (const entry of creatureModels.values()) dropCreature(entry);
    creatureModels.clear();
    for (const p of popups.splice(0)) p.el.remove();
    particles.length = 0;
  }

  // Where something he carries is shown: out in front at first, then drawn back over his
  // head as the throw charges. Looks only; the fight still launches it from the hold point.
  function carryPoint(sim) {
    const g = sim.guy;
    const p = g.body.getPosition();
    const extra = g.held && g.held.r ? g.held.r - 0.4 : 0;
    const reach = tuning.holdDistance + Math.max(0, extra) - g.charge * 1.0;
    return { x: p.x + Math.cos(g.aim) * reach, y: p.y + Math.sin(g.aim) * reach, reach, height: CARRY_HEIGHT + g.charge * 0.25 };
  }

  const flightLift = (item) => (item.airborne ? CARRY_HEIGHT * Math.sqrt(Math.max(0, item.flight) / tuning.flightTime) : 0);

  function syncObjects(sim, dt) {
    const seen = new Set();
    const hold = sim.guy.held ? carryPoint(sim) : null;
    let corded = null;
    for (const obj of sim.objects) {
      seen.add(obj.id);
      let model = objectModels.get(obj.id);
      if (!model) {
        model = makeObject(obj.kind);
        objectModels.set(obj.id, model);
        scene.add(model);
      }
      let p = obj.body.getPosition();
      let wanted = flightLift(obj);
      if (obj.held) { p = hold; wanted = hold.height; }
      else if (obj.heldBy) { p = obj.heldBy.body.getPosition(); wanted = obj.heldBy.r * 2 + 0.5; }
      model.userData.lift += (wanted - model.userData.lift) * Math.min(1, dt * 16);
      model.position.set(p.x, model.userData.lift, p.y);
      model.rotation.y = -obj.body.getAngle();
      // Wear shows as the object sagging, so durability isn't a hidden number.
      const worn = Number.isFinite(obj.def.durability) ? obj.wear / obj.def.durability : 0;
      model.scale.set(1 + worn * 0.08, 1 - worn * 0.22, 1 + worn * 0.08);
      if (obj.bungee) corded = model;
    }
    for (const [id, model] of objectModels) {
      if (!seen.has(id)) { scene.remove(model); objectModels.delete(id); }
    }
    cord.visible = Boolean(corded);
    if (corded) {
      const gp = guyModel.position;
      cord.geometry.setFromPoints([new THREE.Vector3(gp.x, 0.7, gp.z), new THREE.Vector3(corded.position.x, corded.position.y + 0.3, corded.position.z)]);
    }
  }

  function creaturePose(c, now) {
    if (c.state === 'windup') {
      // It rears back and shakes harder and harder, so the warning is on the body as well as the floor.
      return { lean: 0.55 * c.progress, squash: 0.12 * c.progress, sway: Math.sin(now * 38) * 0.07 * c.progress, arms: () => ({ swing: -2.2 * c.progress, lift: 1.0 }) };
    }
    if (c.state === 'charge' || c.state === 'lunge') return { lean: -0.3, arms: () => ({ swing: 2.4, lift: 0.5 }) };
    if (c.state === 'stunned') return { squash: 0.14, sway: Math.sin(now * 7) * 0.32, arms: (arm) => ({ swing: Math.sin(now * 7 + arm.side) * 0.9, lift: -1.6 }) };
    if (c.state === 'thrown' || c.held) return { arms: (arm) => ({ swing: Math.sin(now * 20 + arm.side) * 1.5, lift: 1.5 }) };
    if (c.carrying) return { arms: () => ({ swing: 0.4, lift: 2.4 }) };
    return {};
  }

  function syncCreatures(sim, now, dt) {
    const seen = new Set();
    const hold = sim.guy.held ? carryPoint(sim) : null;
    for (const c of sim.creatures) {
      seen.add(c.id);
      let entry = creatureModels.get(c.id);
      if (!entry) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.06, 4, 10).rotateX(Math.PI / 2), glow(COLORS.ink));
        ring.scale.setScalar(c.r / 0.85);
        const rig = c.kind === 'dummy' ? null : makeCreature(c);
        const showPips = !c.immortal && c.maxPips <= 12;
        entry = {
          rig, group: rig ? rig.group : makeDummy(c.r), ring, lift: 0,
          pips: makePips(showPips ? c.maxPips : 0, c.kind === 'dummy' ? COLORS.dummy : LOOKS[c.kind].belly),
        };
        if (c.mod === 'shielded') {
          entry.bubble = new THREE.Mesh(new THREE.IcosahedronGeometry(c.r * 1.45, 1), new THREE.MeshBasicMaterial({ color: COLORS.ice, transparent: true, opacity: 0.3, depthWrite: false }));
          scene.add(entry.bubble);
        }
        if (c.mod) {
          entry.tag = document.createElement('div');
          entry.tag.className = 'tag';
          entry.tag.textContent = MODIFIERS[c.mod].name;
          overlay.append(entry.tag);
        }
        creatureModels.set(c.id, entry);
        scene.add(entry.group, entry.pips, entry.ring);
      }
      const p = c.held ? hold : c.body.getPosition();
      const wanted = c.held ? hold.height : c.state === 'thrown' ? flightLift(c) : 0;
      entry.lift += (wanted - entry.lift) * Math.min(1, dt * 16);
      entry.group.position.set(p.x, entry.lift, p.y);
      entry.group.rotation.y = -c.body.getAngle();
      // Thrown, it tumbles.
      entry.group.rotation.z = c.state === 'thrown' && c.airborne ? now * 14 : 0;
      entry.group.scale.setScalar(c.state === 'windup' ? 1 + c.progress * 0.2 : 1);
      if (entry.rig) animate(entry.rig, dt * sim.timeScale, c.held ? { x: 0, y: 0 } : c.body.getLinearVelocity(), c.body.getAngle(), creaturePose(c, now));
      const top = c.r * 2.1 + 0.6 + entry.lift;
      entry.pips.position.set(p.x, top, p.y - c.r - 0.15);
      entry.pips.children.forEach((cube, i) => { cube.material = i < c.pips ? entry.pips.userData.lit : entry.pips.userData.spent; });
      entry.ring.visible = c.state === 'stunned';
      entry.ring.position.set(p.x, c.r * 1.8 + 0.5, p.y);
      entry.ring.rotation.y = now * 3;
      if (entry.bubble) {
        entry.bubble.visible = c.shield;
        entry.bubble.position.set(p.x, c.r + 0.3, p.y);
        entry.bubble.rotation.y = now;
      }
      if (entry.tag) place(entry.tag, p.x, top + 0.5, p.y - c.r - 0.15);
    }
    for (const [id, entry] of creatureModels) {
      if (!seen.has(id)) { dropCreature(entry); creatureModels.delete(id); }
    }
  }

  function syncTelegraphs(sim) {
    let lines = 0;
    let circles = 0;
    for (const t of sim.telegraphs()) {
      if (t.type === 'line') {
        const group = lineTele(lines++);
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
        const group = circleTele(circles++);
        group.visible = true;
        group.position.set(t.x, 0.03, t.y);
        group.scale.set(t.r, 1, t.r);
        const fill = Math.max(0.001, Math.min(1, t.progress));
        group.userData.fill.scale.set(fill, 1, fill);
      }
    }
    for (let i = lines; i < lineTeles.length; i++) lineTeles[i].visible = false;
    for (let i = circles; i < circleTeles.length; i++) circleTeles[i].visible = false;
  }

  function syncGuy(sim, dt) {
    const g = sim.guy;
    const p = g.body.getPosition();
    guyModel.position.set(p.x, 0, p.y);
    guyModel.rotation.y = -g.aim;
    // He flickers while he can't be hurt.
    guyModel.visible = !(g.safe > 0 && Math.floor(g.safe * 12) % 2 === 0);

    // Carrying: both arms reach for the object, and follow it back as the throw winds up.
    let pose = {};
    if (g.held) {
      const carry = carryPoint(sim);
      pose = {
        // Winding up: he crouches and leans right back.
        lean: 0.55 * g.charge,
        squash: 0.16 * g.charge,
        arms: (arm) => {
          const dx = carry.reach - arm.shoulder.position.x;
          const dy = carry.height + 0.3 - arm.shoulder.position.y;
          const dz = -arm.shoulder.position.z;
          const length = Math.hypot(dx, dy, dz) || 1;
          return { swing: (dx / length) * 3, lift: (dy / length) * 3 };
        },
      };
    }
    animate(guyRig, dt * sim.timeScale, g.body.getLinearVelocity(), g.aim, pose);

    aimStrip.visible = Boolean(g.held && g.armed);
    if (aimStrip.visible) {
      const hp = sim.holdPoint();
      aimStrip.position.set(hp.x, 0.04, hp.y);
      aimStrip.rotation.y = -g.aim;
      aimStrip.scale.set(2 + g.charge * 7, 1, 0.1 + g.charge * 0.12);
      aimStrip.material.color.set(g.charge >= 1 ? COLORS.aimFull : COLORS.aim);
    }

    // Aim meter: a ring on the floor that empties. Shown only when it isn't full.
    const share = g.meter / (tuning.aimMeterMax * sim.mods.meter);
    const showMeter = share < 0.999;
    meterBack.visible = showMeter;
    meterFill.visible = showMeter && share > 0.01;
    meterBack.position.set(p.x, 0.05, p.y);
    meterFill.position.set(p.x, 0.06, p.y);
    if (showMeter && Math.abs(share - meterShown) > 0.01) {
      meterFill.geometry.dispose();
      meterFill.geometry = new THREE.RingGeometry(0.72, 0.86, 28, 1, Math.PI / 2, Math.PI * 2 * share).rotateX(-Math.PI / 2);
      meterShown = share;
    }
  }

  function stepParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt;
      if (p.age >= p.life) { particles.splice(i, 1); continue; }
      p.vy -= 22 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.06) { p.y = 0.06; p.vy *= -0.4; p.vx *= 0.7; p.vz *= 0.7; }
    }
    particles.forEach((p, i) => {
      scratch.position.set(p.x, p.y, p.z);
      scratch.rotation.set(p.age * p.spin, p.age * p.spin * 0.7, 0);
      scratch.scale.setScalar(1 - p.age / p.life);
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
      place(p.el, p.x, 1.6 + p.age * 1.6, p.z);
      p.el.style.opacity = String(1 - p.age * p.age);
    }
  }

  function draw(sim, dt) {
    if (sim !== lastSim) { clearModels(); buildArena(sim); lastSim = sim; }
    const now = performance.now() / 1000;
    if (dispenserPad) dispenserPad.material.color.set(sim.dispenserTimer >= 0 ? COLORS.crate : COLORS.grid);
    if (exitPad) {
      exitPad.material.color.set(sim.exitOpen ? COLORS.exit : COLORS.grid);
      exitPad.material.opacity = sim.exitOpen ? 0.6 + Math.sin(now * 5) * 0.2 : 0.5;
    }

    camera.position.copy(cameraHome);
    if (shake > 0.005) {
      camera.position.x += (Math.random() - 0.5) * shake;
      camera.position.z += (Math.random() - 0.5) * shake;
      shake *= Math.pow(0.002, dt);
    }
    camera.updateMatrixWorld();

    syncGuy(sim, dt);
    syncObjects(sim, dt);
    syncCreatures(sim, now, dt);
    syncTelegraphs(sim);
    stepParticles(dt);
    stepPopups(dt);
    // Slow-motion shows as a tint at the edges, so the aim window is seen and not only felt.
    overlay.classList.toggle('slow', sim.timeScale < 1);
    renderer.render(scene, camera);
  }

  // debug lets the browser console move the camera for a closer look at a model.
  return { draw, onEvents, toWorld, resize, options, debug: { camera, cameraHome, scene, objectModels, creatureModels, guyRig } };
}
