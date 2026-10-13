// What each creature does. Every attack sets c.tele, the telegraph the player sees, for
// its whole wind-up before anything can hurt. No DOM here: this runs headless too.

import { Vec2 } from '../../lib/planck.mjs';
import { ROOM } from './tuning.js';

export function angleDiff(a, b) {
  const d = a - b;
  return Math.atan2(Math.sin(d), Math.cos(d));
}

// States in which touching the guy is an attack.
export const ATTACKING = new Set(['charge', 'lunge']);

export function startState(sim, c) {
  const def = c.def;
  c.tele = null;
  c.progress = 0;
  c.slide = def.slide;
  if (c.kind === 'charger' || c.kind === 'bigone') { c.state = 'stalk'; c.timer = def.stalkTime; }
  else if (c.kind === 'spitter') { c.state = 'roam'; c.timer = def.cooldown * sim.rng.range(0.5, 1); }
  else if (c.kind === 'swarm') { c.state = 'chase'; c.timer = 0; }
  else if (c.kind === 'thrower') { c.state = 'seek'; c.timer = 0; }
  else if (c.kind === 'shell') { c.state = 'stalk'; c.timer = def.rest; }
  else { c.state = 'idle'; c.timer = 0; }
}

function face(c) {
  c.body.setTransform(c.body.getPosition(), c.angle);
  c.body.setAngularVelocity(0);
}

function turnToward(c, target, rate, dt) {
  const p = c.body.getPosition();
  const want = Math.atan2(target.y - p.y, target.x - p.x);
  const off = angleDiff(want, c.angle);
  c.angle += Math.max(-rate * dt, Math.min(rate * dt, off));
  face(c);
  return Math.abs(angleDiff(want, c.angle));
}

function drive(c, angle, speed, grip = 0.2) {
  const v = c.body.getLinearVelocity();
  c.body.setLinearVelocity(Vec2(
    v.x + (Math.cos(angle) * speed - v.x) * grip,
    v.y + (Math.sin(angle) * speed - v.y) * grip,
  ));
}

function lineTele(sim, c, width, maxLength) {
  const p = c.body.getPosition();
  const length = sim.rayToWall(p, c.angle, maxLength);
  return { type: 'line', x1: p.x, y1: p.y, x2: p.x + Math.cos(c.angle) * length, y2: p.y + Math.sin(c.angle) * length, width, progress: 0 };
}

// ----- Charger: turn, warn along the whole path, then go. Also the Big One's body. -----
function charger(sim, c, dt) {
  const def = c.def;
  const body = c.body;
  const gp = sim.guyPos();
  if (c.state === 'stalk') {
    const off = turnToward(c, gp, def.turnRate, dt);
    const far = Vec2.distance(gp, body.getPosition()) > def.keepAway;
    drive(c, c.angle, far ? def.stalkSpeed : 0);
    c.timer -= dt;
    // Only wind up once it is actually facing the guy, so the telegraph is honest.
    if (c.timer <= 0 && off < 0.05) {
      c.state = 'windup';
      c.windup = sim.windup(def.windup) * (c.phase === 3 ? 0.75 : 1);
      c.timer = c.windup;
      c.tele = lineTele(sim, c, c.r * 2 + 0.2, 60);
    }
  } else if (c.state === 'windup') {
    face(c);
    drive(c, c.angle, 0);
    c.timer -= dt;
    c.progress = Math.min(1, 1 - c.timer / c.windup);
    c.tele = lineTele(sim, c, c.r * 2 + 0.2, 60);
    c.tele.progress = c.progress;
    if (c.timer <= 0) {
      c.state = 'charge';
      c.tele = null;
      c.timer = def.chargeMax;
      c.slide = 0;
      body.setBullet(true);
      body.setLinearVelocity(Vec2(Math.cos(c.angle) * def.chargeSpeed, Math.sin(c.angle) * def.chargeSpeed));
    }
  } else if (c.state === 'charge') {
    body.setAngularVelocity(0);
    c.timer -= dt;
    if (c.timer <= 0 || body.getLinearVelocity().length() < def.stallSpeed) sim.stun(c, def.stunStall);
  }
}

