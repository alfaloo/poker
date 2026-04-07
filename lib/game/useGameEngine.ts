'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { Table } from 'poker-ts';
import { cardToSolverString, Card } from './deck';
import { takeBotAction } from './bots';
import { evaluatePot } from './solver';
import { deductFromSession, creditToSession, cashOut as cashOutAction } from '@/lib/actions/balance';

type PokerTable = InstanceType<typeof Table>;

export interface SeatState {
  chips: number;
  currentBet: number;
  status: 'active' | 'folded' | 'all-in' | 'empty';
}

export interface WinnerInfo {
  seat: number;
  amount: number;
  handName?: string;
}

export interface GameState {
  phase: 'waiting' | 'betting' | 'showdown' | 'hand_over' | 'session_over';
  round: 'preflop' | 'flop' | 'turn' | 'river';
  communityCards: Card[];
  holeCards: (Card[] | null)[];
  seats: SeatState[];
  pot: number;
  currentBet: number;
  lastRaiseDelta: number;
  winners: WinnerInfo[] | null;
  isFoldWin: boolean;
  showdownSeats: number[] | null;
  allHandNames: Record<number, string> | null;
  userSeat: 0;
  dealerSeat: number;
  isPending: boolean;
  actionError: string | null;
}

export interface UseGameEngineProps {
  smallBlind: number;
  bigBlind: number;
  buyIn: number;
  numPlayers: number;
  sessionId: string;
  userId: string;
  initialSessionStack: number;
}

function buildSeatsState(table: PokerTable): SeatState[] {
  const handPlayers = table.isHandInProgress() ? table.handPlayers() : null;
  return table.seats().map((seat, i) => {
    if (seat === null) {
      return { chips: 0, currentBet: 0, status: 'empty' as const };
    }
    // A player is absent from handPlayers if they have folded OR gone all-in
    // (both leave the betting round). Distinguish by stack: all-in players
    // have 0 remaining stack while folded players still have chips.
    const isAbsent = handPlayers !== null && handPlayers[i] === null;
    if (isAbsent) {
      const status = seat.stack === 0 ? 'all-in' as const : 'folded' as const;
      return { chips: seat.stack, currentBet: seat.betSize, status };
    }
    return {
      chips: seat.stack,
      currentBet: seat.betSize,
      status: 'active' as const,
    };
  });
}

function computePot(table: PokerTable): number {
  return table.pots().reduce((sum, pot) => sum + pot.size, 0);
}

