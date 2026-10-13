// One streak: a chain of contracts from Threat 1 until the player cashes out or busts.
// Plain data in, plain data out. No DOM, so the headless runner plays whole streaks.

import { makeRng } from '../sim/rng.js';
import { generateBoard, rewardOffers } from './contractGen.js';
import { GEAR_SLOTS, INJURIES, MAX_INJURIES } from '../content/gear.js';

export const BUST_KEEPS = 0.5;
export const REP_PER = 100;

const boardSeed = (streak, n = 0) => (streak.seed + streak.played * 7919 + n * 104729) >>> 0;

function dealBoard(streak, unlocks, n = 0) {
  streak.board = generateBoard({ threat: streak.threat, unlocks, held: streak.gear, seed: boardSeed(streak, n) });
}

export function newStreak(seed, unlocks) {
  const streak = {
    seed: seed >>> 0, threat: 1, score: 0, won: 0, played: 0,
    gear: [], injuries: [], rerollUsed: false,
    board: [], fight: null, pending: null, over: null,
  };
  dealBoard(streak, unlocks);
  return streak;
}

// One free redraw of the board per streak.
export function reroll(streak, unlocks) {
  if (streak.rerollUsed || streak.pending || streak.over) return false;
  streak.rerollUsed = true;
  dealBoard(streak, unlocks, 1);
  return true;
}

export function startFight(streak, index) {
  streak.fight = index;
  return streak.board[index];
}

// result: 'won', 'lost', or 'bailed'. Sets streak.pending to the choice the player now owes,
// or streak.over if that was the third injury.
export function finishFight(streak, result, unlocks) {
  const contract = streak.board[streak.fight];
  const rng = makeRng(boardSeed(streak, 2));
  streak.fight = null;
  streak.played += 1;
  streak.threat += 1;
  if (result === 'won') {
    streak.score += contract.score;
    streak.won += 1;
    streak.pending = {
      type: 'reward', earned: contract.score,
      offers: rewardOffers({ contract, unlocks, held: streak.gear, seed: rng.seed() }),
    };
  } else if (result === 'lost') {
    if (streak.injuries.length + 1 >= MAX_INJURIES) {
      // The third injury ends the streak. He keeps half.
      streak.over = { bust: true, banked: Math.floor(streak.score * BUST_KEEPS) };
      return;
    }
    const open = Object.keys(INJURIES).filter((id) => !streak.injuries.includes(id));
    streak.pending = { type: 'injury', options: rng.shuffle(open).slice(0, 2) };
  } else {
    dealBoard(streak, unlocks);
  }
}

// offer: one of pending.offers. drop: the gear id to give up when all slots are full.
export function takeReward(streak, offer, drop, unlocks) {
  if (streak.pending?.type !== 'reward') return false;
  if (offer.gear) {
    if (streak.gear.length >= GEAR_SLOTS) {
      if (!streak.gear.includes(drop)) return false;
      streak.gear.splice(streak.gear.indexOf(drop), 1);
    }
    streak.gear.push(offer.gear);
  } else {
    streak.score += offer.bonus;
  }
  streak.pending = null;
  dealBoard(streak, unlocks);
  return true;
}

export function takeInjury(streak, id, unlocks) {
  if (streak.pending?.type !== 'injury' || !streak.pending.options.includes(id)) return false;
  streak.injuries.push(id);
  streak.pending = null;
  dealBoard(streak, unlocks);
  return true;
}

export function cashOut(streak) {
  if (streak.pending || streak.over) return false;
  streak.over = { bust: false, banked: streak.score };
  return true;
}

// The save is written before a fight starts. If the game is closed mid-fight, the next
// load finds the fight still open and counts it as a bail, so quitting can't dodge an injury.
export function closeOpenFight(streak, unlocks) {
  if (streak.fight === null || streak.over) return false;
  finishFight(streak, 'bailed', unlocks);
  return true;
}

export const repFor = (banked) => Math.floor(banked / REP_PER);
