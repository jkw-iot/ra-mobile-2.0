// ══════════════════════════════════════════════════════════════
// AlertRowSkeleton — shimmer placeholder matching the alert list
// row layout: icon circle + 3 text lines (name, location, rule).
// ══════════════════════════════════════════════════════════════
import { View } from 'react-native';

import { SkeletonBlock } from '@/components/Skeleton';
import { colors, spacing } from '@/theme';

export function AlertRowSkeleton() {
  return (
    <View
      style={{
        backgroundColor: colors.white,
        borderBottomWidth: 1,
        borderBottomColor: colors.gray[100],
        padding: spacing.md,
        flexDirection: 'row',
        gap: spacing.sm,
        alignItems: 'flex-start',
      }}
    >
      <SkeletonBlock width={20} height={20} circle />
      <View style={{ flex: 1, gap: 6 }}>
        <SkeletonBlock width="70%" height={14} />
        <SkeletonBlock width="45%" height={11} />
        <SkeletonBlock width="55%" height={11} />
      </View>
    </View>
  );
}
