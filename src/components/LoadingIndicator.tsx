import { useEffect, useRef } from 'react';
import { Animated, Easing, View, Text } from 'react-native';

import { colors, spacing, type } from '@/theme';
import { Logo } from './Logo';

export interface LoadingIndicatorProps {
  message?: string;
  inline?: boolean;
}

const SPINNER_SIZE = 96;
const NODE_SIZE = 10;
const SMALL_NODE_SIZE = 8;

function useLoopRotation(durationMs: number, reverse = false) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    spin.setValue(0);
    const animation = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: durationMs,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [spin, durationMs]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: reverse ? ['0deg', '-360deg'] : ['0deg', '360deg'],
  });

  return { transform: [{ rotate }] };
}

function usePulse(durationMs: number) {
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.1,
            duration: durationMs / 2,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 0.9,
            duration: durationMs / 2,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 1,
            duration: durationMs / 2,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.8,
            duration: durationMs / 2,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [scale, opacity, durationMs]);

  return {
    transform: [{ scale }],
    opacity,
  };
}

function usePing(durationMs: number) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.4,
            duration: durationMs,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0,
            duration: durationMs,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.6,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [scale, opacity, durationMs]);

  return {
    transform: [{ scale }],
    opacity,
  };
}

function OuterRing() {
  const animStyle = useLoopRotation(3000);
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: SPINNER_SIZE / 2,
          borderWidth: 2,
          borderColor: 'transparent',
          borderTopColor: colors.statusGood,
          borderRightColor: 'rgba(108, 158, 131, 0.5)',
        },
        animStyle,
      ]}
    />
  );
}

function MiddleRing() {
  const animStyle = useLoopRotation(2000, true);
  const inset = 8;
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: inset,
          left: inset,
          right: inset,
          bottom: inset,
          borderRadius: (SPINNER_SIZE - inset * 2) / 2,
          borderWidth: 2,
          borderColor: 'transparent',
          borderTopColor: colors.brandAccent,
          borderRightColor: 'rgba(52, 152, 219, 0.3)',
        },
        animStyle,
      ]}
    />
  );
}

function InnerPing() {
  const animStyle = usePing(1500);
  const inset = 16;
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: inset,
          left: inset,
          right: inset,
          bottom: inset,
          borderRadius: (SPINNER_SIZE - inset * 2) / 2,
          borderWidth: 1,
          borderColor: 'rgba(44, 62, 80, 0.2)',
        },
        animStyle,
      ]}
    />
  );
}

function CenterLogo() {
  const animStyle = usePulse(2000);
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
        },
        animStyle,
      ]}
    >
      <Logo width={60} variant="dark" />
    </Animated.View>
  );
}

function OrbitingNode({
  color,
  durationMs,
  reverse = false,
  size = NODE_SIZE,
  offsetX,
  offsetY,
}: {
  color: string;
  durationMs: number;
  reverse?: boolean;
  size?: number;
  offsetX: number;
  offsetY: number;
}) {
  const animStyle = useLoopRotation(durationMs, reverse);
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        },
        animStyle,
      ]}
    >
      <View
        style={{
          position: 'absolute',
          top: offsetY,
          left: offsetX,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          shadowColor: color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.5,
          shadowRadius: 4,
          elevation: 4,
        }}
      />
    </Animated.View>
  );
}

function BrandedSpinner() {
  const half = SPINNER_SIZE / 2;
  return (
    <View style={{ width: SPINNER_SIZE, height: SPINNER_SIZE, position: 'relative' }}>
      <OuterRing />
      <MiddleRing />
      <InnerPing />
      <CenterLogo />

      {/* Blue node — top center */}
      <OrbitingNode
        color={colors.brandAccent}
        durationMs={4000}
        offsetX={half - NODE_SIZE / 2}
        offsetY={-NODE_SIZE / 2}
      />
      {/* Green node — bottom right */}
      <OrbitingNode
        color={colors.statusGood}
        durationMs={4000}
        reverse
        offsetX={SPINNER_SIZE - NODE_SIZE / 2}
        offsetY={SPINNER_SIZE - NODE_SIZE / 2}
      />
      {/* Brand node — left */}
      <OrbitingNode
        color={colors.brand}
        durationMs={5000}
        size={SMALL_NODE_SIZE}
        offsetX={-SMALL_NODE_SIZE / 2}
        offsetY={half - SMALL_NODE_SIZE / 2}
      />
    </View>
  );
}

export function LoadingIndicator({ message, inline }: LoadingIndicatorProps) {
  return (
    <View
      style={{
        flex: inline ? 0 : 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
        gap: spacing.md,
      }}
    >
      <BrandedSpinner />
      {message ? (
        <Text style={[type.caption, { color: colors.gray[500] }]}>{message}</Text>
      ) : null}
    </View>
  );
}

export default LoadingIndicator;
