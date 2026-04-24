// ══════════════════════════════════════════════════════════════
// SectionCard — white, rounded, gray-bordered container.
// Mirrors the web SectionCard with its small uppercase header.
// ══════════════════════════════════════════════════════════════
import { View, Text } from 'react-native';
import type { ReactNode } from 'react';

import { colors, radius, spacing, type } from '@/theme';
import { Icon } from './Icon';

export interface SectionCardProps {
  title?: string;
  icon?: string;
  trailing?: ReactNode;
  headerShaded?: boolean;
  padding?: number;
  children: ReactNode;
}

export function SectionCard({
  title,
  icon,
  trailing,
  headerShaded,
  padding = spacing.md,
  children,
}: SectionCardProps) {
  return (
    <View
      style={{
        backgroundColor: colors.white,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.gray[200],
        overflow: 'hidden',
      }}
    >
      {title ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            backgroundColor: headerShaded ? colors.gray[50] : 'transparent',
            borderBottomWidth: title ? 1 : 0,
            borderBottomColor: colors.gray[100],
          }}
        >
          {icon ? <Icon name={icon} size={14} color={colors.gray[500]} /> : null}
          <Text
            style={[
              type.sectionLabel,
              { color: colors.gray[500], flex: trailing ? 1 : undefined },
            ]}
          >
            {title.toUpperCase()}
          </Text>
          {trailing}
        </View>
      ) : null}
      <View style={{ padding }}>{children}</View>
    </View>
  );
}

export default SectionCard;
