// ══════════════════════════════════════════════════════════════
// detailPrefsStore — tiny Zustand store for sensor-detail UI
// preferences that should survive navigation.
//
// Currently: the last-used chart period (day/week/month/year).
// Persisted via the shared storage wrapper so it also survives
// app restarts.
// ══════════════════════════════════════════════════════════════
import { create } from 'zustand';

import { storage, StorageKeys } from '@/lib/storage';

export type DetailPeriod = 'day' | 'week' | 'month' | 'year';

const VALID: readonly DetailPeriod[] = ['day', 'week', 'month', 'year'] as const;

function readInitial(): DetailPeriod {
  const raw = storage.getString(StorageKeys.LAST_DETAIL_PERIOD);
  if (raw && (VALID as readonly string[]).includes(raw)) {
    return raw as DetailPeriod;
  }
  return 'week';
}

interface DetailPrefsState {
  lastPeriod: DetailPeriod;
  setLastPeriod: (p: DetailPeriod) => void;
}

export const useDetailPrefsStore = create<DetailPrefsState>((set, get) => ({
  lastPeriod: readInitial(),
  setLastPeriod: (p) => {
    if (get().lastPeriod === p) return;
    storage.set(StorageKeys.LAST_DETAIL_PERIOD, p);
    set({ lastPeriod: p });
  },
}));
