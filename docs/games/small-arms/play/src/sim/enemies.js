// What each creature does. Every attack sets e.tele, the warning on the floor, for its
// whole wind-up before anything can hurt. The same creatures as Contract Zero, with the
// same tells. No DOM here: this runs headless too.

export function angleDiff(a, b) {
  const d = a - b;
  return Math.atan2(Math.sin(d), Math.cos(d));
}

// States in which touching the guy is an attack rather than a bump.
export const ATTACKING = new Set(['charge', 'lunge']);

export function startState(sim, e) {
  e.tele = null;
  e.progress = 0;
  e.strafe = sim.rng.chance(0.5) ? 1 : -1;
  if (e.kind === 'charger' || e.kind === 'bigone') { e.state = 'stalk'; e.timer = e.def.stalkTime * sim.rng.range(0.6, 1.1); }
  else if (e.kind === 'spitter' || e.kind === 'thrower') { e.state = 'roam'; e.timer = e.def.cooldown * sim.rng.range(0.4, 0.9); }
  else if (e.kind === 'shell') { e.state = 'stalk'; e.timer = e.def.rest; }
  else { e.state = 'chase'; e.timer = 0; }
}

function turnToward(e, x, y, rate, dt) {
  const want = Math.atan2(y - e.y, x - e.x);
  const off = angleDiff(want, e.angle);
  e.angle += Math.max(-rate * dt, Math.min(rate * dt, off));
  return Math.abs(angleDiff(want, e.angle));
}

function drive(e, angle, speed, grip = 0.15) {
  e.vx += (Math.cos(angle) * speed - e.vx) * grip;
  e.vy += (Math.sin(angle) * speed - e.vy) * grip;
}

function stop(e, grip = 0.2) {
  e.vx -= e.vx * grip;
  e.vy -= e.vy * grip;
}

// Creatures go for sim.target: him, or a decoy or smoke bomb while one is out.
const toGuy = (sim, e) => ({ dx: sim.target.x - e.x, dy: sim.target.y - e.y, d: Math.hypot(sim.target.x - e.x, sim.target.y - e.y) });

function lineTele(sim, e, width, maxLength) {
  const length = sim.rayToWall(e.x, e.y, e.angle, maxLength);
  return { type: 'line', x1: e.x, y1: e.y, x2: e.x + Math.cos(e.angle) * length, y2: e.y + Math.sin(e.angle) * length, width, progress: 0 };
}

// Keep between near and far from him, circling while in that band.
function keepRange(sim, e, near, far) {
  const { dx, dy, d } = toGuy(sim, e);
  const face = Math.atan2(dy, dx);
  e.angle = face;
  if (d < near) drive(e, face + Math.PI, e.speed);
  else if (d > far) drive(e, face, e.speed);
  else drive(e, face + e.strafe * Math.PI / 2, e.speed * 0.6);
  // Turn round at walls and now and then for no reason.
  if (e.bumped || sim.rng.chance(0.004)) e.strafe = -e.strafe;
}

