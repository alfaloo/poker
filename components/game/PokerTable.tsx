'use client';

import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PlayerSeat from './PlayerSeat';
import CommunityCards from './CommunityCards';
import PotDisplay from './PotDisplay';
import { Card as CardType } from '@/lib/game/deck';

export interface SeatData {
  seat: number;
  username: string;
  chips: number;
  currentBet: number;
  previousBet: number;
  isActive: boolean;
  isDealer: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  isFolded: boolean;
  isBot: boolean;
  cards: CardType[] | null;
  isEmpty: boolean;
  isWinner?: boolean;
  handName?: string;
  isUserWinner?: boolean;
}

interface PokerTableProps {
  seats: SeatData[];
  communityCards: (CardType | null)[];
  pots: { amount: number; label: string }[];
  roundBet?: number;
  winnerSeatIndex?: number | null;
  /** When true, seats are shifted closer to centre so user cards clear the action panel. */
  actionPanelVisible?: boolean;
  children?: React.ReactNode;
  onTableClick?: () => void;
  showCashoutButton?: boolean;
  onCashout?: () => void;
  showContinuePrompt?: boolean;
}

/**
 * Computes (left%, top%) for seat i around an ellipse centred at (50%, 50%).
 * Seat 0 is always at the bottom centre (angle = π/2 in screen coords).
 * Subsequent seats go clockwise.
 */
function getSeatPosition(i: number, N: number, RX: number, RY: number) {
  const angle = Math.PI / 2 - (i / N) * 2 * Math.PI;
  return {
    left: 50 + RX * Math.cos(angle),
    top: 50 + RY * Math.sin(angle),
  };
}

export default function PokerTable({
  seats,
  communityCards,
  pots,
  roundBet,
  winnerSeatIndex,
  actionPanelVisible,
  children,
  onTableClick,
  showCashoutButton,
  onCashout,
  showContinuePrompt,
}: PokerTableProps) {
  const N = seats.length || 1;
  const containerRef = useRef<HTMLDivElement>(null);

  const RX = 43;
  // Shrink vertical radius when action panel is open so seat 0 clears the bar
  const RY = actionPanelVisible ? 28 : 35;

  const seatCoordinates: Record<number, { x: number; y: number }> = {};
  seats.forEach((_, i) => {
    const { left, top } = getSeatPosition(i, N, RX, RY);
    seatCoordinates[i] = { x: left, y: top };
  });

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-gray-950 overflow-hidden"
      style={{ minHeight: '100svh', cursor: onTableClick ? 'pointer' : 'default' }}
      onClick={onTableClick}
    >
      {/* ── Felt table ellipse ─────────────────────────────────────── */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '13%',
          top: '8%',
          width: '74%',
          height: '68%',
          borderRadius: '50%',
          background:
            'radial-gradient(ellipse at 50% 40%, #22883f 0%, #165c2c 55%, #0c3d1c 100%)',
          border: '5px solid #b8860b',
          boxShadow:
            '0 0 0 3px #7a5408, inset 0 0 70px rgba(0,0,0,0.35), 0 10px 40px rgba(0,0,0,0.75)',
          zIndex: 1,
        }}
      />

      {/* ── Centre: pot + community cards ──────────────────────────── */}
      <div
        className="absolute flex flex-col items-center gap-3"
        style={{
          left: '50%',
          top: '42%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10,
        }}
      >
        <PotDisplay
          pots={pots}
          roundBet={roundBet}
          winnerSeatIndex={winnerSeatIndex}
          seatCoordinates={seatCoordinates}
        />
        <CommunityCards cards={communityCards} />
      </div>

      {/* ── Seats positioned around the ellipse ────────────────────── */}
      {seats.map((seatData, i) => {
        const { left, top } = getSeatPosition(i, N, RX, RY);
        return (
          <div
            key={seatData.seat}
            className="absolute"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: 20,
            }}
          >
            <PlayerSeat {...seatData} />
          </div>
        );
      })}

      {/* ── Action panel (passed as children) ──────────────────────── */}
      {children && (
        <div
          className="absolute bottom-0 left-0 right-0 z-30"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      )}

      {/* ── Showdown continue prompt (bottom centre) ────────────────── */}
      <AnimatePresence>
        {showContinuePrompt && (
          <motion.p
            className="absolute bottom-6 left-0 right-0 text-center text-gray-400 text-sm tracking-wide select-none pointer-events-none z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            Press any key or click anywhere to deal the next hand
          </motion.p>
        )}
      </AnimatePresence>

      {/* ── Cashout button (top-right, clear of all player seats) ───── */}
      <AnimatePresence>
        {showCashoutButton && onCashout && (
          <motion.button
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4 }}
            onClick={(e) => { e.stopPropagation(); onCashout(); }}
            className="absolute top-4 right-4 z-40 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 font-medium transition-colors text-sm"
          >
            Cash Out &amp; Leave
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
