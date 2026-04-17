import { Hand } from 'pokersolver';
import { TableSnapshot, PersonalityProfile, BotDecision, Card } from '../types';
import { chance, mkRaise, mkBet } from '../shared/utils';
import { detectDraws } from '../shared/draws';
import { spr } from '../shared/potOdds';

// ---------------------------------------------------------------------------
// Chen Formula
// ---------------------------------------------------------------------------

function chenScore(card1: Card, card2: Card): number {
  const val = (r: string): number => {
    if (r === 'A') return 10;
    if (r === 'K') return 8;
    if (r === 'Q') return 7;
    if (r === 'J') return 6;
    if (r === 'T') return 5;
    return parseInt(r) / 2;
  };

  const hi = Math.max(val(card1.rank), val(card2.rank));
  const RANK_LIST = '23456789TJQKA';

  // Determine high/low by rank string comparison in the rank list
  const idx1 = RANK_LIST.indexOf(card1.rank);
  const idx2 = RANK_LIST.indexOf(card2.rank);
  const hiRank = idx1 >= idx2 ? card1.rank : card2.rank;
  const loRank = idx1 < idx2 ? card1.rank : card2.rank;
  const hiIdx = RANK_LIST.indexOf(hiRank);
  const loIdx = RANK_LIST.indexOf(loRank);
  const gap = hiIdx - loIdx - 1; // 0 = connected (AK), 1 = one-gapper, etc.

  let score = hi;
  if (card1.rank === card2.rank) {
    score = Math.max(score * 2, 5); // pairs: double value, min 5
  } else {
    if (card1.suit === card2.suit) score += 2; // suited bonus
    if (gap === 1) score -= 1;
    else if (gap === 2) score -= 2;
    else if (gap === 3) score -= 4;
    else if (gap >= 4) score -= 5;
    if (gap <= 1 && hi < 5) score += 1; // low connector bonus
  }

  return Math.round(score);
}

// ---------------------------------------------------------------------------
// Short-Stack Handling (Push/Fold)
// ---------------------------------------------------------------------------

function casualShortStackDecision(snapshot: TableSnapshot): BotDecision | null {
  const { botStack, bigBlind, holeCards, legalActions, toCall } = snapshot;
  if (botStack > bigBlind * 15) return null;

  const score = chenScore(holeCards[0], holeCards[1]);
  const canRaise = legalActions.includes('raise') || legalActions.includes('bet');

  if (score >= 7) {
    if (canRaise) return { action: 'raise', amount: snapshot.maxRaise };
    if (toCall <= botStack) return { action: 'call' };
  }
  if (score >= 5 && toCall === 0) return { action: 'check' };
  if (toCall > 0 && score < 5) return { action: 'fold' };
  return legalActions.includes('check') ? { action: 'check' } : { action: 'fold' };
}

// ---------------------------------------------------------------------------
// Preflop Strategy
// ---------------------------------------------------------------------------

