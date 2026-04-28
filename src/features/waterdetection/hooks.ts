// ══════════════════════════════════════════════════════════════
// Vanddetektering — React Query hooks.
//
// Mirrors the web Dashboard's data flow (see
// `roomalyzer20/src/pages/water/Dashboard.jsx`):
//
//   1. `/waterdetection/dashboard` for KPIs + active alarms +
//      silent + recent heartbeats.
//   2. `/admin/sensors` for the active fleet, so we can count
//      every active device whose `sensorType === '27'` — including
//      ones that have never sent an event and therefore are absent
//      from `wd_sensor_status`.
//
// We merge the two: active-but-never-heard-from devices are
// added to `silentSensors` and folded into the silent KPI count
// so the dashboard reflects real fleet size, not just the live
// status table.
//
// Auto-refresh: 10 s `refetchInterval`, same cadence as the web
// dashboard. TanStack Query handles tab-visibility throttling on
// mobile (RN's AppState wiring lives in `app/_layout.tsx`).
// ══════════════════════════════════════════════════════════════
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import {
  adminApi,
  indeklimaApi,
  waterApi,
  type AdminSensor,
  type SensorPositions,
  type WaterDashboardResponse,
  type WaterMapDataItem,
  type WaterMapStatus,
  type WaterSilentSensor,
} from '@/services/api';
import { cacheTiers } from '@/lib/queryClient';
import { useTenantStore } from '@/stores/tenantStore';

/** Legacy sensor-type code that identifies water-detection devices. */
const WATER_LEGACY_ID = '27';

/** Refresh dashboard every 10 s while the screen is mounted. */
const DASHBOARD_REFRESH_MS = 10_000;

/** Same 10 s cadence the web water Map page uses. */
const MAP_REFRESH_MS = 10_000;

export interface MergedDashboard extends WaterDashboardResponse {
  /** Active water sensors (from admin/sensors), used to decide whether
   *  the tenant can currently use the module in the mobile app. */
  activeWaterSensors: number;
}

function mergeRegisteredFleet(
  raw: WaterDashboardResponse | undefined,
  adminSensors: AdminSensor[] | undefined,
): MergedDashboard | undefined {
  if (!raw || !adminSensors) return undefined;

  const water = adminSensors.filter(
    (s) =>
      String(s.sensorType ?? '') === WATER_LEGACY_ID &&
      s.status === 'active',
  );
  const activeWaterSensors = water.length;

  // Sensors that the live `wd_sensor_status` view has never seen
  // are absent from `knownSensorIds`. Synthesise a "silent —
  // never heard from" entry for each so the FM team has a single
  // place to spot devices that aren't reporting.
  const knownIds = new Set(
    (raw.knownSensorIds ?? []).map((s) => String(s).toLowerCase()),
  );
  const neverHeardFrom: WaterSilentSensor[] = water
    .filter((s) => {
      const id = String(s.sensorId ?? s.id ?? '').toLowerCase();
      return id && !knownIds.has(id);
    })
    .map((s) => ({
      sensorId: String(s.sensorId ?? s.id),
      name: s.name ?? String(s.sensorId ?? s.id),
      location: s.locationName ?? '',
      lastSeen: null,
      batteryPct: null,
      neverHeardFrom: true,
    }));

  const apiSilent = raw.silentSensors ?? [];
  const mergedSilent = [...apiSilent, ...neverHeardFrom];

  return {
    ...raw,
    silentSensors: mergedSilent,
    kpi: {
      ...raw.kpi,
      total: activeWaterSensors,
      silent: (raw.kpi.silent ?? 0) + neverHeardFrom.length,
    },
    activeWaterSensors,
  };
}

