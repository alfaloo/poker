import type { Tier, TableSnapshot, BotConfig, BotDecision } from './types';
import { tierFromBigBlind } from './types';
import { decideCasual } from './tiers/casual';
import { decideExperienced } from './tiers/experienced';
import { decideExpert } from './tiers/expert';
import { assignPersonalities } from './personalities';

export { tierFromBigBlind };

export function getBotDecision(snapshot: TableSnapshot, config: BotConfig): BotDecision {
  switch (config.tier) {
    case 'easy':
      return decideCasual(snapshot, config.personality);
    case 'medium':
      return decideExperienced(snapshot, config.personality);
    case 'hard':
      return decideExpert(snapshot, config);
  }
}

export function createBotConfigs(tier: Tier, numBots: number): BotConfig[] {
  const personalities = assignPersonalities(tier, numBots);
  return personalities.map((personality) => ({
    tier,
    personality,
    bluffTracker: { valueBets: 0, bluffs: 0 },
  }));
}
