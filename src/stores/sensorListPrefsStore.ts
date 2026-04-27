// ══════════════════════════════════════════════════════════════
// sensorListPrefsStore — persisted sensor-list UI preferences.
//
// Currently: last selected location per tenant, so returning to the
// sensor list opens the same concrete location instead of a global list.
// ══════════════════════════════════════════════════════════════
import { create } from 'zustand';

import { getJson, setJson, storage, StorageKeys } from '@/lib/storage';

type TenantLocationMap = Record<string, string>;

interface SensorListPrefsState {
  selectedLocationByTenant: TenantLocationMap;
  setSelectedLocation: (tenantId: number, locationId: string) => void;
  clearSelectedLocation: (tenantId: number) => void;
}

function readInitial(): TenantLocationMap {
  return getJson<TenantLocationMap>(StorageKeys.LAST_SENSOR_LIST_LOCATIONS, {});
}

function persist(next: TenantLocationMap): void {
  if (Object.keys(next).length === 0) {
    storage.delete(StorageKeys.LAST_SENSOR_LIST_LOCATIONS);
    return;
  }
  setJson(StorageKeys.LAST_SENSOR_LIST_LOCATIONS, next);
}

export const useSensorListPrefsStore = create<SensorListPrefsState>((set, get) => ({
  selectedLocationByTenant: readInitial(),

  setSelectedLocation: (tenantId, locationId) => {
    const tenantKey = String(tenantId);
    if (get().selectedLocationByTenant[tenantKey] === locationId) return;
    const next = {
      ...get().selectedLocationByTenant,
      [tenantKey]: locationId,
    };
    persist(next);
    set({ selectedLocationByTenant: next });
  },

  clearSelectedLocation: (tenantId) => {
    const tenantKey = String(tenantId);
    if (!(tenantKey in get().selectedLocationByTenant)) return;
    const next = { ...get().selectedLocationByTenant };
    delete next[tenantKey];
    persist(next);
    set({ selectedLocationByTenant: next });
  },
}));