export function useWaterDashboard() {
  const tenantId = useTenantStore((s) => s.activeTenantId);

  const dashboardQuery = useQuery({
    queryKey: ['waterdetection', 'dashboard', { tenantId }],
    queryFn: () => waterApi.getDashboard(),
    enabled: tenantId !== null,
    staleTime: 0,
    gcTime: cacheTiers.snapshot.gcTime,
    refetchInterval: DASHBOARD_REFRESH_MS,
    meta: { cacheTier: 'snapshot' as const },
  });

  const adminSensorsQuery = useQuery({
    queryKey: ['admin', 'sensors', { tenantId }],
    queryFn: () => adminApi.getSensors(),
    enabled: tenantId !== null,
    staleTime: cacheTiers.snapshot.staleTime,
    gcTime: cacheTiers.snapshot.gcTime,
    meta: { cacheTier: 'snapshot' as const },
  });

  const merged = useMemo(
    () => mergeRegisteredFleet(dashboardQuery.data, adminSensorsQuery.data),
    [dashboardQuery.data, adminSensorsQuery.data],
  );

  return {
    data: merged,
    isLoading: dashboardQuery.isLoading || adminSensorsQuery.isLoading,
    isFetching: dashboardQuery.isFetching || adminSensorsQuery.isFetching,
    isError: dashboardQuery.isError || adminSensorsQuery.isError,
    error: dashboardQuery.error ?? adminSensorsQuery.error,
    refetch: () =>
      Promise.all([dashboardQuery.refetch(), adminSensorsQuery.refetch()]),
    isRefetching: dashboardQuery.isRefetching || adminSensorsQuery.isRefetching,
  };
}

// ── Map sensors (registered fleet × live status × GPS positions) ─

/**
 * One unified row per active water-detection device, ready for
 * the map screen. Mirrors the merging the web Map page performs
 * (`roomalyzer20/src/pages/water/Map.jsx`):
 *
 *   1. Take the active fleet from `/admin/sensors` filtered to
 *      `sensorType === '27'` (so devices that have never sent a
 *      heartbeat are still represented).
 *   2. Overlay live status from `/waterdetection/map-data`
 *      (alarm / dry / dry_unacked / silent + battery + last seen).
 *      Devices missing from the live snapshot are assumed silent.
 *   3. Attach `lat / lng` from `/admin/sensor-positions`. Sensors
 *      without saved coordinates still appear in the dataset
 *      (so the location-filter counts stay honest); the map
 *      screen filters them out before rendering markers.
 */
export interface WaterMapSensor {
  /** Device string id (e.g. `"abc88"`). Used as React key + nav. */
  sensorId: string;
  /** Internal numeric DB id, stringified — also used as a key. */
  numericId: string;
  name: string;
  /** Display location name (resolved from `/indeklima/locations`
   *  via the screen, falling back to whatever the legacy live
   *  status row carried). */
  location: string;
  /** Numeric location id from `/admin/sensors`, used by the
   *  TreeSelect filter to match against the location subtree. */
  locationId: number | null;
  status: WaterMapStatus;
  batteryPct: number | null;
  lastSeen: string | null;
  lastAlarmAt: string | null;
  lat: number | null;
  lng: number | null;
}

function readPosition(
  positions: SensorPositions | undefined,
  sensorId: string,
  numericId: string,
): { lat: number; lng: number } | null {
  if (!positions) return null;
  const map = positions as unknown as Record<
    string,
    { lat: number; lng: number }
  >;
  const candidates = [sensorId, sensorId.toLowerCase(), numericId];
  for (const key of candidates) {
    const entry = map[key];
    if (
      entry &&
      typeof entry.lat === 'number' &&
      typeof entry.lng === 'number' &&
      Number.isFinite(entry.lat) &&
      Number.isFinite(entry.lng)
    ) {
      return { lat: entry.lat, lng: entry.lng };
    }
  }
  return null;
}

