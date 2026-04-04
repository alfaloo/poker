import { Table } from 'poker-ts';

export const BOT_THINK_DELAY_MS = 2000;

type PokerTable = InstanceType<typeof Table>;

export async function takeBotAction(table: PokerTable, seat: number): Promise<void> {
  await new Promise<void>(resolve => setTimeout(resolve, BOT_THINK_DELAY_MS));

  const { actions } = table.legalActions();

  if (actions.includes('check')) {
    table.actionTaken('check');
  } else {
    table.actionTaken('call');
  }
}
