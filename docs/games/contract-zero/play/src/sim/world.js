// The fight. No DOM, no canvas, no clock: it advances only when step(input) is called,
// so the same contract and inputs always give the same result, and it runs headless in Node.

import { World, Vec2, Circle, Box, WeldJoint } from '../../lib/planck.mjs';
import { tuning, STEP, STEP_HZ, ROOM } from './tuning.js';
import { impactEnergy, tierOf } from './impact.js';
import { makeRng } from './rng.js';
import { updateCreature, startState, angleDiff, ATTACKING } from './creatures.js';
import { OBJECTS } from '../content/objects.js';
import { CREATURES } from '../content/creatures.js';
import { ARENAS, PIT, BUMPERS, ICE, DISPENSER, EXIT, GUY_START, OBJECT_SLOTS, CREATURE_SLOTS } from '../content/arenas.js';

export const NO_INPUT = { moveX: 0, moveY: 0, aimAngle: 0, hold: false, shove: false };

// The room used for practice and, with three pips on the dummy, for the tutorial.
export const PRACTICE_CONTRACT = {
  seed: 1, threat: 1, arena: 'open', twists: [], noExit: true, fixed: true,
  creatures: [{ kind: 'dummy' }],
  objects: ['crate', 'crate', 'crate', 'tire', 'tire', 'barrel', 'barrel'],
};

const isCreature = (item) => 'pips' in item;