// ----- Big One: a Charger that changes as it is hurt. -----
// Phase 1: charges. Phase 2: also rains blasts when it recovers. Phase 3: faster, and calls a swarm.
function bigone(sim, c, dt) {
  const share = c.pips / c.maxPips;
  const phase = share > 0.6 ? 1 : share > 0.3 ? 2 : 3;
  if (phase !== c.phase) {
    c.phase = phase;
    sim.events.push({ type: 'phase', id: c.id, phase });
  }
  charger(sim, c, dt);
}

export function onRecover(sim, c) {
  if (c.kind !== 'bigone' || c.phase < 2) return;
  const gp = sim.guyPos();
  for (let i = 0; i < c.def.volley; i++) {
    const a = sim.rng.range(0, Math.PI * 2);
    const d = i === 0 ? 0 : sim.rng.range(2, 4.5);
    sim.addBlast(gp.x + Math.cos(a) * d, gp.y + Math.sin(a) * d, c.def.blast, sim.windup(1.2) + i * 0.25);
  }
  if (c.phase < 3) return;
  const mine = sim.creatures.filter((o) => o.kind === 'swarm').length;
  const p = c.body.getPosition();
  for (let i = 0; i < c.def.summon && mine + i < 6; i++) {
    const a = c.angle + Math.PI + (i - 1) * 0.7;
    sim.spawnCreature('swarm', p.x + Math.cos(a) * (c.r + 0.6), p.y + Math.sin(a) * (c.r + 0.6), a);
  }
}

// ----- Spitter: keeps its distance and marks the spot it is about to hit. -----
function spitter(sim, c, dt) {
  const def = c.def;
  const p = c.body.getPosition();
  const gp = sim.guyPos();
  const toGuy = Math.atan2(gp.y - p.y, gp.x - p.x);
  c.angle = toGuy;
  face(c);
  if (c.state === 'roam') {
    const dist = Vec2.distance(gp, p);
    // Back off when crowded, close in when far, and circle in between.
    let heading = toGuy + (c.id % 2 ? 1 : -1) * Math.PI / 2;
    if (dist < def.keepMin) heading = toGuy + Math.PI;
    else if (dist > def.keepMax) heading = toGuy;
    // Don't back into a wall: slide along it.
    const nx = p.x + Math.cos(heading) * 1.5;
    const ny = p.y + Math.sin(heading) * 1.5;
    if (nx < 1 || nx > ROOM.w - 1 || ny < 1 || ny > ROOM.h - 1) heading = toGuy + (c.id % 2 ? 1 : -1) * Math.PI / 2;
    drive(c, heading, def.speed);
    c.timer -= dt;
    if (c.timer <= 0) {
      const time = sim.windup(def.windup);
      sim.addBlast(gp.x, gp.y, def.blast, time);
      c.state = 'windup';
      c.timer = Math.min(0.5, time);
    }
  } else if (c.state === 'windup') {
    drive(c, c.angle, 0);
    c.timer -= dt;
    c.progress = 1 - Math.max(0, c.timer) / 0.5;
    if (c.timer <= 0) { c.state = 'roam'; c.timer = def.cooldown; c.progress = 0; }
  }
}

// ----- Swarm: runs at you. The bite itself is counted in world.js, where it can be seen. -----
function swarm(sim, c) {
  const p = c.body.getPosition();
  const gp = sim.guyPos();
  // A small spread by id keeps them from stacking into one dot.
  const wobble = Math.sin(sim.time * 3 + c.id * 1.7) * 0.5;
  c.angle = Math.atan2(gp.y - p.y, gp.x - p.x) + wobble;
  face(c);
  drive(c, c.angle, c.def.speed, 0.15);
}

