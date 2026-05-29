// ══════════════════════════════════════════════════════════════
// datetime — the ONE allowed time / date model in the app.
//
// Why this file exists
// --------------------
// Legacy returns sensor timestamps as full strings that carry a
// MISLEADING timezone marker, e.g. "2026-05-29T17:00:00Z" or
// "...+01:00", where the wall-clock time is actually the tenant's
// LOCAL time — not UTC. Calling `new Date(raw)` honours that lie
// and shifts the displayed time by the device's UTC offset (the
// "1 time foran" bug on the sensor list).
//
// This module mirrors the web app's `useTenantTime` /
// `server/utils/tenantTime.js`:
//   • `parseLegacy(raw, tz)` strips the lying marker and re-anchors
//     the wall clock in the tenant's IANA zone, so the resulting
//     instant renders identically on any device.
//   • `parseUtc(raw)` parses genuinely-UTC fields.
//   • `createTenantTime(tz, locale)` returns formatters bound to the
//     tenant timezone + UI language. Every "HH:mm" / "DD. mon" /
//     full datetime in the app goes through these.
//
// Discipline
// ----------
// • Never call `new Date(apiString)` on a Legacy timestamp in a
//   component — use `parseLegacy()` / `parseUtc()`.
// • Never call `.toLocaleString(...)` directly for tenant-facing
//   times — use the bound formatters (so they respect tenant tz).
// ══════════════════════════════════════════════════════════════

/** Mirror of server/utils/tenantTime.js — Danish is always default. */
export const DEFAULT_TENANT_TIMEZONE = 'Europe/Copenhagen';

/** UI language → BCP-47 locale tag for `Intl.DateTimeFormat`. */
const LOCALE_MAP: Record<string, string> = {
  da: 'da-DK',
  en: 'en-GB',
  de: 'de-DE',
  sv: 'sv-SE',
};

/** Resolve an i18next language code to a BCP-47 locale tag. */
export function localeForLang(lang: string | undefined): string {
  if (!lang) return LOCALE_MAP.da!;
  const base = lang.toLowerCase().split('-')[0]!;
  return LOCALE_MAP[base] ?? LOCALE_MAP.da!;
}

// Short Danish month names — used for the compact "DD. mon" list
// label and as a locale-independent fallback when Intl with a
// timeZone is unavailable on the JS engine (see below).
const MONTHS_DA = [
  'jan', 'feb', 'mar', 'apr', 'maj', 'jun',
  'jul', 'aug', 'sep', 'okt', 'nov', 'dec',
] as const;

// ── Timezone offset (DST-safe) ────────────────────────────────
//
// `Intl.DateTimeFormat(..., { timeZone }).formatToParts` is the same
// primitive the server's tenantTime.js relies on. Hermes supports it
// on iOS (Apple ICU) and on modern Android builds; if a given engine
// throws or returns garbage we fall back to the device's own offset
// so we degrade to "device-local wall clock" rather than crashing —
// the lying-marker strip already removes the original bug in that
// case.
//
// We memoise one en-US formatter per timezone so we don't rebuild it
// on every reading.
const _offsetFormatters = new Map<string, Intl.DateTimeFormat | null>();

function offsetFormatter(tz: string): Intl.DateTimeFormat | null {
  if (_offsetFormatters.has(tz)) return _offsetFormatters.get(tz) ?? null;
  let fmt: Intl.DateTimeFormat | null = null;
  try {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    // Probe once so a broken timeZone implementation fails fast here.
    fmt.formatToParts(new Date(0));
  } catch {
    fmt = null;
  }
  _offsetFormatters.set(tz, fmt);
  return fmt;
}

interface WallParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
  second: number;
}

/** Read the wall-clock components of an instant in `tz`. Falls back to
 *  the device's own wall clock when the engine lacks timeZone support. */
