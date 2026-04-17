import type { Tier, PersonalityProfile } from './types';
import { secureRandom } from './shared/utils';

export const CASUAL_PERSONALITIES: PersonalityProfile[] = [
  {
    name: 'Lucky Larry',
    vpipBonus: 2,
    pfrMultiplier: 0.7,
    bluffMultiplier: 1.5,
    betSizeMultiplier: 1.2,
    aggressionFactor: 0.6,
  },
  {
    name: 'Cautious Carl',
    vpipBonus: -1,
    pfrMultiplier: 0.5,
    bluffMultiplier: 0.3,
    betSizeMultiplier: 0.7,
    aggressionFactor: 0.4,
  },
  {
    name: 'Reckless Rita',
    vpipBonus: 3,
    pfrMultiplier: 1.4,
    bluffMultiplier: 2.0,
    betSizeMultiplier: 1.5,
    aggressionFactor: 1.3,
  },
];

export const EXPERIENCED_PERSONALITIES: PersonalityProfile[] = [
  {
    name: 'The Calling Station',
    vpipBonus: 2,
    pfrMultiplier: 0.5,
    bluffMultiplier: 0.2,
    betSizeMultiplier: 0.7,
    aggressionFactor: 0.6,
  },
  {
    name: 'The Nit',
    vpipBonus: -2,
    pfrMultiplier: 0.8,
    bluffMultiplier: 0.3,
    betSizeMultiplier: 1.1,
    aggressionFactor: 0.7,
  },
  {
    name: 'The Shark Wannabe',
    vpipBonus: 0,
    pfrMultiplier: 1.3,
    bluffMultiplier: 1.2,
    betSizeMultiplier: 1.0,
    aggressionFactor: 1.4,
  },
  {
    name: 'Reckless Aggro',
    vpipBonus: 2,
    pfrMultiplier: 1.6,
    bluffMultiplier: 1.8,
    betSizeMultiplier: 1.3,
    aggressionFactor: 1.6,
  },
];

export const EXPERT_PERSONALITIES: PersonalityProfile[] = [
  {
    name: 'The GTO Robot',
    vpipBonus: 0,
    pfrMultiplier: 1.0,
    bluffMultiplier: 1.0,
    betSizeMultiplier: 1.0,
    aggressionFactor: 1.0,
  },
  {
    name: 'The Value Farmer',
    vpipBonus: -1,
    pfrMultiplier: 0.9,
    bluffMultiplier: 0.4,
    betSizeMultiplier: 1.1,
    aggressionFactor: 1.2,
  },
  {
    name: 'The Bluff Artist',
    vpipBonus: 1,
    pfrMultiplier: 1.2,
    bluffMultiplier: 1.8,
    betSizeMultiplier: 1.2,
    aggressionFactor: 1.5,
  },
  {
    name: 'The Sniper',
    vpipBonus: 0,
    pfrMultiplier: 1.1,
    bluffMultiplier: 1.0,
    betSizeMultiplier: 1.0,
    aggressionFactor: 1.1,
  },
];

export const PERSONALITY_POOLS: Record<Tier, PersonalityProfile[]> = {
  easy: CASUAL_PERSONALITIES,
  medium: EXPERIENCED_PERSONALITIES,
  hard: EXPERT_PERSONALITIES,
};

export function assignPersonalities(tier: Tier, numBots: number): PersonalityProfile[] {
  const pool = PERSONALITY_POOLS[tier];

  // Fisher-Yates shuffle a copy of the pool
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(secureRandom() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Cycle through shuffled pool if numBots > pool length
  const result: PersonalityProfile[] = [];
  for (let i = 0; i < numBots; i++) {
    result.push(shuffled[i % shuffled.length]);
  }
  return result;
}
