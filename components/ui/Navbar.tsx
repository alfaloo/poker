'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';

interface NavbarProps {
  username: string;
  balance: number;
}

export default function Navbar({ username, balance }: NavbarProps) {
  return (
    <nav className="bg-gray-900 border-b border-amber-500/30 px-6 py-3 flex items-center justify-between">
      <Link href="/" className="text-amber-400 font-bold text-xl tracking-wide hover:text-amber-300 transition-colors">
        ♠ PokerSite
      </Link>

      <div className="flex items-center gap-6">
        <span className="text-gray-300 text-sm">
          <span className="text-amber-400 font-semibold">{username}</span>
        </span>
        <span className="text-sm text-gray-400">
          Balance:{' '}
          <span className="text-amber-400 font-semibold">{balance.toLocaleString()} coins</span>
        </span>
        <Link
          href="/leaderboard"
          className="text-sm text-gray-300 hover:text-amber-400 transition-colors font-medium"
        >
          Leaderboard
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="text-sm bg-transparent border border-gray-600 hover:border-amber-500 text-gray-300 hover:text-amber-400 px-3 py-1 rounded transition-colors"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
