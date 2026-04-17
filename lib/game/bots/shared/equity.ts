import { Hand } from 'pokersolver';
import { Card } from '../types';

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const SUITS = ['c', 'd', 'h', 's'];

function cardToString(card: Card): string {
  const suitChar = card.suit[0].toLowerCase();
  return card.rank + suitChar;
}

function buildFullDeck(): string[] {
  const deck: string[] = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      deck.push(rank + suit);
    }
  }
  return deck;
}

function shuffle(deck: string[]): void {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

export function estimateEquity(
  holeCards: [Card, Card],
  communityCards: Card[],
  numOpponents: number,
  iterations: number = 1000
): number {
  if (numOpponents <= 0) return 1;

  const knownCards = new Set<string>();
  const holeStrs = holeCards.map(cardToString);
  const communityStrs = communityCards.map(cardToString);

  for (const c of holeStrs) knownCards.add(c);
  for (const c of communityStrs) knownCards.add(c);

  const remainingDeck = buildFullDeck().filter(c => !knownCards.has(c));
  const boardNeeded = 5 - communityStrs.length;

  let wins = 0;

  for (let i = 0; i < iterations; i++) {
    shuffle(remainingDeck);

    let deckIdx = 0;
    const board = [...communityStrs];
    for (let b = 0; b < boardNeeded; b++) {
      board.push(remainingDeck[deckIdx++]);
    }

    const botHand = Hand.solve([...holeStrs, ...board]);

    const allHands: ReturnType<typeof Hand.solve>[] = [botHand];
    for (let o = 0; o < numOpponents; o++) {
      const oppHole = [remainingDeck[deckIdx++], remainingDeck[deckIdx++]];
      allHands.push(Hand.solve([...oppHole, ...board]));
    }

    const winners: ReturnType<typeof Hand.solve>[] = Hand.winners(allHands);
    if (winners.includes(botHand)) {
      wins++;
    }
  }

  return wins / iterations;
}
