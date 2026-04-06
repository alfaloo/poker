'use server';

import { randomUUID } from 'crypto';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, gameSessions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { TIERS } from '@/lib/game/constants';
import { startGameSession } from '@/lib/actions/balance';

export async function initGameSession(
  tierId: number,
  numPlayers: number
): Promise<{ sessionId: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized: not authenticated');
  }
  const userId = session.user.id;

  const tier = TIERS[tierId];
  if (!tier) {
    throw new Error(`Invalid tier ID: ${tierId}`);
  }

  const [[user], [priorSession]] = await Promise.all([
    db.select({ balance: users.balance }).from(users).where(eq(users.id, userId)).limit(1),
    db.select({ sessionStack: gameSessions.sessionStack }).from(gameSessions).where(eq(gameSessions.userId, userId)).limit(1),
  ]);

  if (!user) {
    throw new Error('User not found');
  }

  // Any uncredited session stack will be recovered atomically inside
  // startGameSession, so include it in the effective balance check here so
  // the user is never incorrectly blocked by a temporarily low main balance.
  const effectiveBalance = user.balance + (priorSession?.sessionStack ?? 0);

  if (effectiveBalance < tier.minBalance) {
    throw new Error(`Insufficient balance. Need ${tier.minBalance} to enter ${tier.label} tier.`);
  }

  const sessionId = randomUUID();

  await startGameSession(sessionId, userId, tier.buyIn, {
    smallBlind: tier.smallBlind,
    bigBlind: tier.bigBlind,
    buyIn: tier.buyIn,
    numPlayers,
  });

  return { sessionId };
}

export async function getGameSessionConfig(
  sessionId: string
): Promise<{
  smallBlind: number;
  bigBlind: number;
  buyIn: number;
  numPlayers: number;
  sessionStack: number;
} | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }
  const userId = session.user.id;

  const [gameSession] = await db
    .select()
    .from(gameSessions)
    .where(
      and(
        eq(gameSessions.sessionId, sessionId),
        eq(gameSessions.userId, userId)
      )
    )
    .limit(1);

  if (!gameSession) {
    return null;
  }

  const config = gameSession.config as {
    smallBlind: number;
    bigBlind: number;
    buyIn: number;
    numPlayers: number;
  };

  return {
    smallBlind: config.smallBlind,
    bigBlind: config.bigBlind,
    buyIn: config.buyIn,
    numPlayers: config.numPlayers,
    sessionStack: gameSession.sessionStack,
  };
}
