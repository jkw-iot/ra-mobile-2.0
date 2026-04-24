// ══════════════════════════════════════════════════════════════
// Home — dashboard / landing after login.
//
// MVP: Indeklima is the only available module, so we show a
// friendly welcome + quick link to the sensor list rather than
// the old "choose a module" grid. Settings/logout moved to the
// burger drawer.
// ══════════════════════════════════════════════════════════════
import { View, Text, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { AppHeader, Button, SectionCard, Icon } from '@/components';
import { colors, radius, spacing, type } from '@/theme';
import { useAuth } from '@/services/auth/AuthProvider';
import { useTenantStore } from '@/stores/tenantStore';

export default function HomeScreen() {
  const { t } = useTranslation();
  const { tenants, user } = useAuth();
  const router = useRouter();
  const activeTenantId = useTenantStore((s) => s.activeTenantId);
  const activeTenant = tenants.find((ten) => ten.id === activeTenantId);

  const greetingName = user?.name?.split(' ')[0] ?? user?.email ?? '';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary }} edges={['top']}>
      <AppHeader />
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
        {/* Tenant / greeting card — tinted so the page doesn't feel blank */}
        <View
          style={{
            backgroundColor: colors.modalHeader,
            borderRadius: radius.lg,
            padding: spacing.lg,
            gap: 4,
            borderWidth: 1,
            borderColor: colors.gray[200],
          }}
        >
          <Text style={type.sectionLabel}>{t('tenant.active')}</Text>
          <Text style={[type.pageTitle, { fontSize: 20 }]}>
            {activeTenant?.name ?? '—'}
          </Text>
          {greetingName ? (
            <Text style={type.caption}>
              {t('home.greeting', { name: greetingName })}
            </Text>
          ) : null}
        </View>

        {/* Indeklima quick action */}
        <SectionCard title={t('indeklima.title')} icon="thermometer-half">
          <View style={{ gap: spacing.md }}>
            <Text style={type.body}>{t('indeklima.subtitle')}</Text>
            <Button
              label={t('indeklima.sensors.title')}
              icon="list"
              onPress={() => router.push('/(tabs)/sensors')}
              fullWidth
            />
          </View>
        </SectionCard>

        {/* Alerts teaser */}
        <SectionCard title={t('indeklima.alerts.title')} icon="bell">
          <View style={{ gap: spacing.md }}>
            <Text style={type.body}>{t('indeklima.alerts.subtitle')}</Text>
            <Button
              label={t('indeklima.alerts.title')}
              icon="bell"
              variant="secondary"
              onPress={() => router.push('/(tabs)/alerts')}
              fullWidth
            />
          </View>
        </SectionCard>

        {/* Coming-soon footer chip */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            padding: spacing.md,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.gray[200],
            backgroundColor: colors.white,
          }}
        >
          <Icon name="info-circle" color={colors.brandAccent} size={18} />
          <Text style={[type.caption, { flex: 1 }]}>
            {t('home.modules_coming_soon')}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
