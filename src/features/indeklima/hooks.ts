// ══════════════════════════════════════════════════════════════
// Indeklima — React Query hooks.
//
// Query keys are hierarchical: ['indeklima', 'sensors', { tenantId }]
// so a tenant switch can invalidate the whole feature with a single
// call. cacheTier meta controls how long each query is persisted
// (see src/lib/queryClient.ts).
// ══════════════════════════════════════════════════════════════
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import {
  indeklimaApi,
  sensorTypesApi,
  type IndeklimaLocation,
  type Sensor,
  type SensorTypeDef,
} from '@/services/api';
import { cacheTiers } from '@/lib/queryClient';
import { useTenantStore } from '@/stores/tenantStore';

// ── Sensor groups (full list grouped by location) ─────────
export function useSensorGroups() {
  const tenantId = useTenantStore((s) => s.activeTenantId);
  return useQuery({
    queryKey: ['indeklima', 'sensors', { tenantId }],
    queryFn: () => indeklimaApi.getSensors(),
    enabled: tenantId !== null,
    staleTime: cacheTiers.snapshot.staleTime,
    gcTime: cacheTiers.raw.gcTime,
    meta: { cacheTier: 'snapshot' as const },
  });
}

// ── Flat sensor list with group title & real location attached ─
//
// IMPORTANT: the /api/indeklima/sensors response carries a per-sensor
// `location` field (numeric id matching /api/indeklima/locations.id)
// that our OpenAPI schema does not document. The `path` / group title
// in the same response are just display buckets ("General",
// "Filtered Sensors") and do NOT encode the sensor's real location.
// We surface the raw `location` as `locationId` here so the list
// screen can filter by actual location.
export interface FlatSensor extends Sensor {
  groupTitle: string;
  locationName: string;
  locationId: number | string | null;
}

export function useSensorsFlat() {
  const { data, ...rest } = useSensorGroups();
  const sensors = useMemo<FlatSensor[]>(() => {
    if (!data) return [];
    return data.flatMap((g) =>
      g.sensors.map((s) => {
        const raw = s as unknown as Record<string, unknown>;
        const rawLoc =
          raw.location ?? raw.locationId ?? raw.location_id ?? null;
        const locationId =
          rawLoc === null ||
          rawLoc === undefined ||
          rawLoc === 0 ||
          rawLoc === '0'
            ? null
            : (rawLoc as number | string);
        return {
          ...s,
          groupTitle: g.title,
          locationName: s.path?.[0] ?? g.title,
          locationId,
        };
      }),
    );
  }, [data]);
  return { ...rest, data: sensors };
}

// ── Single sensor (derived from cached group list) ────────
// Notes on loading:
//  - React Query v5 reports `isLoading = isPending && isFetching`.
//    When a query is `enabled: false` (e.g. tenantId not hydrated yet)
//    both are `false`, so a naive `if (isLoading) return spinner` would
//    render "no data" instead of a spinner. We expose a synthetic
//    `isWaiting` that also captures the "query disabled but will run
//    soon" state by checking tenantId.
//  - We compare ids as strings to be resilient against backend returning
//    them as number OR numeric string.
export function useSensor(id: number | string | null) {
  const tenantId = useTenantStore((s) => s.activeTenantId);
  const { data: flat, isLoading, isFetching, isPending, ...rest } = useSensorsFlat();
  const idStr = id == null ? null : String(id);
  const sensor = useMemo(() => {
    if (idStr == null) return null;
    return flat.find((s) => String(s.id) === idStr) ?? null;
  }, [flat, idStr]);

  // "Waiting" = genuinely fetching, OR we haven't even started yet because
  // tenantId is briefly null during app hydration.
  const isWaiting =
    isLoading || isFetching || (flat.length === 0 && tenantId == null);

  return {
    ...rest,
    isLoading,
    isFetching,
    isPending,
    isWaiting,
    data: sensor,
  };
}

