/* WYRMHOARD KENO -- JavaScript harness.
 *
 * Runs in Node:     node game/verify.js [mcDraws]
 * Runs in browser:  open game/verify.html
 *
 * This exercises the SAME resolveRound() the machine pays from.  Every exact
 * RTP below is computed by calling it with synthetic inputs engineered to
 * produce a given (catch, depth) -- so a lookup bug, an absent-key bug or a
 * missing clip shows up here rather than on a machine.
 *
 * If this and verifybonus1.py disagree, the game is wrong.  The Python is the
 * reference implementation, the JSON is the source of truth, and this is the
 * thing being checked.  docs/30-GAME-SPEC.md section 7.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WyrmVerify = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var isNode = (typeof module === 'object' && module.exports);
  var W = isNode ? require('./engine.js') : self.Wyrm;
  var D = isNode ? require('./data.js')   : self.WyrmData;

  /* ------------------------------------------------- exact combinatorics */

  var bigCache = {};
  function combBig(n, k) {
    if (k < 0 || k > n) return 0n;
    var key = n + ',' + k;
    if (bigCache[key]) return bigCache[key];
    var r = 1n, N = BigInt(n), i;
    for (i = 0; i < k; i++) r = r * (N - BigInt(i)) / BigInt(i + 1);
    bigCache[key] = r;
    return r;
  }
  var SCALE = 1000000000000000000n;              // 1e18, keeps ~15 good digits
  function ratio(num, den) { return Number(num * SCALE / den) / 1e18; }

  /* Section 7 compares against the engine's float path, which is good to about
     one ulp -- better than `ratio` above, whose truncating BigInt division
     carries ~1.4e-12.  Comparing the two at that resolution would measure this
     file's rounding rather than the engine's, so section 7 gets a reference
     with enough digits to be the reference. */
  var SCALE_HI = 10n ** 30n;
  function ratioHi(num, den) { return Number(num * SCALE_HI / den) / 1e30; }
  function pCatchHi(n, k) {
    if (k < 0 || k > n) return 0;
    return ratioHi(combBig(n, k) * combBig(80 - n, 20 - k), C8020);
  }
  function pEggHi(n, k, m) {
    m = m || 3;
    if (20 - k < m) return 0;
    return ratioHi(combBig(20 - k, m), combBig(80 - n, m));
  }

  var C8020 = combBig(80, 20);
  function pCatch(n, k) { return ratio(combBig(n, k) * combBig(80 - n, 20 - k), C8020); }

  // P(all m eggs among the drawn | player caught k of n).  Eggs sit on the
  // 80-n unpicked numbers; 20-k of those are drawn.
  function pEgg(n, k, m) {
    m = m || 3;
    if (20 - k < m) return 0;
    return ratio(combBig(20 - k, m), combBig(80 - n, m));
  }

  var ST = D.bonus.structure;
  var EGGS = ST.eggs, CHESTS = ST.chests, AWARDS = ST.awards;
  var i;

  function mean(a) { var t = 0, q; for (q = 0; q < a.length; q++) t += a[q]; return t / a.length; }
  function placedFor(aw) { return aw.sym === 'egg' ? EGGS : CHESTS; }

  /* P(exactly j of a NAMED m-set are among the 20 drawn) = C(20,j)C(60,m-j)/C(80,m).
     Derived here from scratch rather than read out of data.js -- a corrupted structure
     block has to fail a check, not quietly define truth. The spot count does not appear
     in it, which is why every rate below holds at pick 4 and at pick 10 alike. */
  function pSet(m, j) {
    return ratio(combBig(20, j) * combBig(60, m - j), combBig(80, m));
  }
  function pAward(aw) { return pSet(placedFor(aw), aw.count); }

  /* THE STACK, rebuilt here from free_mult rather than read out of data.js. */
  function stepUp(table, count) {
    var best = 1, k;
    for (k in table) if (count >= +k && table[k] > best) best = table[k];
    return best;
  }
  function stackFor(j, c, x) {
    var fm = ST.free_mult || {};
    return stepUp(fm.egg || {}, j) * stepUp(fm.chest || {}, c) * stepUp(fm.x || {}, x);
  }
  var NX = ST.x_symbols || 0, XCOIN = ST.x_coin || 0;

  /* which awards an EXACT symbol count opens, in a paid round */
  function firedFor(j, ci) {
    var out = [], q;
    for (q = 0; q < AWARDS.length; q++)
      if ((AWARDS[q].sym === 'egg' ? j : ci) === AWARDS[q].count) out.push(q);
    return out;
  }

  /* P(exactly g_i of set i drawn, for every i | the player caught k of n).
     All the reserved squares come from ONE sample of the unpicked numbers, so this is a
     single multivariate hypergeometric. Falling factorials, not C(80,20): the textbook
     form builds C(76,20) on the way and that is 1,800x past 2^53. */
  function fall(x, m) { var r = 1, q; for (q = 0; q < m; q++) r *= (x - q); return r; }
  function jointP(n, k, groups) {
    var tot = 0, m = 0, q, un = 80 - n, dr = 20 - k, ways = 1;
    for (q = 0; q < groups.length; q++) { tot += groups[q][0]; m += groups[q][1]; }
    if (m > dr || tot - m > un - dr || un < tot) return 0;
    for (q = 0; q < groups.length; q++) ways *= W.combF(groups[q][0], groups[q][1]);
    return ways * fall(dr, m) * fall(un - dr, tot - m) / fall(un, tot);
  }

  /* free games bought per PAID round -- a pick costs its MEAN */
  var K_TRIG = 0, P_TRIG = 0;
  for (i = 0; i < AWARDS.length; i++) {
    P_TRIG += pAward(AWARDS[i]);
    if (AWARDS[i].kind !== 'cash') K_TRIG += pAward(AWARDS[i]) * mean(AWARDS[i].values);
  }
  /* THE RETRIGGER RUNG. Rebuilt from free_retrigger, not read from data.js: g extra games
     per free game, so a run is 1/(1-g) games and the feature costs K_TRIG/(1-g). */
  var RT = ST.free_retrigger || {};
  function bestAt(table, count) {
    var best = 0, k;
    for (k in table) if (count >= +k && table[k] > best) best = table[k];
    return best;
  }
  function retrigFor(j, ci) { return bestAt(RT.egg || {}, j) + bestAt(RT.chest || {}, ci); }
  /* The rung's rate is UNCONDITIONAL on the catch: a free game's retrigger count changes
     how many games follow, not what those games are worth, so the run is geometric in the
     plain expectation g and the feature costs K_TRIG/(1-g). Built here by marginalising
     the joint over the catch at one pick (any pick gives the same number, since the
     symbols sit on unpicked squares), and cross-checked against the closed form
     sum_j pSet(4,j)*games. Conditioning on a catch is WRONG -- P(3 eggs | caught 0) is
     not P(3 eggs) -- and the first draft of this block did exactly that. */
  var G_RETRIG = 0, jj0, cc0, kk0;
  for (kk0 = 0; kk0 <= 4; kk0++)
    for (jj0 = 0; jj0 <= EGGS; jj0++)
      for (cc0 = 0; cc0 <= CHESTS; cc0++)
        G_RETRIG += pCatch(4, kk0) * jointP(4, kk0, [[EGGS, jj0], [CHESTS, cc0]]) * retrigFor(jj0, cc0);
  var G_CHECK = 0;
  for (jj0 = 0; jj0 <= EGGS; jj0++) G_CHECK += pSet(EGGS, jj0) * bestAt(RT.egg || {}, jj0);
  var K_EFF = K_TRIG / (1 - G_RETRIG);

  /* ONE TILE PER SYMBOL HIT. Three eggs out, three eggs to open. It is a presentation
     rule, but it is also the kind of thing that drifts silently when a rung is edited,
     so it is asserted rather than trusted. */
  var badTiles = 0;
  for (i = 0; i < AWARDS.length; i++)
    if (AWARDS[i].values.length !== AWARDS[i].count) badTiles++;

  /* ------------------------------------------------------------- reporting */

  // Node only.  Resolves a generator output file across both project layouts.
  function dataFile(name) {
    var fs = require('fs'), path = require('path');
    var tries = [path.join(__dirname, '..', name), path.join(__dirname, '..', 'Docs', name)];
    for (var i = 0; i < tries.length; i++) if (fs.existsSync(tries[i])) return tries[i];
    throw new Error(name + ' not found in ' + tries.join(' or '));
  }

  var out = [], fails = 0;
  function say(s) { out.push(s); }
  function check(cond, msg) { if (!cond) { say('  FAIL: ' + msg); fails++; } }

  /* --------------------- synthetic inputs that hit a given (catch, depth) */

  // picks are 1..n.  To land exactly k catches we draw the first k picks plus
  // (20-k) numbers taken from above n.  The eleven reserved squares are then dealt
  // from the drawn-unpicked block or the undrawn block to order, so the caller gets
  // exactly j eggs and ci chests drawn.
  //
  // Which particular squares they land on never matters -- the award depends on the
  // COUNTS alone -- so one representative arrangement carries the whole probability
  // mass the caller sums over.
  function synth(n, k, j, ci, xi, nx) {
    var picks = [], drawn = [], i;
    xi = xi || 0; nx = nx || 0;
    for (i = 1; i <= n; i++) picks.push(i);
    for (i = 0; i < k; i++) drawn.push(picks[i]);
    for (i = 0; i < 20 - k; i++) drawn.push(n + 1 + i);
    var ds = W.toSet(drawn), du = [], un = [];
    for (i = n + 1; i <= 80; i++) (ds[i] ? du : un).push(i);
    // deal each set its drawn share from the drawn-unpicked block and the rest from the
    // undrawn one, walking a cursor through both so no square is used twice
    var dc = 0, uc = 0;
    function take(nDrawn, nTotal) {
      var out = du.slice(dc, dc + nDrawn).concat(un.slice(uc, uc + nTotal - nDrawn));
      dc += nDrawn; uc += nTotal - nDrawn;
      return out;
    }
    var eggs = take(j, EGGS);
    var chests = take(ci, CHESTS);
    var xs = take(xi, nx);
    return { picks: picks, drawn: drawn, eggs: eggs, chests: chests, xs: xs };
  }

  /* ------------------------------------------------------ exact RTP per cell */

  /* Every outcome exactly once, with its exact probability, through the real resolver.
     `free` decides whether the X is on the board at all -- it exists in free games and
     nowhere else -- so a paid round walks a 9-square joint and a free game a 10-square
     one. The pick amounts are enumerated as a cross product, because the cap clips each
     one separately and the mean of the clips is not the clip of the mean. */
  function eachOutcome(denom, tier, n, free, visit) {
    var k, j, ci, xi, sy, r;
    var nx = free ? NX : 0;
    for (k = 0; k <= n; k++) {
      var pk = pCatch(n, k);
      if (pk === 0) continue;
      for (j = 0; j <= EGGS; j++) {
        for (ci = 0; ci <= CHESTS; ci++) {
          for (xi = 0; xi <= nx; xi++) {
            var pc = jointP(n, k, [[EGGS, j], [CHESTS, ci], [nx, xi]]);
            if (pc <= 0) continue;
            sy = synth(n, k, j, ci, xi, nx);
            var fired = firedFor(j, ci);

            var combos = [[]], q, c2, a2;
            for (q = 0; q < fired.length; q++) {
              var vals = AWARDS[fired[q]].values, next = [];
              for (c2 = 0; c2 < combos.length; c2++)
                for (a2 = 0; a2 < vals.length; a2++)
                  next.push(combos[c2].concat([vals[a2]]));
              combos = next;
            }
            for (c2 = 0; c2 < combos.length; c2++) {
              r = W.resolveRound(D, { denom: denom, tier: tier, spots: n, picks: sy.picks,
                                      drawn: sy.drawn, eggs: sy.eggs, chests: sy.chests,
                                      xs: sy.xs, chosen: combos[c2], free: free });
              if (r.hits !== k) throw new Error('synth miss ' + n + '/' + k);
              if (r.eggsOut !== j) throw new Error('synth placed ' + r.eggsOut + ' eggs, wanted ' + j);
              if (r.chestsOut !== ci) throw new Error('synth placed ' + r.chestsOut + ' chests, wanted ' + ci);
              if (r.xOut !== xi) throw new Error('synth placed ' + r.xOut + ' X, wanted ' + xi);
              var wantM = free ? stackFor(j, ci, xi) : 1;
              if (r.mult !== wantM)
                throw new Error('stack ' + r.mult + ', wanted ' + wantM + ' at ' + j +
                                ' eggs / ' + ci + ' chests / ' + xi + ' X, free=' + free);
              /* THE X COIN goes inside the stack and inside the cap, and exists only in
                 a free game. Checked against a value rebuilt here, not read back. */
              var wantC = free ? xi * XCOIN : 0;
              if (r.coins !== wantC)
                throw new Error('coins ' + r.coins + ', wanted ' + wantC + ' at ' + xi + ' X, free=' + free);
              var wantRt = free ? retrigFor(j, ci) : 0;
              if (r.retrig !== wantRt)
                throw new Error('retrig ' + r.retrig + ', wanted ' + wantRt + ' at ' + j + ' eggs, free=' + free);
              var wantRaw = (r.base + wantC) * wantM + r.cash;
              if (r.raw !== wantRaw)
                throw new Error('raw ' + r.raw + ', wanted (' + r.base + '+' + wantC + ')*' + wantM + '+' + r.cash);
              visit(pk * pc / combos.length, r);
            }
          }
        }
      }
    }
  }

  /* THE RETURN OF ONE BET.
   *
   *     T  =  A_paid  +  k * A_free
   *
   * A_free carries the stack and the clip together -- the multiplier goes INSIDE the
   * cap, so a x360 on a good catch is worth the cap and no more. That is most of why
   * the top of the range is affordable; priced linearly it would look six times dearer
   * than it is. There was a third term, the hoard pot; it was removed at v0.25.0-alpha
   * and its point handed back to the base paytable. */
  function roundValue(denom, tier, n, free) {
    var a = 0;
    eachOutcome(denom, tier, n, free, function (w, r) { a += w * r.award; });
    return a;
  }
  function exactRtp(denom, tier, n) {
    return roundValue(denom, tier, n, false) +
           K_EFF * roundValue(denom, tier, n, true);
  }

  /* --------------------------------------- exact payout SD, for MC tolerances
   *
   * A bet pays X (paid round) and spawns G free games, each drawn from the FREE
   * distribution. Conditioning on the paid round, which fixes both X and G:
   *
   *     E[Y | X,G]   = X + G*A_free       Var(Y | X,G) = G*Var_free
   *     =>  Var(Y) = k*Var_free + Var(X + G*A_free)
   *
   * X and G are correlated -- more symbols drawn means fewer catches -- and G is random
   * in its own right, since the run length is whatever the pick held. Both stay inside
   * the joint walk. */
  function exactSd(denom, tier, n) {
    var f1 = 0, f2 = 0;
    eachOutcome(denom, tier, n, true, function (w, r) {
      f1 += w * r.award; f2 += w * r.award * r.award;
    });
    var varFree = f2 - f1 * f1;
    var y1 = 0, y2 = 0;
    eachOutcome(denom, tier, n, false, function (w, r) {
      var y = r.award + r.freeGames * f1;
      y1 += w * y; y2 += w * y * y;
    });
    /* K_EFF, not K_TRIG: the retriggered games carry the same per-game variance. The
       extra randomness in the run LENGTH from the rung is ignored here (g = 0.05), which
       makes this SD a hair small and the 4-sigma test a hair strict, not lenient. */
    return Math.sqrt(K_EFF * varFree + (y2 - y1 * y1));
  }

  /* ------------------------------------------------------- Monte Carlo core */

  // One whole BET from scratch: draw 20 of 80 by permutation, place the eggs and chests
  // on distinct unpicked numbers, resolve, then play out every free game the round leads
  // to -- INCLUDING the ones those free games win, since a free game is a full round.
  // Nothing closed-form is reused, which is what makes it a cross-check rather than a
  // restatement.
  function mc(denom, tier, n, draws, rng) {
    var pool = new Uint8Array(80), swaps = new Int32Array(20), i, j, t, d;
    for (i = 0; i < 80; i++) pool[i] = i + 1;
    var picks = []; for (i = 1; i <= n; i++) picks.push(i);
    var pickSet = W.toSet(picks);
    var drawnSet = {}, drawn = new Array(20);
    var unpicked = []; for (i = 1; i <= 80; i++) if (!pickSet[i]) unpicked.push(i);
    var total = 0, fired = 0, freePlayed = 0, cashHits = 0, longest = 0, stacks = {};
    var betC = Math.round(Number(denom) * 100);
    var guard = ST.free_game_cap || 500;

    function spin(free) {
      for (i = 0; i < 20; i++) {
        j = i + W.randInt(rng, 80 - i);
        swaps[i] = j; t = pool[i]; pool[i] = pool[j]; pool[j] = t;
        drawn[i] = pool[i];
      }
      for (i = 0; i < 20; i++) drawnSet[drawn[i]] = true;
      var nx = free ? NX : 0;
      var sym = W.sampleFrom(rng, unpicked, EGGS + CHESTS + nx);
      var eggsA = sym.slice(0, EGGS), chestsA = sym.slice(EGGS, EGGS + CHESTS);
      var xsA = sym.slice(EGGS + CHESTS);
      var fired = W.awardsFor(ST, W.countDrawn(eggsA, drawnSet),
                                  W.countDrawn(chestsA, drawnSet));
      var chosen = [], q;
      for (q = 0; q < fired.length; q++)
        chosen.push(W.freeGameLayout(rng, ST.awards[fired[q]].values)[0]);
      var r = W.resolveRound(D, { denom: denom, tier: tier, spots: n, picks: picks,
                                  drawn: drawn, drawnSet: drawnSet,
                                  eggs: eggsA, chests: chestsA, xs: xsA,
                                  chosen: chosen, free: free });
      for (i = 0; i < 20; i++) delete drawnSet[drawn[i]];
      for (i = 19; i >= 0; i--) { j = swaps[i]; t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
      return r;
    }

    for (d = 0; d < draws; d++) {
      var r = spin(false);
      total += r.award;
      if (r.cash > 0) cashHits++;
      var pending = r.freeGames, played = 0;
      if (pending) fired++;
      // g, not i: spin() drives the shared i and leaves it at -1 on the way out
      while (pending > 0 && played < guard) {
        pending--; played++;
        var f = spin(true);
        total += f.award;
        stacks[f.mult] = (stacks[f.mult] || 0) + 1;
        if (ST.retrigger) pending += f.freeGames;
        pending += f.retrig;
        if (f.cash > 0) cashHits++;
      }
      freePlayed += played;
      if (played > longest) longest = played;
    }
    return { mean: total / draws, fired: fired, freePlayed: freePlayed,
             cashHits: cashHits, longest: longest, stacks: stacks };
  }

  /* ------------------------------------------------------------------- run */

  function run(opts) {
    opts = opts || {};
    var MC = opts.mcDraws || 10000000;   // 30-GAME-SPEC section 7.4.  ~9 min in Node.
    var SEED = opts.seed || 20260731;
    out = []; fails = 0;

    /* 1 -- data.js matches the source JSON (Node only; browsers can't read files) */
    say('=== 1. data.js against the source JSON ===');
    if (isNode) {
      var fs = require('fs'), path = require('path');
      // The docs describe a flat root with the JSON beside game/; the build the
      // prototype actually ships from keeps the generators and their output in
      // Docs/ beside public/.  Look in both rather than pinning either.
      var pay = JSON.parse(fs.readFileSync(dataFile('paytables_v2.json'), 'utf8'));
      var bon = JSON.parse(fs.readFileSync(dataFile('bonus_v8.json'), 'utf8'));
      // key order differs between the JSON files and the packed blob, so compare
      // canonically rather than by raw stringify
      check(canon(pay) === canon(D.paytables), 'data.js paytables differ from paytables_v2.json');
      check(canon(bon) === canon(D.bonus), 'data.js bonus differs from bonus_v8.json');
      say('  paytables_v2.json + bonus_v8.json == data.js  (rerun packdata.py if this fails)');
    } else {
      say('  skipped in browser -- run `node game/verify.js` for this check');
    }

    /* 2 -- the bonus */
    say('');
    say('=== 2. the bonus ===');
    var denomsAll = Object.keys(D.paytables);
    var dj, tj, nj, ai;

    say('  ' + EGGS + ' eggs, ' + CHESTS + ' chests, on numbers the player did not pick');
    say('  ' + pad('trigger', 18) + pad('rate', 14) + pad('open 1 of', 11) +
        pad('holds', 22) + 'mean');
    for (ai = 0; ai < AWARDS.length; ai++) {
      var aw = AWARDS[ai];
      say('  ' + pad(aw.count + ' of ' + placedFor(aw) + ' ' + aw.sym + 's', 18) +
          pad('1 in ' + (1 / pAward(aw)).toFixed(1), 14) +
          pad(String(aw.values.length), 11) +
          pad(aw.values.join('/') + (aw.kind === 'cash' ? 'x cash' : ' games'), 22) +
          mean(aw.values).toFixed(2));
    }
    say('  every rate above holds at every spot count -- n is not in the formula');
    say('  something fires about 1 round in ' + Math.round(1 / P_TRIG));
    say('  free games per round ' + K_TRIG.toFixed(5) + ' at the trigger, ' + K_EFF.toFixed(5) +
        ' with retriggers, so ' + (100 * K_EFF / (1 + K_EFF)).toFixed(1) + '% of all rounds played are free');
    if (RT.egg || RT.chest) {
      say('  THE RETRIGGER RUNG, inside a free game (no pick, flat games added to the run):');
      ['egg', 'chest'].forEach(function (sy) {
        var tb = RT[sy] || {}, placedN = sy === 'egg' ? EGGS : CHESTS;
        Object.keys(tb).map(Number).sort(function (a, b) { return a - b; }).forEach(function (th) {
          var pth = 0, qq;
          for (qq = th; qq <= placedN; qq++) pth += pSet(placedN, qq);
          say('      ' + pad(th + '+ of ' + placedN + ' ' + sy, 18) + pad('1 in ' + (1 / pth).toFixed(1), 13) + '-> +' + tb[String(th)] + ' game' + (tb[String(th)] > 1 ? 's' : ''));
        });
      });
      say('      ' + G_RETRIG.toFixed(5) + ' extra games per free game; a run is x' + (1 / (1 - G_RETRIG)).toFixed(4) + ' its pick');
      check(Math.abs(G_RETRIG - G_CHECK) < 1e-12, 'retrigger rate by jointP ' + G_RETRIG + ' disagrees with pSet ' + G_CHECK);
      check(G_RETRIG < 1, 'the retrigger rung does not terminate');
      check(Math.abs(G_RETRIG - (ST.retrig_per_free_game || 0)) < 1e-12, 'harness retrigger rate disagrees with data.js');
      check(Math.abs(K_EFF - (ST.free_games_per_round_eff || K_TRIG)) < 1e-12, 'harness effective free games per round ' + K_EFF + ' disagrees with data.js ' + ST.free_games_per_round_eff);
    }
    check(badTiles === 0, badTiles + ' award(s) do not offer one tile per symbol hit');
    say('  one tile per symbol hit: ' + (badTiles ? 'BROKEN' : 'holds for all ' +
        AWARDS.length + ' awards'));
    say('  retrigger ' + (ST.retrigger ? 'ON' : 'off -- free games do not win free games'));
    say('  IN A FREE GAME the symbols become multipliers, and they stack:');
    var fmOrder = ['egg', 'chest', 'x'], fq, fk;
    for (fq = 0; fq < fmOrder.length; fq++) {
      var symn = fmOrder[fq], tbl = (ST.free_mult || {})[symn];
      if (!tbl) continue;
      var placedN = symn === 'x' ? NX : (symn === 'egg' ? EGGS : CHESTS);
      var ths = Object.keys(tbl).map(Number).sort(function (a, b) { return a - b; });
      for (fk = 0; fk < ths.length; fk++) {
        var pth = 0, qq;
        for (qq = ths[fk]; qq <= placedN; qq++) pth += pSet(placedN, qq);
        say('      ' + pad(ths[fk] + '+ of ' + placedN + ' ' + symn, 18) +
            pad('1 in ' + (1 / pth).toFixed(1), 13) + '-> x' + tbl[String(ths[fk])]);
      }
    }
    say('      the two multiply. top of the range x' + ST.top_stack);
    say('  THE X IS A COIN: ' + pad('1 of ' + NX + ' X', 18) + pad('1 in ' + (1 / pSet(NX, 1)).toFixed(1), 13) +
        '-> +' + XCOIN + ' bet, added to the catch win before the stack multiplies');
    say('  the X exists in free games and nowhere else');
    check(NX === 0 || XCOIN > 0 || !!(ST.free_mult && ST.free_mult.x),
          'the X is on the board in free games but is neither a coin nor a multiplier');

    /* A pick costs its MEAN, not its smallest. Worth stating in the harness output,
       because "5 to 12 free games" reads like 5 and prices like 8.33. */
    for (ai = 0; ai < AWARDS.length; ai++)
      if (AWARDS[ai].kind !== 'cash')
        say('  ' + pad(AWARDS[ai].values.join('/') + ' games', 18) + 'costs ' +
            (100 * pAward(AWARDS[ai]) * mean(AWARDS[ai].values)).toFixed(2) +
            ' points, the same as a flat ' + mean(AWARDS[ai].values).toFixed(2));

    /* If free games could buy free games at a rate of one or more per round the feature
       would not terminate and the return would be unbounded. The retrigger is off, so
       this is trivially satisfied -- but it stays, because turning the flag back on is
       one line and this is the line that would catch it. */
    check(K_TRIG < 1, 'free games per round is ' + K_TRIG.toFixed(4) +
                      ' -- the feature would not terminate with the retrigger on');

    /* The Hoard Bonus is GUARANTEED. Not "usually pays" -- the smallest tile is a real
       floor, and the only thing that can take it away is the cap sitting on top of an
       already-huge base win. */
    var cashAw = null;
    for (ai = 0; ai < AWARDS.length; ai++) if (AWARDS[ai].kind === 'cash') cashAw = AWARDS[ai];
    if (cashAw) {
      var minCash = Math.min.apply(null, cashAw.values);
      say('  ' + (cashAw.name || 'the cash pick') + ' never pays less than ' + minCash + 'x the bet');
      check(minCash > 0, 'the cash pick can pay nothing');
    }

    /* Every cell's recorded arithmetic, recomputed through the resolver. */
    var worstBase = 0, worstA = 0, worstTot = 0, worstCell2 = '';
    for (dj = 0; dj < denomsAll.length; dj++) {
      for (tj = 1; tj <= 6; tj++) {
        for (nj = 4; nj <= 10; nj++) {
          var rec = D.bonus.cells[denomsAll[dj]][String(tj)][String(nj)];
          var pays = D.paytables[denomsAll[dj]].tiers[String(tj)].pays[String(nj)];
          var b = 0, kk2;
          for (kk2 = 0; kk2 <= nj; kk2++) b += pCatch(nj, kk2) * (pays[String(kk2)] || 0);
          var A = roundValue(denomsAll[dj], tj, nj, false);
          var Af = roundValue(denomsAll[dj], tj, nj, true);
          worstBase = Math.max(worstBase, Math.abs(b - rec.base_rtp));
          worstA = Math.max(worstA, Math.max(Math.abs(A - rec.paid_value),
                                             Math.abs(Af - rec.free_value)));
          var tot = A + K_EFF * Af;
          if (Math.abs(tot - rec.total_rtp) > worstTot) {
            worstTot = Math.abs(tot - rec.total_rtp);
            worstCell2 = '$' + denomsAll[dj] + ' t' + tj + ' pick ' + nj;
          }
        }
      }
    }
    say('  worst disagreement with bonus_v8.json: base ' + worstBase.toExponential(2) +
        ', round values ' + worstA.toExponential(2) + ', total ' + worstTot.toExponential(2) +
        (worstCell2 ? '  (' + worstCell2 + ')' : ''));
    check(Math.abs(K_TRIG - ST.free_games_per_round) < 1e-12,
          'harness free-games-per-round ' + K_TRIG.toFixed(12) +
          ' disagrees with data.js ' + ST.free_games_per_round.toFixed(12));
    check(stackFor(EGGS, CHESTS, NX) === ST.top_stack,
          'harness top stack ' + stackFor(EGGS, CHESTS, NX) +
          ' disagrees with data.js ' + ST.top_stack);
    check(worstBase < 1e-6, 'a cell disagrees with its own recorded base_rtp');
    check(worstA < 1e-6, 'a cell disagrees with its own recorded round_value');
    check(worstTot < 1e-6, 'a cell disagrees with its own recorded total_rtp');

    /* 3 -- $800 audit through the real resolver */
    say('');
    say('=== 3. $800 cap audit ===');
    var denoms = Object.keys(D.paytables), dn, tier, n;
    say('  the stack is what reaches the cap: a x30 on a catch that pays 20x in the');
    say('  paid game is 600x, and 400x IS the cap at $2. Paid and free both walked.');
    say('  ' + pad('denom', 8) + pad('cap', 10) + pad('worst raw', 12) +
        pad('RTP clipped', 13) + pad('clips 1 in', 13) + pad('resolver', 9));
    for (var di = 0; di < denoms.length; di++) {
      dn = denoms[di];
      var cap = W.capFor(dn), worst = 0, allCaught = true, lost = 0, pClip = 0;
      for (tier = 1; tier <= 6; tier++) {
        for (n = 4; n <= 10; n++) {
          // a bet plays one paid round plus k free ones, and the clip has to be walked
          // in BOTH -- the free game is where the stack sends it over
          [[false, 1 / 42], [true, K_EFF / 42]].forEach(function (mode) {
            eachOutcome(dn, tier, n, mode[0], function (w, r) {
              if (r.raw <= cap) return;
              worst = Math.max(worst, r.raw);
              pClip += w * mode[1]; lost += w * (r.raw - cap) * mode[1];
              if (r.award !== cap || !r.clipped) allCaught = false;
            });
          });
        }
      }
      say('  ' + pad('$' + dn, 8) + pad(cap.toLocaleString() + 'x', 10) +
          pad(worst ? worst.toLocaleString() + 'x' : '-', 12) +
          pad(lost.toExponential(2), 13) +
          // once nothing multiplies a win the clip is astronomically rare, and the
          // exact figure past a billion is noise rather than information
          pad(pClip <= 0 ? 'never'
              : 1 / pClip > 1e9 ? '> 1 in 1e9'
              : Math.round(1 / pClip).toLocaleString(), 13) +
          pad(allCaught ? 'clips' : 'BROKEN', 9));
      check(allCaught, '$' + dn + ' has an over-cap combination the resolver does not clip');
    }
    say('  every over-cap combination in the grid resolves to exactly the cap');
    say('  (clip rate and lost RTP are per BET including free games, over the 42 cells)');

    /* 4 -- all 252 exact RTPs, against rtp_252.csv in Node */
    say('');
    say('=== 4. all 252 game types ===');
    say('  paid round + ' + K_EFF.toFixed(5) + ' free games (retriggers included) carrying the stack');
    var csv = null;
    if (isNode) {
      var fs2 = require('fs');
      var p = null;
      try { p = dataFile('rtp_252.csv'); } catch (e) { p = null; }
      if (p) {
        // by header NAME, not by position -- rtp_252.csv grew three columns when the
        // bonus changed, and a positional read went on silently comparing the cell
        // total against base_rtp, which fails 252 times and says nothing useful
        // Python writes this file in text mode on Windows, so every line ends \r\n
        var lines = fs2.readFileSync(p, 'utf8').trim().split(/\r?\n/);
        var head = lines[0].split(','), col = head.indexOf('total_rtp');
        if (col < 0) throw new Error('rtp_252.csv has no total_rtp column');
        csv = {};
        lines.slice(1).forEach(function (line) {
          var f = line.split(',');
          csv[f[0] + '|' + f[1] + '|' + f[2]] = parseFloat(f[col]);
        });
      }
    }
    var lo = { v: 9 }, hi = { v: -1 }, worstDelta = 0, worstCell = '';
    for (di = 0; di < denoms.length; di++) {
      dn = denoms[di];
      for (tier = 1; tier <= 6; tier++) {
        for (n = 4; n <= 10; n++) {
          var v = exactRtp(dn, tier, n);
          if (v < lo.v) lo = { v: v, cell: '$' + dn + ' t' + tier + ' pick ' + n };
          if (v > hi.v) hi = { v: v, cell: '$' + dn + ' t' + tier + ' pick ' + n };
          check(v >= 0.80, '$' + dn + ' t' + tier + ' pick ' + n + ' returns ' + pct(v) + ' < 80%');
          if (csv) {
            var ref = csv[dn + '|' + tier + '|' + n];
            var dlt = Math.abs(v - ref);
            if (dlt > worstDelta) { worstDelta = dlt; worstCell = '$' + dn + ' t' + tier + ' pick ' + n; }
            check(dlt < 1e-6, '$' + dn + ' t' + tier + ' pick ' + n + ' JS ' + v.toFixed(8) +
                              ' vs Python ' + ref.toFixed(8));
          }
        }
      }
    }
    say('  lowest  ' + pct(lo.v) + '  (' + lo.cell + ')');
    say('  highest ' + pct(hi.v) + '  (' + hi.cell + ')');
    if (csv) say('  vs rtp_252.csv: worst disagreement ' + worstDelta.toExponential(2) +
                 (worstCell ? '  (' + worstCell + ')' : ''));
    else     say('  rtp_252.csv not found -- run verifybonus1.py to emit it');

    /* 5 -- full-round Monte Carlo, per-cell 4-sigma tolerance */
    say('');
    say('=== 5. Monte Carlo, full round, ' + MC.toLocaleString() + ' draws ===');
    say('  tolerance is 4 standard errors from each cell\'s exact payout variance,');
    say('  not a flat percentage -- payout SD across the grid spans a factor of seven.');
    say('  ' + pad('case', 20) + pad('sim', 11) + pad('exact', 11) + pad('diff', 10) +
        pad('SD', 8) + pad('SE', 9) + pad('z', 7) + 'free games / hoard');
    var lastLongest = 0, lastStacks = null;
    var CASES = [['2.00', 6, 10], ['2.00', 1, 4], ['0.05', 6, 8], ['0.25', 3, 9], ['1.00', 4, 7]];
    var rng = W.seededRng(SEED);
    for (var ci = 0; ci < CASES.length; ci++) {
      var c = CASES[ci];
      var ex = exactRtp(c[0], c[1], c[2]);
      var sd = exactSd(c[0], c[1], c[2]);
      var se = sd / Math.sqrt(MC);
      var got = mc(c[0], c[1], c[2], MC, rng);
      var z = (got.mean - ex) / se;
      var ok = Math.abs(got.mean - ex) <= 4 * se;
      say('  ' + pad('$' + c[0] + ' t' + c[1] + ' pick ' + c[2], 20) +
          pad(pct(got.mean), 11) + pad(pct(ex), 11) + pad(sign(got.mean - ex), 10) +
          pad(sd.toFixed(2), 8) + pad(pct(se), 9) + pad((z >= 0 ? '+' : '') + z.toFixed(2), 7) +
          got.freePlayed.toLocaleString() + ' / ' + got.cashHits.toLocaleString() +
          (ok ? '' : '   OUT'));
      lastLongest = Math.max(lastLongest, got.longest); lastStacks = got.stacks;
      check(ok, 'MC $' + c[0] + ' t' + c[1] + ' pick ' + c[2] + ' off by ' +
                sign(got.mean - ex) + ' = ' + z.toFixed(2) + ' sigma');
    }
    var pCash = 0;
    for (i = 0; i < AWARDS.length; i++) if (AWARDS[i].kind === 'cash') pCash += pAward(AWARDS[i]);
    say('  expected free games per case: ' + Math.round(MC * K_EFF).toLocaleString() +
        ', hoard bonuses ' + Math.round(MC * pCash * (1 + K_EFF)).toLocaleString() +
        ', longest run seen ' + lastLongest);
    if (lastStacks) {
      var sk = Object.keys(lastStacks).map(Number).sort(function (a, b) { return a - b; });
      say('  stacks seen in the last case: ' + sk.map(function (m) {
        return 'x' + m + ' ' + lastStacks[m].toLocaleString(); }).join('   '));
    }

    /* 6 -- every pick's amounts are a uniform shuffle.
     *
     * Be precise about what this does and does not prove. It shows the COMMITTED layout
     * is uniform, which is the engine half of the zero-EV agency claim: every tile is
     * equally likely to hold every amount, so the choice cannot be worth anything and
     * cannot be worth nothing either -- and a pick therefore costs its mean, which is
     * what section 2 prices it at. It cannot detect a UI that decides what is under a
     * tile at click time, because that code lives in index.html and this file never
     * touches the DOM.
     */
    say('');
    say('=== 6. every pick is a uniform shuffle ===');
    say('  the engine half of the zero-EV agency claim in docs/28-THE-PICKS.md');
    var N = 200000, rng2 = W.seededRng(SEED + 1), maxDev = 0, jj, pos, a, b, ax;
    for (ax = 0; ax < AWARDS.length; ax++) {
      var vals = AWARDS[ax].values, L = vals.length, tally = [];
      for (a = 0; a < L; a++) { tally.push({}); for (b = 0; b < L; b++) tally[a][vals[b]] = 0; }
      for (jj = 0; jj < N; jj++) {
        var lay = W.freeGameLayout(rng2, vals);
        for (pos = 0; pos < L; pos++) tally[pos][lay[pos]]++;
      }
      var dev = 0;
      for (a = 0; a < L; a++)
        for (b = 0; b < L; b++)
          dev = Math.max(dev, Math.abs(tally[a][vals[b]] / N - 1 / L));
      maxDev = Math.max(maxDev, dev);
      say('  ' + pad(vals.join('/'), 20) + 'worst departure from 1-in-' + L + ': ' +
          (dev * 100).toFixed(3) + 'pp');
    }
    say('  ' + N.toLocaleString() + ' layouts each, every position against every amount');
    check(maxDev < 0.006, 'a pick is not uniform (dev ' + (maxDev * 100).toFixed(3) + 'pp)');

    /* 7 -- the engine's probability primitives.
     *
     * engine.js computes P(n,k) from the draw's side, C(20,k)C(60,n-k)/C(80,n),
     * because that form stays inside float64's exact-integer range and the
     * ticket's side does not.  This harness keeps its own BigInt implementation
     * of the ticket's side, so the two are genuinely independent and this
     * section is the thing that proves the rewrite in
     * docs/11-KENO-MATH-PRIMER.md did not change a single number. */
    say('');
    say('=== 7. engine probability primitives ===');
    say('  engine draw-side floats vs harness ticket-side BigInt');
    var wCatch = 0, wEgg = 0, wSum = 0, nn, kk;
    for (nn = 2; nn <= 10; nn++) {
      var tot = 0;
      for (kk = 0; kk <= nn; kk++) {
        var refC = pCatchHi(nn, kk), gotC = W.pCatch(nn, kk);
        var refE = pEggHi(nn, kk, CHESTS), gotE = W.pEggs(nn, kk, CHESTS);
        tot += gotC;
        if (refC > 0) wCatch = Math.max(wCatch, Math.abs(gotC - refC) / refC);
        if (refE > 0) wEgg   = Math.max(wEgg,   Math.abs(gotE - refE) / refE);
      }
      wSum = Math.max(wSum, Math.abs(tot - 1));
    }
    var trigHi = ratioHi(combBig(80 - CHESTS, 20 - CHESTS), C8020);
    var wTrig = Math.abs(W.pTrigger(CHESTS) - trigHi) / trigHi;
    say('  pCatch   worst relative disagreement ' + wCatch.toExponential(3));
    say('  pEggs    worst relative disagreement ' + wEgg.toExponential(3));
    say('  pTrigger ' + W.pTrigger(CHESTS).toFixed(12) + '  (all ' + CHESTS +
        ' chests, 1 in ' + (1 / W.pTrigger(CHESTS)).toFixed(4) + '), disagreement ' +
        wTrig.toExponential(3));
    say('  sum over k of P(n,k) departs from 1 by at most ' + wSum.toExponential(3));
    // 1e-14 is two orders looser than the float path actually manages; it is a
    // guard against a wrong formula, not a measurement of float noise
    check(wCatch < 1e-14, 'engine pCatch disagrees with the exact form');
    check(wEgg   < 1e-14, 'engine pEggs disagrees with the exact form');
    check(wTrig  < 1e-14, 'engine pTrigger disagrees with C(80-m,20-m)/C(80,20)');
    check(wSum   < 1e-14, 'catch probabilities do not sum to 1');

    say('');
    say('violations: ' + fails);
    return { text: out.join('\n'), fails: fails };
  }

  // deep key-sorted stringify, so JSON written by Python and JSON packed by
  // packdata.py compare equal regardless of key order
  function canon(v) {
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if (v && typeof v === 'object') {
      return '{' + Object.keys(v).sort().map(function (k) {
        return JSON.stringify(k) + ':' + canon(v[k]);
      }).join(',') + '}';
    }
    return JSON.stringify(v);
  }

  function pct(v) { return (v * 100).toFixed(4) + '%'; }
  function sign(v) { return (v >= 0 ? '+' : '') + (v * 100).toFixed(4) + '%'; }
  function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }

  if (isNode && require.main === module) {
    // 30-GAME-SPEC section 7.4 asks for 10M and that is the default.  Pass a smaller
    // number while iterating -- the tolerance scales with it, so the check stays honest,
    // it just gets weaker.
    var draws = process.argv[2] ? parseInt(process.argv[2], 10) : 10000000;
    var res = run({ mcDraws: draws });
    console.log(res.text);
    process.exit(res.fails ? 1 : 0);
  }

  /* exactRtp and exactSd are exported for the casino console on the portfolio, which
     compares each cell's observed return with these -- the same numbers this harness
     checks the machine against, computed from the same resolveRound(). */
  return { run: run, exactRtp: exactRtp, exactSd: exactSd, K_EFF: K_EFF };
});
