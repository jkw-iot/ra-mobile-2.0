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

// `/admin/sensor-positions` returns `{ [sensorId]: { lat, lng } }`
// keyed by stringified sensor id.
export type SensorPositions = JsonResponse<
  '/api/admin/sensor-positions',
  'get'
>;

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

  /**
   * Saved GPS positions for sensors placed on the map.
   * Returns `{ [sensorId]: { lat, lng } }`. Endpoint lives under
   * `/admin/...` for historical reasons but is readable by any
   * authenticated tenant member — the same call powers the web
   * Map page for non-admin users.
   */
  getSensorPositions: () =>
    apiClient.get<SensorPositions>('/admin/sensor-positions'),
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

// ── Water Detection ───────────────────────────────────────
//
// The dashboard endpoint returns more fields than the OpenAPI
// schema currently advertises (the spec at gen-time was stale —
// it missed `dryUnacked`, `lowBattery`, `recentHeartbeats`,
// `silentThresholdHours`, `knownSensorIds`, and the `dry_unacked`
// alarm status). Until the next `npm run gen:api` we augment the
// schema-derived shape locally so the feature module stays
// type-safe end-to-end without redefining the whole response.
type SchemaWaterDashboard = JsonResponse<'/api/waterdetection/dashboard', 'get'>;

export interface WaterDashboardKpi {
  total: number;
  alarm: number;
  /** Sensors that went dry while a human ack is still pending. */
  dryUnacked?: number;
  dry: number;
  silent: number;
  /** Sensors with battery <= 20%. */
  lowBattery?: number;
}

export type WaterAlarmStatus = 'active' | 'acknowledged' | 'dry_unacked';

export interface WaterAlarm {
  id: number;
  sensorId: string;
  sensorName: string;
  location: string;
  triggeredAt: string;
  status: WaterAlarmStatus;
  ackBy: string | null;
  ackAt: string | null;
  ackNote: string | null;
  driedAt?: string | null;
}

export interface WaterSilentSensor {
  sensorId: string;
  name: string;
  location: string;
  lastSeen: string | null;
  batteryPct: number | null;
  /** True for sensors registered in /admin/sensors but never seen. */
  neverHeardFrom?: boolean;
}

export interface WaterHeartbeat {
  sensorId: string;
  sensorName: string;
  location: string;
  batteryPct: number | null;
  receivedAt: string;
}

export interface WaterDashboardResponse
  extends Omit<SchemaWaterDashboard, 'kpi' | 'activeAlarms' | 'silentSensors'> {
  kpi: WaterDashboardKpi;
  activeAlarms: WaterAlarm[];
  silentSensors: WaterSilentSensor[];
  recentHeartbeats?: WaterHeartbeat[];
  silentThresholdHours?: number;
  knownSensorIds?: string[];
}

export type WaterConfig = JsonResponse<'/api/waterdetection/config', 'get'>;
export type WaterConfigUpdateBody = {
  silentThresholdHours?: number;
  slaThresholdMinutes?: number;
};

export const waterApi = {
  /** Dashboard KPIs, active alarms, silent sensors and recent heartbeats. */
  getDashboard: () =>
    apiClient.get<WaterDashboardResponse>('/waterdetection/dashboard'),

  /** Per-tenant configuration (silent + SLA thresholds). */
  getConfig: () => apiClient.get<WaterConfig>('/waterdetection/config'),

  /**
   * Update per-tenant configuration. Backend enforces:
   *   - silentThresholdHours >= 24
   *   - slaThresholdMinutes  >= 1
   */
  updateConfig: (body: WaterConfigUpdateBody) =>
    apiClient.put<JsonResponse<'/api/waterdetection/config', 'put'>>(
      '/waterdetection/config',
      body,
    ),
} as const;

// ── Admin Sensors (registered fleet, all sensor types) ────
//
// Used by the water dashboard to count every device registered as
// a water sensor (`sensorType === '27'`) — including ones that
// never sent an event yet, which the live `wd_sensor_status` view
// does not know about. Endpoint is read-accessible by regular
// tenant members (same as `/admin/sensor-positions`).
export type AdminSensor = JsonResponse<'/api/admin/sensors', 'get'>[number];

export const adminApi = {
  getSensors: () => apiClient.get<AdminSensor[]>('/admin/sensors'),
} as const;

// ── Barrel ────────────────────────────────────────────────
export const api = {
  indeklima: indeklimaApi,
  auth: authApi,
  sensorTypes: sensorTypesApi,
  water: waterApi,
  admin: adminApi,
} as const;

// Re-export useful types for feature modules
export type { paths, components } from './schema';
