// ══════════════════════════════════════════════════════════════
// Biometric authentication — expo-local-authentication wrapper
//
// Provides:
// - Hardware capability checks (Face ID / fingerprint / iris)
// - Authentication prompt
// - Secure credential storage (expo-secure-store) for quick re-login
//
// Credentials are stored in iOS Keychain / Android EncryptedSharedPreferences
// via expo-secure-store — never in MMKV or AsyncStorage.
// ══════════════════════════════════════════════════════════════
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const CREDENTIALS_KEY = 'roomalyzer_biometric_credentials';

export type BiometryType = 'face' | 'fingerprint' | 'iris' | 'none';

export interface BiometricCapability {
  available: boolean;
  biometryType: BiometryType;
  rawTypes: LocalAuthentication.AuthenticationType[];
}

export async function getBiometricCapability(): Promise<BiometricCapability> {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

  const available = compatible && enrolled;

  let biometryType: BiometryType = 'none';
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    biometryType = 'face';
  } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    biometryType = 'fingerprint';
  } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    biometryType = 'iris';
  }

  return { available, biometryType, rawTypes: types };
}

export async function authenticate(promptMessage: string): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: 'Annuller',
    disableDeviceFallback: false,
    fallbackLabel: 'Brug kode',
  });
  return result.success;
}

// ── Credential storage (Scenario B: quick re-login) ─────────

export async function storeCredentials(email: string, password: string): Promise<void> {
  await SecureStore.setItemAsync(
    CREDENTIALS_KEY,
    JSON.stringify({ email, password }),
  );
}

export async function getStoredCredentials(): Promise<{ email: string; password: string } | null> {
  const raw = await SecureStore.getItemAsync(CREDENTIALS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { email: string; password: string };
  } catch {
    return null;
  }
}

export async function clearStoredCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(CREDENTIALS_KEY);
}
