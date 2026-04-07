export interface TableTheme {
  name: string;
  /** CSS radial-gradient string for the felt */
  felt: string;
  /** Darkest stop of the felt gradient — page bg is derived from this via color-mix */
  edgeColor: string;
  /** Centre colour of the felt (used for swatch preview) */
  swatchColor: string;
}

export interface CardBackTheme {
  name: string;
  /** Main background fill */
  bg: string;
  /** Cross-hatch stroke colour */
  grid: string;
  /** Center diamond outline colour */
  diamond: string;
}

export const THEMES: Record<string, TableTheme> = {
  'forest': {
    name: 'Forest',
    felt: 'radial-gradient(ellipse at 50% 40%, #22883f 0%, #165c2c 55%, #0c3d1c 100%)',
    edgeColor: '#0c3d1c',
    swatchColor: '#22883f',
  },
  maroon: {
    name: 'Maroon',
    felt: 'radial-gradient(ellipse at 50% 40%, #8b1a1a 0%, #6b1212 55%, #450b0b 100%)',
    edgeColor: '#450b0b',
    swatchColor: '#8b1a1a',
  },
  navy: {
    name: 'Navy',
    felt: 'radial-gradient(ellipse at 50% 40%, #1a2f6b 0%, #122254 55%, #0b1638 100%)',
    edgeColor: '#0b1638',
    swatchColor: '#1a2f6b',
  },
  terracotta: {
    name: 'Terracotta',
    felt: 'radial-gradient(ellipse at 50% 40%, #a0522d 0%, #7a3a1e 55%, #542410 100%)',
    edgeColor: '#542410',
    swatchColor: '#a0522d',
  },
  violet: {
    name: 'Violet',
    felt: 'radial-gradient(ellipse at 50% 40%, #5b2d8e 0%, #421f6b 55%, #2c1248 100%)',
    edgeColor: '#2c1248',
    swatchColor: '#5b2d8e',
  },
  slate: {
    name: 'Slate',
    felt: 'radial-gradient(ellipse at 50% 40%, #2e4a6b 0%, #1e3452 55%, #111f38 100%)',
    edgeColor: '#111f38',
    swatchColor: '#2e4a6b',
  },
  chocolate: {
    name: 'Chocolate',
    felt: 'radial-gradient(ellipse at 50% 40%, #6b3a1f 0%, #4f2812 55%, #341807 100%)',
    edgeColor: '#341807',
    swatchColor: '#6b3a1f',
  },
  sand: {
    name: 'Sand',
    felt: 'radial-gradient(ellipse at 50% 40%, #c4a57b 0%, #9c7d54 55%, #6b5233 100%)',
    edgeColor: '#6b5233',
    swatchColor: '#c4a57b',
  },
};

export const CARD_BACK_THEMES: Record<string, CardBackTheme> = {
  crimson: {
    name: 'Crimson',
    bg: '#7f1d1d',
    grid: '#991b1b',
    diamond: '#fca5a5',
  },
  'midnight': {
    name: 'Midnight',
    bg: '#1e3a5f',
    grid: '#1e4976',
    diamond: '#93c5fd',
  },
  emerald: {
    name: 'Emerald',
    bg: '#14532d',
    grid: '#166534',
    diamond: '#86efac',
  },
  obsidian: {
    name: 'Obsidian',
    bg: '#1c1c2e',
    grid: '#2a2a4a',
    diamond: '#a5b4fc',
  },
  ivory: {
    name: 'Ivory',
    bg: '#d6c9a8',
    grid: '#c4b48e',
    diamond: '#78716c',
  },
  pumpkin: {
    name: 'Pumpkin',
    bg: '#de741e',
    grid: '#913110',
    diamond: '#ffce9a',
  },
  royal: {
    name: 'Royal',
    bg: '#3b0764',
    grid: '#6b21a8',
    diamond: '#e9d5ff',
  },
  gold: {
    name: 'Gold',
    bg: '#f3da22',
    grid: '#83760f',
    diamond: '#fffbe0',
  },
};
