import { TableSnapshot, PersonalityProfile, BotDecision } from '../types';
import { chance, mkRaise, mkBet, isInPosition, openRaiseSize } from '../shared/utils';
import { getHandTier, OPEN_RAISE_THRESHOLD } from '../shared/handRanks';
import { estimateEquity } from '../shared/equity';
import { detectDraws } from '../shared/draws';
import { analyseBoardTexture } from '../shared/boardTexture';
import { potOddsRequired, spr } from '../shared/potOdds';

// ---------------------------------------------------------------------------
// Short-Stack Handling (Push/Fold)
// ---------------------------------------------------------------------------

function experiencedShortStackDecision(
  snapshot: TableSnapshot,
): BotDecision | null {
  const { botStack, bigBlind, holeCards, legalActions, toCall } = snapshot;
  if (botStack > bigBlind * 15) return null;

  const tier = getHandTier(holeCards[0], holeCards[1]);
  const canRaise = legalActions.includes('raise') || legalActions.includes('bet');
  const canCall = legalActions.includes('call');
  const canCheck = legalActions.includes('check');

  if (tier <= 2) {
    // Shove
    if (canRaise) return { action: 'raise', amount: snapshot.maxRaise };
    if (canCall) return { action: 'call' };
    return canCheck ? { action: 'check' } : { action: 'fold' };
  }
  if (tier <= 3) {
    // Check or call
    if (canCheck) return { action: 'check' };
    if (canCall) return { action: 'call' };
    return { action: 'fold' };
  }
  // Else fold
  return toCall > 0
    ? { action: 'fold' }
    : canCheck
      ? { action: 'check' }
      : { action: 'fold' };
}

// ---------------------------------------------------------------------------
// Preflop Strategy (Medium)
// ---------------------------------------------------------------------------

function preflopMedium(
  snapshot: TableSnapshot,
  personality: PersonalityProfile,
): BotDecision {
  const { holeCards, bigBlind, toCall, legalActions, position, numActivePlayers } = snapshot;
  const { vpipBonus, pfrMultiplier } = personality;

  const handTier = getHandTier(holeCards[0], holeCards[1]);
  const baseThreshold = OPEN_RAISE_THRESHOLD[position] ?? 3;
  const threshold = baseThreshold + Math.round(vpipBonus);

  const canRaise = legalActions.includes('raise') || legalActions.includes('bet');
  const canCall = legalActions.includes('call');
  const canCheck = legalActions.includes('check');
  const inPos = isInPosition(position);
  const isBB = position === 'BB';
  const isSB = position === 'SB';
  // A genuine raise is anything above 1 BB; SB completing (0.5 BB) is NOT a raise.
  const facingRaise = toCall > bigBlind;

  if (facingRaise) {
    // Facing a raise
    if (handTier === 1) {
      // 3-bet (3x toCall)
      if (canRaise) return mkRaise(3 * toCall, snapshot);
      if (canCall) return { action: 'call' };
      return { action: 'fold' };
    }
    if (handTier === 2) {
      // 3-bet (45% * pfrMultiplier) or call
      const threeBetProb = Math.min(1, 0.45 * pfrMultiplier);
      if (canRaise && chance(threeBetProb)) return mkRaise(3 * toCall, snapshot);
      if (canCall) return { action: 'call' };
      return { action: 'fold' };
    }
    if (handTier === 3 && inPos) {
      // Call (in position)
      if (canCall) return { action: 'call' };
      return canCheck ? { action: 'check' } : { action: 'fold' };
    }
    if (handTier <= 4 && isBB) {
      // BB exception: call
      if (canCall) return { action: 'call' };
      return canCheck ? { action: 'check' } : { action: 'fold' };
    }
    // Else fold
    return { action: 'fold' };
  } else {
    // No raise facing
    if (handTier <= threshold - 1) {
      // Raise (openRaiseSize)
      const raiseAmt = openRaiseSize(position, bigBlind, numActivePlayers);
      if (canRaise) return mkRaise(raiseAmt, snapshot);
      if (canCall) return { action: 'call' };
      return canCheck ? { action: 'check' } : { action: 'fold' };
    }
    if (handTier <= threshold + 1 && (inPos || isBB || isSB)) {
      // Call or complete from SB
      if (canCall) return { action: 'call' };
      return canCheck ? { action: 'check' } : { action: 'fold' };
    }
    // Speculative call with marginal hands (threshold+2) from any position at ~50%
    if (handTier <= threshold + 2 && chance(0.50)) {
      if (canCall) return { action: 'call' };
      return canCheck ? { action: 'check' } : { action: 'fold' };
    }
    // Widen further for BTN/CO/SB: call with any tier-6 hand a reasonable fraction
    if ((inPos || isSB) && handTier <= 6 && chance(0.45)) {
      if (canCall) return { action: 'call' };
    }
    return canCheck ? { action: 'check' } : { action: 'fold' };
  }
}

