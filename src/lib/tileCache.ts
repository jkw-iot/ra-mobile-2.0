// ══════════════════════════════════════════════════════════════
// Tile-cache helper — gives MapView's <UrlTile> a stable, on-device
// directory to persist fetched map tiles between app launches.
//
// `tileCachePath` + `tileCacheMaxAge` are native props of
// `react-native-maps` MKTileOverlay (iOS) / TileOverlay (Android).
// On iOS the underlying behaviour is "serve-stale-while-refresh":
// any tile already on disk is rendered immediately, and a fresh
// fetch is kicked off in the background only after the configured
// max-age expires. That eliminates the Apple-Maps grid that would
// otherwise flash through during the proxy round-trip.
//
// We pin the cache to `Paths.cache` (the system cache directory)
// so iOS may evict tiles under storage pressure — they're trivially
// re-fetchable, so eviction is safe. The tiles cost the user no
// "App size" in Settings, unlike `Paths.document`.
//
// Pre-seeding: `preseedTiles` warms both the Hono server-side
// disk cache and the native HTTP cache (NSURLCache / OkHttp) by
// firing background fetches for tiles inside a bounding box at
// zoom levels 10-15. Runs after sensor groups load so the user's
// usual map viewport is pre-populated before they open the map.
// ══════════════════════════════════════════════════════════════
import { Directory, Paths } from 'expo-file-system';

import { env } from './env';

const TILE_DIR_NAME = 'roomalyzer-tiles';
const tileDir = new Directory(Paths.cache, TILE_DIR_NAME);

/** Absolute `file://` URI passed to `<UrlTile tileCachePath={…} />`. */
export const TILE_CACHE_PATH = tileDir.uri;

/**
 * Tiles are considered fresh for one year. Map cartography changes
 * slowly, and the stale-while-refresh policy means even an "expired"
 * tile renders instantly while the new one downloads in the
 * background — so a long max-age is purely an optimisation, not a
 * correctness risk.
 */
export const TILE_CACHE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

let initPromise: Promise<void> | null = null;

/**
 * Ensure the tile-cache directory exists on disk. Safe to call many
 * times; runs the work exactly once. Errors are swallowed because
 * the cache is purely an optimisation — if directory creation fails
 * the map still works, just without persistence.
 */
export function ensureTileCacheDir(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        if (!tileDir.exists) {
          tileDir.create({ intermediates: true, idempotent: true });
        }
      } catch {
        // best-effort
      }
    })();
  }
  return initPromise;
}

// ── Tile pre-seeding ─────────────────────────────────────────

export interface Bounds {
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
}

const MIN_ZOOM = 10;
const MAX_ZOOM = 15;
const MAX_CONCURRENT = 6;
const MAX_TILES = 300;

function lat2tile(lat: number, z: number): number {
  return Math.floor(
    ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * (1 << z),
  );
}

function lng2tile(lng: number, z: number): number {
  return Math.floor(((lng + 180) / 360) * (1 << z));
}

/** Enumerate all tile coordinates within `bounds` for zoom levels MIN–MAX. */
function tileCoordsForBounds(bounds: Bounds): { z: number; x: number; y: number }[] {
  const coords: { z: number; x: number; y: number }[] = [];
  for (let z = MIN_ZOOM; z <= MAX_ZOOM; z++) {
    const xMin = lng2tile(bounds.lngMin, z);
    const xMax = lng2tile(bounds.lngMax, z);
    const yMin = lat2tile(bounds.latMax, z);
    const yMax = lat2tile(bounds.latMin, z);
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        coords.push({ z, x, y });
      }
    }
    if (coords.length > MAX_TILES) break;
  }
  return coords.slice(0, MAX_TILES);
}

let preseedRunning = false;
let preseedBoundsKey = '';

/**
 * Pre-fetch tiles for the given bounds at z=10-15. Warms both the
 * Hono server-side disk cache and the native HTTP cache so the map
 * opens without white-grid flicker.
 *
 * Safe to call many times — skips if already running for the same
 * bounds, and caps total tiles at MAX_TILES.
 */
export async function preseedTiles(bounds: Bounds): Promise<void> {
  const key = `${bounds.latMin},${bounds.latMax},${bounds.lngMin},${bounds.lngMax}`;
  if (preseedRunning && preseedBoundsKey === key) return;
  preseedRunning = true;
  preseedBoundsKey = key;

  try {
    const coords = tileCoordsForBounds(bounds);
    if (coords.length === 0) return;

    const baseUrl = env.apiBaseUrl;
    let idx = 0;

    async function next(): Promise<void> {
      while (idx < coords.length) {
        const c = coords[idx++]!;
        try {
          await fetch(`${baseUrl}/api/tiles/${c.z}/${c.x}/${c.y}`);
        } catch {
          // best-effort — a single failed tile is harmless
        }
      }
    }

    const workers = Array.from(
      { length: Math.min(MAX_CONCURRENT, coords.length) },
      () => next(),
    );
    await Promise.all(workers);
  } finally {
    preseedRunning = false;
  }
}
