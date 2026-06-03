// ══════════════════════════════════════════════════════════════
// Threshold normalisation + chart-zone builder.
//
// Ported from ../roomalyzer20/src/services/sensorThresholdApi.js.
// The server returns different shapes depending on where the
// thresholds live (MySQL native, the canonical internal shape, or
// the Legacy raapi long-form). This module folds all three into a
// single internal shape and exposes helpers to:
//
//   1. Pick the thresholds for a UI param ("temp", "hum", "co2",
//      "voc") using the same alias list the web repo uses.
//   2. Build an ordered list of background bands (green / yellow /
//      red) for the chart, honouring the `yellowLower / lower /
//      upper / yellowUpper` four-point scale.
//
// Keep this in lockstep with the web thresholdService — both the
// apps render the same bands so the user experience is identical
// across surfaces.
// ══════════════════════════════════════════════════════════════
import type { SensorThresholds } from '@/services/api';

export type Param = 'temp' | 'hum' | 'co2' | 'voc' | 'sound' | 'light' | 'pir';

export interface NormalizedBand {
  lower?: number;
  upper?: number;
  yellowLower?: number;
  yellowUpper?: number;
}

export type NormalizedThresholds = Record<string, NormalizedBand>;

export interface ChartZone {
  min: number;
  max: number;
  color: string;
}

// Matches checkThresholdStatus / getThresholdZone on the web.
export type ThresholdZone = 'ok' | 'yellow' | 'red';

// Legacy raapi returns long-form keys; map them to our short UI
// keys so downstream code can always use "temp" / "hum".
const LEGACY_KEY_MAP: Record<string, Param | string> = {
  temperature: 'temp',
  humidity: 'hum',
};

// Alias table — same spirit as the web: look up thresholds under
// whichever key the backend happens to have stored them under.
//
// `pir` (presence) is always binary / activity — the backend never
// configures thresholds for it, but the alias list is declared for
// symmetry with the rest of the param system.
const PARAM_ALIASES: Record<Param, readonly string[]> = {
  temp: ['temp', 'temperature'],
  hum: ['hum', 'humidity', 'hum_rh'],
  co2: ['co2', 'carbondioxide'],
  voc: ['voc', 'voc_ppb'],
  sound: ['sound'],
  light: ['light'],
  pir: ['pir', 'presence', 'motion', 'occupancy'],
};

// Dusty palette at low opacity — subtle enough to read as a
// background while still being distinguishable from the grid.
const GREEN = 'rgba(108, 158, 131, 0.14)';
const YELLOW = 'rgba(240, 173, 78, 0.16)';
const RED = 'rgba(214, 91, 91, 0.14)';

// Large but finite bounds so zones always have a concrete rect
// even when only one side is configured. The chart clips them
// to the visible range anyway.
const FAR_LOW = -1e6;
const FAR_HIGH = 1e6;

