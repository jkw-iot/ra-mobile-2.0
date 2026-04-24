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
        tabBarActiveTintColor: colors.brandAccent,
        tabBarInactiveTintColor: colors.gray[500],
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.gray[200],
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('layout.tabs.home'),
          tabBarIcon: ({ color }) => <Icon name="house" color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="sensors"
        options={{
          title: t('layout.tabs.sensors'),
          tabBarIcon: ({ color }) => (
            <Icon name="thermometer-half" color={color} size={22} />
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: t('layout.tabs.alerts'),
          tabBarIcon: ({ color }) => <Icon name="bell" color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('layout.tabs.profile'),
          tabBarIcon: ({ color }) => <Icon name="person" color={color} size={22} />,
        }}
      />
    </Tabs>
  );
}
