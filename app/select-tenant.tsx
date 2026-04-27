// ══════════════════════════════════════════════════════════════
// select-tenant — shown after login when a user has access to
// more than one tenant. Big navy buttons per tenant, with a
// clear chevron and a highlighted "active" state.
// ══════════════════════════════════════════════════════════════
import { View, Text, ScrollView, Pressable, StatusBar, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Logo } from '@/components';
import { colors, radius, spacing, type } from '@/theme';
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
    router.replace('/(tabs)/sensors');
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

        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          {tenants.map((tenant) => {
            const isActive = tenant.id === active;
            const bg = isActive ? colors.brandAccent : colors.navy;
            return (
              <View
                key={tenant.id}
                style={{
                  borderRadius: radius.lg,
                  backgroundColor: bg,
                  shadowColor: '#0b1a2b',
                  shadowOpacity: 0.18,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 4,
                }}
              >
                <Pressable
                  onPress={() => pick(tenant.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={tenant.name}
                  style={({ pressed }) => ({
                    borderRadius: radius.lg,
                    opacity: pressed ? 0.9 : 1,
                    transform: [{ scale: pressed ? 0.99 : 1 }],
                  })}
                >
                  <View
                    style={{
                      minHeight: 140,
                      paddingVertical: spacing.xl,
                      paddingHorizontal: spacing.lg,
                      borderRadius: radius.lg,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 20,
                        fontWeight: '700',
                        color: colors.white,
                        letterSpacing: -0.2,
                        textAlign: 'center',
                      }}
                      numberOfLines={2}
                    >
                      {tenant.name}
                    </Text>
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
