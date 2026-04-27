// ══════════════════════════════════════════════════════════════
// Login screen — email/password + Google (via expo-auth-session).
//
// Layout (top → bottom):
//   1. Language picker — explicit override of the locale detector
//   2. Logo + welcome subtitle
//   3. Email + password form (or MFA challenge)
//   4. Login button (+ Google when configured)
//   5. Feature highlights — 4 short bullets selling the product
//   6. Footer link to www.iot-fabrikken.com for "learn more"
// ══════════════════════════════════════════════════════════════
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  Linking,
} from 'react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Button,
  FormField,
  FormInput,
  ErrorBanner,
  Logo,
  SegmentedControl,
  Icon,
} from '@/components';
import { colors, spacing, type } from '@/theme';
import { haptic } from '@/lib/haptics';
import {
  isFirebaseConfigured,
  loginWithEmail,
  loginWithGoogleIdToken,
  getMfaResolver,
  verifyTotpSignIn,
  type MultiFactorResolver,
} from '@/services/auth/firebase';
import { useGoogleSignIn } from '@/services/auth/google';
import { env } from '@/lib/env';
import { setLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n';

// Isolated in its own component so the underlying Google.useIdTokenAuthRequest
// hook is only invoked when OAuth client IDs are actually configured. Calling
// the hook with undefined ids throws an invariant on iOS/Android.
function GoogleSignInButton({
  disabled,
  label,
  onToken,
}: {
  disabled: boolean;
  label: string;
  onToken: (idToken: string) => Promise<void>;
}) {
  const { signIn } = useGoogleSignIn(onToken);
  return (
    <Button
      label={label}
      icon="shield-check"
      onPress={() => signIn()}
      variant="secondary"
      fullWidth
      disabled={disabled}
    />
  );
}

export default function LoginScreen() {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  // Language picker — gives the user an explicit choice before
  // logging in. The default still flows through the i18n detector
  // (stored pref → device locale → 'da'), but if the device locale
  // is unsupported (e.g. Italian), users would otherwise be stuck
  // on the Danish fallback until after login.
  const langOptions = SUPPORTED_LANGUAGES.map((code) => ({
    id: code,
    label: code.toUpperCase(),
  }));
  const currentLang = (
    SUPPORTED_LANGUAGES as readonly string[]
  ).includes(i18n.language)
    ? (i18n.language as SupportedLanguage)
    : 'da';

  // Feature highlights shown below the login form. Icon names are
  // Bootstrap-style and resolved through <Icon> to MaterialCommunityIcons.
  const features: readonly { key: string; icon: string }[] = [
    { key: 'monitor', icon: 'broadcast' },
    { key: 'alerts', icon: 'bell' },
    { key: 'trends', icon: 'graph-up' },
    { key: 'locations', icon: 'building' },
  ] as const;

  const openIotFabrikken = () => {
    haptic.light();
    void Linking.openURL('https://www.iot-fabrikken.com');
  };

  const handleGoogleToken = async (idToken: string) => {
    try {
      setSubmitting(true);
      setError(null);
      await loginWithGoogleIdToken(idToken);
      // AuthProvider picks it up via onAuthStateChanged
    } catch (err) {
      setError((err as Error).message ?? t('errors.unknown'));
    } finally {
      setSubmitting(false);
    }
  };

  const googleEnabled =
    Boolean(env.googleOauth.iosClientId || env.googleOauth.androidClientId);

  const onEmailSignIn = async () => {
    setError(null);
    if (!email.trim()) return setError(t('auth.email_required'));
    if (!password) return setError(t('auth.password_required'));
    if (!isFirebaseConfigured()) return setError(t('auth.firebase_not_configured'));
    try {
      setSubmitting(true);
      await loginWithEmail(email.trim(), password);
    } catch (e) {
      const err = e as { code?: string };
      if (err?.code === 'auth/multi-factor-auth-required') {
        try {
          setMfaResolver(getMfaResolver(e));
          setError(null);
        } catch {
          setError(t('auth.mfa.error_init'));
        }
      } else {
        setError(t('auth.invalid_credentials'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onMfaVerify = async () => {
    if (!mfaResolver) return;
    const code = mfaCode.trim();
    if (!/^\d{6}$/.test(code)) {
      setError(t('auth.mfa.error_invalid_code'));
      return;
    }
    const totpHint = mfaResolver.hints.find((h) => h.factorId === 'totp');
    if (!totpHint) {
      setError(t('auth.mfa.error_init'));
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      await verifyTotpSignIn(mfaResolver, totpHint.uid, code);
      // AuthProvider's onAuthStateChanged picks it up and AuthGate redirects.
    } catch {
      setError(t('auth.mfa.error_invalid_code'));
    } finally {
      setSubmitting(false);
    }
  };

  const onMfaCancel = () => {
    setMfaResolver(null);
    setMfaCode('');
    setError(null);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bgPrimary }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          padding: spacing.xl,
          justifyContent: 'center',
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            alignSelf: 'center',
            width: 220,
            marginBottom: spacing.xl,
          }}
        >
          <SegmentedControl<SupportedLanguage>
            value={currentLang}
            onChange={(lang) => setLanguage(lang)}
            options={langOptions}
            size="sm"
            ariaLabel={t('auth.choose_language')}
          />
        </View>

        <View style={{ alignItems: 'center', marginBottom: spacing.xxl }}>
          <Logo width={240} />
          <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.md }]}>
            {t('auth.welcome_subtitle')}
          </Text>
        </View>

        {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

        {mfaResolver ? (
          <View style={{ width: '100%' }}>
            <View style={{ marginBottom: spacing.md }}>
              <Text style={[type.sectionLabel, { marginBottom: 4 }]}>
                {t('auth.mfa.challenge_title')}
              </Text>
              <Text style={type.caption}>{t('auth.mfa.challenge_subtitle')}</Text>
            </View>
            <FormField label={t('auth.mfa.code_label')}>
              <FormInput
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="number-pad"
                maxLength={6}
                value={mfaCode}
                onChangeText={setMfaCode}
                editable={!submitting}
                onSubmitEditing={onMfaVerify}
                autoFocus
              />
            </FormField>
            <Button
              label={t('auth.mfa.verify')}
              onPress={onMfaVerify}
              loading={submitting}
              fullWidth
            />
            <View style={{ marginTop: spacing.md }}>
              <Button
                label={t('common.cancel')}
                onPress={onMfaCancel}
                variant="ghost"
                fullWidth
                disabled={submitting}
              />
            </View>
          </View>
        ) : (
          <View style={{ width: '100%' }}>
            <FormField label={t('auth.email')}>
              <FormInput
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                editable={!submitting}
              />
            </FormField>

            <FormField label={t('auth.password')}>
              <FormInput
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
                value={password}
                onChangeText={setPassword}
                editable={!submitting}
                onSubmitEditing={onEmailSignIn}
              />
            </FormField>

            <Button
              label={t('auth.sign_in')}
              onPress={onEmailSignIn}
              loading={submitting}
              fullWidth
            />

            {googleEnabled ? (
              <View style={{ marginTop: spacing.md }}>
                <GoogleSignInButton
                  label={t('auth.sign_in_with_google')}
                  disabled={submitting}
                  onToken={handleGoogleToken}
                />
              </View>
            ) : null}
          </View>
        )}

        {!isFirebaseConfigured() ? (
          <View style={{ marginTop: spacing.lg }}>
            <ErrorBanner
              tone="warn"
              message={t('auth.firebase_not_configured')}
            />
          </View>
        ) : null}

        {/* Feature highlights — only shown in the regular login flow,
            not during the MFA challenge so the user can focus on the
            6-digit code without distraction. */}
        {!mfaResolver ? (
          <View style={{ marginTop: spacing.xxl }}>
            <View style={{ gap: spacing.sm }}>
              {features.map((f) => (
                <View
                  key={f.key}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: colors.brandAccent + '1A',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon
                      name={f.icon}
                      size={18}
                      color={colors.brandAccent}
                    />
                  </View>
                  <Text
                    style={[
                      type.body,
                      { flex: 1, color: colors.gray[700] },
                    ]}
                  >
                    {t(`auth.features.${f.key}`)}
                  </Text>
                </View>
              ))}
            </View>

            <Pressable
              onPress={openIotFabrikken}
              accessibilityRole="link"
              accessibilityLabel="iot-fabrikken.com"
              style={({ pressed }) => ({
                marginTop: spacing.lg,
                alignSelf: 'center',
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.xs,
                  paddingVertical: spacing.xs,
                  paddingHorizontal: spacing.sm,
                }}
              >
                <Text style={[type.caption, { color: colors.gray[500] }]}>
                  {t('auth.learn_more')}
                </Text>
                <Text
                  style={[
                    type.caption,
                    {
                      color: colors.brandAccent,
                      fontWeight: '600',
                      textDecorationLine: 'underline',
                    },
                  ]}
                >
                  iot-fabrikken.com
                </Text>
              </View>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