// ---------------------------------------------------------------------------
// Postflop Strategy (Medium)
// ---------------------------------------------------------------------------

function postflopMedium(
  snapshot: TableSnapshot,
  personality: PersonalityProfile,
): BotDecision {
  const {
    holeCards,
    communityCards,
    potSize,
    toCall,
    street,
    legalActions,
    numActivePlayers,
  } = snapshot;
  const { aggressionFactor, bluffMultiplier } = personality;

  const equity = estimateEquity(holeCards, communityCards, numActivePlayers - 1, 1000);
  const draws = detectDraws(holeCards, communityCards);
  const texture = analyseBoardTexture(communityCards);
  const potOddsReq = potOddsRequired(toCall, potSize);

  const isRiver = street === 'river';
  const canRaise = legalActions.includes('raise');
  const canBet = legalActions.includes('bet');
  const canCall = legalActions.includes('call');
  const canCheck = legalActions.includes('check');

  // Equity adjustment for draws (non-river only)
  let adjustedEquity = equity;
  if (!isRiver) {
    if (draws.outs >= 8) adjustedEquity += 0.06;
    else if (draws.outs >= 4) adjustedEquity += 0.03;
  }

  const facingBet = toCall > 0;

  // SPR < 1: pot-committed — shove with any reasonable equity to avoid leaving chips behind
  const sprVal = spr(snapshot.botStack, snapshot.potSize);
  if (sprVal < 1 && adjustedEquity > 0.45) {
    const canBetOrRaise = canRaise || canBet;
    if (canBetOrRaise) {
      const shoveAction = canRaise ? 'raise' : 'bet';
      return { action: shoveAction, amount: snapshot.maxRaise };
    }
    if (facingBet) return { action: 'call' };
  }

  if (facingBet) {
    // Fold if adjusted equity is below pot odds threshold
    if (adjustedEquity < potOddsReq - 0.05) {
      return { action: 'fold' };
    }
    // Raise if strong equity
    if (equity > 0.72) {
      const raiseProb = Math.min(1, 0.30 * aggressionFactor);
      if (canRaise && chance(raiseProb)) return mkRaise(toCall * 2.5, snapshot);
      if (canCall) return { action: 'call' };
      return { action: 'fold' };
    }
    // Semi-bluff raise with strong draw (non-river)
    if (draws.outs >= 8 && !isRiver) {
      const semiBluffProb = Math.min(1, 0.35 * bluffMultiplier);
      if (canRaise && chance(semiBluffProb)) return mkRaise(toCall * 2.5, snapshot);
    }
    // Else call
    if (canCall) return { action: 'call' };
    return { action: 'fold' };
  } else {
    // No bet facing
    // Value bet if equity > 0.68
    if (equity > 0.68) {
      if (canBet) {
        const betSize = texture === 'wet' ? 0.66 * potSize : 0.50 * potSize;
        return mkBet(betSize, snapshot);
      }
      return canCheck ? { action: 'check' } : { action: 'fold' };
    }
    // C-bet on dry board if equity > 0.52
    if (equity > 0.52 && texture === 'dry' && !isRiver) {
      if (canBet && chance(0.60)) return mkBet(0.45 * potSize, snapshot);
      return canCheck ? { action: 'check' } : { action: 'fold' };
    }
    // Semi-bluff with strong draw (non-river)
    if (draws.outs >= 8 && !isRiver) {
      const semiBluffProb = Math.min(1, 0.55 * bluffMultiplier);
      if (canBet && chance(semiBluffProb)) return mkBet(0.55 * potSize, snapshot);
    }
    // River bluff if equity < 0.20 and can't check
    if (isRiver && equity < 0.20 && !canCheck) {
      const bluffProb = Math.min(1, 0.20 * bluffMultiplier);
      if (canBet && chance(bluffProb)) return mkBet(0.60 * potSize, snapshot);
    }
    // Else check/fold
    return canCheck ? { action: 'check' } : { action: 'fold' };
  }
}

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

export function decideExperienced(
  snapshot: TableSnapshot,
  personality: PersonalityProfile,
): BotDecision {
  // 1. Short-stack push/fold
  const shortStack = experiencedShortStackDecision(snapshot);
  if (shortStack !== null) return shortStack;

  // 2. Street decision
  if (snapshot.street === 'preflop') {
    return preflopMedium(snapshot, personality);
  }
  return postflopMedium(snapshot, personality);
}
