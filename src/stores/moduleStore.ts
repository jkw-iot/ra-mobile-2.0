// ══════════════════════════════════════════════════════════════
// moduleStore — active module (for the module picker)
//
// MVP ships with Indeklima only; other modules are shown as
// "coming soon" in the UI. When new modules ship, add them to
// the MODULES array below.
// ══════════════════════════════════════════════════════════════
import { create } from 'zustand';
import type { Href } from 'expo-router';

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
  /**
   * Primary screen for this module. Used as the landing route
   * when the user switches to this module from the burger
   * drawer, AND when picking a tenant from the Profile tab —
   * the user expects to be dropped into the module's main view
   * rather than left staring at the Profile / picker screen
   * they triggered the switch from.
   *
   * Modules that haven't shipped yet still declare a route so
   * the type stays uniform; the Indeklima sensor list is used
   * as a safe fallback for unbuilt modules until each one gets
   * its own home.
   */
  primaryRoute: Href;
}

export const MODULES: readonly ModuleDef[] = [
  { slug: 'indeklima',    i18nKey: 'layout.modules.indeklima',    icon: 'thermometer-half', available: true,  primaryRoute: '/(tabs)' },
  { slug: 'preservation', i18nKey: 'layout.modules.preservation', icon: 'building',         available: false, primaryRoute: '/(tabs)' },
  { slug: 'water',        i18nKey: 'layout.modules.water',        icon: 'droplet',          available: true,  primaryRoute: '/(tabs)' },
  { slug: 'space',        i18nKey: 'layout.modules.space',        icon: 'people',           available: false, primaryRoute: '/(tabs)' },
  { slug: 'pushbuttons',  i18nKey: 'layout.modules.pushbuttons',  icon: 'bell',             available: false, primaryRoute: '/(tabs)' },
  { slug: 'doors',        i18nKey: 'layout.modules.doors',        icon: 'door-open',        available: false, primaryRoute: '/(tabs)' },
  { slug: 'usage',        i18nKey: 'layout.modules.usage',        icon: 'graph-up',         available: false, primaryRoute: '/(tabs)' },
];

/**
 * Resolve the primary route for a given module slug. Falls back
 * to Indeklima's sensor list — the only fully-shipped module —
 * if the slug doesn't match any registered module (defensive for
 * stale persisted state).
 */
export function getModulePrimaryRoute(slug: ModuleSlug): Href {
  return (
    MODULES.find((m) => m.slug === slug)?.primaryRoute ?? '/(tabs)'
  );
}

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
