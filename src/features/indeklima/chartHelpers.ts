// ══════════════════════════════════════════════════════════════
// Shared helpers for the sensor-detail chart + fullscreen graph.
//
// Keep data-only logic here so both the portrait detail page and
// the rotated fullscreen viewer render the exact same line from
// the exact same history payload.
// ══════════════════════════════════════════════════════════════
import {
  addDays,
  addMonths,
  format,
  isSameDay,
  subDays,
  subMonths,
} from 'date-fns';

import { colors } from '@/theme';
import type { LinePoint } from '@/features/indeklima/LineChart';
import type { Param } from '@/features/indeklima/thresholds';
import type { HistoryResponse, Sensor } from '@/services/api';
import type { DetailPeriod } from '@/stores/detailPrefsStore';
import { parseLegacy, wallTimeToInstant, DEFAULT_TENANT_TIMEZONE } from '@/lib/datetime';

/** Date → `YYYY-MM-DD` (the format every indeklima endpoint expects). */
export function ymd(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

/**
 * Anchor = the "end" of the window we're looking at. The chart
 * shows [anchor - periodLength, anchor]. `useRaw` picks between
 * the intra-day raw samples endpoint and the hourly aggregate.
 */
export function rangeForAnchor(period: DetailPeriod, anchor: Date) {
  if (period === 'day') {
    return { from: ymd(anchor), to: ymd(anchor), useRaw: true };
  }
  if (period === 'week') {
    return { from: ymd(subDays(anchor, 6)), to: ymd(anchor), useRaw: false };
  }
  if (period === 'month') {
    return { from: ymd(subMonths(anchor, 1)), to: ymd(anchor), useRaw: false };
  }
  return { from: ymd(subMonths(anchor, 3)), to: ymd(anchor), useRaw: false };
}

/**
 * Convert a YYYY-MM-DD `from`/`to` pair into the inclusive ms
 * boundaries `[from 00:00:00, to 23:59:59.999]` so charts that
 * render absolute time bounds (e.g. the presence chart) can span
 * the whole period regardless of where data points fall inside it.
 *
 * The bounds are anchored in the tenant timezone so they line up with
 * the chart points (which are also tenant-tz instants) on any device.
 */
export function rangeToTimestamps(
  from: string,
  to: string,
  tz: string = DEFAULT_TENANT_TIMEZONE,
): { fromTs: number; toTs: number } {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const fromTs = wallTimeToInstant(fy ?? 1970, fm ?? 1, fd ?? 1, 0, 0, 0, tz);
  const toTs = wallTimeToInstant(ty ?? 1970, tm ?? 1, td ?? 1, 23, 59, 59, tz) + 999;
  return { fromTs, toTs };
}

/**
 * Hourly-aggregate field name for a given param. Most params use
 * `<param>_avg`, but presence is aggregated as a count via
 * `pir_sum` (number of PIR trigger events during the hour).
 */
function hourlyKey(param: Param): string {
  return param === 'pir' ? 'pir_sum' : `${param}_avg`;
}

/**
 * Resolve a legacy raw reading to a JS epoch (ms) in the tenant's
 * timezone.
 *
 * Legacy history rows carry both a Unix `timestamp` (seconds) *and*
 * a `{ date, time }` pair. The `{ date, time }` pair is the tenant's
 * wall clock, so we anchor it in `tz` via `parseLegacy` — this keeps
 * the chart's x-axis aligned with the wall clock the user expects on
 * any device. The raw `timestamp` is only a last-resort fallback for
 * older payloads that lack the date/time fields.
 */
function readingEpoch(
  r: { date?: string; time?: string; timestamp?: number },
  tz: string,
): number | null {
  if (
    typeof r.date === 'string'
    && typeof r.time === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(r.date)
  ) {
    const timeStr = r.time.length === 5 ? `${r.time}:00` : r.time;
    const d = parseLegacy(`${r.date}T${timeStr}`, tz);
    if (d) return d.getTime();
  }
  if (typeof r.timestamp === 'number' && Number.isFinite(r.timestamp)) {
    return r.timestamp * 1000;
  }
  return null;
}

/** Convert the two history response shapes (raw | hourly) into chart points. */
export function historyToPoints(
  hist: HistoryResponse | undefined,
  param: Param,
  tz: string = DEFAULT_TENANT_TIMEZONE,
): LinePoint[] {
  if (!hist) return [];
  if (!Array.isArray(hist) && 'resolution' in hist && hist.resolution === 'hourly') {
    const key = hourlyKey(param);
    return hist.readings.map((r) => {
      const raw = r[key as keyof typeof r];
      const v = raw == null ? null : typeof raw === 'number' ? raw : Number(raw);
      // `hour_ts` is a tenant wall-clock string ("YYYY-MM-DD HH:00:00")
      // built from each reading's `date + time` server-side; anchor it
      // in the tenant tz so the axis matches the user's wall clock.
      const d = parseLegacy(r.hour_ts, tz);
      return {
        t: d ? d.getTime() : NaN,
        v: v == null || !Number.isFinite(v) ? null : v,
      };
    }).filter((p) => Number.isFinite(p.t));
  }
  if (Array.isArray(hist)) {
    const out: LinePoint[] = [];
    for (const r of hist) {
      const t = readingEpoch(r, tz);
      if (t == null) continue;
      const raw = (r as Record<string, unknown>)[param];
      const v = raw == null ? null : Number(raw);
      out.push({ t, v: v == null || !Number.isFinite(v) ? null : v });
    }
    return out;
  }
  return [];
}

/** Line stroke colour per parameter. Uses the dusty palette. */
export function paramColor(p: Param): string {
  switch (p) {
    case 'temp': return colors.dusty[3];
    case 'hum': return colors.dusty[7];
    case 'co2': return colors.dusty[2];
    case 'voc': return colors.dusty[5];
    case 'sound': return colors.dusty[5]; // muted sage — matches web PARAM_META
    case 'light': return colors.dusty[6]; // warm taupe — matches web PARAM_META
    case 'pir': return colors.dusty[0]; // brand blue-gray — matches web
  }
}

/**
 * Unit suffix for the given parameter, preferring the sensor's
 * server-provided unit and falling back to the default SI unit.
 *
 * Presence has no unit — it's binary (raw) or a count (hourly sum).
 */
export function unitForParam(sensor: Sensor | undefined | null, p: Param): string {
  if (p === 'temp') return sensor?.tempUnit ?? '°C';
  if (p === 'hum') return sensor?.humUnit ?? '%';
  if (p === 'co2') return sensor?.co2Unit ?? 'ppm';
  if (p === 'sound') return sensor?.soundUnit ?? 'dB';
  if (p === 'light') return sensor?.lightUnit ?? 'lux';
  if (p === 'pir') return '';
  return sensor?.vocUnit ?? 'ppb';
}

// ── Anchor navigation ─────────────────────────────────────
// Shared between the detail page and the fullscreen viewer so
// "previous" / "next" always advance by the same amount per period.

const MONTHS_DA = [
  'jan', 'feb', 'mar', 'apr', 'maj', 'jun',
  'jul', 'aug', 'sep', 'okt', 'nov', 'dec',
] as const;

/** Step the anchor one period forwards (+1) or backwards (-1). */
export function stepAnchor(
  period: DetailPeriod,
  anchor: Date,
  direction: -1 | 1,
): Date {
  if (period === 'day') return direction < 0 ? subDays(anchor, 1) : addDays(anchor, 1);
  if (period === 'week') return direction < 0 ? subDays(anchor, 7) : addDays(anchor, 7);
  if (period === 'month') return direction < 0 ? subMonths(anchor, 1) : addMonths(anchor, 1);
  return direction < 0 ? subMonths(anchor, 3) : addMonths(anchor, 3);
}

/**
 * Human-friendly range label for a given (period, anchor), e.g.
 * "12. – 18. apr" for a week. `todayStr` is the current YYYY-MM-DD
 * and is used only for the special "I dag" case on day view.
 */
export function formatRangeLabel(
  period: DetailPeriod,
  anchor: Date,
  todayStr: string,
): string {
  const today = new Date(`${todayStr}T00:00:00`);
  if (period === 'day') {
    if (isSameDay(anchor, today)) return 'I dag';
    const y = anchor.getFullYear() === today.getFullYear() ? '' : ` ${anchor.getFullYear()}`;
    return `${anchor.getDate()}. ${MONTHS_DA[anchor.getMonth()]}${y}`;
  }
  if (period === 'week') {
    const start = subDays(anchor, 6);
    return `${start.getDate()}. ${MONTHS_DA[start.getMonth()]} – ${anchor.getDate()}. ${MONTHS_DA[anchor.getMonth()]}`;
  }
  if (period === 'month') {
    const start = subMonths(anchor, 1);
    return `${start.getDate()}. ${MONTHS_DA[start.getMonth()]} – ${anchor.getDate()}. ${MONTHS_DA[anchor.getMonth()]}`;
  }
  const start = subMonths(anchor, 3);
  return `${MONTHS_DA[start.getMonth()]} ${start.getFullYear()} – ${MONTHS_DA[anchor.getMonth()]} ${anchor.getFullYear()}`;
}
