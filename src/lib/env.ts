// ══════════════════════════════════════════════════════════════
// Environment configuration
//
// Values come from (in order):
//   1. process.env.EXPO_PUBLIC_* — inlined by Metro at bundle time
//      (MUST use static property access, e.g. process.env.EXPO_PUBLIC_FOO,
//      never process.env[variable] — dynamic access is not inlined)
//   2. app.json `extra` — baked into the native manifest at EAS build
//   3. Sensible defaults for apiBaseUrl only
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

/** Prefer Metro-inlined env var, fall back to app.json `extra`. */
function pick(inlined: string | undefined, fromExtra: string | undefined): string | undefined {
  return inlined ?? fromExtra;
}

export const env = {
  apiBaseUrl:
    pick(process.env.EXPO_PUBLIC_API_BASE_URL, extra.apiBaseUrl) ?? 'https://v2.roomalyzer.com',

  firebase: {
    apiKey: pick(process.env.EXPO_PUBLIC_FIREBASE_API_KEY, extra.firebaseApiKey),
    authDomain: pick(process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN, extra.firebaseAuthDomain),
    projectId: pick(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID, extra.firebaseProjectId),
    appId: pick(process.env.EXPO_PUBLIC_FIREBASE_APP_ID, extra.firebaseAppId),
    messagingSenderId: pick(
      process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      extra.firebaseMessagingSenderId,
    ),
    storageBucket: pick(
      process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      extra.firebaseStorageBucket,
    ),
  },

  googleOauth: {
    iosClientId: pick(process.env.EXPO_PUBLIC_GOOGLE_OAUTH_IOS, extra.googleOauthClientIdIos),
    androidClientId: pick(
      process.env.EXPO_PUBLIC_GOOGLE_OAUTH_ANDROID,
      extra.googleOauthClientIdAndroid,
    ),
    webClientId: pick(process.env.EXPO_PUBLIC_GOOGLE_OAUTH_WEB, extra.googleOauthClientIdWeb),
  },

  sentryDsn: pick(process.env.EXPO_PUBLIC_SENTRY_DSN, extra.sentryDsn),
} as const;

export function isFirebaseConfigured(): boolean {
  return Boolean(env.firebase.apiKey && env.firebase.authDomain && env.firebase.projectId);
}
