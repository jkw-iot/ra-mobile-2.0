// ══════════════════════════════════════════════════════════════
// ErrorState — full-screen / full-section empty-error layout.
//
// Used for unrecoverable errors that dominate the UI (e.g. a
// detail screen that couldn't load anything). Presents a big
// friendly icon, a short title, a longer description, and one
// or two action buttons.
//
// For inline / list-level errors use <ErrorBanner> instead.
// ══════════════════════════════════════════════════════════════
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing, type } from '@/theme';
import { Icon } from './Icon';

export interface ErrorStateAction {
  label: string;
  icon?: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
}

export interface ErrorStateProps {
  title?: string;
  message?: string;
  icon?: string;
  tone?: 'error' | 'empty';
  actions?: ErrorStateAction[];
}

export function ErrorState({
  title,
  message,
  icon,
  tone = 'error',
  actions = [],
}: ErrorStateProps) {
  const { t } = useTranslation();
  const isError = tone === 'error';

  const resolvedTitle = title ?? (isError ? t('errors.unknown') : t('common.empty'));
  const resolvedIcon = icon ?? (isError ? 'exclamation-triangle' : 'info-circle');
  const badgeBg = isError ? 'rgba(214,91,91,0.10)' : 'rgba(52,152,219,0.10)';
  const iconTone = isError ? colors.statusBad : colors.brandAccent;

  return (
    <View
      style={{
        flex: 1,
        padding: spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.lg,
      }}
    >
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: 48,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: badgeBg,
        }}
      >
        <Icon name={resolvedIcon} color={iconTone} size={44} />
      </View>
      <View style={{ gap: 8, alignItems: 'center' }}>
        <Text
          style={{
            fontSize: 20,
            fontWeight: '700',
            color: colors.brandDark,
            textAlign: 'center',
            letterSpacing: -0.3,
          }}
        >
          {resolvedTitle}
        </Text>
        {message ? (
          <Text
            style={[
              type.body,
              {
                textAlign: 'center',
                color: colors.gray[700],
                maxWidth: 320,
              },
            ]}
          >
            {message}
          </Text>
        ) : null}
      </View>

      {actions.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', justifyContent: 'center' }}>
          {actions.map((a, i) => {
            const isPrimary = (a.variant ?? (i === 0 ? 'primary' : 'secondary')) === 'primary';
            return (
              <Pressable
                key={a.label + i}
                onPress={a.onPress}
                accessibilityRole="button"
                accessibilityLabel={a.label}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                  borderRadius: radius.md,
                  backgroundColor: isPrimary
                    ? (pressed ? colors.brand : colors.brandAccent)
                    : (pressed ? colors.gray[100] : colors.white),
                  borderWidth: isPrimary ? 0 : 1,
                  borderColor: colors.gray[200],
                })}
              >
                {a.icon ? (
                  <Icon
                    name={a.icon}
                    color={isPrimary ? colors.white : colors.brandDark}
                    size={16}
                  />
                ) : null}
                <Text
                  style={[
                    type.buttonLabel,
                    { color: isPrimary ? colors.white : colors.brandDark },
                  ]}
                >
                  {a.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export default ErrorState;
