import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';

import { Icon } from '@/components';
import { colors } from '@/theme';
import { haptic } from '@/lib/haptics';
import { cacheTiers } from '@/lib/queryClient';
import { useModuleStore } from '@/stores/moduleStore';
import { useTenantStore } from '@/stores/tenantStore';
import { sensorTypesApi, indeklimaApi, preservationApi } from '@/services/api';
import { useTilePreseed } from '@/hooks/useTilePreseed';

function usePrefetchIndeklima() {
  const queryClient = useQueryClient();
  const tenantId = useTenantStore((s) => s.activeTenantId);

  useEffect(() => {
    if (!tenantId) return;
    queryClient.prefetchQuery({
      queryKey: ['indeklima', 'sensors', { tenantId }],
      queryFn: () => indeklimaApi.getSensors(),
      staleTime: cacheTiers.snapshot.staleTime,
    });
    queryClient.prefetchQuery({
      queryKey: ['sensor-types', { tenantId }],
      queryFn: () => sensorTypesApi.getAll(),
      staleTime: cacheTiers.downsampled.staleTime,
    });
    queryClient.prefetchQuery({
      queryKey: ['indeklima', 'locations', { tenantId }],
      queryFn: () => indeklimaApi.getLocations(),
      staleTime: cacheTiers.snapshot.staleTime,
    });
    queryClient.prefetchQuery({
      queryKey: ['preservation', 'mold', 'zones', { tenantId }],
      queryFn: () => preservationApi.getMoldZones(),
      staleTime: 5 * 60 * 1000,
    });
  }, [queryClient, tenantId]);
}

// Fired on every tab icon press. Matches the in-screen
// pressables (cards, pickers, buttons) which all play
// `haptic.light()` on touch — the bottom bar should feel
// equally responsive rather than the only silent control on
// the screen. We intentionally trigger on every press, not
// just navigation: a re-tap on the active tab still confirms
// the input.
const onTabPress = () => {
  haptic.light();
};

// The "primary" tab (route name `index`, the default tab)
// changes label and icon depending on the active module:
//
//   indeklima → "Sensorer"  + thermometer
//   water     → "Dashboard" + dashboard glyph
//
// Keeping a single route means deep-links don't change when the
// user swaps modules, while still letting each module own the
// content that lives on its primary screen (the route file is a
// thin dispatcher — see app/(tabs)/index.tsx).
function usePrimaryTabLabel() {
  const { t } = useTranslation();
  const activeModule = useModuleStore((s) => s.activeModule);
  if (activeModule === 'water') {
    return {
      label: t('layout.tabs.dashboard'),
      icon: 'layout-text-window',
    } as const;
  }
  return {
    label: t('layout.tabs.sensors'),
    icon: 'thermometer-half',
  } as const;
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const primary = usePrimaryTabLabel();
  useTilePreseed();
  usePrefetchIndeklima();

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.white,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.55)',
        tabBarStyle: {
          backgroundColor: colors.navy,
          borderTopColor: 'rgba(255,255,255,0.08)',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 6,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: primary.label,
          tabBarIcon: ({ color }) => (
            <Icon name={primary.icon} color={color} size={26} />
          ),
        }}
        listeners={{ tabPress: onTabPress }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: t('layout.tabs.map'),
          tabBarIcon: ({ color }) => <Icon name="map" color={color} size={26} />,
        }}
        listeners={{ tabPress: onTabPress }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          href: null,
          title: t('layout.tabs.alerts'),
          tabBarIcon: ({ color }) => <Icon name="bell" color={color} size={26} />,
        }}
        listeners={{ tabPress: onTabPress }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('layout.tabs.profile'),
          tabBarIcon: ({ color }) => <Icon name="person" color={color} size={26} />,
        }}
        listeners={{ tabPress: onTabPress }}
      />
    </Tabs>
  );
}
