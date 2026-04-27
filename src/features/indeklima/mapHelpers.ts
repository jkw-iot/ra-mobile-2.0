// ══════════════════════════════════════════════════════════════
// mapHelpers — placement and viewport math for the Kort screen.
//
// Mirrors the logic in `roomalyzer20/src/pages/indeklima/Map.jsx`:
//   1. Saved GPS positions from `/admin/sensor-positions` win.
//   2. Otherwise pick a deterministic point inside the sensor's
//      group `location` bounding box (so reloads don't shuffle
//      pins around the screen).
//   3. As a last resort fall back to a Copenhagen-area bounding
//      box — this only ever applies when the backend returns
//      neither a position nor sensible group bounds.
//
// Keeping these helpers pure and dependency-free means the
// screen test surface stays small and the map can be re-rendered
// stably as the user toggles location / parameter selections.
// ══════════════════════════════════════════════════════════════
import type { Region } from 'react-native-maps';

import type { SensorGroup, SensorPositions } from '@/services/api';
import type { FlatSensor } from './hooks';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface PlacedSensor {
  sensor: FlatSensor;
  lat: number;
  lng: number;
  /**
   * `true` when we used a real saved GPS position, `false` when
   * we synthesised one inside a bounding box. Useful for UI hints
   * (we currently render both the same, but the map screen could
   * eventually nudge the user to "place this sensor on the map").
   */
  hasSavedPosition: boolean;
}

// Same fallback as the web Map page — a tight box around the
// IoT Fabrikken / Sommerhus demo cluster so unconfigured tenants
// still get a meaningful initial map view rather than a world
// projection at z=0.
const DEFAULT_BOUNDS = {
  latMin: 55.64,
  latMax: 55.65,
  lngMin: 12.07,
  lngMax: 12.09,
};

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Stable sin-based PRNG. Same identity used on the web. */
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function randomInRange(min: number, max: number, seed: number): number {
  return min + (max - min) * seededRandom(seed);
}

/** Build a fast `groupTitle → bounds` lookup. */
function buildBoundsByGroupTitle(
  groups: readonly SensorGroup[],
): Map<string, typeof DEFAULT_BOUNDS> {
  const out = new Map<string, typeof DEFAULT_BOUNDS>();
  for (const g of groups) {
    const loc = g.location;
    if (
      loc &&
      isFiniteNumber(loc.latMin) &&
      isFiniteNumber(loc.latMax) &&
      isFiniteNumber(loc.lngMin) &&
      isFiniteNumber(loc.lngMax)
    ) {
      out.set(g.title, {
        latMin: loc.latMin,
        latMax: loc.latMax,
        lngMin: loc.lngMin,
        lngMax: loc.lngMax,
      });
    }
  }
  return out;
}

/** Look up a saved position keyed by stringified id. */
function findSavedPosition(
  positions: SensorPositions | undefined,
  sensorId: number | string,
): LatLng | null {
  if (!positions) return null;
  const candidates = [String(sensorId), sensorId as unknown as string];
  for (const key of candidates) {
    const entry = (positions as Record<string, { lat: number; lng: number }>)[
      key as string
    ];
    if (
      entry &&
      isFiniteNumber(entry.lat) &&
      isFiniteNumber(entry.lng)
    ) {
      return { lat: entry.lat, lng: entry.lng };
    }
  }
  return null;
}

/**
 * Compute the {lat, lng} for every sensor in `sensors` using
 * (in order): saved GPS position → seeded random inside the
 * sensor's group bounds → seeded random inside `DEFAULT_BOUNDS`.
 */
export function placeSensors(
  sensors: readonly FlatSensor[],
  groups: readonly SensorGroup[] | undefined,
  positions: SensorPositions | undefined,
): PlacedSensor[] {
  const boundsByGroup = groups ? buildBoundsByGroupTitle(groups) : new Map();
  const out: PlacedSensor[] = [];
  sensors.forEach((sensor, idx) => {
    const saved = findSavedPosition(positions, sensor.id);
    if (saved) {
      out.push({ sensor, lat: saved.lat, lng: saved.lng, hasSavedPosition: true });
      return;
    }
    const bounds = boundsByGroup.get(sensor.groupTitle) ?? DEFAULT_BOUNDS;
    // Combine the sensor id with the row index so two sensors
    // with the same numeric id (shouldn't happen, but) still
    // separate visually instead of stacking on the exact same px.
    const seedBase = (Number(sensor.id) || idx + 1) * 13 + idx * 7;
    const lat = randomInRange(bounds.latMin, bounds.latMax, seedBase + 1);
    const lng = randomInRange(bounds.lngMin, bounds.lngMax, seedBase + 2);
    if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) return;
    out.push({ sensor, lat, lng, hasSavedPosition: false });
  });
  return out;
}

/**
 * Compute a `Region` (centre + deltas) that frames every placed
 * sensor with comfortable padding. Returns `null` when there are
 * no points to frame so the caller can fall through to a default
 * map region.
 */
export function regionForSensors(
  placed: readonly PlacedSensor[],
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

/**
 * Default "no sensors yet" region — same Copenhagen-area window
 * the web Map page uses as its initial view. Exposed so the map
 * screen can hand it to `<MapView initialRegion>` even before the
 * sensor data has loaded.
 */
export const DEFAULT_REGION: Region = {
  latitude: (DEFAULT_BOUNDS.latMin + DEFAULT_BOUNDS.latMax) / 2,
  longitude: (DEFAULT_BOUNDS.lngMin + DEFAULT_BOUNDS.lngMax) / 2,
  latitudeDelta: DEFAULT_BOUNDS.latMax - DEFAULT_BOUNDS.latMin + 0.01,
  longitudeDelta: DEFAULT_BOUNDS.lngMax - DEFAULT_BOUNDS.lngMin + 0.01,
};
