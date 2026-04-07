import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { applyDailyRewardCached } from "@/lib/daily-reward-cached";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { mergeSettings } from "@/lib/settings";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Poker",
  description: "Texas Hold'em poker game",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  // Run the daily reward check on every authenticated page load.
  // applyDailyRewardCached is deduplicated via React cache() so the DB call
  // is made only once even when the lobby page also calls it in the same request.
  if (session?.user?.id) {
    await applyDailyRewardCached(session.user.id);
  }

  // Fetch user settings to seed the ThemeProvider
  let initialSettings = { tableTheme: 'forest', cardBackTheme: 'crimson' };
  if (session?.user?.id) {
    const [user] = await db
      .select({ settings: users.settings })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    if (user) {
      const merged = mergeSettings(user.settings ?? {});
      initialSettings = {
        tableTheme: merged.tableTheme,
        cardBackTheme: merged.cardBackTheme,
      };
    }
  }

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider initialSettings={initialSettings}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
