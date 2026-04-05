'use client';

import { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Card from './Card';
import { Card as CardType } from '@/lib/game/deck';

interface CommunityCardsProps {
  cards: (CardType | null)[];
}

export default function CommunityCards({ cards }: CommunityCardsProps) {
  // Always render 5 slots
  const slots = Array.from({ length: 5 }, (_, i) => cards[i] ?? null);

  return (
    <div className="flex items-center justify-center gap-2">
      {slots.map((card, index) => (
        <CardSlot key={index} card={card} />
      ))}
    </div>
  );
}

function CardSlot({ card }: { card: CardType | null }) {
  const prevCardRef = useRef<CardType | null>(null);
  const wasNull = prevCardRef.current === null;
  const isNewlyRevealed = wasNull && card !== null;
  prevCardRef.current = card;

  return (
    <div style={{ width: 60, height: 84 }}>
      <AnimatePresence mode="wait">
        {card ? (
          <motion.div
            key={`${card.rank}-${card.suit}`}
            initial={isNewlyRevealed ? { rotateY: -90, opacity: 0 } : { rotateY: 0, opacity: 1 }}
            animate={{ rotateY: 0, opacity: 1 }}
            transition={{ duration: 0.3 }}
            style={{ perspective: 600 }}
          >
            <Card rank={card.rank} suit={card.suit} faceDown={false} />
          </motion.div>
        ) : (
          <motion.div
            key="placeholder"
            initial={{ opacity: 1 }}
            exit={{ rotateY: 90, opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ perspective: 600 }}
          >
            <Card rank="" suit="" faceDown={true} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
