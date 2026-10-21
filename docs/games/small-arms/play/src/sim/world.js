// One round. No DOM, no canvas, no clock: main.js feeds it one input per step and draws
// what it returns, and the tests and the headless runner drive it the same way.
// Positions are metres; x runs right and y runs down the screen. Angles are radians.

import { ROOM, STEP, tuning } from './tuning.js';
import { makeRng } from './rng.js';
import { weaponStats, barrel } from '../content/weapons.js';
import { ENEMIES } from '../content/enemies.js';
import { POWERS } from '../content/cards.js';
import { startState, think, angleDiff, ATTACKING } from './enemies.js';
import { useAbility, usePower, abilityCooldown } from './effects.js';

// Where he holds a weapon, by class, in his own frame: fwd along the aim, side to his
// right, h off the floor. render3d puts the model here and reaches his arms to it.
export const HOLD = {
  handgun: { fwd: 0.6, side: 0, h: 0.55 },
  long: { fwd: 0.42, side: 0.2, h: 0.6 },
  melee: { fwd: 0.22, side: 0.56, h: 0.5 },
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// States in which bumping into a creature doesn't hurt.
const DAZED = new Set(['stunned', 'recover']);

// Pushes a circle out of a box. Returns true if they touched.
function pushOutOfBox(c, r, b) {
  const nx = clamp(c.x, b.x - b.hx, b.x + b.hx);
  const ny = clamp(c.y, b.y - b.hy, b.y + b.hy);
  const dx = c.x - nx;
  const dy = c.y - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return false;
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    c.x = nx + (dx / d) * r;
    c.y = ny + (dy / d) * r;
  } else {
    // The centre is inside the box: leave by the nearest side.
    const left = c.x - (b.x - b.hx);
    const right = b.x + b.hx - c.x;
    const top = c.y - (b.y - b.hy);
    const bottom = b.y + b.hy - c.y;
    const least = Math.min(left, right, top, bottom);
    if (least === left) c.x = b.x - b.hx - r;
    else if (least === right) c.x = b.x + b.hx + r;
    else if (least === top) c.y = b.y - b.hy - r;
    else c.y = b.y + b.hy + r;
  }
  return true;
}

const inBox = (x, y, b, pad = 0) => Math.abs(x - b.x) <= b.hx + pad && Math.abs(y - b.y) <= b.hy + pad;

