// ══════════════════════════════════════════════════════════════
// Typed API helpers — thin layer on top of apiClient that uses
// the generated OpenAPI types so callers get end-to-end type
// safety without any runtime overhead.
//
// Only endpoints actually present in the generated schema are
// surfaced here. Adding a new one is a 3-line addition below.
// ══════════════════════════════════════════════════════════════
import { apiClient } from './client';
import type { paths } from './schema';

type JsonResponse<P extends keyof paths, M extends keyof paths[P]> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  paths[P][M] extends { responses: { 200: { content: { 'application/json': infer R } } } }
    ? R
    : unknown;

// ── Indeklima ──────────────────────────────────────────────
export type SensorGroup = JsonResponse<'/api/indeklima/sensors', 'get'>[number];
export type Sensor = SensorGroup['sensors'][number];
export type HistoryResponse = JsonResponse<'/api/indeklima/sensors/{id}/history', 'get'>;
export type Alert = JsonResponse<'/api/indeklima/alerts', 'get'>[number];
// Map of parameter → { lower?, upper? }. Keys are conventionally
// "temp", "hum", "co2", "voc" but we keep it loose.
export type SensorThresholds = JsonResponse<
  '/api/indeklima/sensors/{id}/thresholds',
  'get'
>;

export type IndeklimaLocation = JsonResponse<
  '/api/indeklima/locations',
  'get'
>[number];

export const indeklimaApi = {
  /** List all sensor groups with live readings. */
  getSensors: () =>
    apiClient.get<JsonResponse<'/api/indeklima/sensors', 'get'>>('/indeklima/sensors'),

  /** Flat location list (id, name, parentId, flow). Used to build the
   *  location filter when sensors have sparse path metadata. */
  getLocations: () =>
    apiClient.get<JsonResponse<'/api/indeklima/locations', 'get'>>(
      '/indeklima/locations',
    ),

  /**
   * Sensor history.
   * - Omit params for raw today.
   * - Use `{ resolution: 'hourly', from, to }` for aggregated range queries.
   *
   * `id` is passed through verbatim so UUID-style sensor IDs (as
   * emitted by some newer v2 miniplus tenants) don't get mangled
   * via `Number()`.
   */
  getSensorHistory: (
    id: number | string,
    params: { date?: string; from?: string; to?: string; resolution?: 'raw' | 'hourly' } = {},
  ) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v != null) q.set(k, String(v));
    const qs = q.toString();
    return apiClient.get<HistoryResponse>(
      `/indeklima/sensors/${encodeURIComponent(String(id))}/history${qs ? `?${qs}` : ''}`,
    );
  },

  getAlerts: () =>
    apiClient.get<JsonResponse<'/api/indeklima/alerts', 'get'>>('/indeklima/alerts'),

  /** Per-sensor threshold limits (season-aware — the backend picks the
   *  right seasonal row). Shape: `{ temp: { lower, upper }, hum: {…} }`. */
  getSensorThresholds: (id: number | string) =>
    apiClient.get<SensorThresholds>(
      `/indeklima/sensors/${encodeURIComponent(String(id))}/thresholds`,
    ),
} as const;

// ── Sensor Types ─────────────────────────────────────────
export interface SensorTypeDef {
  id: number;
  slug: string;
  label: string;
  series: string;
  params: string[];
  legacy_id: string | null;
  is_active: boolean;
}

export const sensorTypesApi = {
  getAll: () => apiClient.get<SensorTypeDef[]>('/sensor-types'),
} as const;

// ── Auth ──────────────────────────────────────────────────
export const authApi = {
  /** Sync backend session after Firebase login (POST). */
  login: () => apiClient.post<JsonResponse<'/api/auth/login', 'post'>>('/auth/login', {}),
  /** Current user profile incl. tenants, roles, modules. */
  me: () => apiClient.get<JsonResponse<'/api/auth/me', 'get'>>('/auth/me'),
} as const;

// ── Barrel ────────────────────────────────────────────────
export const api = {
  indeklima: indeklimaApi,
  auth: authApi,
  sensorTypes: sensorTypesApi,
} as const;

// Re-export useful types for feature modules
export type { paths, components } from './schema';
