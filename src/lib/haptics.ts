// ══════════════════════════════════════════════════════════════
// Haptic feedback helpers — thin wrapper around expo-haptics.
//
// Use haptic.light() for normal taps, haptic.select() for
// selection changes, haptic.medium() for significant actions,
// and haptic.error() for destructive confirmations.
// ══════════════════════════════════════════════════════════════
import * as Haptics from 'expo-haptics';

export const haptic = {
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  select: () => Haptics.selectionAsync(),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
} as const;
