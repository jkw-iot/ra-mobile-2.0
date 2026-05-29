// ══════════════════════════════════════════════════════════════
// Open-Meteo client — outdoor weather snapshot.
//
// Open-Meteo is a free public API (https://open-meteo.com/) that
// requires no API key for non-commercial usage and supports a
// generous CORS / rate-limit budget. We use it to enrich the
// indoor-climate sensor detail page with a small outdoor-weather
// box (current temperature, humidity and a coarse weather
// condition).
//
// This is the ONE place in the app that talks to a 3rd-party
// HTTP API directly. The "no ad-hoc fetch in features" rule from
// .cursorrules applies to the Hono backend (our own data plane);
// this service is intentionally siloed here so callers always go
// through `fetchOutdoorWeather()` and we get one place to swap
// providers if Open-Meteo ever changes shape.
// ══════════════════════════════════════════════════════════════

const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';

/**
 * Coarse weather condition derived from Open-Meteo's WMO weather code.
 * Used to pick the right icon + translation key — we deliberately do
 * NOT surface every WMO subcode to the UI; the indoor-climate detail
 * page only needs an at-a-glance "is it raining outside" hint.
 */
export type OutdoorWeatherCondition =
  | 'clear'
  | 'partly_cloudy'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'thunderstorm';

export interface OutdoorWeather {
  /** Current temperature in °C. */
  temperatureC: number | null;
  /** Current relative humidity in %, clamped to [0, 100] when present. */
  humidityPct: number | null;
  /** Coarse condition derived from `weatherCode`. Always set. */
  condition: OutdoorWeatherCondition;
  /** Raw WMO weather code (kept for diagnostics / future expansion). */
  weatherCode: number | null;
  /** ISO timestamp of the reading as reported by Open-Meteo. */
  observedAt: string | null;
  /** Whether Open-Meteo classifies this hour as night (used for sun/moon). */
  isNight: boolean;
}

/**
 * Map a WMO weather interpretation code to one of our coarse
 * condition buckets. Reference table:
 * https://open-meteo.com/en/docs#weather_variable_documentation
 *
 * Anything we don't explicitly recognise falls back to `cloudy` —
 * it's the most defensible "I don't know what's going on outside"
 * default.
 */
export function classifyWeatherCode(code: number | null | undefined): OutdoorWeatherCondition {
  if (code == null || !Number.isFinite(code)) return 'cloudy';
  if (code === 0) return 'clear';
  if (code === 1 || code === 2) return 'partly_cloudy';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return 'snow';
  if (code >= 95) return 'thunderstorm';
  return 'cloudy';
}

interface OpenMeteoResponse {
  current?: {
    time?: string;
    temperature_2m?: number;
    relative_humidity_2m?: number;
    weather_code?: number;
    is_day?: 0 | 1;
  };
}

function toFiniteNumber(v: unknown): number | null {
  if (typeof v !== 'number') return null;
  return Number.isFinite(v) ? v : null;
}

/**
 * Fetch the current outdoor weather snapshot for a coordinate.
 *
 * Throws on network / HTTP error so TanStack Query can surface
 * the failure via its standard error pipeline. Pass an
 * `AbortSignal` from React Query's `signal` to cancel inflight
 * requests when the screen unmounts or the user navigates away.
 */
export async function fetchOutdoorWeather(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<OutdoorWeather> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('Invalid coordinates');
  }
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lng.toFixed(4),
    current: 'temperature_2m,relative_humidity_2m,weather_code,is_day',
    timezone: 'auto',
  });
  const res = await fetch(`${OPEN_METEO_BASE}?${params.toString()}`, { signal });
  if (!res.ok) {
    throw new Error(`Open-Meteo HTTP ${res.status}`);
  }
  const json = (await res.json()) as OpenMeteoResponse;
  const current = json.current ?? {};
  const humidityRaw = toFiniteNumber(current.relative_humidity_2m);
  const humidityPct =
    humidityRaw == null ? null : Math.max(0, Math.min(100, humidityRaw));
  const weatherCode = toFiniteNumber(current.weather_code);
  return {
    temperatureC: toFiniteNumber(current.temperature_2m),
    humidityPct,
    condition: classifyWeatherCode(weatherCode),
    weatherCode,
    observedAt: typeof current.time === 'string' ? current.time : null,
    isNight: current.is_day === 0,
  };
}
