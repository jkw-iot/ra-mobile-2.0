// ══════════════════════════════════════════════════════════════
// KpiTileSkeleton — shimmer placeholder matching KpiTile layout:
// icon + label header row, large centered value block.
// Takes flex: 1 like the real KpiTile so it works in 2-up rows.
// ══════════════════════════════════════════════════════════════
import { View } from 'react-native';

import { SkeletonBlock } from '@/components/Skeleton';
import { colors, radius, spacing } from '@/theme';

export function KpiTileSkeleton() {
  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          backgroundColor: colors.white,
          borderRadius: radius.lg,
          minHeight: 92,
          borderWidth: 1,
          borderColor: colors.gray[200],
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          gap: 10,
        }}
      >
        {/* Header: icon + label */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <SkeletonBlock width={14} height={14} circle />
          <SkeletonBlock width={48} height={10} />
        </View>
        {/* Centered value */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <SkeletonBlock width={80} height={32} borderRadius={radius.md} />
        </View>
      </View>
    </View>
  );
}
