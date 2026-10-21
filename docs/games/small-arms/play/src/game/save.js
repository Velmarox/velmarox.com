// The save: settings, records, what lasts between runs (meta), and a run in progress (kept
// between rounds). One JSON value in localStorage plus a backup copy. A save that can't be
// read is never overwritten: the backup is tried, and failing that the game starts fresh
// without writing.

import { WEAPONS } from '../content/weapons.js';
import { ABILITIES, POWERS } from '../content/cards.js';
import { freshMeta } from './meta.js';

const KEY = 'loaded-save';
const BACKUP = 'loaded-save-backup';
export const SAVE_VERSION = 2;

export function freshSave() {
  return {
    version: SAVE_VERSION,
    settings: { shake: true, volume: 0.7, numbers: true },
    records: { bestWave: 0, runs: 0, kills: 0, bestEarned: 0 },
    meta: freshMeta(),
    run: null,
  };
}

// One step per old version. Version 1 had the shop; its run can't carry over, but the
// settings and records do.
const MIGRATIONS = {
  1: (save) => ({ ...freshSave(), settings: save.settings ?? {}, records: save.records ?? {} }),
};

function check(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('not a save');
  let save = raw;
  while (save.version < SAVE_VERSION && MIGRATIONS[save.version]) save = MIGRATIONS[save.version](save);
  if (save.version !== SAVE_VERSION) throw new Error(`unknown version ${raw.version}`);
  const base = freshSave();
  const out = {
    ...base, ...save,
    settings: { ...base.settings, ...save.settings },
    records: { ...base.records, ...save.records },
    meta: { ...base.meta, ...save.meta },
  };
  if (out.run) {
    const r = out.run;
    if (!Array.isArray(r.weapons) || !r.weapons.length || r.weapons.some((w) => !WEAPONS[w.id])) throw new Error('bad weapons');
    if (r.abilities.some((a) => !ABILITIES[a]) || r.powers.some((p) => !POWERS[p])) throw new Error('bad cards');
    if (!(r.wave >= 1) || !(r.hp > 0)) throw new Error('bad run');
  }
  return out;
}

export function loadSave(storage) {
  const main = storage.getItem(KEY);
  if (main === null) return { save: freshSave(), status: 'new' };
  try {
    return { save: check(JSON.parse(main)), status: 'ok' };
  } catch (error) {
    const backup = storage.getItem(BACKUP);
    if (backup !== null) {
      try { return { save: check(JSON.parse(backup)), status: 'restored' }; } catch { /* fall through */ }
    }
    return { save: freshSave(), status: 'broken', problem: error.message };
  }
}

export function writeSave(storage, save) {
  const text = JSON.stringify(save);
  const old = storage.getItem(KEY);
  if (old !== null) storage.setItem(BACKUP, old);
  storage.setItem(KEY, text);
}

// A run has ended: fold it into the records. XP and tokens were banked round by round.
export function bankRun(save, run) {
  const r = save.records;
  r.runs++;
  r.kills += run.stats.kills;
  // run.wave is the round he was on when he went down, so the last one cleared is one less.
  r.bestWave = Math.max(r.bestWave, run.wave - 1);
  r.bestEarned = Math.max(r.bestEarned, run.stats.earned);
  save.run = null;
}
