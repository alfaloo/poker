export interface TierConfig {
  label: string;
  smallBlind: number;
  bigBlind: number;
  buyIn: number;
  minBalance: number;
}

export const TIERS: TierConfig[] = [
  {
    label: 'Beginner',
    smallBlind: 1,
    bigBlind: 2,
    buyIn: 200,
    minBalance: 200,
  },
  {
    label: 'Specialist',
    smallBlind: 5,
    bigBlind: 10,
    buyIn: 1000,
    minBalance: 1000,
  },
  {
    label: 'Master',
    smallBlind: 25,
    bigBlind: 50,
    buyIn: 5000,
    minBalance: 5000,
  },
];
