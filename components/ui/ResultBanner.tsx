'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

interface ResultBannerProps {
  net: number;
}

export default function ResultBanner({ net }: ResultBannerProps) {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const dismiss = setTimeout(() => {
      setVisible(false);
    }, 4000);
    return () => clearTimeout(dismiss);
  }, []);

  // After fade-out animation completes, strip the ?result param from the URL
  const handleAnimationComplete = (definition: string) => {
    if (definition === 'exit') {
      router.replace('/');
    }
  };

  const isProfit = net > 0;
  const isLoss = net < 0;

  const bannerStyle = isProfit
    ? 'bg-green-900/90 border-green-500 text-green-200'
    : isLoss
    ? 'bg-red-900/90 border-red-500 text-red-200'
    : 'bg-gray-800/90 border-gray-500 text-gray-300';

  const icon = isProfit ? '✓' : isLoss ? '✕' : '≈';

  const message = isProfit
    ? `You walked away with +${net.toLocaleString()} 🪙 profit!`
    : isLoss
    ? `You lost ${Math.abs(net).toLocaleString()} 🪙 this session.`
    : 'You broke even this session.';

  return (
    <AnimatePresence onExitComplete={() => router.replace('/')}>
      {visible && (
        <motion.div
          className="fixed top-4 left-1/2 z-[9999] w-full max-w-md px-4"
          style={{ x: '-50%' }}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.5 }}
          onAnimationComplete={handleAnimationComplete}
        >
          <div
            className={`flex items-center gap-3 rounded-xl border px-5 py-4 shadow-2xl backdrop-blur-sm ${bannerStyle}`}
          >
            <span className="text-lg font-bold">{icon}</span>
            <span className="flex-1 text-sm font-medium">{message}</span>
            <button
              onClick={() => setVisible(false)}
              className="text-current opacity-60 hover:opacity-100 transition-opacity text-lg leading-none"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
