// The save: one plain object, kept as text. `storage` is anything with getItem and
// setItem (the browser's localStorage, or a stand-in during tests).

import { UNLOCKS, TIER_COST, tierOpen, titleFor } from '../content/unlocks.js';
import { repFor, closeOpenFight } from './streak.js';

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'contract-zero-save';
export const BACKUP_KEY = 'contract-zero-save-backup';

export function freshSave() {
  return {
    version: SAVE_VERSION,
    rep: 0, repLifetime: 0, unlocks: [], tutorialDone: false,
    records: { bestScore: 0, bestThreat: 0, streaks: 0, history: [] },
    settings: { reducedMotion: false, takeYourTime: false, shake: true },
    streak: null,
  };
}

// One small function per version step, run in order. None yet: version 1 is the first.
const MIGRATIONS = {};

function migrate(data) {
  let save = data;
  while (save.version < SAVE_VERSION) {
    const step = MIGRATIONS[save.version];
    if (!step) throw new Error(`no migration from version ${save.version}`);
    save = step(save);
  }
  return save;
}

// Returns what is wrong with a save, or null if it is usable.
export function problemWith(save) {
  if (!save || typeof save !== 'object') return 'not a save';
  if (!Number.isInteger(save.version) || save.version < 1) return 'no version';
  if (save.version > SAVE_VERSION) return 'made by a newer version of the game';
  const num = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
  if (!num(save.rep) || !num(save.repLifetime)) return 'bad Rep';
  if (!Array.isArray(save.unlocks) || save.unlocks.some((id) => !UNLOCKS.some((u) => u.id === id))) return 'bad unlocks';
  if (!save.records || !num(save.records.bestScore) || !num(save.records.bestThreat) || !Array.isArray(save.records.history)) return 'bad records';
  if (!save.settings || typeof save.settings !== 'object') return 'bad settings';
  const s = save.streak;
  if (s !== null) {
    if (typeof s !== 'object' || !num(s.threat) || !num(s.score) || !Array.isArray(s.gear) || !Array.isArray(s.injuries) || !Array.isArray(s.board)) return 'bad streak';
  }
  return null;
}

function parse(text) {
  if (typeof text !== 'string' || !text) return { problem: 'empty' };
  let data;
  try { data = JSON.parse(text); } catch { return { problem: 'not readable' }; }
  const early = problemWith(data);
  if (early && early !== null && !(data && data.version < SAVE_VERSION)) return { problem: early };
  try { data = migrate(data); } catch (e) { return { problem: e.message }; }
  const problem = problemWith(data);
  if (problem) return { problem };
  // Fill in anything added since this save was written.
  const base = freshSave();
  return { save: { ...base, ...data, records: { ...base.records, ...data.records }, settings: { ...base.settings, ...data.settings } } };
}

// status: 'ok', 'fresh' (nothing saved yet), 'restored' (main save was bad, backup used),
// or 'broken' (both bad: a fresh save is returned but nothing is overwritten until the
// player chooses to start again).
export function loadSave(storage) {
  const main = storage.getItem(SAVE_KEY);
  if (main === null || main === undefined) return { save: freshSave(), status: 'fresh' };
  const first = parse(main);
  let result = first.save ? { save: first.save, status: 'ok' } : null;
  if (!result) {
    const second = parse(storage.getItem(BACKUP_KEY));
    result = second.save ? { save: second.save, status: 'restored', problem: first.problem } : { save: freshSave(), status: 'broken', problem: first.problem };
  }
  // A fight left open by closing the game counts as a bail.
  if (result.save.streak && closeOpenFight(result.save.streak, result.save.unlocks)) result.closedFight = true;
  return result;
}

// The last good save is kept as a backup before each write.
export function writeSave(storage, save) {
  const text = JSON.stringify(save);
  const current = storage.getItem(SAVE_KEY);
  if (current && parse(current).save) storage.setItem(BACKUP_KEY, current);
  storage.setItem(SAVE_KEY, text);
}

export const exportSave = (save) => JSON.stringify(save);

export function importSave(text) {
  const result = parse(String(text).trim());
  return result.save ? { save: result.save } : { problem: result.problem };
}

// Closes a finished streak into the permanent record. Returns what to show on the summary.
export function bankStreak(save, streak) {
  const banked = streak.over.banked;
  const rep = repFor(banked);
  const before = titleFor(save.repLifetime);
  const reached = Math.max(1, streak.threat - 1);
  const newBest = banked > save.records.bestScore;
  save.rep += rep;
  save.repLifetime += rep;
  save.records.bestScore = Math.max(save.records.bestScore, banked);
  save.records.bestThreat = Math.max(save.records.bestThreat, reached);
  save.records.streaks += 1;
  save.records.history.unshift({ banked, threat: reached, won: streak.won, bust: streak.over.bust, gear: [...streak.gear] });
  save.records.history.length = Math.min(save.records.history.length, 10);
  save.streak = null;
  const after = titleFor(save.repLifetime);
  return { banked, rep, newBest, bust: streak.over.bust, won: streak.won, reached, title: after, promoted: after !== before };
}

export function canBuy(save, id) {
  const unlock = UNLOCKS.find((u) => u.id === id);
  if (!unlock || save.unlocks.includes(id)) return false;
  return tierOpen(unlock.tier, save.unlocks) && save.rep >= TIER_COST[unlock.tier];
}

export function buyUnlock(save, id) {
  if (!canBuy(save, id)) return false;
  save.rep -= TIER_COST[UNLOCKS.find((u) => u.id === id).tier];
  save.unlocks.push(id);
  return true;
}
