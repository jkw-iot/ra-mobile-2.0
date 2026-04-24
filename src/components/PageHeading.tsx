// ══════════════════════════════════════════════════════════════
// PageHeading — top of every screen.
//
// Mirrors the web PageHeading:
//   - Icon in brand-accent
//   - Title in brand-dark, bold
//   - Subtitle in gray
//   - Thin divider line
// Mandatory on every screen to keep visual rhythm consistent.
// ══════════════════════════════════════════════════════════════
import { View, Text } from 'react-native';
import type { ReactNode } from 'react';

import { colors, type } from '@/theme';
import { Icon } from './Icon';

export interface PageHeadingProps {
  icon?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children?: ReactNode;
}

export function PageHeading({ icon, title, subtitle, actions, children }: PageHeadingProps) {
  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.gray[200],
        backgroundColor: colors.white,
      }}
    >
      {children}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {icon ? <Icon name={icon} color={colors.brandAccent} size={22} /> : null}
        <Text style={type.pageTitle} numberOfLines={1}>
          {title}
        </Text>
        {actions ? <View style={{ marginLeft: 'auto' }}>{actions}</View> : null}
      </View>
      {subtitle ? (
        <Text style={type.pageSubtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export default PageHeading;