function mergeWaterMapSensors(
  adminSensors: AdminSensor[] | undefined,
  mapData: WaterMapDataItem[] | undefined,
  positions: SensorPositions | undefined,
): WaterMapSensor[] {
  if (!adminSensors) return [];

  const statusByDevice = new Map<string, WaterMapDataItem>();
  for (const item of mapData ?? []) {
    if (!item?.sensorId) continue;
    statusByDevice.set(String(item.sensorId).toLowerCase(), item);
  }

  const out: WaterMapSensor[] = [];
  for (const s of adminSensors) {
    if (String(s.sensorType ?? '') !== WATER_LEGACY_ID) continue;
    if (s.status !== 'active') continue;

    const sensorId = String(s.sensorId ?? s.id);
    const numericId = String(s.id);
    const live = statusByDevice.get(sensorId.toLowerCase()) ?? null;
    const pos = readPosition(positions, sensorId, numericId);

    out.push({
      sensorId,
      numericId,
      name: s.name ?? live?.name ?? sensorId,
      location: s.locationName ?? live?.location ?? '',
      locationId: s.locationId ?? null,
      // Sensors absent from `wd_sensor_status` have never reported
      // → treat as silent (mirrors the web Map merge).
      status: live ? live.status : 'silent',
      batteryPct: live?.batteryPct ?? s.battery ?? null,
      lastSeen: live?.lastSeen ?? s.lastSeen ?? null,
      lastAlarmAt: live?.lastAlarmAt ?? null,
      lat: pos?.lat ?? null,
      lng: pos?.lng ?? null,
    });
  }
  return out;
}

/**
 * Fetches the three datasets the water map needs and returns
 * a unified, ready-to-render list. Each underlying query keeps
 * its own cache key so the dashboard's `/admin/sensors` cache
 * is reused (no double-fetch on tab switch). Auto-refresh
 * cadence matches the web Map page (10 s).
 */
export function useWaterMapSensors() {
  const tenantId = useTenantStore((s) => s.activeTenantId);

  const adminSensorsQuery = useQuery({
    queryKey: ['admin', 'sensors', { tenantId }],
    queryFn: () => adminApi.getSensors(),
    enabled: tenantId !== null,
    staleTime: cacheTiers.snapshot.staleTime,
    gcTime: cacheTiers.snapshot.gcTime,
    meta: { cacheTier: 'snapshot' as const },
  });

  const mapDataQuery = useQuery({
    queryKey: ['waterdetection', 'map-data', { tenantId }],
    queryFn: () => waterApi.getMapData(),
    enabled: tenantId !== null,
    staleTime: 0,
    gcTime: cacheTiers.snapshot.gcTime,
    refetchInterval: MAP_REFRESH_MS,
    meta: { cacheTier: 'snapshot' as const },
  });

  // Same `/admin/sensor-positions` endpoint indeklima uses. We
  // requery it under a water-namespaced key so a tenant switch
  // followed by a module switch never serves stale positions
  // from a previous tenant's indeklima view.
  const positionsQuery = useQuery({
    queryKey: ['waterdetection', 'sensor-positions', { tenantId }],
    queryFn: () => indeklimaApi.getSensorPositions(),
    enabled: tenantId !== null,
    staleTime: cacheTiers.snapshot.staleTime,
    gcTime: cacheTiers.snapshot.gcTime,
    meta: { cacheTier: 'snapshot' as const },
  });

  const data = useMemo(
    () =>
      mergeWaterMapSensors(
        adminSensorsQuery.data,
        mapDataQuery.data,
        positionsQuery.data,
      ),
    [adminSensorsQuery.data, mapDataQuery.data, positionsQuery.data],
  );

  return {
    data,
    isLoading:
      adminSensorsQuery.isLoading ||
      mapDataQuery.isLoading ||
      positionsQuery.isLoading,
    isFetching:
      adminSensorsQuery.isFetching ||
      mapDataQuery.isFetching ||
      positionsQuery.isFetching,
    isError:
      adminSensorsQuery.isError ||
      mapDataQuery.isError ||
      positionsQuery.isError,
    error:
      adminSensorsQuery.error ??
      mapDataQuery.error ??
      positionsQuery.error,
    refetch: () =>
      Promise.all([
        adminSensorsQuery.refetch(),
        mapDataQuery.refetch(),
        positionsQuery.refetch(),
      ]),
    isRefetching:
      adminSensorsQuery.isRefetching ||
      mapDataQuery.isRefetching ||
      positionsQuery.isRefetching,
  };
}
