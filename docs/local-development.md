# Local Development Guide

This project is a Next.js 14 app with NeonDB (serverless Postgres) and NextAuth.js v5. Running it locally requires Node.js, a Neon database, and a `.env.local` file with the right credentials.

---

## Prerequisites

- **Node.js 18+** (`node -v` to check)
- **npm** (bundled with Node)
- A NeonDB database (already provisioned — credentials are in `.env.local`)

---

## Step 1 — Install dependencies

```bash
npm install
```

This installs all packages listed in `package.json`, including Next.js, Drizzle ORM, NextAuth, and the poker libraries.

---

## Step 2 — Configure environment variables

The app reads credentials from `.env.local` in the project root. This file is already present and gitignored — **do not commit it**.

The minimum required variables are:

```env
DATABASE_URL=postgresql://neondb_owner:<password>@<host-pooler>.neon.tech/neondb?channel_binding=require&sslmode=require
AUTH_SECRET=<32-byte hex string>
NEXTAUTH_URL=http://localhost:3000
```

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon pooled connection string — used by `lib/db/index.ts` |
| `AUTH_SECRET` | JWT signing secret — used by `lib/auth.ts` |
| `NEXTAUTH_URL` | Tells NextAuth where to redirect (must match the local dev URL) |

The existing `.env.local` already has all three set correctly for local use. No changes needed unless you want to point at a different database.

---

## Step 3 — Run database migrations

The schema migration is in [drizzle/0000_famous_scarlet_spider.sql](../drizzle/0000_famous_scarlet_spider.sql). Apply it once before the first run.

```bash
npm run db:migrate
```

This reads `DATABASE_URL` from `.env.local` and creates:
- `users` table
- `game_sessions` table
- `leaderboard` view

If you have already run this (tables exist in Neon), skip this step. Running it again against an already-migrated database is safe — Drizzle tracks which migrations have been applied.

> **Note:** `npx drizzle-kit migrate` will hang on networks where port 5432 is blocked (e.g. most home/office networks). `npm run db:migrate` uses the Neon HTTP transport (port 443) and works everywhere.

**To inspect or verify the schema**, open [console.neon.tech](https://console.neon.tech) and browse your database tables.

---

## Step 4 — Start the development server

```bash
npm run dev
```

Next.js starts on `http://localhost:3000` with hot-reloading enabled.

---

## Step 5 — Use the app

1. Open [http://localhost:3000](http://localhost:3000)
2. You are redirected to `/login` (all routes are protected by `middleware.ts`)
3. Go to `/register` to create an account
4. After login you land on the lobby (`/`) with a starting balance of 400 coins
5. Pick a difficulty tier and start a game

---

## Available npm scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start Next.js dev server with hot reload |
| `npm run build` | Production build (same as Vercel runs) |
| `npm run start` | Serve the production build locally |
| `npm run lint` | Run ESLint |
| `npm run db:migrate` | Apply pending migrations to the database |

---

## Drizzle Kit commands (schema management)

| Command | What it does |
|---|---|
| `npx drizzle-kit generate` | Generate a new migration after editing `lib/db/schema.ts` |
| `npm run db:migrate` | Apply pending migrations to the database |
| `npx drizzle-kit studio` | Open Drizzle Studio — a GUI to browse and edit database rows |

Drizzle reads `DATABASE_URL` from `.env.local` automatically via `drizzle.config.ts`.

---

## Project structure (quick reference)

```
poker/
├── app/               # Next.js routes (App Router)
│   ├── (auth)/        # /login and /register (public)
│   ├── game/[sessionId]/  # Game page (client component)
│   ├── leaderboard/   # Leaderboard (server component)
│   ├── layout.tsx     # Root layout — daily reward check
│   └── page.tsx       # Lobby (server component)
├── components/        # React components
├── lib/
│   ├── auth.ts        # NextAuth config (JWT + Credentials)
│   ├── db/            # Drizzle schema and NeonDB client
│   ├── actions/       # Server actions (balance, session, user)
│   └── game/          # Game engine utilities
├── drizzle/           # Migration SQL files
├── drizzle.config.ts  # Drizzle Kit config
├── middleware.ts      # Route protection (redirects unauthenticated users)
└── .env.local         # Local secrets (gitignored)
```

---

## Troubleshooting

**`Error: DATABASE_URL is not set`**
The dev server cannot find `.env.local`. Make sure the file exists in the project root (same level as `package.json`).

**`relation "users" does not exist`**
The migration has not been applied yet. Run `npm run db:migrate`.

**`AUTH_SECRET is missing`**
NextAuth v5 requires `AUTH_SECRET`. Confirm it is set in `.env.local`. Generate one with:
```bash
openssl rand -hex 32
```

**`NEXTAUTH_URL` redirect loops**
Make sure `NEXTAUTH_URL=http://localhost:3000` in `.env.local` (no trailing slash). If you change the dev port (`next dev --port 4000`), update this value to match.

**NeonDB connection timeout**
Neon suspends inactive databases after a period of inactivity. The first query after a cold start takes 1–2 seconds. This is expected and resolves automatically.
