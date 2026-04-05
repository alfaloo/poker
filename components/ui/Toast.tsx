'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type ToastType = 'info' | 'success' | 'error';

interface ToastProps {
  message: string;
  type: ToastType;
  onDismiss: () => void;
}

const typeClasses: Record<ToastType, string> = {
  info: 'bg-blue-600 text-white',
  success: 'bg-green-600 text-white',
  error: 'bg-red-600 text-white',
};

const typeIcons: Record<ToastType, string> = {
  info: 'ℹ',
  success: '✓',
  error: '✕',
};

export default function Toast({ message, type, onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 50 }}
        transition={{ duration: 0.3 }}
        className={[
          'fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded shadow-lg max-w-sm',
          typeClasses[type],
        ].join(' ')}
      >
        <span className="font-bold">{typeIcons[type]}</span>
        <span>{message}</span>
        <button
          onClick={onDismiss}
          className="ml-auto pl-2 opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Dismiss"
        >
          ×
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
