'use client';

import { motion } from 'framer-motion';
import { Card as CardType } from '@/lib/game/deck';
import Card from './Card';

interface PlayerSeatProps {
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

// 12 evenly-spaced angles (in radians) for sparkle particles
const SPARKLE_PARAMS = Array.from({ length: 12 }, (_, i) => {
  const rad = (i / 12) * 2 * Math.PI;
  const dist = 44 + (i % 3) * 18;
  return {
    x: Math.cos(rad) * dist,
    y: Math.sin(rad) * dist,
    color: ['#fbbf24', '#f59e0b', '#fcd34d', '#ffffff', '#fde68a', '#fb923c'][i % 6],
    delay: i * 0.1,
  };
});

export default function PlayerSeat({
  username,
  chips,
  currentBet,
  previousBet,
  isActive,
  isDealer,
  isSmallBlind,
  isBigBlind,
  isFolded,
  isBot,
  cards,
  isEmpty,
  isWinner,
  handName,
  isUserWinner,
}: PlayerSeatProps) {
  if (isEmpty) {
    return (
      <div className="flex flex-col items-center gap-1 opacity-30">
        <div className="w-10 h-10 rounded-full bg-gray-700 border-2 border-gray-600" />
        <span className="text-[10px] text-gray-500">Empty</span>
      </div>
    );
  }

  const delta = currentBet - previousBet;
  const avatarLetter = username.charAt(0).toUpperCase();

  return (
    <div className={`relative flex flex-col items-center ${isFolded ? 'opacity-50' : ''}`}>

      {/* Sparkle particles — only for the human user when they win */}
      {isUserWinner && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ overflow: 'visible', zIndex: 100 }}
        >
          {SPARKLE_PARAMS.map((p, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                width: 7,
                height: 7,
                left: '50%',
                top: '50%',
                marginLeft: -3.5,
                marginTop: -3.5,
                backgroundColor: p.color,
              }}
              animate={{
                x: [0, p.x],
                y: [0, p.y],
                opacity: [0, 1, 0],
                scale: [0.5, 1.5, 0],
              }}
              transition={{
                duration: 1.4,
                repeat: Infinity,
                repeatDelay: 0.8,
                delay: p.delay,
                ease: 'easeOut',
              }}
            />
          ))}
        </div>
      )}

      {/* Winner badge — above the cards */}
      {isWinner && (
        <motion.span
          className="text-[10px] bg-amber-500 text-gray-900 rounded px-1.5 py-0.5 font-bold leading-none mb-1 z-30"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          WINNER
        </motion.span>
      )}

      {/* Cards — clipped to show only top portion (rank + suit visible) */}
      {!isEmpty && (
        <div className="flex gap-1 relative z-10">
          {[0, 1].map((cardIdx) => {
            const card = cards?.[cardIdx];
            return (
              <div
                key={cardIdx}
                style={{ width: 60, height: 44, overflow: 'hidden' }}
              >
                <Card
                  rank={card?.rank ?? 'A'}
                  suit={card?.suit ?? 'spades'}
                  faceDown={!card}
                  faded={isFolded}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Info banner — overlaps the bottom of the cards */}
      <motion.div
        className={`relative z-20 flex items-center gap-1.5 px-2 py-1.5 rounded-xl border -mt-2 ${
          isWinner
            ? 'bg-amber-950/95 border-amber-500'
            : isActive
              ? 'bg-gray-900/95 border-amber-500'
              : 'bg-gray-900/95 border-gray-600'
        }`}
        style={{ minWidth: 124 }}
        animate={
          isWinner
            ? {
                boxShadow: [
                  '0 0 4px 2px rgba(251,191,36,0.3)',
                  '0 0 16px 6px rgba(251,191,36,0.75)',
                  '0 0 4px 2px rgba(251,191,36,0.3)',
                ],
              }
            : { boxShadow: '0 0 0px 0px rgba(251,191,36,0)' }
        }
        transition={
          isWinner
            ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0.3 }
        }
      >
        {/* Avatar with role decorators */}
        <div className="relative flex-shrink-0">
          {/* Pulsing ring for active bot */}
          {isActive && isBot && (
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-amber-400"
              animate={{ scale: [1, 1.3, 1], opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}

          {/* Static active ring for user */}
          {isActive && !isBot && (
            <div className="absolute inset-0 rounded-full border-2 border-amber-400 scale-110" />
          )}

          {/* Winner glow halo */}
          {isWinner && (
            <motion.div
              className="absolute rounded-full"
              style={{ inset: -4, borderRadius: '50%' }}
              animate={{
                boxShadow: [
                  '0 0 6px 3px rgba(251,191,36,0.4)',
                  '0 0 18px 8px rgba(251,191,36,0.85)',
                  '0 0 6px 3px rgba(251,191,36,0.4)',
                ],
              }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}

          <div
            className={`relative w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold select-none
              ${isWinner
                ? 'bg-amber-400 text-gray-900'
                : isActive
                  ? 'bg-amber-500 text-gray-900'
                  : 'bg-gray-700 text-amber-300'
              }
              border-2 ${isFolded ? 'border-gray-600' : isWinner ? 'border-amber-300' : 'border-gray-500'}`}
          >
            {isBot ? <span title="Bot" className="text-xs">🤖</span> : <span>{avatarLetter}</span>}
          </div>

          {/* Dealer button — top-right */}
          {isDealer && (
            <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white text-gray-900 text-[9px] font-bold flex items-center justify-center border border-gray-400 z-10 leading-none">
              D
            </div>
          )}

          {/* Small blind — bottom-left */}
          {isSmallBlind && (
            <div className="absolute -bottom-1.5 -left-1.5 h-4 px-1 rounded bg-blue-600 text-white text-[8px] font-bold flex items-center justify-center border border-blue-400 z-10 leading-none">
              SB
            </div>
          )}

          {/* Big blind — bottom-right */}
          {isBigBlind && (
            <div className="absolute -bottom-1.5 -right-1.5 h-4 px-1 rounded bg-purple-600 text-white text-[8px] font-bold flex items-center justify-center border border-purple-400 z-10 leading-none">
              BB
            </div>
          )}
        </div>

        {/* Username + chip stack */}
        <div className="flex flex-col flex-1 min-w-0">
          <span
            className={`text-[10px] font-semibold truncate leading-tight ${
              isWinner ? 'text-amber-400' : 'text-gray-100'
            }`}
          >
            {username}
          </span>
          <span className="text-[10px] text-amber-400 font-semibold leading-tight">
            {chips.toLocaleString()}
          </span>
        </div>

        {/* Current bet */}
        {currentBet > 0 && (
          <div className="flex flex-col items-end flex-shrink-0 ml-1">
            <span className="text-[10px] text-amber-300 font-bold leading-tight">
              {currentBet.toLocaleString()}
            </span>
            {delta > 0 && (
              <span className="text-[9px] text-green-400 leading-tight">
                +{delta}
              </span>
            )}
          </div>
        )}
      </motion.div>

      {/* Hand name — shown at showdown below the banner */}
      {handName && (
        <motion.span
          className={`text-[9px] font-medium mt-0.5 ${isWinner ? 'text-amber-400' : 'text-gray-400'}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {handName}
        </motion.span>
      )}
    </div>
  );
}
