// ══════════════════════════════════════════════════════════════
// AppDrawer — slide-in side sheet triggered from AppHeader's burger.
//
// Contains: active tenant (with switch action), language picker,
// sign-out. Replaces the old module-grid home screen as the place
// where cross-cutting settings live.
// ══════════════════════════════════════════════════════════════
import { useState } from 'react';
import { Modal, Pressable, View, Text, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing, type } from '@/theme';
import { useAuth } from '@/services/auth/AuthProvider';
import { useTenantStore } from '@/stores/tenantStore';
import { setLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n';
import { Icon } from './Icon';
import { StatusDot } from './StatusDot';
import { SegmentedControl } from './SegmentedControl';
import { Button } from './Button';
import { ConfirmModal } from './ConfirmModal';
import { Logo } from './Logo';

export interface AppDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function AppDrawer({ open, onClose }: AppDrawerProps) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { tenants, user, logout } = useAuth();
  const activeTenantId = useTenantStore((s) => s.activeTenantId);
  const activeTenant = tenants.find((ten) => ten.id === activeTenantId);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const langOptions = SUPPORTED_LANGUAGES.map((code) => ({
    id: code,
    label: code.toUpperCase(),
  }));

  const goSwitchTenant = () => {
    onClose();
    router.push('/select-tenant');
  };

  const doLogout = async () => {
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
              width: '80%',
              maxWidth: 360,
              backgroundColor: colors.bgPrimary,
              borderLeftWidth: 1,
              borderLeftColor: colors.gray[200],
            }}
          >
            <SafeAreaView style={{ flex: 1 }} edges={['top', 'right', 'bottom']}>
              {/* Header row */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.gray[200],
                  backgroundColor: colors.white,
                }}
              >
                <Logo width={120} />
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
                    backgroundColor: pressed ? colors.gray[100] : 'transparent',
                  })}
                >
                  <Icon name="x" color={colors.gray[600]} size={22} />
                </Pressable>
              </View>

              <ScrollView
                contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
              >
                {/* Account */}
                <View
                  style={{
                    backgroundColor: colors.modalHeader,
                    borderRadius: radius.lg,
                    padding: spacing.md,
                    gap: 4,
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

                {/* Tenant */}
                {tenants.length > 0 ? (
                  <View
                    style={{
                      backgroundColor: colors.white,
                      borderRadius: radius.lg,
                      borderWidth: 1,
                      borderColor: colors.gray[200],
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        paddingHorizontal: spacing.md,
                        paddingTop: spacing.sm,
                      }}
                    >
                      <Text style={type.sectionLabel}>{t('tenant.active')}</Text>
                    </View>
                    <Pressable
                      disabled={tenants.length <= 1}
                      onPress={goSwitchTenant}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.sm,
                        padding: spacing.md,
                        backgroundColor: pressed ? colors.gray[50] : 'transparent',
                      })}
                    >
                      <StatusDot tone="good" />
                      <Text
                        style={[type.body, { flex: 1, color: colors.brandDark }]}
                        numberOfLines={1}
                      >
                        {activeTenant?.name ?? '—'}
                      </Text>
                      {tenants.length > 1 ? (
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Text
                            style={[type.caption, { color: colors.brandAccent }]}
                          >
                            {t('tenant.switch')}
                          </Text>
                          <Icon
                            name="chevron-right"
                            color={colors.brandAccent}
                            size={16}
                          />
                        </View>
                      ) : null}
                    </Pressable>
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
                <View style={{ marginTop: spacing.sm }}>
                  <Button
                    label={t('auth.sign_out')}
                    icon="box-arrow-right"
                    variant="danger"
                    fullWidth
                    onPress={() => setConfirmSignOut(true)}
                  />
                </View>
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
