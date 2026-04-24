// ══════════════════════════════════════════════════════════════
// SegmentedControl — pick one of 2-5 options, all visible.
// ══════════════════════════════════════════════════════════════
import { View, Text, Pressable } from 'react-native';

import { colors, radius, spacing, type } from '@/theme';
import { Icon } from './Icon';

export interface SegmentedOption<T extends string> {
  id: T;
  label: string;
  icon?: string;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (id: T) => void;
  options: readonly SegmentedOption<T>[];
  size?: 'sm' | 'md';
  ariaLabel?: string;
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  ariaLabel,
}: SegmentedControlProps<T>) {
  const vPad = size === 'sm' ? 6 : 8;
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={ariaLabel}
      style={{
        flexDirection: 'row',
        backgroundColor: colors.gray[100],
        padding: 2,
        borderRadius: radius.md,
      }}
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <Pressable
            key={opt.id}
            onPress={() => onChange(opt.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={opt.label}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.xs,
              paddingVertical: vPad,
              borderRadius: radius.sm,
              backgroundColor: active ? colors.white : 'transparent',
            }}
          >
            {opt.icon ? (
              <Icon
                name={opt.icon}
                color={active ? colors.brandDark : colors.gray[600]}
                size={16}
              />
            ) : null}
            <Text
              style={[
                type.caption,
                {
                  color: active ? colors.brandDark : colors.gray[600],
                  fontWeight: active ? '600' : '400',
                },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default SegmentedControl;
