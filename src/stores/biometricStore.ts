// ══════════════════════════════════════════════════════════════
// biometricStore — biometric login preferences
//
// Persisted in MMKV (non-secret prefs only: enabled flag, timeout,
// last-verified timestamp). Actual credentials live in SecureStore.
// ══════════════════════════════════════════════════════════════
import { create } from 'zustand';

import { storage, getJson, setJson } from '@/lib/storage';

const KEY = 'roomalyzer_biometric';

interface BiometricPrefs {
  enabled: boolean;
  lockTimeoutMinutes: number;
  lastVerifiedAt: number | null;
}

const DEFAULTS: BiometricPrefs = {
  enabled: false,
  lockTimeoutMinutes: 1,
  lastVerifiedAt: null,
};

interface BiometricState extends BiometricPrefs {
  setEnabled: (v: boolean) => void;
  setLockTimeout: (minutes: number) => void;
  markVerified: () => void;
  reset: () => void;
}

function readInitial(): BiometricPrefs {
  return getJson<BiometricPrefs>(KEY, DEFAULTS);
}

function persist(partial: Partial<BiometricPrefs>, get: () => BiometricState) {
  const { enabled, lockTimeoutMinutes, lastVerifiedAt } = get();
  setJson(KEY, { enabled, lockTimeoutMinutes, lastVerifiedAt, ...partial });
}

export const useBiometricStore = create<BiometricState>((set, get) => ({
  ...readInitial(),

  setEnabled: (enabled) => {
    set({ enabled });
    persist({ enabled }, get);
  },

  setLockTimeout: (lockTimeoutMinutes) => {
    set({ lockTimeoutMinutes });
    persist({ lockTimeoutMinutes }, get);
  },

  markVerified: () => {
    const lastVerifiedAt = Date.now();
    set({ lastVerifiedAt });
    persist({ lastVerifiedAt }, get);
  },

  reset: () => {
    set(DEFAULTS);
    storage.delete(KEY);
  },
}));
