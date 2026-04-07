'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import { useGameEngine } from '@/lib/game/useGameEngine';
import PokerTable, { SeatData } from '@/components/game/PokerTable';
import ActionPanel from '@/components/game/ActionPanel';
import Button from '@/components/ui/Button';
import type { Card as CardType } from '@/lib/game/deck';

const BOT_NAMES = [
  'Bot Alpha',
  'Bot Beta',
  'Bot Gamma',
  'Bot Delta',
  'Bot Epsilon',
  'Bot Zeta',
  'Bot Eta',
];

interface GameClientProps {
  sessionId: string;
  userId: string;
  username: string;
  smallBlind: number;
  bigBlind: number;
  buyIn: number;
  numPlayers: number;
  initialSessionStack: number;
}

export default function GameClient({
  sessionId,
  userId,
  username,
  smallBlind,
  bigBlind,
  buyIn,
  numPlayers,
  initialSessionStack,
}: GameClientProps) {
  const router = useRouter();

  const {
    state,
    performAction,
    nextHand,
    leaveTable,
    getLegalActions,
    getActingSeat,
  } = useGameEngine({
    smallBlind,
    bigBlind,
    buyIn,
    numPlayers,
    sessionId,
    userId,
    initialSessionStack,
  });

  const { phase, seats, holeCards, communityCards, pot, currentBet, winners, isFoldWin, showdownSeats, allHandNames, isPending, actionError, dealerSeat } =
    state;

  // ── Prompt visibility (appears after card flip animations settle) ─────────
  const [promptVisible, setPromptVisible] = useState(false);

  useEffect(() => {
    if (phase !== 'showdown' || isFoldWin) {
      setPromptVisible(false);
      return;
    }
    // 700ms: enough for the faceDown→faceUp flip animation (300ms) + buffer
    const t = setTimeout(() => setPromptVisible(true), 700);
    return () => clearTimeout(t);
  }, [phase, isFoldWin]);

  // ── Auto-advance fold wins after 1.5 s ───────────────────────────────────
  useEffect(() => {
    if (phase !== 'showdown' || !isFoldWin) return;
    const t = setTimeout(() => nextHand(), 1500);
    return () => clearTimeout(t);
  }, [phase, isFoldWin, nextHand]);

  // ── Keydown → next hand ──────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'showdown' || isFoldWin || !promptVisible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      nextHand();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, isFoldWin, promptVisible, nextHand]);

  // ── Seat names ─────────────────────────────────────────────────────────────
  const seatName = (i: number) =>
    i === 0 ? username : BOT_NAMES[i - 1] ?? `Bot ${i}`;

  // ── Dealer / blind positions ────────────────────────────────────────────────
  // Use dealerSeat from state (captured at hand start) so positions persist
  // through showdown when isHandInProgress() is false and getButtonSeat() returns -1.
  const buttonSeat = dealerSeat;
  const nonEmptyIndices = seats
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.status !== 'empty')
    .map(({ i }) => i);

  const buttonIdx = nonEmptyIndices.indexOf(buttonSeat);
  const isHeadsUp = nonEmptyIndices.length === 2;
  const sbIdx = isHeadsUp ? buttonIdx : (buttonIdx + 1) % nonEmptyIndices.length;
  const bbIdx = isHeadsUp
    ? (buttonIdx + 1) % nonEmptyIndices.length
    : (buttonIdx + 2) % nonEmptyIndices.length;
  const sbSeat = nonEmptyIndices[sbIdx] ?? -1;
  const bbSeat = nonEmptyIndices[bbIdx] ?? -1;

  // ── Legal actions for ActionPanel ──────────────────────────────────────────
  const legalActions = phase === 'betting' ? getLegalActions() : { actions: [], chipRange: undefined };
  const legalActionsList = legalActions.actions as string[];
  const chipRangeMin = legalActions.chipRange?.min ?? bigBlind;
  const chipRangeMax = legalActions.chipRange?.max ?? initialSessionStack;

  const maxBet = seats.reduce((max, s) => Math.max(max, s.currentBet), 0);
  const userCurrentBet = seats[0]?.currentBet ?? 0;
  const callAmount = Math.max(0, maxBet - userCurrentBet);

  // ── Community cards padded to length 5 ─────────────────────────────────────
  const communityCardsPadded: (CardType | null)[] = Array(5)
    .fill(null)
    .map((_, i) => communityCards[i] ?? null);

  // ── Pot display ────────────────────────────────────────────────────────────
  const potsDisplay = [{ amount: pot, label: 'Pot' }];
  const roundBet = seats.reduce((sum, s) => sum + s.currentBet, 0);

  // ── Winner set for quick lookup ─────────────────────────────────────────────
  const winnerSeats = new Set(winners?.map(w => w.seat) ?? []);
  const userIsWinner = winnerSeats.has(0);

  // ── Cards to show per seat ─────────────────────────────────────────────────
  // At showdown, reveal cards for all seats still in the hand (showdownSeats).
  // Folded seats and bots during play remain face-down (cards = null).
  const cardsForSeat = (i: number): CardType[] | null => {
    // User always sees their own hole cards
    if (i === 0) return holeCards[i] ?? null;
    // At showdown, reveal non-folded bot seats (those eligible in the pots)
    if (phase === 'showdown' && showdownSeats?.includes(i)) return holeCards[i] ?? null;
    return null;
  };

  // ── Seat data for PokerTable ────────────────────────────────────────────────
  const seatsData: SeatData[] = seats.map((seat, i) => ({
    seat: i,
    username: seatName(i),
    chips: seat.chips,
    currentBet: seat.currentBet,
    previousBet: 0,
    isActive: getActingSeat() === i,
    isDealer: i === buttonSeat,
    isSmallBlind: i === sbSeat,
    isBigBlind: i === bbSeat,
    // seat.status is reliable in all phases: during play buildSeatsState derives
    // it from handPlayers(), and at showdown seatsForShowdown preserves the
    // pre-showdown snapshot where folded players retain status 'folded'.
    isFolded: seat.status === 'folded',
    isAllIn: seat.status === 'all-in',
    isBot: i !== 0,
    cards: cardsForSeat(i),
    isEmpty: seat.status === 'empty',
    isWinner: phase === 'showdown' ? winnerSeats.has(i) : undefined,
    handName: phase === 'showdown' ? (allHandNames?.[i] ?? '') : undefined,
    isUserWinner: phase === 'showdown' && userIsWinner && i === 0,
  }));

  // ── Winner seat for pot-slide animation ────────────────────────────────────
  const winnerSeatIndex = winners && winners.length === 1 ? winners[0].seat : null;

  // ── Leave table handler ────────────────────────────────────────────────────
  const [isLeaving, setIsLeaving] = useState(false);

  const handleLeaveTable = async () => {
    setIsLeaving(true);
    try {
      await leaveTable();
      // refresh() busts the Next.js router cache so the lobby re-fetches the
      // updated balance from the DB instead of serving a stale cached page.
      router.refresh();
      router.push('/');
    } catch {
      setIsLeaving(false);
      // actionError is set by the engine; UI shows it
    }
  };

  // ── Action to pass to ActionPanel ─────────────────────────────────────────
  const handleBet = (amount: number) => {
    const action = legalActionsList.includes('raise') ? 'raise' : 'bet';
    performAction(action, amount);
  };

  // ── Session over screen ────────────────────────────────────────────────────
  if (phase === 'session_over' && !isLeaving) {
    const userWon = (seats[0]?.chips ?? 0) > 0;
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-8">
        <div className="text-center">
          <h1
            className={`text-5xl font-bold mb-4 ${
              userWon ? 'text-amber-400' : 'text-red-400'
            }`}
          >
            {userWon ? 'You win!' : "You're out."}
          </h1>
          <p className="text-gray-400 text-lg">
            {userWon
              ? 'You outlasted all the bots!'
              : 'Better luck next time.'}
          </p>
        </div>
        <Button variant="primary" onClick={handleLeaveTable}>
          Return to Lobby
        </Button>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gray-950">
      <PokerTable
        seats={seatsData}
        communityCards={communityCardsPadded}
        pots={potsDisplay}
        roundBet={roundBet}
        winnerSeatIndex={winnerSeatIndex}
        onTableClick={phase === 'showdown' && !isFoldWin && promptVisible ? nextHand : undefined}
        showCashoutButton={phase === 'showdown'}
        onCashout={handleLeaveTable}
        showContinuePrompt={promptVisible && !isFoldWin}
      >
        {/* Action panel: visible when it is the user's turn */}
        <AnimatePresence>
          {phase === 'betting' && (
            <ActionPanel
              legalActions={legalActionsList}
              callAmount={callAmount}
              chipRangeMin={chipRangeMin}
              chipRangeMax={chipRangeMax}
              pot={pot}
              smallBlind={smallBlind}
              currentBet={currentBet}
              isPending={isPending}
              actionError={actionError}
              onFold={() => performAction('fold')}
              onCheck={() => performAction('check')}
              onCall={() => performAction('call')}
              onBet={handleBet}
            />
          )}
        </AnimatePresence>
      </PokerTable>
    </div>
  );
}
