// ══════════════════════════════════════════════════════════════
// mapHelpers — placement & viewport math for the water map.
//
// Mirrors `src/features/indeklima/mapHelpers.ts` in spirit, but
// adapted to the water-detection data model:
//
//   - Water devices don't ship with `SensorGroup.location` bounds
//     (the live status table doesn't carry per-group bounding
//     boxes). So unlike indeklima we don't synthesise random
//     fallback positions inside a group box — sensors without a
//     saved GPS pin are returned with `lat/lng = null` and the
//     screen filters them out before rendering markers (matching
//     the web `roomalyzer20/src/pages/water/Map.jsx` behaviour).
//
//   - The fit-all camera math is identical so both Kort screens
//     animate the same way when the user picks a different
//     location.
//
// Keeping the helpers pure means the screen stays small and easy
// to test in isolation.
// ══════════════════════════════════════════════════════════════
import type { Region } from 'react-native-maps';

import type { WaterMapSensor } from './hooks';

export interface PlacedWaterSensor {
  sensor: WaterMapSensor;
  lat: number;
  lng: number;
}

// Same Copenhagen-area window the indeklima map uses as its
// "no data yet" fallback. Keeps the initial frame consistent
// across modules so the Kort tab feels like one product.
const DEFAULT_BOUNDS = {
  latMin: 55.64,
  latMax: 55.65,
  lngMin: 12.07,
  lngMax: 12.09,
};

/**
 * Filter a list of water sensors down to just the ones with a
 * saved GPS position, preserving array order. The web map does
 * the equivalent inline; extracting it lets the screen render
 * a meaningful empty state when *every* visible sensor is
 * unplaced (vs. when the location filter matched nothing).
 */
export function placeWaterSensors(
  sensors: readonly WaterMapSensor[],
): PlacedWaterSensor[] {
  const out: PlacedWaterSensor[] = [];
  for (const sensor of sensors) {
    if (
      sensor.lat == null ||
      sensor.lng == null ||
      !Number.isFinite(sensor.lat) ||
      !Number.isFinite(sensor.lng)
    ) {
      continue;
    }
    out.push({ sensor, lat: sensor.lat, lng: sensor.lng });
  }
  return out;
}

/**
 * Compute a `Region` (centre + deltas) that frames every placed
 * sensor with comfortable padding. Returns `null` when there are
 * no points to frame so the caller can fall through to the
 * default region.
 */
export function regionForWaterSensors(
  placed: readonly PlacedWaterSensor[],
  paddingFactor = 1.4,
): Region | null {
  if (placed.length === 0) return null;
  if (placed.length === 1) {
    const only = placed[0]!;
    return {
      latitude: only.lat,
      longitude: only.lng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  }
  let latMin = Infinity;
  let latMax = -Infinity;
  let lngMin = Infinity;
  let lngMax = -Infinity;
  for (const p of placed) {
    if (p.lat < latMin) latMin = p.lat;
    if (p.lat > latMax) latMax = p.lat;
    if (p.lng < lngMin) lngMin = p.lng;
    if (p.lng > lngMax) lngMax = p.lng;
  }
  const latDelta = Math.max((latMax - latMin) * paddingFactor, 0.005);
  const lngDelta = Math.max((lngMax - lngMin) * paddingFactor, 0.005);
  return {
    latitude: (latMin + latMax) / 2,
    longitude: (lngMin + lngMax) / 2,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };
}

/** Initial map region while sensor data is loading or missing. */
export const DEFAULT_WATER_REGION: Region = {
  latitude: (DEFAULT_BOUNDS.latMin + DEFAULT_BOUNDS.latMax) / 2,
  longitude: (DEFAULT_BOUNDS.lngMin + DEFAULT_BOUNDS.lngMax) / 2,
  latitudeDelta: DEFAULT_BOUNDS.latMax - DEFAULT_BOUNDS.latMin + 0.01,
  longitudeDelta: DEFAULT_BOUNDS.lngMax - DEFAULT_BOUNDS.lngMin + 0.01,
};