export function useGameEngine({
  smallBlind,
  bigBlind,
  buyIn,
  numPlayers,
  sessionId,
  userId,
  initialSessionStack,
}: UseGameEngineProps) {
  const tableRef = useRef<PokerTable | null>(null);
  const processingRef = useRef(false);
  const unmountedRef = useRef(false);
  const holeCardsRef = useRef<(Card[] | null)[]>(Array(numPlayers).fill(null));
  // Accumulated eligible-player sets per pot index, updated after each endBettingRound.
  // Workaround for a poker-ts bug: when a betting round has no bets (everyone checks),
  // Pot.collectBetsFrom() resets eligiblePlayers to only the current _players — which
  // excludes all-in players who were removed from _players in a previous round.
  // By unioning each round's snapshot we preserve all-in players' eligibility.
  const potEligibilityRef = useRef<number[][]>([]);

  const [state, setState] = useState<GameState>({
    phase: 'waiting',
    round: 'preflop',
    communityCards: [],
    holeCards: Array(numPlayers).fill(null),
    seats: Array(numPlayers).fill({ chips: 0, currentBet: 0, status: 'empty' as const }),
    pot: 0,
    currentBet: 0,
    lastRaiseDelta: bigBlind,
    winners: null,
    isFoldWin: false,
    showdownSeats: null,
    allHandNames: null,
    userSeat: 0,
    dealerSeat: -1,
    isPending: false,
    actionError: null,
  });

  const syncTableState = useCallback((table: PokerTable, extraState: Partial<GameState> = {}) => {
    const seatsState = buildSeatsState(table);
    const pot = table.isHandInProgress() ? computePot(table) : 0;
    const currentBet = seatsState.reduce((max, s) => Math.max(max, s.currentBet), 0);
    const legalActions = (table.isHandInProgress() && table.isBettingRoundInProgress())
      ? table.legalActions()
      : { actions: [], chipRange: undefined };
    const lastRaiseDelta = legalActions.chipRange?.min ?? bigBlind;

    setState(prev => ({
      ...prev,
      seats: seatsState,
      pot,
      currentBet,
      lastRaiseDelta,
      ...extraState,
    }));
  }, [bigBlind]);

  const processNextStep = useCallback(async () => {
    if (processingRef.current || unmountedRef.current) return;
    const table = tableRef.current;
    if (!table || !table.isHandInProgress()) return;

    // --- Showdown ---
    if (table.areBettingRoundsCompleted()) {
      processingRef.current = true;
      try {
        // Read pots, hole cards, and community cards BEFORE calling showdown() —
        // showdown() sets handInProgress=false and these methods all assert
        // handInProgress() internally, so they must be captured first.
        const pots = table.pots();

        // Use accumulated eligibility (potEligibilityRef) instead of the raw
        // pot.eligiblePlayers — which poker-ts overwrites in no-bet rounds,
        // silently dropping all-in players who left the betting-round array.
        // Fall back to pot.eligiblePlayers only on the first hand where the ref
        // may not have been populated (shouldn't normally occur).
        const eligiblePerPot: number[][] = pots.map((pot, idx) =>
          potEligibilityRef.current[idx] ?? pot.eligiblePlayers
        );

        const isFoldWin = eligiblePerPot.every(ep => ep.length <= 1);
        const tableHoleCards = table.holeCards() as (Card[] | null)[];
        const communityCardsFull = table.communityCards() as Card[];
        holeCardsRef.current = tableHoleCards;

        // Snapshot seats BEFORE showdown() — poker-ts internally calls
        // standUpBustedPlayers() which nulls out 0-chip seats, making
        // all-in players who lost vanish from buildSeatsState reads.
        const seatsSnapshot = buildSeatsState(table);

        table.showdown();
        if (unmountedRef.current) return;

        const winnerInfos: WinnerInfo[] = [];
        const commStrings = communityCardsFull.map(cardToSolverString);

        // Collect all non-folded seats across all pots (for showdown reveal).
        // Filter out players whose snapshot status is 'folded' — potEligibilityRef
        // unions across rounds and can retain post-flop folders who were eligible
        // in earlier streets, so we must exclude them explicitly.
        const showdownSeatsSet: Record<number, true> = {};
        for (const ep of eligiblePerPot) {
          for (const seat of ep) showdownSeatsSet[seat] = true;
        }
        const showdownSeats = Object.keys(showdownSeatsSet)
          .map(Number)
          .filter(i => seatsSnapshot[i]?.status !== 'folded');

        // Evaluate hand names for every seat still in the hand
        const allHoleCardsBySeat: Record<number, string[]> = {};
        for (const seat of showdownSeats) {
          const cards = tableHoleCards[seat];
          if (cards) allHoleCardsBySeat[seat] = cards.map(cardToSolverString);
        }
        const { handNames: allHandNames } = isFoldWin
          ? { handNames: {} as Record<number, string> }
          : evaluatePot(showdownSeats, allHoleCardsBySeat, commStrings);

        for (let potIdx = 0; potIdx < pots.length; potIdx++) {
          const pot = pots[potIdx];
          const eligibleSeats = eligiblePerPot[potIdx];
          const holeCardsBySeat: Record<number, string[]> = {};
          for (const seat of eligibleSeats) {
            const cards = tableHoleCards[seat];
            if (cards) {
              holeCardsBySeat[seat] = cards.map(cardToSolverString);
            }
          }
          const { winners, handNames } = isFoldWin
            ? { winners: eligibleSeats, handNames: {} as Record<number, string> }
            : evaluatePot(eligibleSeats, holeCardsBySeat, commStrings);
          const share = Math.floor(pot.size / winners.length);
          for (const w of winners) {
            winnerInfos.push({ seat: w, amount: share, handName: handNames[w] });
          }
        }

        // Credit user winnings to session
        const userWinAmount = winnerInfos
          .filter(w => w.seat === 0)
          .reduce((sum, w) => sum + w.amount, 0);

        if (userWinAmount > 0) {
          setState(prev => ({ ...prev, isPending: true, actionError: null }));
          try {
            await creditToSession(sessionId, userId, userWinAmount);
          } catch (e) {
            if (!unmountedRef.current) {
              setState(prev => ({
                ...prev,
                isPending: false,
                actionError: e instanceof Error ? e.message : 'Failed to credit winnings. Please retry.',
              }));
            }
            return;
          }
        }

        if (unmountedRef.current) return;

        // Build a per-seat win-amount map so we can show updated chips
        const winAmountBySeat: Record<number, number> = {};
        for (const w of winnerInfos) {
          winAmountBySeat[w.seat] = (winAmountBySeat[w.seat] ?? 0) + w.amount;
        }

        // Apply winnings to the pre-showdown snapshot so every seat (including
        // all-in players with 0 chips) remains visible with correct chip counts.
        const seatsForShowdown = seatsSnapshot.map((seat, i) => {
          const won = winAmountBySeat[i] ?? 0;
          return won > 0 ? { ...seat, chips: seat.chips + won } : seat;
        });

        // Reconcile poker-ts internal chip counts with our correct distribution.
        // poker-ts calls showdown() using its own (potentially buggy) eligiblePlayers,
        // which can give all chips to the wrong player and stand up winners who should
        // still be seated. This causes nextHand() to see numActive=1 and fire
        // session_over even when bots still have chips.
        for (let i = 0; i < seatsForShowdown.length; i++) {
          const correctChips = seatsForShowdown[i].chips;
          const tableSeat = table.seats()[i];
          if (correctChips > 0) {
            if (tableSeat === null) {
              // Incorrectly stood up — re-seat with correct chips
              table.sitDown(i, correctChips);
            } else if (tableSeat.totalChips !== correctChips) {
              // Wrong chip count — re-seat to fix
              table.standUp(i);
              table.sitDown(i, correctChips);
            }
          } else if (tableSeat !== null && tableSeat.totalChips === 0) {
            // Busted but not yet stood up
            table.standUp(i);
          }
        }

        syncTableState(table, {
          phase: 'showdown',
          seats: seatsForShowdown,
          communityCards: communityCardsFull,
          holeCards: [...holeCardsRef.current],
          winners: winnerInfos,
          isFoldWin,
          showdownSeats,
          allHandNames,
          isPending: false,
          actionError: null,
        });
      } finally {
        processingRef.current = false;
      }
      return;
    }

    // --- End of betting round ---
    if (!table.isBettingRoundInProgress()) {
      processingRef.current = true;
      try {
        table.endBettingRound();
        if (unmountedRef.current) return;

        // Accumulate eligible players per pot. poker-ts resets pot.eligiblePlayers
        // to only the current _players when a round has no bets, which silently
        // removes all-in players. Unioning across rounds preserves them.
        table.pots().forEach((pot, idx) => {
          const prev = potEligibilityRef.current[idx];
          if (!prev) {
            potEligibilityRef.current[idx] = [...pot.eligiblePlayers];
          } else {
            const union = new Set([...prev, ...pot.eligiblePlayers]);
            potEligibilityRef.current[idx] = Array.from(union);
          }
        });

        // If the river just finished, all betting rounds are complete —
        // let the showdown branch at the top of this function handle it.
        if (table.areBettingRoundsCompleted()) {
          setTimeout(() => processNextStep(), 0);
          return;
        }

        const round = table.roundOfBetting();
        // Use the actual community cards poker-ts dealt for this round
        const newCommunityCards = table.communityCards() as Card[];

        syncTableState(table, {
          round,
          communityCards: newCommunityCards,
          holeCards: [...holeCardsRef.current],
        });
      } finally {
        processingRef.current = false;
      }

      setTimeout(() => processNextStep(), 0);
      return;
    }

    // --- Betting round in progress ---
    const actingSeat = table.playerToAct();

    if (actingSeat === 0) {
      syncTableState(table, {
        phase: 'betting',
        holeCards: [...holeCardsRef.current],
      });
      return;
    }

    // Bot's turn — show the bot as active (pulsing) for 1.2 s before it acts
    processingRef.current = true;
    syncTableState(table, { phase: 'waiting', holeCards: [...holeCardsRef.current] });
    try {
      await new Promise<void>(resolve => setTimeout(resolve, 1200));
      if (unmountedRef.current) return;
      await takeBotAction(table);
    } finally {
      processingRef.current = false;
    }

    if (!unmountedRef.current) {
      processNextStep();
    }
  }, [sessionId, userId, syncTableState]);

  const startHand = useCallback(() => {
    const table = tableRef.current;
    if (!table) return;

    potEligibilityRef.current = [];
    table.startHand();

    // Read hole cards dealt by poker-ts's internal deck — this is the source of
    // truth and must match what the library uses for hand evaluation.
    const holeCards = table.holeCards() as (Card[] | null)[];
    holeCardsRef.current = holeCards;

    const round = table.roundOfBetting();
    const dealerSeat = table.button();
    syncTableState(table, {
      phase: 'waiting',
      round,
      communityCards: [],
      holeCards,
      winners: null,
      isFoldWin: false,
      showdownSeats: null,
      allHandNames: null,
      dealerSeat,
      isPending: false,
      actionError: null,
    });

    setTimeout(() => processNextStep(), 0);
  }, [syncTableState, processNextStep]);

  useEffect(() => {
    unmountedRef.current = false;
    processingRef.current = false;
    const table = new Table({ smallBlind, bigBlind }, numPlayers);
    tableRef.current = table;

    table.sitDown(0, initialSessionStack);
    for (let i = 1; i < numPlayers; i++) {
      table.sitDown(i, buyIn);
    }

    startHand();

    return () => {
      unmountedRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const performAction = useCallback(async (
    action: 'fold' | 'check' | 'call' | 'bet' | 'raise',
    amount?: number
  ) => {
    const table = tableRef.current;
    if (!table) return;
    if (table.playerToAct() !== 0) return;

    // Compute the amount to deduct from session for monetary actions
    let deductAmount: number | null = null;

    if (action === 'call') {
      const seats = table.seats();
      const maxBet = seats.reduce((max, s) => (s !== null ? Math.max(max, s.betSize) : max), 0);
      const userCurrentBet = seats[0]?.betSize ?? 0;
      const userStack = seats[0]?.stack ?? 0;
      const callDiff = maxBet - userCurrentBet;
      deductAmount = Math.min(callDiff, userStack);
    } else if ((action === 'bet' || action === 'raise') && amount !== undefined) {
      const seats = table.seats();
      const userCurrentBet = seats[0]?.betSize ?? 0;
      deductAmount = amount - userCurrentBet;
    }

    // Persist the monetary action before advancing the game state
    if (deductAmount !== null && deductAmount > 0) {
      setState(prev => ({ ...prev, isPending: true, actionError: null }));
      try {
        await deductFromSession(sessionId, userId, deductAmount);
      } catch (e) {
        setState(prev => ({
          ...prev,
          isPending: false,
          actionError: e instanceof Error ? e.message : 'Failed to persist action. Please retry.',
        }));
        return; // Do not advance game state
      }
    }

    if (unmountedRef.current) return;

    if (action === 'bet' || action === 'raise') {
      table.actionTaken(action, amount);
    } else {
      table.actionTaken(action);
    }

    syncTableState(table, {
      phase: 'waiting',
      holeCards: [...holeCardsRef.current],
      isPending: false,
      actionError: null,
    });
    setTimeout(() => processNextStep(), 0);
  }, [sessionId, userId, syncTableState, processNextStep]);

  const nextHand = useCallback(() => {
    const table = tableRef.current;
    if (!table) return;

    // Stand up busted players
    table.seats().forEach((seat, i) => {
      if (seat !== null && seat.totalChips === 0) {
        table.standUp(i);
      }
    });

    const userSeat = table.seats()[0];
    // numActivePlayers() asserts handInProgress(), so count from seats directly.
    const numActive = table.seats().filter(s => s !== null).length;

    if (!userSeat || userSeat.totalChips === 0) {
      setState(prev => ({ ...prev, phase: 'session_over' }));
      return;
    }

    if (numActive <= 1) {
      setState(prev => ({ ...prev, phase: 'session_over' }));
      return;
    }

    startHand();
  }, [startHand]);

  const acknowledgeShowdown = useCallback(() => {
    setState(prev =>
      prev.phase === 'showdown' ? { ...prev, phase: 'hand_over' } : prev
    );
  }, []);

  const leaveTable = useCallback(async (): Promise<{ finalBalance: number }> => {
    setState(prev => ({ ...prev, isPending: true, actionError: null }));
    try {
      const result = await cashOutAction(sessionId, userId);
      if (!unmountedRef.current) {
        setState(prev => ({ ...prev, phase: 'session_over', isPending: false }));
      }
      return result;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Failed to cash out. Please retry.';
      if (!unmountedRef.current) {
        setState(prev => ({ ...prev, isPending: false, actionError: errorMsg }));
      }
      throw e;
    }
  }, [sessionId, userId]);

  const getLegalActions = useCallback(() => {
    const table = tableRef.current;
    if (!table || !table.isHandInProgress()) return { actions: [] as const, chipRange: undefined };
    return table.legalActions();
  }, []);

  const getButtonSeat = useCallback((): number => {
    const table = tableRef.current;
    if (!table || !table.isHandInProgress()) return -1;
    return table.button();
  }, []);

  const getActingSeat = useCallback((): number => {
    const table = tableRef.current;
    if (!table || !table.isHandInProgress() || !table.isBettingRoundInProgress()) return -1;
    return table.playerToAct();
  }, []);

  return {
    state,
    performAction,
    nextHand,
    acknowledgeShowdown,
    leaveTable,
    getLegalActions,
    getButtonSeat,
    getActingSeat,
  };
}
