// What each ability and power does when used. Both decks share these pieces: blasts,
// freezes, things left on the floor, and timed buffs. No DOM here.
// ctx: { aimX, aimY } is where he's aiming when it's used.

import { ROOM } from './tuning.js';
import { ABILITIES, POWERS } from '../content/cards.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const abilityCooldown = (id) => ABILITIES[id].cooldown;

// The aim point, pulled in to stay inside the room and within reach.
function aimSpot(sim, ctx, maxRange = 12) {
  const g = sim.guy;
  const dx = ctx.aimX - g.x;
  const dy = ctx.aimY - g.y;
  const d = Math.hypot(dx, dy) || 1;
  const r = Math.min(d, maxRange);
  return { x: clamp(g.x + (dx / d) * r, 0.8, ROOM.w - 0.8), y: clamp(g.y + (dy / d) * r, 0.8, ROOM.h - 0.8), angle: Math.atan2(dy, dx) };
}

// Throws something that bursts where he aims: a grenade-shaped bullet the sim already knows.
function lob(sim, ctx, { blast, damage, speed = 16, kind = 'frag' }) {
  const g = sim.guy;
  const spot = aimSpot(sim, ctx, 13);
  const d = Math.hypot(spot.x - g.x, spot.y - g.y);
  const flight = Math.max(0.3, d / speed);
  sim.bullets.push({
    id: sim.nextId(), gun: kind, rune: null, cls: 'lob', x: g.x, y: g.y,
    vx: ((spot.x - g.x) / flight), vy: ((spot.y - g.y) / flight), life: flight, flight, damage, pierce: 0,
    hits: new Set(), knock: 12, blast, lob: true, accel: 0, maxSpeed: speed, age: 0,
  });
}

function freezeAround(sim, x, y, radius, seconds) {
  for (const e of sim.enemies) {
    if (Math.hypot(e.x - x, e.y - y) < radius + e.r) e.frozen = Math.max(e.frozen, seconds * (e.kind === 'bigone' ? 0.5 : 1));
  }
  sim.emit({ type: 'freeze', x, y, r: radius });
}

// Lightning from (x, y) to the nearest creature, then on to the next nearest, and so on.
function chain(sim, x, y, jumps, damage, first = 9, next = 5) {
  const hit = new Set();
  const points = [[x, y]];
  let from = { x, y };
  for (let i = 0; i < jumps; i++) {
    const e = sim.nearestEnemy(from.x, from.y, i === 0 ? first : next, hit);
    if (!e) break;
    hit.add(e);
    points.push([e.x, e.y]);
    from = e;
  }
  if (points.length > 1) sim.emit({ type: 'zap', points });
  for (const e of hit) sim.damage(e, damage, 0, 0, 2, {});
}

export function useAbility(sim, id, ctx) {
  const g = sim.guy;
  const k = sim.effectScale;
  switch (id) {
    case 'shockwave': {
      sim.emit({ type: 'shockwave', x: g.x, y: g.y, r: 4 });
      for (const e of sim.enemies) {
        const d = Math.hypot(e.x - g.x, e.y - g.y);
        if (d < 4 + e.r) sim.damage(e, 40 * k, (e.x - g.x) / (d || 1), (e.y - g.y) / (d || 1), 26, {});
      }
      for (const s of sim.shots) if (Math.hypot(s.x - g.x, s.y - g.y) < 4) s.dead = true;
      break;
    }
    case 'frag': lob(sim, ctx, { blast: 2.8, damage: 90 * k }); break;
    case 'turret': {
      const spot = sim.placeNear(g.x + Math.cos(g.aim) * 1.2, g.y + Math.sin(g.aim) * 1.2);
      sim.allies.push({ id: sim.nextId(), kind: 'turret', x: spot.x, y: spot.y, life: 10, total: 10, cd: 0.3, aim: g.aim });
      break;
    }
    case 'overdrive': sim.buffs.overdrive = 5; break;
    case 'bubble': sim.buffs.bubble = 2.5; break;
    case 'slowmo': sim.buffs.slowmo = 4; break;
    case 'blink': {
      // Steps along the line until something solid or the aim point, then jumps there.
      const spot = aimSpot(sim, ctx, 8);
      const from = { x: g.x, y: g.y };
      let x = g.x;
      let y = g.y;
      const steps = 40;
      for (let i = 1; i <= steps; i++) {
        const nx = from.x + (spot.x - from.x) * (i / steps);
        const ny = from.y + (spot.y - from.y) * (i / steps);
        if (sim.solidAt(nx, ny, 0.5)) break;
        x = nx;
        y = ny;
      }
      g.x = x;
      g.y = y;
      g.safe = Math.max(g.safe, 0.3);
      sim.emit({ type: 'blink', fromX: from.x, fromY: from.y, x, y });
      break;
    }
    case 'pound': {
      const spot = aimSpot(sim, ctx, 7);
      g.jump = {
        t: 0, dur: 0.55, fromX: g.x, fromY: g.y, toX: spot.x, toY: spot.y,
        land() {
          sim.collideRoom(g, 0.5);
          sim.explode(g.x, g.y, 3, 55 * k, 16, {});
          freezeAround(sim, g.x, g.y, 3, 1.2);
          sim.emit({ type: 'landing', x: g.x, y: g.y });
        },
      };
      break;
    }
    case 'decoy': {
      const spot = sim.placeNear(g.x + Math.cos(g.aim) * 2, g.y + Math.sin(g.aim) * 2);
      sim.allies.push({ id: sim.nextId(), kind: 'decoy', x: spot.x, y: spot.y, life: 5, total: 5, cd: 0 });
      break;
    }
    case 'mines':
      for (let i = 0; i < 3; i++) {
        const a = g.aim + Math.PI + (i - 1) * 1.1;
        const spot = sim.placeNear(g.x + Math.cos(a) * 1.6, g.y + Math.sin(a) * 1.6);
        sim.mines.push({ id: sim.nextId(), x: spot.x, y: spot.y, age: 0 });
      }
      break;
    case 'zap': chain(sim, g.x, g.y, 5, 45 * k); break;
    case 'freeze': freezeAround(sim, g.x, g.y, 5, 2); break;
    case 'bottomless': sim.buffs.bottomless = 5; break;
    case 'vampire': sim.buffs.vampire = 6; break;
    case 'secondwind': sim.heal(30); break;
    default: break;
  }
}

