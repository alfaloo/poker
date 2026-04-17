export type Tier = 'easy' | 'medium' | 'hard';

export type Street = 'preflop' | 'flop' | 'turn' | 'river';

export type Position = 'UTG' | 'EP' | 'MP' | 'CO' | 'BTN' | 'SB' | 'BB';

export type BotAction = 'fold' | 'check' | 'call' | 'bet' | 'raise';

export interface Card {
  rank: string;
  suit: string;
}

export interface TableSnapshot {
  holeCards: [Card, Card];
  communityCards: Card[];
  street: Street;
  potSize: number;
  toCall: number;
  minRaise: number;
  maxRaise: number;
  botStack: number;
  bigBlind: number;
  position: Position;
  numActivePlayers: number;
  legalActions: BotAction[];
}

export interface BotDecision {
  action: BotAction;
  amount?: number;
}

export interface PersonalityProfile {
  name: string;
  vpipBonus: number;
  pfrMultiplier: number;
  bluffMultiplier: number;
  betSizeMultiplier: number;
  aggressionFactor: number;
}

export interface BluffTracker {
  valueBets: number;
  bluffs: number;
}

export interface BotConfig {
  tier: Tier;
  personality: PersonalityProfile;
  bluffTracker: BluffTracker;
}

export function tierFromBigBlind(bigBlind: number): Tier {
  if (bigBlind <= 2) return 'easy';
  if (bigBlind <= 10) return 'medium';
  return 'hard';
}
