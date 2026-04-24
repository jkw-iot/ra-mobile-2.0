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

import { indeklimaApi, type Sensor } from '@/services/api';
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

// ── Flat sensor list with group title attached ────────────
export interface FlatSensor extends Sensor {
  groupTitle: string;
}

export function useSensorsFlat() {
  const { data, ...rest } = useSensorGroups();
  const sensors = useMemo<FlatSensor[]>(() => {
    if (!data) return [];
    return data.flatMap((g) =>
      g.sensors.map((s) => ({ ...s, groupTitle: g.title })),
    );
  }, [data]);
  return { ...rest, data: sensors };
}

// ── Single sensor (derived from cached group list) ────────
export function useSensor(id: number | null) {
  const { data: flat, ...rest } = useSensorsFlat();
  const sensor = useMemo(() => {
    if (id == null) return null;
    return flat.find((s) => s.id === id) ?? null;
  }, [flat, id]);
  return { ...rest, data: sensor };
}

// ── Raw history for a specific day ────────────────────────
export function useSensorHistoryRaw(id: number | null, date?: string) {
  const tenantId = useTenantStore((s) => s.activeTenantId);
  return useQuery({
    queryKey: ['indeklima', 'sensor', id, 'history', 'raw', { date, tenantId }],
    queryFn: () => indeklimaApi.getSensorHistory(id!, { date, resolution: 'raw' }),
    enabled: id !== null && tenantId !== null,
    staleTime: cacheTiers.raw.staleTime,
    gcTime: cacheTiers.raw.gcTime,
    meta: { cacheTier: 'raw' as const },
  });
}

// ── Hourly-aggregated history for a date range ────────────
export function useSensorHistoryHourly(
  id: number | null,
  from: string | undefined,
  to: string | undefined,
) {
  const tenantId = useTenantStore((s) => s.activeTenantId);
  return useQuery({
    queryKey: ['indeklima', 'sensor', id, 'history', 'hourly', { from, to, tenantId }],
    queryFn: () =>
      indeklimaApi.getSensorHistory(id!, { from, to, resolution: 'hourly' }),
    enabled: id !== null && tenantId !== null && Boolean(from && to),
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