// ----- Thrower: fetches one of your objects and throws it back along a marked line. -----
function thrower(sim, c, dt) {
  const def = c.def;
  const p = c.body.getPosition();
  const gp = sim.guyPos();
  if (c.state === 'seek') {
    let best = null;
    let bestDist = Infinity;
    for (const obj of sim.freeObjects()) {
      const d = Vec2.distance(p, obj.body.getPosition());
      if (d < bestDist) { best = obj; bestDist = d; }
    }
    if (!best) {
      // Nothing to throw: hang back and wait for the dispenser.
      turnToward(c, gp, 4, dt);
      drive(c, c.angle, Vec2.distance(gp, p) > def.keepAway ? def.speed * 0.5 : 0);
      return;
    }
    turnToward(c, best.body.getPosition(), 6, dt);
    drive(c, c.angle, def.speed);
    if (bestDist < c.r + 1.0) {
      sim.pickUp(c, best);
      c.state = 'aim';
      c.timer = def.aimTime;
    }
  } else if (c.state === 'aim') {
    turnToward(c, gp, 7, dt);
    drive(c, c.angle, 0);
    c.timer -= dt;
    if (c.timer <= 0) {
      c.state = 'windup';
      c.windup = sim.windup(def.windup);
      c.timer = c.windup;
      c.tele = lineTele(sim, c, 1.1, 60);
    }
  } else if (c.state === 'windup') {
    face(c);
    drive(c, c.angle, 0);
    c.timer -= dt;
    c.progress = Math.min(1, 1 - c.timer / c.windup);
    c.tele = lineTele(sim, c, 1.1, 60);
    c.tele.progress = c.progress;
    if (c.timer <= 0) {
      c.tele = null;
      c.progress = 0;
      sim.hostileThrow(c);
      c.state = 'rest';
      c.timer = def.rest;
    }
  } else if (c.state === 'rest') {
    drive(c, c.angle, 0);
    c.timer -= dt;
    if (c.timer <= 0) c.state = 'seek';
  }
}

// ----- Shell: armoured in front, turns slowly, lunges a short way. -----
function shell(sim, c, dt) {
  const def = c.def;
  const body = c.body;
  const gp = sim.guyPos();
  if (c.state === 'stalk') {
    const off = turnToward(c, gp, def.turnRate, dt);
    drive(c, c.angle, def.speed);
    c.timer -= dt;
    if (c.timer <= 0 && off < 0.12 && Vec2.distance(gp, body.getPosition()) < def.range) {
      c.state = 'windup';
      c.windup = sim.windup(def.windup);
      c.timer = c.windup;
      c.tele = lineTele(sim, c, c.r * 2 + 0.2, def.lungeSpeed * def.lungeTime + c.r + 1.5);
    }
  } else if (c.state === 'windup') {
    face(c);
    drive(c, c.angle, 0);
    c.timer -= dt;
    c.progress = Math.min(1, 1 - c.timer / c.windup);
    c.tele = lineTele(sim, c, c.r * 2 + 0.2, def.lungeSpeed * def.lungeTime + c.r + 1.5);
    c.tele.progress = c.progress;
    if (c.timer <= 0) {
      c.state = 'lunge';
      c.tele = null;
      c.timer = def.lungeTime;
      c.slide = 0;
      body.setBullet(true);
      body.setLinearVelocity(Vec2(Math.cos(c.angle) * def.lungeSpeed, Math.sin(c.angle) * def.lungeSpeed));
    }
  } else if (c.state === 'lunge') {
    body.setAngularVelocity(0);
    c.timer -= dt;
    if (c.timer <= 0) {
      body.setBullet(false);
      c.slide = def.slide;
      c.progress = 0;
      c.state = 'stalk';
      c.timer = def.rest;
    }
  }
}

const BEHAVIOUR = { charger, bigone, spitter, swarm, thrower, shell };

export function updateCreature(sim, c, dt) {
  if (c.held || c.state === 'thrown') return;
  if (c.state === 'stunned') {
    c.timer -= dt;
    if (c.timer <= 0) {
      c.angle = c.body.getAngle();
      startState(sim, c);
      onRecover(sim, c);
    }
    return;
  }
  const act = BEHAVIOUR[c.kind];
  if (act) act(sim, c, dt);
}
