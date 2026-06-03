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
  type ScopeThresholds,
  type Sensor,
  type SensorPositions,
  type SensorTypeDef,
  type ThresholdScopeType,
} from '@/services/api';
import { fetchOutdoorWeather } from '@/services/openMeteo';
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
//
// Cached at the "snapshot" tier (1h staleTime, 1d gcTime) — not
// the "downsampled" tier the historical aggregates use. Location
// names are tenant configuration: they can be edited at any time
// in the web admin and users expect renames/restructures to show
// up in a reasonable time-frame, not after 6 hours. Pull-to-
// refresh on the sensor list also calls `refetch()` on this query
// so an explicit reload is always immediate.
export function useLocations() {
  const tenantId = useTenantStore((s) => s.activeTenantId);
  return useQuery({
    queryKey: ['indeklima', 'locations', { tenantId }],
    queryFn: () => indeklimaApi.getLocations(),
    enabled: tenantId !== null,
    staleTime: cacheTiers.snapshot.staleTime,
    gcTime: cacheTiers.snapshot.gcTime,
    meta: { cacheTier: 'snapshot' as const },
  });
}

// ── Sensor positions (saved GPS coords per sensor) ────────
// Used by the map screen to place sensors on the geographic
// map. Sensors without a saved position fall back to a seeded
// random point inside their group's `location` bounding box.
//
// IMPORTANT: the legacy `/admin/sensor-positions` endpoint
// returns an ARRAY `[{ id, name, lat, lng }, …]` in production,
// not the object map `{ [id]: { lat, lng } }` documented in the
// OpenAPI schema. The web app handles both shapes (see
// `roomalyzer20/src/services/sensorMapService.js#normalisePositionsResponse`);
// without the same normalisation here, every position lookup
// would miss and the map would render only fallback positions.
function normalizeSensorPositions(
  raw: unknown,
): Record<string, { lat: number; lng: number }> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, { lat: number; lng: number }> = {};
  const ingest = (key: unknown, lat: unknown, lng: unknown) => {
    if (key == null) return;
    if (typeof lat !== 'number' || typeof lng !== 'number') return;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    out[String(key)] = { lat, lng };
  };
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const obj = item as { id?: unknown; sensorId?: unknown; lat?: unknown; lng?: unknown };
      ingest(obj.sensorId ?? obj.id, obj.lat, obj.lng);
    }
    return out;
  }
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue;
    const obj = v as { lat?: unknown; lng?: unknown };
    ingest(k, obj.lat, obj.lng);
  }
  return out;
}