// ── Raw history for a specific day ────────────────────────
export function useSensorHistoryRaw(id: number | string | null, date?: string) {
  const tenantId = useTenantStore((s) => s.activeTenantId);
  return useQuery({
    queryKey: ['indeklima', 'sensor', id, 'history', 'raw', { date, tenantId }],
    queryFn: () => indeklimaApi.getSensorHistory(id!, { date, resolution: 'raw' }),
    enabled: id !== null && id !== undefined && tenantId !== null,
    staleTime: cacheTiers.raw.staleTime,
    gcTime: cacheTiers.raw.gcTime,
    meta: { cacheTier: 'raw' as const },
  });
}

// ── Hourly-aggregated history for a date range ────────────
export function useSensorHistoryHourly(
  id: number | string | null,
  from: string | undefined,
  to: string | undefined,
) {
  const tenantId = useTenantStore((s) => s.activeTenantId);
  return useQuery({
    queryKey: ['indeklima', 'sensor', id, 'history', 'hourly', { from, to, tenantId }],
    queryFn: () =>
      indeklimaApi.getSensorHistory(id!, { from, to, resolution: 'hourly' }),
    enabled: id !== null && id !== undefined && tenantId !== null && Boolean(from && to),
    staleTime: cacheTiers.downsampled.staleTime,
    gcTime: cacheTiers.downsampled.gcTime,
    meta: { cacheTier: 'downsampled' as const },
  });
}

// ── Alerts ─────────────────────────────────────────────────
export function useAlerts() {
  const tenantId = useTenantStore((s) => s.activeTenantId);
  return useQuery({
    queryKey: ['indeklima', 'alerts', { tenantId }],
    queryFn: () => indeklimaApi.getAlerts(),
    enabled: tenantId !== null,
    staleTime: cacheTiers.snapshot.staleTime,
    gcTime: cacheTiers.raw.gcTime,
  });
}

// ── Thresholds (per-sensor, season-aware) ─────────────────
// Used to colour-code chart background bands & value tiles.
export function useSensorThresholds(id: number | string | null) {
  const tenantId = useTenantStore((s) => s.activeTenantId);
  return useQuery({
    queryKey: ['indeklima', 'sensor', id, 'thresholds', { tenantId }],
    queryFn: () => indeklimaApi.getSensorThresholds(id!),
    enabled: id !== null && id !== undefined && tenantId !== null,
    // Thresholds change rarely — cache aggressively.
    staleTime: cacheTiers.downsampled.staleTime,
    gcTime: cacheTiers.downsampled.gcTime,
    meta: { cacheTier: 'downsampled' as const },
  });
}

// ── Locations (full tenant location tree, flat) ───────────
// Exposes every location the tenant can filter by, even when no
// sensor currently lives there. Used to populate the list-view
// location filter alongside whatever we can infer from
// sensor.path segments.
export function useLocations() {
  const tenantId = useTenantStore((s) => s.activeTenantId);
  return useQuery({
    queryKey: ['indeklima', 'locations', { tenantId }],
    queryFn: () => indeklimaApi.getLocations(),
    enabled: tenantId !== null,
    staleTime: cacheTiers.downsampled.staleTime,
    gcTime: cacheTiers.downsampled.gcTime,
    meta: { cacheTier: 'downsampled' as const },
  });
}

// ── Sensor types (capabilities per device model) ──────────
export function useSensorTypes() {
  const tenantId = useTenantStore((s) => s.activeTenantId);
  return useQuery({
    queryKey: ['sensor-types', { tenantId }],
    queryFn: () => sensorTypesApi.getAll(),
    enabled: tenantId !== null,
    staleTime: cacheTiers.downsampled.staleTime,
    gcTime: cacheTiers.downsampled.gcTime,
    meta: { cacheTier: 'downsampled' as const },
  });
}

/**
 * Build a Map from legacy sensorType id → Set of supported param keys.
 * Uses the `legacy_id` field from the sensor_types DB table.
 */
export function buildTypeParamsMap(
  types: SensorTypeDef[] | undefined,
): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  if (!types) return m;
  for (const st of types) {
    if (st.legacy_id != null) {
      const lid = String(st.legacy_id);
      const existing = m.get(lid);
      const params = new Set(st.params);
      if (existing) {
        params.forEach((p) => existing.add(p));
      } else {
        m.set(lid, params);
      }
    }
  }
  return m;
}

