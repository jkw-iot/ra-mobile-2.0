// ══════════════════════════════════════════════════════════════
// ChartSkeleton — fixed-height shimmer block for the chart area
// inside a SectionCard. Mimics a simplified chart silhouette
// with a Y-axis strip and a main plot area.
// ══════════════════════════════════════════════════════════════
import { View } from 'react-native';

import { SkeletonBlock } from '@/components/Skeleton';
import { colors, radius, spacing } from '@/theme';

const CHART_HEIGHT = 200;

export function ChartSkeleton() {
  return (
    <View
      style={{
        height: CHART_HEIGHT,
        flexDirection: 'row',
        gap: spacing.sm,
        paddingVertical: spacing.sm,
      }}
    >
      {/* Y-axis labels */}
      <View style={{ width: 28, justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <SkeletonBlock width={24} height={8} />
        <SkeletonBlock width={20} height={8} />
        <SkeletonBlock width={24} height={8} />
        <SkeletonBlock width={20} height={8} />
      </View>
      {/* Plot area */}
      <View style={{ flex: 1 }}>
        <SkeletonBlock
          width="100%"
          height="100%"
          borderRadius={radius.md}
        />
      </View>
    </View>
  );
}
