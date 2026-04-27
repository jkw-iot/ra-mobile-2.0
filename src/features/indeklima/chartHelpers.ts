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
  addYears,
  format,
  isSameDay,
  subDays,
  subMonths,
  subYears,
} from 'date-fns';

import { colors } from '@/theme';
import type { LinePoint } from '@/features/indeklima/LineChart';
import type { Param } from '@/features/indeklima/thresholds';
import type { HistoryResponse, Sensor } from '@/services/api';
import type { DetailPeriod } from '@/stores/detailPrefsStore';

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
  return { from: ymd(subYears(anchor, 1)), to: ymd(anchor), useRaw: false };
}

/**
 * Hourly-aggregate field name for a given param. Most params use
 * `<param>_avg`, but presence is aggregated as a count via
 * `pir_sum` (number of PIR trigger events during the hour).
 */
function hourlyKey(param: Param): string {
  return param === 'pir' ? 'pir_sum' : `${param}_avg`;
}

/** Convert the two history response shapes (raw | hourly) into chart points. */
export function historyToPoints(
  hist: HistoryResponse | undefined,
  param: Param,
): LinePoint[] {
  if (!hist) return [];
  if (!Array.isArray(hist) && 'resolution' in hist && hist.resolution === 'hourly') {
    const key = hourlyKey(param);
    return hist.readings.map((r) => {
      const raw = r[key as keyof typeof r];
      const v = raw == null ? null : typeof raw === 'number' ? raw : Number(raw);
      return {
        t: new Date(r.hour_ts.replace(' ', 'T')).getTime(),
        v: v == null || !Number.isFinite(v) ? null : v,
      };
    });
  }
  if (Array.isArray(hist)) {
    return hist.map((r) => {
      const raw = r[param];
      const v = raw == null ? null : Number(raw);
      return {
        t: r.timestamp * 1000,
        v: v == null || !Number.isFinite(v) ? null : v,
      };
    });
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
  return direction < 0 ? subYears(anchor, 1) : addYears(anchor, 1);
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
  const start = subYears(anchor, 1);
  return `${MONTHS_DA[start.getMonth()]} ${start.getFullYear()} – ${MONTHS_DA[anchor.getMonth()]} ${anchor.getFullYear()}`;
}
