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
import { parseLegacy, wallTimeToInstant, partsInTz, type WallParts, DEFAULT_TENANT_TIMEZONE } from '@/lib/datetime';

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
/**
 * Resolve a reading to epoch ms using only the tenant wall-clock
 * `{ date, time }` pair. Skips the Unix `timestamp` field entirely
 * because Legacy timestamps are often local wall time encoded as UTC,
 * which shifts display by the tenant offset (e.g. +2 h in CEST).
 */
export function readingEpochWallClock(
  r: { date?: string; time?: string },
  tz: string,
  fallbackDate?: string,
): number | null {
  if (typeof r.time !== 'string' || !/^\d{1,2}:\d{2}/.test(r.time)) return null;
  const dateStr = (typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date))
    ? r.date
    : fallbackDate;
  if (!dateStr) return null;
  const timeStr = r.time.length === 5 ? `${r.time}:00` : r.time;
  const d = parseLegacy(`${dateStr}T${timeStr}`, tz);
  return d?.getTime() ?? null;
}

export function readingEpoch(
  r: { date?: string; time?: string; timestamp?: number | string },
  tz: string,
  fallbackDate?: string,
): number | null {
  const wall = readingEpochWallClock(r, tz, fallbackDate);
  if (wall != null) return wall;
  const raw = r.timestamp;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw < 1e12 ? raw * 1000 : raw;
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw);
    if (Number.isFinite(n)) return n < 1e12 ? n * 1000 : n;
    const d = parseLegacy(raw, tz);
    if (d) return d.getTime();
  }
  return null;
}

/** Normalise a history row's PIR field to 0 (vacant) or 1 (occupied). */
export function getPirValue(reading: Record<string, unknown>): number | null {
  const v = reading.pir ?? reading.presence ?? reading.motion
    ?? reading.occupancy ?? reading.PIR;
  if (v == null || v === '' || v === '-') return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const s = String(v).toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes') return 1;
  if (s === 'false' || s === '0' || s === 'no') return 0;
  const num = Number(v);
  if (!Number.isFinite(num)) return null;
  if (num > 1) return num >= 50 ? 1 : 0;
  return num > 0 ? 1 : 0;
}

export interface PirReading {
  t: number;
  occupied: boolean;
}

/** Build chronological PIR readings from a raw history array. */
export function rawHistoryToPirReadings(
  data: readonly Record<string, unknown>[] | undefined,
  tz: string,
  fallbackDate?: string,
): PirReading[] {
  if (!data?.length) return [];
  const out: PirReading[] = [];
  for (const row of data) {
    const val = getPirValue(row);
    if (val == null) continue;
    const t = readingEpochWallClock(
      row as { date?: string; time?: string },
      tz,
      fallbackDate,
    );
    if (t == null) continue;
    out.push({ t, occupied: val > 0 });
  }
  return out.sort((a, b) => a.t - b.t);
}

/** Build chronological PIR readings from an hourly history response. */
export function hourlyHistoryToPirReadings(
  hist: HistoryResponse | undefined,
  tz: string,
): PirReading[] {
  const points = historyToPoints(hist, 'pir', tz);
  return points
    .filter((p): p is LinePoint & { v: number } => p.v != null && Number.isFinite(p.v))
    .map((p) => ({ t: p.t, occupied: p.v > 0 }))
    .sort((a, b) => a.t - b.t);
}

/** Derive the PIR "since" timestamp from chart points (same parsing as PresenceChart). */
export function pirSinceMsFromPoints(
  points: readonly LinePoint[],
  currentOccupied: boolean,
): number | null {
  const readings: PirReading[] = points
    .filter((p): p is LinePoint & { v: number } => p.v != null && Number.isFinite(p.v))
    .map((p) => ({ t: p.t, occupied: p.v > 0 }));
  return findPirStateSinceMs(readings, currentOccupied);
}

/**
 * Find when the current PIR state began within a set of readings.
 * Returns Unix ms of the first reading in the current state, or null
 * when no readings are available.
 */
