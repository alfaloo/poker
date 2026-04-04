'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Button from '@/components/ui/Button';

interface BetControlsProps {
  legalActions: string[];
  chipRangeMin: number;
  chipRangeMax: number;
  pot: number;
  smallBlind: number;
  currentBet: number;
  onBet: (amount: number) => void;
  isPending: boolean;
}

interface QuickBet {
  label: string;
  fraction: number;
  isAllIn?: boolean;
}

const QUICK_BETS: QuickBet[] = [
  { label: '1/4 Pot', fraction: 0.25 },
  { label: '1/3 Pot', fraction: 0.333 },
  { label: '1/2 Pot', fraction: 0.5 },
  { label: 'Full Pot', fraction: 1 },
  { label: '2× Pot', fraction: 2 },
  { label: 'All-In', fraction: 0, isAllIn: true },
];

function computeQuickBetValue(fraction: number, pot: number, smallBlind: number, chipRangeMax: number, isAllIn?: boolean): number {
  if (isAllIn) return chipRangeMax;
  return Math.round((pot * fraction) / smallBlind) * smallBlind;
}

function isButtonBlackedOut(value: number, chipRangeMin: number, chipRangeMax: number, currentBet: number, isAllIn?: boolean): boolean {
  if (isAllIn) return false;
  return value > chipRangeMax || value < chipRangeMin || value <= currentBet;
}

export default function BetControls({
  legalActions,
  chipRangeMin,
  chipRangeMax,
  pot,
  smallBlind,
  currentBet,
  onBet,
  isPending,
}: BetControlsProps) {
  const isRaise = legalActions.includes('raise');
  const [sliderValue, setSliderValue] = useState(chipRangeMin);
  const [inputValue, setInputValue] = useState(String(chipRangeMin));

  // Reset slider when range changes
  useEffect(() => {
    setSliderValue(chipRangeMin);
    setInputValue(String(chipRangeMin));
  }, [chipRangeMin, chipRangeMax]);

  const clamp = (val: number) => Math.max(chipRangeMin, Math.min(chipRangeMax, val));
  const snapToBlind = (val: number) => Math.round(val / smallBlind) * smallBlind;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setSliderValue(val);
    setInputValue(String(val));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    const parsed = parseInt(inputValue, 10);
    if (!isNaN(parsed)) {
      const clamped = clamp(snapToBlind(parsed));
      setSliderValue(clamped);
      setInputValue(String(clamped));
    } else {
      setInputValue(String(sliderValue));
    }
  };

  const handleQuickBet = (value: number) => {
    const clamped = clamp(value);
    setSliderValue(clamped);
    setInputValue(String(clamped));
    onBet(clamped);
  };

  const handleConfirm = () => {
    onBet(sliderValue);
  };

  const confirmLabel = isRaise ? `Raise to ${sliderValue}` : `Bet ${sliderValue}`;

  return (
    <div className="flex flex-col gap-3 bg-black/70 border border-yellow-600/40 rounded-xl p-4">
      {/* Quick-bet buttons */}
      <div className="grid grid-cols-6 gap-1.5">
        {QUICK_BETS.map((qb) => {
          const value = computeQuickBetValue(qb.fraction, pot, smallBlind, chipRangeMax, qb.isAllIn);
          const blacked = isButtonBlackedOut(value, chipRangeMin, chipRangeMax, currentBet, qb.isAllIn);

          return (
            <button
              key={qb.label}
              onClick={() => !blacked && !isPending && handleQuickBet(value)}
              disabled={isPending}
              className={[
                'flex flex-col items-center justify-center px-1 py-2 rounded text-xs font-semibold transition-colors duration-150',
                blacked
                  ? 'bg-black text-black border border-black cursor-not-allowed select-none'
                  : isPending
                  ? 'bg-gray-700 text-gray-500 border border-gray-600 cursor-not-allowed opacity-50'
                  : 'bg-gray-800 hover:bg-yellow-600/20 text-yellow-300 border border-yellow-600/40 cursor-pointer',
              ].join(' ')}
              title={blacked ? undefined : `${qb.label}: ${value}`}
            >
              <span className={blacked ? 'invisible' : ''}>{qb.label}</span>
              <span className={['text-[10px]', blacked ? 'invisible' : 'text-yellow-500'].join(' ')}>{value}</span>
            </button>
          );
        })}
      </div>

      {/* Slider + numeric input */}
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={chipRangeMin}
          max={chipRangeMax}
          step={smallBlind}
          value={sliderValue}
          onChange={handleSliderChange}
          disabled={isPending}
          className="flex-1 accent-yellow-500 disabled:opacity-50"
        />
        <input
          type="number"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          disabled={isPending}
          min={chipRangeMin}
          max={chipRangeMax}
          step={smallBlind}
          className="w-24 bg-gray-900 border border-yellow-600/40 text-yellow-300 text-sm text-center rounded px-2 py-1 disabled:opacity-50"
        />
      </div>

      {/* Confirm button */}
      <Button
        variant="primary"
        onClick={handleConfirm}
        disabled={isPending}
        className="w-full font-bold"
      >
        {confirmLabel}
      </Button>
    </div>
  );
}
