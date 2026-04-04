'use client';

import React from 'react';
import { TierConfig } from '@/lib/game/constants';
import Button from '@/components/ui/Button';
import PlayerCountStepper from './PlayerCountStepper';

interface TierCardProps {
  tier: TierConfig;
  userBalance: number;
  numPlayers: number;
  onNumPlayersChange: (n: number) => void;
  onPlay: () => void;
}

const TIER_DESCRIPTIONS: Record<string, string> = {
  Beginner: 'Learn the ropes at a friendly low-stakes table. Perfect for newcomers.',
  Specialist: 'Mid-stakes action for players who know their way around the felt.',
  Master: 'High-roller territory. Only the sharpest players survive.',
};

export default function TierCard({
  tier,
  userBalance,
  numPlayers,
  onNumPlayersChange,
  onPlay,
}: TierCardProps) {
  const isLocked = userBalance < tier.minBalance;
  const description = TIER_DESCRIPTIONS[tier.label] ?? '';

  return (
    <div
      className={[
        'relative rounded-xl border p-6 flex flex-col gap-4 transition-all',
        isLocked
          ? 'border-gray-600 bg-gray-800/60 opacity-60 grayscale'
          : 'border-amber-500 bg-gray-800 shadow-lg shadow-amber-900/30',
      ].join(' ')}
    >
      {isLocked && (
        <div className="absolute top-3 right-3 group">
          <span className="text-gray-400 text-xl" aria-label="Locked">
            🔒
          </span>
          <div className="absolute right-0 top-7 z-10 hidden group-hover:block bg-gray-900 text-gray-200 text-xs rounded px-2 py-1 whitespace-nowrap border border-gray-600 shadow-lg">
            Insufficient balance
          </div>
        </div>
      )}

      <div>
        <h2 className="text-xl font-bold text-amber-400">{tier.label}</h2>
        <p className="text-sm text-gray-400 mt-1">{description}</p>
      </div>

      <div className="flex flex-col gap-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Blinds</span>
          <span className="text-amber-300 font-semibold">
            {tier.smallBlind}/{tier.bigBlind}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Buy-in</span>
          <span className="text-amber-300 font-semibold">{tier.buyIn.toLocaleString()} coins</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Min balance</span>
          <span className="text-gray-300">{tier.minBalance.toLocaleString()} coins</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-gray-400 text-sm">Players</span>
        <PlayerCountStepper value={numPlayers} onChange={onNumPlayersChange} />
      </div>

      <Button
        variant="primary"
        disabled={isLocked}
        onClick={onPlay}
        className="w-full justify-center"
      >
        Play
      </Button>
    </div>
  );
}
