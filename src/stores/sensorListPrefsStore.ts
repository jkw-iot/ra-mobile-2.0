// ══════════════════════════════════════════════════════════════
// sensorListPrefsStore — persisted UI preferences for the
// per-module list / map filter selections.
//
// Why split per module?
//   The same tenant has separate location semantics in different
//   modules: an indeklima-only sensor lives at "Sommerhus → Test"
//   while a water sensor for the same tenant might only ever sit
//   at the building level. Sharing one selected-location value
//   across modules would constantly land users on an unfriendly
//   "no sensors in this location" state when they swap module.
//
//   So we keep two parallel `${tenantId}: locationId` maps —
//   one for indeklima (sensors + map share a selection) and one
//   for water (map). Each persists to its own key so a feature
//   can be reset without affecting the other.
// ══════════════════════════════════════════════════════════════
import { create } from 'zustand';

import { getJson, setJson, storage, StorageKeys } from '@/lib/storage';

type TenantLocationMap = Record<string, string>;

interface SensorListPrefsState {
  selectedLocationByTenant: TenantLocationMap;
  setSelectedLocation: (tenantId: number, locationId: string) => void;
  clearSelectedLocation: (tenantId: number) => void;

  selectedWaterLocationByTenant: TenantLocationMap;
  setSelectedWaterLocation: (tenantId: number, locationId: string) => void;
  clearSelectedWaterLocation: (tenantId: number) => void;
}

function readInitial(key: string): TenantLocationMap {
  return getJson<TenantLocationMap>(key, {});
}

function persist(key: string, next: TenantLocationMap): void {
  if (Object.keys(next).length === 0) {
    storage.delete(key);
    return;
  }
  setJson(key, next);
}

export const useSensorListPrefsStore = create<SensorListPrefsState>((set, get) => ({
  selectedLocationByTenant: readInitial(StorageKeys.LAST_SENSOR_LIST_LOCATIONS),

  setSelectedLocation: (tenantId, locationId) => {
    const tenantKey = String(tenantId);
    if (get().selectedLocationByTenant[tenantKey] === locationId) return;
    const next = {
      ...get().selectedLocationByTenant,
      [tenantKey]: locationId,
    };
    persist(StorageKeys.LAST_SENSOR_LIST_LOCATIONS, next);
    set({ selectedLocationByTenant: next });
  },

  clearSelectedLocation: (tenantId) => {
    const tenantKey = String(tenantId);
    if (!(tenantKey in get().selectedLocationByTenant)) return;
    const next = { ...get().selectedLocationByTenant };
    delete next[tenantKey];
    persist(StorageKeys.LAST_SENSOR_LIST_LOCATIONS, next);
    set({ selectedLocationByTenant: next });
  },

  selectedWaterLocationByTenant: readInitial(StorageKeys.LAST_WATER_MAP_LOCATIONS),

  setSelectedWaterLocation: (tenantId, locationId) => {
    const tenantKey = String(tenantId);
    if (get().selectedWaterLocationByTenant[tenantKey] === locationId) return;
    const next = {
      ...get().selectedWaterLocationByTenant,
      [tenantKey]: locationId,
    };
    persist(StorageKeys.LAST_WATER_MAP_LOCATIONS, next);
    set({ selectedWaterLocationByTenant: next });
  },

  clearSelectedWaterLocation: (tenantId) => {
    const tenantKey = String(tenantId);
    if (!(tenantKey in get().selectedWaterLocationByTenant)) return;
    const next = { ...get().selectedWaterLocationByTenant };
    delete next[tenantKey];
    persist(StorageKeys.LAST_WATER_MAP_LOCATIONS, next);
    set({ selectedWaterLocationByTenant: next });
  },
}));
