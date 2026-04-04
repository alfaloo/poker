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
}

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
    <div className={`flex flex-col items-center gap-1 ${isFolded ? 'opacity-50' : ''}`}>
      {/* Avatar with optional pulsing ring for active bot */}
      <div className="relative">
        {isActive && isBot && (
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-amber-400"
            animate={{ scale: [1, 1.25, 1], opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            style={{ borderRadius: '50%' }}
          />
        )}

        {/* Static active ring for non-bot active player */}
        {isActive && !isBot && (
          <div className="absolute inset-0 rounded-full border-2 border-amber-400 scale-110" />
        )}

        <div
          className={`relative w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold select-none
            ${isActive
              ? 'bg-amber-500 text-gray-900'
              : 'bg-gray-700 text-amber-300'
            }
            border-2 ${isFolded ? 'border-gray-600' : 'border-gray-500'}`}
        >
          {isBot ? (
            <span title="Bot">🤖</span>
          ) : (
            <span>{avatarLetter}</span>
          )}
        </div>

        {/* Dealer button */}
        {isDealer && (
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white text-gray-900 text-xs font-bold flex items-center justify-center border border-gray-400 z-10">
            D
          </div>
        )}
      </div>

      {/* Username */}
      <span className="text-xs text-gray-200 font-medium max-w-[80px] truncate">
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

      {/* Cards (shown for user/revealed players; null = face-down bots) */}
      {cards !== null && cards.length > 0 && (
        <div className="flex gap-1 mt-1">
          {cards.map((card, i) => (
            <Card
              key={i}
              rank={card.rank}
              suit={card.suit}
              faceDown={false}
              faded={isFolded}
              className="scale-75 origin-top"
            />
          ))}
        </div>
      )}

      {/* Face-down cards placeholder for bots */}
      {cards === null && !isEmpty && (
        <div className="flex gap-1 mt-1">
          {[0, 1].map((i) => (
            <Card
              key={i}
              rank="A"
              suit="spades"
              faceDown={true}
              className="scale-75 origin-top"
            />
          ))}
        </div>
      )}
    </div>
  );
}
