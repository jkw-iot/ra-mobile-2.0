// ══════════════════════════════════════════════════════════════
// AppHeader — small top bar with the RoomAlyzer wordmark on the
// left and a burger button on the right that opens `AppDrawer`.
// Sits above `PageHeading` on every tab screen.
// ══════════════════════════════════════════════════════════════
import { useState } from 'react';
import { View, Pressable } from 'react-native';

import { colors, spacing, TOUCH_TARGET } from '@/theme';
import { Icon } from './Icon';
import { Logo } from './Logo';
import { AppDrawer } from './AppDrawer';

export function AppHeader() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
          backgroundColor: colors.white,
          borderBottomWidth: 1,
          borderBottomColor: colors.gray[200],
        }}
      >
        <Logo width={140} />
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
            backgroundColor: pressed ? colors.gray[100] : 'transparent',
          })}
        >
          <Icon name="list" color={colors.brandDark} size={26} />
        </Pressable>
      </View>
      <AppDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export default AppHeader;
