import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components';
import { colors } from '@/theme';
import { haptic } from '@/lib/haptics';
import { useModuleStore } from '@/stores/moduleStore';

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

// The "primary" tab (route name `sensors` for legacy reasons)
// changes label and icon depending on the active module:
//
//   indeklima → "Sensorer"  + thermometer
//   water     → "Dashboard" + dashboard glyph
//
// Keeping a single route means deep-links don't change when the
// user swaps modules, while still letting each module own the
// content that lives on its primary screen (the route file is a
// thin dispatcher — see app/(tabs)/sensors.tsx).
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

  return (
    <Tabs
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
          title: t('layout.tabs.map'),
          tabBarIcon: ({ color }) => <Icon name="map" color={color} size={26} />,
        }}
        listeners={{ tabPress: onTabPress }}
      />
      <Tabs.Screen
        name="sensors"
        options={{
          title: primary.label,
          tabBarIcon: ({ color }) => (
            <Icon name={primary.icon} color={color} size={26} />
          ),
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
