import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { auth } from "@/lib/auth";
import { applyDailyRewardCached } from "@/lib/daily-reward-cached";

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

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="min-h-screen bg-green-950">
          {children}
        </div>
      </body>
    </html>
  );
}
