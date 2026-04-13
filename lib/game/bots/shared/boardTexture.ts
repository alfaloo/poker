import type { Card } from '../types';

export type BoardTexture = 'dry' | 'semi-wet' | 'wet' | 'paired' | 'monotone';

const RANK_VALUES: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

export function analyseBoardTexture(cards: Card[]): BoardTexture {
  if (cards.length === 0) return 'dry';

  const suits = cards.map(c => c.suit);
  const ranks = cards.map(c => c.rank);

  // monotone: all same suit
  const uniqueSuits = new Set(suits);
  if (uniqueSuits.size === 1) return 'monotone';

  // paired: any rank repeated
  const uniqueRanks = new Set(ranks);
  if (uniqueRanks.size < ranks.length) return 'paired';

  // compute span
  const rankVals = ranks.map(r => RANK_VALUES[r] ?? 0);
  const span = Math.max(...rankVals) - Math.min(...rankVals);
  const numSuits = uniqueSuits.size;

  // wet: 2 suits AND span <= 4
  if (numSuits === 2 && span <= 4) return 'wet';

  // semi-wet: 2 suits OR span <= 4
  if (numSuits === 2 || span <= 4) return 'semi-wet';

  return 'dry';
}
