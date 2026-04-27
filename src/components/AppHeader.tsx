// ══════════════════════════════════════════════════════════════
// AppHeader — dark navbar with navy extending into the status bar.
// Shows the logo on the left, the active tenant name in the centre
// (so users always know which tenant they are viewing) and a
// burger menu trigger on the right.
// ══════════════════════════════════════════════════════════════
import { useState } from 'react';
import { View, Text, Pressable, StatusBar, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing, TOUCH_TARGET } from '@/theme';
import { useAuth } from '@/services/auth/AuthProvider';
import { useTenantStore } from '@/stores/tenantStore';
import { Icon } from './Icon';
import { Logo } from './Logo';
import { AppDrawer } from './AppDrawer';

export function AppHeader() {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const { tenants } = useAuth();
  const activeTenantId = useTenantStore((s) => s.activeTenantId);
  const activeTenant = tenants.find((tn) => tn.id === activeTenantId);

  return (
    <>
      {Platform.OS === 'ios' ? <StatusBar barStyle="light-content" /> : null}
      <View style={{ backgroundColor: colors.navy, paddingTop: insets.top }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            gap: spacing.sm,
          }}
        >
          <Logo width={110} variant="white" />
          <Text
            style={{
              flex: 1,
              color: colors.white,
              fontSize: 16,
              fontWeight: '700',
              textAlign: 'center',
              letterSpacing: -0.2,
            }}
            numberOfLines={1}
          >
            {activeTenant?.name ?? ''}
          </Text>
          <Pressable
            onPress={() => setOpen(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Open menu"
            style={({ pressed }) => ({
              width: TOUCH_TARGET,
              height: TOUCH_TARGET,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 999,
              backgroundColor: pressed ? 'rgba(255,255,255,0.1)' : 'transparent',
            })}
          >
            <Icon name="list" color={colors.white} size={26} />
          </Pressable>
        </View>
      </View>
      <AppDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export default AppHeader;
