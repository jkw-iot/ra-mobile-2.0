// ══════════════════════════════════════════════════════════════
// TanStack Query client + tiered cache persistence
//
// Tiered cache strategy (see .cursorrules → Offline / cache):
//   Snapshot     latest reading of every sensor         24 h staleTime
//   Raw          5-min, last 7 days, opened sensors     7 days gcTime
//   Downsampled  hour/day, last 30d / 1y                30 days gcTime
//   On-demand    older than 1y                           not cached
//
// The `cacheTier` meta on each query controls which bucket it
// belongs to and therefore its staleTime / gcTime. Keep query
// keys hierarchical so tenant-switching can invalidate everything
// at once via queryClient.invalidateQueries({ queryKey: ['indeklima'] })
// or queryClient.clear().
// ══════════════════════════════════════════════════════════════
import { QueryClient, onlineManager } from '@tanstack/react-query';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import NetInfo from '@react-native-community/netinfo';

import { storage, StorageKeys } from './storage';

// ── Online/offline awareness ─────────────────────────────────
// Tells TanStack Query whether the device has network. When
// offline, queries pause instead of failing; when connectivity
// returns, they automatically refetch.
onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    setOnline(!!state.isConnected);
  });
});

const HOURS = 60 * 60 * 1000;
const DAYS = 24 * HOURS;

// ── Cache tier presets ────────────────────────────────────
export const cacheTiers = {
  snapshot: {
    staleTime: 1 * HOURS,
    gcTime: 1 * DAYS,
  },
  raw: {
    staleTime: 2 * HOURS,
    gcTime: 7 * DAYS,
  },
  downsampled: {
    staleTime: 6 * HOURS,
    gcTime: 30 * DAYS,
  },
  onDemand: {
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
  },
} as const;

export type CacheTier = keyof typeof cacheTiers;

// Default is "snapshot" — short staleTime, everyday reads.
// Override per-query with meta: { cacheTier: 'raw' } (see useSensorHistory).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: cacheTiers.snapshot.staleTime,
      gcTime: cacheTiers.raw.gcTime, // max 7 days so anything cached survives a week offline
      retry: (failureCount, error) => {
        // Don't retry 4xx — they won't succeed. Retry 5xx / network twice.
        const status = (error as { status?: number })?.status;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false, // RN equivalent = AppState; handled in app/_layout.tsx
    },
  },
});

// ── Storage-backed persister ───────────────────────────────
// Uses the synchronous `storage` wrapper (MMKV or AsyncStorage-
// hydrated). `persistClient` is debounced so that startup query
// storms (dozens of queries resolving in quick succession) only
// trigger 1-2 serialisations instead of one per query update.
let persistTimer: ReturnType<typeof setTimeout> | null = null;
const PERSIST_DEBOUNCE_MS = 2000;

export const queryPersister: Persister = {
  persistClient: async (client: PersistedClient) => {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      persistTimer = null;
      try {
        storage.set(StorageKeys.QUERY_CACHE, JSON.stringify(client));
      } catch {
        // Storage full or serialization error — not fatal.
      }
    }, PERSIST_DEBOUNCE_MS);
  },
  restoreClient: async () => {
    const raw = storage.getString(StorageKeys.QUERY_CACHE);
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as PersistedClient;
    } catch {
      storage.delete(StorageKeys.QUERY_CACHE);
      return undefined;
    }
  },
  removeClient: async () => {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    storage.delete(StorageKeys.QUERY_CACHE);
  },
};

// ── Hard reset on tenant switch ─────────────────────────────
export function resetQueriesForTenantSwitch(): void {
  queryClient.clear();
  void queryPersister.removeClient();
}
