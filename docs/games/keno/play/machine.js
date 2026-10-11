/* Operator settings.  Not player-facing, not part of the outcome path.
   Loaded by <script src> for the same reason data.js is -- see docs/50-PROTOTYPE.md. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WyrmMachine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  return {
    tier: 6,                                                   // 1..6, sets the return
    denominations: ['0.05','0.10','0.25','0.50','1.00','2.00'],
    startCredits: 4000,                                        // integer cents
    maxAward: 800                                              // dollars, per game round
  };
});
