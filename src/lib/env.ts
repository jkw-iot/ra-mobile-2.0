// ══════════════════════════════════════════════════════════════
// Environment configuration
//
// Values are injected at build time via app.json's `extra` field
// or (in dev) via a local .env file + expo-constants. The
// placeholder pattern mirrors src/services/firebase.js on the
// web — missing values mean "not configured" (dev bypass path
// will never be used in a mobile build; Firebase is mandatory).
// ══════════════════════════════════════════════════════════════
import Constants from 'expo-constants';

type Extra = {
  apiBaseUrl?: string;
  firebaseApiKey?: string;
  firebaseAuthDomain?: string;
  firebaseProjectId?: string;
  firebaseAppId?: string;
  firebaseMessagingSenderId?: string;
  firebaseStorageBucket?: string;
  googleOauthClientIdIos?: string;
  googleOauthClientIdAndroid?: string;
  googleOauthClientIdWeb?: string;
  sentryDsn?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

function fromEnvOrExtra(envKey: string, extraKey: keyof Extra): string | undefined {
  // process.env.EXPO_PUBLIC_* is inlined at build time by Metro.
  const fromEnv = (process.env as Record<string, string | undefined>)[envKey];
  return fromEnv ?? extra[extraKey];
}

export const env = {
  /** Hono API base URL. Defaults to production. */
  apiBaseUrl:
    fromEnvOrExtra('EXPO_PUBLIC_API_BASE_URL', 'apiBaseUrl') ??
    'https://v2.roomalyzer.com',

  firebase: {
    apiKey: fromEnvOrExtra('EXPO_PUBLIC_FIREBASE_API_KEY', 'firebaseApiKey'),
    authDomain: fromEnvOrExtra('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN', 'firebaseAuthDomain'),
    projectId: fromEnvOrExtra('EXPO_PUBLIC_FIREBASE_PROJECT_ID', 'firebaseProjectId'),
    appId: fromEnvOrExtra('EXPO_PUBLIC_FIREBASE_APP_ID', 'firebaseAppId'),
    messagingSenderId: fromEnvOrExtra(
      'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
      'firebaseMessagingSenderId',
    ),
    storageBucket: fromEnvOrExtra(
      'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
      'firebaseStorageBucket',
    ),
  },

  googleOauth: {
    iosClientId: fromEnvOrExtra('EXPO_PUBLIC_GOOGLE_OAUTH_IOS', 'googleOauthClientIdIos'),
    androidClientId: fromEnvOrExtra(
      'EXPO_PUBLIC_GOOGLE_OAUTH_ANDROID',
      'googleOauthClientIdAndroid',
    ),
    webClientId: fromEnvOrExtra('EXPO_PUBLIC_GOOGLE_OAUTH_WEB', 'googleOauthClientIdWeb'),
  },

  sentryDsn: fromEnvOrExtra('EXPO_PUBLIC_SENTRY_DSN', 'sentryDsn'),
} as const;

export function isFirebaseConfigured(): boolean {
  return Boolean(env.firebase.apiKey && env.firebase.authDomain && env.firebase.projectId);
}
