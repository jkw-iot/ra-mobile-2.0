// ══════════════════════════════════════════════════════════════
// apiErrorMessage — friendly user-facing message for API errors.
//
// Per the "Legacy API Failures — Report, Don't Workaround" rule
// in `.cursorrules`, the mobile app must NEVER paper over a
// backend outage with mock data or silent retries. We still want
// the *user* to see a calm, actionable message instead of a raw
// 502 HTML blob, an nginx error page, or RN's terse
// `TypeError: Network request failed`.
//
// This helper inspects an error thrown by `apiClient` (or any
// `Error`) and decides whether it represents an unreachable /
// broken backend — either:
//   - the Legacy PHP API behind Hono returned a 5xx / non-JSON
//     response (typical "raapi.nn.dk is down"), OR
//   - the request never even reached an HTTP response (Hono
//     itself is down, the LAN profile points at the wrong IP,
//     the user is offline, DNS failed, the request timed out…).
//
// Both situations are indistinguishable from the user's point of
// view, and the same advice applies: wait ~30 minutes, retry,
// then escalate to support if it persists. Hence both map to the
// `errors.legacy_unavailable` copy.
//
// Heuristics treated as "backend unreachable":
//   - HTTP 502 / 503 / 504 from our Hono proxy
//   - Error message mentions "Legacy API" / "Bad Gateway" /
//     "Gateway Timeout" / "Service Unavailable"
//   - The `detail` payload starts with `<html` or `<!DOCTYPE`
//   - Raw fetch failures: `Network request failed` (RN),
//     `Failed to fetch` (web), `AbortError`, `TimeoutError`,
//     `ENOTFOUND` / `ECONNREFUSED` (Node-style messages)
//
// The classifier is intentionally loose; false positives at
// worst show a slightly-too-friendly message, which is far less
// scary than a raw error dump.
// ══════════════════════════════════════════════════════════════
import type { TFunction } from 'i18next';
import { onlineManager } from '@tanstack/react-query';
import { ApiError } from '@/services/api/client';

const LEGACY_STATUS_CODES = new Set([502, 503, 504]);

const LEGACY_HINTS = [
  'legacy api',
  'could not reach legacy',
  'bad gateway',
  'gateway timeout',
  'service unavailable',
];

const NETWORK_HINTS = [
  'network request failed',
  'failed to fetch',
  'network error',
  'load failed',
  'aborterror',
  'timeouterror',
  'request timed out',
  'enotfound',
  'econnrefused',
  'econnreset',
  'etimedout',
  'eaddrnotavail',
  'ehostunreach',
  'enetunreach',
];

function looksLikeHtml(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trimStart().toLowerCase();
  return trimmed.startsWith('<html') || trimmed.startsWith('<!doctype');
}

/** True when this error indicates the Legacy backend is unreachable / broken. */
export function isLegacyOutage(err: unknown): boolean {
  if (!err) return false;

  if (err instanceof ApiError) {
    if (LEGACY_STATUS_CODES.has(err.status)) return true;
    const data = err.data as { error?: unknown; detail?: unknown } | null | undefined;
    if (data && typeof data === 'object') {
      if (looksLikeHtml(data.detail)) return true;
      if (typeof data.error === 'string') {
        const lower = data.error.toLowerCase();
        if (LEGACY_HINTS.some((h) => lower.includes(h))) return true;
      }
    }
  }

  if (err instanceof Error) {
    const lower = err.message.toLowerCase();
    if (LEGACY_HINTS.some((h) => lower.includes(h))) return true;
    if (looksLikeHtml(err.message)) return true;
  }

  return false;
}

/**
 * True when the request never received a successful HTTP response.
 * Covers raw fetch / DNS / timeout / abort failures — i.e. our
 * own Hono backend is down, the user is offline, or anything in
 * between dropped the request before a response came back.
 */
export function isNetworkError(err: unknown): boolean {
  if (!err) return false;
  // ApiError instances always carry a real HTTP status, so by
  // construction they are NOT network errors.
  if (err instanceof ApiError) return false;
  if (err instanceof Error) {
    const haystack = `${err.name} ${err.message}`.toLowerCase();
    if (NETWORK_HINTS.some((h) => haystack.includes(h))) return true;
  }
  if (typeof err === 'string') {
    const lower = err.toLowerCase();
    if (NETWORK_HINTS.some((h) => lower.includes(h))) return true;
  }
  return false;
}

/**
 * True when the backend is unreachable for any reason — either a
 * confirmed Legacy outage bubbled up by Hono, or the request
 * itself never reached a server. The UI treats both identically.
 */
export function isBackendUnreachable(err: unknown): boolean {
  return isLegacyOutage(err) || isNetworkError(err);
}

/**
 * Resolve an error into the localised string we want to show.
 *
 * - Device offline (network error + onlineManager says offline) →
 *   `errors.network` ("check your internet connection")
 * - Network error but device thinks it's online (server unreachable) →
 *   `errors.legacy_unavailable`
 * - Legacy outage (5xx from Hono proxy) →
 *   `errors.legacy_unavailable`
 * - Otherwise → original message, falling back to `errors.unknown`.
 */
export function friendlyApiErrorMessage(err: unknown, t: TFunction): string {
  if (isNetworkError(err)) {
    return onlineManager.isOnline()
      ? t('errors.legacy_unavailable')
      : t('errors.network');
  }
  if (isLegacyOutage(err)) return t('errors.legacy_unavailable');
  if (err instanceof Error && err.message) return err.message;
  return t('errors.unknown');
}
