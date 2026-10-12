// Clack Arena: what a throw does. Pure functions over a plain fight state, so the enemy can score the throws it
// previews with exactly the rules the real throw uses.
//
// Order: Clack damage, then Guard, then everything else, then Thorn.
(() => {
  const A = window.ARENA;

  // The face a die shows, after relics. side: 'p' (player) or 'e'.
  A.effFace = (st, side, dieIdx, faceIdx) => {
    const S = side === 'p' ? st.p : st.e;
    const f = { ...S.dice[dieIdx].faces[faceIdx] };
    if (side === 'p' && st.p.relics.includes('cracked') && A.FACE_TYPES[f.t].valued) f.v += 1;
    return f;
  };

  // Clack damage from one hit, by impact speed along the contact (measured: a solid hit is ~10-30, a full-power
  // head-on one 30-65): 1 at 6+, 2 at 18+, 3 at 32+. Then the dice's own modifiers.
  A.clackBase = (v) => (v >= 32 ? 3 : v >= 18 ? 2 : v >= 6 ? 1 : 0);
  function clackDamage(st, c) {
    let d = A.clackBase(c.v);
    if (!d) return 0;
    const atk = st[c.from.side], def = st[c.to.side];
    d += atk.clackDeal || 0;
    d += def.clackTake || 0;
    return Math.max(0, d);
  }

  A.cloneState = (st) => ({
    p: { ...st.p, relics: [...st.p.relics], chalk: [...st.p.chalk] },
    e: { ...st.e },
  });

  /**
   * Resolve one landed throw. st is changed in place.
   * oc = { dice: [{ side, die, face, status: 'ok' | 'pinned', on }], clacks: [{ from: {side, die}, to: {side, die}, v }] }
   *   die = index into that side's dice; face = the game face index that landed up; on = index into oc.dice it leans on.
   * Returns events for the screen: { k: 'clack' | 'face' | 'pinned' | 'dmg' | 'heal' | 'guard' | 'thorn' | 'charge', ... }
   */
  A.resolve = (st, oc, opts = {}) => {
    const ev = [];
    const other = (s) => (s === 'p' ? 'e' : 'p');
    const hurt = (side, n, why, at) => { if (n <= 0) return; st[side].hp -= n; ev.push({ k: 'dmg', side, n, why, at }); };

    // 1. Clacks (dice of the same side bumping each other don't count)
    if (!opts.skipClacks) for (const c of oc.clacks) {
      if (c.from.side === c.to.side) continue;
      const d = clackDamage(st, c);
      if (d) { hurt(c.to.side, d, 'clack', c.to); ev.push({ k: 'clack', from: c.from, to: c.to, n: d }); }
    }
    if (st.p.hp <= 0 || st.e.hp <= 0) return ev;

    // 2. Faces. A Pinned die does nothing; the die it leans on gets +1.
    const bonus = oc.dice.map(() => 0);
    oc.dice.forEach((d) => { if (d.status === 'pinned' && d.on >= 0) bonus[d.on] += 1; });
    const acts = [];
    oc.dice.forEach((d, i) => {
      if (d.status === 'pinned') { ev.push({ k: 'pinned', at: { side: d.side, die: d.die } }); return; }
      const f = A.effFace(st, d.side, d.die, d.face), T = A.FACE_TYPES[f.t];
      const S = st[d.side];
      if (T.valued && bonus[i]) f.v += bonus[i];
      if (T.valued && S.charged) { f.v *= 2; S.charged = false; f.charged = true; }
      const times = d.side === 'p' && st.p.chalk.includes(d.face) ? 2 : 1;
      ev.push({ k: 'face', at: { side: d.side, die: d.die }, face: f, times, pinBonus: bonus[i] });
      for (let t = 0; t < times; t++) acts.push({ side: d.side, f, at: { side: d.side, die: d.die } });
    });

    // 3. Guard
    const guard = { p: 0, e: 0 }, thorn = { p: 0, e: 0 }, hit = { p: false, e: false }, chargeNext = { p: false, e: false };
    acts.forEach((a) => { if (a.f.t === 'guard') guard[a.side] += a.f.v; });
    if (guard.p) ev.push({ k: 'guard', side: 'p', n: guard.p });
    if (guard.e) ev.push({ k: 'guard', side: 'e', n: guard.e });

    // 4. Everything else
    acts.forEach((a) => {
      const o = other(a.side), f = a.f;
      if (f.t === 'strike') {
        const blocked = Math.min(guard[o], f.v); guard[o] -= blocked;
        const n = f.v - blocked;
        if (blocked) ev.push({ k: 'blocked', side: o, n: blocked });
        if (n > 0) { hurt(o, n, 'strike', a.at); hit[o] = true; }
      } else if (f.t === 'pierce') { hurt(o, f.v, 'pierce', a.at); hit[o] = true; }
      else if (f.t === 'mend') { const S = st[a.side], n = Math.min(f.v, S.max - S.hp); S.hp += n; ev.push({ k: 'heal', side: a.side, n }); }
      else if (f.t === 'charge') chargeNext[a.side] = true;
      else if (f.t === 'thorn') thorn[a.side] += f.v;
      else if (f.t === 'skull' && a.side === 'p' && st.p.relics.includes('snakeoil')) { const n = Math.min(2, st.p.max - st.p.hp); st.p.hp += n; ev.push({ k: 'heal', side: 'p', n, why: 'snakeoil' }); }
    });

    // 5. Thorn
    ['p', 'e'].forEach((s) => { if (hit[s] && thorn[s]) { hurt(other(s), thorn[s], 'thorn'); ev.push({ k: 'thorn', side: s, n: thorn[s] }); } });
    ['p', 'e'].forEach((s) => { if (chargeNext[s]) { st[s].charged = true; ev.push({ k: 'charge', side: s }); } });
    return ev;
  };

  // How good a landed throw is for the enemy: damage it dealt minus damage it took, with a big swing for a knockout.
  A.scoreForEnemy = (st, oc) => {
    const s = A.cloneState(st);
    A.resolve(s, oc);
    let score = (st.p.hp - s.p.hp) - (st.e.hp - s.e.hp);
    if (s.p.hp <= 0) score += 50;
    if (s.e.hp <= 0) score -= 50;
    if (s.e.charged && !st.e.charged) score += 1;
    return score;
  };
})();
