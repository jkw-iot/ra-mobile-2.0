// ══════════════════════════════════════════════════════════════
// Module-aware "Kort" (Map) tab.
//
// Indeklima  → live sensor map (MapScreen)
// Water      → "Kommer snart" placeholder until the water map
//              ships. Same chrome (header + page heading) so the
//              tab feels intentionally part of the module rather
//              than a half-built blank screen.
// ══════════════════════════════════════════════════════════════
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AppHeader, ErrorState, PageHeading } from '@/components';
import { colors } from '@/theme';
import IndeklimaMapScreen from '@/features/indeklima/MapScreen';
import { useModuleStore } from '@/stores/moduleStore';

function ComingSoonMap() {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary }} edges={['bottom']}>
      <AppHeader />
      <PageHeading
        icon="map"
        title={t('layout.tabs.map')}
        subtitle={t('water.map.subtitle')}
      />
      <ErrorState
        tone="empty"
        icon="map"
        title={t('common.coming_soon')}
        message={t('water.map.coming_soon_body')}
      />
    </SafeAreaView>
  );
}

export default function MapTabRoute() {
  const activeModule = useModuleStore((s) => s.activeModule);

  if (activeModule === 'water') return <ComingSoonMap />;
  return <IndeklimaMapScreen />;
}
