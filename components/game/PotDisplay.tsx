'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Pot {
  amount: number;
  label: string;
}

interface PotDisplayProps {
  pots: Pot[];
  winnerSeatIndex?: number | null;
  /** Sum of all current-round bets (shown only when > 0). */
  roundBet?: number;
  /** Seat index → { x, y } percentages relative to the PokerTable container. */
  seatCoordinates?: Record<number, { x: number; y: number }>;
}

export default function PotDisplay({ pots, winnerSeatIndex, roundBet = 0, seatCoordinates: _seatCoordinates }: PotDisplayProps) {
  const prevPotsRef = useRef<Pot[]>([]);
  const [chipAnimation, setChipAnimation] = useState<'idle' | 'collecting' | 'awarding'>('idle');
  const [showChip, setShowChip] = useState(false);

  const totalPot = pots.reduce((sum, p) => sum + p.amount, 0);
  const prevTotal = prevPotsRef.current.reduce((sum, p) => sum + p.amount, 0);

  // When pot increases (a bet was committed), animate chip collecting into pot
  useEffect(() => {
    if (totalPot > prevTotal && prevTotal >= 0) {
      setShowChip(true);
      setChipAnimation('collecting');
      const timer = setTimeout(() => {
        setShowChip(false);
        setChipAnimation('idle');
      }, 700);
      prevPotsRef.current = pots;
      return () => clearTimeout(timer);
    }
    prevPotsRef.current = pots;
  }, [totalPot]); // eslint-disable-line react-hooks/exhaustive-deps

  // When a winner is determined, animate chip sliding to winner
  useEffect(() => {
    if (winnerSeatIndex != null && totalPot > 0) {
      setShowChip(true);
      setChipAnimation('awarding');
      const timer = setTimeout(() => {
        setShowChip(false);
        setChipAnimation('idle');
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [winnerSeatIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  if (pots.length === 0 || totalPot === 0) return null;

  return (
    <div className="relative flex flex-col items-center gap-1 select-none">
      {/* Animated chip token */}
      <AnimatePresence>
        {showChip && chipAnimation === 'collecting' && (
          <motion.div
            key="chip-collect"
            className="absolute -top-6 z-10 w-5 h-5 rounded-full bg-yellow-400 border-2 border-yellow-600 shadow-lg"
            initial={{ y: -20, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        )}
        {showChip && chipAnimation === 'awarding' && (
          <motion.div
            key="chip-award"
            className="absolute z-10 w-5 h-5 rounded-full bg-yellow-400 border-2 border-yellow-600 shadow-lg"
            initial={{ y: 0, opacity: 1, scale: 1 }}
            animate={{ y: 60, opacity: 0, scale: 0.6 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeIn' }}
          />
        )}
      </AnimatePresence>

      {/* Main pot */}
      <motion.div
        key={totalPot}
        className="flex items-center gap-2 bg-black/60 text-yellow-300 font-bold text-sm px-3 py-1 rounded-full border border-yellow-500/50 shadow"
        initial={{ scale: 1 }}
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 0.3 }}
      >
        <span className="text-yellow-500">🪙</span>
        <span>POT: {totalPot.toLocaleString()}</span>
      </motion.div>

      {/* Current round bet total — only shown when betting has occurred */}
      <AnimatePresence>
        {roundBet > 0 && (
          <motion.div
            key="round-bet"
            className="flex items-center gap-1.5 bg-black/50 text-green-300 text-xs px-2.5 py-0.5 rounded-full border border-green-600/40"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
          >
            <span className="text-green-500 text-[10px]">↑</span>
            <span>BET: {roundBet.toLocaleString()}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Side pots (if any) */}
      {pots.length > 1 && (
        <div className="flex flex-col items-center gap-0.5">
          {pots.map((pot, i) => (
            <div
              key={i}
              className="text-xs text-yellow-200/80 bg-black/40 px-2 py-0.5 rounded-full border border-yellow-600/30"
            >
              {pot.label}: {pot.amount.toLocaleString()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
