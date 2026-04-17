import { Card } from '../types';

export interface DrawInfo {
  flushDraw: boolean;
  oesd: boolean;
  gutshot: boolean;
  outs: number;
}

const RANK_VALUES: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

export function detectDraws(holeCards: [Card, Card], communityCards: Card[]): DrawInfo {
  const allCards = [...holeCards, ...communityCards];

  // Flush draw: 4 cards of the same suit
  const suitCounts: Record<string, number> = {};
  for (const card of allCards) {
    const suit = card.suit[0].toLowerCase();
    suitCounts[suit] = (suitCounts[suit] ?? 0) + 1;
  }
  const flushDraw = Object.values(suitCounts).some(count => count === 4);

  // Straight draw
  const rankValues = allCards.map(c => RANK_VALUES[c.rank] ?? 0).filter(v => v > 0);
  const uniqueValues = Array.from(new Set(rankValues)).sort((a, b) => a - b);

  // Add A as 1 for wheel if 14 (A) is present
  if (uniqueValues.includes(14)) {
    uniqueValues.unshift(1);
  }

  let oesd = false;
  let gutshot = false;

  // Scan 4-card windows: look at every combination of 4 values
  // span == 3 means OESD (4 consecutive values, e.g. 5,6,7,8)
  // span == 4 means gutshot (4 values spanning 5 positions with one gap)
  for (let i = 0; i < uniqueValues.length; i++) {
    for (let j = i + 1; j < uniqueValues.length; j++) {
      for (let k = j + 1; k < uniqueValues.length; k++) {
        for (let l = k + 1; l < uniqueValues.length; l++) {
          const span = uniqueValues[l] - uniqueValues[i];
          if (span === 3) {
            oesd = true;
          } else if (span === 4) {
            gutshot = true;
          }
        }
      }
    }
  }

  const outs = (flushDraw ? 9 : 0) + (oesd ? 8 : 0) + (!oesd && gutshot ? 4 : 0);

  return { flushDraw, oesd, gutshot, outs };
}
