import { Table } from 'poker-ts';

type PokerTable = InstanceType<typeof Table>;

export async function takeBotAction(table: PokerTable, delayMs: number = 800): Promise<void> {
  await new Promise<void>(resolve => setTimeout(resolve, delayMs));

  const { actions } = table.legalActions();

  if (actions.includes('check')) {
    table.actionTaken('check');
  } else {
    table.actionTaken('call');
  }
}
