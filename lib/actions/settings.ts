'use server';

import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import type { UserSettings } from '@/lib/settings';

async function getAuthedUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized: not authenticated');
  }
  return session.user.id;
}

export async function updateUserSettings(
  patch: Partial<UserSettings>
): Promise<{ success: true }> {
  const userId = await getAuthedUserId();

  // Merge the patch into the existing JSONB using Postgres || operator
  await db
    .update(users)
    .set({
      settings: sql`settings || ${JSON.stringify(patch)}::jsonb`,
    })
    .where(eq(users.id, userId));

  return { success: true };
}

export async function changeUsername(
  newUsername: string
): Promise<{ success: true } | { error: string }> {
  const userId = await getAuthedUserId();

  if (!newUsername || !newUsername.trim()) {
    return { error: 'Username cannot be empty' };
  }

  try {
    await db
      .update(users)
      .set({ username: newUsername.trim() })
      .where(eq(users.id, userId));
    return { success: true };
  } catch (err: unknown) {
    const pg = err as { code?: string };
    if (pg.code === '23505') {
      return { error: 'Username already taken' };
    }
    throw err;
  }
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ success: true } | { error: string }> {
  const userId = await getAuthedUserId();

  if (newPassword.length < 8) {
    return { error: 'New password must be at least 8 characters' };
  }

  const [user] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return { error: 'User not found' };
  }

  const passwordMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!passwordMatch) {
    return { error: 'Current password is incorrect' };
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await db
    .update(users)
    .set({ passwordHash: newHash })
    .where(eq(users.id, userId));

  return { success: true };
}
