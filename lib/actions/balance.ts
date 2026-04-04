'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, gameSessions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

function assertUser(sessionUserId: string | undefined, userId: string): void {
  if (!sessionUserId || sessionUserId !== userId) {
    throw new Error('Unauthorized: user ID mismatch');
  }
}

export async function recoverPriorSession(
  userId: string
): Promise<{ recovered: boolean; amount: number }> {
  const session = await auth();
  assertUser(session?.user?.id, userId);

  const [existingSession] = await db
    .select()
    .from(gameSessions)
    .where(eq(gameSessions.userId, userId))
    .limit(1);

  if (!existingSession) {
    return { recovered: false, amount: 0 };
  }

  const amount = existingSession.sessionStack;

  const [currentUser] = await db
    .select({ balance: users.balance })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  await db
    .update(users)
    .set({ balance: currentUser.balance + amount })
    .where(eq(users.id, userId));

  await db
    .delete(gameSessions)
    .where(eq(gameSessions.userId, userId));

  return { recovered: true, amount };
}

export async function startGameSession(
  sessionId: string,
  userId: string,
  buyIn: number,
  config: { smallBlind: number; bigBlind: number; buyIn: number; numPlayers: number }
): Promise<void> {
  const session = await auth();
  assertUser(session?.user?.id, userId);

  // Safety net: recover any prior session first
  const [existingSession] = await db
    .select()
    .from(gameSessions)
    .where(eq(gameSessions.userId, userId))
    .limit(1);

  if (existingSession) {
    const [currentUser] = await db
      .select({ balance: users.balance })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    await db
      .update(users)
      .set({ balance: currentUser.balance + existingSession.sessionStack })
      .where(eq(users.id, userId));

    await db
      .delete(gameSessions)
      .where(eq(gameSessions.userId, userId));
  }

  // Deduct buy-in
  const [user] = await db
    .select({ balance: users.balance })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new Error('User not found');
  }

  const newBalance = user.balance - buyIn;
  if (newBalance < 0) {
    throw new Error('Insufficient balance for buy-in');
  }

  await db
    .update(users)
    .set({ balance: newBalance })
    .where(eq(users.id, userId));

  // Insert new game session
  await db.insert(gameSessions).values({
    sessionId,
    userId,
    config,
    sessionStack: buyIn,
  });
}

export async function deductFromSession(
  sessionId: string,
  userId: string,
  amount: number
): Promise<void> {
  const session = await auth();
  assertUser(session?.user?.id, userId);

  if (amount <= 0) {
    throw new Error('Amount must be greater than 0');
  }

  const [gameSession] = await db
    .select({ sessionStack: gameSessions.sessionStack })
    .from(gameSessions)
    .where(
      and(
        eq(gameSessions.sessionId, sessionId),
        eq(gameSessions.userId, userId)
      )
    )
    .limit(1);

  if (!gameSession) {
    throw new Error('Game session not found');
  }

  if (gameSession.sessionStack - amount < 0) {
    throw new Error('Insufficient session stack');
  }

  await db
    .update(gameSessions)
    .set({ sessionStack: gameSession.sessionStack - amount })
    .where(
      and(
        eq(gameSessions.sessionId, sessionId),
        eq(gameSessions.userId, userId)
      )
    );
}

export async function creditToSession(
  sessionId: string,
  userId: string,
  amount: number
): Promise<void> {
  const session = await auth();
  assertUser(session?.user?.id, userId);

  if (amount <= 0) {
    throw new Error('Amount must be greater than 0');
  }

  const [gameSession] = await db
    .select({ sessionStack: gameSessions.sessionStack })
    .from(gameSessions)
    .where(
      and(
        eq(gameSessions.sessionId, sessionId),
        eq(gameSessions.userId, userId)
      )
    )
    .limit(1);

  if (!gameSession) {
    throw new Error('Game session not found');
  }

  await db
    .update(gameSessions)
    .set({ sessionStack: gameSession.sessionStack + amount })
    .where(
      and(
        eq(gameSessions.sessionId, sessionId),
        eq(gameSessions.userId, userId)
      )
    );
}

export async function cashOut(
  sessionId: string,
  userId: string
): Promise<{ finalBalance: number }> {
  const session = await auth();
  assertUser(session?.user?.id, userId);

  const [gameSession] = await db
    .select({ sessionStack: gameSessions.sessionStack })
    .from(gameSessions)
    .where(
      and(
        eq(gameSessions.sessionId, sessionId),
        eq(gameSessions.userId, userId)
      )
    )
    .limit(1);

  if (!gameSession) {
    throw new Error('Game session not found');
  }

  const [user] = await db
    .select({ balance: users.balance })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new Error('User not found');
  }

  const finalBalance = user.balance + gameSession.sessionStack;

  await db
    .update(users)
    .set({ balance: finalBalance })
    .where(eq(users.id, userId));

  await db
    .delete(gameSessions)
    .where(
      and(
        eq(gameSessions.sessionId, sessionId),
        eq(gameSessions.userId, userId)
      )
    );

  return { finalBalance };
}
