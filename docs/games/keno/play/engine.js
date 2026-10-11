/* WYRMHOARD KENO -- engine
 *
 * Pure outcome logic.  No DOM, no timers, no presentation.  index.html and
 * verify.js both load this file, which is the point: the harness exercises the
 * same resolveRound() the machine pays from.  See docs/30-GAME-SPEC.md section 7.
 *
 * Every function that touches an outcome takes an `rng` argument -- a function
 * returning a uint32.  Nothing in this file calls Math.random, and nothing in
 * the game may either.  30-GAME-SPEC.md section 5 rule 1.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Wyrm = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ RNG */

  // The machine's source.  CSPRNG, buffered so we aren't calling into crypto
  // eighty times a round.
  function cryptoRng() {
    var c = (typeof self !== 'undefined' && self.crypto) ? self.crypto : null;
    if (!c && typeof require === 'function') c = require('crypto').webcrypto;
    if (!c) throw new Error('no CSPRNG available');
    var buf = new Uint32Array(1024), i = buf.length;
    return function () {
      if (i >= buf.length) { c.getRandomValues(buf); i = 0; }
      return buf[i++];
    };
  }

  // Harness only.  Reproducible runs need a seed; the machine never uses this.
  function seededRng(seed) {
    var s = (seed >>> 0) || 0x9e3779b9;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5;  s >>>= 0;
      return s;
    };
  }

  // Uniform 0..n-1.  Rejection sampled -- `rng() % n` is biased and this is a
  // gambling machine.
  function randInt(rng, n) {
    var limit = 4294967296 - (4294967296 % n), r;
    do { r = rng(); } while (r >= limit);
    return r % n;
  }

  // Partial Fisher-Yates.  Uniform over k-subsets, no replacement.
  function sampleFrom(rng, pool, k) {
    var a = pool.slice(), out = new Array(k), i, j, t;
    for (i = 0; i < k; i++) {
      j = i + randInt(rng, a.length - i);
      t = a[i]; a[i] = a[j]; a[j] = t;
      out[i] = a[i];
    }
    return out;
  }

  var ALL80 = (function () { var a = []; for (var i = 1; i <= 80; i++) a.push(i); return a; })();

  /* -------------------------------------------------------------- outcomes */

  // Three eggs on distinct numbers the player did NOT pick.  Called in ARMED,
  // before the draw.  30-GAME-SPEC.md section 3.
  function placeEggs(rng, picks, count) {
    var set = {}, i, pool = [];
    for (i = 0; i < picks.length; i++) set[picks[i]] = true;
    for (i = 1; i <= 80; i++) if (!set[i]) pool.push(i);
    return sampleFrom(rng, pool, count || 3);
  }

  /* Both symbol sets at once, on SIX distinct unpicked numbers -- eggs and chests
     can never share a square.  Drawn in one sample so the six are jointly uniform
     over the unpicked pool; placing them in two calls and rejecting collisions
     would give the same distribution but is easy to get subtly wrong.
     docs/21-TWO-FEATURE-PRICING.md. */
  function placeSymbols(rng, picks, nEggs, nChests, nX) {
    var set = {}, i, pool = [];
    nX = nX || 0;
    for (i = 0; i < picks.length; i++) set[picks[i]] = true;
    for (i = 1; i <= 80; i++) if (!set[i]) pool.push(i);
    var all = sampleFrom(rng, pool, nEggs + nChests + nX);
    return { eggs: all.slice(0, nEggs),
             chests: all.slice(nEggs, nEggs + nChests),
             xs: all.slice(nEggs + nChests) };
  }

  // 20 of 80, uniform, over ALL eighty.  Independent of the eggs and the picks.
  function drawTwenty(rng) { return sampleFrom(rng, ALL80, 20); }

  // Committed at BONUS_INTRO, in one call, before any reveal.  Returns an array
  // of booleans, true = Cindermaw's eye.  Nothing is ever decided at click time
  // -- if it were, the zero-EV agency argument in 20-BONUS-SPEC.md section 4
  // would be false and so would the certified return.
  function bonusLayout(rng, piles, eyes) {
    var a = new Array(piles), i, j, t;
    for (i = 0; i < piles; i++) a[i] = (i < eyes);
    for (i = piles - 1; i > 0; i--) {
      j = randInt(rng, i + 1);
      t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // Depth reached given a committed layout and the order the player touched.
  // Used by the harness; the UI accumulates it a reveal at a time instead.
  function depthFor(layout, order) {
    for (var i = 0; i < order.length; i++) if (layout[order[i]]) return i;
    return layout.length - countEyes(layout);
  }
  function countEyes(layout) {
    var n = 0; for (var i = 0; i < layout.length; i++) if (layout[i]) n++;
    return n;
  }

  /* ------------------------------------------------------------ resolution */

  function capFor(denom) { return Math.round(800 / Number(denom)); }

  function payFor(data, denom, tier, spots, hits) {
    var row = data.paytables[denom].tiers[String(tier)].pays[String(spots)];
    var v = row[String(hits)];
    return v === undefined ? 0 : v;   // absent key means zero
  }

  /* The chest ladder is per game type, not one table for the machine.
     The egg multiplier multiplies the base PAYTABLE, so its cost differs across the
     252 cells; the ladder is fitted per cell to absorb that and leave every cell's
     total exactly where it was. docs/21-TWO-FEATURE-PRICING.md section 2. */
  function ladderFor(data, denom, tier, spots) {
    return data.bonus.cells[denom][String(tier)][String(spots)].awards;
  }

  /* ---------------------------------------------------- the bonus
   *
   * Every trigger opens a PICK. Four eggs and five chests sit on numbers the player did
   * not mark, and an exact count on either opens a screen of covered symbols:
   *
   *   3 of 4 eggs     1 in    23.1   open 1 of 3 eggs    ->   5 /  8 / 12 free games
   *   4 of 4 eggs     1 in   326.4   open 1 of 3 eggs    ->  10 / 15 / 20 free games
   *   4 of 5 chests   1 in    82.7   open 1 of 4 chests  ->  10 / 20 / 30 / 40 free games
   *   5 of 5 chests   1 in 1,550.6   THE HOARD BONUS     ->  10x/15x/25x/40x, cash
   *
   * Counts are matched EXACTLY, so four chests pays free games and five opens the Hoard
   * Bonus instead. An egg award and a chest award can both fire in one round.
   *
   * There is no rung count baked in anywhere: this reads data.bonus.structure.awards,
   * and so do the harness, the UI and the help screen. docs/28-THE-PICKS.md.
   */
  function awardsFor(st, eggsOut, chestsOut) {
    var out = [], a = st.awards || [], i;
    for (i = 0; i < a.length; i++)
      if ((a[i].sym === 'egg' ? eggsOut : chestsOut) === a[i].count) out.push(i);
    return out;
  }

  /* THE STACK. Inside a free game the eggs and chests stop being triggers and become
     MULTIPLIERS, and a third symbol -- the X -- exists in free games and nowhere else.
     The two multiply together:

         3 of 4 eggs x3    3 of 5 chests x5
         4 of 4 eggs x6    4 of 5 chests x12
                           5 of 5 chests x30    top of the range x180

     Highest threshold met wins per symbol. It multiplies the CATCH WIN PLUS THE X's
     COIN and nothing else -- not the Hoard Bonus, which is cash in its own right.
     THE X IS A COIN, not a rung: each X drawn is worth st.x_coin bets, added to the
     base win before the stack multiplies (v0.26.0-alpha; it was a flat x2 before, and
     x2 of nothing was nothing 84% of the time). free_mult.x is still honoured if a
     data file ever carries one, so an old blob prices the way it was built.
     Read from the structure so the generator, the harness and the machine cannot
     disagree about a rung. docs/30-THE-STACK.md. */
  function stepUp(table, count) {
    var best = 1, k;
    for (k in table) if (count >= +k && table[k] > best) best = table[k];
    return best;
  }
  /* THE RETRIGGER RUNG (v0.27.0-alpha). In a free game, eggs out ADD games to the run:
     structure.free_retrigger, e.g. {egg:{3:1, 4:2}}. Highest threshold met, like the stack.
     Flat and spot-independent; priced in bonus8.py as K_TRIG/(1-g). Free games from the
     PICKS still do not fire in a free game (retrigger flag), only this rung does. */
  function bestAt(table, count) {
    var best = 0, k;
    for (k in table) if (count >= +k && table[k] > best) best = table[k];
    return best;
  }
  function retrigFor(st, eggsOut, chestsOut) {
    var rt = st.free_retrigger;
    if (!rt) return 0;
    return bestAt(rt.egg || {}, eggsOut) + bestAt(rt.chest || {}, chestsOut);
  }

  function stackFor(st, eggsOut, chestsOut, xOut) {
    var fm = st.free_mult;
    if (!fm) return 1;
    return stepUp(fm.egg || {}, eggsOut) *
           stepUp(fm.chest || {}, chestsOut) *
           stepUp(fm.x || {}, xOut);
  }

  /* The amounts are shuffled ONCE, at the trigger, before the player is shown a single
     covered symbol. Every tile is equally likely to hold every amount, so the choice is
     agency without edge and a pick costs its MEAN, not its smallest. Nothing is decided
     at click time; if it were, the certified return would be false. */
  function freeGameLayout(rng, counts) {
    var a = counts.slice(), i, j, t;
    for (i = a.length - 1; i > 0; i--) {
      j = randInt(rng, i + 1); t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function countDrawn(list, drawnSet) {
    var n = 0;
    for (var i = 0; i < list.length; i++) if (drawnSet[list[i]]) n++;
    return n;
  }

  /* The one function that decides what a round pays.
   *
   *   base    -- paytable lookup on catch count
   *   coins   -- the X's coins, and ONLY inside a free game. 0 in a paid round.
   *   retrig  -- free games ADDED to the run by the eggs, ONLY inside a free game.
   *   mult    -- the stack, and ONLY inside a free game. 1 in a paid round.
   *   cash    -- the Hoard Bonus amount, 0 unless it fired. The CALLER supplies it,
   *              because it was committed at the trigger and the player merely
   *              uncovers it.
   *   award   -- min((base + coins) * mult + cash, cap).  MANDATORY, and the LAST thing that
   *              happens. The multiplier goes INSIDE the clip, which is most of why
   *              the top of the stack is affordable at all: a x360 on a good catch is
   *              worth the cap and no more, so the feature costs far less than the top
   *              of its own range suggests.
   *
   * `cfg.chosen` is parallel to the fired award list: one amount per pick the round
   * opened. Free-game amounts are summed into freeGames, cash amounts into cash.
   *
   * A FREE GAME IS NOT A DIFFERENT GAME. There is no branch on cfg.free below it -- a
   * free game is this same round played without taking a bet, which is why it can open
   * the Hoard Bonus and why its value is exactly the round value. Free games do not
   * award free games; playSequence enforces that, and so must any other caller.
   */
  function resolveRound(data, cfg) {
    var denom = cfg.denom, cap = capFor(denom);
    var drawnSet = cfg.drawnSet || toSet(cfg.drawn);
    var st = data.bonus.structure;
    var hits = 0, i;
    for (i = 0; i < cfg.picks.length; i++) if (drawnSet[cfg.picks[i]]) hits++;

    var base = payFor(data, denom, cfg.tier, cfg.spots, hits);
    var eggs = cfg.eggs || [], chests = cfg.chests || [], xs = cfg.xs || [];
    var eggsOut = countDrawn(eggs, drawnSet);
    var chestsOut = countDrawn(chests, drawnSet);
    var xOut = countDrawn(xs, drawnSet);

    var fired = awardsFor(st, eggsOut, chestsOut);
    var chosen = cfg.chosen || [];
    var freeGames = 0, cash = 0;
    for (i = 0; i < fired.length; i++) {
      var aw = st.awards[fired[i]], v = chosen[i] || 0;
      if (aw.kind === 'cash') cash += v; else freeGames += v;
    }

    /* The stack is DERIVED from what came out, never passed in -- the caller cannot
       hand the resolver a multiplier the draw did not produce. cfg.free is what says
       whether the X was on the board at all. */
    var mult = cfg.free ? stackFor(st, eggsOut, chestsOut, xOut) : 1;
    var coins = cfg.free ? xOut * (st.x_coin || 0) : 0;
    var retrig = cfg.free ? retrigFor(st, eggsOut, chestsOut) : 0;   // games ADDED to the run
    var raw = (base + coins) * mult + cash;
    var award = raw > cap ? cap : raw;

    return { hits: hits, base: base, coins: coins, retrig: retrig, free: !!cfg.free, mult: mult,
             eggsOut: eggsOut, chestsOut: chestsOut, xOut: xOut,
             fired: fired, chosen: chosen.slice(0, fired.length),
             freeGames: freeGames, cash: cash,
             eggFired: awardsFor(st, eggsOut, -1).length > 0,
             chestFired: awardsFor(st, -1, chestsOut).length > 0,
             raw: raw, award: award, clipped: raw > cap, cap: cap };
  }

  function toSet(list) {
    var s = {}, i; for (i = 0; i < list.length; i++) s[list[i]] = true; return s;
  }

  /* One complete round, outcome only.  The UI calls the pieces separately so it
   * can animate between them; the harness calls this. */
  function playRound(data, rng, denom, tier, spots, picks, free) {
    var st = data.bonus.structure, i;
    // the X is dealt in free games and nowhere else
    var sym = placeSymbols(rng, picks, st.eggs, st.chests,
                           free ? (st.x_symbols || 0) : 0);
    var drawn = drawTwenty(rng);
    var drawnSet = toSet(drawn);
    /* Every layout is dealt HERE, before the resolver and long before the player touches
       a tile, for the same reason the draw is: nothing about an outcome may depend on
       when or what somebody clicked. */
    var fired = awardsFor(st, countDrawn(sym.eggs, drawnSet),
                              countDrawn(sym.chests, drawnSet));
    var layouts = [], chosen = [];
    for (i = 0; i < fired.length; i++) {
      var lay = freeGameLayout(rng, st.awards[fired[i]].values);
      layouts.push(lay); chosen.push(lay[0]);
    }
    var r = resolveRound(data, {
      denom: denom, tier: tier, spots: spots, picks: picks,
      drawn: drawn, drawnSet: drawnSet, eggs: sym.eggs, chests: sym.chests, xs: sym.xs,
      chosen: chosen, free: !!free
    });
    r.drawn = drawn; r.eggs = sym.eggs; r.chests = sym.chests; r.xs = sym.xs;
    r.layouts = layouts;
    return r;
  }

  /* One PAID round and every free game it buys, which is the unit the return is
     measured in -- a paid round on its own is only part of what a bet purchases.

     RETRIGGER IS OFF (st.retrigger). A free game is still a full round -- same ticket,
     and it can open the Hoard Bonus -- but it does not award more free games. That is a
     pricing decision: letting free games buy free games multiplies the feature cost by
     1/(1-k), and at k = 0.709 that is a factor of 3.4 with no base game left at all.
     docs/28-THE-PICKS.md. */
  function playSequence(data, rng, denom, tier, spots, picks) {
    var st = data.bonus.structure, guard = st.free_game_cap || 500;
    var r = playRound(data, rng, denom, tier, spots, picks, false);
    var pending = r.freeGames, played = 0, freeAward = 0, rounds = [], cashHits = 0;
    if (r.cash > 0) cashHits++;
    while (pending > 0 && played < guard) {
      pending--; played++;
      var f = playRound(data, rng, denom, tier, spots, picks, true);
      freeAward += f.award; rounds.push(f);
      if (st.retrigger) pending += f.freeGames;
      pending += f.retrig;                     // the rung: flat games, no pick
      if (f.cash > 0) cashHits++;
    }
    r.freePlayed = played; r.freeAward = freeAward; r.freeRounds = rounds;
    r.cashHits = cashHits;
    r.total = r.award + freeAward;
    return r;
  }

  function shuffledIndices(rng, n) {
    var a = new Array(n), i, j, t;
    for (i = 0; i < n; i++) a[i] = i;
    for (i = n - 1; i > 0; i--) { j = randInt(rng, i + 1); t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  /* ------------------------------------------------------------- utilities */

  function money(mult, denom) { return mult * Number(denom); }
  function fmt(amount) {
    return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /* --------------------------------------------------- exact catch odds
   *
   * Computed, never transcribed.  docs/10-MATH-REFERENCE.md section 1 for the
   * values, docs/11-KENO-MATH-PRIMER.md for why it is written this way.
   *
   * The same probability has two spellings:
   *
   *   player's view   P(n,k) = C(n,k) · C(80-n, 20-k) / C(80,20)
   *   draw's view     P(n,k) = C(20,k) · C(60, n-k)   / C(80,n)
   *
   * They are algebraically identical -- both count the same subsets, one from
   * the ticket's side and one from the draw's -- and they were checked cell for
   * cell across every (n,k) the game can reach.  Only the second one fits in a
   * double.  C(80,20) = 3,535,316,142,212,174,320 is well past 2^53, and a
   * JavaScript Number holds it 320 short, so the first form needs BigInt and a
   * scaled division to be trustworthy.  The largest quantity the second form
   * ever builds is C(80,10) = 1,646,492,110,120, which is exact, so it runs in
   * plain floats: about one unit in the last place of error, and roughly sixty
   * times faster than the BigInt path this replaces.
   *
   * `comb` stays BigInt and stays exported -- verify.js and drive.js want exact
   * integers for the bonus depth distribution, where the numbers are small but
   * the equality has to be exact. */
  var combCache = {};
  function comb(n, k) {
    if (k < 0 || k > n) return 0n;
    var key = n + ',' + k;
    if (combCache[key]) return combCache[key];
    var r = 1n, N = BigInt(n);
    for (var i = 0; i < k; i++) r = r * (N - BigInt(i)) / BigInt(i + 1);
    combCache[key] = r;
    return r;
  }

  // float64 combinations.  Divide as you go so the running value never
  // overshoots the exact-integer range on the way to a number that is inside it.
  function combF(n, k) {
    if (k < 0 || k > n) return 0;
    if (k > n - k) k = n - k;
    var r = 1;
    for (var i = 0; i < k; i++) r = r * (n - i) / (i + 1);
    return r;
  }

  function pCatch(n, k) {
    if (k < 0 || k > n || k > 20 || n > 80) return 0;
    return combF(20, k) * combF(60, n - k) / combF(80, n);
  }
  function oneIn(n, k) { var p = pCatch(n, k); return p > 0 ? 1 / p : Infinity; }

  /* P(all m eggs drawn | the player caught k of n).  The eggs sit on the
     80-n numbers the player did not pick, and 20-k of those came out.  m defaults to
     three for the old callers; the free-games build places four. */
  function pEggs(n, k, m) {
    m = m || 3;
    if (20 - k < m) return 0;
    return combF(20 - k, m) / combF(80 - n, m);
  }

  function falling(x, m) {
    var r = 1;
    for (var i = 0; i < m; i++) r *= (x - i);
    return r;
  }

  /* P(exactly j of the eggs AND exactly ci of the chests are drawn | caught k of n).
   *
   * Six specific unpicked numbers; of the 80-n unpicked, 20-k came out. The chance that
   * a *named* set of m of the six is the drawn part is a ratio of falling factorials:
   *
   *     [dr]_m · [un-dr]_(6-m) / [un]_6
   *
   * then multiplied by the C(3,j)·C(3,ci) ways of choosing which. Written this way every
   * intermediate stays under 80·79·78·77·76·75 = 2.1e11 and is exact in a double. The
   * textbook form C(3,j)C(3,ci)C(un-6,dr-j-ci)/C(un,dr) is the same number but builds
   * C(76,20) ≈ 1.6e19 on the way, which is 1,800x past 2^53 -- the same trap
   * docs/11-KENO-MATH-PRIMER.md section 3 covers for P(n,k).
   */
  function pSym(n, k, j, ci, nEggs, nChests) {
    var un = 80 - n, dr = 20 - k, m = j + ci, tot = nEggs + nChests;
    if (dr < 0 || m < 0 || m > dr || tot - m > un - dr || un < tot) return 0;
    if (j > nEggs || ci > nChests) return 0;
    return combF(nEggs, j) * combF(nChests, ci) *
           falling(dr, m) * falling(un - dr, tot - m) / falling(un, tot);
  }

  /* P(m specified numbers are all among the 20 drawn) = [20]_m / [80]_m.
     The math reference writes it C(80-m, 20-m)/C(80,20); this is the same value with
     numbers small enough to check on paper, and it makes the spot-count independence
     obvious -- n does not appear.  m = 3 is 1 in 72.07, m = 4 is 1 in 326.42. */
  function pTrigger(m) { m = m || 3; return combF(20, m) / combF(80, m); }

  // Spot-count names.  Cosmetic.  docs/40-THEME-BIBLE.md section 3.
  var SPOT_NAMES = { 4: 'Sellsword', 5: 'Delver', 6: 'Reaver', 7: 'Wyrmbane',
                     8: 'Hoardbreaker', 9: 'Dragonsbane', 10: 'The Ledger' };

  return {
    cryptoRng: cryptoRng, seededRng: seededRng, randInt: randInt,
    sampleFrom: sampleFrom, shuffledIndices: shuffledIndices,
    placeEggs: placeEggs, placeSymbols: placeSymbols,
    drawTwenty: drawTwenty, bonusLayout: bonusLayout,
    depthFor: depthFor, countEyes: countEyes, countDrawn: countDrawn,
    awardsFor: awardsFor, freeGameLayout: freeGameLayout, stackFor: stackFor,
    capFor: capFor, payFor: payFor, ladderFor: ladderFor,
    resolveRound: resolveRound, playRound: playRound, playSequence: playSequence, retrigFor: retrigFor,
    toSet: toSet, money: money, fmt: fmt, SPOT_NAMES: SPOT_NAMES, ALL80: ALL80,
    comb: comb, combF: combF, pCatch: pCatch, oneIn: oneIn,
    pEggs: pEggs, pTrigger: pTrigger, pSym: pSym, falling: falling
  };
});
