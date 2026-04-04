'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '@/components/ui/Button';
import BetControls from './BetControls';

interface ActionPanelProps {
  legalActions: string[];
  callAmount: number;
  chipRangeMin: number;
  chipRangeMax: number;
  pot: number;
  smallBlind: number;
  currentBet: number;
  isPending: boolean;
  actionError: string | null;
  onFold: () => void;
  onCheck: () => void;
  onCall: () => void;
  onBet: (amount: number) => void;
}

export default function ActionPanel({
  legalActions,
  callAmount,
  chipRangeMin,
  chipRangeMax,
  pot,
  smallBlind,
  currentBet,
  isPending,
  actionError,
  onFold,
  onCheck,
  onCall,
  onBet,
}: ActionPanelProps) {
  const [betOpen, setBetOpen] = useState(false);

  const canCheck = legalActions.includes('check');
  const canCall = legalActions.includes('call');
  const canBetOrRaise = legalActions.includes('bet') || legalActions.includes('raise');

  const handleBet = (amount: number) => {
    setBetOpen(false);
    onBet(amount);
  };

  return (
    <motion.div
      initial={{ y: 120, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 120, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900/95 border-t border-yellow-600/40 shadow-2xl"
    >
      <div className="max-w-2xl mx-auto px-4 py-3 flex flex-col gap-3">
        {/* Error message */}
        <AnimatePresence>
          {actionError && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="bg-red-900/80 border border-red-500/60 text-red-300 text-sm rounded px-3 py-2"
            >
              {actionError}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bet controls panel (slides up when open) */}
        <AnimatePresence>
          {betOpen && canBetOrRaise && (
            <motion.div
              key="bet-controls"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.2 }}
            >
              <BetControls
                legalActions={legalActions}
                chipRangeMin={chipRangeMin}
                chipRangeMax={chipRangeMax}
                pot={pot}
                smallBlind={smallBlind}
                currentBet={currentBet}
                onBet={handleBet}
                isPending={isPending}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Primary action buttons */}
        <div className="flex gap-2">
          {/* Fold — always shown */}
          <Button
            variant="danger"
            onClick={onFold}
            disabled={isPending}
            className="flex-1"
          >
            Fold
          </Button>

          {/* Check — only when legal */}
          {canCheck && (
            <Button
              variant="secondary"
              onClick={onCheck}
              disabled={isPending}
              className="flex-1"
            >
              Check
            </Button>
          )}

          {/* Call [amount] — only when legal */}
          {canCall && (
            <Button
              variant="secondary"
              onClick={onCall}
              disabled={isPending}
              className="flex-1"
            >
              Call {callAmount}
            </Button>
          )}

          {/* Bet / Raise toggle */}
          {canBetOrRaise && (
            <Button
              variant="primary"
              onClick={() => setBetOpen((prev) => !prev)}
              disabled={isPending}
              className="flex-1"
            >
              {legalActions.includes('raise') ? 'Raise ▲' : 'Bet ▲'}
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
