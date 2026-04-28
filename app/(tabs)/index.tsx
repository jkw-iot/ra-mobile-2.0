// ══════════════════════════════════════════════════════════════
// Module-aware "Kort" (Map) tab.
//
// Indeklima  → live sensor map (IndeklimaMapScreen)
// Water      → water-detection map (WaterMapScreen)
//
// Kept as a thin dispatcher so deep-links to "/" don't change
// when the user swaps modules. Each module owns its own screen
// — we don't try to share a generic shell.
// ══════════════════════════════════════════════════════════════
import IndeklimaMapScreen from '@/features/indeklima/MapScreen';
import WaterMapScreen from '@/features/waterdetection/MapScreen';
import { useModuleStore } from '@/stores/moduleStore';

export default function MapTabRoute() {
  const activeModule = useModuleStore((s) => s.activeModule);

  if (activeModule === 'water') return <WaterMapScreen />;
  return <IndeklimaMapScreen />;
}
