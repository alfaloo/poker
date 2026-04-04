# Poker Site — Product & Implementation Spec (v1)

> Single-player Texas Hold'em · Next.js · NeonDB · Vercel

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tech Stack](#2-tech-stack)
3. [Database Schema](#3-database-schema)
4. [Texas Hold'em Rules Reference](#4-texas-holdem-rules-reference)
5. [Feature Specifications](#5-feature-specifications)
   - 5.1 [Authentication & Accounts](#51-authentication--accounts)
   - 5.2 [Lobby & Game Setup](#52-lobby--game-setup)
   - 5.3 [Game Engine](#53-game-engine)
   - 5.4 [Bot Behaviour](#54-bot-behaviour)
   - 5.5 [User Actions & Betting UI](#55-user-actions--betting-ui)
   - 5.6 [Card Dealing & Deck Logic](#56-card-dealing--deck-logic)
   - 5.7 [Balance Persistence & Anti-Evasion](#57-balance-persistence--anti-evasion)
   - 5.8 [Hand Resolution & Showdown](#58-hand-resolution--showdown)
   - 5.9 [Daily Coin Reward](#59-daily-coin-reward)
   - 5.10 [Leaderboard](#510-leaderboard)
6. [UI / UX Design](#6-ui--ux-design)
7. [Codebase Architecture](#7-codebase-architecture)
8. [API & Server Actions](#8-api--server-actions)
9. [Key Implementation Notes](#9-key-implementation-notes)
10. [Out of Scope (v1)](#10-out-of-scope-v1)

---

## 1. Overview

A browser-based, single-player Texas Hold'em poker game. Registered users compete against AI bots at one of three difficulty tiers. The game is faithful to real casino rules — predetermined deck shuffles, correct blind/action order, side-pot handling, and a proper showdown. User balances are persisted in a PostgreSQL database (Neon) after every monetary action, preventing loss evasion.

---

## 2. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | **Next.js 14 (App Router)** | SSR for auth pages, client-side game loop, server actions for DB writes |
| Database | **NeonDB** (serverless Postgres) | Free-tier friendly, edge-compatible, works natively with Vercel |
| ORM | **Drizzle ORM** | Lightweight, fully typed, first-class NeonDB/Postgres support |
| Auth | **NextAuth.js v5** (Credentials provider) | Email+password login; session management via JWTs |
| Hosting | **Vercel** | Zero-config Next.js deployment |
| Game Engine | **`poker-ts`** | Handles table state machine: seating, blinds, betting rounds, pots, action validation, showdown |
| Hand Evaluation | **`pokersolver`** | Evaluates up to 7-card hands, returns hand name + rank, compares arrays of hands for split-pot detection |
| Styling | **Tailwind CSS** | Utility-first; pairs well with component animations |
| Animations | **Framer Motion** | Card deal / chip slide / win animations |
| Password Hashing | **bcryptjs** | Secure credential storage |

### Install the poker libraries

```bash
npm install poker-ts pokersolver
npm install -D @types/pokersolver
```

---

## 3. Database Schema

Managed via Drizzle ORM migrations. Two tables for v1.

### `users`

```sql
CREATE TABLE users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username         TEXT NOT NULL UNIQUE,
  email            TEXT NOT NULL UNIQUE,
  password_hash    TEXT NOT NULL,
  balance          INTEGER NOT NULL DEFAULT 400,   -- in whole coin units
  date_last_accessed DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

| Column | Notes |
|---|---|
| `balance` | Stored as an integer (whole coins). Never goes below 0 in DB. |
| `date_last_accessed` | Updated to `CURRENT_DATE` on each authenticated page load. Used to gate the daily free-coin reward. |

### `leaderboard` (view — no extra table needed)

```sql
CREATE VIEW leaderboard AS
  SELECT username, balance
  FROM users
  ORDER BY balance DESC
  LIMIT 10;
```

No game session table is required for v1 — game state is held entirely client-side and only net balance changes are written to the DB.

---

## 4. Texas Hold'em Rules Reference

This section captures every rule that the implementation must correctly model.

### 4.1 Hand Rankings (highest → lowest)

| Rank | Name | Description |
|---|---|---|
| 1 | Royal Flush | A K Q J T of the same suit |
| 2 | Straight Flush | 5 consecutive ranks, same suit |
| 3 | Four of a Kind | 4 cards of the same rank |
| 4 | Full House | Three of a kind + a pair |
| 5 | Flush | Any 5 cards of the same suit |
| 6 | Straight | 5 consecutive ranks, mixed suits |
| 7 | Three of a Kind | 3 cards of the same rank |
| 8 | Two Pair | Two separate pairs |
| 9 | One Pair | Two cards of the same rank |
| 10 | High Card | None of the above; best single card wins |

Ties are resolved by kicker cards. `pokersolver` handles all tie-breaking automatically.

### 4.2 Table Positions (clockwise)

```
[ Dealer / Button (BTN) ]
[ Small Blind (SB) ]       ← posts small blind (= small blind value)
[ Big Blind (BB) ]         ← posts big blind  (= big blind value)
[ UTG, UTG+1, … ]         ← remaining players
```

The dealer button rotates one seat clockwise after each hand.

**Heads-up (2 players):** Dealer = Small Blind. SB/Dealer acts first pre-flop; BB acts last pre-flop. Post-flop order reverses — BB (non-dealer) acts first.

### 4.3 Betting Rounds

| Round | Community Cards Revealed | First to Act |
|---|---|---|
| Pre-flop | None (hole cards only) | Player left of BB (UTG) |
| Flop | 3 cards | First active player left of Dealer |
| Turn | 1 additional card | First active player left of Dealer |
| River | 1 final card | First active player left of Dealer |

A betting round ends when every remaining (non-folded, non-all-in) player has acted and all bets are equal.

### 4.4 Betting Actions

| Action | Availability | Description |
|---|---|---|
| **Check** | No bet has been placed in this round | Pass; action moves clockwise |
| **Call** | A bet exists | Match the current highest bet |
| **Bet** | No bet has been placed in this round | Open the betting |
| **Raise** | A bet already exists | Increase the bet; minimum raise = size of the previous bet/raise |
| **Fold** | Always | Discard hole cards; forfeit any chips already in the pot |

**Minimum raise rule:** The raise must be at least as large as the previous raise increment.  
Example: BB = 10. UTG raises to 30 (a raise of 20). Next raiser must go to at least 50 (30 + 20).

**Big Blind option:** If every player pre-flop merely called the BB (no raise), the BB player gets a final option to raise even though technically the bet "came back" to them.

**No-Limit:** Players may go all-in for any amount up to their remaining stack.

### 4.5 All-In and Side Pots

When a player goes all-in for an amount less than the current bet:
1. A **main pot** is created containing their all-in amount × every contributing player.
2. The remaining bets form a **side pot** that only players who contributed to it can win.
3. `poker-ts` handles side pot calculation automatically via `pots()`.

### 4.6 Showdown

After the river betting round:
- All remaining players reveal their hole cards.
- Each player makes their best 5-card hand from 2 hole cards + 5 community cards (best 5 of 7).
- `pokersolver` compares all hands and returns the winner(s).
- On a tie, the pot is split evenly.
- **Exception:** If all but one player has folded at any point, the last remaining player wins the pot immediately without revealing their hand. The game moves on without a showdown.

### 4.7 Dealer Button & Blinds in Multi-Hand Play

After each hand, the button advances one seat clockwise. Blinds follow automatically. If a player has been eliminated (zero chips), they are removed from the table before the next hand.

---

## 5. Feature Specifications

### 5.1 Authentication & Accounts

- **Registration:** Users provide a username, email, and password. Password is hashed with `bcryptjs`. On successful registration, the account is created with `balance = 400` and `date_last_accessed = today`.
- **Login:** Email + password via NextAuth Credentials provider. Session stored as a JWT cookie.
- **Logout:** Clears session cookie; redirects to login page.
- **Error states:** Duplicate email/username, wrong password, missing fields — all surface inline form errors.

### 5.2 Lobby & Game Setup

The authenticated home page (`/`) acts as the lobby.

#### Difficulty Tiers

| Tier | Blinds (SB/BB) | Buy-In | Min Balance to Enter |
|---|---|---|---|
| Beginner | 1 / 2 | 200 | 200 |
| Specialist | 5 / 10 | 1,000 | 1,000 |
| Master | 25 / 50 | 5,000 | 5,000 |

- The buy-in is fixed at 100× the big blind value.
- A tier card is visually greyed out and its "Play" button is disabled if the user's balance is below that tier's buy-in.

#### Player Count Selection

- Each tier card includes a selector: **4 – 8 players** (inclusive), representing total seats including the user.
- Default: 6 players.

#### Starting a Game

When the user clicks "Play":
1. Deduct the buy-in from the user's DB balance immediately via a server action.
2. Generate a `sessionId` (UUID) for the URL.
3. Redirect to `/game/[sessionId]`.
4. Pass tier config and player count as URL search params or encoded in the session.

### 5.3 Game Engine

The game engine runs **entirely client-side** using `poker-ts`. This keeps latency at zero for every bot/user action while the server is only called to persist balance changes.

#### Initialisation

```typescript
import Poker from 'poker-ts';

const table = new Poker.Table({ smallBlind, bigBlind }, numSeats);

// Seat user (seat 0 = bottom of screen)
table.sitDown(0, buyIn);

// Seat bots
for (let i = 1; i < numSeats; i++) {
  table.sitDown(i, buyIn);
}

table.startHand();
```

#### Game Loop (React state machine)

```
startHand()
  └─ while isBettingRoundInProgress()
        ├─ if playerToAct() === userSeat → show ActionPanel, await user input
        └─ if playerToAct() !== userSeat → schedule bot action (2 s delay)
  └─ endBettingRound()   // deals flop/turn/river cards in UI
  └─ if areBettingRoundsCompleted()
        └─ showdown()
        └─ display HandResult screen
        └─ await user click → next hand or leave table
```

#### Multi-hand Play

After a hand resolves:
- Players with 0 chips are removed via `table.standUp(seat)`.
- If only the user remains (all bots busted), display a "You win!" message.
- If the user has 0 chips, display "You're out." and end the session.
- The user may also voluntarily **Leave Table** between hands (button shown on the HandResult screen).

#### Session Cleanup

When leaving (voluntarily or forced), the user's remaining chips from the table are credited back to their DB balance via a server action.

### 5.4 Bot Behaviour

**v1 strategy: call/check every action, regardless of hand strength or bet size.**

```typescript
async function takeBotAction(table: Poker.Table, seat: number): Promise<void> {
  await delay(2000); // simulate thinking

  const { actions } = table.legalActions();

  if (actions.includes('check')) {
    table.actionTaken('check');
  } else {
    table.actionTaken('call');  // call any bet/raise
  }
}
```

- Bots never fold and never raise — they purely check or call.
- A visual "thinking…" indicator (pulsing avatar ring) appears on the active bot seat during the 2-second delay.
- Bots cannot leave the table mid-session; they play until busted.

### 5.5 User Actions & Betting UI

The action panel appears at the bottom of the screen whenever `playerToAct() === userSeat`.

#### Available Actions

The panel reads `table.legalActions()` to determine which controls to enable.

| Control | Enabled When |
|---|---|
| **Check** | `'check'` is in `legalActions().actions` |
| **Call [amount]** | `'call'` is in `legalActions().actions` |
| **Fold** | Always (when it is user's turn) |
| **Bet / Raise panel** | `'bet'` or `'raise'` is in `legalActions().actions` |

#### Bet / Raise Panel

**Terminology:**
- First bet in a round → button label reads **"Bet"**
- Subsequent bets in the same round (after someone else has bet) → label reads **"Raise"**

**Total-amount semantics:** The value the user selects is the **total bet for that round**, not the additional amount. If the current bet is 20 and the user wants to raise to 60, they input **60**. Internally: `table.actionTaken('raise', 60)`.

**Default quick-bet buttons:**

| Button | Value | Availability |
|---|---|---|
| 1/3 Pot | `Math.floor(pot / 3)` | Disabled (greyed out) if value ≤ current bet |
| 1/2 Pot | `Math.floor(pot / 2)` | Disabled if value ≤ current bet |
| Full Pot | `pot` | Disabled if value ≤ current bet |
| All-In | User's remaining stack | Always enabled |

Any quick-bet value that falls below the legal minimum raise (from `legalActions().chipRange.min`) is also disabled.

**Slider:**
- Range: `chipRange.min` → `chipRange.max` (user's stack).
- Step: equal to the small blind value (minimum granularity).
- Numeric input adjacent to the slider shows the current selected amount and can be typed into directly.

**Confirm button:** "Bet [amount]" / "Raise to [amount]" — submits the action.

#### Bet Display on Table

Whenever any player (user or bot) places a bet or raises:
- Show the **total bet amount** next to their seat (e.g. "60").
- Show the **delta from the previous bet** in smaller text beneath (e.g. "+40").
- Chips visually animate sliding toward the centre pot.

### 5.6 Card Dealing & Deck Logic

The entire 52-card deck is shuffled **once at the start of a hand** before any cards are distributed. All hole cards and community cards are assigned from this predetermined sequence. This mirrors a physical poker game where the deck is shuffled, then dealt from top to bottom.

```typescript
function buildAndShuffleDeck(): Card[] {
  const ranks = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
  const suits = ['clubs','diamonds','hearts','spades'];
  const deck: Card[] = ranks.flatMap(r => suits.map(s => ({ rank: r, suit: s })));

  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
```

**Card assignment order:**
1. Deal 2 hole cards to each player in clockwise seat order, starting from the player left of the dealer — exactly as in a real deal (one card around, then a second card around).
2. The next 3 cards in the deck become the **flop**.
3. The next card is the **turn**.
4. The next card is the **river**.

(Burn cards are omitted for simplicity since the deck is predetermined and there is no physical manipulation.)

**Note:** `poker-ts` accepts the deck externally via its dealing mechanism, so pass the pre-built shuffled deck to the table for hole card assignment rather than letting the library generate its own randomness. Community cards are managed in React state and revealed progressively as `endBettingRound()` is called.

### 5.7 Balance Persistence & Anti-Evasion

The user's DB balance reflects their "real" wealth at all times, even mid-hand.

#### Flow

| Event | DB Write |
|---|---|
| Game started | Deduct buy-in from `balance` |
| User bets or raises | Deduct the **additional** chips just committed to the pot |
| User calls | Deduct the call amount |
| User folds | No further write (chips already deducted at prior bets) |
| Hand ends (user won or tied) | Credit winnings to `balance` |
| User leaves table | Credit remaining stack to `balance` |

All DB writes use Next.js **Server Actions** (`'use server'`). The client passes the delta amount; the server validates it is non-negative and updates the row atomically.

**Result:** If the browser is force-closed mid-hand, the user's balance reflects whatever they had committed up to that point. Chips not yet placed into the pot (remaining stack) are irrecoverably lost. This is acceptable for v1; a reconnect/resume feature is out of scope.

> **Security note:** Server actions should verify the session user ID against the action's target user ID to prevent cross-user balance manipulation.

### 5.8 Hand Resolution & Showdown

#### Determining the Winner

```typescript
import { Hand } from 'pokersolver';

// After table.showdown():
const remainingSeats = table.handPlayers(); // seats still in the hand

const hands = remainingSeats.map(seat => {
  const holeCards = table.holeCards()[seat]; // [{rank, suit}, {rank, suit}]
  const community = table.communityCards();  // up to 5 cards
  const all7 = [...holeCards, ...community];

  // pokersolver expects strings like "Ah", "Kd", "2s"
  const cardStrings = all7.map(c => c.rank + c.suit[0]);
  return Hand.solve(cardStrings);
});

const winners = Hand.winners(hands); // handles ties / split pots
```

`pokersolver` returns hand name (e.g. "Full House"), description (e.g. "Full House, Kings Full of Aces"), and a numeric rank for comparison. Use this to display hand names during the showdown screen.

For side pot winners, iterate `table.pots()` and resolve each pot's eligible hands separately.

#### Showdown Screen

- All remaining players' cards flip face-up simultaneously with an animation.
- Each player's best hand is labelled beneath their cards.
- The winner's card area glows / pulses.
- The pot chips animate sliding to the winner's seat.
- **The screen is frozen** — no automatic progression.
- A subtle text prompt ("Click anywhere to continue") appears after 1.5 s.
- Any click or tap on the screen advances to the next hand setup.

#### Early Winner (All Others Folded)

If `table.isBettingRoundInProgress()` ends with only one player remaining:
- That player wins the pot immediately. Their hand is **not** revealed.
- Show a brief "Player X wins the pot" overlay (1 s) then auto-advance to the next hand without requiring a click.

#### Post-Hand Card Visibility

The user may view their own hole cards at any time during and after the hand, even after folding. Bot cards remain face-down until the showdown (and even then only if they reach showdown — bots that fold do not show cards).

### 5.9 Daily Coin Reward

**Logic** (runs server-side on every authenticated page load):

```
IF current_date > user.date_last_accessed
  THEN
    UPDATE users SET date_last_accessed = current_date
    IF user.balance < 200
      THEN UPDATE users SET balance = balance + 200
```

This check runs in the root layout or as part of the session initialisation middleware. The `+200` coin reward is shown as a toast notification on the lobby page if it was applied.

**Purpose:** Prevents new users who have spent down to near-zero from being permanently locked out of all game tiers.

### 5.10 Leaderboard

Route: `/leaderboard`

- Fetches the top 10 users ordered by `balance DESC` directly from the DB (server component, no client fetch required).
- Displays: rank, username, balance.
- Current logged-in user's row is highlighted.
- Refreshes on every page visit (no caching).

---

## 6. UI / UX Design

### 6.1 Lobby (`/`)

- Dark green felt background, gold/amber accent colours.
- Three difficulty cards arranged horizontally (or vertically on mobile).
- Each card shows: tier name, blind structure, buy-in amount, a brief flavour description.
- Disabled cards have a lock icon and a tooltip ("Insufficient balance").
- Player count stepper (−/+) inside each card, defaulting to 6.
- User balance displayed prominently in the top-right nav bar.

### 6.2 Game Table (`/game/[sessionId]`)

```
┌─────────────────────────────────────────────┐
│  [Player 3]      [Player 4]      [Player 5]  │
│                                              │
│  [Player 2]   [ POT: 120 ]      [Player 6]  │
│               [🂡 🂱 🃁]                      │  ← community cards
│  [Player 1]   [ TURN | RIVER ]  [Player 7]  │
│                                              │
│              [  YOU  (seat 0)  ]             │
│             [ 🂧 🃞 ] ← hole cards            │
│  ┌─────────────────────────────────────────┐ │
│  │  [Fold]  [Check/Call]  [Bet/Raise ▶]    │ │
│  └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

**Table:** An elliptical SVG or CSS-clipped `div` with a felt-green radial gradient. Gold border ring.

**Player seats:** Positioned absolutely around the ellipse using polar-coordinate math based on seat index and total seat count. Each seat shows:
- Avatar (generated from username initial or a bot icon)
- Username
- Chip stack
- Current-round bet amount (below the seat)
- A dealer button chip (D) on the relevant seat
- Blind labels (SB, BB) on the relevant seats

**Community cards:** Rendered in the centre. Cards not yet dealt are shown as face-down placeholders. Cards are revealed with a flip animation when `endBettingRound()` is called.

**Pot display:** Centred above community cards. Animates chip tokens accumulating as bets are made.

**User hole cards:** Fixed at the bottom centre, always face-up (even after fold — cards become slightly faded/greyed if folded).

**Action panel:** Fixed to the bottom of the viewport, slides up from below when it is the user's turn.

### 6.3 Card Component

- Represent each card as a styled component with rank + suit symbol.
- Suits use colour convention: ♠ ♣ black, ♥ ♦ red.
- Face-down card: a decorative back pattern (e.g. diamond cross-hatch in dark red).
- Card flip animation: CSS 3D `rotateY` transform, 300 ms.

### 6.4 Bet Display

When a player bets:
```
  ┌────────────────┐
  │  Bet: 60       │   ← total bet this round
  │  (+40)         │   ← delta from previous bet
  └────────────────┘
```
This badge appears next to the player's seat and persists until the round ends.

### 6.5 Animations (Framer Motion)

| Event | Animation |
|---|---|
| Cards dealt at hand start | Cards fly from a centre deck position to each seat (staggered, 50 ms apart) |
| Community card reveal | Individual card flips in sequence |
| Bet committed | Chip stack slides from seat toward pot |
| Pot awarded | Chip stack slides from pot to winner seat |
| Bot thinking | Pulsing ring on active bot avatar |
| Action panel | Slides up from below screen edge |
| Showdown card reveal | All hole cards flip face-up simultaneously |

### 6.6 Leaderboard (`/leaderboard`)

- Dark background, accent table with rank medals (gold/silver/bronze for top 3).
- Navigation bar consistent with lobby.

---

## 7. Codebase Architecture

### 7.1 Directory Structure

```
poker/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── game/
│   │   └── [sessionId]/
│   │       └── page.tsx            # client component; full game UI
│   ├── leaderboard/
│   │   └── page.tsx                # server component; DB fetch
│   ├── api/
│   │   └── auth/[...nextauth]/route.ts
│   ├── layout.tsx                  # daily reward check + nav
│   └── page.tsx                    # lobby (server component)
│
├── components/
│   ├── game/
│   │   ├── PokerTable.tsx          # table ellipse + seat layout
│   │   ├── PlayerSeat.tsx          # individual seat (avatar, chips, bet)
│   │   ├── CommunityCards.tsx      # flop/turn/river reveal
│   │   ├── Card.tsx                # single card component (face up/down)
│   │   ├── ActionPanel.tsx         # fold/call/bet UI
│   │   ├── BetControls.tsx         # slider + quick-bet buttons
│   │   ├── PotDisplay.tsx          # pot chip animation
│   │   └── HandResult.tsx          # showdown overlay
│   ├── lobby/
│   │   ├── TierCard.tsx
│   │   └── PlayerCountStepper.tsx
│   └── ui/
│       ├── Button.tsx
│       ├── Toast.tsx
│       └── Navbar.tsx
│
├── lib/
│   ├── db/
│   │   ├── schema.ts               # Drizzle schema definition
│   │   └── index.ts                # NeonDB + Drizzle client
│   ├── game/
│   │   ├── deck.ts                 # buildAndShuffleDeck()
│   │   ├── bots.ts                 # takeBotAction()
│   │   ├── constants.ts            # TIERS config (blinds, buy-ins)
│   │   └── solver.ts               # pokersolver wrapper helpers
│   ├── actions/
│   │   ├── balance.ts              # server actions: deduct, credit
│   │   └── user.ts                 # server actions: daily reward
│   └── auth.ts                     # NextAuth config
│
├── drizzle.config.ts
├── middleware.ts                   # route protection (must be logged in)
└── package.json
```

### 7.2 Game State Shape

The client-side game state (`useReducer` or `useState`) wraps the `poker-ts` table and adds UI-layer data:

```typescript
interface GameState {
  table: Poker.Table;           // poker-ts instance (not serialisable; lives in a ref)
  phase: 'waiting' | 'betting' | 'showdown' | 'hand_over' | 'session_over';
  round: 'preflop' | 'flop' | 'turn' | 'river';
  deck: Card[];                 // full 52-card predetermined deck
  communityCards: Card[];       // cards revealed so far (0–5)
  holeCards: (Card[] | null)[]; // indexed by seat; null if seat empty
  seats: SeatState[];           // chip count, current bet, status
  pot: number;                  // total pot (all side pots summed for display)
  currentBet: number;           // highest bet this round
  lastRaiseDelta: number;       // minimum raise increment
  winners: WinnerInfo[] | null; // populated at showdown
  userSeat: number;             // always 0
}
```

The `poker-ts` Table instance lives in a `useRef` to avoid React re-render churn while the rest of the state drives the UI.

---

## 8. API & Server Actions

All DB mutations are Next.js Server Actions (no REST API needed).

### `lib/actions/balance.ts`

```typescript
'use server';

// Called when user commits a bet or call
export async function deductBalance(userId: string, amount: number): Promise<void>

// Called when user wins a pot or leaves the table
export async function creditBalance(userId: string, amount: number): Promise<void>

// Called at game start; atomic deduct of buy-in
export async function deductBuyIn(userId: string, buyIn: number): Promise<{ success: boolean; newBalance: number }>
```

### `lib/actions/user.ts`

```typescript
'use server';

// Called from root layout on each authenticated load
export async function applyDailyReward(userId: string): Promise<{ rewarded: boolean }>

// Called on registration
export async function createUser(data: RegisterFormData): Promise<{ success: boolean; error?: string }>
```

### Auth Routes

`app/api/auth/[...nextauth]/route.ts` — standard NextAuth.js Credentials handler with `bcryptjs.compare`.

---

## 9. Key Implementation Notes

### 9.1 poker-ts Integration: Custom Deck

`poker-ts` internally handles its own dealing. To use a predetermined deck, intercept the hole cards after `startHand()` and overlay them with the manually shuffled deck's assignments. Alternatively, the library's `holeCards()` output can be ignored in favour of manually tracking which cards map to which seat, using the shuffled deck array. Community cards are always revealed manually by the UI layer (the library tracks rounds, but card rendering is driven by your `deck` array).

The recommended approach:
- Use `poker-ts` purely for **state machine logic** (whose turn, legal actions, pot math, all-in detection).
- Use your own `deck` array for **all card rendering** (hole cards and community cards are sliced from `deck` at predetermined indices).
- Use `pokersolver` for hand evaluation at showdown, feeding it cards from your `deck`.

### 9.2 Raise Semantics

The user always inputs the **total bet size**, not the raise increment. When calling `table.actionTaken('raise', totalAmount)`, the library internally computes the delta. Ensure the slider's `min` value is clamped to `legalActions().chipRange.min` (which is already total-amount-based in poker-ts).

### 9.3 Side Pots Display

In the `PotDisplay`, iterate `table.pots()` to render separate pot chips when multiple pots exist. Label side pots clearly (e.g. "Side Pot: 300"). At showdown, resolve each pot independently using `pokersolver` against its eligible seat subset.

### 9.4 Big Blind Option (Pre-flop)

After all pre-flop players have called the BB, `poker-ts` correctly surfaces `check` and `raise` as legal actions for the BB seat — this is the "BB option". The bot at BB will simply check (per v1 strategy). Ensure the user's action panel reflects this correctly if the user is in BB.

### 9.5 Hand History for Folded Players

Store hole cards in local React state from the moment they are dealt. After a player folds, their `table.holeCards()[seat]` returns `null` in poker-ts. Use the locally saved state to continue displaying the user's folded cards (faded) for the remainder of the hand.

### 9.6 Preventing Balance from Going Negative

Before processing a user bet server action, verify on the server:
```
new_balance = current_balance - amount
if new_balance < 0: reject action
```
In practice, the client should never send an amount exceeding the user's stack (poker-ts enforces this via `chipRange.max`), but server-side validation is the safety net.

### 9.7 Environment Variables

```env
DATABASE_URL=          # Neon connection string (pooled)
NEXTAUTH_SECRET=       # random 32-byte secret
NEXTAUTH_URL=          # e.g. https://yourapp.vercel.app
```

---

## 10. Out of Scope (v1)

The following are explicitly deferred to future versions:

- Real-money or cryptocurrency integration
- Multiplayer (real players vs. real players)
- Bot difficulty tiers (advanced AI strategies)
- Hand history / replay viewer
- Chat
- Achievements / badges
- Mobile-native app
- Reconnect/resume a disconnected game session
- Customisable avatars
- Tournament mode

---

*Sources:*
- *[Texas Hold'em Rules — PokerNews](https://www.pokernews.com/poker-rules/texas-holdem.htm)*
- *[Betting Rules — Upswing Poker](https://upswingpoker.com/betting-rules/)*
- *[Texas Hold'em — Wikipedia](https://en.wikipedia.org/wiki/Texas_hold_%27em)*
- *[poker-ts — GitHub](https://github.com/claudijo/poker-ts)*
- *[pokersolver — npm](https://www.npmjs.com/package/pokersolver)*