export function useSensorPositions() {
  const tenantId = useTenantStore((s) => s.activeTenantId);
  return useQuery({
    queryKey: ['indeklima', 'sensor-positions', { tenantId }],
    queryFn: async () => {
      const raw = await indeklimaApi.getSensorPositions();
      return normalizeSensorPositions(raw) as unknown as SensorPositions;
    },
    enabled: tenantId !== null,
    staleTime: cacheTiers.snapshot.staleTime,
    gcTime: cacheTiers.snapshot.gcTime,
    meta: { cacheTier: 'snapshot' as const },
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

/**
 * Check whether a sensor supports a given parameter.
 *
 * Matches the web app's `normalizeSensor` rules: unmapped legacy
 * type ids default to core climate (temp/hum/co2/voc). Sound,
 * light, and PIR are ONLY shown when the sensor type is explicitly
 * registered in the DB and lists that param.
 */
const CORE_CLIMATE: ReadonlySet<string> = new Set(['temp', 'hum', 'co2', 'voc']);

export function sensorSupports(
  sensorType: string | undefined,
  param: string,
  typeMap: Map<string, Set<string>>,
): boolean {
  if (!sensorType) return CORE_CLIMATE.has(param);
  const allowed = typeMap.get(String(sensorType));
  if (!allowed) return CORE_CLIMATE.has(param);
  return allowed.has(param);
}

// ── Location helpers ──────────────────────────────────────

export interface LocationOption {
  id: string;
  name: string;
  /** Total sensor count in this subtree (self + every descendant). */
  count: number;
  depth: number;
  /**
   * Set of location ids that "belong" to this option for filtering.
   * Always includes the option's own id; for parent locations also
   * every descendant id. So picking "Sommerhus" matches every sensor
   * whose locationId is "Sommerhus" *or* "Sommerhus → Test".
   */
  subtreeIds: ReadonlySet<string>;
}

/**
 * Build the pickable list of locations for the filter dropdown.
 *
 * The only reliable sensor→location link is `sensor.locationId`
 * matched against `location.id` from /api/indeklima/locations.
 * `path` / `groupTitle` are just display buckets from the live
 * snapshot endpoint and don't encode the real location.
 *
 * Locations form a tree (parentId → id). A parent appears in the
 * picker as long as *anywhere in its subtree* there's at least
 * one sensor — even if the parent itself has no direct sensors.
 * Without this, picking "Sommerhus" would never match anything if
 * all of its sensors happened to live in a sub-location like
 * "Test", and the sub-location would render at depth 1 with no
 * visible parent above it (looking like an unrelated top-level
 * item). Each option's `subtreeIds` set lets the matcher include
 * the whole subtree when a parent is selected.
 *
 * If a sensor references a location id the locations endpoint
 * doesn't know about, we still surface it with a fallback name so
 * the filter is complete.
 *
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

/**
 * Flatten the legacy `/indeklima/locations` response into a flat
 * array of locations.
 *
 * The OpenAPI schema documents the endpoint as a flat list of
 * `{ id, name, parentId, flow }`, but in production the legacy
 * backend actually returns a NESTED tree where each parent has a
 * `children: [...]` array. The web app handles this by walking
 * `children` recursively (see `roomalyzer20/src/services/
 * indeklimaLegacyService.js`); without the same flattening here
 * any non-root location is invisible to us — its `id` never
 * enters our index, so a sensor referencing it falls into the
 * "unknown location" fallback (rendered as "Lokation #<id>").
 *
 * Each nested node still carries its own `parentId`, so once
 * flattened, the rest of `buildLocationOptions` works unchanged.
 */
function flattenLocationTree(
  locations: IndeklimaLocation[],
): IndeklimaLocation[] {
  const out: IndeklimaLocation[] = [];
  const visited = new Set<string>();
  const walk = (nodes: readonly unknown[]) => {
    for (const raw of nodes) {
      if (!raw || typeof raw !== 'object') continue;
      const node = raw as IndeklimaLocation & { children?: unknown };
      const id = String(node.id);
      if (!visited.has(id)) {
        visited.add(id);
        out.push(node);
      }
      if (Array.isArray(node.children) && node.children.length > 0) {
        walk(node.children);
      }
    }
  };
  walk(locations);
  return out;
}

/**
 * Lightweight contract used by `buildLocationOptions` and
 * `sensorMatchesLocation`. Accepting a structural shape (instead
 * of `FlatSensor`) lets non-indeklima callers — e.g. the water
 * map — reuse this location-tree machinery without forcing their
 * domain types into the indeklima `Sensor` mould.
 */
export interface LocationFilterableSensor {
  locationId: number | string | null;
}

export function buildLocationOptions(
  sensors: readonly LocationFilterableSensor[],
  locations: IndeklimaLocation[] | undefined,
): LocationOption[] {
  // ── Count direct sensors per location id ───────────────
  const directCount = new Map<string, number>();
  for (const s of sensors) {
    if (s.locationId == null) continue;
    const key = String(s.locationId);
    directCount.set(key, (directCount.get(key) ?? 0) + 1);
  }

  // No locations endpoint → emit a flat list of just the sensor
  // locations we observe. Each option's subtree is itself.
  if (!locations) {
    const flat: LocationOption[] = [];
    for (const [id, count] of directCount) {
      if (count === 0) continue;
      flat.push({
        id,
        name: `Lokation #${id}`,
        count,
        depth: 0,
        subtreeIds: new Set([id]),
      });
    }
    return flat;
  }

  // Legacy returns a nested tree — flatten so deep children are
  // also indexed.
  const flatLocations = flattenLocationTree(locations);

  // ── Index the tree ────────────────────────────────────
  const childrenByParent = new Map<string | null, IndeklimaLocation[]>();
  for (const location of flatLocations) {
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

  // ── Compute subtree (ids + count) per location ────────
  // Recursive: subtree(loc) = {loc} ∪ subtree(child) for each child.
  const subtreeIdsById = new Map<string, Set<string>>();
  const subtreeCountById = new Map<string, number>();
  function computeSubtree(loc: IndeklimaLocation): { ids: Set<string>; count: number } {
    const id = String(loc.id);
    const cached = subtreeIdsById.get(id);
    if (cached) {
      return { ids: cached, count: subtreeCountById.get(id) ?? 0 };
    }
    const ids = new Set<string>([id]);
    let count = directCount.get(id) ?? 0;
    const kids = childrenByParent.get(id);
    if (kids) {
      for (const child of kids) {
        const sub = computeSubtree(child);
        for (const cid of sub.ids) ids.add(cid);
        count += sub.count;
      }
    }
    subtreeIdsById.set(id, ids);
    subtreeCountById.set(id, count);
    return { ids, count };
  }
  for (const location of flatLocations) computeSubtree(location);

  // ── Render order: DFS, only emit subtrees with sensors ─
  const out: LocationOption[] = [];
  const seen = new Set<string>();
  const visit = (parentKey: string | null, depth: number) => {
    const children = childrenByParent.get(parentKey);
    if (!children) return;
    for (const location of children) {
      const id = String(location.id);
      const subtreeCount = subtreeCountById.get(id) ?? 0;
      // Skip generic "General"/"Generel" buckets, but only when
      // the bucket itself has nothing useful nested inside.
      const isGeneric = isGenericLocationName(location.name);
      if (!seen.has(id) && !isGeneric && subtreeCount > 0) {
        seen.add(id);
        out.push({
          id,
          name: location.name,
          count: subtreeCount,
          depth,
          subtreeIds: subtreeIdsById.get(id) ?? new Set([id]),
        });
      }
      // Recurse into the children so an orphan-parented subtree
      // still gets rendered (we'll mop up real orphans after the
      // DFS, but this keeps depths correct for known parents).
      visit(id, depth + 1);
    }
  };
  visit(null, 0);

  // Be resilient if Legacy returns an orphaned subtree whose parent
  // is missing from the flat list. Render those at depth 0.
  for (const location of [...flatLocations].sort(sortLocations)) {
    const id = String(location.id);
    if (seen.has(id) || isGenericLocationName(location.name)) continue;
    const subtreeCount = subtreeCountById.get(id) ?? 0;
    if (subtreeCount === 0) continue;
    seen.add(id);
    out.push({
      id,
      name: location.name,
      count: subtreeCount,
      depth: 0,
      subtreeIds: subtreeIdsById.get(id) ?? new Set([id]),
    });
  }

  // Sensor referencing an unknown location id (no entry from the
  // locations endpoint at all). Surface it with a fallback name.
  for (const [id, count] of directCount) {
    if (seen.has(id) || count === 0) continue;
    seen.add(id);
    out.push({
      id,
      name: `Lokation #${id}`,
      count,
      depth: 0,
      subtreeIds: new Set([id]),
    });
  }
  return out;
}

/**
 * Does a sensor belong to the given selection?
 * `allowedIds` is the set of location ids the selection covers
 * (a leaf option's own id, a parent option's whole subtree).
 * `null` means "no filter".
 */
export function sensorMatchesLocation(
  sensor: LocationFilterableSensor,
  allowedIds: ReadonlySet<string> | null,
): boolean {
  if (!allowedIds) return true;
  if (sensor.locationId == null) return false;
  return allowedIds.has(String(sensor.locationId));
}

// ── Outdoor weather (Open-Meteo) ──────────────────────────
//
// Used by the sensor detail screen to enrich the indoor reading
// with a small "what's it like outside?" card. The query is
// keyed off coordinates rounded to 3 decimals (~110 m precision)
// so two sensors in the same building share a single network
// request and a single cache entry.
//
// `staleTime` is 15 min — Open-Meteo refreshes hourly and we
// don't want a busy detail-page user to thrash the public API.
// `gcTime` survives a tenant switch so weather data shown to one
// user does NOT silently leak between tenants — round-down keys
// only collide for genuinely co-located sensors.
const OUTDOOR_WEATHER_STALE_MS = 15 * 60 * 1000;
const OUTDOOR_WEATHER_GC_MS = 60 * 60 * 1000;

function roundCoord(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function useOutdoorWeather(lat: number | null, lng: number | null) {
  const enabled = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);
  const latKey = enabled ? roundCoord(lat as number) : null;
  const lngKey = enabled ? roundCoord(lng as number) : null;
  return useQuery({
    queryKey: ['weather', 'open-meteo', { lat: latKey, lng: lngKey }],
    queryFn: ({ signal }) => fetchOutdoorWeather(lat as number, lng as number, signal),
    enabled,
    staleTime: OUTDOOR_WEATHER_STALE_MS,
    gcTime: OUTDOOR_WEATHER_GC_MS,
    retry: 1,
    meta: { cacheTier: 'snapshot' as const },
  });
}

// ── Scope-based thresholds (sensor / location / global) ───
//
// Returns the saved thresholds + assigned `scenarioId` for a
// given scope. Backed by `/api/indeklima/thresholds` — the same
// endpoint the web admin uses. Cached aggressively because
// thresholds and scenario assignments change rarely.
//
// Passing `enabled: false` (e.g. while we don't have a scopeId
// yet) keeps the query dormant without losing the queryKey.
export function useScopeThresholds(
  scopeType: ThresholdScopeType,
  scopeId: number | string | null | undefined,
  options?: { enabled?: boolean },
) {
  const tenantId = useTenantStore((s) => s.activeTenantId);
  const enabled =
    (options?.enabled ?? true)
    && tenantId !== null
    && (scopeType === 'global' || (scopeId !== null && scopeId !== undefined));
  const scopeIdKey = scopeType === 'global' ? null : scopeId ?? null;
  return useQuery<ScopeThresholds | null>({
    queryKey: [
      'indeklima',
      'scope-thresholds',
      { scopeType, scopeId: scopeIdKey, tenantId },
    ],
    queryFn: () => indeklimaApi.getScopeThresholds(scopeType, scopeIdKey),
    enabled,
    staleTime: cacheTiers.downsampled.staleTime,
    gcTime: cacheTiers.downsampled.gcTime,
    meta: { cacheTier: 'downsampled' as const },
  });
}

// ── Effective scenario for a sensor ───────────────────────
//
// Walks the standard scope hierarchy used by the web app's
// DeviceManagement → SensorDetailModal:
//   1. Sensor scope (using the sensor's id)
//   2. Location scope (using `sensor.locationId`)
//   3. Global scope
// First scope that returns a non-null `scenarioId` wins. The
// thresholds and metadata returned alongside come from the
// winning scope's API response.
//
// Result shape:
//   - `null` while loading or when no scope yields a scenario
//   - `{ scenarioId, source, thresholds, scopeId }` when resolved
//
// Source is exposed so the UI can surface "inherited from
// location/global" hints in the detail sheet.
export type ScenarioScopeSource = 'sensor' | 'location' | 'global';

export interface EffectiveScenario {
  scenarioId: string;
  source: ScenarioScopeSource;
  thresholds: ScopeThresholds extends null
    ? Record<string, unknown> | null
    : Record<string, unknown> | null;
  scopeId: number | string | null;
}

export function useEffectiveScenario(
  sensor: { id: number | string; locationId: number | string | null } | null | undefined,
): {
  data: EffectiveScenario | null;
  isLoading: boolean;
} {
  const sensorId = sensor?.id ?? null;
  const locationId = sensor?.locationId ?? null;

  const sensorQ = useScopeThresholds('sensor', sensorId, {
    enabled: sensorId !== null,
  });
  const locationQ = useScopeThresholds('location', locationId, {
    enabled: locationId !== null && !sensorQ.data?.scenarioId,
  });
  const globalQ = useScopeThresholds('global', null, {
    enabled: !sensorQ.data?.scenarioId && !locationQ.data?.scenarioId,
  });

  const isLoading =
    (sensorQ.isLoading && sensorQ.fetchStatus !== 'idle')
    || (locationQ.isLoading && locationQ.fetchStatus !== 'idle')
    || (globalQ.isLoading && globalQ.fetchStatus !== 'idle');

  const pickThresholds = (raw: ScopeThresholds | null | undefined) =>
    raw && typeof raw === 'object' && 'thresholds' in raw && raw.thresholds
      ? (raw.thresholds as Record<string, unknown>)
      : null;

  if (sensorQ.data?.scenarioId) {
    return {
      data: {
        scenarioId: sensorQ.data.scenarioId,
        source: 'sensor',
        thresholds: pickThresholds(sensorQ.data),
        scopeId: sensorId,
      },
      isLoading: false,
    };
  }
  if (locationQ.data?.scenarioId) {
    return {
      data: {
        scenarioId: locationQ.data.scenarioId,
        source: 'location',
        thresholds: pickThresholds(locationQ.data),
        scopeId: locationId,
      },
      isLoading: false,
    };
  }
  if (globalQ.data?.scenarioId) {
    return {
      data: {
        scenarioId: globalQ.data.scenarioId,
        source: 'global',
        thresholds: pickThresholds(globalQ.data),
        scopeId: null,
      },
      isLoading: false,
    };
  }
  return { data: null, isLoading };
}
