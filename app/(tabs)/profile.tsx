// ══════════════════════════════════════════════════════════════
// Profile — account info, language, logout.
// Navy hero with avatar initial, clean card layout below.
// The active tenant is shown as an info chip in the hero but
// cannot be changed from here (see `/select-tenant` on sign-in).
// ══════════════════════════════════════════════════════════════
import { View, Text, ScrollView } from 'react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';

import {
  SegmentedControl,
  ConfirmModal,
  Button,
  Icon,
  AppHeader,
} from '@/components';
import { colors, radius, spacing, type } from '@/theme';
import { useAuth } from '@/services/auth/AuthProvider';
import { useTenantStore } from '@/stores/tenantStore';
import { setLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n';

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { user, tenants, logout } = useAuth();
  const activeTenantId = useTenantStore((s) => s.activeTenantId);
  const activeTenant = tenants.find((ten) => ten.id === activeTenantId);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const langOptions = SUPPORTED_LANGUAGES.map((code) => ({
    id: code,
    label: code.toUpperCase(),
  }));

  const displayName = user?.name ?? user?.email ?? '—';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary }} edges={['bottom']}>
      <AppHeader />

      {/* Navy hero with avatar */}
      <View
        style={{
          backgroundColor: colors.navy,
          paddingHorizontal: spacing.md,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xl,
          alignItems: 'center',
          gap: spacing.sm,
        }}
      >
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.brandAccent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 24, fontWeight: '700', color: colors.white }}>
            {initial}
          </Text>
        </View>
        <Text
          style={{
            fontSize: 18,
            fontWeight: '700',
            color: colors.white,
            letterSpacing: -0.3,
          }}
          numberOfLines={1}
        >
          {displayName}
        </Text>
        {user?.email && user?.name ? (
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
            {user.email}
          </Text>
        ) : null}
        {activeTenant ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginTop: 2,
              paddingHorizontal: 12,
              paddingVertical: 4,
              borderRadius: radius.full,
              backgroundColor: 'rgba(255,255,255,0.1)',
            }}
          >
            <Icon name="building" color="rgba(255,255,255,0.7)" size={12} />
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '600' }}>
              {activeTenant.name}
            </Text>
          </View>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: spacing.md,
          paddingBottom: spacing.xl + 80,
          gap: spacing.md,
        }}
      >
        {/* Language */}
        <View
          style={{
            backgroundColor: colors.white,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.gray[200],
            padding: spacing.md,
            gap: spacing.sm,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="sliders" color={colors.brand} size={14} />
            <Text style={type.sectionLabel}>{t('profile.language')}</Text>
          </View>
          <SegmentedControl
            value={i18n.language as SupportedLanguage}
            onChange={(lang) => setLanguage(lang as SupportedLanguage)}
            options={langOptions}
            ariaLabel={t('profile.language')}
          />
        </View>

        {/* Sign out */}
        <Button
          label={t('auth.sign_out')}
          icon="box-arrow-right"
          variant="danger"
          onPress={() => setConfirmOpen(true)}
          fullWidth
        />

        {/* Version as subtle caption */}
        <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.sm }]}>
          {t('profile.app_version')}: {Constants.expoConfig?.version ?? '—'}
        </Text>
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
