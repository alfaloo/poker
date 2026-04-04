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
  const [showContinuePrompt, setShowContinuePrompt] = useState(false);

  const winnerSeats = new Set(winners.map((w) => w.seat));

  useEffect(() => {
    if (isFoldWin) {
      const timer = setTimeout(() => {
        onContinue();
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        setShowContinuePrompt(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isFoldWin, onContinue]);

  const handleOverlayClick = () => {
    if (!isFoldWin && showContinuePrompt) {
      onContinue();
    }
  };

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

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/75 cursor-pointer"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={handleOverlayClick}
    >
      {/* Showdown content */}
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
                {w.username} wins {w.amount} chips — {w.handName}
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
                transition={{ delay: index * 0.1, duration: 0.4 }}
              >
                {/* Player name */}
                <p
                  className={`text-sm font-semibold mb-2 ${
                    isWinner ? 'text-amber-400' : 'text-gray-300'
                  }`}
                >
                  {seatInfo.username}
                </p>

                {/* Cards */}
                <motion.div
                  className={`flex gap-1 p-2 rounded-lg ${
                    isWinner
                      ? 'ring-2 ring-amber-400 shadow-[0_0_16px_4px_rgba(251,191,36,0.5)]'
                      : ''
                  }`}
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
                  transition={
                    isWinner
                      ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
                      : {}
                  }
                >
                  {seatInfo.cards.map((card, cardIndex) => (
                    <motion.div
                      key={cardIndex}
                      initial={{ rotateY: 90 }}
                      animate={{ rotateY: 0 }}
                      transition={{
                        delay: index * 0.1 + cardIndex * 0.08,
                        duration: 0.3,
                        ease: 'easeOut',
                      }}
                      style={{ perspective: 600 }}
                    >
                      <Card
                        rank={card.rank}
                        suit={card.suit}
                        faceDown={false}
                      />
                    </motion.div>
                  ))}
                </motion.div>

                {/* Hand name */}
                <p
                  className={`text-xs mt-2 font-medium ${
                    isWinner ? 'text-amber-400' : 'text-gray-400'
                  }`}
                >
                  {seatInfo.handName}
                </p>
              </motion.div>
            );
          })}
        </div>

        {/* Pot chip animation (visual only — chips slide toward winner area) */}
        {winners.length > 0 && (
          <motion.div
            className="flex justify-center mt-6"
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
          >
            <div className="flex items-center gap-2 bg-amber-900/40 border border-amber-600 rounded-full px-4 py-1">
              <span className="text-amber-400 text-sm">🪙</span>
              <span className="text-amber-300 text-sm font-semibold">
                {winners.reduce((sum, w) => sum + w.amount, 0)} chips awarded
              </span>
            </div>
          </motion.div>
        )}

        {/* Buttons */}
        <div className="flex justify-center mt-6" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onLeave}
            className="px-6 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 font-medium transition-colors text-sm"
          >
            Leave Table
          </button>
        </div>
      </div>

      {/* Click to continue prompt */}
      <AnimatePresence>
        {showContinuePrompt && (
          <motion.p
            className="mt-6 text-gray-400 text-sm tracking-wide"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            Click anywhere to continue
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
