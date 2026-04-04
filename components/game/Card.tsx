'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface CardProps {
  rank: string;
  suit: string;
  faceDown?: boolean;
  faded?: boolean;
  className?: string;
}

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  spades: '♠',
  clubs: '♣',
};

const RED_SUITS = new Set(['hearts', 'diamonds']);

export default function Card({ rank, suit, faceDown = false, faded = false, className = '' }: CardProps) {
  const suitSymbol = SUIT_SYMBOLS[suit] ?? suit;
  const isRed = RED_SUITS.has(suit);

  return (
    <div
      className={`relative ${className}`}
      style={{ width: 60, height: 84, perspective: 600 }}
    >
      <AnimatePresence initial={false} mode="wait">
        {faceDown ? (
          <motion.div
            key="back"
            initial={{ rotateY: -90 }}
            animate={{ rotateY: 0 }}
            exit={{ rotateY: 90 }}
            transition={{ duration: 0.3 }}
            style={{ opacity: faded ? 0.5 : 1, backfaceVisibility: 'hidden' }}
            className="absolute inset-0 rounded-md border border-gray-300 bg-white flex items-center justify-center overflow-hidden"
          >
            <CardBack />
          </motion.div>
        ) : (
          <motion.div
            key="front"
            initial={{ rotateY: -90 }}
            animate={{ rotateY: 0 }}
            exit={{ rotateY: 90 }}
            transition={{ duration: 0.3 }}
            style={{ opacity: faded ? 0.5 : 1, backfaceVisibility: 'hidden' }}
            className="absolute inset-0 rounded-md border border-gray-300 bg-white flex flex-col justify-between p-1 select-none"
          >
            <div className={`text-xs font-bold leading-none ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
              <div>{rank}</div>
              <div>{suitSymbol}</div>
            </div>
            <div className={`text-xl font-bold leading-none self-center ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
              {suitSymbol}
            </div>
            <div className={`text-xs font-bold leading-none self-end rotate-180 ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
              <div>{rank}</div>
              <div>{suitSymbol}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CardBack() {
  return (
    <div className="w-full h-full rounded-md bg-red-900 flex items-center justify-center">
      <svg
        width="48"
        height="72"
        viewBox="0 0 48 72"
        xmlns="http://www.w3.org/2000/svg"
        className="rounded"
      >
        <rect width="48" height="72" fill="#7f1d1d" rx="3" />
        {/* Diamond cross-hatch pattern */}
        <pattern id="crosshatch" x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
          <line x1="0" y1="6" x2="6" y2="0" stroke="#991b1b" strokeWidth="1" />
          <line x1="6" y1="12" x2="12" y2="6" stroke="#991b1b" strokeWidth="1" />
          <line x1="6" y1="0" x2="12" y2="6" stroke="#991b1b" strokeWidth="1" />
          <line x1="0" y1="6" x2="6" y2="12" stroke="#991b1b" strokeWidth="1" />
        </pattern>
        <rect width="48" height="72" fill="url(#crosshatch)" />
        {/* Center diamond */}
        <polygon points="24,18 36,36 24,54 12,36" fill="none" stroke="#fca5a5" strokeWidth="1.5" />
      </svg>
    </div>
  );
}