/** Check whether a sensor supports a given parameter. */
export function sensorSupports(
  sensorType: string | undefined,
  param: string,
  typeMap: Map<string, Set<string>>,
): boolean {
  if (!sensorType) return true; // unknown type → show all
  const allowed = typeMap.get(String(sensorType));
  if (!allowed) return true; // not in our DB → show all
  return allowed.has(param);
}

// ── Location helpers ──────────────────────────────────────

export interface LocationOption {
  id: string;
  name: string;
  count: number;
  depth: number;
}

/**
 * Build the pickable list of locations for the filter dropdown.
 *
 * The only reliable sensor→location link is `sensor.locationId`
 * matched against `location.id` from /api/indeklima/locations.
 * `path` / `groupTitle` are just display buckets from the live
 * snapshot endpoint and don't encode the real location.
 *
 * Only locations that actually have at least one sensor are returned
 * — picking a location without sensors would give an empty list and
 * confuse the user. If a sensor references a location id that the
 * locations endpoint doesn't know about, we still surface it with a
 * fallback name so the filter is complete.
 * A generic "General" / "Generel" bucket — which the backend uses
 * for unassigned sensors — is filtered out: it isn't a meaningful
 * filter for the end user.
 */
const GENERIC_LOCATION_NAMES = new Set(['general', 'generel']);

function isGenericLocationName(name: string): boolean {
  return GENERIC_LOCATION_NAMES.has(name.trim().toLowerCase());
}

function locationParentKey(location: IndeklimaLocation): string | null {
  if (location.parentId == null || location.parentId === 0) return null;
  return String(location.parentId);
}

function sortLocations(a: IndeklimaLocation, b: IndeklimaLocation): number {
  const flowDiff = (a.flow ?? Number.MAX_SAFE_INTEGER) - (b.flow ?? Number.MAX_SAFE_INTEGER);
  if (flowDiff !== 0) return flowDiff;
  return a.name.localeCompare(b.name, 'da');
}

export function buildLocationOptions(
  sensors: readonly FlatSensor[],
  locations: IndeklimaLocation[] | undefined,
): LocationOption[] {
  const countsById = new Map<string, number>();
  for (const s of sensors) {
    if (s.locationId == null) continue;
    const key = String(s.locationId);
    countsById.set(key, (countsById.get(key) ?? 0) + 1);
  }

  const out: LocationOption[] = [];
  const seen = new Set<string>();
  if (locations) {
    const childrenByParent = new Map<string | null, IndeklimaLocation[]>();
    for (const location of locations) {
      const parentKey = locationParentKey(location);
      const siblings = childrenByParent.get(parentKey);
      if (siblings) {
        siblings.push(location);
      } else {
        childrenByParent.set(parentKey, [location]);
      }
    }
    for (const siblings of childrenByParent.values()) {
      siblings.sort(sortLocations);
    }

    const visit = (parentKey: string | null, depth: number) => {
      const children = childrenByParent.get(parentKey);
      if (!children) return;
      for (const location of children) {
        const id = String(location.id);
        if (!seen.has(id) && !isGenericLocationName(location.name)) {
          const count = countsById.get(id) ?? 0;
          if (count > 0) {
            seen.add(id);
            out.push({ id, name: location.name, count, depth });
          }
        }
        visit(id, depth + 1);
      }
    };

    visit(null, 0);

    // Be resilient if Legacy returns an orphaned subtree whose parent is
    // missing from the flat list.
    for (const location of [...locations].sort(sortLocations)) {
      const id = String(location.id);
      if (seen.has(id) || isGenericLocationName(location.name)) continue;
      const count = countsById.get(id) ?? 0;
      if (count === 0) continue;
      seen.add(id);
      out.push({ id, name: location.name, count, depth: 0 });
    }
  }
  for (const [id, count] of countsById) {
    if (seen.has(id) || count === 0) continue;
    seen.add(id);
    out.push({ id, name: `Lokation #${id}`, count, depth: 0 });
  }
  return out;
}

/** Does a sensor belong to the given location ID? */
export function sensorMatchesLocation(
  sensor: FlatSensor,
  locationId: string | null,
): boolean {
  if (!locationId) return true;
  if (sensor.locationId == null) return false;
  return String(sensor.locationId) === String(locationId);
}
