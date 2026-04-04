import { Hand } from 'pokersolver';

export function evaluateHands(
  hands: { seat: number; cards: string[] }[]
): { winners: number[]; handNames: Record<number, string> } {
  const solvedHands = hands.map(({ cards }) => Hand.solve(cards));

  const handNames: Record<number, string> = {};
  hands.forEach(({ seat }, i) => {
    handNames[seat] = solvedHands[i].name;
  });

  const winningHands = Hand.winners(solvedHands);
  const winners = hands
    .filter((_, i) => winningHands.includes(solvedHands[i]))
    .map(({ seat }) => seat);

  return { winners, handNames };
}

export function evaluatePot(
  eligibleSeats: number[],
  holeCardsBySeat: Record<number, string[]>,
  communityCards: string[]
): { winners: number[]; handNames: Record<number, string> } {
  const hands = eligibleSeats.map(seat => ({
    seat,
    cards: [...holeCardsBySeat[seat], ...communityCards],
  }));

  return evaluateHands(hands);
}
