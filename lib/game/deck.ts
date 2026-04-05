export interface Card {
  rank: string;
  suit: string;
}

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'];

export function buildAndShuffleDeck(): Card[] {
  const deck: Card[] = RANKS.flatMap(rank => SUITS.map(suit => ({ rank, suit })));

  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

export function cardToSolverString(card: Card): string {
  return card.rank + card.suit[0];
}