// Powers anything can roll into (the Mystery Box picks from these).
const MYSTERY = Object.keys(POWERS).filter((p) => p !== 'mystery' && p !== 'revive');

export function usePower(sim, id, ctx) {
  const g = sim.guy;
  const k = sim.effectScale;
  switch (id) {
    case 'medkit': sim.heal(40); break;
    case 'grenade': lob(sim, ctx, { blast: 4, damage: 200 * k, kind: 'bomb' }); break;
    case 'adrenaline': sim.buffs.adrenaline = 8; break;
    case 'plate': g.plate = 50; break;
    case 'coinbag': sim.cash += 150; sim.emit({ type: 'coin', x: g.x, y: g.y, value: 150 }); break;
    case 'ammo':
      for (const w of sim.weapons) { if (w.stats.mag) { w.ammo = w.stats.mag; w.reloadT = 0; } }
      sim.buffs.bottomless = 8;
      break;
    case 'smoke':
      sim.allies.push({ id: sim.nextId(), kind: 'smoke', x: g.x, y: g.y, life: 4, total: 4, cd: 0 });
      g.safe = Math.max(g.safe, 0.5);
      break;
    case 'icebomb': {
      const spot = aimSpot(sim, ctx, 12);
      freezeAround(sim, spot.x, spot.y, 3, 3);
      break;
    }
    case 'molotov': {
      const spot = aimSpot(sim, ctx, 12);
      sim.zones.push({ id: sim.nextId(), kind: 'fire', x: spot.x, y: spot.y, r: 2.2, life: 6, total: 6 });
      sim.emit({ type: 'molotov', x: spot.x, y: spot.y });
      break;
    }
    case 'rage': sim.buffs.rage = 8; break;
    case 'tesla': {
      const spot = sim.placeNear(g.x, g.y + 0.01);
      sim.allies.push({ id: sim.nextId(), kind: 'tesla', x: spot.x, y: spot.y, life: 12, total: 12, cd: 0 });
      break;
    }
    case 'airstrike': {
      const spot = aimSpot(sim, ctx, 30);
      for (let i = 0; i < 5; i++) {
        const along = 2.5 + i * 2.3;
        const x = clamp(g.x + Math.cos(spot.angle) * along, 0.8, ROOM.w - 0.8);
        const y = clamp(g.y + Math.sin(spot.angle) * along, 0.8, ROOM.h - 0.8);
        const t = 0.7 + i * 0.18;
        sim.strikes.push({ x, y, r: 2.4, damage: 110 * k, t, total: t });
      }
      break;
    }
    case 'mystery': {
      const pick = MYSTERY[sim.rng.int(MYSTERY.length)];
      sim.emit({ type: 'note', text: POWERS[pick].name, x: g.x, y: g.y });
      usePower(sim, pick, ctx);
      break;
    }
    case 'nuke':
      sim.emit({ type: 'nuke', x: g.x, y: g.y });
      for (const e of [...sim.enemies]) sim.damage(e, 250 * k, 0, 0, 8, {});
      break;
    default: break;
  }
}
