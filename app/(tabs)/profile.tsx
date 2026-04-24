// ══════════════════════════════════════════════════════════════
// Profile — account info, language, tenant switch, logout.
// ══════════════════════════════════════════════════════════════
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';

import {
  PageHeading,
  SectionCard,
  SegmentedControl,
  ConfirmModal,
  Button,
  Icon,
  StatusDot,
  AppHeader,
} from '@/components';
import { colors, radius, spacing, type } from '@/theme';
import { useAuth } from '@/services/auth/AuthProvider';
import { useTenantStore } from '@/stores/tenantStore';
import { setLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n';

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user, tenants, logout } = useAuth();
  const activeTenantId = useTenantStore((s) => s.activeTenantId);
  const activeTenant = tenants.find((ten) => ten.id === activeTenantId);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const langOptions = SUPPORTED_LANGUAGES.map((code) => ({
    id: code,
    label: code.toUpperCase(),
  }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary }} edges={['top']}>
      <AppHeader />
      <PageHeading
        icon="person"
        title={t('profile.title')}
        subtitle={t('profile.subtitle')}
      />
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
        {/* Tinted "account" card so the page has more colour than white-on-white */}
        <View
          style={{
            backgroundColor: colors.modalHeader,
            borderRadius: radius.lg,
            padding: spacing.md,
            gap: 4,
            borderWidth: 1,
            borderColor: colors.gray[200],
          }}
        >
          <Text style={type.sectionLabel}>{t('profile.account')}</Text>
          <Text style={[type.bodyStrong, { color: colors.brandDark }]}>
            {user?.name ?? user?.email ?? '—'}
          </Text>
          {user?.email && user?.name ? (
            <Text style={type.caption}>{user.email}</Text>
          ) : null}
        </View>

        {tenants.length > 0 ? (
          <SectionCard title={t('tenant.active')} icon="building" padding={0}>
            <Pressable
              onPress={() => router.push('/select-tenant')}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                padding: spacing.md,
                backgroundColor: pressed ? colors.gray[50] : 'transparent',
              })}
              accessibilityRole="button"
              accessibilityLabel={t('tenant.switch')}
            >
              <StatusDot tone="good" />
              <Text style={[type.body, { flex: 1, color: colors.brandDark }]}>
                {activeTenant?.name ?? '—'}
              </Text>
              {tenants.length > 1 ? (
                <Icon name="chevron-right" color={colors.gray[400]} size={18} />
              ) : null}
            </Pressable>
          </SectionCard>
        ) : null}

        <SectionCard title={t('profile.language')} icon="sliders">
          <SegmentedControl
            value={i18n.language as SupportedLanguage}
            onChange={(lang) => setLanguage(lang as SupportedLanguage)}
            options={langOptions}
            ariaLabel={t('profile.language')}
          />
        </SectionCard>

        <SectionCard title={t('profile.app_version')} icon="info-circle">
          <Text style={type.body}>{Constants.expoConfig?.version ?? '—'}</Text>
        </SectionCard>

        <View
          style={{
            backgroundColor: colors.white,
            borderRadius: radius.lg,
            padding: spacing.md,
            borderWidth: 1,
            borderColor: colors.gray[200],
          }}
        >
          <Button
            label={t('auth.sign_out')}
            icon="box-arrow-right"
            variant="danger"
            onPress={() => setConfirmOpen(true)}
            fullWidth
          />
        </View>
      </ScrollView>

      <ConfirmModal
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={async () => {
          setConfirmOpen(false);
          await logout();
        }}
        tone="warn"
        title={t('auth.sign_out')}
        confirmLabel={t('auth.sign_out')}
        cancelLabel={t('common.cancel')}
        confirmIcon="box-arrow-right"
      />
    </SafeAreaView>
  );
}
