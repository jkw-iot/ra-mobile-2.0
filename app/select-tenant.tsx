// ══════════════════════════════════════════════════════════════
// select-tenant — shown once after login when a user has access
// to more than one tenant. Saves the choice to MMKV/AsyncStorage.
// ══════════════════════════════════════════════════════════════
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PageHeading, SectionCard, Icon, StatusDot } from '@/components';
import { colors, spacing, type } from '@/theme';
import { useAuth } from '@/services/auth/AuthProvider';
import { useTenantStore } from '@/stores/tenantStore';

export default function SelectTenantScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { tenants } = useAuth();
  const active = useTenantStore((s) => s.activeTenantId);
  const setActive = useTenantStore((s) => s.setActiveTenant);

  const pick = (id: number) => {
    setActive(id);
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary }} edges={['top']}>
      <PageHeading
        icon="people"
        title={t('tenant.select_tenant')}
        subtitle={t('tenant.select_tenant_subtitle')}
      />
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
        <SectionCard title={t('tenant.select_tenant')} icon="building" padding={0}>
          {tenants.map((tenant, idx) => {
            const isActive = tenant.id === active;
            return (
              <Pressable
                key={tenant.id}
                onPress={() => pick(tenant.id)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.md,
                  borderTopWidth: idx === 0 ? 0 : 1,
                  borderTopColor: colors.gray[100],
                  backgroundColor: pressed ? colors.gray[50] : 'transparent',
                })}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
              >
                <Icon name="building" color={colors.brandAccent} size={18} />
                <Text style={[type.body, { flex: 1, color: colors.brandDark }]}>
                  {tenant.name}
                </Text>
                {isActive ? (
                  <View
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                  >
                    <StatusDot tone="good" />
                    <Text style={type.caption}>{t('tenant.active')}</Text>
                  </View>
                ) : (
                  <Icon name="chevron-right" color={colors.gray[400]} size={18} />
                )}
              </Pressable>
            );
          })}
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}
