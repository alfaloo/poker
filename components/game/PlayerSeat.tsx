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
        <div className="w-12 h-12 rounded-full bg-gray-700 border-2 border-gray-600" />
        <span className="text-xs text-gray-500">Empty</span>
      </div>
    );
  }

  const delta = currentBet - previousBet;
  const avatarLetter = username.charAt(0).toUpperCase();

  return (
    <div className={`relative flex flex-col items-center gap-1 ${isFolded ? 'opacity-50' : ''}`}>

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

      {/* Avatar */}
      <div className="relative">
        {/* Pulsing ring for active bot */}
        {isActive && isBot && (
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-amber-400"
            animate={{ scale: [1, 1.25, 1], opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            style={{ borderRadius: '50%' }}
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
            style={{ inset: -5, borderRadius: '50%' }}
            animate={{
              boxShadow: [
                '0 0 8px 4px rgba(251,191,36,0.4)',
                '0 0 22px 10px rgba(251,191,36,0.85)',
                '0 0 8px 4px rgba(251,191,36,0.4)',
              ],
            }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}

        <div
          className={`relative w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold select-none
            ${isWinner
              ? 'bg-amber-400 text-gray-900'
              : isActive
                ? 'bg-amber-500 text-gray-900'
                : 'bg-gray-700 text-amber-300'
            }
            border-2 ${isFolded ? 'border-gray-600' : isWinner ? 'border-amber-300' : 'border-gray-500'}`}
        >
          {isBot ? <span title="Bot">🤖</span> : <span>{avatarLetter}</span>}
        </div>

        {/* Dealer button */}
        {isDealer && (
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white text-gray-900 text-xs font-bold flex items-center justify-center border border-gray-400 z-10">
            D
          </div>
        )}
      </div>

      {/* Winner badge */}
      {isWinner && (
        <motion.span
          className="text-[10px] bg-amber-500 text-gray-900 rounded px-1.5 py-0.5 font-bold leading-none"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          WINNER
        </motion.span>
      )}

      {/* Username */}
      <span className={`text-xs font-medium max-w-[80px] truncate ${isWinner ? 'text-amber-400' : 'text-gray-200'}`}>
        {username}
      </span>

      {/* Chip stack */}
      <span className="text-xs text-amber-400 font-semibold">
        {chips.toLocaleString()}
      </span>

      {/* Blind badges */}
      {(isSmallBlind || isBigBlind) && (
        <div className="flex gap-1">
          {isSmallBlind && (
            <span className="px-1 py-0.5 rounded bg-blue-600 text-white text-[10px] font-bold leading-none">
              SB
            </span>
          )}
          {isBigBlind && (
            <span className="px-1 py-0.5 rounded bg-purple-600 text-white text-[10px] font-bold leading-none">
              BB
            </span>
          )}
        </div>
      )}

      {/* Bet badge */}
      {currentBet > 0 && (
        <div className="bg-gray-800 border border-amber-600 rounded px-2 py-0.5 text-center min-w-[48px]">
          <div className="text-xs text-amber-300 font-bold leading-tight">
            {currentBet}
          </div>
          {delta > 0 && (
            <div className="text-[10px] text-green-400 leading-tight">
              +{delta}
            </div>
          )}
        </div>
      )}

      {/* Cards — always render 2 slots for occupied seats; faceDown when cards === null */}
      {!isEmpty && (
        <motion.div
          className={`flex gap-1 mt-1 p-1 rounded-lg ${isWinner ? 'ring-2 ring-amber-400' : ''}`}
          animate={isWinner ? {
            boxShadow: [
              '0 0 4px 1px rgba(251,191,36,0.2)',
              '0 0 14px 5px rgba(251,191,36,0.6)',
              '0 0 4px 1px rgba(251,191,36,0.2)',
            ],
          } : { boxShadow: '0 0 0px 0px rgba(251,191,36,0)' }}
          transition={isWinner ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
        >
          {[0, 1].map((cardIdx) => {
            const card = cards?.[cardIdx];
            return (
              <Card
                key={cardIdx}
                rank={card?.rank ?? 'A'}
                suit={card?.suit ?? 'spades'}
                faceDown={!card}
                faded={isFolded}
                className="scale-75 origin-top"
              />
            );
          })}
        </motion.div>
      )}

      {/* Hand name — only shown at showdown */}
      {handName && (
        <motion.span
          className={`text-[10px] font-medium mt-0.5 ${isWinner ? 'text-amber-400' : 'text-gray-400'}`}
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
