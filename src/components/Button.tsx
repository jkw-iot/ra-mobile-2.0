// ══════════════════════════════════════════════════════════════
// Button — primary CTA.
//
// Variants: primary (brand-accent fill), ghost (text only),
// danger (status-bad fill). Always ≥ 44 px tall for touch target.
// ══════════════════════════════════════════════════════════════
import { Pressable, Text, ActivityIndicator, View } from 'react-native';
import type { ReactNode } from 'react';

import { colors, radius, spacing, TOUCH_TARGET, type } from '@/theme';
import { Icon } from './Icon';

export type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'secondary';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  children?: ReactNode;
}

const VARIANTS: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.brandAccent, fg: colors.white },
  secondary: { bg: colors.white, fg: colors.brandDark, border: colors.gray[300] },
  ghost: { bg: 'transparent', fg: colors.gray[700] },
  danger: { bg: colors.statusBad, fg: colors.white },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  fullWidth,
}: ButtonProps) {
  const v = VARIANTS[variant];
  const dim = disabled || loading;

  return (
    <Pressable
      onPress={dim ? undefined : onPress}
      style={({ pressed }) => ({
        minHeight: TOUCH_TARGET,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        backgroundColor: v.bg,
        borderRadius: radius.md,
        borderWidth: v.border ? 1 : 0,
        borderColor: v.border,
        opacity: dim ? 0.5 : pressed ? 0.85 : 1,
        alignSelf: fullWidth ? 'stretch' : 'flex-start',
      })}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: dim }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
        }}
      >
        {loading ? (
          <ActivityIndicator size="small" color={v.fg} />
        ) : icon ? (
          <Icon name={icon} color={v.fg} size={18} />
        ) : null}
        <Text style={[type.buttonLabel, { color: v.fg }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

export default Button;
