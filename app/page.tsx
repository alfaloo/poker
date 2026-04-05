import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { recoverPriorSession } from '@/lib/actions/balance';
import { applyDailyRewardCached } from '@/lib/daily-reward-cached';
import LobbyClient from './LobbyClient';

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function HomePage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const userId = session.user.id;

  // (1) Recover any stale session stack back to balance
  await recoverPriorSession(userId);

  // (2) Fetch updated balance and username after recovery
  const [user] = await db
    .select({ balance: users.balance, username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    redirect('/login');
  }

  // (3) Check for error query param
  const params = await searchParams;
  const showErrorToast = params.error === 'invalid_session';

  // (4) Apply daily reward (uses cached call — layout already ran this for the same request)
  const { rewarded } = await applyDailyRewardCached(userId);

  return (
    <LobbyClient
      username={user.username}
      balance={user.balance}
      showErrorToast={showErrorToast}
      showRewardToast={rewarded}
    />
  );
}
