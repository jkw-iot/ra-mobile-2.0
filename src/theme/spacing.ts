// ══════════════════════════════════════════════════════════════
// Spacing scale — 4px base unit
// ══════════════════════════════════════════════════════════════

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 4,
  md: 6,
  lg: 10,
  xl: 16,
  full: 999,
} as const;

// Mobile touch target minimum (WCAG + iOS HIG + Material guidance)
export const TOUCH_TARGET = 44;
