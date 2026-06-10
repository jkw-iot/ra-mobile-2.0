// ══════════════════════════════════════════════════════════════
// detailPrefsStore — tiny Zustand store for sensor-detail UI
// preferences that should survive navigation within a session.
//
// Currently: the last-used chart period (day/week/month/quarter).
// Always initialises to 'week' on cold start; within a running
// session the in-memory Zustand state keeps the user's choice
// across sensor-detail navigations.
// ══════════════════════════════════════════════════════════════
import { create } from 'zustand';

import { storage, StorageKeys } from '@/lib/storage';

export type DetailPeriod = 'day' | 'week' | 'month' | 'quarter';

interface DetailPrefsState {
  lastPeriod: DetailPeriod;
  setLastPeriod: (p: DetailPeriod) => void;
}

export const useDetailPrefsStore = create<DetailPrefsState>((set, get) => ({
  lastPeriod: 'week' as DetailPeriod,
  setLastPeriod: (p) => {
    if (get().lastPeriod === p) return;
    storage.set(StorageKeys.LAST_DETAIL_PERIOD, p);
    set({ lastPeriod: p });
  },
}));
