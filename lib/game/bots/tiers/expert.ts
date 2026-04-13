import {
  TableSnapshot,
  BotConfig,
  BotDecision,
  BluffTracker,
  Card,
  Position,
} from '../types';
import { chance, mkRaise, mkBet, isInPosition, openRaiseSize, clampBet } from '../shared/utils';
import { getHandTier, OPEN_RAISE_THRESHOLD, HandTier } from '../shared/handRanks';
import { estimateEquity } from '../shared/equity';
import { detectDraws } from '../shared/draws';
import { analyseBoardTexture, BoardTexture } from '../shared/boardTexture';
import { potOddsRequired, spr } from '../shared/potOdds';

// ---------------------------------------------------------------------------
// GTO Bluff Tracking
// ---------------------------------------------------------------------------

const GTO_TARGET_RATIO = 2.0;

function shouldBluff(
  tracker: BluffTracker,
  street: string,
  equity: number,
  outs: number,
  personality: { bluffMultiplier: number },
): boolean {
  const targetRatio = GTO_TARGET_RATIO / personality.bluffMultiplier;
  const currentRatio = tracker.bluffs > 0
    ? tracker.valueBets / tracker.bluffs
    : Infinity;

  // Suppress bluffs when already over-bluffing
  if (currentRatio < targetRatio * 0.7) return false;

  // Semi-bluffs with strong draws: always profitable
  if (outs >= 8 && street !== 'river') return true;

  // Pure river bluff: only when GTO ratio permits AND no showdown value
  if (street === 'river' && equity < 0.22 && currentRatio >= targetRatio) return true;

  return false;
}

function trackDecision(tracker: BluffTracker, isBluff: boolean): void {
  if (isBluff) tracker.bluffs++;
  else tracker.valueBets++;
}

// ---------------------------------------------------------------------------
// Blocker Detection
// ---------------------------------------------------------------------------

