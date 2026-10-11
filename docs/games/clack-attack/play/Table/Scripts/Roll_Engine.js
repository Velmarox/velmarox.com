// Dice notation parser and roller. Supports:
//   NdM, dM, d%, numbers, + and -, keep/drop (2d20kh1, 4d6dl1, 4d6k3),
//   exploding dice (3d6!). Modifiers use the same notation ("+2", "1d4", "-1").
(() => {
  const MAX_COUNT = 200, MAX_SIDES = 10000;

  function rand(sides) {
    const buf = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / sides) * sides;   // avoid modulo bias
    let x;
    do { crypto.getRandomValues(buf); x = buf[0]; } while (x >= limit);
    return (x % sides) + 1;
  }

  // Returns an array of terms or throws with a readable message.
  function parse(expr) {
    const src = String(expr || '').replace(/\s+/g, '').toLowerCase();
    if (!src) throw new Error('Nothing to roll');
    const re = /([+-])?(?:(\d*)d(\d+|%)((?:kh|kl|dh|dl|k|d)\d+)?(!)?|(\d+))/y;
    const terms = [];
    let i = 0;
    while (i < src.length) {
      re.lastIndex = i;
      const m = re.exec(src);
      if (!m || m[0] === '' || (terms.length && !m[1])) {
        throw new Error(`Can't read "${expr}" near "${src.slice(i)}"`);
      }
      const sign = m[1] === '-' ? -1 : 1;
      if (m[6] !== undefined) {
        terms.push({ sign, kind: 'num', value: parseInt(m[6], 10) });
      } else {
        const count = m[2] === '' ? 1 : parseInt(m[2], 10);
        const sides = m[3] === '%' ? 100 : parseInt(m[3], 10);
        if (count < 1 || count > MAX_COUNT) throw new Error(`Dice count must be 1-${MAX_COUNT}`);
        if (sides < 1 || sides > MAX_SIDES) throw new Error(`Dice sides must be 1-${MAX_SIDES}`);
        let keep = null;
        if (m[4]) {
          const km = /^(kh|kl|dh|dl|k|d)(\d+)$/.exec(m[4]);
          const type = km[1] === 'k' ? 'kh' : km[1] === 'd' ? 'dl' : km[1];
          keep = { type, n: parseInt(km[2], 10) };
        }
        terms.push({ sign, kind: 'dice', count, sides, keep, explode: !!m[5] && sides > 1 });
      }
      i = re.lastIndex;
    }
    return terms;
  }

  function rollTerm(t) {
    if (t.kind === 'num') return { ...t, value: t.value, text: String(t.value) };
    const rolls = [];
    for (let i = 0; i < t.count; i++) {
      let r = rand(t.sides);
      rolls.push({ v: r, kept: true });
      let guard = 0;
      while (t.explode && r === t.sides && guard++ < 50) { r = rand(t.sides); rolls.push({ v: r, kept: true, boom: true }); }
    }
    if (t.keep) {
      const order = rolls.map((r, i) => i).sort((a, b) => rolls[a].v - rolls[b].v);   // ascending
      const n = Math.min(t.keep.n, rolls.length);
      let drop;
      if (t.keep.type === 'kh') drop = order.slice(0, rolls.length - n);
      else if (t.keep.type === 'kl') drop = order.slice(n);
      else if (t.keep.type === 'dl') drop = order.slice(0, n);
      else drop = order.slice(rolls.length - n);   // dh
      drop.forEach(i => { rolls[i].kept = false; });
    }
    const value = rolls.filter(r => r.kept).reduce((a, r) => a + r.v, 0);
    const keepTxt = t.keep ? t.keep.type + t.keep.n : '';
    const faces = rolls.map(r => (r.kept ? String(r.v) : `~~${r.v}~~`) + (r.boom ? '!' : '')).join(', ');
    return { ...t, rolls, value, text: `${t.count}d${t.sides}${keepTxt}${t.explode ? '!' : ''} (${faces})` };
  }

  const joiner = (sign, first) => (first ? (sign < 0 ? '−' : '') : sign < 0 ? ' − ' : ' + ');

  function detailOf(results) {
    return results.map((r, i) => joiner(r.sign, i === 0) + r.text).join('');
  }
  const sum = results => results.reduce((a, r) => a + r.sign * r.value, 0);

  RP.parseDice = parse;

  // Compact form stored with log entries so the partner can replay the dice.
  RP.packDice = dice => (dice || []).slice(0, 40).map(d => [d.sides, d.value, d.kept ? 1 : 0]);
  RP.unpackDice = packed => (Array.isArray(packed) ? packed : []).map(([sides, value, kept]) => ({ sides, value, kept: !!kept }));

  // Check a modifier value without rolling it (for the red outline in the UI).
  RP.validDice = expr => { try { parse(expr); return true; } catch { return false; } };

  /**
   * roll({ expr, adv: 'adv'|'dis'|'', mods: [{name, value}] })
   * → { total, detail, crit: 'hi'|'lo'|null, advApplied, dice: [{sides, value, kept}] }
   */
  RP.roll = ({ expr, adv = '', mods = [] }) => {
    const base = parse(expr);
    let advApplied = false;
    if (adv) {
      const d20 = base.find(t => t.kind === 'dice' && t.sides === 20 && t.count === 1 && !t.keep);
      if (d20) { d20.count = 2; d20.keep = { type: adv === 'adv' ? 'kh' : 'kl', n: 1 }; advApplied = true; }
    }
    const baseRes = base.map(rollTerm);
    const dice = [];
    const collect = results => results.forEach(r => r.rolls?.forEach(x => dice.push({ sides: r.sides, value: x.v, kept: x.kept })));
    collect(baseRes);
    let total = sum(baseRes);
    let detail = detailOf(baseRes);

    for (const m of mods) {
      const res = parse(m.value).map(rollTerm);
      collect(res);
      const sub = sum(res);
      total += sub;
      const label = (m.name || 'mod').trim();
      if (res.length === 1) {
        detail += joiner(res[0].sign, false) + `${label} ${res[0].text}`;
      } else {
        detail += ` + ${label} (${detailOf(res)})`;
      }
    }

    // Natural 20 / 1 only makes sense when exactly one d20 is in the base roll.
    let crit = null;
    const d20s = baseRes.filter(r => r.kind === 'dice' && r.sides === 20);
    if (d20s.length === 1) {
      const kept = d20s[0].rolls.filter(r => r.kept && !r.boom);
      if (kept.length === 1) crit = kept[0].v === 20 ? 'hi' : kept[0].v === 1 ? 'lo' : null;
    }
    return { total, detail, crit, advApplied, dice };
  };
})();
