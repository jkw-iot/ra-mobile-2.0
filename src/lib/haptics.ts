// ══════════════════════════════════════════════════════════════
// Haptic feedback helpers — thin wrapper around expo-haptics.
//
// Use haptic.light() for normal taps, haptic.select() for
// selection changes, haptic.medium() for significant actions,
// and haptic.error() for destructive confirmations.
//
// Each step is intentionally one notch firmer than the most
// literal mapping would suggest — the previous defaults
// (`selectionAsync` for select, `Light` for light) were almost
// imperceptible on modern iPhones, especially with a case on,
// so call sites couldn't reliably "feel" their taps. The
// semantic ordering (select < light < medium < heavy) is
// preserved; only the absolute intensity is bumped.
// ══════════════════════════════════════════════════════════════
import * as Haptics from 'expo-haptics';

export const haptic = {
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  select: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
} as const;
