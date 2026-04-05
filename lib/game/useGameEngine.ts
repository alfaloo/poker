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
  return table.seats().map(seat => {
    if (seat === null) {
      return { chips: 0, currentBet: 0, status: 'empty' as const };
    }
    return { chips: seat.stack, currentBet: seat.betSize, status: 'active' as const };
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
        const isFoldWin = pots.every(pot => pot.eligiblePlayers.length <= 1);
        const tableHoleCards = table.holeCards() as (Card[] | null)[];
        const communityCardsFull = table.communityCards() as Card[];
        holeCardsRef.current = tableHoleCards;

        table.showdown();
        if (unmountedRef.current) return;

        const winnerInfos: WinnerInfo[] = [];
        const commStrings = communityCardsFull.map(cardToSolverString);

        // Collect all non-folded seats across all pots (for showdown reveal)
        const showdownSeatsSet: Record<number, true> = {};
        for (const pot of pots) {
          for (const seat of pot.eligiblePlayers) showdownSeatsSet[seat] = true;
        }
        const showdownSeats = Object.keys(showdownSeatsSet).map(Number);

        // Evaluate hand names for every seat still in the hand
        const allHoleCardsBySeat: Record<number, string[]> = {};
        for (const seat of showdownSeats) {
          const cards = tableHoleCards[seat];
          if (cards) allHoleCardsBySeat[seat] = cards.map(cardToSolverString);
        }
        const { handNames: allHandNames } = isFoldWin
          ? { handNames: {} as Record<number, string> }
          : evaluatePot(showdownSeats, allHoleCardsBySeat, commStrings);

        for (const pot of pots) {
          const eligibleSeats = pot.eligiblePlayers;
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

        syncTableState(table, {
          phase: 'showdown',
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

    // Bot's turn
    processingRef.current = true;
    syncTableState(table, { phase: 'waiting', holeCards: [...holeCardsRef.current] });
    try {
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

    table.startHand();

    // Read hole cards dealt by poker-ts's internal deck — this is the source of
    // truth and must match what the library uses for hand evaluation.
    const holeCards = table.holeCards() as (Card[] | null)[];
    holeCardsRef.current = holeCards;

    const round = table.roundOfBetting();
    syncTableState(table, {
      phase: 'waiting',
      round,
      communityCards: [],
      holeCards,
      winners: null,
      isFoldWin: false,
      showdownSeats: null,
      allHandNames: null,
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