function preflopCasual(
  snapshot: TableSnapshot,
  personality: PersonalityProfile,
): BotDecision {
  const { holeCards, bigBlind, toCall, legalActions } = snapshot;
  const V = personality.vpipBonus;

  const score = chenScore(holeCards[0], holeCards[1]);
  const canRaise = legalActions.includes('raise') || legalActions.includes('bet');
  const canCall = legalActions.includes('call');
  const canCheck = legalActions.includes('check');

  // 6% random impulse raise regardless of score
  if (canRaise && chance(0.06)) {
    return mkRaise(3 * bigBlind, snapshot);
  }

  // A "real raise" means someone opened above 1 BB (e.g. 3x open).
  // SB completing for 0.5 BB or anyone calling the big blind is a "limp",
  // not a raise — treat it with looser thresholds than a genuine raise.
  const facingRaise = toCall > bigBlind;
  const facingLimp = toCall > 0 && toCall <= bigBlind;

  if (facingRaise) {
    // Facing a raise
    if (score >= 10 - V) {
      // 3-bet 40% or call 60%
      if (canRaise && chance(0.40)) return mkRaise(3 * toCall, snapshot);
      if (canCall) return { action: 'call' };
      return { action: 'fold' };
    }
    if (score >= 7 - V) {
      // Call
      if (canCall) return { action: 'call' };
      return canCheck ? { action: 'check' } : { action: 'fold' };
    }
    if (score >= 5 - V) {
      // Fold 60% or call 40%
      if (chance(0.60) || !canCall) return { action: 'fold' };
      return { action: 'call' };
    }
    // < (5-V): fold
    return { action: 'fold' };
  } else if (facingLimp) {
    // Completing from SB or calling the BB from any other position.
    // Treat like a cheap speculative call — much looser than a real raise.
    if (score >= 7 - V) {
      // Occasionally squeeze; otherwise call
      if (canRaise && chance(0.15)) return mkRaise(3 * bigBlind, snapshot);
      if (canCall) return { action: 'call' };
      return canCheck ? { action: 'check' } : { action: 'fold' };
    }
    if (score >= 4 - V) {
      if (canCall) return { action: 'call' };
      return canCheck ? { action: 'check' } : { action: 'fold' };
    }
    if (score >= 1 - V) {
      // Marginal hand: call 75% of the time
      if (chance(0.75) && canCall) return { action: 'call' };
      return canCheck ? { action: 'check' } : { action: 'fold' };
    }
    // Weak hand: still complete/call ~45% — it's cheap
    if (chance(0.45) && canCall) return { action: 'call' };
    return canCheck ? { action: 'check' } : { action: 'fold' };
  } else {
    // No raise facing (toCall === 0, e.g. BB acting last with no raise)
    if (score >= 10 - V) {
      // Raise 3xBB
      if (canRaise) return mkRaise(3 * bigBlind, snapshot);
      return canCheck ? { action: 'check' } : { action: 'call' };
    }
    if (score >= 7 - V) {
      // Raise 40% or call 60%
      if (canRaise && chance(0.40)) return mkRaise(3 * bigBlind, snapshot);
      if (canCall) return { action: 'call' };
      return canCheck ? { action: 'check' } : { action: 'fold' };
    }
    if (score >= 5 - V) {
      // Call
      if (canCall) return { action: 'call' };
      return canCheck ? { action: 'check' } : { action: 'fold' };
    }
    if (score >= 3 - V) {
      // Call 50% or fold 50%
      if (chance(0.50) && canCall) return { action: 'call' };
      return canCheck ? { action: 'check' } : { action: 'fold' };
    }
    // < (3-V): fold 75% call 25%
    if (chance(0.25) && canCall) return { action: 'call' };
    return canCheck ? { action: 'check' } : { action: 'fold' };
  }
}

// ---------------------------------------------------------------------------
// Hand Bucket Classification
// ---------------------------------------------------------------------------

type HandBucket = 'monster' | 'strong' | 'medium' | 'weak' | 'air';

function classifyHandBucket(
  holeCards: [Card, Card],
  communityCards: Card[],
): HandBucket {
  if (communityCards.length === 0) return 'air';

  const allStrs = [...holeCards, ...communityCards].map(c => c.rank + c.suit[0]);
  const hand = Hand.solve(allStrs);

  if (['Straight Flush', 'Royal Flush', 'Four of a Kind'].includes(hand.name)) return 'monster';
  if (['Full House', 'Flush', 'Straight'].includes(hand.name)) return 'strong';
  if (['Three of a Kind', 'Two Pair'].includes(hand.name)) return 'medium';
  if (hand.name === 'One Pair') return 'weak';
  return 'air';
}

const BUCKET_ORDER: HandBucket[] = ['air', 'weak', 'medium', 'strong', 'monster'];

function upgradeBucket(bucket: HandBucket): HandBucket {
  const idx = BUCKET_ORDER.indexOf(bucket);
  return BUCKET_ORDER[Math.min(idx + 1, BUCKET_ORDER.length - 1)];
}

// ---------------------------------------------------------------------------
// Postflop Strategy
// ---------------------------------------------------------------------------