function partsInTz(utcMs: number, tz: string): WallParts {
  const fmt = offsetFormatter(tz);
  if (!fmt) {
    const d = new Date(utcMs);
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      hour: d.getHours(),
      minute: d.getMinutes(),
      second: d.getSeconds(),
    };
  }
  const parts = fmt.formatToParts(new Date(utcMs));
  const get = (type: Intl.DateTimeFormatPartTypes): number => {
    const p = parts.find((x) => x.type === type);
    return p ? Number(p.value) : 0;
  };
  let hour = get('hour');
  // `h23` renders midnight as 24 in some engines — normalise.
  if (hour === 24) hour = 0;
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour,
    minute: get('minute'),
    second: get('second'),
  };
}

/**
 * Offset (ms) to ADD to a UTC instant to obtain the tenant-zone wall
 * clock — i.e. `wallMs = utcMs + tzOffsetMs(utcMs, tz)`.
 */
function tzOffsetMs(utcMs: number, tz: string): number {
  const fmt = offsetFormatter(tz);
  if (!fmt) {
    // Engine can't do timeZone — fall back to the device's own offset
    // (getTimezoneOffset returns minutes WEST of UTC, hence the sign).
    return -new Date(utcMs).getTimezoneOffset() * 60_000;
  }
  const p = partsInTz(utcMs, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - utcMs;
}

/**
 * Interpret naive wall-clock components as the wall time in `tz` and
 * return the corresponding absolute instant (ms since epoch).
 *
 * DST-safe via two passes: the first offset guess can be wrong by an
 * hour exactly at a DST transition, so we re-evaluate the offset at
 * the corrected instant and apply it.
 */
export function wallTimeToInstant(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  s: number,
  tz: string,
): number {
  const naiveUtc = Date.UTC(y, mo - 1, d, h, mi, s);
  let instant = naiveUtc - tzOffsetMs(naiveUtc, tz);
  // Second pass: correct for a DST boundary crossing.
  const refined = naiveUtc - tzOffsetMs(instant, tz);
  if (refined !== instant) instant = refined;
  return instant;
}

// ── Parsing ───────────────────────────────────────────────────

const WALL_CLOCK_RE =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/;

/**
 * Parse a Legacy "last seen" / reading timestamp as the wall time the
 * sensor actually reported, re-anchored in the tenant's timezone.
 *
 * Legacy frequently appends `Z` (or a stale `+01:00`) to strings that
 * are really local wall time. We strip that marker, then interpret the
 * remaining "YYYY-MM-DD HH:mm:ss" as wall time in `tz`. Returns `null`
 * for input that isn't a parseable wall-clock string (e.g. an already
 * pre-formatted "17:33" token).
 */
export function parseLegacy(
  raw: string | number | null | undefined,
  tz: string = DEFAULT_TENANT_TIMEZONE,
): Date | null {
  if (raw == null) return null;
  if (typeof raw === 'number') {
    return new Date(raw < 1e12 ? raw * 1000 : raw);
  }
  const s = String(raw).trim();
  // Strip a trailing Z and any explicit ±HH:MM offset.
  const stripped = s.replace(/Z$/i, '').replace(/[+-]\d{2}:\d{2}$/, '');
  const m = WALL_CLOCK_RE.exec(stripped);
  if (!m) return null;
  const instant = wallTimeToInstant(
    Number(m[1]),
    Number(m[2]),
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    m[6] ? Number(m[6]) : 0,
    tz,
  );
  return Number.isFinite(instant) ? new Date(instant) : null;
}

/**
 * Parse a genuinely-UTC timestamp. Accepts a Date, unix s/ms, a MySQL
 * "YYYY-MM-DD HH:mm:ss" (treated as UTC) or a true ISO string.
 */
export function parseUtc(raw: string | number | Date | null | undefined): Date | null {
  if (raw == null) return null;
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
  if (typeof raw === 'number') {
    return new Date(raw < 1e12 ? raw * 1000 : raw);
  }
  const s = String(raw).trim();
  const withZ = /[Zz]|[+-]\d{2}:\d{2}$/.test(s) ? s : s.replace(' ', 'T') + 'Z';
  const d = new Date(withZ);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ── Bound formatters ──────────────────────────────────────────
//
// Output is composed deterministically from the tenant-zone wall
// clock so the app keeps its existing appearance everywhere: 24-hour
// colon times ("17:33") and Danish short month names ("21. nov"),
// regardless of the device locale. Only the underlying instant is
// timezone-corrected.

export interface TenantTime {
  /** Active tenant IANA timezone (e.g. "Europe/Copenhagen"). */
  readonly tz: string;
  /** Active BCP-47 locale (e.g. "da-DK"). Reserved for future
   *  locale-aware formatting; current output is Danish-styled. */
  readonly locale: string;
  parseLegacy: (raw: string | number | null | undefined) => Date | null;
  parseUtc: (raw: string | number | Date | null | undefined) => Date | null;
  /** "HH:mm" in tenant tz. */
  formatTime: (input: Date | null) => string;
  /** "21. nov" (day + short Danish month) in tenant tz. */
  formatMonthDay: (input: Date | null) => string;
  /** "21. nov 17:33" in tenant tz (no year). */
  formatMonthDayTime: (input: Date | null) => string;
  /** "21. nov 2026" in tenant tz. */
  formatMonthDayYear: (input: Date | null) => string;
  /** "21. nov 2026, kl. 17:33" in tenant tz. */
  formatDateTime: (input: Date | null) => string;
  /** Compact list label: "HH:mm" today, else "21. nov" — with a
   *  silent flag for stale readings. */
  formatSensorListTime: (input: Date | null, now?: Date) => {
    text: string;
    isSilent: boolean;
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Build a set of formatters + parsers bound to a tenant timezone and
 * UI locale. Cheap to call; callers typically get this from the
 * `useTenantTime()` hook so it stays in sync with tenant/language.
 */
export function createTenantTime(
  tz: string = DEFAULT_TENANT_TIMEZONE,
  locale: string = LOCALE_MAP.da!,
): TenantTime {
  const isValid = (input: Date | null): input is Date =>
    !!input && !Number.isNaN(input.getTime());

  const formatTime = (input: Date | null): string => {
    if (!isValid(input)) return '—';
    const p = partsInTz(input.getTime(), tz);
    return `${pad2(p.hour)}:${pad2(p.minute)}`;
  };

  const formatMonthDay = (input: Date | null): string => {
    if (!isValid(input)) return '—';
    const p = partsInTz(input.getTime(), tz);
    return `${p.day}. ${MONTHS_DA[p.month - 1]}`;
  };

  const formatMonthDayTime = (input: Date | null): string => {
    if (!isValid(input)) return '—';
    const p = partsInTz(input.getTime(), tz);
    return `${p.day}. ${MONTHS_DA[p.month - 1]} ${pad2(p.hour)}:${pad2(p.minute)}`;
  };

  const formatMonthDayYear = (input: Date | null): string => {
    if (!isValid(input)) return '—';
    const p = partsInTz(input.getTime(), tz);
    return `${p.day}. ${MONTHS_DA[p.month - 1]} ${p.year}`;
  };

  const formatDateTime = (input: Date | null): string => {
    if (!isValid(input)) return '—';
    const p = partsInTz(input.getTime(), tz);
    return `${p.day}. ${MONTHS_DA[p.month - 1]} ${p.year}, kl. ${pad2(p.hour)}:${pad2(p.minute)}`;
  };

  // Compact list label reproduces the previous SensorsScreen rules:
  //   < 24h → "HH:mm", else → "DD. mon"; readings older than 48h are
  //   marked silent so the card can dim + flag them.
  const formatSensorListTime = (
    input: Date | null,
    now: Date = new Date(),
  ): { text: string; isSilent: boolean } => {
    if (!isValid(input)) return { text: '—', isSilent: true };
    const hoursDiff = (now.getTime() - input.getTime()) / (1000 * 60 * 60);
    if (hoursDiff < 24) return { text: formatTime(input), isSilent: false };
    return { text: formatMonthDay(input), isSilent: hoursDiff > 48 };
  };

  return {
    tz,
    locale,
    parseLegacy: (raw) => parseLegacy(raw, tz),
    parseUtc,
    formatTime,
    formatMonthDay,
    formatMonthDayTime,
    formatMonthDayYear,
    formatDateTime,
    formatSensorListTime,
  };
}

/** Shared default-zone instance for non-React (pure) call sites. */
export const defaultTenantTime = createTenantTime();
