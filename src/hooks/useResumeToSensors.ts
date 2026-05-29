// ══════════════════════════════════════════════════════════════
// useResumeToSensors — "cold-ish return" navigation reset.
//
// When the user leaves the app and comes back after a while, we
// always drop them on the sensor list. The list itself restores
// the last-viewed location per tenant from `sensorListPrefsStore`,
// so the net effect is: long absence → sensors, at the location
// they last looked at.
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
export const RESUME_TO_SENSORS_AFTER_MS = 5 * 60 * 1000; // 5 minutes

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

      // Going away: stamp the moment we first leave the foreground.
      // Only the active → inactive edge stamps, so the subsequent
      // inactive → background transition (iOS) doesn't reset it.
      if (isBackgroundLike(next)) {
        if (prev === 'active') {
          backgroundedAt.current = Date.now();
        }
        return;
      }

      // Coming back to the foreground.
      if (next === 'active' && isBackgroundLike(prev)) {
        const since = backgroundedAt.current;
        backgroundedAt.current = null;
        if (!enabled || since === null) return;
        if (Date.now() - since < RESUME_TO_SENSORS_AFTER_MS) return;
        router.replace('/(tabs)/sensors');
      }
    });

    return () => sub.remove();
  }, [enabled, router]);
}
