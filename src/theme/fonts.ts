// ══════════════════════════════════════════════════════════════
// Font loading — Inter family
//
// Mirrors the web app which loads Inter 300/400/500/600/700 via
// Google Fonts. Loaded once in app/_layout.tsx via useFonts().
// ══════════════════════════════════════════════════════════════
import {
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

export const fontMap = {
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} as const;

export type FontWeight = 'light' | 'regular' | 'medium' | 'semibold' | 'bold';

export function fontFamily(weight: FontWeight = 'regular'): string {
  switch (weight) {
    case 'light':
      return 'Inter_300Light';
    case 'medium':
      return 'Inter_500Medium';
    case 'semibold':
      return 'Inter_600SemiBold';
    case 'bold':
      return 'Inter_700Bold';
    case 'regular':
    default:
      return 'Inter_400Regular';
  }
}
