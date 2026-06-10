import { useEffect, useRef, useState } from 'react';
import { Accelerometer } from 'expo-sensors';

export type DevicePosture = 'portrait' | 'landscape';

const UPDATE_INTERVAL_MS = 100; // ~10 Hz — low power
const DEBOUNCE_MS = 400;
const MIN_AXIS_MAGNITUDE = 0.5;

/**
 * Detect the physical device orientation via accelerometer gravity,
 * independent of the system orientation lock.
 *
 * Returns `'portrait'` or `'landscape'`. Ignores face-up / face-down
 * positions where neither axis dominates.
 *
 * Pass `enabled: false` to pause the subscription (saves battery on
 * screens that don't need tilt detection).
 */
export function useDeviceOrientation(enabled = true): DevicePosture {
  const [posture, setPosture] = useState<DevicePosture>('portrait');
  const pendingRef = useRef<DevicePosture>('portrait');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    Accelerometer.setUpdateInterval(UPDATE_INTERVAL_MS);

    const sub = Accelerometer.addListener(({ x, y }) => {
      const absX = Math.abs(x);
      const absY = Math.abs(y);

      // Ignore ambiguous / face-up positions
      if (absX < MIN_AXIS_MAGNITUDE && absY < MIN_AXIS_MAGNITUDE) return;

      const detected: DevicePosture =
        absX > absY ? 'landscape' : 'portrait';

      if (detected === pendingRef.current) return;
      pendingRef.current = detected;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setPosture(detected);
      }, DEBOUNCE_MS);
    });

    return () => {
      sub.remove();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled]);

  return posture;
}
