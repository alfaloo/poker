import type { BotDecision, Position, TableSnapshot } from '../types';

export function secureRandom(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 0x100000000;
}

export function randomBetween(min: number, max: number): number {
  return min + secureRandom() * (max - min);
}

export function chance(p: number): boolean {
  const clamped = Math.max(0, Math.min(1, p));
  return secureRandom() < clamped;
}

export function randomDelay(range: [number, number]): number {
  return randomBetween(range[0], range[1]);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function clampBet(amount: number, min: number, max: number, bb: number): number {
  const rounded = bb > 0 ? Math.round(amount / bb) * bb : amount;
  return Math.max(min, Math.min(max, rounded));
}

export function mkRaise(size: number, snapshot: TableSnapshot): BotDecision {
  const amount = clampBet(size, snapshot.minRaise, snapshot.maxRaise, snapshot.bigBlind);
  return { action: 'raise', amount };
}

export function mkBet(size: number, snapshot: TableSnapshot): BotDecision {
  const amount = clampBet(size, snapshot.minRaise, snapshot.maxRaise, snapshot.bigBlind);
  return { action: 'bet', amount };
}

export function isInPosition(position: Position): boolean {
  return position === 'CO' || position === 'BTN';
}

export function isEarlyPosition(position: Position): boolean {
  return position === 'UTG' || position === 'EP';
}

export function openRaiseSize(position: Position, bigBlind: number, activePlayers: number): number {
  const multipliers: Record<Position, number> = {
    UTG: 3.0,
    EP: 3.0,
    MP: 2.8,
    CO: 2.5,
    BTN: 2.2,
    SB: 3.0,
    BB: 2.5,
  };
  const base = multipliers[position] * bigBlind;
  const bonus = activePlayers > 6 ? bigBlind : 0;
  return base + bonus;
}
