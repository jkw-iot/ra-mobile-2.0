// ══════════════════════════════════════════════════════════════
// AppDrawer — slide-in side sheet triggered by AppHeader's burger.
//
// Primary job: pick the active tenant. Module switching lives on Home.
// Secondary: language picker and sign-out button so users always have
// a visible way to log out without drilling into the Profile tab.
// ══════════════════════════════════════════════════════════════
import { useState } from 'react';
import { Modal, Pressable, View, Text, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing, type } from '@/theme';
import { useAuth, type Tenant } from '@/services/auth/AuthProvider';
import { useTenantStore } from '@/stores/tenantStore';
import { setLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n';
import { Icon } from './Icon';
import { SegmentedControl } from './SegmentedControl';
import { Button } from './Button';
import { ConfirmModal } from './ConfirmModal';
import { Logo } from './Logo';
import { haptic } from '@/lib/haptics';

export interface AppDrawerProps {
  open: boolean;
  onClose: () => void;
}

function TenantRow({
  tenant,
  isActive,
  onPress,
}: {
  tenant: Tenant;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={tenant.name}
      style={({ pressed }) => ({
        minHeight: 72,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radius.lg,
        backgroundColor: isActive
          ? 'rgba(52,152,219,0.12)'
          : pressed
            ? colors.gray[50]
            : colors.white,
        borderWidth: 1,
        borderColor: isActive ? 'rgba(52,152,219,0.35)' : colors.gray[200],
      })}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isActive ? 'rgba(52,152,219,0.16)' : colors.gray[100],
        }}
      >
        <Icon name="building" color={isActive ? colors.brandAccent : colors.brand} size={20} />
      </View>
      <Text
        style={[type.bodyStrong, {
          flex: 1,
          fontSize: 17,
          color: isActive ? colors.brandAccent : colors.brandDark,
        }]}
        numberOfLines={2}
      >
        {tenant.name}
      </Text>
    </Pressable>
  );
}

export function AppDrawer({ open, onClose }: AppDrawerProps) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { tenants, user, logout } = useAuth();
  const activeTenantId = useTenantStore((s) => s.activeTenantId);
  const setActiveTenant = useTenantStore((s) => s.setActiveTenant);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const langOptions = SUPPORTED_LANGUAGES.map((code) => ({
    id: code,
    label: code.toUpperCase(),
  }));

  const pickTenant = (tenantId: number) => {
    haptic.medium();
    setActiveTenant(tenantId);
    onClose();
    router.push('/(tabs)/sensors');
  };

  const doLogout = async () => {
    haptic.error();
    setConfirmSignOut(false);
    onClose();
    await logout();
  };

  return (
    <>
      <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }}
          onPress={onClose}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              right: 0,
              width: '86%',
              maxWidth: 380,
              backgroundColor: colors.bgPrimary,
              borderLeftWidth: 1,
              borderLeftColor: colors.gray[200],
            }}
          >
            <SafeAreaView style={{ flex: 1 }} edges={['top', 'right', 'bottom']}>
              {/* Header row — dark chrome matches AppHeader */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  backgroundColor: colors.navy,
                }}
              >
                <Logo width={120} variant="white" />
                <Pressable
                  onPress={onClose}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.close')}
                  style={({ pressed }) => ({
                    width: 36,
                    height: 36,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 999,
                    backgroundColor: pressed ? 'rgba(255,255,255,0.15)' : 'transparent',
                  })}
                >
                  <Icon name="x" color={colors.white} size={22} />
                </Pressable>
              </View>

              <ScrollView
                contentContainerStyle={{
                  padding: spacing.md,
                  paddingBottom: spacing.xl,
                  gap: spacing.md,
                }}
              >
                {/* Greeting / account chip (compact) */}
                <View
                  style={{
                    backgroundColor: colors.modalHeader,
                    borderRadius: radius.lg,
                    padding: spacing.md,
                  }}
                >
                  <Text style={type.sectionLabel}>
                    {t('profile.account')}
                  </Text>
                  <Text
                    style={[type.bodyStrong, { color: colors.brandDark }]}
                    numberOfLines={1}
                  >
                    {user?.name ?? user?.email ?? '—'}
                  </Text>
                </View>

                {/* Tenant switcher */}
                {tenants.length > 0 ? (
                  <View style={{ gap: spacing.sm }}>
                    <Text style={[type.sectionLabel, { paddingHorizontal: 4 }]}>
                      {t('tenant.select_tenant').toUpperCase()}
                    </Text>
                    {tenants.map((tenant) => (
                      <TenantRow
                        key={tenant.id}
                        tenant={tenant}
                        isActive={tenant.id === activeTenantId}
                        onPress={() => pickTenant(tenant.id)}
                      />
                    ))}
                  </View>
                ) : null}

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
                  <Text style={type.sectionLabel}>{t('profile.language')}</Text>
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
                  fullWidth
                  onPress={() => setConfirmSignOut(true)}
                />
              </ScrollView>
            </SafeAreaView>
          </Pressable>
        </Pressable>
      </Modal>

      <ConfirmModal
        open={confirmSignOut}
        onCancel={() => setConfirmSignOut(false)}
        onConfirm={doLogout}
        tone="warn"
        title={t('auth.sign_out')}
        confirmLabel={t('auth.sign_out')}
        cancelLabel={t('common.cancel')}
        confirmIcon="box-arrow-right"
      />
    </>
  );
}

export default AppDrawer;
