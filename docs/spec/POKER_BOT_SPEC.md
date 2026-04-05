# Texas Hold'em Poker Bot — Implementation Specification

**Project:** Next.js Single-Player Texas Hold'em Simulator  
**Hosting:** Vercel  
**Last Updated:** 2026-04-04  

---

## Table of Contents

1. [Overview & Architecture](#1-overview--architecture)
2. [Shared Infrastructure](#2-shared-infrastructure)
3. [Easy Bots — "Fish Table" (Small Blinds)](#3-easy-bots--fish-table-small-blinds)
4. [Medium Bots — "Regular Table" (Mid Blinds)](#4-medium-bots--regular-table-mid-blinds)
5. [Hard Bots — "Shark Table" (High Blinds)](#5-hard-bots--shark-table-high-blinds)
6. [Bot Personality System](#6-bot-personality-system)
7. [Player Statistics Tracking](#7-player-statistics-tracking)
8. [Tech Stack & Libraries](#8-tech-stack--libraries)
9. [File Structure](#9-file-structure)
10. [Implementation Roadmap](#10-implementation-roadmap)

---

## 1. Overview & Architecture

### Difficulty Tiers

| Tier | Blind Level (BB) | Bot Philosophy | Key Feature |
|------|-----------------|----------------|-------------|
| **Easy** | 1 / 2 | Odds-only, minimal bluffing | Simple equity thresholds |
| **Medium** | 5 / 10 | Hand-strength-aware + personality | Opponent modelling begins |
| **Hard** | 25 / 50 | GTO-approximate + exploitative | Range thinking, user-stat adaptation |

### Core Design Principles

- All three tiers share the same **decision pipeline** — only the *inputs*, *thresholds*, and *reasoning depth* differ.
- Bots should feel **distinct from each other** within the same table via the Personality System (Section 6).
- All heavy computation (Monte Carlo, range enumeration) runs in a **Web Worker** to keep the UI thread free.
- User statistics persist in **localStorage** and feed upward — Easy ignores them, Medium skims them, Hard exploits them.

### Universal Decision Pipeline

```
[Game State] → [Hand Evaluation] → [Equity Calculation] → [Opponent Read]
                                                                  ↓
                                              [Personality Modifier Applied]
                                                                  ↓
                                         [Action Selection: fold / check / call / raise]
                                                                  ↓
                                                   [Bet Sizing Calculation]
```

---

## 2. Shared Infrastructure

These modules are used by all three difficulty tiers.

### 2.1 Hand Evaluator

**Library:** `pokersolver` (npm)

Evaluates any 5–7 card combination and returns a ranked hand object.

```ts
import { Hand } from 'pokersolver';

const hand = Hand.solve(['As', 'Ks', 'Qs', 'Js', 'Ts']);
// → { name: 'Royal Flush', rank: 9, ... }
```

Used for: showdown resolution, current hand strength label display, and informing equity simulations.

### 2.2 Monte Carlo Equity Engine (Web Worker)

Runs inside `/workers/equityWorker.ts`. Receives hole cards + board cards, simulates N random runouts, and returns win probability.

```ts
// equityWorker.ts
self.onmessage = ({ data }) => {
  const { holeCards, boardCards, opponents, simulations } = data;
  let wins = 0;

  for (let i = 0; i < simulations; i++) {
    const deck = buildRemainingDeck(holeCards, boardCards);
    shuffle(deck);
    const runout = [...boardCards, ...deck.slice(0, 5 - boardCards.length)];
    const botHand = Hand.solve([...holeCards, ...runout]);

    const opponentHands = opponents.map(() =>
      Hand.solve([...deck.splice(0, 2), ...runout])
    );

    const best = Hand.winners([botHand, ...opponentHands]);
    if (best.includes(botHand)) wins++;
  }

  self.postMessage({ equity: wins / simulations });
};
```

**Simulation counts by difficulty:**

| Tier | Pre-Flop | Flop | Turn | River |
|------|----------|------|------|-------|
| Easy | 200 | 300 | 400 | 500 (exact) |
| Medium | 500 | 800 | 1,000 | exact |
| Hard | 1,500 | 2,000 | 3,000 | exact |

### 2.3 Pot Odds Calculator

```ts
export function potOdds(callAmount: number, potSize: number): number {
  return callAmount / (potSize + callAmount);
}

// Bot should call if equity > potOdds
```

### 2.4 Expected Value (EV) Calculator

```ts
export function evCall(equity: number, pot: number, callAmount: number): number {
  return (equity * pot) - ((1 - equity) * callAmount);
}

export function evBluff(
  foldProbability: number,
  pot: number,
  betAmount: number
): number {
  return (foldProbability * pot) - ((1 - foldProbability) * betAmount);
}
```

### 2.5 Pre-Flop Hand Strength Tables

Rather than running Monte Carlo pre-flop every time, use a **precomputed lookup table** of the 169 canonical starting hand buckets ranked by equity (based on Chen Formula / Sklansky-Malmuth).

```ts
// preflop-table.ts — excerpt
export const PREFLOP_EQUITY: Record<string, number> = {
  'AA': 0.852, 'KK': 0.823, 'QQ': 0.800, 'AKs': 0.674,
  'JJ': 0.775, 'TT': 0.751, 'AQs': 0.659, 'AJs': 0.647,
  'KQs': 0.632, 'ATs': 0.639, 'AKo': 0.654, '99': 0.723,
  // ... all 169 combos
};

export function canonicalHand(c1: Card, c2: Card): string {
  // Returns 'AKs' for suited AK, 'AKo' for offsuit, 'AA' for pairs, etc.
}
```

---

## 3. Easy Bots — "Fish Table" (Small Blinds)

### Philosophy

Easy bots play a simplified, odds-based game. They understand pot odds and basic hand strength but make frequent mistakes — calling too much, sizing bets poorly, and bluffing occasionally at random. They do **not** read the opponent, do not track user stats, and have no awareness of position beyond a basic adjustment.

Think of them as **new players who read one article about poker equity.**

### 3.1 Decision Logic

#### Pre-Flop

Use the precomputed `PREFLOP_EQUITY` table plus the personality's `vpipThreshold`.

```ts
function easyPreflopAction(hand: string, equity: number, personality: EasyPersonality) {
  if (equity >= personality.raiseThreshold) return { action: 'raise', size: 'standard' };
  if (equity >= personality.callThreshold)  return { action: 'call' };
  return { action: 'fold' };
}
```

**Default thresholds (before personality modifiers):**

| Action | Equity Threshold |
|--------|-----------------|
| Raise | > 0.65 |
| Call | > 0.45 |
| Fold | ≤ 0.45 |

#### Post-Flop (Flop, Turn, River)

1. Run Monte Carlo (200–500 sims) → get equity `E`.
2. Calculate pot odds `P = callAmount / (pot + callAmount)`.
3. Decide action:

```ts
function easyPostFlopAction(equity: number, potOdds: number, personality: EasyPersonality) {
  // Random bluff injection
  if (Math.random() < personality.bluffFrequency) {
    return { action: 'raise', size: 'small', isBluff: true };
  }

  if (equity > 0.65) return { action: 'raise', size: 'standard' };
  if (equity > potOdds + 0.05) return { action: 'call' };
  return { action: 'fold' };
}
```

#### Bluff Injection

Easy bots bluff **randomly** — there is no hand-reading or situation awareness. The bluff is simply a dice roll.

```ts
const bluffFrequency = personality.bluffFrequency; // 0.04 – 0.10
```

They never semi-bluff correctly — they may "bluff" with a strong draw by accident.

### 3.2 Bet Sizing

Easy bots use fixed, imprecise sizes:

| Situation | Bet Size |
|-----------|----------|
| Standard raise (pre-flop) | 3× BB |
| Value bet (post-flop) | 50–60% pot (randomised slightly) |
| Bluff | 30–40% pot |
| Re-raise | 2.5× previous bet |

Sizing does **not** adapt to board texture or stack depth.

### 3.3 Position Awareness

Minimal. Easy bots apply a ±0.05 equity threshold modifier based on position (BTN/CO loosen up, UTG tighten slightly) but do not adjust post-flop play based on in-position vs out-of-position dynamics.

### 3.4 Easy Personality Variants

| Personality | VPIP | Bluff Freq | Notes |
|-------------|------|------------|-------|
| **Timid Fish** | 22% | 4% | Folds too much, easy to steal from |
| **Loose Fish** | 48% | 8% | Calls too wide, rarely folds |
| **Lucky Gambler** | 38% | 12% | Random aggression spikes, unpredictable |

Each bot at the table is independently assigned a personality at session start.

---

## 4. Medium Bots — "Regular Table" (Mid Blinds)

### Philosophy

Medium bots play **hand-strength-aware poker with basic opponent modelling**. They calculate proper pot odds and EV, size bets proportionally to hand strength, and make semi-intelligent reads on the user. They begin tracking a few user stats and adjust their bluff frequency and calling range accordingly.

They have **distinct personalities** that meaningfully affect strategy — not just bluff frequency. They represent **competent amateur players** who have studied the game.

### 4.1 Decision Logic

#### Pre-Flop

Uses `PREFLOP_EQUITY` + position-weighted thresholds + personality VPIP range.

```ts
function mediumPreflopAction(
  hand: string, equity: number, position: Position,
  personality: MediumPersonality, userStats: BasicUserStats
) {
  const positionBonus = POSITION_MODIFIERS[position]; // BTN: +0.05, UTG: -0.05
  const effectiveEquity = equity + positionBonus;

  // 3-bet consideration vs user open
  if (userOpenedPot && effectiveEquity > 0.70) {
    return { action: 'raise', size: 'threeBet' };
  }

  // Steal from blinds in late position
  if (isLatePosition(position) && personality.isAggressive && equity > 0.45) {
    return { action: 'raise', size: 'steal' };
  }

  if (effectiveEquity >= personality.raiseThreshold) return { action: 'raise', size: 'standard' };
  if (effectiveEquity >= personality.callThreshold)  return { action: 'call' };
  return { action: 'fold' };
}
```

#### Post-Flop — Hand Strength Categorisation

Medium bots categorise their hand into strength buckets post-flop, then act accordingly:

```ts
type HandCategory =
  | 'NUTS'          // Top set, straight flush, etc.
  | 'STRONG_VALUE'  // Two-pair+, overpair on dry board
  | 'MEDIUM_VALUE'  // Top pair good kicker, strong draw
  | 'WEAK_VALUE'    // Middle pair, weak draw
  | 'BLUFF_CAND'    // Backdoor draws, high cards
  | 'TRASH';        // No equity, no draw

function categoriseHand(equity: number, draws: DrawInfo): HandCategory {
  if (equity > 0.80) return 'NUTS';
  if (equity > 0.65) return 'STRONG_VALUE';
  if (equity > 0.50 || draws.hasOpenEnded || draws.hasFlushDraw) return 'MEDIUM_VALUE';
  if (equity > 0.35 || draws.hasGutshot) return 'WEAK_VALUE';
  if (draws.hasBackdoor || equity > 0.20) return 'BLUFF_CAND';
  return 'TRASH';
}
```

#### Post-Flop Action by Category

```ts
function mediumPostFlopAction(
  category: HandCategory, inPosition: boolean,
  personality: MediumPersonality, potOdds: number, userStats: BasicUserStats
) {
  // Exploit: if user folds too much, bluff more
  const adjustedBluffFreq = personality.bluffFrequency
    + (userStats.foldToCBet > 0.55 ? 0.08 : 0);

  switch (category) {
    case 'NUTS':
    case 'STRONG_VALUE':
      // Slowplay occasionally if personality supports it
      if (personality.slowplayFrequency > Math.random()) return { action: 'check' };
      return { action: 'raise', size: 'value' };

    case 'MEDIUM_VALUE':
      if (inPosition) return { action: 'raise', size: 'smallValue' };
      return { action: 'call' }; // pot control OOP

    case 'WEAK_VALUE':
      return potOdds < 0.28 ? { action: 'call' } : { action: 'fold' };

    case 'BLUFF_CAND':
      if (Math.random() < adjustedBluffFreq) {
        return { action: 'raise', size: 'bluff' };
      }
      return { action: 'fold' };

    case 'TRASH':
      return { action: 'fold' };
  }
}
```

#### Semi-Bluffing (Medium Exclusive Feature)

Medium bots semi-bluff correctly — they bluff with drawing hands that have genuine equity if called:

```ts
function evaluateDraws(holeCards: Card[], boardCards: Card[]): DrawInfo {
  return {
    hasFlushDraw: countFlushOuts(holeCards, boardCards) >= 4,
    hasOpenEnded: countStraightOuts(holeCards, boardCards) >= 8,
    hasGutshot: countStraightOuts(holeCards, boardCards) === 4,
    hasBackdoor: hasBackdoorDraw(holeCards, boardCards),
    totalOuts: countAllOuts(holeCards, boardCards),
  };
}
```

A flush draw semi-bluff is treated as `MEDIUM_VALUE` not `BLUFF_CAND`.

### 4.2 Basic Opponent Modelling

Medium bots track a **basic user profile** that resets each session:

```ts
interface BasicUserStats {
  handsPlayed: number;
  vpip: number;           // Voluntarily Put In Pot %
  pfr: number;            // Pre-Flop Raise %
  foldToCBet: number;     // Fold to continuation bet %
  showdownAggression: number; // Did they show down bluffs?
}
```

**How it's used:**

| Stat | Bot Adjustment |
|------|---------------|
| `vpip > 0.45` (loose player) | Tighten value bet thresholds; fewer bluffs |
| `vpip < 0.22` (tight player) | Respect their bets more; steal blinds more |
| `foldToCBet > 0.55` | Increase bluff frequency by +8% |
| `foldToCBet < 0.30` | Reduce bluffing, increase value sizing |
| `pfr > 0.30` (aggressive) | 3-bet lighter for resteals |

Stats update incrementally after each hand.

### 4.3 Board Texture Awareness

Medium bots assess the board and adjust strategy:

```ts
type BoardTexture = 'DRY' | 'SEMI-WET' | 'WET' | 'PAIRED' | 'MONOTONE';

function assessBoard(boardCards: Card[]): BoardTexture {
  // Check for flush possibilities, straight possibilities, pairs
}
```

| Texture | Bot Adjustment |
|---------|---------------|
| `DRY` (e.g. K72 rainbow) | C-bet high frequency; bluffs more credible |
| `WET` (e.g. 9♠8♠7♦) | Bet for protection with strong hands; fewer bluffs |
| `MONOTONE` | Check medium hands; only bet nuts or air |
| `PAIRED` | Treat carefully; full house/trips possible |

### 4.4 Bet Sizing (Medium)

Sizing is **proportional to hand strength and board texture**:

| Situation | Bet Size |
|-----------|----------|
| Thin value / dry board | 25–35% pot |
| Standard value | 55–65% pot |
| Protection bet (wet board) | 75–90% pot |
| Semi-bluff | 50–60% pot |
| Pure bluff | 40–50% pot (smaller to risk less) |
| 3-bet pre-flop | 3× the raise |
| Steal from late position | 2.2× BB |

### 4.5 Medium Personality Variants

| Personality | VPIP | PFR | Bluff Freq | Slowplay | Aggression | Style |
|-------------|------|-----|------------|----------|------------|-------|
| **TAG** (Tight-Aggressive) | 22% | 18% | 12% | 5% | High | Textbook solid; the "correct" player |
| **LAG** (Loose-Aggressive) | 38% | 30% | 20% | 8% | Very High | Wide ranges, frequent 3-bets, applies pressure |
| **Nit** | 14% | 10% | 4% | 2% | Low | Very tight; folds marginal spots, easy to steal from |
| **Calling Station** | 42% | 8% | 5% | 15% | Very Low | Calls too much, rarely raises; hard to bluff |
| **Trappy** | 24% | 12% | 8% | 30% | Medium | Likes check-raises and slow-plays; dangerous |

---

## 5. Hard Bots — "Shark Table" (High Blinds)

### Philosophy

Hard bots are the most sophisticated tier. They employ **GTO-approximate strategy** as a baseline and shift to **exploitative play** as user statistics accumulate. Their defining feature is **range-based thinking** — they reason not about what the user *has*, but about the full probability distribution of what the user *could have*, and narrow that range street by street.

They are fully **position-aware**, meticulously calculate EV, react to user tendencies with adversarial precision, and possess genuine **bluffing craft** — picking high-equity bluff candidates, appropriate bluff frequencies, and credible sizing.

Think of them as **experienced winning regulars / semi-professionals**.

### 5.1 Range-Based Thinking

This is the core differentiator of hard bots. Instead of guessing the user's single hand, the bot maintains a **range object** — a probability-weighted set of all plausible hole card combinations the user could hold.

#### Range Representation

```ts
type HandCombo = [Card, Card]; // e.g. [As, Kh]

interface RangeEntry {
  combo: HandCombo;
  weight: number; // 0.0 – 1.0, relative likelihood
}

type PlayerRange = RangeEntry[];

// Initialise with all 1,326 combos weighted equally pre-flop
function initialRange(): PlayerRange {
  return ALL_COMBOS.map(combo => ({ combo, weight: 1.0 }));
}
```

#### Range Narrowing (Bayesian Updates)

After each **user action**, update the range:

```ts
function updateRange(
  range: PlayerRange,
  action: UserAction,       // 'raise' | 'call' | 'fold' | 'check'
  position: Position,
  street: Street,
  potOdds: number,
  boardCards: Card[]
): PlayerRange {
  return range
    .map(entry => ({
      ...entry,
      weight: entry.weight * likelihoodOfAction(entry.combo, action, position, street, potOdds, boardCards)
    }))
    .filter(entry => entry.weight > 0.001) // prune near-zero combos
    .normalise(); // re-scale weights to sum to 1
}
```

`likelihoodOfAction` returns how likely a player with `combo` would take `action` — this is the heart of the model. Example:

- If user **raises pre-flop from UTG**, remove or heavily discount 72o, 83o, etc. Increase weight on AA–JJ, AK, AQ, suited connectors.
- If user **calls a flop bet on AK5 rainbow**, discount two-pair+ (would likely raise), discount total air (would fold). Increase weight on top pair hands, gutshots.
- If user **checks back the turn**, discount strong hands (missed value), increase weight on medium-strength / pot-control hands and missed draws.

```ts
function likelihoodOfAction(
  combo: HandCombo, action: UserAction,
  position: Position, street: Street,
  potOdds: number, boardCards: Card[]
): number {
  const equity = computeEquity(combo, boardCards); // exact on river, simulated otherwise
  const handCategory = categoriseHand(equity, evaluateDraws(combo, boardCards));

  // GTO frequencies by hand category and action (precomputed lookup)
  return GTO_ACTION_FREQUENCIES[street][handCategory][action][position] ?? 0.5;
}
```

#### Using the Range for Decisions

Once the range is constructed, the bot can compute **equity vs the range** rather than vs random cards:

```ts
function equityVsRange(botHoleCards: Card[], range: PlayerRange, boardCards: Card[]): number {
  let weightedWins = 0;
  let totalWeight = 0;

  for (const { combo, weight } of range) {
    const botHand = Hand.solve([...botHoleCards, ...boardCards]);
    const oppHand = Hand.solve([...combo, ...boardCards]);
    const winners = Hand.winners([botHand, oppHand]);
    if (winners.includes(botHand)) weightedWins += weight;
    totalWeight += weight;
  }

  return weightedWins / totalWeight;
}
```

This is dramatically more accurate than Monte Carlo vs random hands — the bot knows the user isn't holding 72o when they 3-bet pre-flop.

#### Range Advantage Assessment

```ts
function rangeAdvantage(botRange: PlayerRange, userRange: PlayerRange, board: Card[]): number {
  // Compute average equity of bot's range vs user's range
  // Positive = bot's range is stronger on this board
  // Used to determine: who has the "right" to bet / be aggressive
}
```

Bots with a **range advantage** on a board will bet more frequently. Bots at a **range disadvantage** will check-call more.

### 5.2 Full Opponent Modelling (User Statistics)

Hard bots maintain a **comprehensive user profile** that persists across sessions via `localStorage`:

```ts
interface AdvancedUserStats {
  // Volume
  handsPlayed: number;
  sessionCount: number;

  // Pre-Flop
  vpip: number;               // Voluntarily Put In Pot %
  pfr: number;                // Pre-Flop Raise %
  threeBetFrequency: number;  // How often they 3-bet
  foldTo3Bet: number;         // How often they fold to a 3-bet
  openRaisingByPosition: Record<Position, number>; // per-position open %

  // Post-Flop
  cBetFrequency: number;      // Continuation bet %
  foldToCBet: number;         // Fold to c-bet %
  foldToTurnBet: number;
  foldToRiverBet: number;
  checkRaiseFrequency: number;
  wtsd: number;               // Went to showdown %
  wsdWinRate: number;         // Won at showdown %

  // Bluffing
  bluffShowdownRate: number;  // % of showdowns they showed a bluff
  riverBluffFrequency: number;

  // Aggression
  af: number;                 // Aggression Factor (bet+raise / calls)
  afByStreet: Record<Street, number>;

  // Tendencies
  limpFrequency: number;
  coldCallFrequency: number;
  donkBetFrequency: number;   // Bet into pre-flop aggressor
  floatFrequency: number;     // Call flop, bet turn
}
```

#### Exploit Mapping

Hard bots compute **exploitative adjustments** from the user profile:

```ts
function computeExploits(stats: AdvancedUserStats): ExploitProfile {
  return {
    // If user folds too much post-flop → bluff more
    bluffFreqAdjust: clamp(
      (stats.foldToCBet - 0.50) * 0.4 +
      (stats.foldToTurnBet - 0.50) * 0.3, -0.15, 0.20
    ),

    // If user calls too much → value bet thinner, cut bluffs
    valueThinAdjust: clamp((stats.wtsd - 0.30) * 0.5, -0.10, 0.15),

    // If user 3-bets wide → tighten 4-bet, flat more in position
    threeLetAdjust: stats.threeBetFrequency > 0.12 ? 'flat-wide' : 'standard',

    // If user bluffs rivers → call down lighter
    riverCallAdjust: clamp((stats.bluffShowdownRate - 0.15) * 0.5, 0, 0.20),

    // If user c-bets too much → raise flop more with range advantage
    flopRaiseAdjust: stats.cBetFrequency > 0.70 ? 0.08 : 0,

    // If user limps a lot → isolate-raise lighter pre-flop
    isoRaiseAdjust: stats.limp Frequency > 0.25 ? 0.10 : 0,
  };
}
```

### 5.3 GTO-Approximate Action Frequencies

Hard bots use **precomputed GTO action frequency tables** for common spots. These are simplified from solver outputs (e.g. PioSOLVER outputs, simplified):

```ts
// Example: River value-bet / bluff frequencies by hand category
const RIVER_BETTING_FREQUENCIES = {
  NUTS:         { valueBet: 0.95, check: 0.05 },     // near-always bet
  STRONG_VALUE: { valueBet: 0.80, check: 0.20 },
  MEDIUM_VALUE: { valueBet: 0.30, check: 0.70 },     // pot control
  BLUFF_CAND:   { bluff: 0.35, check: 0.65 },        // balanced bluff freq
  TRASH:        { bluff: 0.10, check: 0.90 },
};
```

These frequencies are then **modified by the exploit profile** — so against a user who folds rivers 70% of the time, `BLUFF_CAND.bluff` rises from 0.35 toward 0.55.

The bot doesn't always do the highest-EV action — it **mixes** at GTO frequencies (using `Math.random()`) to remain somewhat unpredictable even to sophisticated players.

### 5.4 Advanced Bet Sizing

Hard bots size bets based on **board texture, hand category, stack-to-pot ratio (SPR), and the goal** (value vs protection vs bluff):

```ts
function hardBetSize(
  category: HandCategory, texture: BoardTexture,
  spr: number, isBluff: boolean, position: 'IP' | 'OOP'
): BetSize {
  if (spr < 1.5) return 'all-in'; // Commit when pot-committed

  if (isBluff) {
    // Bluffs should match value bet sizing (don't give it away)
    // On paired/dry boards → smaller (less convincing to go large)
    return texture === 'DRY' ? '45%' : '60%';
  }

  switch (category) {
    case 'NUTS':
      // Overbet to extract max from weak ranges on favourable runouts
      return spr > 3 && texture !== 'WET' ? '125%' : '75%';

    case 'STRONG_VALUE':
      return texture === 'WET' ? '75%' : '60%'; // protection on wet boards

    case 'MEDIUM_VALUE':
      return position === 'IP' ? '33%' : '45%'; // thin value in position

    case 'BLUFF_CAND':
      return '50%'; // balanced semi-bluff / bluff size
  }
}
```

### 5.5 Bluffing Craft (Hard Bots)

Hard bots don't bluff randomly. They **select optimal bluff candidates** using these criteria:

1. **Blocker bluffs**: Prefer bluffing when holding cards that block the user's likely strong hands (e.g. holding A♠ on an A-high board blocks AA, AK combos in the user's range).

2. **High-equity bluffs (semi-bluffs)**: On earlier streets, prefer bluffing with draws — the bot has equity even if called.

3. **Board-credible bluffs**: Only bluff when the board runs out in a way that *could* have improved the bot's perceived range. A bot who raised pre-flop shouldn't bluff when the board is 7-2-3 rainbow — their range doesn't have many 7s.

4. **Fold equity calculation before bluffing**:

```ts
function shouldBluff(
  handCategory: HandCategory, userRange: PlayerRange,
  boardCards: Card[], bluffSize: number, pot: number,
  userStats: AdvancedUserStats, exploits: ExploitProfile
): boolean {
  // Estimate probability user folds given their range and bet size
  const baseFoldRate = estimateFoldRate(userRange, boardCards, bluffSize / (pot + bluffSize));
  const adjustedFoldRate = baseFoldRate + exploits.bluffFreqAdjust;
  const ev = evBluff(adjustedFoldRate, pot, bluffSize);
  return ev > 0 && hasBlockers(handCategory, userRange);
}
```

5. **Bluff frequency balancing**: On the river, the bot targets a **bluff-to-value ratio** consistent with GTO (approximately 1:2 bluffs to value bets at pot-sized bets) to avoid being exploitable.

### 5.6 Position Mastery

Hard bots fully exploit positional advantage:

| Situation | Hard Bot Behaviour |
|-----------|-------------------|
| On the BTN | Steal liberally; 3-bet a wide linear range |
| In the BB vs steal | 3-bet defend or call with correct frequencies; no over-folding |
| OOP post-flop | Lead with strong hands; check-call medium; check-raise polarised range |
| IP post-flop | Float (call with medium hands), apply turn pressure; delayed c-bet frequently |
| OOP vs c-bet | Donk-bet occasionally with strong hands to balance range |

### 5.7 Stack-to-Pot Ratio (SPR) Awareness

```ts
function spr(effectiveStack: number, pot: number): number {
  return effectiveStack / pot;
}

// SPR-based commitment thresholds
// SPR < 2  → willing to commit with top pair+
// SPR 2-5  → need two pair+ to commit
// SPR > 10 → need sets / better to play large pot
```

### 5.8 Hard Personality Variants

Unlike easy/medium, hard personalities represent **playing style philosophy**, not just tightness:

| Personality | Style | Key Traits |
|-------------|-------|------------|
| **GTO Solver** | Balanced, unexploitable | Mixes all actions at correct frequencies; hardest to read |
| **Aggressive Exploiter** | Highly exploitative | Maximally punishes user leaks; switches style as reads develop |
| **Polarised Aggressor** | Range-polarised betting | Only bets nuts or complete bluffs; medium hands always check |
| **Value Specialist** | Thin value king | Bets tiny with marginal hands; rarely bluffs; extracts every chip |
| **Pressure Artist** | Relentless aggressor | High 3-bet %, large sizing, applies constant pressure; selective slowplays |

---

## 6. Bot Personality System

### 6.1 Personality Schema

```ts
interface BotPersonality {
  id: string;
  name: string;
  archetype: 'nit' | 'tag' | 'lag' | 'station' | 'maniac' | 'trappy' | 'gto';
  difficulty: 'easy' | 'medium' | 'hard';

  // Thresholds
  vpip: number;               // 0.0 – 1.0
  pfr: number;
  threeBetFrequency: number;
  foldTo3Bet: number;

  // Post-flop tendencies
  cBetFrequency: number;
  bluffFrequency: number;
  slowplayFrequency: number;
  checkRaiseFrequency: number;
  
  // Tilt parameters
  tiltEnabled: boolean;
  tiltThreshold: number;    // Stack loss % that triggers tilt
  tiltBluffMultiplier: number; // Multiply bluff freq when tilted

  // Display
  avatarEmoji: string;
  displayName: string;
  tagline: string;           // e.g. "Plays it safe", "Always watching"
}
```

### 6.2 Tilt Simulation

Applicable to all difficulty levels, gives bots a **human feel** after bad beats:

```ts
interface TiltState {
  isTilted: boolean;
  tiltHandsRemaining: number;
  stackLostThisSession: number;
}

function checkTilt(state: TiltState, personality: BotPersonality): TiltState {
  const stackLossPct = state.stackLostThisSession / STARTING_STACK;
  if (stackLossPct > personality.tiltThreshold) {
    return { ...state, isTilted: true, tiltHandsRemaining: 3 + Math.floor(Math.random() * 4) };
  }
  return state;
}

function applyTilt(bluffFrequency: number, tiltState: TiltState, multiplier: number): number {
  if (tiltState.isTilted) return Math.min(bluffFrequency * multiplier, 0.50);
  return bluffFrequency;
}
```

Tilt decays naturally over hands (`tiltHandsRemaining--`).

---

## 7. Player Statistics Tracking

### 7.1 Storage

```ts
// Persisted via localStorage, keyed per-difficulty
const STATS_KEY = 'poker_user_stats_v1';

function loadUserStats(difficulty: Difficulty): AdvancedUserStats {
  const raw = localStorage.getItem(`${STATS_KEY}_${difficulty}`);
  return raw ? JSON.parse(raw) : defaultStats();
}

function saveUserStats(difficulty: Difficulty, stats: AdvancedUserStats): void {
  localStorage.setItem(`${STATS_KEY}_${difficulty}`, JSON.stringify(stats));
}
```

### 7.2 Update Triggers

| Trigger | Stats Updated |
|---------|--------------|
| User sees flop voluntarily | `vpip++` |
| User raises pre-flop | `pfr++` |
| User 3-bets | `threeBetFrequency` updated |
| User folds to c-bet | `foldToCBet` updated |
| User reaches showdown | `wtsd`, `wsdWinRate` updated |
| User shows a bluff at showdown | `bluffShowdownRate` updated |
| User bets turn after calling flop | `floatFrequency` updated |

Stats use an **exponential moving average** to weight recent hands more:

```ts
function updateStat(current: number, newObservation: number, alpha = 0.15): number {
  // Alpha controls how quickly the estimate adapts (0.15 = moderate responsiveness)
  return current * (1 - alpha) + newObservation * alpha;
}
```

### 7.3 Minimum Sample Requirements

Bots only act on stats once there is a **minimum sample size** to prevent over-adjusting on noise:

| Stat | Min Hands Before Using |
|------|----------------------|
| VPIP / PFR | 8 hands |
| Fold to C-bet | 12 hands (needs enough c-bets to face) |
| River bluff rate | 20 hands |
| Position-specific stats | 15 hands in that position |

---

## 8. Tech Stack & Libraries

### 8.1 Core Libraries

| Package | Purpose | Install |
|---------|---------|---------|
| `pokersolver` | Hand evaluation, rankings, winner determination | `npm i pokersolver` |
| `@types/pokersolver` | TypeScript types | `npm i -D @types/pokersolver` |
| `uuid` | Unique IDs for hand history, bots | `npm i uuid` |
| `zustand` | Global game state management | `npm i zustand` |
| `immer` | Immutable state updates (pairs with zustand) | `npm i immer` |

### 8.2 Pre-Flop Equity Data

Pre-compute a JSON table of all 169 canonical starting hand equities offline (using any solver or the Chen formula), bundle as a static asset, and import at runtime. No external service needed.

```
/public/data/preflop-equity.json   ← ~3KB, cached by Vercel CDN
```

### 8.3 Web Worker Setup (Next.js)

Next.js supports Web Workers via `worker-loader` or the built-in `new Worker(new URL(...))` pattern:

```ts
// In your game component
const equityWorker = new Worker(new URL('../workers/equityWorker.ts', import.meta.url));

equityWorker.postMessage({ holeCards, boardCards, opponents: 2, simulations: 1000 });
equityWorker.onmessage = ({ data }) => setEquity(data.equity);
```

Add to `next.config.js`:
```js
module.exports = {
  webpack(config) {
    config.output.globalObject = 'self';
    return config;
  }
};
```

### 8.4 GTO Frequency Tables

Store simplified, precomputed GTO frequencies (approximated from published solver outputs) as static JSON:

```
/public/data/gto-frequencies.json   ← Street × position × hand-category × action frequencies
```

This avoids the need to run CFR at runtime — the hard bots look up pre-solved frequencies and sample from them.

### 8.5 Optional Enhancements

| Package | Purpose |
|---------|---------|
| `react-spring` / `framer-motion` | Card dealing animations, chip movements |
| `howler` | Card sound effects, chip sounds |
| `recharts` | Post-session stats visualisation for the player |
| `@vercel/kv` | If adding server-side persistent stats (beyond localStorage) |

---

## 9. File Structure

```
/src
  /workers
    equityWorker.ts          ← Monte Carlo engine (Web Worker)
    rangeWorker.ts           ← Range update calculations (Hard bots, Worker)

  /lib
    /poker
      deck.ts                ← Card types, deck generation, shuffle
      handEvaluator.ts       ← Wrapper around pokersolver
      equity.ts              ← MC equity, pot odds, EV helpers
      draws.ts               ← Flush/straight draw detection
      preflopTable.ts        ← 169-bucket equity lookup
      boardTexture.ts        ← Dry/wet/monotone assessment
      range.ts               ← Range types, initialisation, normalisation
      rangeUpdater.ts        ← Bayesian range narrowing logic
      gtoFrequencies.ts      ← Static GTO frequency lookups

    /bots
      types.ts               ← BotPersonality, BotState, difficulty enums
      personalities.ts       ← All personality presets (easy/medium/hard)
      userStats.ts           ← AdvancedUserStats, update logic, localStorage
      exploits.ts            ← computeExploits() — stats → adjustments
      tilt.ts                ← Tilt simulation
      
      easyBot.ts             ← Easy bot decision engine
      mediumBot.ts           ← Medium bot decision engine
      hardBot.ts             ← Hard bot decision engine

    /game
      gameState.ts           ← Zustand store: full game state
      handHistory.ts         ← Per-hand event log
      blinds.ts              ← Blind levels per difficulty
      betting.ts             ← Pot calculation, side pots, all-in logic

  /components
    Table.tsx
    Card.tsx
    Player.tsx
    BotPlayer.tsx
    ActionPanel.tsx
    StatsPanel.tsx

  /app
    page.tsx
    difficulty-select/page.tsx
    game/[difficulty]/page.tsx

/public
  /data
    preflop-equity.json
    gto-frequencies.json
```

---

## 10. Implementation Roadmap

### Phase 1 — Foundation (Week 1–2)

- [ ] Card/deck primitives, `pokersolver` integration
- [ ] Zustand game state store
- [ ] Basic UI: table, cards, action buttons
- [ ] Pre-flop equity table
- [ ] Easy bot: threshold-based decisions, basic bet sizing

### Phase 2 — Medium Bots (Week 3)

- [ ] Monte Carlo Web Worker
- [ ] Draw detection
- [ ] Board texture assessment
- [ ] Hand strength categorisation
- [ ] User stats tracking (basic: VPIP, PFR, foldToCBet)
- [ ] Medium bot engine + 5 personalities
- [ ] Semi-bluff logic

### Phase 3 — Hard Bots (Week 4–5)

- [ ] Range representation and initialisation
- [ ] Bayesian range narrowing (per action, per street)
- [ ] `equityVsRange()` computation
- [ ] Full user stats (all fields in `AdvancedUserStats`)
- [ ] `computeExploits()` engine
- [ ] GTO frequency table integration
- [ ] Hard bot engine + 5 personalities
- [ ] Bluff candidate selection with blockers

### Phase 4 — Polish (Week 6)

- [ ] Tilt simulation across all difficulties
- [ ] Post-session stats screen
- [ ] localStorage persistence for user stats
- [ ] Animation, sounds, pacing (bot "think" delay)
- [ ] Difficulty select screen with blind level display
- [ ] Vercel deployment + `@vercel/kv` for optional cloud stats sync