// ----- Charger: turn, warn along the whole path, then go. Also the Big One's body. -----
function charger(sim, e, dt) {
  const def = e.def;
  const enraged = e.phase === 3;
  if (e.state === 'stalk') {
    const { d } = toGuy(sim, e);
    const off = turnToward(e, sim.target.x, sim.target.y, def.turnRate * (enraged ? 1.4 : 1), dt);
    drive(e, e.angle, d > def.keepAway ? e.speed : e.speed * 0.25);
    e.timer -= dt;
    // Only wind up once it is really facing him, so the warning is honest.
    if (e.timer <= 0 && off < 0.08) {
      e.state = 'windup';
      e.windup = sim.windup(def.windup) * (enraged ? 0.75 : 1);
      e.timer = e.windup;
      e.tele = lineTele(sim, e, e.r * 2 + 0.2, def.chargeSpeed * def.chargeMax);
    }
  } else if (e.state === 'windup') {
    stop(e);
    e.timer -= dt;
    e.progress = Math.min(1, 1 - e.timer / e.windup);
    e.tele.progress = e.progress;
    if (e.timer <= 0) {
      e.state = 'charge';
      e.timer = def.chargeMax;
      e.tele = null;
      e.vx = Math.cos(e.angle) * def.chargeSpeed;
      e.vy = Math.sin(e.angle) * def.chargeSpeed;
    }
  } else if (e.state === 'charge') {
    e.vx = Math.cos(e.angle) * def.chargeSpeed;
    e.vy = Math.sin(e.angle) * def.chargeSpeed;
    e.timer -= dt;
    if (e.bumped) {
      // Ran into a wall: stunned, and it takes extra damage while it's dazed.
      e.state = 'stunned';
      e.timer = def.stun;
      e.vx = e.vy = 0;
      sim.onCrash?.(e);
    } else if (e.timer <= 0) {
      afterCharge(sim, e);
    }
  } else if (e.state === 'stunned') {
    stop(e, 0.3);
    e.timer -= dt;
    if (e.timer <= 0) afterCharge(sim, e);
  } else if (e.state === 'spitwind') {
    stop(e);
    turnToward(e, sim.target.x, sim.target.y, def.turnRate, dt);
    e.timer -= dt;
    e.progress = Math.min(1, 1 - e.timer / e.windup);
    if (e.timer <= 0) {
      // A spread of goo round where he stands.
      for (let i = 0; i < def.volley; i++) {
        const a = sim.rng.range(0, Math.PI * 2);
        const r = i === 0 ? 0 : sim.rng.range(1.5, 3.5);
        const tx = Math.max(1, Math.min(31, sim.target.x + Math.cos(a) * r));
        const ty = Math.max(1, Math.min(17, sim.target.y + Math.sin(a) * r));
        glob(sim, e, tx, ty, def.glob * sim.rng.range(0.9, 1.2), def.blast, def.hit * 0.6);
      }
      e.state = 'stalk';
      e.timer = def.stalkTime;
    }
  }
}

function afterCharge(sim, e) {
  e.tele = null;
  if (e.kind === 'bigone' && e.phase >= 2) {
    if (e.phase === 3) sim.summon('swarm', e.def.summon, e);
    e.state = 'spitwind';
    e.windup = sim.windup(0.8);
    e.timer = e.windup;
  } else {
    e.state = 'stalk';
    e.timer = e.def.stalkTime;
  }
}

function glob(sim, e, tx, ty, flight, blast, damage) {
  sim.enemyShot({ kind: 'glob', x: e.x, y: e.y, fromX: e.x, fromY: e.y, tx, ty, flight, blast, damage, owner: e.id });
}

// ----- Spitter: stays back and lobs goo where he is about to be. -----
function spitter(sim, e, dt) {
  const def = e.def;
  if (e.state === 'roam') {
    keepRange(sim, e, def.keepMin, def.keepMax);
    e.timer -= dt;
    if (e.timer <= 0) {
      e.state = 'windup';
      e.windup = sim.windup(def.windup);
      e.timer = e.windup;
    }
  } else if (e.state === 'windup') {
    stop(e);
    e.timer -= dt;
    e.progress = Math.min(1, 1 - e.timer / e.windup);
    if (e.timer <= 0) {
      // Aims a little ahead of where he's running.
      const g = sim.target;
      const tx = Math.max(1, Math.min(31, g.x + g.vx * 0.35));
      const ty = Math.max(1, Math.min(17, g.y + g.vy * 0.35));
      glob(sim, e, tx, ty, def.glob, def.blast, def.hit);
      e.state = 'roam';
      e.timer = def.cooldown * sim.rng.range(0.8, 1.2);
    }
  }
}

