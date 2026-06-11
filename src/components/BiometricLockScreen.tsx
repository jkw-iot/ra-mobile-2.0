// ══════════════════════════════════════════════════════════════
// BiometricLockScreen — full-screen overlay that blocks the app
// until the user authenticates via Face ID / fingerprint.
//
// Mounted by AuthGate when:
//   1. Biometric is enabled (useBiometricStore.enabled)
//   2. App returned from background after lockTimeoutMinutes elapsed
//
// The parent controls visibility via the `visible` prop so the
// AppState listener logic lives in the layout (close to AuthGate).
// ══════════════════════════════════════════════════════════════
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useCallback, useEffect } from 'react';

import { Icon, Logo } from '@/components';
import { colors, spacing, radius, type as typo } from '@/theme';
import { haptic } from '@/lib/haptics';
import { authenticate } from '@/services/auth/biometrics';
import { useBiometricStore } from '@/stores/biometricStore';
import { useBiometrics } from '@/hooks/useBiometrics';

interface Props {
  visible: boolean;
  onUnlocked: () => void;
  onFallbackLogin: () => void;
}

export function BiometricLockScreen({ visible, onUnlocked, onFallbackLogin }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const markVerified = useBiometricStore((s) => s.markVerified);
  const { label: biometryLabel, type: biometryType } = useBiometrics();

  const promptIcon = biometryType === 'face' ? 'person-bounding-box' : 'fingerprint';

  const doAuthenticate = useCallback(async () => {
    const promptMsg = biometryType === 'face'
      ? t('biometric.prompt_faceid')
      : t('biometric.prompt_fingerprint');

    const success = await authenticate(promptMsg);
    if (success) {
      markVerified();
      haptic.light();
      onUnlocked();
    }
  }, [biometryType, markVerified, onUnlocked, t]);

  useEffect(() => {
    if (visible) {
      doAuthenticate();
    }
  }, [visible, doAuthenticate]);

  if (!visible) return null;

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        backgroundColor: colors.navy,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        paddingHorizontal: spacing.xl,
      }}
    >
      <Logo variant="white" width={160} />

      <Text
        style={[
          typo.bodyStrong,
          { color: colors.white, textAlign: 'center', marginTop: spacing.xxl },
        ]}
      >
        {t('biometric.lock_title')}
      </Text>
      <Text
        style={[
          typo.caption,
          { color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: spacing.sm },
        ]}
      >
        {t('biometric.lock_subtitle')}
      </Text>

      {/* Unlock button */}
      <Pressable
        onPress={doAuthenticate}
        accessibilityRole="button"
        accessibilityLabel={t('biometric.unlock_button', { type: biometryLabel })}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, marginTop: spacing.xxxl })}
      >
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: 'rgba(255,255,255,0.12)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={promptIcon} size={36} color={colors.white} />
        </View>
      </Pressable>

      <Text
        style={[
          typo.caption,
          { color: 'rgba(255,255,255,0.5)', marginTop: spacing.lg, textAlign: 'center' },
        ]}
      >
        {t('biometric.tap_to_unlock', { type: biometryLabel })}
      </Text>

      {/* Fallback: use password */}
      <Pressable
        onPress={() => {
          haptic.light();
          onFallbackLogin();
        }}
        accessibilityRole="button"
        style={({ pressed }) => ({
          opacity: pressed ? 0.6 : 1,
          marginTop: spacing.xxl,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.xl,
          borderRadius: radius.full,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.25)',
        })}
      >
        <Text style={[typo.buttonLabel, { color: colors.white }]}>
          {t('biometric.use_password')}
        </Text>
      </Pressable>
    </View>
  );
}
