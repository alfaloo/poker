'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import TierCard from '@/components/lobby/TierCard';
import Toast from '@/components/ui/Toast';
import Navbar from '@/components/ui/Navbar';
import { TIERS } from '@/lib/game/constants';
import { initGameSession } from '@/lib/actions/session';

interface LobbyClientProps {
  username: string;
  balance: number;
  showErrorToast: boolean;
  showRewardToast: boolean;
}

export default function LobbyClient({
  username,
  balance,
  showErrorToast,
  showRewardToast,
}: LobbyClientProps) {
  const router = useRouter();
  const [numPlayers, setNumPlayers] = useState<number[]>([6, 6, 6]);
  const [loading, setLoading] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(
    showErrorToast ? 'Session not found or already expired' : null
  );
  const [showReward, setShowReward] = useState(showRewardToast);

  async function handlePlay(tierIndex: number) {
    setLoading(tierIndex);
    try {
      const { sessionId } = await initGameSession(tierIndex, numPlayers[tierIndex]);
      router.push(`/game/${sessionId}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to start game');
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-green-950">
      <Navbar username={username} balance={balance} />

      <main className="max-w-5xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-amber-400 text-center mb-2">Choose Your Table</h1>
        <p className="text-gray-400 text-center mb-10">Select a difficulty tier and number of players to start a game.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TIERS.map((tier, index) => (
            <TierCard
              key={tier.label}
              tier={tier}
              userBalance={balance}
              numPlayers={numPlayers[index]}
              onNumPlayersChange={(n) => {
                const updated = [...numPlayers];
                updated[index] = n;
                setNumPlayers(updated);
              }}
              onPlay={() => handlePlay(index)}
            />
          ))}
        </div>
      </main>

      {showReward && (
        <Toast
          message="+200 coins daily reward applied!"
          type="success"
          onDismiss={() => setShowReward(false)}
        />
      )}
      {errorMsg && (
        <Toast
          message={errorMsg}
          type="error"
          onDismiss={() => setErrorMsg(null)}
        />
      )}

      {loading !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="text-amber-400 text-lg font-semibold animate-pulse">Starting game...</div>
        </div>
      )}
    </div>
  );
}
