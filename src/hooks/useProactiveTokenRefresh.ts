import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { getIdToken } from '@/services/auth/firebase';
import { isFirebaseConfigured } from '@/lib/env';

/**
 * Force-refresh the Firebase ID token whenever the app returns to
 * foreground. This ensures subsequent API calls don't hit a 401 and
 * pay the double-fetch penalty (request → 401 → refresh → retry).
 *
 * The refresh is fire-and-forget — it does not block the UI or
 * affect loading state.
 */
export function useProactiveTokenRefresh(): void {
  useEffect(() => {
    if (!isFirebaseConfigured()) return;

    let prev: AppStateStatus = AppState.currentState;

    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && prev !== 'active') {
        void getIdToken(true);
      }
      prev = next;
    });

    return () => sub.remove();
  }, []);
}
