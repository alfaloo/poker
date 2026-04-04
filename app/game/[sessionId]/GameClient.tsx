'use client';

import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import { useGameEngine } from '@/lib/game/useGameEngine';
import PokerTable, { SeatData } from '@/components/game/PokerTable';
import HandResult from '@/components/game/HandResult';
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
    acknowledgeShowdown,
    leaveTable,
    getLegalActions,
    getButtonSeat,
  } = useGameEngine({
    smallBlind,
    bigBlind,
    buyIn,
    numPlayers,
    sessionId,
    userId,
    initialSessionStack,
  });

  const { phase, seats, holeCards, communityCards, pot, currentBet, winners, isFoldWin, isPending, actionError } =
    state;

  // ── Seat names ─────────────────────────────────────────────────────────────
  const seatName = (i: number) =>
    i === 0 ? username : BOT_NAMES[i - 1] ?? `Bot ${i}`;

  // ── Dealer / blind positions ────────────────────────────────────────────────
  const buttonSeat = getButtonSeat();
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

  // ── Seat data for PokerTable ────────────────────────────────────────────────
  const seatsData: SeatData[] = seats.map((seat, i) => ({
    seat: i,
    username: seatName(i),
    chips: seat.chips,
    currentBet: seat.currentBet,
    previousBet: 0,
    isActive: phase === 'betting' && i === 0,
    isDealer: i === buttonSeat,
    isSmallBlind: i === sbSeat,
    isBigBlind: i === bbSeat,
    isFolded: seat.status === 'folded',
    isBot: i !== 0,
    cards: holeCards[i] ?? null,
    isEmpty: seat.status === 'empty',
  }));

  // ── Winner seat for pot-slide animation ────────────────────────────────────
  const winnerSeatIndex = winners && winners.length === 1 ? winners[0].seat : null;

  // ── HandResult data ────────────────────────────────────────────────────────
  const handResultWinners =
    winners?.map((w) => ({
      seat: w.seat,
      username: seatName(w.seat),
      handName: w.handName ?? '',
      amount: w.amount,
    })) ?? [];

  const allSeatsInHand = seats
    .map((s, i) => ({ s, i }))
    .filter(({ s, i }) => s.status !== 'empty' && holeCards[i] !== null)
    .map(({ i }) => ({
      seat: i,
      username: seatName(i),
      cards: holeCards[i] as CardType[],
      handName:
        winners?.find((w) => w.seat === i)?.handName ?? '',
    }));

  // ── Leave table handler ────────────────────────────────────────────────────
  const handleLeaveTable = async () => {
    try {
      await leaveTable();
      router.push('/');
    } catch {
      // actionError is set by the engine; UI shows it
    }
  };

  // ── Action to pass to ActionPanel ─────────────────────────────────────────
  const handleBet = (amount: number) => {
    const action = legalActionsList.includes('raise') ? 'raise' : 'bet';
    performAction(action, amount);
  };

  // ── Session over screen ────────────────────────────────────────────────────
  if (phase === 'session_over') {
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
        <Button variant="primary" onClick={() => router.push('/')}>
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
        winnerSeatIndex={winnerSeatIndex}
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

      {/* HandResult overlay: visible during showdown */}
      <AnimatePresence>
        {phase === 'showdown' && winners !== null && (
          <HandResult
            winners={handResultWinners}
            allSeatsInHand={allSeatsInHand}
            isFoldWin={isFoldWin}
            onContinue={acknowledgeShowdown}
            onLeave={handleLeaveTable}
          />
        )}
      </AnimatePresence>

      {/* Between-hand controls: visible during hand_over */}
      <AnimatePresence>
        {phase === 'hand_over' && (
          <div className="fixed inset-0 z-40 flex items-end justify-center pb-12 pointer-events-none">
            <div className="flex gap-4 pointer-events-auto">
              <Button variant="primary" onClick={nextHand} disabled={isPending}>
                Next Hand
              </Button>
              <Button
                variant="secondary"
                onClick={handleLeaveTable}
                disabled={isPending}
              >
                Leave Table
              </Button>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
