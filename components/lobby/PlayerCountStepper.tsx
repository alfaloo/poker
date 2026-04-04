'use client';

import React from 'react';

interface PlayerCountStepperProps {
  value: number;
  onChange: (n: number) => void;
}

const MIN = 4;
const MAX = 8;

export default function PlayerCountStepper({ value, onChange }: PlayerCountStepperProps) {
  const decrement = () => {
    if (value > MIN) onChange(value - 1);
  };
  const increment = () => {
    if (value < MAX) onChange(value + 1);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={decrement}
        disabled={value <= MIN}
        className="w-7 h-7 rounded-full bg-amber-500 text-gray-900 font-bold text-lg leading-none flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-amber-400 transition-colors"
        aria-label="Decrease player count"
      >
        −
      </button>
      <span className="w-6 text-center text-amber-300 font-semibold">{value}</span>
      <button
        type="button"
        onClick={increment}
        disabled={value >= MAX}
        className="w-7 h-7 rounded-full bg-amber-500 text-gray-900 font-bold text-lg leading-none flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-amber-400 transition-colors"
        aria-label="Increase player count"
      >
        +
      </button>
    </div>
  );
}
