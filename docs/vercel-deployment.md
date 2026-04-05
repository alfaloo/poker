# Vercel Deployment Guide

This project is a Next.js 14 app backed by NeonDB (serverless Postgres). It is designed to deploy on Vercel with zero configuration beyond setting environment variables.

---

## Prerequisites

- A [Vercel](https://vercel.com) account
- The project pushed to a GitHub/GitLab/Bitbucket repository
- An existing [NeonDB](https://neon.tech) database (already provisioned — credentials are in `.env.local`)

---

## Step 1 — Import the project into Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Add New > Project** and select the repository
3. Vercel auto-detects Next.js — leave the framework preset as **Next.js**
4. Leave build and output settings at their defaults:
   - Build command: `next build`
   - Output directory: `.next`
   - Install command: `npm install`

---

## Step 2 — Set environment variables

In the Vercel project dashboard go to **Settings > Environment Variables** and add the following. All three are required for the app to start.

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | Neon pooled connection string | Use the **pooled** URL (via PgBouncer). Copy from `.env.local`. |
| `AUTH_SECRET` | Random 32-byte hex string | Copy the `AUTH_SECRET` value from `.env.local`, or generate a new one with `openssl rand -hex 32`. |
| `NEXTAUTH_URL` | `https://<your-app>.vercel.app` | Set this to the production URL Vercel assigns. For preview deployments you can omit it — NextAuth v5 infers the URL automatically. |

> **Optional Postgres variables** (`POSTGRES_URL`, `POSTGRES_USER`, etc.) are not required by the app code — only `DATABASE_URL` is used in `lib/db/index.ts`.

> **Do not commit `.env.local`** to the repository. It contains live database credentials.

### Where each variable is used

| Variable | Used in |
|---|---|
| `DATABASE_URL` | `lib/db/index.ts` — NeonDB + Drizzle client |
| `AUTH_SECRET` | `lib/auth.ts` — NextAuth JWT signing |
| `NEXTAUTH_URL` | `lib/auth.ts` — redirect URLs for NextAuth (production only) |

---

## Step 3 — Run database migrations

The migration SQL is already generated in [drizzle/0000_famous_scarlet_spider.sql](../drizzle/0000_famous_scarlet_spider.sql). Apply it **once** against the Neon database before the first deploy.

**Option A — npm script (recommended)**

```bash
npm run db:migrate
```

This reads `DATABASE_URL` from `.env.local` and applies any pending migrations using the Neon HTTP transport. This works on all networks (no direct TCP access to port 5432 required).

**Option B — Run the SQL directly**

Paste the contents of `drizzle/0000_famous_scarlet_spider.sql` into the Neon SQL console at [console.neon.tech](https://console.neon.tech).

The migration creates:
- `users` table
- `game_sessions` table
- `leaderboard` view

If the tables already exist (you ran a previous migration), skip this step.

---

## Step 4 — Deploy

Click **Deploy** in the Vercel UI, or push to your main branch — Vercel triggers a build automatically.

The build runs `next build`, which compiles server components, server actions, and the middleware. No special build flags are needed.

---

## Step 5 — Verify the deployment

1. Open the production URL
2. You should be redirected to `/login` (the middleware protects all routes)
3. Register a new account → you are redirected to the lobby (`/`)
4. Confirm the daily reward check ran (balance should be 400 on first login)
5. Start a Beginner game to confirm the database read/write cycle works

---

## Environment variable summary

```env
# Required
DATABASE_URL=postgresql://neondb_owner:<password>@<host-pooler>.neon.tech/neondb?channel_binding=require&sslmode=require
AUTH_SECRET=<32-byte hex>
NEXTAUTH_URL=https://<your-app>.vercel.app

# Not required by the app (safe to omit)
DATABASE_URL_UNPOOLED=...
POSTGRES_URL=...
POSTGRES_USER=...
POSTGRES_HOST=...
POSTGRES_PASSWORD=...
POSTGRES_DATABASE=...
POSTGRES_URL_NO_SSL=...
POSTGRES_PRISMA_URL=...
```

---

## Notes on the Neon connection

`lib/db/index.ts` uses `@neondatabase/serverless` with the HTTP transport (`drizzle-orm/neon-http`). This is the correct driver for Vercel's serverless/edge runtime — it does not require a persistent TCP connection.

Use the **pooled** `DATABASE_URL` (the one with `-pooler` in the hostname) in Vercel. The unpooled URL is only needed for long-running processes or migration scripts that issue `CREATE INDEX CONCURRENTLY`.

---

## Redeployments and future migrations

When schema changes are made:

1. Update `lib/db/schema.ts`
2. Generate a new migration: `npx drizzle-kit generate`
3. Apply it: `npm run db:migrate`
4. Commit the new file under `drizzle/` and push — Vercel redeploys automatically

There is no migration step inside the Vercel build; migrations are always run manually (or via a one-off script) before deploying breaking schema changes.
