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

/**
 * Scope-based thresholds response: the effective limits AND the
 * scenario id that produced them, for a single (scope_type,
 * scope_id) pair. Returned by `/api/indeklima/thresholds` and
 * documented in the OpenAPI spec as nullable — `null` means
 * "no thresholds configured at this scope".
 */
export type ScopeThresholds = JsonResponse<
  '/api/indeklima/thresholds',
  'get'
>;

export type ThresholdScopeType = 'sensor' | 'location' | 'global';

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
   * Scope-based thresholds + assigned scenario for a (scope_type,
   * scope_id) pair. Used to surface the "active scenario" on the
   * sensor detail screen — the same response is consumed on web by
   * the threshold admin page and the deviation status badge.
   *
   * `scope_id` is omitted for `global` scope. Returns `null` when
   * the scope has no saved thresholds and no fallback could be
   * resolved.
   */
  getScopeThresholds: (
    scopeType: ThresholdScopeType,
    scopeId?: number | string | null,
  ) => {
    const q = new URLSearchParams({ scope_type: scopeType });
    if (scopeId != null && scopeType !== 'global') {
      q.set('scope_id', String(scopeId));
    }
    return apiClient.get<ScopeThresholds | null>(
      `/indeklima/thresholds?${q.toString()}`,
    );
  },

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

// `/waterdetection/map-data` — live status snapshot keyed by
// device sensorId. Fed from `wd_sensor_status`. The OpenAPI
// schema declares status as `'alarm' | 'dry' | 'silent'`; in
// practice the backend can also return `'dry_unacked'` for a
// sensor whose triggering alarm has not yet been acknowledged
// (mirrors the dashboard's `WaterAlarmStatus`). We widen the
// type here so the map can render that fourth state without a
// cast and without lying to TypeScript.
export type WaterMapStatus = 'alarm' | 'dry' | 'dry_unacked' | 'silent';

type SchemaWaterMapItem = JsonResponse<
  '/api/waterdetection/map-data',
  'get'
>[number];

export interface WaterMapDataItem
  extends Omit<SchemaWaterMapItem, 'status'> {
  status: WaterMapStatus;
}

/**
 * Photo attachment for an alarm acknowledgment. The server expects
 * a base64 data URL — `data:image/jpeg;base64,...` (or `image/png`).
 *
 * Server caps (waterdetection.js):
 *   - Max 3 attachments per alarm
 *   - Max 2 MB per attachment (after base64 decode)
 *   - Allowed mime types: image/jpeg, image/png
 *
 * Client-side compression in `src/lib/photoAttachments.ts`
 * keeps real-world payloads at ~200-600 KB so the cap is purely a
 * defensive backstop.
 */
export type WaterAlarmAttachment = {
  /** Original filename (best-effort), used for Content-Disposition on download. */
  filename?: string;
  /** `data:image/jpeg;base64,...` or `data:image/png;base64,...`. */
  dataUrl: string;
  width?: number;
  height?: number;
};

/**
 * Body shape for both `/alarms/{id}/acknowledge` and
 * `/alarms/acknowledge-all`. The route handlers accept the same
 * pair of fields, so we share one type. The OpenAPI schema for the
 * single-alarm endpoint is slightly stale (missing
 * `sendCancellation` and `attachments`), so we redeclare the
 * contract here to match the actual server behaviour.
 *
 * `attachments` is only honoured by the single-alarm endpoint —
 * `/alarms/acknowledge-all` ignores it on the server and the UI
 * does not surface an upload control in bulk mode either.
 */
export type WaterAlarmAckBody = {
  /** Required note describing the resolution. ≥ 1 char (server enforces non-empty). */
  note: string;
  /** When true, sends an "all clear" notification to recipients. */
  sendCancellation?: boolean;
  /** Optional photo evidence — capped at 3 by the server. */
  attachments?: WaterAlarmAttachment[];
};

export const waterApi = {
  /** Dashboard KPIs, active alarms, silent sensors and recent heartbeats. */
  getDashboard: () =>
    apiClient.get<WaterDashboardResponse>('/waterdetection/dashboard'),

  /**
   * Live per-sensor status snapshot for the map / floor-plan view.
   * Returns one row per sensor that has ever been seen by
   * `wd_sensor_status`. Sensors registered in `/admin/sensors`
   * but absent here have never reported and are treated as
   * `'silent'` by the map screen.
   */
  getMapData: () =>
    apiClient.get<WaterMapDataItem[]>('/waterdetection/map-data'),

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

  /** Acknowledge a single active (or `dry_unacked`) alarm. */
  acknowledgeAlarm: (id: number | string, body: WaterAlarmAckBody) =>
    apiClient.post<{ ok: boolean }>(
      `/waterdetection/alarms/${encodeURIComponent(String(id))}/acknowledge`,
      body,
    ),

  /** Bulk-acknowledge every pending alarm for the active tenant. */
  acknowledgeAllAlarms: (body: WaterAlarmAckBody) =>
    apiClient.post<{ ok: boolean; acknowledgedCount: number }>(
      '/waterdetection/alarms/acknowledge-all',
      body,
    ),
} as const;

// ── Admin Sensors (registered fleet, all sensor types) ────
//
// Used by the water dashboard to count active devices registered
// as water sensors (`sensorType === '27'`) — including ones that
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
