import { tuning } from './tuning.js';

export const TIER_NAMES = ['weak', 'solid', 'big', 'massive'];

// A static body (a wall) counts as infinite mass, so the reduced mass is the moving body's.
export function reducedMass(mA, mB) {
  if (mA === 0) return mB;
  if (mB === 0) return mA;
  return (mA * mB) / (mA + mB);
}

export function impactEnergy(mA, mB, closingSpeed) {
  return 0.5 * reducedMass(mA, mB) * closingSpeed * closingSpeed;
}

export function tierOf(energy, toughness = 1) {
  const e = energy / toughness;
  if (e >= tuning.T3) return 3;
  if (e >= tuning.T2) return 2;
  if (e >= tuning.T1) return 1;
  return 0;
}
