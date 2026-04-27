import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components';
import { colors } from '@/theme';

export default function TabsLayout() {
  const { t } = useTranslation();
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
          title: t('layout.tabs.home'),
          tabBarIcon: ({ color }) => <Icon name="house" color={color} size={26} />,
        }}
      />
      <Tabs.Screen
        name="sensors"
        options={{
          title: t('layout.tabs.sensors'),
          tabBarIcon: ({ color }) => (
            <Icon name="thermometer-half" color={color} size={26} />
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          href: null,
          title: t('layout.tabs.alerts'),
          tabBarIcon: ({ color }) => <Icon name="bell" color={color} size={26} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('layout.tabs.profile'),
          tabBarIcon: ({ color }) => <Icon name="person" color={color} size={26} />,
        }}
      />
    </Tabs>
  );
}
