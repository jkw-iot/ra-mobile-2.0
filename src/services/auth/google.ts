// ══════════════════════════════════════════════════════════════
// Google Sign-In via expo-auth-session
//
// Returns an ID token that we then pass to Firebase
// (loginWithGoogleIdToken). Expo Go-compatible — no native SDK.
//
// Requires OAuth 2.0 client IDs (iOS + Android + Web) configured in
// Google Cloud Console and exposed through env.googleOauth.*
// ══════════════════════════════════════════════════════════════
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';

import { env } from '@/lib/env';

WebBrowser.maybeCompleteAuthSession();

export function useGoogleSignIn(onToken: (idToken: string) => void) {
  const [, response, promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId: env.googleOauth.iosClientId,
    androidClientId: env.googleOauth.androidClientId,
    webClientId: env.googleOauth.webClientId,
  });

  useEffect(() => {
    if (response?.type === 'success' && response.params.id_token) {
      onToken(response.params.id_token);
    }
  }, [response, onToken]);

  return { signIn: () => promptAsync() };
}
