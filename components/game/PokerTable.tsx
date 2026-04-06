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
  children?: React.ReactNode;
  onTableClick?: () => void;
  showCashoutButton?: boolean;
  onCashout?: () => void;
  showContinuePrompt?: boolean;
}

/**
 * Action-bar height in px (border-t 1 + py-2 padding 16 + button height 40).
 * Used to centre the table in the space above the bar with CSS calc().
 */
const ACTION_BAR_H = 57;

/**
 * Returns CSS values for positioning seat i on the orbit ellipse.
 *
 * Table felt:  left 10 %, top calc(11% − 28.5px), width 80 %, height 78 %
 *   → centre (50 %, calc(50% − 28.5px)), semi-axes rx=40, ry=39.
 *
 * The centre Y is calc(50% − ACTION_BAR_H/2 px) so that the table is
 * perfectly centred in the viewport space above the fixed action bar,
 * regardless of screen height.
 *
 * Orbit radii give a uniform 7 % inset on every side: rx 40−7=33, ry 39−7=32.
 * Seat 0 is always at the bottom centre; subsequent seats go clockwise.
 */
function getSeatPosition(i: number, N: number, RX: number, RY: number) {
  const angle = Math.PI / 2 - (i / N) * 2 * Math.PI;
  const leftPct  = 50 + RX * Math.cos(angle);
  const yOffPct  = RY * Math.sin(angle);
  const halfBar  = ACTION_BAR_H / 2; // 28.5 px
  return {
    left: `${leftPct.toFixed(3)}%`,
    // Centre the orbit at calc(50% − 28.5px); each seat offsets from there.
    top:  `calc(50% - ${halfBar}px + ${yOffPct.toFixed(3)}%)`,
  };
}

export default function PokerTable({
  seats,
  communityCards,
  pots,
  roundBet,
  winnerSeatIndex,
  children,
  onTableClick,
  showCashoutButton,
  onCashout,
  showContinuePrompt,
}: PokerTableProps) {
  const N = seats.length || 1;
  const containerRef = useRef<HTMLDivElement>(null);

  // Table felt ellipse: left 10 %, top 4 %, width 80 %, height 78 %
  //   → centre (50 %, 43 %), semi-axes rx=40, ry=39.
  // Seat orbit radii give a uniform 7 % inset on every side: 40-7=33, 39-7=32.
  const RX = 33;
  const RY = 32;

  // Approximate numeric coordinates for PotDisplay (it receives but doesn't render them).
  const seatCoordinates: Record<number, { x: number; y: number }> = {};
  seats.forEach((_, i) => {
    const angle = Math.PI / 2 - (i / N) * 2 * Math.PI;
    seatCoordinates[i] = {
      x: 50 + RX * Math.cos(angle),
      y: 50 + RY * Math.sin(angle), // approximate; exact value uses calc()
    };
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
          left: '10%',
          top: `calc(11% - ${ACTION_BAR_H / 2}px)`,
          width: '80%',
          height: '78%',
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
          top: `calc(50% - ${ACTION_BAR_H / 2}px)`,
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
              left,
              top,
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
