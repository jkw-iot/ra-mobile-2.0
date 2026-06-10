// ══════════════════════════════════════════════════════════════
// useResumeToSensors — "cold-ish return" navigation reset.
//
// When the user leaves the app and comes back after a while, we
// navigate them to the sensor list. Uses `router.navigate` (not
// `replace`) to avoid a full remount of the tabs layout — the
// existing mounted tree stays alive, preventing a query storm
// and keeping the app responsive immediately.
//
// A quick app-switcher peek, Control Centre pull, or a brief
// detour to another app should NOT yank the user off whatever
// screen they were on — only an absence longer than
// `RESUME_TO_SENSORS_AFTER_MS` triggers the reset.
// ══════════════════════════════════════════════════════════════
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useRouter } from 'expo-router';

/** How long the app must stay backgrounded before a return resets
 *  navigation to the sensor list. */
export const RESUME_TO_SENSORS_AFTER_MS = 10 * 60 * 1000; // 10 minutes

function isBackgroundLike(status: AppStateStatus): boolean {
  return status === 'inactive' || status === 'background';
}

export function useResumeToSensors(enabled: boolean): void {
  const router = useRouter();
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const prev = appState.current;
      appState.current = next;

      if (isBackgroundLike(next)) {
        if (prev === 'active') {
          backgroundedAt.current = Date.now();
        }
        return;
      }

      if (next === 'active' && isBackgroundLike(prev)) {
        const since = backgroundedAt.current;
        backgroundedAt.current = null;
        if (!enabled || since === null) return;
        if (Date.now() - since < RESUME_TO_SENSORS_AFTER_MS) return;
        router.navigate('/(tabs)');
      }
    });

    return () => sub.remove();
  }, [enabled, router]);
}
