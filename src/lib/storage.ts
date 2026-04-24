// ══════════════════════════════════════════════════════════════
// Storage — synchronous key/value store
//
// Tries MMKV first (fast, native, requires dev build). Falls back
// to an AsyncStorage-backed cache when MMKV's native module is not
// available (Expo Go). The fallback exposes a synchronous-looking
// API by pre-loading all keys on startup.
//
// ALL session/tenant/user-preference keys use the `roomalyzer_`
// prefix to mirror the web app's sessionStorage conventions.
// ══════════════════════════════════════════════════════════════
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Storage {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): void;
  getAllKeys(): string[];
  clearAll(): void;
}

let impl: Storage | null = null;

function makeMmkv(): Storage | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-mmkv') as typeof import('react-native-mmkv');
    // react-native-mmkv v4 exposes createMMKV() (nitro-based); v3 used `new MMKV(...)`.
    type CreateMMKVFn = (cfg?: { id?: string }) => {
      getString: (k: string) => string | undefined;
      set: (k: string, v: string) => void;
      delete: (k: string) => void;
      getAllKeys: () => string[];
      clearAll: () => void;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createFn = (mod as any).createMMKV as CreateMMKVFn | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctor = (mod as any).MMKV as undefined | (new (cfg?: { id?: string }) => ReturnType<CreateMMKVFn>);
    const mmkv = createFn
      ? createFn({ id: 'roomalyzer' })
      : Ctor
      ? new Ctor({ id: 'roomalyzer' })
      : null;
    if (!mmkv) return null;
    return {
      getString: (k) => mmkv.getString(k),
      set: (k, v) => mmkv.set(k, v),
      delete: (k) => mmkv.delete(k),
      getAllKeys: () => mmkv.getAllKeys(),
      clearAll: () => mmkv.clearAll(),
    };
  } catch {
    return null;
  }
}

function makeAsyncStorageSync(): Storage {
  // Shadow map — AsyncStorage reads/writes happen asynchronously
  // but callers see the in-memory snapshot synchronously. This is
  // fine because (a) we hydrate on startup, (b) writes are
  // fire-and-forget, and (c) the only place this matters is MMKV
  // parity for TanStack Query's persister.
  const cache = new Map<string, string>();

  const hydrate = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const pairs = await AsyncStorage.multiGet(keys);
      for (const [k, v] of pairs) {
        if (v != null) cache.set(k, v);
      }
    } catch {
      // ignore — cache stays empty
    }
  };
  void hydrate();

  return {
    getString: (k) => cache.get(k),
    set: (k, v) => {
      cache.set(k, v);
      void AsyncStorage.setItem(k, v).catch(() => {});
    },
    delete: (k) => {
      cache.delete(k);
      void AsyncStorage.removeItem(k).catch(() => {});
    },
    getAllKeys: () => Array.from(cache.keys()),
    clearAll: () => {
      cache.clear();
      void AsyncStorage.clear().catch(() => {});
    },
  };
}

export const storage: Storage =
  (impl ??= makeMmkv() ?? makeAsyncStorageSync());

// ── Convenience: JSON helpers ──────────────────────────────
export function getJson<T>(key: string, fallback: T): T {
  const raw = storage.getString(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setJson<T>(key: string, value: T): void {
  storage.set(key, JSON.stringify(value));
}

// ── Key constants ───────────────────────────────────────────
// Use these constants everywhere — never inline strings.
export const StorageKeys = {
  ACTIVE_TENANT: 'roomalyzer_active_tenant',
  ACTIVE_MODULE: 'roomalyzer_active_module',
  LANGUAGE: 'roomalyzer_language',
  QUERY_CACHE: 'roomalyzer_query_cache',
  // Firebase refresh token lives in SecureStore, NOT here.
} as const;