// plan: { blocks: [{x, y, hx, hy}], groups: [{ at, enemies: [{ kind, mod }] }] }
// loadout: [{ id, level, rune }], up to four, one held at a time. ranks: { id: { damage, ... } }.
// abilities, powers: card ids. bonus: what his hat gives ({ speed, reload, coins, ... }).
export function createSim({
  seed = 1, wave = 1, plan = { blocks: [], groups: [] }, loadout = [{ id: 'pistol', level: 1 }],
  ranks = {}, held = 0, abilities = [], powers = [], bonus = {}, hp, maxHp, idle = false,
} = {}) {
  const rng = makeRng(seed);
  let nextId = 1;
  const top = maxHp ?? tuning.guyHp;
  const sim = {
    rng, wave, bonus, idle,
    time: 0,
    state: 'fight',      // 'fight', then 'cleared' while the coins come in, then 'done'; or 'dead'
    endTimer: 0,
    blocks: plan.blocks.map((b) => ({ ...b })),
    queue: plan.groups.map((g) => ({ ...g, enemies: [...g.enemies] })).sort((a, b) => a.at - b.at),
    spawns: [],
    enemies: [],
    bullets: [],
    shots: [],
    coins: [],
    allies: [],          // turrets, tesla coils, decoys, smoke
    mines: [],
    zones: [],           // fire on the floor
    strikes: [],         // airstrike blasts on their way down
    buffs: {},           // name -> seconds left
    cash: 0,
    tokens: 0,
    kills: 0,
    hurtTaken: 0,
    shotsFired: 0,
    xp: {},              // weapon id -> XP earned this round
    abilities: abilities.map((aid) => ({ id: aid, cd: 0 })),
    powers: [...powers],
    guy: {
      x: ROOM.w / 2, y: ROOM.h / 2, vx: 0, vy: 0, aim: 0,
      hp: hp ?? top, maxHp: top, safe: 0, dashT: 0, dashCd: 0, dashX: 0, dashY: 0, stagger: 0,
      plate: 0, jump: null, attack: null, swapT: 0,
    },
    held: Math.max(0, Math.min(held, loadout.length - 1)),
    weapons: loadout.map((w) => {
      const stats = weaponStats(w.id, w.level, ranks[w.id] ?? {}, bonus);
      return { id: w.id, level: w.level, rune: w.rune ?? null, stats, ammo: stats.mag ?? 0, reloadT: 0, cooldown: 0, aim: 0, x: 0, y: 0, kick: 0 };
    }),
  };
  sim.target = sim.guy;
  let events = [];
  const emit = (e) => events.push(e);
  sim.emit = emit;
  const id = () => nextId++;
  sim.nextId = id;

  const speedScale = Math.min(tuning.speedCap, 1 + tuning.speedPerWave * (wave - 1));
  const hpScale = 1 + tuning.hpPerWave * (wave - 1) + 0.004 * (wave - 1) ** 2;
  const cashScale = tuning.coinScale * (1 + tuning.cashPerWave * (wave - 1)) * (1 + (bonus.coins ?? 0));
  // Abilities and powers keep up with the creatures.
  sim.effectScale = 1 + 0.12 * (wave - 1);
  sim.heldWeapon = () => sim.weapons[sim.held];

  // ----- helpers the creatures and effects use -----
  sim.windup = (base) => Math.max(0.45, base * (1 - 0.018 * (wave - 1)));

  // How far a straight line runs before it meets a wall or block.
  sim.rayToWall = (x, y, angle, max = 60) => {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let best = max;
    const hit = (t) => { if (t > 0 && t < best) best = t; };
    if (dx > 1e-6) hit((ROOM.w - x) / dx); else if (dx < -1e-6) hit(-x / dx);
    if (dy > 1e-6) hit((ROOM.h - y) / dy); else if (dy < -1e-6) hit(-y / dy);
    for (const b of sim.blocks) {
      // Slab test against the box.
      let t0 = 0;
      let t1 = best;
      let ok = true;
      for (const [p, d, lo, hi] of [[x, dx, b.x - b.hx, b.x + b.hx], [y, dy, b.y - b.hy, b.y + b.hy]]) {
        if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) ok = false; continue; }
        let a = (lo - p) / d;
        let c = (hi - p) / d;
        if (a > c) [a, c] = [c, a];
        t0 = Math.max(t0, a);
        t1 = Math.min(t1, c);
      }
      if (ok && t0 <= t1 && t0 > 0) hit(t0);
    }
    return best;
  };

  sim.solidAt = (x, y, pad = 0) => x < pad || y < pad || x > ROOM.w - pad || y > ROOM.h - pad || sim.blocks.some((b) => inBox(x, y, b, pad));

  // A creature's shot. kind 'glob' is lobbed and lands at (tx, ty); 'rock' flies straight.
  sim.enemyShot = (shot) => {
    sim.shots.push({ id: id(), age: 0, ...shot });
    emit({ type: shot.kind, x: shot.x, y: shot.y });
  };

  // Calls creatures in with the usual warning marker.
  sim.summon = (kind, count, near) => {
    for (let i = 0; i < count; i++) {
      const a = rng.range(0, Math.PI * 2);
      const at = placeNear(near.x + Math.cos(a) * 2.5, near.y + Math.sin(a) * 2.5);
      sim.spawns.push({ id: id(), kind, mod: null, x: at.x, y: at.y, timer: tuning.spawnWarn, total: tuning.spawnWarn });
    }
  };

  // ----- creatures -----
  function makeEnemy(kind, mod, x, y, shrink = 1) {
    const def = ENEMIES[kind];
    let hpMax = def.hp * hpScale * shrink;
    let r = def.r * (shrink < 1 ? 0.72 : 1);
    let mass = def.mass;
    let speed = def.speed * speedScale;
    if (mod === 'heavy') { hpMax *= 1.8; r *= 1.25; mass *= 2; speed *= 0.85; }
    const e = {
      id: id(), kind, def, mod, x, y, vx: 0, vy: 0, kx: 0, ky: 0, r, mass, speed,
      hp: hpMax, maxHp: hpMax, shieldMax: mod === 'shielded' ? hpMax * 0.45 : 0, shield: 0, lastHit: -99,
      angle: Math.atan2(sim.guy.y - y, sim.guy.x - x), state: 'idle', timer: 0, tele: null, progress: 0,
      phase: 1, bumped: false, child: shrink < 1, flash: 0,
      // Statuses from runes and effects.
      burn: 0, burnDps: 0, poison: [], slowT: 0, frozen: 0, lastSrc: null,
    };
    e.shield = e.shieldMax;
    startState(sim, e);
    sim.enemies.push(e);
    emit({ type: 'arrive', id: e.id, kind, x, y });
    return e;
  }
  sim.makeEnemy = makeEnemy;
  sim.onCrash = (e) => emit({ type: 'crash', id: e.id, x: e.x, y: e.y });
  sim.onPhase = (e) => emit({ type: 'phase', id: e.id, x: e.x, y: e.y, phase: e.phase });

  function placeNear(x, y) {
    for (let i = 0; i < 12; i++) {
      const px = clamp(x + rng.range(-1, 1) * i * 0.3, 1.5, ROOM.w - 1.5);
      const py = clamp(y + rng.range(-1, 1) * i * 0.3, 1.5, ROOM.h - 1.5);
      if (!sim.solidAt(px, py, 1.2)) return { x: px, y: py };
    }
    return { x: clamp(x, 1.5, ROOM.w - 1.5), y: clamp(y, 1.5, ROOM.h - 1.5) };
  }
  sim.placeNear = placeNear;

  // Creatures come in from near the walls, never right on top of him.
  function edgeSpot() {
    const g = sim.guy;
    for (let i = 0; i < 20; i++) {
      const side = rng.int(4);
      const along = rng.range(0.1, 0.9);
      const x = side === 0 ? 1.6 : side === 1 ? ROOM.w - 1.6 : along * ROOM.w;
      const y = side === 2 ? 1.6 : side === 3 ? ROOM.h - 1.6 : along * ROOM.h;
      if (Math.hypot(x - g.x, y - g.y) > 7 && !sim.solidAt(x, y, 1.3)) return { x, y };
    }
    return { x: g.x > ROOM.w / 2 ? 2 : ROOM.w - 2, y: ROOM.h / 2 };
  }

  // The nearest live creature to a point, within a distance, skipping the ones in `not`.
  sim.nearestEnemy = (x, y, within = Infinity, not = null) => {
    let best = null;
    let bestD = within;
    for (const e of sim.enemies) {
      if (e.dead || e === not || (not instanceof Set && not.has(e))) continue;
      const d = Math.hypot(e.x - x, e.y - y) - e.r;
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  };
  const nearestEnemy = sim.nearestEnemy;

  sim.heal = (amount) => {
    const g = sim.guy;
    if (sim.state !== 'fight' && sim.state !== 'cleared') return;
    const before = g.hp;
    g.hp = Math.min(g.maxHp, g.hp + amount);
    if (g.hp - before >= 1) emit({ type: 'heal', x: g.x, y: g.y, amount: g.hp - before });
  };

  // src says where damage came from: { weapon, rune, melee } for weapons, {} for effects,
  // and dot for burning and poison ticks.
  function damage(e, amount, dirX, dirY, knock, src = {}) {
    if (e.dead) return 0;
    const dazed = e.state === 'stunned' || e.frozen > 0;
    let dealt = amount * (dazed ? tuning.stunDamage : 1) * (sim.buffs.rage > 0 && !src.dot ? 2 : 1);
    const shown = dealt;
    e.lastHit = sim.time;
    if (!src.dot) e.flash = 0.08;
    if (e.shield > 0) {
      const soak = Math.min(e.shield, dealt);
      e.shield -= soak;
      dealt -= soak;
      if (e.shield <= 0) emit({ type: 'shieldbreak', id: e.id, x: e.x, y: e.y });
    }
    e.hp -= dealt;
    const push = Math.min(14, knock / Math.max(1, e.mass * 0.6));
    e.kx += dirX * push;
    e.ky += dirY * push;
    if (src.weapon) {
      e.lastSrc = src.weapon;
      sim.xp[src.weapon] = (sim.xp[src.weapon] ?? 0) + (shown / 15) * (1 + (bonus.xp ?? 0));
    }
    if (!src.dot) {
      if (sim.buffs.vampire > 0) sim.heal(shown * 0.04);
      if (src.rune) applyRune(e, src.rune, shown, src);
    }
    emit({ type: 'hit', id: e.id, x: e.x, y: e.y, amount: shown, stunned: dazed, dot: Boolean(src.dot), rune: src.rune ?? null });
    if (e.hp <= 0) kill(e);
    return shown;
  }
  sim.damage = damage;

  function applyRune(e, rune, amount, src) {
    if (rune === 'fire') { e.burnDps = (e.burn > 0 ? e.burnDps * 0.5 : 0) + amount * 0.2; e.burn = 2.2; }
    else if (rune === 'frost') e.slowT = 1.6;
    else if (rune === 'venom') { e.poison.push({ dps: amount * 0.1, t: 3 }); if (e.poison.length > 5) e.poison.shift(); }
    else if (rune === 'blood') sim.heal(amount * 0.03);
    else if (rune === 'shock' && !src.chained) {
      const next = nearestEnemy(e.x, e.y, 3.5, e);
      if (next) {
        emit({ type: 'zap', points: [[e.x, e.y], [next.x, next.y]], small: true });
        damage(next, amount * 0.5, 0, 0, 0, { weapon: src.weapon, chained: true });
      }
    }
  }

  function kill(e) {
    e.dead = true;
    sim.kills++;
    emit({ type: 'death', id: e.id, kind: e.kind, x: e.x, y: e.y, r: e.r, boss: e.kind === 'bigone' });
    if (e.lastSrc) sim.xp[e.lastSrc] = (sim.xp[e.lastSrc] ?? 0) + e.def.xp * (1 + 0.05 * (wave - 1)) * (1 + (bonus.xp ?? 0)) * (e.child ? 0.5 : 1);
    // Cash comes out as coins that spray and then get pulled in.
    let value = Math.max(1, Math.round(e.def.cash * cashScale * (e.mod ? 1.6 : 1) * (e.child ? 0.5 : 1)));
    const count = Math.min(e.kind === 'bigone' ? 24 : 9, Math.max(1, Math.ceil(value / 4)));
    const spray = (kind, v) => {
      const a = rng.range(0, Math.PI * 2);
      const s = rng.range(2, 6) * (e.kind === 'bigone' ? 1.8 : 1);
      sim.coins.push({ id: id(), kind, x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, value: v, age: 0 });
    };
    for (let i = 0; i < count; i++) {
      const share = Math.round(value / (count - i));
      value -= share;
      spray('coin', share);
    }
    // Now and then a slot token drops: a free go on the machine between rounds.
    const tokens = e.kind === 'bigone' ? 3 : rng.chance(0.015) ? 1 : 0;
    for (let i = 0; i < tokens; i++) spray('token', 1);
    if (e.mod === 'splitting' && !e.child) {
      for (const side of [-1, 1]) {
        const a = e.angle + side * Math.PI / 2;
        const at = placeNear(e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r);
        const child = makeEnemy(e.kind, null, at.x, at.y, 0.45);
        child.kx = Math.cos(a) * 6;
        child.ky = Math.sin(a) * 6;
      }
    }
  }

  sim.explode = (x, y, radius, amount, knock, src = {}) => {
    emit({ type: 'blast', x, y, r: radius, rune: src.rune ?? null });
    for (const e of sim.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d > radius + e.r) continue;
      const falloff = 1 - 0.5 * Math.min(1, d / radius);
      const dx = d > 1e-6 ? (e.x - x) / d : 1;
      const dy = d > 1e-6 ? (e.y - y) / d : 0;
      damage(e, amount * falloff, dx, dy, knock, src);
    }
  };
  const explode = sim.explode;

  // ----- the guy -----
  function hurtGuy(amount, fromX, fromY) {
    const g = sim.guy;
    if (g.safe > 0 || g.dashT > 0 || g.jump || sim.buffs.bubble > 0 || sim.state !== 'fight') return;
    if (g.plate > 0) {
      const soak = Math.min(g.plate, amount);
      g.plate -= soak;
      amount -= soak;
      emit({ type: 'plate', x: g.x, y: g.y, left: g.plate });
      if (amount <= 0) { g.safe = tuning.hitSafety * 0.5; return; }
    }
    g.hp = Math.max(0, g.hp - amount);
    sim.hurtTaken += amount;
    g.safe = tuning.hitSafety;
    g.stagger = 0.15;
    const d = Math.hypot(g.x - fromX, g.y - fromY) || 1;
    g.vx = ((g.x - fromX) / d) * tuning.hitKnockback;
    g.vy = ((g.y - fromY) / d) * tuning.hitKnockback;
    emit({ type: 'hurt', x: g.x, y: g.y, amount });
    if (g.hp <= 0) {
      // A Spare Heart, if he has one, is used by itself.
      const spare = sim.powers.indexOf('revive');
      if (spare >= 0) {
        sim.powers.splice(spare, 1);
        g.hp = g.maxHp / 2;
        g.safe = 2;
        emit({ type: 'revive', x: g.x, y: g.y });
        for (const e of sim.enemies) {
          const dd = Math.hypot(e.x - g.x, e.y - g.y) || 1;
          if (dd < 5) { e.kx += ((e.x - g.x) / dd) * 14; e.ky += ((e.y - g.y) / dd) * 14; }
        }
        return;
      }
      sim.state = 'dead';
      g.attack = null;
      emit({ type: 'dead', x: g.x, y: g.y });
    }
  }
  sim.hurtGuy = hurtGuy;

  function collideRoom(c, r) {
    let bumped = false;
    if (c.x < r) { c.x = r; bumped = true; }
    if (c.y < r) { c.y = r; bumped = true; }
    if (c.x > ROOM.w - r) { c.x = ROOM.w - r; bumped = true; }
    if (c.y > ROOM.h - r) { c.y = ROOM.h - r; bumped = true; }
    for (const b of sim.blocks) if (pushOutOfBox(c, r, b)) bumped = true;
    return bumped;
  }
  sim.collideRoom = collideRoom;

  function stepGuy(input) {
    const g = sim.guy;
    const live = sim.state === 'fight' || sim.state === 'cleared';
    g.safe = Math.max(0, g.safe - STEP);
    g.dashCd = Math.max(0, g.dashCd - STEP);
    g.stagger = Math.max(0, g.stagger - STEP);
    g.swapT = Math.max(0, g.swapT - STEP);
    g.aim = Math.atan2(input.aimY - g.y, input.aimX - g.x);
    // A Belly Flop carries him through the air to where he lands.
    if (g.jump) {
      const j = g.jump;
      j.t += STEP;
      const t = Math.min(1, j.t / j.dur);
      g.x = j.fromX + (j.toX - j.fromX) * t;
      g.y = j.fromY + (j.toY - j.fromY) * t;
      g.vx = g.vy = 0;
      if (t >= 1) { g.jump = null; j.land(); }
      return;
    }
    let mx = live ? input.moveX : 0;
    let my = live ? input.moveY : 0;
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    if (live && input.dash && g.dashCd <= 0 && g.stagger <= 0) {
      const dl = Math.hypot(mx, my);
      g.dashX = dl > 0.1 ? mx / dl : Math.cos(g.aim);
      g.dashY = dl > 0.1 ? my / dl : Math.sin(g.aim);
      g.dashT = tuning.dashTime;
      g.dashCd = tuning.dashCooldown * (1 - (bonus.dash ?? 0));
      emit({ type: 'dash', x: g.x, y: g.y });
    }
    if (g.dashT > 0) {
      g.dashT -= STEP;
      g.vx = g.dashX * tuning.dashSpeed;
      g.vy = g.dashY * tuning.dashSpeed;
    } else if (g.stagger <= 0) {
      const speed = tuning.guySpeed * (1 + (bonus.speed ?? 0)) * (sim.buffs.adrenaline > 0 ? 1.3 : 1);
      g.vx += (mx * speed - g.vx) * tuning.guyAccel;
      g.vy += (my * speed - g.vy) * tuning.guyAccel;
    } else {
      g.vx *= 0.9;
      g.vy *= 0.9;
    }
    g.x += g.vx * STEP;
    g.y += g.vy * STEP;
    collideRoom(g, tuning.guyRadius);
  }

  // ----- weapons -----
  // Where the held weapon sits, in the room.
  sim.holdPoint = (w = sim.heldWeapon()) => {
    const g = sim.guy;
    const h = HOLD[w.stats.class];
    const c = Math.cos(g.aim);
    const s = Math.sin(g.aim);
    return { x: g.x + h.fwd * c - h.side * s, y: g.y + h.fwd * s + h.side * c };
  };

  const rateScale = () => (sim.buffs.overdrive > 0 ? 2 : 1) * (sim.buffs.adrenaline > 0 ? 1.5 : 1);
  const freeAmmo = () => sim.buffs.bottomless > 0;

  function fireOne(w) {
    const st = w.stats;
    if (!freeAmmo()) w.ammo--;
    sim.shotsFired++;
    w.kick = 1;
    const reach = barrel(w.id);
    const mx = w.x + Math.cos(w.aim) * reach;
    const my = w.y + Math.sin(w.aim) * reach;
    const pellets = st.pellets ?? 1;
    for (let p = 0; p < pellets; p++) {
      const spread = pellets > 1 ? ((p + rng.next()) / pellets - 0.5) * 2 * st.spread : (rng.next() - 0.5) * 2 * st.spread;
      const a = w.aim + spread;
      const speed = st.speed * (pellets > 1 ? rng.range(0.85, 1.1) : 1);
      const b = {
        id: id(), gun: w.id, rune: w.rune, cls: st.class, x: mx, y: my, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        life: st.life * (pellets > 1 ? rng.range(0.85, 1.1) : 1), damage: st.damage, pierce: st.pierce ?? 0, hits: new Set(),
        knock: st.knock, blast: st.blast ?? 0, lob: Boolean(st.lob), accel: st.accel ?? 0, maxSpeed: st.maxSpeed ?? speed, age: 0,
      };
      if (b.lob) {
        // A grenade lands where he aims, as long as that's in range.
        const want = Math.hypot(sim.aimX - mx, sim.aimY - my);
        b.life = Math.max(0.25, Math.min(st.life, want / speed));
        b.flight = b.life;
      }
      sim.bullets.push(b);
    }
    // Big guns shove him back a little.
    const g = sim.guy;
    const recoil = Math.min(3, st.knock * (pellets > 1 ? 0.25 : 0.12));
    g.vx -= Math.cos(w.aim) * recoil;
    g.vy -= Math.sin(w.aim) * recoil;
    emit({ type: 'shot', gun: w.id, cls: st.class, sound: st.sound, rune: w.rune, x: mx, y: my, angle: w.aim });
    if (w.ammo <= 0) startReload(w);
  }

  function startReload(w, quiet = false) {
    if (w.stats.class === 'melee' || w.reloadT > 0 || w.ammo >= w.stats.mag) return;
    w.reloadT = w.stats.reload;
    if (!quiet) emit({ type: 'reload', gun: w.id });
  }

  // One melee hit: everything inside the reach and arc, once. Swats shots out of the air too.
  function meleeHit(w, angle) {
    const g = sim.guy;
    const st = w.stats;
    let landed = 0;
    for (const e of sim.enemies) {
      if (e.dead) continue;
      const dx = e.x - g.x;
      const dy = e.y - g.y;
      const d = Math.hypot(dx, dy);
      if (d > st.reach + e.r) continue;
      if (d > e.r && Math.abs(angleDiff(Math.atan2(dy, dx), angle)) > st.arc + Math.atan2(e.r, d)) continue;
      damage(e, st.damage, dx / (d || 1), dy / (d || 1), st.knock, { weapon: w.id, rune: w.rune, melee: true });
      landed++;
    }
    for (const s of sim.shots) {
      const dx = s.x - g.x;
      const dy = s.y - g.y;
      const d = Math.hypot(dx, dy);
      if (d < st.reach + 0.4 && Math.abs(angleDiff(Math.atan2(dy, dx), angle)) < st.arc + 0.3 && (s.kind === 'rock' || (s.height ?? 0) < 1.2)) {
        s.dead = true;
        emit({ type: 'parry', x: s.x, y: s.y });
      }
    }
    return landed;
  }

  function stepWeapons(input) {
    const live = sim.state === 'fight';
    const g = sim.guy;
    // Swapping: the wheel, the bumpers, or a number key. A swing in progress is dropped.
    let want = sim.held;
    if (input.pick >= 0 && input.pick < sim.weapons.length) want = input.pick;
    else if (input.swap) want = (sim.held + input.swap + sim.weapons.length) % sim.weapons.length;
    if (want !== sim.held && live) {
      sim.held = want;
      g.swapT = 0.22;
      g.attack = null;
      emit({ type: 'swap', gun: sim.weapons[want].id });
    }
    const dt = STEP * rateScale();
    for (const w of sim.weapons) {
      const isHeld = w === sim.weapons[sim.held];
      w.kick = Math.max(0, w.kick - STEP * 9);
      w.cooldown -= dt;
      if (w.reloadT > 0) {
        w.reloadT -= STEP;
        if (w.reloadT <= 0) {
          w.reloadT = 0;
          w.ammo = w.stats.mag;
          if (isHeld) emit({ type: 'reloaded', gun: w.id });
        }
      }
      // A holstered gun reloads itself, so swapping is a way to keep firing.
      if (!isHeld) { startReload(w, true); continue; }
      const p = sim.holdPoint(w);
      w.x = p.x;
      w.y = p.y;
      const far = Math.hypot(input.aimX - p.x, input.aimY - p.y) > 1.2;
      w.aim = far ? Math.atan2(input.aimY - p.y, input.aimX - p.x) : g.aim;
    }
    const w = sim.weapons[sim.held];
    const st = w.stats;
    if (!live || g.swapT > 0 || g.jump) { if (st.style === 'saw') g.attack = null; return; }

    if (st.class === 'melee') {
      if (st.style === 'saw') {
        // The chainsaw runs while the trigger is held, biting a few times a second.
        if (input.fire) {
          if (!g.attack) g.attack = { style: 'saw', t: 0, angle: g.aim };
          g.attack.t += STEP;
          g.attack.angle = g.aim;
          if (w.cooldown <= 0) {
            w.cooldown = 1 / st.rate;
            const landed = meleeHit(w, g.aim);
            emit({ type: 'saw', x: g.x, y: g.y, landed });
          }
        } else g.attack = null;
        return;
      }
      if (g.attack) {
        const a = g.attack;
        a.t += dt;
        if (!a.done && a.t >= a.dur * a.hitAt) {
          a.done = true;
          const landed = meleeHit(w, a.angle);
          if (landed) emit({ type: 'smack', x: g.x + Math.cos(a.angle) * st.reach * 0.7, y: g.y + Math.sin(a.angle) * st.reach * 0.7, landed, gun: w.id });
        }
        if (a.t >= a.dur) g.attack = null;
      }
      if (input.fire && !g.attack && w.cooldown <= 0) {
        w.cooldown = 1 / st.rate;
        // Swings go alternate ways, so a combo reads as forehand, backhand.
        g.lastSwing = -(g.lastSwing ?? -1);
        g.attack = { style: st.style, t: 0, dur: 0.8 / st.rate, hitAt: st.style === 'swing' ? 0.45 : 0.4, angle: g.aim, dir: g.lastSwing, done: false };
        emit({ type: 'swing', gun: w.id, style: st.style, sound: st.sound, x: g.x, y: g.y, angle: g.aim });
      }
      return;
    }

    if (input.reload) { startReload(w); return; }
    if (freeAmmo() && w.reloadT > 0) { w.reloadT = 0; w.ammo = w.stats.mag; }
    if (input.fire && w.cooldown <= 0 && w.reloadT <= 0) {
      if (w.ammo > 0 || freeAmmo()) {
        w.cooldown = 1 / st.rate;
        fireOne(w);
      } else startReload(w);
    }
  }

  // ----- bullets -----
  function stepBullets() {
    for (const b of sim.bullets) {
      b.age += STEP;
      b.life -= STEP;
      if (b.accel) {
        const sp = Math.hypot(b.vx, b.vy);
        const ns = Math.min(b.maxSpeed, sp + b.accel * STEP);
        b.vx *= ns / sp;
        b.vy *= ns / sp;
      }
      const x0 = b.x;
      const y0 = b.y;
      const x1 = x0 + b.vx * STEP;
      const y1 = y0 + b.vy * STEP;
      b.x = x1;
      b.y = y1;
      const src = { weapon: b.gun === 'turret' || b.gun === 'frag' ? null : b.gun, rune: b.rune };
      if (b.lob) {
        // In the air until it lands; walls still stop it.
        if (b.life <= 0 || sim.solidAt(x1, y1)) { b.dead = true; explode(clamp(x0, 0.2, ROOM.w - 0.2), clamp(y0, 0.2, ROOM.h - 0.2), b.blast, b.damage, b.knock, src); }
        continue;
      }
      // Every creature this step's path crosses, nearest first.
      const dx = x1 - x0;
      const dy = y1 - y0;
      const len2 = dx * dx + dy * dy || 1e-9;
      const crossed = [];
      for (const e of sim.enemies) {
        if (e.dead || b.hits.has(e.id)) continue;
        const t = clamp(((e.x - x0) * dx + (e.y - y0) * dy) / len2, 0, 1);
        const px = x0 + dx * t - e.x;
        const py = y0 + dy * t - e.y;
        if (px * px + py * py <= (e.r + 0.08) ** 2) crossed.push({ e, t });
      }
      crossed.sort((a, c) => a.t - c.t);
      const len = Math.sqrt(len2);
      for (const { e, t } of crossed) {
        const hx = x0 + dx * t;
        const hy = y0 + dy * t;
        if (b.blast) { b.dead = true; explode(hx, hy, b.blast, b.damage, b.knock, src); break; }
        b.hits.add(e.id);
        // The Shell's front turns bullets away, unless it's frozen solid.
        if (e.def.armour && !e.dead && e.frozen <= 0) {
          const from = Math.atan2(-dy, -dx);
          if (Math.abs(angleDiff(from, e.angle)) < e.def.armour) {
            emit({ type: 'clang', id: e.id, x: hx, y: hy, angle: from });
            b.dead = true;
            break;
          }
        }
        damage(e, b.damage, dx / len, dy / len, b.knock, src);
        if (b.pierce-- <= 0) { b.dead = true; break; }
      }
      if (b.dead) continue;
      if (sim.solidAt(x1, y1)) {
        b.dead = true;
        if (b.blast) explode(x0, y0, b.blast, b.damage, b.knock, src);
        else emit({ type: 'spark', x: clamp(x1, 0, ROOM.w), y: clamp(y1, 0, ROOM.h) });
        continue;
      }
      if (b.life <= 0) {
        b.dead = true;
        if (b.blast) explode(x1, y1, b.blast, b.damage, b.knock, src);
      }
    }
    sim.bullets = sim.bullets.filter((b) => !b.dead);
  }

  // Slow-Mo slows creatures and everything they throw.
  const enemyTime = () => (sim.buffs.slowmo > 0 ? 0.35 : 1);

  function stepShots() {
    const g = sim.guy;
    const dt = STEP * enemyTime();
    for (const s of sim.shots) {
      if (s.dead) continue;
      s.age += dt;
      if (s.kind === 'glob') {
        const t = Math.min(1, s.age / s.flight);
        s.x = s.fromX + (s.tx - s.fromX) * t;
        s.y = s.fromY + (s.ty - s.fromY) * t;
        s.height = Math.sin(t * Math.PI) * 2.2;
        if (t >= 1) {
          s.dead = true;
          emit({ type: 'splat', x: s.tx, y: s.ty, r: s.blast });
          if (Math.hypot(g.x - s.tx, g.y - s.ty) < s.blast + tuning.guyRadius * 0.5) hurtGuy(s.damage, s.tx, s.ty);
        }
      } else {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        if (Math.hypot(g.x - s.x, g.y - s.y) < s.r + tuning.guyRadius) {
          s.dead = true;
          hurtGuy(s.damage, s.x - s.vx, s.y - s.vy);
        } else if (sim.solidAt(s.x, s.y)) {
          s.dead = true;
          emit({ type: 'crumble', x: s.x, y: s.y });
        }
      }
    }
    sim.shots = sim.shots.filter((s) => !s.dead);
  }

  // ----- spawning -----
  function stepSpawns() {
    if (sim.state !== 'fight') return;
    const alive = sim.enemies.length + sim.spawns.length;
    // Nothing on the floor: bring the next group in now rather than make him wait.
    if (sim.queue.length && alive === 0 && sim.queue[0].at > sim.time + 0.6) {
      const skip = sim.queue[0].at - sim.time - 0.6;
      for (const g of sim.queue) g.at -= skip;
    }
    while (sim.queue.length && sim.queue[0].at <= sim.time && sim.enemies.length + sim.spawns.length < tuning.aliveCap) {
      const group = sim.queue.shift();
      const spot = edgeSpot();
      for (const entry of group.enemies) {
        const at = placeNear(spot.x + rng.range(-1.5, 1.5), spot.y + rng.range(-1.5, 1.5));
        const warn = tuning.spawnWarn + rng.range(0, 0.4);
        sim.spawns.push({ id: id(), kind: entry.kind, mod: entry.mod ?? null, x: at.x, y: at.y, timer: warn, total: warn });
      }
      emit({ type: 'incoming', x: spot.x, y: spot.y });
    }
    for (const s of sim.spawns) {
      s.timer -= STEP;
      if (s.timer <= 0) { s.done = true; makeEnemy(s.kind, s.mod, s.x, s.y); }
    }
    sim.spawns = sim.spawns.filter((s) => !s.done);
  }

  // ----- creatures moving -----
  function stepEnemies() {
    const g = sim.guy;
    const slowmo = enemyTime();
    for (const e of sim.enemies) {
      if (e.dead) continue;
      e.flash = Math.max(0, e.flash - STEP);
      if (e.shieldMax && e.shield < e.shieldMax && sim.time - e.lastHit > 6) e.shield = Math.min(e.shieldMax, e.shield + e.shieldMax * STEP * 0.5);
      // Burning and poison tick; slowed and frozen creatures move less or not at all.
      if (e.burn > 0) {
        e.burn -= STEP;
        damage(e, e.burnDps * STEP, 0, 0, 0, { weapon: e.lastSrc, dot: true, rune: 'fire' });
        if (e.burn <= 0) e.burnDps = 0;
      }
      if (e.poison.length && !e.dead) {
        let dps = 0;
        for (const p of e.poison) { p.t -= STEP; dps += p.dps; }
        e.poison = e.poison.filter((p) => p.t > 0);
        damage(e, dps * STEP, 0, 0, 0, { weapon: e.lastSrc, dot: true, rune: 'venom' });
      }
      if (e.dead) continue;
      e.slowT = Math.max(0, e.slowT - STEP);
      const f = slowmo * (e.slowT > 0 ? 0.5 : 1);
      if (e.frozen > 0) {
        // Freezing interrupts whatever it was winding up; it starts over when it thaws.
        if (!e.iced) { startState(sim, e); e.iced = true; }
        e.frozen -= STEP;
        e.vx = e.vy = 0;
        if (e.frozen <= 0) e.iced = false;
      } else if (sim.state === 'fight') think(sim, e, STEP * f);
      else { e.vx *= 0.9; e.vy *= 0.9; }
      const fade = Math.exp(-tuning.friction * STEP);
      e.kx *= fade;
      e.ky *= fade;
      e.x += (e.vx * f + e.kx) * STEP;
      e.y += (e.vy * f + e.ky) * STEP;
      e.bumped = collideRoom(e, e.r);
    }
    // Creatures shoulder each other apart; the lighter one moves more.
    const list = sim.enemies.filter((e) => !e.dead);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const min = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min || d2 < 1e-9) continue;
        const d = Math.sqrt(d2);
        const overlap = (min - d) * 0.5;
        const share = b.mass / (a.mass + b.mass);
        a.x -= (dx / d) * overlap * 2 * share;
        a.y -= (dy / d) * overlap * 2 * share;
        b.x += (dx / d) * overlap * 2 * (1 - share);
        b.y += (dy / d) * overlap * 2 * (1 - share);
      }
    }
    // Touching him hurts and an attack hurts more, but a dazed creature is harmless to bump.
    // Either way he can't walk through it: he's shouldered back out.
    if (!g.jump) {
      for (const e of list) {
        const dx = g.x - e.x;
        const dy = g.y - e.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const min = e.r + tuning.guyRadius * 0.9;
        if (d >= min) continue;
        if (sim.state === 'fight' && !DAZED.has(e.state) && e.frozen <= 0) {
          const base = ATTACKING.has(e.state) ? e.def.hit : e.def.touch;
          hurtGuy(base * (e.mod === 'spiky' ? 2 : 1), e.x, e.y);
        }
        g.x = e.x + (dx / d) * min;
        g.y = e.y + (dy / d) * min;
        collideRoom(g, tuning.guyRadius);
      }
    }
    sim.enemies = sim.enemies.filter((e) => !e.dead);
  }

  // ----- things he leaves about: turrets, coils, decoys, mines, fire, airstrikes -----
  function stepAllies() {
    const live = sim.state === 'fight';
    for (const a of sim.allies) {
      a.life -= STEP;
      a.cd -= STEP;
      if (a.life <= 0) { a.dead = true; emit({ type: 'pop', kind: a.kind, x: a.x, y: a.y }); continue; }
      if (!live) continue;
      if (a.kind === 'turret' && a.cd <= 0) {
        const t = nearestEnemy(a.x, a.y, 13);
        if (t) {
          a.cd = 0.22;
          a.aim = Math.atan2(t.y - a.y, t.x - a.x);
          const speed = 38;
          sim.bullets.push({
            id: id(), gun: 'turret', rune: null, cls: 'turret', x: a.x + Math.cos(a.aim) * 0.4, y: a.y + Math.sin(a.aim) * 0.4,
            vx: Math.cos(a.aim) * speed, vy: Math.sin(a.aim) * speed, life: 0.45, damage: 9 * sim.effectScale, pierce: 0,
            hits: new Set(), knock: 2, blast: 0, lob: false, accel: 0, maxSpeed: speed, age: 0,
          });
          emit({ type: 'shot', gun: 'turret', cls: 'turret', sound: 'smg', x: a.x, y: a.y, angle: a.aim, ally: a.id });
        }
      } else if (a.kind === 'tesla' && a.cd <= 0) {
        const hits = sim.enemies.filter((e) => Math.hypot(e.x - a.x, e.y - a.y) < 4.5 + e.r).slice(0, 3);
        if (hits.length) {
          a.cd = 0.5;
          for (const e of hits) {
            emit({ type: 'zap', points: [[a.x, a.y], [e.x, e.y]], small: true });
            damage(e, 14 * sim.effectScale, 0, 0, 1, {});
          }
        }
      }
    }
    sim.allies = sim.allies.filter((a) => !a.dead);
    // Creatures chase a decoy or smoke while one is out.
    const lure = [...sim.allies].reverse().find((a) => a.kind === 'decoy' || a.kind === 'smoke');
    sim.target = lure ? { x: lure.x, y: lure.y, vx: 0, vy: 0 } : sim.guy;

    for (const m of sim.mines) {
      m.age += STEP;
      if (m.age < 0.5) continue;
      if (sim.enemies.some((e) => Math.hypot(e.x - m.x, e.y - m.y) < e.r + 0.7)) {
        m.dead = true;
        explode(m.x, m.y, 2.4, 80 * sim.effectScale, 12, {});
      }
    }
    sim.mines = sim.mines.filter((m) => !m.dead);

    for (const z of sim.zones) {
      z.life -= STEP;
      if (z.life <= 0) { z.dead = true; continue; }
      for (const e of sim.enemies) {
        if (Math.hypot(e.x - z.x, e.y - z.y) < z.r + e.r * 0.5) { e.burn = Math.max(e.burn, 1); e.burnDps = Math.max(e.burnDps, 22 * sim.effectScale); }
      }
    }
    sim.zones = sim.zones.filter((z) => !z.dead);

    for (const s of sim.strikes) {
      s.t -= STEP;
      if (s.t <= 0) { s.dead = true; explode(s.x, s.y, s.r, s.damage, 12, {}); }
    }
    sim.strikes = sim.strikes.filter((s) => !s.dead);
  }

  function stepCoins() {
    const g = sim.guy;
    const all = sim.state !== 'fight';
    for (const c of sim.coins) {
      c.age += STEP;
      const dx = g.x - c.x;
      const dy = g.y - c.y;
      const d = Math.hypot(dx, dy);
      if (d < tuning.pickup && c.age > 0.25) {
        c.dead = true;
        if (c.kind === 'token') sim.tokens += c.value; else sim.cash += c.value;
        emit({ type: c.kind === 'token' ? 'token' : 'coin', x: c.x, y: c.y, value: c.value });
        continue;
      }
      if ((d < tuning.magnet || all) && c.age > 0.35) {
        const pull = tuning.coinPull * (all ? 1.4 : 1);
        c.vx += ((dx / d) * pull - c.vx) * 0.2;
        c.vy += ((dy / d) * pull - c.vy) * 0.2;
      } else {
        c.vx *= 0.9;
        c.vy *= 0.9;
      }
      c.x = clamp(c.x + c.vx * STEP, 0.3, ROOM.w - 0.3);
      c.y = clamp(c.y + c.vy * STEP, 0.3, ROOM.h - 0.3);
    }
    sim.coins = sim.coins.filter((c) => !c.dead);
  }

  function stepCards(input) {
    for (const a of sim.abilities) a.cd = Math.max(0, a.cd - STEP);
    for (const k of Object.keys(sim.buffs)) { sim.buffs[k] -= STEP; if (sim.buffs[k] <= 0) delete sim.buffs[k]; }
    if (sim.state !== 'fight' || sim.guy.jump) return;
    const ctx = { aimX: input.aimX, aimY: input.aimY };
    sim.abilities.forEach((a, i) => {
      if (!input.ability[i] || a.cd > 0) return;
      useAbility(sim, a.id, ctx);
      a.cd = abilityCooldown(a.id) * (1 - (bonus.cooldown ?? 0));
      emit({ type: 'ability', id: a.id, slot: i, x: sim.guy.x, y: sim.guy.y });
    });
    for (let i = sim.powers.length - 1; i >= 0; i--) {
      if (!input.power[i]) continue;
      const pid = sim.powers[i];
      if (pid === 'revive') { emit({ type: 'note', text: 'Works by itself', x: sim.guy.x, y: sim.guy.y }); continue; }
      sim.powers.splice(i, 1);
      usePower(sim, pid, ctx);
      emit({ type: 'power', id: pid, name: POWERS[pid].name, x: sim.guy.x, y: sim.guy.y });
    }
  }

  const NONE = { moveX: 0, moveY: 0, aimX: ROOM.w / 2 + 5, aimY: ROOM.h / 2, fire: false, dash: false, reload: false, swap: 0, pick: -1, ability: [], power: [] };

  sim.step = (raw) => {
    const input = { ...NONE, ...raw };
    events = [];
    sim.time += STEP;
    sim.aimX = input.aimX;
    sim.aimY = input.aimY;
    stepGuy(input);
    stepCards(input);
    stepWeapons(input);
    stepBullets();
    stepShots();
    stepSpawns();
    stepEnemies();
    stepAllies();
    stepCoins();
    if (sim.state === 'fight' && !sim.idle && !sim.queue.length && !sim.spawns.length && !sim.enemies.length) {
      sim.state = 'cleared';
      sim.endTimer = 1.6;
      sim.shots = [];
      sim.guy.attack = null;
      emit({ type: 'cleared' });
    } else if (sim.state === 'cleared') {
      sim.endTimer -= STEP;
      if (sim.endTimer <= 0 || (!sim.coins.length && sim.endTimer < 1.0)) {
        for (const c of sim.coins) { if (c.kind === 'token') sim.tokens += c.value; else sim.cash += c.value; }
        sim.coins = [];
        sim.state = 'done';
      }
    }
    return events;
  };

  // Every warning on the floor: creature attacks, where goo and airstrikes will land, arrivals.
  sim.telegraphs = () => {
    const out = [];
    for (const e of sim.enemies) if (e.tele) out.push(e.tele);
    for (const s of sim.shots) if (s.kind === 'glob') out.push({ type: 'circle', x: s.tx, y: s.ty, r: s.blast, progress: Math.min(1, s.age / s.flight) });
    for (const s of sim.spawns) out.push({ type: 'spawn', x: s.x, y: s.y, r: ENEMIES[s.kind].r * (s.mod === 'heavy' ? 1.25 : 1), progress: 1 - s.timer / s.total, kind: s.kind });
    for (const s of sim.strikes) out.push({ type: 'friendly', x: s.x, y: s.y, r: s.r, progress: 1 - s.t / s.total });
    return out;
  };

  sim.enemiesLeft = () => sim.enemies.length + sim.spawns.length + sim.queue.reduce((n, g) => n + g.enemies.length, 0);

  return sim;
}
