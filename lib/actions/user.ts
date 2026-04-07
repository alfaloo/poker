'use server';

import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';

export async function createUser(data: {
  username: string;
  password: string;
}): Promise<{ success: boolean; error?: string }> {
  const { username, password } = data;

  if (!username || !password) {
    return { success: false, error: 'Username and password are required' };
  }

  if (password.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters' };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    await db.insert(users).values({
      username,
      passwordHash,
      balance: 400,
      dateLastAccessed: sql`CURRENT_DATE`,
    });
    return { success: true };
  } catch (err: unknown) {
    const pg = err as { code?: string };
    if (pg.code === '23505') {
      return { success: false, error: 'Username already in use' };
    }
    throw err;
  }
}

export async function applyDailyReward(
  userId: string
): Promise<{ rewarded: boolean }> {
  const [user] = await db
    .select({ balance: users.balance, dateLastAccessed: users.dateLastAccessed })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return { rewarded: false };
  }

  // Compare CURRENT_DATE > date_last_accessed using string comparison (YYYY-MM-DD)
  const today = new Date().toISOString().slice(0, 10);
  const lastAccessed = user.dateLastAccessed; // date column returned as string

  if (today <= lastAccessed) {
    return { rewarded: false };
  }

  // Date check passed — update date_last_accessed and conditionally reward balance
  if (user.balance < 200) {
    await db
      .update(users)
      .set({
        dateLastAccessed: sql`CURRENT_DATE`,
        balance: user.balance + 200,
      })
      .where(eq(users.id, userId));
    return { rewarded: true };
  } else {
    await db
      .update(users)
      .set({ dateLastAccessed: sql`CURRENT_DATE` })
      .where(eq(users.id, userId));
    return { rewarded: false };
  }
}
