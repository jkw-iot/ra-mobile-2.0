// ══════════════════════════════════════════════════════════════
// Vanddetektering — React Query hooks.
//
// Mirrors the web Dashboard's data flow (see
// `roomalyzer20/src/pages/water/Dashboard.jsx`):
//
//   1. `/waterdetection/dashboard` for KPIs + active alarms +
//      silent + recent heartbeats.
//   2. `/admin/sensors` for the registered fleet, so we can count
//      every device whose `sensorType === '27'` — including ones
//      that have never sent an event and therefore are absent
//      from `wd_sensor_status`.
//
// We merge the two: registered-but-never-heard-from devices are
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
  waterApi,
  type AdminSensor,
  type WaterDashboardResponse,
  type WaterSilentSensor,
} from '@/services/api';
import { cacheTiers } from '@/lib/queryClient';
import { useTenantStore } from '@/stores/tenantStore';

/** Legacy sensor-type code that identifies water-detection devices. */
const WATER_LEGACY_ID = '27';

/** Refresh dashboard every 10 s while the screen is mounted. */
const DASHBOARD_REFRESH_MS = 10_000;

export interface MergedDashboard extends WaterDashboardResponse {
  /** Total registered water sensors (from admin/sensors), used for the
   *  "sensorer i alt" KPI when the live view hasn't seen them yet. */
  totalRegistered: number;
}

function mergeRegisteredFleet(
  raw: WaterDashboardResponse | undefined,
  adminSensors: AdminSensor[] | undefined,
): MergedDashboard | undefined {
  if (!raw) return undefined;

  const water = (adminSensors ?? []).filter(
    (s) => String(s.sensorType ?? '') === WATER_LEGACY_ID,
  );
  const totalRegistered = water.length;

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
      total: totalRegistered || raw.kpi.total,
      silent: (raw.kpi.silent ?? 0) + neverHeardFrom.length,
    },
    totalRegistered,
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
    isLoading: dashboardQuery.isLoading,
    isFetching: dashboardQuery.isFetching || adminSensorsQuery.isFetching,
    isError: dashboardQuery.isError || adminSensorsQuery.isError,
    error: dashboardQuery.error ?? adminSensorsQuery.error,
    refetch: () => {
      dashboardQuery.refetch();
      adminSensorsQuery.refetch();
    },
    isRefetching: dashboardQuery.isRefetching || adminSensorsQuery.isRefetching,
  };
}
