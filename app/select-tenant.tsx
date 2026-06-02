// ══════════════════════════════════════════════════════════════
// select-tenant — shown after login when a user has access to
// more than one tenant. Uses the same `TenantTileGrid` as the
// Profile tab so the post-login picker and the in-app switcher
// are visually identical.
// ══════════════════════════════════════════════════════════════
import { View, Text, ScrollView, StatusBar, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Logo, TenantTileGrid } from '@/components';
import { colors, spacing, type } from '@/theme';
import { useAuth } from '@/services/auth/AuthProvider';
import { useTenantStore } from '@/stores/tenantStore';
import { haptic } from '@/lib/haptics';

export default function SelectTenantScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tenants, user } = useAuth();
  const active = useTenantStore((s) => s.activeTenantId);
  const setActive = useTenantStore((s) => s.setActiveTenant);

  const greetingName = user?.name?.split(' ')[0] ?? user?.email ?? '';

  const pick = (id: number) => {
    haptic.medium();
    setActive(id);
    router.replace('/(tabs)');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      {Platform.OS === 'ios' ? <StatusBar barStyle="light-content" /> : null}

      {/* Compact navy hero with logo */}
      <View
        style={{
          backgroundColor: colors.navy,
          paddingTop: insets.top + spacing.sm,
          paddingBottom: spacing.lg,
          paddingHorizontal: spacing.md,
          alignItems: 'center',
        }}
      >
        <Logo width={140} variant="white" />
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: spacing.md,
          paddingBottom: spacing.xl + insets.bottom,
          gap: spacing.md,
        }}
      >
        {/* Section heading — dark on the light page background */}
        <View style={{ gap: 6, paddingHorizontal: 4, paddingTop: spacing.xs }}>
          <Text style={[type.sectionLabel, { color: colors.brandAccent }]}>
            {t('tenant.select_tenant').toUpperCase()}
          </Text>
          <Text
            style={{
              fontSize: 26,
              fontWeight: '800',
              color: colors.brandDark,
              letterSpacing: -0.5,
            }}
          >
            {greetingName
              ? t('tenant.select_tenant_greeting', { name: greetingName })
              : t('tenant.select_tenant')}
          </Text>
          <Text style={[type.body, { color: colors.gray[700] }]}>
            {t('tenant.select_tenant_subtitle')}
          </Text>
        </View>

        <View style={{ marginTop: spacing.sm }}>
          <TenantTileGrid
            tenants={tenants}
            activeTenantId={active}
            onSelect={pick}
          />
        </View>
      </ScrollView>
    </View>
  );
}
