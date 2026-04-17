export function potOddsRequired(toCall: number, potSize: number): number {
  if (toCall <= 0) return 0;
  return toCall / (potSize + toCall);
}

export function spr(stack: number, pot: number): number {
  if (pot <= 0) return Infinity;
  return stack / pot;
}

export function mdf(potSize: number, betSize: number): number {
  return potSize / (potSize + betSize);
}

export function isShortStacked(stack: number, bigBlind: number): boolean {
  return stack <= bigBlind * 15;
}
