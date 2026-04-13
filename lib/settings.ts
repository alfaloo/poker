export interface UserSettings {
  botDelayMs: number;
  botDelayEnabled: boolean;
  tableTheme: string;
  cardBackTheme: string;
}

export const DEFAULT_SETTINGS: UserSettings = {
  botDelayMs: 800,
  botDelayEnabled: true,
  tableTheme: 'forest',
  cardBackTheme: 'crimson',
};

export function mergeSettings(stored: Partial<UserSettings>): UserSettings {
  return { ...DEFAULT_SETTINGS, ...stored };
}