function postflopCasual(
  snapshot: TableSnapshot,
  personality: PersonalityProfile,
): BotDecision {
  const { holeCards, communityCards, potSize, toCall, street, legalActions, botStack } = snapshot;
  const { aggressionFactor, bluffMultiplier } = personality;

  // Classify hand bucket and potentially upgrade for draws
  let bucket = classifyHandBucket(holeCards, communityCards);
  const draws = detectDraws(holeCards, communityCards);
  if (draws.flushDraw || draws.oesd) {
    bucket = upgradeBucket(bucket);
  }

  const sprVal = spr(botStack, potSize);
  const canRaise = legalActions.includes('raise');
  const canBet = legalActions.includes('bet');
  const canCall = legalActions.includes('call');
  const canCheck = legalActions.includes('check');
  const isRiver = street === 'river';

  // All-in: shove with monster/strong when SPR < 2
  if ((bucket === 'monster' || bucket === 'strong') && sprVal < 2) {
    if (canRaise) return { action: 'raise', amount: snapshot.maxRaise };
    if (canBet) return { action: 'bet', amount: snapshot.maxRaise };
    if (canCall) return { action: 'call' };
  }

  // 5% random all-in river bluff
  if (isRiver && chance(0.05)) {
    if (canRaise) return { action: 'raise', amount: snapshot.maxRaise };
    if (canBet) return { action: 'bet', amount: snapshot.maxRaise };
  }

  const facingBet = toCall > 0;

  // Helper: random bet sizing for value bets [25%, 50%, 75%] of pot
  const valueBetSize = (): number => {
    const pcts = [0.25, 0.5, 0.75];
    return potSize * pcts[Math.floor(Math.random() * pcts.length)];
  };

  // Helper: raise facing bet (2.2x or 2.8x)
  const raiseFacingBet = (): number => {
    return toCall * (Math.random() < 0.5 ? 2.2 : 2.8);
  };

  // Helper: river bluff sizing (50-100% of pot)
  const riverBluffSize = (): number => {
    return potSize * (0.5 + Math.random() * 0.5);
  };

  if (facingBet) {
    switch (bucket) {
      case 'monster': {
        // Raise 2.5x (base 80% × aggressionFactor), call remainder
        const raiseProb = Math.min(1, 0.80 * aggressionFactor);
        if (canRaise && chance(raiseProb)) return mkRaise(raiseFacingBet(), snapshot);
        if (canCall) return { action: 'call' };
        return { action: 'fold' };
      }
      case 'strong': {
        // Call (60%), raise (base 25% × aggressionFactor), fold remainder
        const raiseProb = Math.min(1, 0.25 * aggressionFactor);
        if (canRaise && chance(raiseProb)) return mkRaise(raiseFacingBet(), snapshot);
        if (canCall && chance(0.60)) return { action: 'call' };
        if (canCall) return { action: 'call' };
        return { action: 'fold' };
      }
      case 'medium': {
        // Call (base 45%), fold remainder
        if (canCall && chance(0.45)) return { action: 'call' };
        return { action: 'fold' };
      }
      case 'weak': {
        // Fold (70%), call (30%)
        if (canCall && chance(0.30)) return { action: 'call' };
        return { action: 'fold' };
      }
      case 'air': {
        // Fold (base 88%), bluff-raise (base 12% × bluffMultiplier)
        const bluffRaiseProb = Math.min(1, 0.12 * bluffMultiplier);
        if (canRaise && chance(bluffRaiseProb)) return mkRaise(raiseFacingBet(), snapshot);
        return { action: 'fold' };
      }
    }
  } else {
    // No bet facing
    switch (bucket) {
      case 'monster': {
        // Bet 75% pot; slow-play check (base 20% × aggressionFactor)
        const slowPlayProb = Math.min(1, 0.20 * aggressionFactor);
        if (canCheck && chance(slowPlayProb)) return { action: 'check' };
        if (canBet) return mkBet(0.75 * potSize, snapshot);
        return canCheck ? { action: 'check' } : { action: 'fold' };
      }
      case 'strong': {
        // Bet 50% pot (base 75% × aggressionFactor), check remainder
        const betProb = Math.min(1, 0.75 * aggressionFactor);
        if (canBet && chance(betProb)) return mkBet(valueBetSize(), snapshot);
        return canCheck ? { action: 'check' } : { action: 'fold' };
      }
      case 'medium': {
        // Check (base 55%), bet 33% pot (base 45% × aggressionFactor)
        const betProb = Math.min(1, 0.45 * aggressionFactor);
        if (canBet && chance(betProb)) return mkBet(0.33 * potSize, snapshot);
        return canCheck ? { action: 'check' } : { action: 'fold' };
      }
      case 'weak': {
        // Check (base 80%), bet 20% pot (base 20% × aggressionFactor)
        const betProb = Math.min(1, 0.20 * aggressionFactor);
        if (canBet && chance(betProb)) return mkBet(0.20 * potSize, snapshot);
        return canCheck ? { action: 'check' } : { action: 'fold' };
      }
      case 'air': {
        // Check (base 80%), bluff 33% pot (base 20% × bluffMultiplier)
        const bluffProb = Math.min(1, 0.20 * bluffMultiplier);
        if (canBet && chance(bluffProb)) {
          const size = isRiver ? riverBluffSize() : 0.33 * potSize;
          return mkBet(size, snapshot);
        }
        return canCheck ? { action: 'check' } : { action: 'fold' };
      }
    }
  }

  // Fallback
  return canCheck ? { action: 'check' } : { action: 'fold' };
}

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

export function decideCasual(
  snapshot: TableSnapshot,
  personality: PersonalityProfile,
): BotDecision {
  // 1. Short-stack push/fold
  const shortStack = casualShortStackDecision(snapshot);
  if (shortStack !== null) return shortStack;

  // 2. Street decision
  if (snapshot.street === 'preflop') {
    return preflopCasual(snapshot, personality);
  }
  return postflopCasual(snapshot, personality);
}
