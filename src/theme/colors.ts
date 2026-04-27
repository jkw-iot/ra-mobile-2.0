// ══════════════════════════════════════════════════════════════
// Design tokens — colors
//
// Mirrors the web app's palette exactly. Update tailwind.config.js
// alongside any change here so NativeWind class names stay in sync.
// ══════════════════════════════════════════════════════════════

export const colors = {
  brand: '#5D7C8F',
  brandAccent: '#3498DB',
  brandDark: '#2C3E50',

  // Dark chrome — used for the app header, drawer header and other
  // "navigation" surfaces. Mirrors the web app's navbar so the mobile
  // feels instantly familiar to existing users.
  navy: '#1F2D3D',
  navySoft: '#2A3B50',

  bgPrimary: '#F4F6F9',
  modalHeader: '#EBF5FB',

  statusGood: '#6c9e83',
  statusWarn: '#f0ad4e',
  statusBad: '#d65b5b',
  statusOrange: '#d4844a',

  pi: {
    risk: '#d63031',
    unstable: '#e17055',
    good: '#5da83a',
    veryGood: '#1e854a',
    outstanding: '#2980b9',
  },

  // Dusty palette — MANDATORY for scenarios/charts/accents.
  // Never introduce saturated colors outside this list unless the
  // user explicitly requests it.
  dusty: [
    '#5D7C8F', // blue-gray (brand)
    '#6c9e83', // sage green
    '#f0ad4e', // amber / gold
    '#d65b5b', // red — sparingly, alarms only
    '#2C3E50', // navy
    '#7a8c7e', // muted sage
    '#8e7c5d', // taupe
    '#5b8fa1', // steel teal
  ] as const,

  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },

  white: '#FFFFFF',
  black: '#000000',
} as const;

export type StatusTone = 'good' | 'warn' | 'bad' | 'neutral';

export function toneColor(tone: StatusTone): string {
  switch (tone) {
    case 'good':
      return colors.statusGood;
    case 'warn':
      return colors.statusWarn;
    case 'bad':
      return colors.statusBad;
    case 'neutral':
    default:
      return colors.gray[500];
  }
}
