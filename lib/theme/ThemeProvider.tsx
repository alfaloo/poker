'use client';

import { createContext, useContext, useState } from 'react';
import type { UserSettings } from '@/lib/settings';
import { THEMES, CARD_BACK_THEMES } from '@/lib/theme/themes';
import { DEFAULT_SETTINGS } from '@/lib/settings';

interface ThemeContextValue {
  tableTheme: string;
  cardBackTheme: string;
  setTableTheme: (key: string) => void;
  setCardBackTheme: (key: string) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  tableTheme: DEFAULT_SETTINGS.tableTheme,
  cardBackTheme: DEFAULT_SETTINGS.cardBackTheme,
  setTableTheme: () => {},
  setCardBackTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

interface ThemeProviderProps {
  initialSettings: Pick<UserSettings, 'tableTheme' | 'cardBackTheme'>;
  children: React.ReactNode;
}

export function ThemeProvider({ initialSettings, children }: ThemeProviderProps) {
  const [tableTheme, setTableTheme] = useState(initialSettings.tableTheme);
  const [cardBackTheme, setCardBackTheme] = useState(initialSettings.cardBackTheme);

  const theme = THEMES[tableTheme] ?? THEMES[DEFAULT_SETTINGS.tableTheme];
  // Derive page background by mixing the felt's edge colour with 20% black
  const pageBg = `color-mix(in srgb, ${theme.edgeColor} 75%, black)`;

  return (
    <ThemeContext.Provider value={{ tableTheme, cardBackTheme, setTableTheme, setCardBackTheme }}>
      <div style={{ minHeight: '100svh', backgroundColor: pageBg }}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

// Re-export for convenience
export { THEMES, CARD_BACK_THEMES };
