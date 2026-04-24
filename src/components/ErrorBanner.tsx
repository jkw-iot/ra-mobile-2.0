import { View, Text, Pressable } from 'react-native';

import { colors, radius, spacing, type } from '@/theme';
import { Icon } from './Icon';

export type ErrorTone = 'error' | 'warn' | 'info';

export interface ErrorBannerProps {
  message: string;
  tone?: ErrorTone;
  onDismiss?: () => void;
}

const TONE_STYLES: Record<ErrorTone, { bg: string; fg: string; icon: string }> = {
  error: { bg: '#FBEAEA', fg: colors.statusBad, icon: 'exclamation-triangle-fill' },
  warn:  { bg: '#FDF3E3', fg: colors.statusWarn, icon: 'exclamation-triangle' },
  info:  { bg: '#EAF2FB', fg: colors.brandAccent, icon: 'info-circle' },
};

export function ErrorBanner({ message, tone = 'error', onDismiss }: ErrorBannerProps) {
  const s = TONE_STYLES[tone];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: s.bg,
        borderRadius: radius.md,
        padding: spacing.md,
        margin: spacing.md,
      }}
    >
      <Icon name={s.icon} color={s.fg} size={18} />
      <Text style={[type.body, { color: s.fg, flex: 1 }]}>{message}</Text>
      {onDismiss ? (
        <Pressable
          onPress={onDismiss}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        >
          <Icon name="x" color={s.fg} size={18} />
        </Pressable>
      ) : null}
    </View>
  );
}

export default ErrorBanner;
