// ══════════════════════════════════════════════════════════════
// ErrorBanner — inline, dismissible status message used in
// lists and forms. Keeps its previous API so existing call sites
// don't need to change, but renders a softer card with a colour-
// matched icon and a subtle border instead of a flat background.
// ══════════════════════════════════════════════════════════════
import { View, Text, Pressable } from 'react-native';

import { colors, radius, spacing, type } from '@/theme';
import { Icon } from './Icon';

export type ErrorTone = 'error' | 'warn' | 'info';

export interface ErrorBannerProps {
  message: string;
  tone?: ErrorTone;
  onDismiss?: () => void;
}

interface ToneStyle {
  bg: string;
  border: string;
  fg: string;
  iconBg: string;
  icon: string;
}

const TONE_STYLES: Record<ErrorTone, ToneStyle> = {
  error: {
    bg: '#FDF1F1',
    border: 'rgba(214,91,91,0.25)',
    fg: colors.statusBad,
    iconBg: 'rgba(214,91,91,0.14)',
    icon: 'exclamation-triangle-fill',
  },
  warn: {
    bg: '#FEF7EC',
    border: 'rgba(240,173,78,0.3)',
    fg: '#8A5A0B',
    iconBg: 'rgba(240,173,78,0.18)',
    icon: 'exclamation-triangle',
  },
  info: {
    bg: '#EFF6FC',
    border: 'rgba(52,152,219,0.28)',
    fg: colors.brandAccent,
    iconBg: 'rgba(52,152,219,0.16)',
    icon: 'info-circle',
  },
};

export function ErrorBanner({ message, tone = 'error', onDismiss }: ErrorBannerProps) {
  const s = TONE_STYLES[tone];
  return (
    <View
      accessibilityRole="alert"
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
        backgroundColor: s.bg,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: s.border,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        marginHorizontal: spacing.md,
        marginVertical: spacing.sm,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: s.iconBg,
        }}
      >
        <Icon name={s.icon} color={s.fg} size={16} />
      </View>
      <Text
        style={[
          type.body,
          {
            color: s.fg,
            flex: 1,
            paddingTop: 6,
            lineHeight: 20,
          },
        ]}
      >
        {message}
      </Text>
      {onDismiss ? (
        <Pressable
          onPress={onDismiss}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          style={{
            width: 28,
            height: 28,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 14,
          }}
        >
          <Icon name="x" color={s.fg} size={16} />
        </Pressable>
      ) : null}
    </View>
  );
}

export default ErrorBanner;
