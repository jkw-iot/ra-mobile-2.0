// ══════════════════════════════════════════════════════════════
// HeroBackButton — pill-shaped back button for dark hero headers.
//
// Designed to sit on top of the navy hero on inner detail pages
// (sensor detail, alert detail, …). The dusty-brand fill + solid
// white border + drop shadow make it unambiguously tappable
// without washing out the brand background.
//
// Rendering note: the pill styling lives on an inner <View>
// because function-style `style` on <Pressable> has sporadic
// rendering issues with backgrounds/borders/shadows in this RN
// + NativeWind setup (observed on Expo SDK 54). Keep it this way.
// ══════════════════════════════════════════════════════════════
import { Pressable, View, Text } from 'react-native';

import { colors } from '@/theme';
import { haptic } from '@/lib/haptics';
import { Icon } from './Icon';

export interface HeroBackButtonProps {
  label: string;
  onPress: () => void;
}

export function HeroBackButton({ label, onPress }: HeroBackButtonProps) {
  return (
    <Pressable
      onPress={() => {
        haptic.light();
        onPress();
      }}
      hitSlop={16}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        alignSelf: 'flex-start',
        opacity: pressed ? 0.85 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingLeft: 10,
          paddingRight: 14,
          height: 38,
          borderRadius: 19,
          backgroundColor: colors.brand,
          borderWidth: 1,
          borderColor: '#FFFFFF',
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 4,
        }}
      >
        <Icon name="chevron-left" color={colors.white} size={20} />
        <Text
          style={{
            color: colors.white,
            fontSize: 14,
            fontWeight: '700',
            letterSpacing: -0.1,
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

export default HeroBackButton;