export function findPirStateSinceMs(
  readings: readonly PirReading[],
  currentOccupied: boolean,
): number | null {
  if (readings.length === 0) return null;
  for (let i = readings.length - 1; i >= 0; i--) {
    if (readings[i]!.occupied !== currentOccupied) {
      return readings[i + 1]?.t ?? null;
    }
  }
  return readings[0]!.t;
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
    case 'vtt': return colors.dusty[5]; // muted sage — organic/mould association
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
  if (p === 'vtt') return 'M';
  return sensor?.vocUnit ?? 'ppb';
}

// ── Monotone cubic spline for smooth chart paths ──────────
// Fritsch–Carlson method: the curve passes through every data
// point and never overshoots, which is critical for charts
// (values stay within the data range).

export function monotoneCubicPath(pts: readonly { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M${pts[0]!.x},${pts[0]!.y}`;
  if (pts.length === 2) return `M${pts[0]!.x},${pts[0]!.y}L${pts[1]!.x},${pts[1]!.y}`;

  const n = pts.length;
  const dx: number[] = [];
  const dy: number[] = [];
  const m: number[] = [];

  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1]!.x - pts[i]!.x);
    dy.push(pts[i + 1]!.y - pts[i]!.y);
    m.push(dx[i]! === 0 ? 0 : dy[i]! / dx[i]!);
  }

  const tangents: number[] = [m[0]!];
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1]! * m[i]! <= 0) {
      tangents.push(0);
    } else {
      tangents.push((m[i - 1]! + m[i]!) / 2);
    }
  }
  tangents.push(m[n - 2]!);

  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
    } else {
      const a = tangents[i]! / m[i]!;
      const b = tangents[i + 1]! / m[i]!;
      const s = a * a + b * b;
      if (s > 9) {
        const t = 3 / Math.sqrt(s);
        tangents[i] = t * a * m[i]!;
        tangents[i + 1] = t * b * m[i]!;
      }
    }
  }

  let d = `M${pts[0]!.x},${pts[0]!.y}`;
  for (let i = 0; i < n - 1; i++) {
    const seg = dx[i]! / 3;
    const cp1x = pts[i]!.x + seg;
    const cp1y = pts[i]!.y + tangents[i]! * seg;
    const cp2x = pts[i + 1]!.x - seg;
    const cp2y = pts[i + 1]!.y - tangents[i + 1]! * seg;
    d += `C${cp1x},${cp1y},${cp2x},${cp2y},${pts[i + 1]!.x},${pts[i + 1]!.y}`;
  }
  return d;
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

// ── Nice time ticks for chart x-axes ──────────────────────
// Produces round-boundary tick values (e.g. 06:00, 12:00, midnight)
// and a recommended label format so callers never show "03:07" or
// overlap illegibly.

export type TickFormat = 'time' | 'date' | 'datetime';

export interface NiceTimeTicks {
  ticks: number[];
  format: TickFormat;
}

const HOUR = 3_600_000;
const DAY = 86_400_000;

interface CandidateInterval {
  ms: number;
  snapFn: (p: WallParts, tz: string) => number;
  stepFn: (prev: number, tz: string) => number;
  format: TickFormat;
}

function snapToHour(p: WallParts, hourMultiple: number, tz: string): number {
  const snapped = Math.ceil(p.hour / hourMultiple) * hourMultiple;
  if (snapped >= 24) {
    return wallTimeToInstant(p.year, p.month, p.day + 1, 0, 0, 0, tz);
  }
  return wallTimeToInstant(p.year, p.month, p.day, snapped, 0, 0, tz);
}

function snapToDay(p: WallParts, tz: string): number {
  if (p.hour > 0 || p.minute > 0 || p.second > 0) {
    return wallTimeToInstant(p.year, p.month, p.day + 1, 0, 0, 0, tz);
  }
  return wallTimeToInstant(p.year, p.month, p.day, 0, 0, 0, tz);
}

function buildCandidates(): CandidateInterval[] {
  const hourCandidate = (h: number): CandidateInterval => ({
    ms: h * HOUR,
    snapFn: (p, tz) => snapToHour(p, h, tz),
    stepFn: (prev, tz) => {
      const pp = partsInTz(prev, tz);
      const nextH = pp.hour + h;
      if (nextH >= 24) {
        return wallTimeToInstant(pp.year, pp.month, pp.day + 1, nextH - 24, 0, 0, tz);
      }
      return wallTimeToInstant(pp.year, pp.month, pp.day, nextH, 0, 0, tz);
    },
    format: 'time',
  });

  const dayCandidate = (days: number): CandidateInterval => ({
    ms: days * DAY,
    snapFn: (p, tz) => snapToDay(p, tz),
    stepFn: (prev, tz) => {
      const pp = partsInTz(prev, tz);
      return wallTimeToInstant(pp.year, pp.month, pp.day + days, 0, 0, 0, tz);
    },
    format: 'date',
  });

  const monthCandidate = (months: number): CandidateInterval => ({
    ms: months * 30 * DAY,
    snapFn: (p, tz) => {
      if (p.day === 1 && p.hour === 0 && p.minute === 0) {
        return wallTimeToInstant(p.year, p.month, 1, 0, 0, 0, tz);
      }
      const nextMo = p.month + 1 > 12 ? 1 : p.month + 1;
      const nextY = p.month + 1 > 12 ? p.year + 1 : p.year;
      return wallTimeToInstant(nextY, nextMo, 1, 0, 0, 0, tz);
    },
    stepFn: (prev, tz) => {
      const pp = partsInTz(prev, tz);
      const nextMo = pp.month + months;
      const y = pp.year + Math.floor((nextMo - 1) / 12);
      const m = ((nextMo - 1) % 12) + 1;
      return wallTimeToInstant(y, m, 1, 0, 0, 0, tz);
    },
    format: 'date',
  });

  return [
    hourCandidate(1),
    hourCandidate(2),
    hourCandidate(3),
    hourCandidate(6),
    hourCandidate(12),
    dayCandidate(1),
    dayCandidate(2),
    dayCandidate(7),
    dayCandidate(14),
    monthCandidate(1),
    monthCandidate(3),
  ];
}

const CANDIDATES = buildCandidates();

/**
 * Generate round time ticks for a chart x-axis.
 *
 * @param fromTs  Left edge of the axis (epoch ms, inclusive).
 * @param toTs    Right edge of the axis (epoch ms, inclusive).
 * @param maxTicks Maximum number of ticks to produce (derive from
 *                 `plotWidth / minLabelSpacing`).
 * @param tz      Tenant timezone (for snapping to local midnight etc.).
 */
export function generateNiceTimeTicks(
  fromTs: number,
  toTs: number,
  maxTicks: number,
  tz: string = DEFAULT_TENANT_TIMEZONE,
): NiceTimeTicks {
  const span = Math.max(1, toTs - fromTs);
  const effectiveMax = Math.max(2, maxTicks);

  let chosen: CandidateInterval | null = null;
  for (const c of CANDIDATES) {
    if (span / c.ms <= effectiveMax) {
      chosen = c;
      break;
    }
  }
  if (!chosen) {
    chosen = CANDIDATES[CANDIDATES.length - 1]!;
  }

  const startParts = partsInTz(fromTs, tz);
  let tick = chosen.snapFn(startParts, tz);
  if (tick < fromTs) {
    tick = chosen.stepFn(tick, tz);
  }

  const ticks: number[] = [];
  const safeLimit = effectiveMax + 2;
  while (tick <= toTs && ticks.length < safeLimit) {
    ticks.push(tick);
    tick = chosen.stepFn(tick, tz);
  }

  // If the span is between 1-2 days and we're using day ticks, switch
  // format to 'datetime' so labels like "15. jun 12:00" appear instead
  // of just "15. jun" repeated once.
  let fmt = chosen.format;
  if (fmt === 'date' && span < 2.5 * DAY) {
    fmt = 'datetime';
  }

  return { ticks, format: fmt };
}

/** Minimum pixel spacing per label format. */
export const TICK_LABEL_MIN_WIDTH: Record<TickFormat, number> = {
  time: 48,
  date: 52,
  datetime: 76,
};

/**
 * Compute a safe maxTicks value from the available plot width and the
 * expected label format. Used by chart components to avoid overlap.
 */
export function maxTicksForWidth(plotWidth: number, format?: TickFormat): number {
  const minW = format ? TICK_LABEL_MIN_WIDTH[format] : 52;
  return Math.max(2, Math.floor(plotWidth / minW));
}
