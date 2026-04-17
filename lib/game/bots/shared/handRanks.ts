import type { Card } from '../types';

export type HandTier = 1 | 2 | 3 | 4 | 5 | 6;

// Hand tier table keyed by canonical hand notation (e.g. "AKs", "AKo", "AA")
// Pairs use just the rank twice (e.g. "AA"), suited hands end in 's', offsuit in 'o'
export const HAND_TIER_TABLE: Record<string, HandTier> = {
  // Tier 1
  'AA': 1, 'KK': 1, 'QQ': 1, 'JJ': 1, 'AKs': 1, 'AKo': 1,

  // Tier 2
  'TT': 2, '99': 2, 'AQs': 2, 'AQo': 2, 'AJs': 2, 'KQs': 2, 'ATs': 2, 'KJs': 2,

  // Tier 3
  '88': 3, '77': 3, 'AJo': 3, 'KQo': 3, 'QJs': 3, 'JTs': 3, 'A9s': 3, 'KTs': 3, 'QTs': 3, 'T9s': 3,

  // Tier 4
  '66': 4, '55': 4, 'ATo': 4, 'KJo': 4, 'QJo': 4, 'JTo': 4,
  'A8s': 4, 'A7s': 4, 'K9s': 4, 'Q9s': 4, '98s': 4, '87s': 4, '76s': 4, '65s': 4,

  // Tier 5
  '44': 5, '33': 5, '22': 5,
  'A6s': 5, 'A5s': 5, 'A4s': 5, 'A3s': 5, 'A2s': 5,
  'K8s': 5, 'Q8s': 5, 'J8s': 5, 'T8s': 5,
  '97s': 5, '86s': 5, '75s': 5, '54s': 5,
};

const RANK_ORDER = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

function rankValue(rank: string): number {
  return RANK_ORDER.indexOf(rank);
}

/**
 * Returns the HandTier for a given two-card starting hand.
 * Normalizes cards so the higher rank comes first.
 */
export function getHandTier(card1: Card, card2: Card): HandTier {
  const r1 = card1.rank;
  const r2 = card2.rank;

  // Pair
  if (r1 === r2) {
    const key = r1 + r2;
    return (HAND_TIER_TABLE[key] as HandTier | undefined) ?? 6;
  }

  // Put higher rank first
  const [high, low] = rankValue(r1) >= rankValue(r2) ? [r1, r2] : [r2, r1];
  const suited = card1.suit === card2.suit;
  const key = high + low + (suited ? 's' : 'o');

  return (HAND_TIER_TABLE[key] as HandTier | undefined) ?? 6;
}

export const OPEN_RAISE_THRESHOLD: Record<string, HandTier> = {
  UTG: 2,
  EP: 2,
  MP: 3,
  CO: 4,
  BTN: 5,
  SB: 3,
  BB: 4,
};