function hasSimpleBlocker(holeCards: [Card, Card], communityCards: Card[]): boolean {
  const suits = communityCards.map(c => c.suit);
  // Monotone board: hold the Ace of that suit → block opponent's nut flush
  const flushSuit = suits.find(s => suits.filter(x => x === s).length >= 3);
  if (flushSuit && holeCards.some(c => c.suit === flushSuit && c.rank === 'A')) return true;

  // Ace-high board: hold an Ace → block top pair / set combos
  if (communityCards.some(c => c.rank === 'A') && holeCards.some(c => c.rank === 'A')) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Dynamic Bet Sizing
// ---------------------------------------------------------------------------

function calculateBetSize(
  snapshot: TableSnapshot,
  equity: number,
  texture: BoardTexture,
  isBluff: boolean,
  personality: { betSizeMultiplier: number },
): number {
  const pot = snapshot.potSize;
  let fraction: number;

  if (isBluff) {
    fraction = texture === 'dry' ? 0.40 : 0.65;
  } else {
    if (equity > 0.85) fraction = 0.80;
    else if (equity > 0.70) fraction = 0.65;
    else if (equity > 0.55) fraction = 0.40;
    else return 0;
  }

  // Board texture modifier
  if (texture === 'wet') fraction *= 1.15;
  if (texture === 'dry') fraction *= 0.90;

  // SPR guard: avoid committing ~50% of remaining chips without a strong hand
  const s = spr(snapshot.botStack, pot);
  if (s < 3) fraction = Math.min(fraction, 0.50);

  return clampBet(
    pot * fraction * personality.betSizeMultiplier,
    snapshot.minRaise,
    snapshot.maxRaise,
    snapshot.bigBlind,
  );
}

// ---------------------------------------------------------------------------
// Short-Stack Handling (Push/Fold)
// ---------------------------------------------------------------------------

function expertShortStackDecision(snapshot: TableSnapshot): BotDecision | null {
  const { botStack, bigBlind } = snapshot;
  if (botStack > bigBlind * 15) return null;

  const tier = getHandTier(snapshot.holeCards[0], snapshot.holeCards[1]);
  const canRaise = snapshot.legalActions.includes('raise') ||
                   snapshot.legalActions.includes('bet');

  const pushThreshold: Record<Position, HandTier> = {
    BTN: 4, SB: 3, BB: 4, CO: 3, MP: 2, EP: 2, UTG: 2,
  };
  const threshold = pushThreshold[snapshot.position] ?? 2;

  if (tier <= threshold && canRaise) {
    return { action: 'raise', amount: snapshot.maxRaise };
  }
  if (snapshot.toCall > 0 && tier <= 3) return { action: 'call' };
  return snapshot.legalActions.includes('check') ? { action: 'check' } : { action: 'fold' };
}

// ---------------------------------------------------------------------------
// Preflop Strategy (Hard)
// ---------------------------------------------------------------------------

function preflopHard(
  snapshot: TableSnapshot,
  personality: { vpipBonus: number; pfrMultiplier: number },
): BotDecision {
  const tier = getHandTier(snapshot.holeCards[0], snapshot.holeCards[1]);
  const baseThreshold = OPEN_RAISE_THRESHOLD[snapshot.position] ?? 3;
  const threshold = Math.min(
    baseThreshold + 1,
    baseThreshold + Math.round(personality.vpipBonus),
  ) as HandTier;

  const facingRaise = snapshot.toCall > snapshot.bigBlind;
  const facing3Bet  = snapshot.toCall > snapshot.bigBlind * 6;

  if (facing3Bet) {
    if (tier === 1) return mkRaise(snapshot.toCall * 3, snapshot);
    if (tier === 2 && chance(0.25)) return mkRaise(snapshot.toCall * 2.8, snapshot);
    if (tier <= 2) return { action: 'call' };
    return { action: 'fold' };
  }

  if (facingRaise) {
    if (tier === 1) return mkRaise(snapshot.toCall * 3, snapshot);
    if (tier === 2) {
      return chance(0.55 * personality.pfrMultiplier)
        ? mkRaise(snapshot.toCall * 3, snapshot)
        : { action: 'call' };
    }
    if (tier === 3 && isInPosition(snapshot.position)) return { action: 'call' };
    if (tier <= 4 && snapshot.position === 'BB') return { action: 'call' };
    return { action: 'fold' };
  }

  // Voluntary open
  if (tier <= threshold) {
    const size = openRaiseSize(snapshot.position, snapshot.bigBlind, snapshot.numActivePlayers);
    return mkRaise(size, snapshot);
  }
  // BTN steal: exploit positional advantage with marginal hands
  if (snapshot.position === 'BTN' && tier === threshold + 1 && chance(0.60)) {
    return mkRaise(2.2 * snapshot.bigBlind, snapshot);
  }

  return snapshot.legalActions.includes('check') ? { action: 'check' } : { action: 'fold' };
}

// ---------------------------------------------------------------------------
// Postflop Strategy (Hard)
// ---------------------------------------------------------------------------

function postflopHard(
  snapshot: TableSnapshot,
  config: BotConfig,
): BotDecision {
  const { personality, bluffTracker } = config;

  const equity = estimateEquity(
    snapshot.holeCards,
    snapshot.communityCards,
    snapshot.numActivePlayers - 1,
    2000,
  );
  const { outs } = detectDraws(snapshot.holeCards, snapshot.communityCards);
  const texture = analyseBoardTexture(snapshot.communityCards);
  const potOddsReq = potOddsRequired(snapshot.toCall, snapshot.potSize);

  let adjustedEquity = equity;
  if (snapshot.street !== 'river') {
    if (outs >= 8) adjustedEquity += 0.05;
    else if (outs >= 4) adjustedEquity += 0.025;
  }

  const canCheck  = snapshot.legalActions.includes('check');
  const facingBet = snapshot.toCall > 0;

  // SPR < 1: pot-committed — shove with any reasonable equity to avoid leaving chips behind
  const sprVal = spr(snapshot.botStack, snapshot.potSize);
  if (sprVal < 1 && adjustedEquity > 0.45) {
    const canBetOrRaise = snapshot.legalActions.includes('raise') || snapshot.legalActions.includes('bet');
    if (canBetOrRaise) {
      const shoveAction = snapshot.legalActions.includes('raise') ? 'raise' : 'bet';
      return { action: shoveAction, amount: snapshot.maxRaise };
    }
    if (facingBet) return { action: 'call' };
  }

  if (facingBet) {
    // Strict pot-odds threshold (no loose margin)
    if (adjustedEquity < potOddsReq) return { action: 'fold' };

    // Very strong hands: raise for value
    if (adjustedEquity > 0.75 && chance(0.40 * personality.aggressionFactor)) {
      const betSize = calculateBetSize(snapshot, adjustedEquity, texture, false, personality);
      trackDecision(bluffTracker, false);
      return mkRaise(betSize, snapshot);
    }

    // Semi-bluff raise with strong draws
    if (outs >= 8 && snapshot.street !== 'river') {
      if (shouldBluff(bluffTracker, snapshot.street, adjustedEquity, outs, personality)) {
        trackDecision(bluffTracker, true);
        return mkRaise(snapshot.potSize * 0.66, snapshot);
      }
    }

    return { action: 'call' };
  }

  // No bet facing — decide whether to bet or check
  if (adjustedEquity > 0.65) {
    const betSize = calculateBetSize(snapshot, adjustedEquity, texture, false, personality);
    if (betSize > 0) {
      trackDecision(bluffTracker, false);
      return mkBet(betSize, snapshot);
    }
  }

  // GTO-balanced bluff decision
  const hasBlocker = hasSimpleBlocker(snapshot.holeCards, snapshot.communityCards);
  const bluffCandidate = shouldBluff(
    bluffTracker, snapshot.street, adjustedEquity, outs, personality,
  );

  if (bluffCandidate || (hasBlocker && adjustedEquity < 0.30 && snapshot.street === 'river')) {
    const bluffSize = calculateBetSize(snapshot, adjustedEquity, texture, true, personality);
    if (bluffSize > 0) {
      trackDecision(bluffTracker, true);
      return mkBet(bluffSize, snapshot);
    }
  }

  return canCheck ? { action: 'check' } : { action: 'fold' };
}

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

export function decideExpert(
  snapshot: TableSnapshot,
  config: BotConfig,
): BotDecision {
  // 1. Short-stack push/fold
  const shortStack = expertShortStackDecision(snapshot);
  if (shortStack !== null) return shortStack;

  // 2. Street decision
  if (snapshot.street === 'preflop') {
    return preflopHard(snapshot, config.personality);
  }
  return postflopHard(snapshot, config);
}
