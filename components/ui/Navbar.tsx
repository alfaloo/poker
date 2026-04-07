'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';

interface NavbarProps {
  username: string;
  balance: number;
}

export default function Navbar({ username, balance }: NavbarProps) {
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close username dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      window.addEventListener('click', handler);
    }
    return () => window.removeEventListener('click', handler);
  }, [dropdownOpen]);

  const navLinkClass = (href: string) =>
    `text-sm font-medium transition-colors ${
      pathname === href
        ? 'text-amber-400 underline underline-offset-4'
        : 'text-gray-300 hover:text-amber-400'
    }`;

  return (
    <nav className="bg-gray-900 border-b border-amber-500/30 px-4 md:px-6">
      {/* ── Main row ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 h-14">
        {/* Logo */}
        <Link
          href="/"
          className="text-amber-400 font-bold text-xl tracking-wide hover:text-amber-300 transition-colors shrink-0"
        >
          ♠ PokerSite
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-6 ml-6">
          <Link href="/leaderboard" className={navLinkClass('/leaderboard')}>
            Leaderboard
          </Link>
          <Link href="/settings" className={navLinkClass('/settings')}>
            Settings
          </Link>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Balance — always visible */}
        <span className="text-amber-400 font-semibold text-sm tabular-nums shrink-0">
          🪙 {balance.toLocaleString()}
        </span>

        {/* Username dropdown — always visible */}
        <div className="relative shrink-0" ref={dropdownRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDropdownOpen((o) => !o);
            }}
            className="flex items-center gap-1 text-sm text-amber-400 font-semibold hover:text-amber-300 transition-colors"
          >
            {username}
            <span className="text-gray-400 text-xs">▾</span>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-36 rounded-lg bg-gray-800 border border-gray-700 shadow-xl z-50">
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700 hover:text-amber-400 rounded-lg transition-colors"
              >
                Log out
              </button>
            </div>
          )}
        </div>

        {/* Mobile hamburger — only shown below md */}
        <button
          className="md:hidden text-gray-300 hover:text-amber-400 transition-colors shrink-0 p-1"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {menuOpen ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* ── Mobile dropdown menu ─────────────────────────────────────── */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-800 py-3 flex flex-col gap-3">
          <Link
            href="/leaderboard"
            className={navLinkClass('/leaderboard')}
            onClick={() => setMenuOpen(false)}
          >
            Leaderboard
          </Link>
          <Link
            href="/settings"
            className={navLinkClass('/settings')}
            onClick={() => setMenuOpen(false)}
          >
            Settings
          </Link>
        </div>
      )}
    </nav>
  );
}
