import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  integer,
  date,
  timestamp,
  jsonb,
  pgView,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  balance: integer('balance').notNull().default(400),
  dateLastAccessed: date('date_last_accessed').notNull().default(sql`CURRENT_DATE`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export const gameSessions = pgTable('game_sessions', {
  sessionId: uuid('session_id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  config: jsonb('config').notNull(),
  sessionStack: integer('session_stack').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export const leaderboard = pgView('leaderboard').as((qb) =>
  qb
    .select({
      username: users.username,
      totalBalance: sql<number>`${users.balance} + COALESCE(${gameSessions.sessionStack}, 0)`.as('total_balance'),
    })
    .from(users)
    .leftJoin(gameSessions, sql`${gameSessions.userId} = ${users.id}`)
    .orderBy(sql`total_balance DESC`)
    .limit(10)
);
