// ══════════════════════════════════════════════════════════════
// Firebase Auth — React Native setup
//
// Mirrors ../roomalyzer20/src/services/firebase.js conceptually but
// configures persistence via React Native's AsyncStorage adapter so
// that Firebase auto-stores the refresh token securely across app
// launches. (The token itself is encrypted-at-rest on the device
// because iOS Keychain / Android EncryptedSharedPreferences wrap
// the persisted blob.)
// ══════════════════════════════════════════════════════════════
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  signInWithEmailAndPassword,
  signInWithCredential,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut,
  onAuthStateChanged,
  getMultiFactorResolver,
  TotpMultiFactorGenerator,
  type Auth,
  type MultiFactorResolver,
  type User as FirebaseUser,
  type UserCredential,
} from 'firebase/auth';

// @ts-expect-error — `getReactNativePersistence` is exported from
// `firebase/auth/react-native` but the main `firebase/auth` module
// re-exports it without type declarations in recent Firebase JS SDK
// versions. Using it is still the canonical way to persist auth in RN.
import { getReactNativePersistence } from 'firebase/auth';

import { env, isFirebaseConfigured } from '@/lib/env';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

if (isFirebaseConfigured()) {
  const config = {
    apiKey: env.firebase.apiKey!,
    authDomain: env.firebase.authDomain!,
    projectId: env.firebase.projectId!,
    appId: env.firebase.appId,
    messagingSenderId: env.firebase.messagingSenderId,
    storageBucket: env.firebase.storageBucket,
  };

  app = getApps()[0] ?? initializeApp(config);

  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // Already initialized (e.g. hot reload) — fall back to existing instance.
    auth = getAuth(app);
  }
}

export { auth };
export { isFirebaseConfigured };

export type { FirebaseUser };

// ── Auth helpers ──────────────────────────────────────────────

export async function loginWithEmail(email: string, password: string): Promise<FirebaseUser> {
  if (!auth) throw new Error('Firebase not configured');
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

/**
 * Complete a Google sign-in using an ID token obtained via
 * expo-auth-session (see src/services/auth/google.ts).
 */
export async function loginWithGoogleIdToken(idToken: string): Promise<FirebaseUser> {
  if (!auth) throw new Error('Firebase not configured');
  const credential = GoogleAuthProvider.credential(idToken);
  const result = await signInWithCredential(auth, credential);
  return result.user;
}

export async function resetPassword(email: string): Promise<void> {
  if (!auth) throw new Error('Firebase not configured');
  await sendPasswordResetEmail(auth, email);
}

export async function sendVerificationEmail(user: FirebaseUser): Promise<void> {
  await sendEmailVerification(user);
}

export async function logout(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
}

// ── Multi-factor auth (TOTP) ──────────────────────────────
// Mirror of roomalyzer20/src/services/firebase.js getMfaResolver +
// verifyTotpSignIn. Called from login screen when Firebase throws
// auth/multi-factor-auth-required during signInWithEmailAndPassword.

export function getMfaResolver(error: unknown): MultiFactorResolver {
  if (!auth) throw new Error('Firebase not configured');
  return getMultiFactorResolver(auth, error as Parameters<typeof getMultiFactorResolver>[1]);
}

export async function verifyTotpSignIn(
  resolver: MultiFactorResolver,
  enrollmentId: string,
  code: string,
): Promise<UserCredential> {
  const assertion = TotpMultiFactorGenerator.assertionForSignIn(enrollmentId, code);
  return resolver.resolveSignIn(assertion);
}

export type { MultiFactorResolver };

export async function getIdToken(forceRefresh = false): Promise<string | null> {
  if (!auth?.currentUser) return null;
  return auth.currentUser.getIdToken(forceRefresh);
}

export function getCurrentUser(): FirebaseUser | null {
  return auth?.currentUser ?? null;
}

export function onAuthChange(callback: (user: FirebaseUser | null) => void): () => void {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}