function asNum(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

// Legacy raapi uses `0` to mean "this threshold is not set"
// (matching the server-side `thresholdNum` helper). Elsewhere
// `0` is a perfectly valid bound, so only apply this trap to
// the legacy shape.
function legacyNum(v: unknown): number | null {
  const n = asNum(v);
  return n === 0 ? null : n;
}

/**
 * Fold the raw API response into a canonical
 * `{ [param]: { lower?, upper?, yellowLower?, yellowUpper? } }`
 * map. Silently drops any key that doesn't look like a threshold
 * block so stray metadata fields (`id`, `name`, …) don't show up.
 */
export function normalizeThresholds(raw: SensorThresholds | undefined): NormalizedThresholds {
  if (!raw || typeof raw !== 'object') return {};

  const src = raw as Record<string, unknown>;
  const out: NormalizedThresholds = {};

  for (const [rawKey, rawVal] of Object.entries(src)) {
    if (rawKey === 'id' || rawKey === 'name') continue;
    if (!rawVal || typeof rawVal !== 'object') continue;

    const key = LEGACY_KEY_MAP[rawKey] ?? rawKey;
    const val = rawVal as Record<string, unknown>;

    let lower: number | null = null;
    let upper: number | null = null;
    let yellowLower: number | null = null;
    let yellowUpper: number | null = null;

    const hasCanonical =
      val.lower != null ||
      val.upper != null ||
      val.yellowLower != null ||
      val.yellowUpper != null;

    const hasMysql =
      val.greenLow != null ||
      val.greenHigh != null ||
      val.yellowLow != null ||
      val.yellowHigh != null;

    if (hasCanonical) {
      lower = asNum(val.lower);
      upper = asNum(val.upper);
      yellowLower = asNum(val.yellowLower);
      yellowUpper = asNum(val.yellowUpper);
    } else if (hasMysql) {
      lower = asNum(val.greenLow);
      upper = asNum(val.greenHigh);
      yellowLower = asNum(val.yellowLow);
      yellowUpper = asNum(val.yellowHigh);
    } else {
      // Legacy raapi: 0 means "unset".
      lower = legacyNum(val.low);
      upper = legacyNum(val.high);
      yellowLower = legacyNum(val.too_low);
      yellowUpper = legacyNum(val.too_high);
    }

    if (
      lower != null ||
      upper != null ||
      yellowLower != null ||
      yellowUpper != null
    ) {
      out[key] = {
        ...(lower != null ? { lower } : {}),
        ...(upper != null ? { upper } : {}),
        ...(yellowLower != null ? { yellowLower } : {}),
        ...(yellowUpper != null ? { yellowUpper } : {}),
      };
    }
  }

  return out;
}

/** Look up the normalised band for a UI param, respecting aliases. */
export function bandForParam(
  thresholds: NormalizedThresholds | undefined,
  param: Param,
): NormalizedBand | undefined {
  if (!thresholds) return undefined;
  for (const alias of PARAM_ALIASES[param]) {
    const hit = thresholds[alias];
    if (hit) return hit;
  }
  return undefined;
}

/**
 * Whether the sensor has any configured thresholds for a param.
 * Callers use this to decide whether a "green" / "in-range" badge
 * is meaningful (no thresholds → no green either).
 */
export function hasThresholds(
  thresholds: NormalizedThresholds | undefined,
  param: Param,
): boolean {
  const band = bandForParam(thresholds, param);
  if (!band) return false;
  return (
    band.lower != null
    || band.upper != null
    || band.yellowLower != null
    || band.yellowUpper != null
  );
}

/**
 * Build background zones for a parameter's chart. Always emits the
 * green band first (at the back) then the yellow/red bands on top so
 * stacking works regardless of render order.
 *
 * Rules (mirror web/thresholdService):
 *  - Effective green band uses `lower/upper` when set, otherwise the
 *    yellow (outer) bound as a fallback — yields a sensible band even
 *    when only too_low / too_high is configured.
 *  - Yellow side-bands appear only when both the inner (`lower`/
 *    `upper`) and outer (`yellowLower`/`yellowUpper`) bounds are set
 *    and the outer lies outside the inner.
 *  - Red is everything beyond the outermost bound.
 */
export function buildZonesForParam(
  thresholds: NormalizedThresholds | undefined,
  param: Param,
): ChartZone[] {
  const th = bandForParam(thresholds, param);
  if (!th) return [];

  const { lower, upper, yellowLower, yellowUpper } = th;
  const effLower = lower ?? yellowLower;
  const effUpper = upper ?? yellowUpper;

  if (effLower == null && effUpper == null) return [];

  const zones: ChartZone[] = [];

  // Green (the "good" band) — always pushed first.
  if (effLower != null && effUpper != null) {
    zones.push({ min: effLower, max: effUpper, color: GREEN });
  } else if (effUpper != null) {
    zones.push({ min: FAR_LOW, max: effUpper, color: GREEN });
  } else if (effLower != null) {
    zones.push({ min: effLower, max: FAR_HIGH, color: GREEN });
  }

  // Lower side: yellow between yellowLower and lower (if both),
  // red beyond.
  if (lower != null && yellowLower != null && yellowLower < lower) {
    zones.push({ min: yellowLower, max: lower, color: YELLOW });
    zones.push({ min: FAR_LOW, max: yellowLower, color: RED });
  } else if (effLower != null) {
    zones.push({ min: FAR_LOW, max: effLower, color: RED });
  }

  // Upper side: symmetric.
  if (upper != null && yellowUpper != null && yellowUpper > upper) {
    zones.push({ min: upper, max: yellowUpper, color: YELLOW });
    zones.push({ min: yellowUpper, max: FAR_HIGH, color: RED });
  } else if (effUpper != null) {
    zones.push({ min: effUpper, max: FAR_HIGH, color: RED });
  }

  return zones;
}

/**
 * Zone a single reading falls into. Used by UI bits that want to
 * reflect threshold status on a sensor card/tile.
 */
export function zoneForValue(
  thresholds: NormalizedThresholds | undefined,
  param: Param,
  value: number | null | undefined,
): ThresholdZone {
  if (value == null || !Number.isFinite(value)) return 'ok';
  const th = bandForParam(thresholds, param);
  if (!th) return 'ok';

  const { lower, upper, yellowLower, yellowUpper } = th;

  if (upper != null && yellowUpper != null && yellowUpper > upper) {
    if (value > yellowUpper) return 'red';
    if (value > upper) return 'yellow';
  } else {
    const effUpper = upper ?? yellowUpper;
    if (effUpper != null && value > effUpper) return 'red';
  }

  if (lower != null && yellowLower != null && yellowLower < lower) {
    if (value < yellowLower) return 'red';
    if (value < lower) return 'yellow';
  } else {
    const effLower = lower ?? yellowLower;
    if (effLower != null && value < effLower) return 'red';
  }

  return 'ok';
}