// ----- Thrower: keeps away, shows the line, then throws a rock down it. -----
function thrower(sim, e, dt) {
  const def = e.def;
  if (e.state === 'roam') {
    keepRange(sim, e, def.keepAway - 2, def.keepAway + 2);
    e.timer -= dt;
    if (e.timer <= 0) {
      e.state = 'windup';
      e.windup = sim.windup(def.windup);
      e.timer = e.windup;
      e.tele = lineTele(sim, e, 0.6, 40);
    }
  } else if (e.state === 'windup') {
    stop(e);
    // It tracks him for most of the wind-up, then locks, so a late sidestep works.
    if (e.timer > e.windup * 0.35) turnToward(e, sim.target.x, sim.target.y, 4, dt);
    e.timer -= dt;
    e.progress = Math.min(1, 1 - e.timer / e.windup);
    e.tele = lineTele(sim, e, 0.6, 40);
    e.tele.progress = e.progress;
    if (e.timer <= 0) {
      const sx = e.x + Math.cos(e.angle) * (e.r + 0.3);
      const sy = e.y + Math.sin(e.angle) * (e.r + 0.3);
      sim.enemyShot({ kind: 'rock', x: sx, y: sy, vx: Math.cos(e.angle) * def.rockSpeed, vy: Math.sin(e.angle) * def.rockSpeed, r: 0.32, damage: def.hit, owner: e.id });
      e.tele = null;
      e.state = 'roam';
      e.timer = def.cooldown * sim.rng.range(0.8, 1.2);
    }
  }
}

// ----- Shell: armoured front, turns slowly, lunges when close. -----
function shell(sim, e, dt) {
  const def = e.def;
  if (e.state === 'stalk') {
    const { d } = toGuy(sim, e);
    const off = turnToward(e, sim.target.x, sim.target.y, def.turnRate, dt);
    drive(e, e.angle, off < 0.6 ? e.speed : e.speed * 0.3);
    e.timer -= dt;
    if (e.timer <= 0 && d < def.range && off < 0.2) {
      e.state = 'windup';
      e.windup = sim.windup(def.windup);
      e.timer = e.windup;
      e.tele = lineTele(sim, e, e.r * 2, def.lungeSpeed * def.lungeTime + e.r);
    }
  } else if (e.state === 'windup') {
    stop(e);
    e.timer -= dt;
    e.progress = Math.min(1, 1 - e.timer / e.windup);
    e.tele.progress = e.progress;
    if (e.timer <= 0) {
      e.state = 'lunge';
      e.timer = def.lungeTime;
      e.tele = null;
    }
  } else if (e.state === 'lunge') {
    e.vx = Math.cos(e.angle) * def.lungeSpeed;
    e.vy = Math.sin(e.angle) * def.lungeSpeed;
    e.timer -= dt;
    if (e.timer <= 0 || e.bumped) { e.state = 'recover'; e.timer = def.rest; e.vx *= 0.2; e.vy *= 0.2; }
  } else if (e.state === 'recover') {
    // Winded after a lunge: it stands still and doesn't turn, so a dodge leaves its back open.
    stop(e, 0.3);
    e.timer -= dt;
    if (e.timer <= 0) { e.state = 'stalk'; e.timer = 0.4; }
  }
}

// ----- Swarm: straight at him, weaving a little so they don't stack. -----
function swarm(sim, e) {
  const { dx, dy } = toGuy(sim, e);
  const weave = Math.sin(sim.time * 3 + e.id * 1.7) * 0.5;
  e.angle = Math.atan2(dy, dx);
  drive(e, e.angle + weave, e.speed, 0.12);
}

export function think(sim, e, dt) {
  if (e.kind === 'bigone') {
    const share = e.hp / e.maxHp;
    const phase = share > 0.66 ? 1 : share > 0.33 ? 2 : 3;
    if (phase !== e.phase) {
      e.phase = phase;
      sim.onPhase?.(e);
    }
  }
  if (e.kind === 'charger' || e.kind === 'bigone') charger(sim, e, dt);
  else if (e.kind === 'spitter') spitter(sim, e, dt);
  else if (e.kind === 'thrower') thrower(sim, e, dt);
  else if (e.kind === 'shell') shell(sim, e, dt);
  else swarm(sim, e);
}
