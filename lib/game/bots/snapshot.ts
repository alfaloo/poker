import { Table } from 'poker-ts';
import { TableSnapshot, Position, BotAction } from './types';

type PokerTable = InstanceType<typeof Table>;

function derivePosition(
  botSeat: number,
  button: number,
  activeSeatIndices: number[]
): Position {
  const n = activeSeatIndices.length;
  if (n === 0) return 'BTN';

  const buttonIdx = activeSeatIndices.indexOf(button);
  const botIdx = activeSeatIndices.indexOf(botSeat);

  // Offset relative to the button seat within active players
  const offset = buttonIdx >= 0
    ? (botIdx - buttonIdx + n) % n
    : botIdx;

  if (n <= 2) {
    return offset === 0 ? 'BTN' : 'BB';
  }

  if (offset === 0) return 'BTN';
  if (offset === 1) return 'SB';
  if (offset === 2) return 'BB';
  if (offset === n - 1) return 'CO';
  if (offset === n - 2) return 'MP';
  return 'UTG';
}

export function extractTableSnapshot(
  table: PokerTable,
  botSeat: number,
  bigBlind: number
): TableSnapshot {
  const holeCardsAll = table.holeCards();
  const botHoleCards = holeCardsAll[botSeat] ?? [];
  const holeCards = [botHoleCards[0], botHoleCards[1]] as [
    { rank: string; suit: string },
    { rank: string; suit: string }
  ];

  const communityCards = table.communityCards() as { rank: string; suit: string }[];
  const street = table.roundOfBetting();
  const potSize = table.pots().reduce((sum, pot) => sum + pot.size, 0);

  const seats = table.seats();
  const botSeatData = seats[botSeat];
  const botBet = botSeatData?.betSize ?? 0;
  const botStack = botSeatData?.stack ?? 0;
  const maxBet = seats.reduce((max, s) => (s !== null ? Math.max(max, s.betSize) : max), 0);
  const toCall = Math.max(0, maxBet - botBet);

  const { actions, chipRange } = table.legalActions();
  const minRaise = chipRange?.min ?? bigBlind;
  const maxRaise = chipRange?.max ?? (botStack + botBet);

  // Active seats are those present in handPlayers (non-null)
  const handPlayers = table.handPlayers();
  const activeSeatIndices = handPlayers
    .map((p, i) => (p !== null ? i : -1))
    .filter(i => i >= 0);
  const numActivePlayers = activeSeatIndices.length || seats.filter(s => s !== null).length;

  const position = derivePosition(botSeat, table.button(), activeSeatIndices);

  const legalActions = actions as BotAction[];

  return {
    holeCards,
    communityCards,
    street,
    potSize,
    toCall,
    minRaise,
    maxRaise,
    botStack,
    bigBlind,
    position,
    numActivePlayers,
    legalActions,
  };
}
