'use client';

import React, { useRef } from 'react';
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
}

interface PokerTableProps {
  seats: SeatData[];
  communityCards: (CardType | null)[];
  pots: { amount: number; label: string }[];
  winnerSeatIndex?: number | null;
  children?: React.ReactNode;
}

/**
 * Computes (left%, top%) for seat i around an ellipse centred at (50%, 50%).
 * Seat 0 is always at the bottom centre (angle = π/2 in screen coords).
 * Subsequent seats go clockwise.
 *
 * RX / RY are semi-radii expressed as percentages of the container's
 * width and height respectively.
 */
function getSeatPosition(i: number, N: number, RX: number, RY: number) {
  // angle π/2 → bottom; clockwise means subtracting per seat
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
  winnerSeatIndex,
  children,
}: PokerTableProps) {
  const N = seats.length || 1;
  const containerRef = useRef<HTMLDivElement>(null);

  // Semi-radii for seat ring as % of container dimensions.
  // Tuned so seats sit just outside the felt ellipse on all N values.
  const RX = 43;
  const RY = 35;

  // Build a map of seat index → pixel coordinates for PotDisplay animations.
  // Values are computed lazily from the rendered container size; the ref is
  // updated on first render.  For now we pass percentages so PotDisplay can
  // convert if needed.
  const seatCoordinates: Record<number, { x: number; y: number }> = {};
  seats.forEach((_, i) => {
    const { left, top } = getSeatPosition(i, N, RX, RY);
    seatCoordinates[i] = { x: left, y: top };
  });

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-gray-950 overflow-hidden"
      style={{ minHeight: '100svh' }}
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
          // Gold outer ring: border + an extra inset shadow ring
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
        <div className="absolute bottom-0 left-0 right-0 z-30">{children}</div>
      )}
    </div>
  );
}
