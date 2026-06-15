// ══════════════════════════════════════════════════════════════
// SensorHeroSkeleton — shimmer placeholder for the sensor
// detail navy hero: back pill, sensor name, measurement time
// row, and status strip (scenario + battery + coverage).
// ══════════════════════════════════════════════════════════════
import { View, Platform, StatusBar } from 'react-native';

import { SkeletonBlock } from '@/components/Skeleton';
import { HeroBackButton } from '@/components';
import { colors, radius, spacing } from '@/theme';

interface SensorHeroSkeletonProps {
  insetTop: number;
  onBack: () => void;
  backLabel: string;
}

export function SensorHeroSkeleton({ insetTop, onBack, backLabel }: SensorHeroSkeletonProps) {
  return (
    <View
      style={{
        backgroundColor: colors.navy,
        paddingTop: insetTop + spacing.xs,
        paddingBottom: spacing.sm,
      }}
    >
      {Platform.OS === 'ios' ? <StatusBar barStyle="light-content" /> : null}

      {/* Row 1: back button + name placeholder */}
      <View
        style={{
          paddingHorizontal: spacing.md,
          paddingTop: spacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        }}
      >
        <HeroBackButton onPress={onBack} label={backLabel} />
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <SkeletonBlock width="55%" height={18} borderRadius={radius.md} style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
        </View>
      </View>

      {/* Row 2: measurement time */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
          marginTop: spacing.md,
        }}
      >
        <SkeletonBlock width={12} height={12} circle style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
        <SkeletonBlock width="45%" height={11} style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
      </View>

      {/* Row 3: status strip */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: spacing.md,
          marginTop: spacing.xs,
          minHeight: 24,
        }}
      >
        <SkeletonBlock width={80} height={12} style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
        <SkeletonBlock width={14} height={14} circle style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
        <SkeletonBlock width={14} height={14} circle style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
      </View>
    </View>
  );
}
