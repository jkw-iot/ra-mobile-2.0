// ══════════════════════════════════════════════════════════════
// SensorCardSkeleton — shimmer placeholder matching SensorCard
// layout: white rounded card with title line, secondary pills
// row, and a right-aligned KPI block.
// ══════════════════════════════════════════════════════════════
import { View } from 'react-native';

import { SkeletonBlock } from '@/components/Skeleton';
import { colors, radius, spacing } from '@/theme';

export function SensorCardSkeleton() {
  return (
    <View style={{ marginHorizontal: spacing.xs, marginBottom: spacing.xs }}>
      <View
        style={{
          borderRadius: radius.lg,
          backgroundColor: colors.white,
          borderWidth: 1,
          borderColor: colors.gray[200],
          flexDirection: 'row',
          overflow: 'hidden',
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.md,
          gap: spacing.md,
          alignItems: 'center',
        }}
      >
        {/* Left: name + pills */}
        <View style={{ flex: 1, gap: 8 }}>
          <SkeletonBlock width="65%" height={14} />
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
            <SkeletonBlock width={56} height={20} borderRadius={radius.full} />
            <SkeletonBlock width={52} height={20} borderRadius={radius.full} />
            <SkeletonBlock width={48} height={20} borderRadius={radius.full} />
          </View>
        </View>

        {/* Right: timestamp + value */}
        <View style={{ alignItems: 'flex-end', minWidth: 88, gap: 6 }}>
          <SkeletonBlock width={48} height={10} />
          <SkeletonBlock width={72} height={24} />
        </View>
      </View>
    </View>
  );
}
