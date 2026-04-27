// ══════════════════════════════════════════════════════════════
// moduleStore — active module (for the module picker)
//
// MVP ships with Indeklima only; other modules are shown as
// "coming soon" in the UI. When new modules ship, add them to
// the MODULES array below.
// ══════════════════════════════════════════════════════════════
import { create } from 'zustand';

import { storage, StorageKeys } from '@/lib/storage';

export type ModuleSlug =
  | 'indeklima'
  | 'preservation'
  | 'water'
  | 'space'
  | 'pushbuttons'
  | 'doors'
  | 'usage';

export interface ModuleDef {
  slug: ModuleSlug;
  i18nKey: string; // e.g. "layout.modules.indeklima"
  icon: string;    // web-style Bootstrap Icons name; mapped by <Icon>
  available: boolean;
}

export const MODULES: readonly ModuleDef[] = [
  { slug: 'indeklima',    i18nKey: 'layout.modules.indeklima',    icon: 'thermometer-half', available: true  },
  { slug: 'preservation', i18nKey: 'layout.modules.preservation', icon: 'building',         available: false },
  { slug: 'water',        i18nKey: 'layout.modules.water',        icon: 'droplet',          available: false },
  { slug: 'space',        i18nKey: 'layout.modules.space',        icon: 'people',           available: false },
  { slug: 'pushbuttons',  i18nKey: 'layout.modules.pushbuttons',  icon: 'bell',             available: false },
  { slug: 'doors',        i18nKey: 'layout.modules.doors',        icon: 'door-open',        available: false },
  { slug: 'usage',        i18nKey: 'layout.modules.usage',        icon: 'graph-up',         available: false },
];

interface ModuleState {
  activeModule: ModuleSlug;
  setActiveModule: (slug: ModuleSlug) => void;
}

function readInitial(): ModuleSlug {
  const raw = storage.getString(StorageKeys.ACTIVE_MODULE)?.trim();
  const isValid =
    Boolean(raw) &&
    MODULES.some((m) => m.slug === raw && m.available);
  return isValid ? (raw as ModuleSlug) : 'indeklima';
}

export const useModuleStore = create<ModuleState>((set) => ({
  activeModule: readInitial(),

  setActiveModule: (slug) => {
    const mod = MODULES.find((m) => m.slug === slug);
    if (!mod?.available) return;
    storage.set(StorageKeys.ACTIVE_MODULE, slug);
    set({ activeModule: slug });
  },
}));
