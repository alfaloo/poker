'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { Table } from 'poker-ts';
import { buildAndShuffleDeck, cardToSolverString, Card } from './deck';
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
  deck: Card[];
  communityCards: Card[];
  holeCards: (Card[] | null)[];
  seats: SeatState[];
  pot: number;
  currentBet: number;
  lastRaiseDelta: number;
  winners: WinnerInfo[] | null;
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

function dealHoleCards(
  deck: Card[],
  buttonSeat: number,
  numSeats: number,
  occupiedSeats: number[]
): (Card[] | null)[] {
  const N = occupiedSeats.length;
  const dealOrder = [...occupiedSeats].sort((a, b) => {
    const relA = (a - buttonSeat - 1 + numSeats) % numSeats;
    const relB = (b - buttonSeat - 1 + numSeats) % numSeats;
    return relA - relB;
  });

  const holeCards: (Card[] | null)[] = Array(numSeats).fill(null);
  dealOrder.forEach((seat, i) => {
    holeCards[seat] = [deck[i], deck[N + i]];
  });
  return holeCards;
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
  const deckRef = useRef<Card[]>([]);
  const holeCardsRef = useRef<(Card[] | null)[]>(Array(numPlayers).fill(null));
  const handOccupiedCountRef = useRef(0);

  const [state, setState] = useState<GameState>({
    phase: 'waiting',
    round: 'preflop',
    deck: [],
    communityCards: [],
    holeCards: Array(numPlayers).fill(null),
    seats: Array(numPlayers).fill({ chips: 0, currentBet: 0, status: 'empty' as const }),
    pot: 0,
    currentBet: 0,
    lastRaiseDelta: bigBlind,
    winners: null,
    userSeat: 0,
    isPending: false,
    actionError: null,
  });

  const syncTableState = useCallback((table: PokerTable, extraState: Partial<GameState> = {}) => {
    const seatsState = buildSeatsState(table);
    const pot = computePot(table);
    const currentBet = seatsState.reduce((max, s) => Math.max(max, s.currentBet), 0);
    const legalActions = table.isHandInProgress() ? table.legalActions() : { actions: [], chipRange: undefined };
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
        table.showdown();
        if (unmountedRef.current) return;

        const communityStart = 2 * handOccupiedCountRef.current;
        const fullDeck = deckRef.current;
        const communityCardsFull: Card[] = [
          fullDeck[communityStart],
          fullDeck[communityStart + 1],
          fullDeck[communityStart + 2],
          fullDeck[communityStart + 3],
          fullDeck[communityStart + 4],
        ];

        const pots = table.pots();
        const winnerInfos: WinnerInfo[] = [];

        for (const pot of pots) {
          const eligibleSeats = pot.eligiblePlayers;
          const holeCardsBySeat: Record<number, string[]> = {};
          for (const seat of eligibleSeats) {
            const cards = holeCardsRef.current[seat];
            if (cards) {
              holeCardsBySeat[seat] = cards.map(cardToSolverString);
            }
          }
          const commStrings = communityCardsFull.map(cardToSolverString);
          const { winners, handNames } = evaluatePot(eligibleSeats, holeCardsBySeat, commStrings);
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

        const round = table.roundOfBetting();
        const communityStart = 2 * handOccupiedCountRef.current;
        const fullDeck = deckRef.current;

        let newCommunityCards: Card[];
        if (round === 'flop') {
          newCommunityCards = [
            fullDeck[communityStart],
            fullDeck[communityStart + 1],
            fullDeck[communityStart + 2],
          ];
        } else if (round === 'turn') {
          newCommunityCards = [
            fullDeck[communityStart],
            fullDeck[communityStart + 1],
            fullDeck[communityStart + 2],
            fullDeck[communityStart + 3],
          ];
        } else {
          newCommunityCards = [
            fullDeck[communityStart],
            fullDeck[communityStart + 1],
            fullDeck[communityStart + 2],
            fullDeck[communityStart + 3],
            fullDeck[communityStart + 4],
          ];
        }

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
      await takeBotAction(table, actingSeat);
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

    const deck = buildAndShuffleDeck();
    deckRef.current = deck;

    table.startHand();

    const buttonSeat = table.button();
    const occupiedSeats = table.seats()
      .map((s, i) => (s !== null ? i : -1))
      .filter(i => i !== -1);

    handOccupiedCountRef.current = occupiedSeats.length;

    const holeCards = dealHoleCards(deck, buttonSeat, numPlayers, occupiedSeats);
    holeCardsRef.current = holeCards;

    const round = table.roundOfBetting();
    syncTableState(table, {
      phase: 'waiting',
      round,
      deck,
      communityCards: [],
      holeCards,
      winners: null,
      isPending: false,
      actionError: null,
    });

    setTimeout(() => processNextStep(), 0);
  }, [numPlayers, syncTableState, processNextStep]);

  useEffect(() => {
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
    const numActive = table.numActivePlayers();

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
    return tableRef.current?.button() ?? -1;
  }, []);

  return {
    state,
    performAction,
    nextHand,
    acknowledgeShowdown,
    leaveTable,
    getLegalActions,
    getButtonSeat,
  };
}