// opts.contract: what to fight (see game/contractGen.js). opts.gear and opts.injuries: ids.
// opts.practice: the dummy can't be beaten and broken objects come back.
export function createSim(opts = {}) {
  const contract = opts.contract ?? PRACTICE_CONTRACT;
  const practice = Boolean(opts.practice);
  const gear = new Set(opts.gear ?? []);
  const injuries = new Set(opts.injuries ?? []);
  const twists = new Set(contract.twists ?? []);
  const threat = contract.threat ?? 1;
  const world = new World({ gravity: Vec2(0, 0) });
  const rng = makeRng(contract.seed ?? 1);

  // What gear and injuries change, as multipliers on the live tuning numbers.
  const mods = {
    speed: (gear.has('boots') ? tuning.bootsSpeed : 1) * (injuries.has('limp') ? tuning.limp : 1),
    charge: injuries.has('arm') ? tuning.badArm : 1,
    meter: injuries.has('rattled') ? tuning.rattled : 1,
    power: gear.has('mitts') ? tuning.mittsPower : 1,
    grip: gear.has('mitts') ? 2 : 1,
  };

  const sim = {
    world, rng, contract, practice, gear, twists, mods,
    tick: 0, time: 0, timeScale: 1, events: [], result: null,
    guy: null, creatures: [], objects: [], blasts: [], respawns: [],
    dispenserTimer: -1, exitOpen: false, lastImpact: null, bite: 0,
    // Pips removed from creatures, by how. The balance runs read this.
    damage: { throw: 0, crash: 0, slam: 0, creature: 0, pit: 0 },
  };
  let nextId = 1;
  let pendingImpacts = [];
  let pendingWelds = [];

  // ----- room -----
  const t = ROOM.wall;
  const room = world.createBody({ type: 'static', userData: { kind: 'wall' } });
  const wall = (shape, spike = false) => room.createFixture({ shape, friction: 0.3, restitution: 0.2, userData: { kind: 'wall', spike } });
  wall(Box(ROOM.w / 2 + t, t / 2, Vec2(ROOM.w / 2, -t / 2)));
  wall(Box(ROOM.w / 2 + t, t / 2, Vec2(ROOM.w / 2, ROOM.h + t / 2)));
  wall(Box(t / 2, ROOM.h / 2 + t, Vec2(-t / 2, ROOM.h / 2)));
  wall(Box(t / 2, ROOM.h / 2 + t, Vec2(ROOM.w + t / 2, ROOM.h / 2)), twists.has('spikes'));
  sim.blocks = ARENAS[contract.arena ?? 'open'].blocks;
  for (const b of sim.blocks) wall(Box(b.hx, b.hy, Vec2(b.x, b.y)));
  if (twists.has('bumpers')) {
    for (const b of BUMPERS) {
      room.createFixture({ shape: Circle(Vec2(b.x, b.y), b.r), friction: 0, restitution: 1.5, userData: { kind: 'bumper' } });
    }
  }
  const tagOf = (fixture) => fixture.getUserData() ?? fixture.getBody().getUserData();
  const onIce = (p) => twists.has('ice') && p.x > ICE.x1 && p.x < ICE.x2;
  const inPit = (p) => twists.has('pit') && Math.hypot(p.x - PIT.x, p.y - PIT.y) < PIT.r;

  // ----- bodies -----
  function circleBody(x, y, radius, mass, opts2) {
    const body = world.createBody({ type: 'dynamic', position: Vec2(x, y), ...opts2 });
    body.createFixture({
      shape: Circle(radius), density: mass / (Math.PI * radius * radius),
      friction: opts2.friction ?? 0.4, restitution: opts2.restitution ?? 0.2,
    });
    return body;
  }

  function spawnObject(kind, x, y) {
    const def = OBJECTS[kind];
    const obj = {
      id: nextId++, kind, def, wear: 0, held: false, heldBy: null, stuckTo: null,
      flight: 0, airborne: false, hostile: false, sticky: false, spring: 0, springHit: false,
      bungee: null, bungeeTimer: 0, pulled: false, spawn: { x, y }, body: null,
    };
    const common = { linearDamping: def.slide, angularDamping: def.spin, userData: { kind: 'object', ref: obj } };
    if (def.shape === 'box') {
      obj.body = world.createBody({ type: 'dynamic', position: Vec2(x, y), ...common });
      obj.body.createFixture({
        shape: Box(def.hx, def.hy), density: def.mass / (def.hx * def.hy * 4), friction: 0.4, restitution: def.bounce,
      });
    } else {
      obj.body = circleBody(x, y, def.r, def.mass, { ...common, restitution: def.bounce });
    }
    sim.objects.push(obj);
    return obj;
  }

  function spawnCreature(kind, x, y, angle = Math.PI, { mod = null, scale = 1, pips = null } = {}) {
    const def = CREATURES[kind];
    const heavy = mod === 'heavy';
    const r = def.r * scale * (heavy ? 1.25 : 1);
    const life = (pips ?? def.pips) + (heavy ? 1 : 0);
    const c = {
      id: nextId++, kind, def, mod, r, pips: life, maxPips: life,
      toughness: def.toughness * (heavy ? 1.5 : 1),
      state: 'idle', timer: 0, angle, progress: 0, tele: null, slide: def.slide, phase: 1,
      shield: mod === 'shielded', shieldTimer: 0, stuck: [], extraMass: 0,
      held: false, flight: 0, airborne: false, carrying: null,
      immortal: practice && kind === 'dummy', body: null,
    };
    c.body = circleBody(Math.min(ROOM.w - r, Math.max(r, x)), Math.min(ROOM.h - r, Math.max(r, y)), r, def.mass * scale * scale * (heavy ? 2 : 1), {
      angle, linearDamping: def.slide, angularDamping: 2, friction: 0.3, restitution: 0.1,
      userData: { kind: 'creature', ref: c },
    });
    startState(sim, c);
    sim.creatures.push(c);
    return c;
  }

  const guyBody = circleBody(GUY_START.x, GUY_START.y, tuning.guyRadius, tuning.guyMass, {
    fixedRotation: true, friction: 0.1, restitution: 0, userData: { kind: 'guy' },
  });
  sim.guy = {
    body: guyBody, aim: 0, held: null, armed: false, charge: 0, pips: tuning.guyPips,
    meter: tuning.aimMeterMax * mods.meter, shoveCd: 0, mustRelease: false, safe: 0, stagger: 0, slow: 1,
  };
  const g = sim.guy;

  // Placement comes from the contract's seed, so a contract always lays out the same way.
  const creatureSlots = contract.fixed ? CREATURE_SLOTS : rng.shuffle(CREATURE_SLOTS);
  (contract.creatures ?? []).forEach((entry, i) => {
    const slot = creatureSlots[i % creatureSlots.length];
    const count = entry.count ?? CREATURES[entry.kind].count ?? 1;
    for (let n = 0; n < count; n++) {
      const a = (n / count) * Math.PI * 2;
      const spread = count > 1 ? 0.9 : 0;
      spawnCreature(entry.kind, slot.x + Math.cos(a) * spread, slot.y + Math.sin(a) * spread, Math.PI, {
        mod: entry.mod ?? null, pips: contract.tutorial ? 3 : null,
      });
    }
  });
  // The first object always sits right in front of the guy.
  const objectSlots = contract.fixed ? OBJECT_SLOTS : [OBJECT_SLOTS[0], ...rng.shuffle(OBJECT_SLOTS.slice(1))];
  (contract.objects ?? []).forEach((kind, i) => {
    const slot = objectSlots[i % objectSlots.length];
    spawnObject(kind, slot.x, slot.y);
  });

  // ----- helpers the creature behaviours use -----
  sim.guyPos = () => guyBody.getPosition();
  sim.spawnCreature = spawnCreature;
  sim.freeObjects = () => sim.objects.filter((o) => o.body && !o.held && !o.heldBy && !o.stuckTo && !o.airborne);

  // A wind-up gets shorter as Threat rises, but never shorter than the floor.
  sim.windup = (base) => Math.max(Math.min(base, tuning.windupFloor), base * (1 - tuning.windupPerThreat * (threat - 1)));

  // How far a straight line runs before it meets a wall, block, or bumper.
  sim.rayToWall = function rayToWall(p, angle, maxLength) {
    const end = Vec2(p.x + Math.cos(angle) * maxLength, p.y + Math.sin(angle) * maxLength);
    let hit = 1;
    world.rayCast(p, end, (fixture, point, normal, fraction) => {
      if (!fixture.getBody().isStatic()) return -1;
      hit = Math.min(hit, fraction);
      return fraction;
    });
    return maxLength * hit;
  };

  // A marked circle that goes off after `time` seconds.
  sim.addBlast = (x, y, r, time) => {
    sim.blasts.push({
      x: Math.min(ROOM.w - 0.5, Math.max(0.5, x)), y: Math.min(ROOM.h - 0.5, Math.max(0.5, y)), r, t: 0, total: time,
    });
  };

  sim.pickUp = function pickUp(c, obj) {
    obj.heldBy = c;
    obj.body.setActive(false);
    c.carrying = obj;
  };

  function letGo(c, speed, angle) {
    const obj = c.carrying;
    if (!obj) return null;
    const p = c.body.getPosition();
    c.carrying = null;
    obj.heldBy = null;
    const reach = c.r + 0.8;
    obj.body.setActive(true);
    obj.body.setTransform(Vec2(
      Math.min(ROOM.w - 0.6, Math.max(0.6, p.x + Math.cos(angle) * reach)),
      Math.min(ROOM.h - 0.6, Math.max(0.6, p.y + Math.sin(angle) * reach)),
    ), obj.def.sideways ? angle + Math.PI / 2 : obj.body.getAngle());
    obj.body.setLinearVelocity(Vec2(Math.cos(angle) * speed, Math.sin(angle) * speed));
    return obj;
  }

  // A creature's throw. The object can hurt the guy until it lands.
  sim.hostileThrow = function hostileThrow(c) {
    const obj = letGo(c, c.carrying ? c.carrying.def.throwSpeed * c.def.throwPower : 0, c.angle);
    if (!obj) return;
    obj.hostile = true;
    takeOff(obj);
    sim.events.push({ type: 'hostilethrow', id: c.id });
  };

  sim.stun = function stun(c, seconds) {
    if (c.carrying) letGo(c, 2, c.angle);
    c.state = 'stunned';
    c.timer = seconds;
    c.progress = 0;
    c.tele = null;
    c.slide = c.def.slide;
    c.body.setBullet(false);
  };

  // ----- impacts -----
  // Bodies can't be changed inside a contact callback, so impacts are queued and resolved after the step.
  const massOf = (body, tag) => (tag.kind === 'creature' ? body.getMass() + tag.ref.extraMass : body.getMass());

  world.on('begin-contact', (contact) => {
    const fA = contact.getFixtureA();
    const fB = contact.getFixtureB();
    const bA = fA.getBody();
    const bB = fB.getBody();
    const a = tagOf(fA);
    const b = tagOf(fB);
    const touchesGuy = a.kind === 'guy' || b.kind === 'guy';
    for (const [tag, other] of [[a, b], [b, a]]) {
      if (touchesGuy) break;
      if (tag.kind !== 'object' && tag.kind !== 'creature') continue;
      // Anything it touches ends a flight.
      tag.ref.flight = 0;
      if (tag.kind === 'object' && tag.ref.spring && (other.kind === 'wall' || other.kind === 'bumper')) tag.ref.springHit = true;
    }
    const wm = contact.getWorldManifold(null);
    let closing;
    let point;
    if (wm && wm.pointCount > 0) {
      point = wm.points[0];
      const vA = bA.getLinearVelocityFromWorldPoint(point);
      const vB = bB.getLinearVelocityFromWorldPoint(point);
      closing = Math.abs(Vec2.dot(Vec2.sub(vB, vA), wm.normal));
    } else {
      point = bA.isStatic() ? bB.getPosition() : bA.getPosition();
      closing = Vec2.sub(bB.getLinearVelocity(), bA.getLinearVelocity()).length();
    }
    pendingImpacts.push({
      a, b, x: point.x, y: point.y, speed: closing,
      energy: impactEnergy(massOf(bA, a), massOf(bB, b), closing),
    });
  });

  function resolveImpacts() {
    const hits = pendingImpacts;
    pendingImpacts = [];
    for (const hit of hits) {
      const { a, b } = hit;
      if (a.kind === 'guy' || b.kind === 'guy') {
        const other = a.kind === 'guy' ? b : a;
        const gp = guyBody.getPosition();
        const from = Math.atan2(hit.y - gp.y, hit.x - gp.x);
        if (other.kind === 'creature' && other.ref.body && (ATTACKING.has(other.ref.state) || other.ref.mod === 'spiky')) hurtGuy(from);
        if (other.kind === 'object' && other.ref.hostile && hit.speed >= tuning.hostileSpeed) {
          other.ref.hostile = false;
          hurtGuy(from);
        }
        continue;
      }
      if (hit.energy < tuning.minImpact) continue;

      const plainTier = tierOf(hit.energy);
      let tier = plainTier;
      let onTarget = false;
      for (const [side, other] of [[a, b], [b, a]]) {
        if (side.kind !== 'creature') continue;
        const landed = hitCreature(side.ref, other, hit);
        tier = onTarget ? Math.max(tier, landed) : landed;
        onTarget = true;
      }
      const impact = { type: 'impact', x: hit.x, y: hit.y, energy: hit.energy, speed: hit.speed, tier, kinds: [a.kind, b.kind], onTarget };
      sim.events.push(impact);
      if (onTarget || tier >= 1) sim.lastImpact = impact;
      for (const [side, other] of [[a, b], [b, a]]) {
        if (side.kind !== 'object') continue;
        // Sticky Gloves: a thrown object clings to the first creature it meets.
        // It clings instead of breaking on that hit.
        if (side.ref.sticky && other.kind === 'creature' && other.ref.body) { pendingWelds.push([side.ref, other.ref]); continue; }
        if (plainTier >= 1) wearDown(side.ref);
      }
    }
  }

  // One impact on one creature. Returns the tier that actually landed.
  function hitCreature(c, other, hit) {
    if (!c.body || sim.result) return 0;
    const def = c.def;
    const solidThing = other.kind === 'wall' || other.kind === 'bumper';
    const crashed = ATTACKING.has(c.state) && solidThing;
    let tier = tierOf(hit.energy, c.toughness);

    // Armour is a direction: hits that land on the front do nothing.
    if (def.armour && !crashed) {
      const p = c.body.getPosition();
      const side = angleDiff(Math.atan2(hit.y - p.y, hit.x - p.x), c.body.getAngle());
      if (Math.abs(side) < def.armour) {
        if (tier >= 1) sim.events.push({ type: 'clang', x: hit.x, y: hit.y });
        tier = 0;
      }
    }
    if (crashed) {
      sim.stun(c, def.stunCrash ?? 1.5);
      sim.events.push({ type: 'crash', id: c.id });
      // An armoured creature still hurts itself when it crashes.
      if (def.armour) tier = Math.max(tier, 1);
    }
    if (c.shield && tier >= 1) {
      c.shield = false;
      c.shieldTimer = tuning.shieldRegrow;
      sim.events.push({ type: 'shieldbreak', x: hit.x, y: hit.y, id: c.id });
      tier = 0;
    }
    if (other.kind === 'wall' && other.spike && tier >= 1) tier = Math.min(3, tier + 1);
    const staggers = tier >= 2 || (def.stunAny && tier >= 1);
    if (!crashed && staggers && def.stunStagger > 0 && c.state !== 'stunned' && c.state !== 'thrown') {
      sim.stun(c, def.stunStagger);
      sim.events.push({ type: 'stagger', id: c.id });
    }
    if (tier < 1) return 0;
    const source = crashed ? 'crash' : other.kind === 'object' ? 'throw' : other.kind === 'creature' ? 'creature' : 'slam';
    damage(c, tier, source);
    return tier;
  }

  function damage(c, tier, source) {
    if (c.immortal) return;
    const dealt = Math.min(tier, c.pips);
    c.pips -= dealt;
    sim.damage[source] += dealt;
    if (c.pips <= 0) kill(c);
  }

  function kill(c) {
    if (!c.body) return;
    const p = c.body.getPosition();
    sim.events.push({ type: 'death', x: p.x, y: p.y, kind: c.kind, id: c.id });
    if (c.carrying) letGo(c, 1, c.angle);
    for (const obj of c.stuck) obj.stuckTo = null;
    if (g.held === c) { g.held = null; g.armed = false; g.charge = 0; }
    world.destroyBody(c.body);
    c.body = null;
    sim.creatures.splice(sim.creatures.indexOf(c), 1);
    if (c.mod === 'splitting') {
      for (const side of [-1, 1]) {
        spawnCreature(c.kind, p.x + side * c.r * 0.6, p.y + side * 0.2, c.angle, { scale: 0.65, pips: Math.max(1, Math.floor(c.maxPips / 2)) });
      }
    }
  }

  function wearDown(obj) {
    if (!obj.body || obj.held || obj.heldBy) return;
    obj.wear += 1;
    if (obj.wear < obj.def.durability) return;
    const p = obj.body.getPosition();
    sim.events.push({ type: 'break', x: p.x, y: p.y, kind: obj.kind });
    removeObject(obj);
    if (practice) sim.respawns.push({ kind: obj.kind, x: obj.spawn.x, y: obj.spawn.y, at: sim.tick + tuning.respawnTime * STEP_HZ });
  }

  function removeObject(obj) {
    if (!obj.body) return;
    if (obj.stuckTo) {
      obj.stuckTo.stuck.splice(obj.stuckTo.stuck.indexOf(obj), 1);
      obj.stuckTo.extraMass -= obj.def.mass;
      obj.stuckTo = null;
    }
    world.destroyBody(obj.body);
    obj.body = null;
    sim.objects.splice(sim.objects.indexOf(obj), 1);
  }

  function weld() {
    for (const [obj, c] of pendingWelds) {
      if (!obj.body || !c.body || obj.stuckTo || c.stuck.length >= tuning.stuckMax) continue;
      world.createJoint(new WeldJoint({}, obj.body, c.body, obj.body.getPosition()));
      obj.stuckTo = c;
      obj.sticky = false;
      obj.bungee = null;
      c.stuck.push(obj);
      c.extraMass += obj.def.mass;
      sim.events.push({ type: 'stick', id: c.id });
    }
    pendingWelds = [];
  }

  // ----- the guy -----
  function holdPoint() {
    const p = guyBody.getPosition();
    const margin = 0.6;
    const extra = g.held && isCreature(g.held) ? g.held.r - 0.4 : 0;
    const reach = tuning.holdDistance + Math.max(0, extra);
    return {
      x: Math.min(ROOM.w - margin, Math.max(margin, p.x + Math.cos(g.aim) * reach)),
      y: Math.min(ROOM.h - margin, Math.max(margin, p.y + Math.sin(g.aim) * reach)),
    };
  }

  function take(item) {
    item.held = true;
    item.body.setActive(false);
    g.held = item;
    g.charge = 0;
  }

  // Objects, and stunned creatures small enough for his grip.
  function tryGrab() {
    const p = guyBody.getPosition();
    let best = null;
    let bestDist = Infinity;
    for (const obj of sim.objects) {
      if (obj.held || obj.heldBy || obj.stuckTo) continue;
      const d = Vec2.distance(p, obj.body.getPosition());
      if (d <= tuning.reach && d < bestDist) { best = obj; bestDist = d; }
    }
    for (const c of sim.creatures) {
      if (c.state !== 'stunned' || c.mod === 'spiky' || c.def.size > mods.grip || c.kind === 'dummy') continue;
      const d = Vec2.distance(p, c.body.getPosition()) - (c.r - 0.4);
      if (d <= tuning.reach && d < bestDist) { best = c; bestDist = d; }
    }
    if (!best) return false;
    take(best);
    g.armed = true;
    sim.events.push({ type: 'grab', kind: best.kind });
    return true;
  }

  function release(speed, thrown) {
    const item = g.held;
    const at = holdPoint();
    item.held = false;
    item.body.setActive(true);
    const sideways = !isCreature(item) && item.def.sideways;
    item.body.setTransform(Vec2(at.x, at.y), sideways ? g.aim + Math.PI / 2 : item.body.getAngle());
    item.body.setLinearVelocity(Vec2(Math.cos(g.aim) * speed, Math.sin(g.aim) * speed));
    if (!isCreature(item)) {
      item.body.setAngularVelocity(thrown ? item.def.throwSpin ?? (item.def.shape === 'box' ? speed * 0.3 : 0) : 0);
    } else {
      // A creature in the air can't act until it lands.
      item.state = 'thrown';
      item.tele = null;
      item.slide = item.def.slide;
      takeOff(item);
      if (!thrown) item.flight = 0.2;
    }
    g.held = null;
    g.armed = false;
    g.charge = 0;
    return item;
  }

  function throwHeld() {
    const charge = g.charge;
    const power = tuning.minCharge + (1 - tuning.minCharge) * charge;
    const item = release(g.held.def.throwSpeed * tuning.throwPower * mods.power * power, true);
    if (!isCreature(item)) {
      takeOff(item);
      item.sticky = gear.has('sticky');
      item.spring = gear.has('spring') && charge >= 1 ? item.body.getLinearVelocity().length() : 0;
      item.springHit = false;
      if (gear.has('bungee')) {
        for (const other of sim.objects) other.bungee = null;
        item.bungee = 'out';
      }
    }
    sim.events.push({ type: 'throw', kind: item.kind, charge });
  }

  // Costs a pip unless he is safe or a held object is in the way. Returns true if it hurt.
  function hurtGuy(from, { blockable = true } = {}) {
    if (g.safe > 0 || sim.result) return false;
    const gp = guyBody.getPosition();
    if (blockable && g.held && Math.abs(angleDiff(from, g.aim)) < tuning.blockArc) {
      release(3, false);
      g.mustRelease = true;
      g.safe = 0.4;
      sim.events.push({ type: 'block', x: gp.x, y: gp.y });
      return false;
    }
    g.pips -= 1;
    g.safe = tuning.hitSafety;
    if (gear.has('boots')) {
      // Heavy Boots: he takes the hit and stays where he is.
      guyBody.setLinearVelocity(Vec2(0, 0));
    } else {
      g.stagger = tuning.hitStagger;
      guyBody.setLinearVelocity(Vec2(-Math.cos(from) * tuning.hitKnockback, -Math.sin(from) * tuning.hitKnockback));
    }
    sim.events.push({ type: 'hurt', x: gp.x, y: gp.y, pips: g.pips });
    return true;
  }
  sim.hurtGuy = hurtGuy;

  function shove() {
    g.shoveCd = tuning.shoveCooldown * STEP_HZ;
    const p = guyBody.getPosition();
    const targets = sim.objects.filter((o) => !o.stuckTo).map((o) => [o.body, null]).concat(sim.creatures.map((c) => [c.body, c]));
    for (const [body, creature] of targets) {
      if (!body.isActive()) continue;
      const to = Vec2.sub(body.getPosition(), p);
      const dist = to.length();
      if (dist > tuning.shoveRange + 0.6 || dist === 0) continue;
      if (Math.abs(angleDiff(Math.atan2(to.y, to.x), g.aim)) > tuning.shoveArc) continue;
      const dv = Math.min(tuning.shoveImpulse / body.getMass(), tuning.shoveMaxDv);
      const v = body.getLinearVelocity();
      body.setLinearVelocity(Vec2(v.x + (to.x / dist) * dv, v.y + (to.y / dist) * dv));
      body.setAwake(true);
      // Small creatures are knocked silly, which is when he can pick them up.
      if (creature && creature.def.size <= 1 && creature.state !== 'thrown') sim.stun(creature, tuning.shoveStun);
    }
    sim.events.push({ type: 'shove', x: p.x, y: p.y, aim: g.aim });
  }

  // Magnet Glove: drag the nearest metal object across the room toward him.
  function magnetPull() {
    const p = guyBody.getPosition();
    let best = null;
    let bestDist = tuning.magnetRange;
    for (const obj of sim.objects) {
      if (!obj.def.metal || obj.held || obj.heldBy || obj.stuckTo) continue;
      const d = Vec2.distance(p, obj.body.getPosition());
      if (d < bestDist) { best = obj; bestDist = d; }
    }
    if (!best) return;
    const to = Vec2.sub(p, best.body.getPosition());
    to.normalize();
    const v = best.body.getLinearVelocity();
    const next = Vec2(v.x + to.x * tuning.magnetPull * STEP, v.y + to.y * tuning.magnetPull * STEP);
    if (next.length() > tuning.magnetSpeed) next.mul(tuning.magnetSpeed / next.length());
    best.body.setLinearVelocity(next);
    best.body.setAwake(true);
    best.pulled = true;
  }

  // ----- things in the air -----
  // A thrown thing flies: almost no drag until it hits something or its flight time runs
  // out, then it lands and slides to a stop.
  function takeOff(item) {
    item.flight = tuning.flightTime;
    item.airborne = true;
    item.body.setBullet(true);
  }

  function landItems(dt) {
    for (const obj of sim.objects) {
      if (!obj.airborne || obj.held) continue;
      obj.flight -= dt;
      if (obj.flight > 0) continue;
      obj.airborne = false;
      obj.hostile = false;
      obj.sticky = false;
      obj.body.setBullet(false);
      if (obj.bungee === 'out') { obj.bungee = 'wait'; obj.bungeeTimer = tuning.bungeeDelay; }
    }
    for (const c of sim.creatures) {
      if (c.state !== 'thrown' || c.held) continue;
      c.flight -= dt;
      if (c.flight > 0) continue;
      c.airborne = false;
      c.body.setBullet(false);
      sim.stun(c, 0.8);
    }
  }

  // Spring Arm: the first wall bounce of a full-charge throw keeps all its speed.
  function springBounces() {
    for (const obj of sim.objects) {
      if (!obj.springHit) continue;
      obj.springHit = false;
      const v = obj.body.getLinearVelocity();
      const speed = v.length();
      if (speed > 0.5) {
        obj.body.setLinearVelocity(Vec2(v.x * obj.spring / speed, v.y * obj.spring / speed));
        takeOff(obj);
        obj.flight = 0.8;
        sim.events.push({ type: 'spring', x: obj.body.getPosition().x, y: obj.body.getPosition().y });
      }
      obj.spring = 0;
    }
  }

  // Bungee Cord: after it lands, the object is hauled back to his hands.
  function bungees(dt) {
    for (const obj of sim.objects) {
      if (!obj.bungee || obj.bungee === 'out') continue;
      if (obj.stuckTo || obj.held || obj.heldBy) { obj.bungee = null; continue; }
      obj.bungeeTimer -= dt;
      if (obj.bungee === 'wait') {
        if (obj.bungeeTimer <= 0) { obj.bungee = 'back'; obj.bungeeTimer = 3; }
        continue;
      }
      const to = Vec2.sub(guyBody.getPosition(), obj.body.getPosition());
      const dist = to.length();
      if (dist < 1.4 || obj.bungeeTimer <= 0) {
        obj.bungee = null;
        obj.body.setBullet(false);
        if (dist < 1.4 && !g.held && !sim.result) {
          take(obj);
          g.armed = false;
          g.mustRelease = false;
          sim.events.push({ type: 'grab', kind: obj.kind });
        }
        continue;
      }
      obj.body.setBullet(true);
      obj.body.setLinearVelocity(Vec2(to.x / dist * tuning.bungeeSpeed, to.y / dist * tuning.bungeeSpeed));
    }
  }

  // ----- the floor: ice, the pit, the exit -----
  function applyFloor() {
    for (const obj of sim.objects) {
      if (obj.held || obj.heldBy) continue;
      const flying = obj.airborne || obj.bungee === 'back' || obj.pulled;
      obj.pulled = false;
      obj.body.setLinearDamping(flying ? tuning.flightDrag : obj.def.slide * (onIce(obj.body.getPosition()) ? tuning.iceSlide : 1));
    }
    for (const c of sim.creatures) {
      if (c.held) continue;
      const flying = c.state === 'thrown' && c.airborne;
      c.body.setLinearDamping(flying ? tuning.flightDrag : c.slide * (onIce(c.body.getPosition()) ? tuning.iceSlide : 1));
    }
  }

  function pitfalls() {
    if (!twists.has('pit')) return;
    for (const obj of [...sim.objects]) {
      if (obj.held || obj.heldBy || obj.stuckTo || obj.airborne || obj.bungee === 'back') continue;
      const p = obj.body.getPosition();
      if (!inPit(p)) continue;
      sim.events.push({ type: 'pitfall', x: p.x, y: p.y });
      removeObject(obj);
    }
    const edge = (r, toward) => {
      const dx = toward.x - PIT.x;
      const dy = toward.y - PIT.y;
      const d = Math.hypot(dx, dy) || 1;
      return Vec2(PIT.x + dx / d * (PIT.r + r + 0.3), PIT.y + dy / d * (PIT.r + r + 0.3));
    };
    for (const c of [...sim.creatures]) {
      if (c.held || (c.state === 'thrown' && c.airborne) || !c.body) continue;
      const p = c.body.getPosition();
      if (!inPit(p)) continue;
      sim.events.push({ type: 'pitfall', x: p.x, y: p.y });
      if (c.immortal) { c.body.setTransform(edge(c.r, { x: ROOM.w / 2, y: ROOM.h / 2 }), c.angle); continue; }
      // Small ones are gone. Bigger ones are hurt and climb out, dazed.
      if (c.def.size <= 1) { damage(c, c.pips, 'pit'); continue; }
      damage(c, tuning.pitDamage, 'pit');
      if (!c.body) continue;
      c.body.setTransform(edge(c.r, { x: ROOM.w / 2, y: ROOM.h / 2 }), c.angle);
      c.body.setLinearVelocity(Vec2(0, 0));
      sim.stun(c, 1.5);
    }
    const gp = guyBody.getPosition();
    if (inPit(gp)) {
      hurtGuy(0, { blockable: false });
      guyBody.setTransform(edge(tuning.guyRadius, { x: GUY_START.x, y: GUY_START.y }), 0);
      guyBody.setLinearVelocity(Vec2(0, 0));
    }
  }

  // Enough Swarm on him slows him, and after a visible count they bite.
  function swarmOnGuy(dt) {
    const gp = guyBody.getPosition();
    let on = 0;
    for (const c of sim.creatures) {
      if (c.kind !== 'swarm' || c.held || c.state !== 'chase') continue;
      if (Vec2.distance(gp, c.body.getPosition()) < c.r + tuning.guyRadius + 0.2) on += 1;
    }
    g.slow = gear.has('boots') ? 1 : Math.max(tuning.swarmSlowFloor, 1 - tuning.swarmSlow * on);
    if (on >= tuning.biteCount && g.safe <= 0) {
      sim.bite += dt / tuning.biteTime;
      if (sim.bite >= 1) {
        sim.bite = 0;
        hurtGuy(g.aim + Math.PI, { blockable: false });
      }
    } else {
      sim.bite = Math.max(0, sim.bite - dt * 2);
    }
  }

  function runBlasts(dt) {
    for (const blast of [...sim.blasts]) {
      blast.t += dt;
      if (blast.t < blast.total) continue;
      sim.blasts.splice(sim.blasts.indexOf(blast), 1);
      sim.events.push({ type: 'blast', x: blast.x, y: blast.y, r: blast.r });
      const gp = guyBody.getPosition();
      if (Math.hypot(gp.x - blast.x, gp.y - blast.y) < blast.r + tuning.guyRadius * 0.4) {
        hurtGuy(Math.atan2(blast.y - gp.y, blast.x - gp.x), { blockable: false });
      }
      // It shoves loose objects outward too.
      for (const obj of sim.objects) {
        if (obj.held || obj.heldBy || obj.stuckTo) continue;
        const p = obj.body.getPosition();
        const d = Math.hypot(p.x - blast.x, p.y - blast.y);
        if (d > blast.r || d === 0) continue;
        const dv = 7 * (1 - d / blast.r);
        const v = obj.body.getLinearVelocity();
        obj.body.setLinearVelocity(Vec2(v.x + (p.x - blast.x) / d * dv, v.y + (p.y - blast.y) / d * dv));
      }
    }
  }

  // Keeps a fight from getting stuck with nothing to throw.
  function runDispenser(dt) {
    if (sim.dispenserTimer < 0) {
      const free = sim.objects.filter((o) => !o.stuckTo && !o.heldBy).length;
      if (free < tuning.dispenserBelow) sim.dispenserTimer = tuning.dispenserDelay;
      return;
    }
    sim.dispenserTimer -= dt;
    if (sim.dispenserTimer > 0) return;
    sim.dispenserTimer = -1;
    spawnObject('crate', DISPENSER.x, DISPENSER.y);
    sim.events.push({ type: 'dispense', x: DISPENSER.x, y: DISPENSER.y });
  }

  // What the player is being warned about right now.
  sim.telegraphs = function telegraphs() {
    const out = [];
    for (const c of sim.creatures) if (c.tele) out.push(c.tele);
    for (const b of sim.blasts) out.push({ type: 'circle', x: b.x, y: b.y, r: b.r, progress: b.t / b.total });
    if (sim.bite > 0) {
      const p = guyBody.getPosition();
      out.push({ type: 'circle', x: p.x, y: p.y, r: 1.1, progress: sim.bite });
    }
    return out;
  };

  // ----- one step -----
  sim.step = function step(rawInput) {
    // Once the fight is decided the room keeps moving but the guy stops taking orders.
    const input = sim.result ? { ...NO_INPUT, aimAngle: g.aim, hold: Boolean(g.held && g.armed) } : rawInput;
    sim.events = [];
    g.aim = input.aimAngle;

    if (g.stagger <= 0) {
      let mx = input.moveX;
      let my = input.moveY;
      const len = Math.hypot(mx, my);
      if (len > 1) { mx /= len; my /= len; }
      const speed = tuning.guySpeed * mods.speed * g.slow;
      const accel = onIce(guyBody.getPosition()) && !gear.has('boots') ? tuning.iceAccel : tuning.guyAccel;
      const v = guyBody.getLinearVelocity();
      guyBody.setLinearVelocity(Vec2(v.x + (mx * speed - v.x) * accel, v.y + (my * speed - v.y) * accel));
    }

    if (!input.hold) g.mustRelease = false;
    if (g.shoveCd > 0) g.shoveCd -= 1;
    if (input.shove && g.held) {
      // Shove with full hands drops what he is carrying instead.
      release(2, false);
      g.mustRelease = true;
      sim.events.push({ type: 'drop' });
    } else if (input.shove && g.shoveCd <= 0) {
      shove();
    }

    if (input.hold && !g.held && !g.mustRelease) {
      if (!tryGrab() && gear.has('magnet')) magnetPull();
    }
    if (g.held) {
      // Something that arrived in his hands on its own is carried until he presses to throw.
      if (input.hold && !g.armed && !g.mustRelease) { g.armed = true; g.charge = 0; }
      if (g.armed) {
        if (input.hold) g.charge = Math.min(1, g.charge + STEP / (tuning.chargeTime * mods.charge));
        else throwHeld();
      }
    }

    const meterMax = tuning.aimMeterMax * mods.meter;
    if (g.held && g.armed && g.meter > 0 && !sim.result) {
      sim.timeScale = tuning.slowScale;
      if (!opts.endlessAim) g.meter = Math.max(0, g.meter - STEP);
    } else {
      sim.timeScale = 1;
      if (!(g.held && g.armed)) g.meter = Math.min(meterMax, g.meter + STEP * tuning.aimRefill);
    }

    const dt = STEP * sim.timeScale;
    sim.time += dt;
    if (g.safe > 0) g.safe -= dt;
    if (g.stagger > 0) g.stagger -= dt;
    for (const c of [...sim.creatures]) {
      if (!c.body) continue;
      updateCreature(sim, c, dt);
      if (c.shieldTimer > 0) {
        c.shieldTimer -= dt;
        if (c.shieldTimer <= 0 && c.mod === 'shielded') c.shield = true;
      }
    }
    applyFloor();

    world.step(dt);
    resolveImpacts();
    weld();
    springBounces();
    landItems(dt);
    bungees(dt);

    // A charge that starts or stays in contact never fires begin-contact, so check touching too.
    for (const c of sim.creatures) {
      if (c.held || !(ATTACKING.has(c.state) || c.mod === 'spiky')) continue;
      for (let edge = c.body.getContactList(); edge; edge = edge.next) {
        if (edge.other === guyBody && edge.contact.isTouching()) {
          const gp = guyBody.getPosition();
          const cp = c.body.getPosition();
          hurtGuy(Math.atan2(cp.y - gp.y, cp.x - gp.x));
          break;
        }
      }
    }
    swarmOnGuy(dt);
    runBlasts(dt);
    pitfalls();

    if (!practice) runDispenser(dt);
    if (!practice && !sim.result) {
      if (!contract.noExit) {
        sim.exitOpen = sim.time >= tuning.bailOpens;
        const gp = guyBody.getPosition();
        if (sim.exitOpen && gp.x < EXIT.x && gp.y > EXIT.y1 && gp.y < EXIT.y2) sim.result = 'bailed';
      }
      // Victory is checked first, so a tie on the same step goes to the player.
      if (sim.creatures.length === 0) sim.result = 'won';
      else if (g.pips <= 0) sim.result = 'lost';
      if (sim.result) sim.events.push({ type: 'result', result: sim.result });
    }

    for (let i = sim.respawns.length - 1; i >= 0; i--) {
      const r = sim.respawns[i];
      if (sim.tick >= r.at) {
        spawnObject(r.kind, r.x, r.y);
        sim.respawns.splice(i, 1);
      }
    }
    sim.tick += 1;
    return sim.events;
  };

  sim.holdPoint = holdPoint;
  sim.onIce = onIce;

  // For tests and the headless runner: fire an object without the guy.
  sim.launch = function launch(kind, x, y, vx, vy) {
    const obj = spawnObject(kind, x, y);
    obj.body.setLinearVelocity(Vec2(vx, vy));
    if (vx !== 0 || vy !== 0) takeOff(obj);
    return obj;
  };

  // A short text fingerprint of everything that moves, for determinism checks.
  sim.fingerprint = function fingerprint() {
    const bodies = [guyBody, ...sim.creatures.map((c) => c.body), ...sim.objects.map((o) => o.body)];
    const parts = bodies.map((b) => {
      const p = b.getPosition();
      return `${p.x},${p.y},${b.getAngle()}`;
    });
    return `${sim.tick}|${g.pips}|${parts.join('|')}`;
  };

  return sim;
}
