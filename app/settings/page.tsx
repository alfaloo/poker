import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { mergeSettings } from '@/lib/settings';
import Navbar from '@/components/ui/Navbar';
import SettingsClient from './SettingsClient';

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const userId = session.user.id;
  const username = (session.user as { id: string; username?: string }).username ?? '';

  const [user] = await db
    .select({ settings: users.settings, username: users.username, balance: users.balance })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    redirect('/login');
  }

  const settings = mergeSettings(user.settings ?? {});

  return (
    <div className="min-h-screen">
      <Navbar username={username} balance={user.balance} />
      <main className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-amber-400 mb-8">Settings</h1>
        <SettingsClient
          initialSettings={settings}
          currentUsername={user.username}
        />
      </main>
    </div>
  );
}
