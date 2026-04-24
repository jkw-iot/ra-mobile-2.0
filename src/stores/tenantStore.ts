// ══════════════════════════════════════════════════════════════
// tenantStore — active tenant selection
//
// The active tenant drives the X-Tenant-Id header on every API
// call (see src/services/api/client.ts). Switching tenant MUST
// clear the TanStack Query cache to prevent data leakage across
// tenants.
// ══════════════════════════════════════════════════════════════
import { create } from 'zustand';

import { storage, StorageKeys } from '@/lib/storage';
import { resetQueriesForTenantSwitch } from '@/lib/queryClient';

interface TenantState {
  activeTenantId: number | null;
  setActiveTenant: (id: number | null) => void;
  clear: () => void;
}

function readInitial(): number | null {
  const raw = storage.getString(StorageKeys.ACTIVE_TENANT);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export const useTenantStore = create<TenantState>((set, get) => ({
  activeTenantId: readInitial(),

  setActiveTenant: (id) => {
    if (id === get().activeTenantId) return;
    if (id === null) {
      storage.delete(StorageKeys.ACTIVE_TENANT);
    } else {
      storage.set(StorageKeys.ACTIVE_TENANT, String(id));
    }
    set({ activeTenantId: id });
    // Tenant changed → clear all cached per-tenant data.
    resetQueriesForTenantSwitch();
  },

  clear: () => {
    storage.delete(StorageKeys.ACTIVE_TENANT);
    set({ activeTenantId: null });
    resetQueriesForTenantSwitch();
  },
}));
