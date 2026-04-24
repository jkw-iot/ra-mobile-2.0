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

export const indeklimaApi = {
  /** List all sensor groups with live readings. */
  getSensors: () =>
    apiClient.get<JsonResponse<'/api/indeklima/sensors', 'get'>>('/indeklima/sensors'),

  /**
   * Sensor history.
   * - Omit params for raw today.
   * - Use `{ resolution: 'hourly', from, to }` for aggregated range queries.
   */
  getSensorHistory: (
    id: number,
    params: { date?: string; from?: string; to?: string; resolution?: 'raw' | 'hourly' } = {},
  ) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v != null) q.set(k, String(v));
    const qs = q.toString();
    return apiClient.get<HistoryResponse>(
      `/indeklima/sensors/${id}/history${qs ? `?${qs}` : ''}`,
    );
  },

  getAlerts: () =>
    apiClient.get<JsonResponse<'/api/indeklima/alerts', 'get'>>('/indeklima/alerts'),
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
} as const;

// Re-export useful types for feature modules
export type { paths, components } from './schema';
