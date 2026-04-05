import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getGameSessionConfig } from '@/lib/actions/session';
import GameClient from './GameClient';

interface GamePageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function GamePage({ params }: GamePageProps) {
  const { sessionId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const config = await getGameSessionConfig(sessionId);
  if (!config) {
    redirect('/?error=invalid_session');
  }

  const { smallBlind, bigBlind, buyIn, numPlayers, sessionStack } = config;
  const userId = session.user.id;
  const username =
    (session.user as { id: string; username?: string }).username ?? 'You';

  return (
    <GameClient
      sessionId={sessionId}
      userId={userId}
      username={username}
      smallBlind={smallBlind}
      bigBlind={bigBlind}
      buyIn={buyIn}
      numPlayers={numPlayers}
      initialSessionStack={sessionStack}
    />
  );
}
