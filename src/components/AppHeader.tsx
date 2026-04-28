// ══════════════════════════════════════════════════════════════
// AppHeader — dark navbar with navy extending into the status bar.
// Logo on the left, burger menu trigger on the right. The active
// tenant used to be shown centred between the two; that name now
// lives on the Profile tab (and post-login `/select-tenant`),
// where the user can both see and change it. Removing it from
// here keeps the chrome clean and gives screens below more room.
// ══════════════════════════════════════════════════════════════
import { useState } from 'react';
import { View, Pressable, StatusBar, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing, TOUCH_TARGET } from '@/theme';
import { haptic } from '@/lib/haptics';
import { Icon } from './Icon';
import { Logo } from './Logo';
import { AppDrawer } from './AppDrawer';

export function AppHeader() {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();

  return (
    <>
      {Platform.OS === 'ios' ? <StatusBar barStyle="light-content" /> : null}
      <View style={{ backgroundColor: colors.navy, paddingTop: insets.top }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            gap: spacing.sm,
          }}
        >
          <Logo width={110} variant="white" />
          <Pressable
            onPress={() => {
              haptic.light();
              setOpen(true);
            }}
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
            <Icon name="list" color={colors.white} size={32} />
          </Pressable>
        </View>
      </View>
      <AppDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export default AppHeader;
