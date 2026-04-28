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
// ══════════════════════════════════════════════════════════════
import { Directory, Paths } from 'expo-file-system';

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
