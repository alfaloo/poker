import { unstable_noStore as noStore } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, leaderboard } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import Navbar from '@/components/ui/Navbar';

export default async function LeaderboardPage() {
  noStore();

  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const userId = session.user.id;
  const sessionUsername = (session.user as { id: string; username?: string }).username ?? '';

  // Fetch current user for Navbar (balance + username)
  const [currentUser] = await db
    .select({ balance: users.balance, username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!currentUser) {
    redirect('/login');
  }

  // Fetch top 10 users by true total wealth via the leaderboard view
  const leaderboardData = await db.select().from(leaderboard);

  const rankMedal = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return rank.toString();
  };

  return (
    <div className="min-h-screen bg-green-950 text-white">
      <Navbar username={currentUser.username} balance={currentUser.balance} />

      <main className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-amber-400 mb-2 text-center tracking-wide">
          ♠ Leaderboard
        </h1>
        <p className="text-gray-400 text-sm text-center mb-8">
          Top 10 players by total wealth (balance + active chips)
        </p>

        <div className="rounded-lg overflow-hidden border border-amber-500/30 shadow-lg shadow-amber-900/20">
          <table className="w-full">
            <thead>
              <tr className="bg-amber-900/40 border-b border-amber-500/30">
                <th className="px-6 py-3 text-left text-xs font-semibold text-amber-400 uppercase tracking-wider w-16">
                  Rank
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-amber-400 uppercase tracking-wider">
                  Player
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-amber-400 uppercase tracking-wider">
                  Total Balance
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-500/10">
              {leaderboardData.map((entry, index) => {
                const rank = index + 1;
                const isCurrentUser = entry.username === sessionUsername;
                return (
                  <tr
                    key={entry.username}
                    className={
                      isCurrentUser
                        ? 'bg-amber-500/20 border-l-2 border-amber-400'
                        : rank % 2 === 0
                        ? 'bg-gray-900/30'
                        : 'bg-transparent'
                    }
                  >
                    <td className="px-6 py-4 text-center text-lg font-bold">
                      {rankMedal(rank)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`font-medium ${
                          isCurrentUser ? 'text-amber-300' : 'text-gray-200'
                        }`}
                      >
                        {entry.username}
                        {isCurrentUser && (
                          <span className="ml-2 text-xs text-amber-400/70 font-normal">
                            (you)
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span
                        className={`font-semibold tabular-nums ${
                          isCurrentUser ? 'text-amber-300' : 'text-amber-500'
                        }`}
                      >
                        {Number(entry.totalBalance).toLocaleString()}
                      </span>
                      <span className="text-gray-500 text-xs ml-1">coins</span>
                    </td>
                  </tr>
                );
              })}
              {leaderboardData.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-10 text-center text-gray-500">
                    No players yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
