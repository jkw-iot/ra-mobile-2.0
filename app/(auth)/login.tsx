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
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  FormField,
  FormInput,
  ErrorBanner,
  Logo,
  SegmentedControl,
  Icon,
} from '@/components';
import { colors, spacing, radius, type } from '@/theme';
import { haptic } from '@/lib/haptics';
import { friendlyApiErrorMessage } from '@/lib/apiErrorMessage';
import { useAuth } from '@/services/auth/AuthProvider';
import {
  isFirebaseConfigured,
  loginWithEmail,
  loginWithGoogleIdToken,
  getMfaResolver,
  verifyTotpSignIn,
  type MultiFactorResolver,
} from '@/services/auth/firebase';
import {
  authenticate,
  getStoredCredentials,
  storeCredentials,
} from '@/services/auth/biometrics';
import { useGoogleSignIn } from '@/services/auth/google';
import { useBiometrics } from '@/hooks/useBiometrics';
import { useBiometricStore } from '@/stores/biometricStore';
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
  const { loginError, clearLoginError } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  // Biometric quick re-login
  const { available: biometricAvailable, label: biometricLabel, type: biometricType } = useBiometrics();
  const biometricEnabled = useBiometricStore((s) => s.enabled);
  const markVerified = useBiometricStore((s) => s.markVerified);
  const [hasStoredCreds, setHasStoredCreds] = useState(false);

  useEffect(() => {
    if (biometricEnabled && biometricAvailable) {
      getStoredCredentials().then((creds) => setHasStoredCreds(creds !== null));
    }
  }, [biometricEnabled, biometricAvailable]);

  const canUseBiometric = biometricEnabled && biometricAvailable && hasStoredCreds;

  const onBiometricLogin = async () => {
    const promptMsg = biometricType === 'face'
      ? t('biometric.prompt_faceid')
      : t('biometric.prompt_fingerprint');

    const success = await authenticate(promptMsg);
    if (!success) return;

    const creds = await getStoredCredentials();
    if (!creds) {
      setError(t('biometric.credentials_expired'));
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      clearLoginError();
      await loginWithEmail(creds.email, creds.password);
      markVerified();
    } catch (e) {
      const err = e as { code?: string };
      if (err?.code === 'auth/multi-factor-auth-required') {
        setError(t('biometric.mfa_not_supported'));
      } else {
        setError(t('biometric.credentials_expired'));
      }
    } finally {
      setSubmitting(false);
    }
  };
  // Backend-sync failures (Hono / Legacy unreachable after a
  // successful Firebase auth) come through `useAuth().loginError`
  // and trump the local form errors — they're more actionable
  // than e.g. a transient invalid-credentials hint.
  const displayedError = loginError
    ? friendlyApiErrorMessage(loginError, t)
    : error;
  const dismissDisplayedError = () => {
    if (loginError) clearLoginError();
    setError(null);
  };

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
      clearLoginError();
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
    clearLoginError();
    if (!email.trim()) return setError(t('auth.email_required'));
    if (!password) return setError(t('auth.password_required'));
    if (!isFirebaseConfigured()) return setError(t('auth.firebase_not_configured'));
    try {
      setSubmitting(true);
      await loginWithEmail(email.trim(), password);
      // Store credentials for biometric re-login if enabled
      if (biometricEnabled) {
        storeCredentials(email.trim(), password).catch(() => {});
      }
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
      clearLoginError();
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
    <View style={{ flex: 1, backgroundColor: colors.navy }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + spacing.xl }}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Hero header ── */}
          <View
            style={{
              paddingTop: insets.top + spacing.xl,
              paddingBottom: spacing.xxl,
              paddingHorizontal: spacing.xl,
              alignItems: 'center',
            }}
          >
            <Logo variant="white" width={200} />
            <Text
              style={[
                type.caption,
                { color: 'rgba(255,255,255,0.65)', textAlign: 'center', marginTop: spacing.sm },
              ]}
            >
              {t('auth.welcome_subtitle')}
            </Text>
          </View>

          {/* ── Content area ── */}
          <View
            style={{
              flex: 1,
              backgroundColor: colors.bgPrimary,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              paddingHorizontal: spacing.xl,
              paddingTop: spacing.xl,
            }}
          >
            {/* Language picker */}
            <View style={{ alignSelf: 'center', width: 220, marginBottom: spacing.xl }}>
              <SegmentedControl<SupportedLanguage>
                value={currentLang}
                onChange={(lang) => setLanguage(lang)}
                options={langOptions}
                size="sm"
                ariaLabel={t('auth.choose_language')}
              />
            </View>

            {displayedError ? (
              <View style={{ marginBottom: spacing.md }}>
                <ErrorBanner message={displayedError} onDismiss={dismissDisplayedError} />
              </View>
            ) : null}

            {/* ── Form card ── */}
            <View
              style={{
                backgroundColor: colors.white,
                borderRadius: radius.lg,
                padding: spacing.lg,
                marginBottom: spacing.xl,
                shadowColor: colors.black,
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.07,
                shadowRadius: 4,
                elevation: 2,
              }}
            >
              {mfaResolver ? (
                <View>
                  {/* MFA header */}
                  <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
                    <View
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 26,
                        backgroundColor: colors.brand + '1A',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: spacing.sm,
                      }}
                    >
                      <Icon name="shield-lock" size={26} color={colors.brand} />
                    </View>
                    <Text style={[type.bodyStrong, { textAlign: 'center' }]}>
                      {t('auth.mfa.challenge_title')}
                    </Text>
                    <Text
                      style={[
                        type.caption,
                        { textAlign: 'center', marginTop: spacing.xs },
                      ]}
                    >
                      {t('auth.mfa.challenge_subtitle')}
                    </Text>
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
                <View>
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

                  {canUseBiometric ? (
                    <View style={{ marginTop: spacing.md }}>
                      <Button
                        label={t('biometric.login_button', { type: biometricLabel })}
                        icon={biometricType === 'face' ? 'person-bounding-box' : 'fingerprint'}
                        onPress={onBiometricLogin}
                        variant="secondary"
                        fullWidth
                        disabled={submitting}
                      />
                    </View>
                  ) : null}

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
            </View>

            {!isFirebaseConfigured() ? (
              <View style={{ marginBottom: spacing.lg }}>
                <ErrorBanner tone="warn" message={t('auth.firebase_not_configured')} />
              </View>
            ) : null}

            {/* Feature highlights — hidden during MFA challenge */}
            {!mfaResolver ? (
              <View style={{ gap: spacing.sm }}>
                {features.map((f) => (
                  <View
                    key={f.key}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: colors.brand + '1A',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon name={f.icon} size={18} color={colors.brand} />
                    </View>
                    <Text style={[type.body, { flex: 1 }]}>
                      {t(`auth.features.${f.key}`)}
                    </Text>
                  </View>
                ))}

                <Pressable
                  onPress={openIotFabrikken}
                  accessibilityRole="link"
                  accessibilityLabel="iot-fabrikken.com"
                  style={({ pressed }) => ({
                    marginTop: spacing.sm,
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
                          color: colors.brand,
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
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
