'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Card from '@/components/game/Card';
import type { Card as CardType } from '@/lib/game/deck';

interface Winner {
  seat: number;
  username: string;
  handName: string;
  amount: number;
}

interface SeatInHand {
  seat: number;
  username: string;
  cards: CardType[];
  handName: string;
}

interface HandResultProps {
  winners: Winner[];
  allSeatsInHand: SeatInHand[];
  isFoldWin: boolean;
  onContinue: () => void;
  onLeave: () => void;
}

export default function HandResult({
  winners,
  allSeatsInHand,
  isFoldWin,
  onContinue,
  onLeave,
}: HandResultProps) {
  const [promptVisible, setPromptVisible] = useState(false);

  const winnerSeats = new Set(winners.map((w) => w.seat));

  useEffect(() => {
    if (isFoldWin) {
      const t = setTimeout(() => onContinue(), 1500);
      return () => clearTimeout(t);
    }
    // Show the "press any key" prompt after the cards have had time to flip in
    const t = setTimeout(() => setPromptVisible(true), 1200);
    return () => clearTimeout(t);
  }, [isFoldWin, onContinue]);

  // Keypress advances to next hand (but not when a modifier key is held)
  useEffect(() => {
    if (isFoldWin || !promptVisible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      onContinue();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFoldWin, promptVisible, onContinue]);

  const handleOverlayClick = () => {
    if (!isFoldWin && promptVisible) onContinue();
  };

  // ── Fold win ───────────────────────────────────────────────────────────────
  if (isFoldWin) {
    const winner = winners[0];
    return (
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-gray-900 border border-amber-500 rounded-xl px-10 py-8 text-center shadow-2xl"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        >
          <p className="text-2xl font-bold text-amber-400">
            {winner ? `${winner.username} wins the pot!` : 'Player wins the pot!'}
          </p>
          {winner && (
            <p className="mt-2 text-lg text-amber-300">+{winner.amount} chips</p>
          )}
        </motion.div>
      </motion.div>
    );
  }

  // ── Showdown ───────────────────────────────────────────────────────────────
  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 cursor-pointer"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={handleOverlayClick}
    >
      <div
        className="relative bg-gray-900 border border-amber-700 rounded-2xl p-6 w-full max-w-4xl mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-amber-400 text-center mb-6">Showdown</h2>

        {/* Winner summary */}
        {winners.length > 0 && (
          <div className="text-center mb-6">
            {winners.map((w) => (
              <p key={w.seat} className="text-lg font-semibold text-amber-300">
                {w.username} wins {w.amount} chips
                {w.handName ? ` — ${w.handName}` : ''}
              </p>
            ))}
          </div>
        )}

        {/* All players' cards */}
        <div className="flex flex-wrap justify-center gap-6">
          {allSeatsInHand.map((seatInfo, index) => {
            const isWinner = winnerSeats.has(seatInfo.seat);
            return (
              <motion.div
                key={seatInfo.seat}
                className="flex flex-col items-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.12, duration: 0.4 }}
              >
                <p className={`text-sm font-semibold mb-2 ${isWinner ? 'text-amber-400' : 'text-gray-300'}`}>
                  {seatInfo.username}
                  {isWinner && (
                    <span className="ml-2 text-xs bg-amber-500 text-gray-900 rounded px-1 py-0.5 font-bold">
                      WINNER
                    </span>
                  )}
                </p>

                <motion.div
                  className={`flex gap-1 p-2 rounded-lg ${isWinner ? 'ring-2 ring-amber-400' : ''}`}
                  animate={
                    isWinner
                      ? {
                          boxShadow: [
                            '0 0 8px 2px rgba(251,191,36,0.3)',
                            '0 0 24px 8px rgba(251,191,36,0.7)',
                            '0 0 8px 2px rgba(251,191,36,0.3)',
                          ],
                        }
                      : {}
                  }
                  transition={isWinner ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' } : {}}
                >
                  {seatInfo.cards.map((card, cardIndex) => (
                    <motion.div
                      key={cardIndex}
                      initial={{ rotateY: 90 }}
                      animate={{ rotateY: 0 }}
                      transition={{
                        delay: index * 0.12 + cardIndex * 0.08,
                        duration: 0.3,
                        ease: 'easeOut',
                      }}
                      style={{ perspective: 600 }}
                    >
                      <Card rank={card.rank} suit={card.suit} faceDown={false} />
                    </motion.div>
                  ))}
                </motion.div>

                <p className={`text-xs mt-2 font-medium ${isWinner ? 'text-amber-400' : 'text-gray-400'}`}>
                  {seatInfo.handName}
                </p>
              </motion.div>
            );
          })}
        </div>

        {/* Chips awarded */}
        {winners.length > 0 && (
          <motion.div
            className="flex justify-center mt-6"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.4 }}
          >
            <div className="flex items-center gap-2 bg-amber-900/40 border border-amber-600 rounded-full px-4 py-1">
              <span className="text-amber-400 text-sm">🪙</span>
              <span className="text-amber-300 text-sm font-semibold">
                {winners.reduce((sum, w) => sum + w.amount, 0)} chips awarded
              </span>
            </div>
          </motion.div>
        )}

        {/* Cash out button */}
        <div className="flex justify-center mt-6" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onLeave}
            className="px-6 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 font-medium transition-colors text-sm"
          >
            Cash Out
          </button>
        </div>
      </div>

      {/* Press any key / click to continue */}
      <AnimatePresence>
        {promptVisible && (
          <motion.p
            className="mt-5 text-gray-400 text-sm tracking-wide select-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.6, 1] }}
            transition={{ duration: 1, times: [0, 0.3, 0.6, 1] }}
          >
            Press any key or click anywhere to deal the next hand
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
