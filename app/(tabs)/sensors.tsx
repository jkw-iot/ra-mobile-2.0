// ══════════════════════════════════════════════════════════════
// Module-aware "primary" tab route.
//
// Each module slug picks its own home screen for this slot in the
// tab bar. The label/icon for the tab itself is owned by
// `app/(tabs)/_layout.tsx` (see `useModuleStore`); this file only
// dispatches to the right feature screen.
//
// Indeklima  → sensor list (SensorsScreen)
// Water      → dashboard (DashboardScreen)
// Anything else falls back to the indeklima list — defensive, in
// case a stale persisted module slug survives an upgrade.
// ══════════════════════════════════════════════════════════════
import IndeklimaSensorsScreen from '@/features/indeklima/SensorsScreen';
import WaterDashboardScreen from '@/features/waterdetection/DashboardScreen';
import { useModuleStore } from '@/stores/moduleStore';

export default function PrimaryTabRoute() {
  const activeModule = useModuleStore((s) => s.activeModule);

  if (activeModule === 'water') return <WaterDashboardScreen />;
  return <IndeklimaSensorsScreen />;
}
