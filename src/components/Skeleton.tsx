// ══════════════════════════════════════════════════════════════
// Skeleton — shimmer-loading primitives.
//
// SkeletonBlock: a single rounded placeholder rectangle that
//   pulses with a left-to-right shimmer gradient.
// SkeletonGroup: wraps multiple blocks so they share the same
//   animation phase (avoids chaotic per-block timings).
//
// Built on react-native-reanimated (already installed for
// LineChart) + expo-linear-gradient for the shimmer highlight.
// ══════════════════════════════════════════════════════════════
import { createContext, useContext, type ReactNode } from 'react';
import { View, type ViewStyle, type DimensionValue } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';

import { colors, radius as themeRadius } from '@/theme';

// ── Shared phase context ──────────────────────────────────

const PhaseContext = createContext<SharedValue<number> | null>(null);

function useShimmerPhase(): SharedValue<number> {
  const parent = useContext(PhaseContext);
  const local = useSharedValue(-1);

  useEffect(() => {
    if (parent) return;
    local.value = withRepeat(
      withTiming(2, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, [parent, local]);

  return parent ?? local;
}

export interface SkeletonGroupProps {
  children: ReactNode;
}

export function SkeletonGroup({ children }: SkeletonGroupProps) {
  const phase = useSharedValue(-1);

  useEffect(() => {
    phase.value = withRepeat(
      withTiming(2, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, [phase]);

  return (
    <PhaseContext.Provider value={phase}>
      {children}
    </PhaseContext.Provider>
  );
}

// ── SkeletonBlock ──────────────────────────────────────────

const BASE_COLOR = colors.gray[200];
const HIGHLIGHT_COLOR = colors.gray[100];

export interface SkeletonBlockProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  /** True → full-width circle (width = height, borderRadius = 50%). */
  circle?: boolean;
  style?: ViewStyle;
}

export function SkeletonBlock({
  width = '100%',
  height = 16,
  borderRadius = themeRadius.md,
  circle,
  style,
}: SkeletonBlockProps) {
  const phase = useShimmerPhase();

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: phase.value * 100 }],
  }));

  const resolvedRadius = circle
    ? typeof height === 'number' ? height / 2 : 999
    : borderRadius;
  const resolvedWidth = circle ? height : width;

  return (
    <View
      style={[
        {
          width: resolvedWidth,
          height,
          borderRadius: resolvedRadius,
          backgroundColor: BASE_COLOR,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: -200,
            width: 200,
          },
          shimmerStyle,
        ]}
      >
        <LinearGradient
          colors={[BASE_COLOR, HIGHLIGHT_COLOR, BASE_COLOR]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}
