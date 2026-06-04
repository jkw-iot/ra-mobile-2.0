// ══════════════════════════════════════════════════════════════
// LineChart — time-series chart with threshold zone bands, nice
// Y-axis labels, and interactive touch-to-inspect crosshair.
//
// `zones` is the primary API for colour-coded backgrounds. Build
// it via `buildZonesForParam` in features/indeklima/thresholds.ts
// so mobile and web render identical green/yellow/red bands for
// the same sensor + parameter.
// ══════════════════════════════════════════════════════════════
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { View, Text, PanResponder, type GestureResponderEvent } from 'react-native';
import Svg, {
  Path,
  Line,
  Rect,
  Circle,
  Text as SvgText,
  Defs,
  LinearGradient,
  Stop,
  ClipPath,
} from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { colors, type, radius } from '@/theme';
import { haptic } from '@/lib/haptics';
import { monotoneCubicPath } from '@/features/indeklima/chartHelpers';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export interface LinePoint {
  t: number;
  v: number | null;
}

export interface ChartZone {
  min: number;
  max: number;
  color: string;
}

export interface LineChartProps {
  points: readonly LinePoint[];
  width: number;
  height?: number;
  stroke?: string;
  unit?: string;
  /** Coloured background bands (green / yellow / red). */
  zones?: readonly ChartZone[];
  /** Use monotone cubic spline instead of straight segments. */
  smooth?: boolean;
  /**
   * Tenant-tz-aware formatters. Provide these (from `useTenantTime`)
   * so the tooltip and axis labels render the tenant's wall clock on
   * any device. Both fall back to a device-local format when omitted.
   */
  formatTimestamp?: (ms: number) => string;
  formatAxisLabel?: (ms: number) => string;
}

// ── Nice-number helper ───────────────────────────────────
function niceNum(value: number, round: boolean): number {
  const exp = Math.floor(Math.log10(Math.abs(value) || 1));
  const frac = value / Math.pow(10, exp);
  let nice: number;
  if (round) {
    if (frac < 1.5) nice = 1;
    else if (frac < 3) nice = 2;
    else if (frac < 7) nice = 5;
    else nice = 10;
  } else {
    if (frac <= 1) nice = 1;
    else if (frac <= 2) nice = 2;
    else if (frac <= 5) nice = 5;
    else nice = 10;
  }
  return nice * Math.pow(10, exp);
}

function niceScale(dataMin: number, dataMax: number, maxTicks = 5) {
  const range = niceNum(dataMax - dataMin, false);
  const step = niceNum(range / (maxTicks - 1), true);
  const niceMin = Math.floor(dataMin / step) * step;
  const niceMax = Math.ceil(dataMax / step) * step;
  const ticks: number[] = [];
  for (let v = niceMin; v <= niceMax + step * 0.5; v += step) {
    ticks.push(Math.round(v * 1000) / 1000);
  }
  return { niceMin, niceMax, step, ticks };
}

function fmtTick(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
}

const MONTHS_DA = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

function fallbackDateTime(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()}. ${MONTHS_DA[d.getMonth()]} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fallbackAxisLabel(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()}. ${MONTHS_DA[d.getMonth()]} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const FINITE_LIMIT = 1e5;
function isFiniteBound(v: number): boolean {
  return Number.isFinite(v) && Math.abs(v) < FINITE_LIMIT;
}

const X_TICK_COUNT = 5;

/** Convert a hex colour (#RRGGBB) to rgba(r,g,b,a). */
function hexToRgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export function LineChart({
  points,
  width,
  height = 200,
  stroke = colors.dusty[0],
  unit,
  zones,
  smooth = false,
  formatTimestamp = fallbackDateTime,
  formatAxisLabel = fallbackAxisLabel,
}: LineChartProps) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const prevIdxRef = useRef<number | null>(null);

  useEffect(() => {
    setActiveIdx(null);
    prevIdxRef.current = null;
  }, [points]);

  const valid = useMemo(
    () => points.filter((p): p is LinePoint & { v: number } => p.v != null),
    [points],
  );

  // ── Draw-in animation ──────────────────────────────────
  const drawProgress = useSharedValue(0);
  const areaOpacity = useSharedValue(0);

  useEffect(() => {
    drawProgress.value = 0;
    areaOpacity.value = 0;
    drawProgress.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
    areaOpacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) });
  }, [points, drawProgress, areaOpacity]);

  if (valid.length < 2) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={type.caption}>—</Text>
      </View>
    );
  }

  const padLeft = 32;
  const padRight = 6;
  const padTop = 14;
  const padBottom = 24;

  const minT = valid[0]!.t;
  const maxT = valid[valid.length - 1]!.t;
  const tSpan = Math.max(1, maxT - minT);

  const rawValues = valid.map((p) => p.v);
  let dataMin = Math.min(...rawValues);
  let dataMax = Math.max(...rawValues);
  if (zones) {
    for (const z of zones) {
      if (isFiniteBound(z.min) && z.min < dataMin) dataMin = z.min;
      if (isFiniteBound(z.max) && z.max > dataMax) dataMax = z.max;
    }
  }

  const { niceMin, niceMax, ticks } = niceScale(dataMin, dataMax, 5);
  const margin = (niceMax - niceMin) * 0.02 || 0.5;
  const minV = niceMin - margin;
  const maxV = niceMax + margin;
  const vSpan = Math.max(0.001, maxV - minV);

  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const toX = (t: number) => padLeft + ((t - minT) / tSpan) * plotW;
  const toY = (v: number) => padTop + plotH - ((v - minV) / vSpan) * plotH;

  // ── SVG path strings ───────────────────────────────────
  const screenPts = valid.map((p) => ({ x: toX(p.t), y: toY(p.v) }));

  const linePath = smooth
    ? monotoneCubicPath(screenPts)
    : 'M' + screenPts.map((p) => `${p.x},${p.y}`).join('L');

  const baselineY = padTop + plotH;
  const areaPath = linePath
    + `L${screenPts[screenPts.length - 1]!.x},${baselineY}`
    + `L${screenPts[0]!.x},${baselineY}Z`;

  // Clip zones into visible rects.
  const renderZones = (zones ?? [])
    .map((z) => {
      const lo = Math.max(z.min, minV);
      const hi = Math.min(z.max, maxV);
      if (hi <= lo) return null;
      const yTop = toY(hi);
      const yBottom = toY(lo);
      return { color: z.color, y: yTop, height: Math.max(0, yBottom - yTop) };
    })
    .filter((z): z is { color: string; y: number; height: number } => z !== null);

  // ── X-axis ticks ────────────────────────────────────────
  const xTicks: number[] = [];
  for (let i = 0; i < X_TICK_COUNT; i++) {
    xTicks.push(minT + (tSpan * i) / (X_TICK_COUNT - 1));
  }

  // ── Min / max markers ──────────────────────────────────
  let minPt: (typeof valid)[number] | null = null;
  let maxPt: (typeof valid)[number] | null = null;
  for (const p of valid) {
    if (!minPt || p.v < minPt.v) minPt = p;
    if (!maxPt || p.v > maxPt.v) maxPt = p;
  }
  const valueRange = (maxPt?.v ?? 0) - (minPt?.v ?? 0);
  const showMinMax = minPt && maxPt && minPt !== maxPt && valueRange > vSpan * 0.05;

  // ── Approximate path length for dash animation ─────────
  let pathLen = 0;
  for (let i = 1; i < screenPts.length; i++) {
    const dx = screenPts[i]!.x - screenPts[i - 1]!.x;
    const dy = screenPts[i]!.y - screenPts[i - 1]!.y;
    pathLen += Math.sqrt(dx * dx + dy * dy);
  }
  if (smooth) pathLen *= 1.15;

  const animatedLineProps = useAnimatedProps(() => ({
    strokeDashoffset: pathLen * (1 - drawProgress.value),
  }));

  const animatedAreaProps = useAnimatedProps(() => ({
    fillOpacity: areaOpacity.value * 0.15,
  }));

  // ── Touch handling ─────────────────────────────────────
  const findNearestIdx = useCallback((localX: number) => {
    const dataX = ((localX - padLeft) / plotW) * tSpan + minT;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < valid.length; i++) {
      const dist = Math.abs(valid[i]!.t - dataX);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    return best;
  }, [valid, minT, tSpan, plotW]);

  const findNearestIdxRef = useRef(findNearestIdx);
  findNearestIdxRef.current = findNearestIdx;

  const handleTouch = useCallback((localX: number) => {
    const idx = findNearestIdxRef.current(localX);
    if (prevIdxRef.current !== idx) {
      haptic.select();
      prevIdxRef.current = idx;
    }
    setActiveIdx(idx);
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        haptic.light();
        handleTouch(e.nativeEvent.locationX);
      },
      onPanResponderMove: (e: GestureResponderEvent) => {
        handleTouch(e.nativeEvent.locationX);
      },
    }),
  ).current;

  const activePoint = activeIdx != null ? valid[activeIdx] : null;

  // Tooltip horizontal position — follow the active point, clamped
  // so the pill never clips past the chart edges.
  const tooltipWidth = 110;
  const activeX = activePoint ? toX(activePoint.t) : 0;
  const tooltipLeft = activePoint
    ? Math.max(4, Math.min(activeX - tooltipWidth / 2, width - tooltipWidth - 4))
    : 0;

  const gradientId = `areaGrad-${stroke.replace('#', '')}`;

  return (
    <View>
      {/* Floating tooltip — follows the active X position */}
      {activePoint ? (
        <View
          style={{
            position: 'absolute',
            top: -2,
            left: tooltipLeft,
            width: tooltipWidth,
            alignItems: 'center',
            zIndex: 10,
          }}
          pointerEvents="none"
        >
          <View
            style={{
              backgroundColor: colors.navy,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: radius.md,
            }}
          >
            <Text style={{ color: colors.white, fontSize: 12, fontWeight: '700', textAlign: 'center' }}>
              {activePoint.v.toFixed(1)}{unit ? ` ${unit}` : ''}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, textAlign: 'center' }}>
              {formatTimestamp(activePoint.t)}
            </Text>
          </View>
        </View>
      ) : null}

      <View {...panResponder.panHandlers}>
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={stroke} stopOpacity="1" />
              <Stop offset="1" stopColor={stroke} stopOpacity="0" />
            </LinearGradient>
            <ClipPath id="plotClip">
              <Rect x={padLeft} y={padTop} width={plotW} height={plotH} />
            </ClipPath>
          </Defs>

          {/* Zone backgrounds */}
          {renderZones.map((z, i) => (
            <Rect
              key={`zone-${i}`}
              x={padLeft}
              y={z.y}
              width={plotW}
              height={z.height}
              fill={z.color}
            />
          ))}

          {/* Horizontal gridlines + Y-axis labels */}
          {ticks.map((tick, i) => {
            const y = toY(tick);
            if (y < padTop - 2 || y > padTop + plotH + 2) return null;
            return [
              <Line
                key={`hgrid-${i}`}
                x1={padLeft} x2={width - padRight}
                y1={y} y2={y}
                stroke={colors.gray[200]} strokeWidth={0.5}
                strokeOpacity={0.5}
              />,
              <SvgText
                key={`label-${i}`}
                x={padLeft - 4} y={y + 3}
                fontSize={10} fill={colors.gray[500]}
                textAnchor="end"
              >
                {fmtTick(tick)}
              </SvgText>,
            ];
          })}

          {/* Vertical gridlines */}
          {xTicks.map((t, i) => {
            if (i === 0 || i === X_TICK_COUNT - 1) return null;
            const x = toX(t);
            return (
              <Line
                key={`vgrid-${i}`}
                x1={x} x2={x}
                y1={padTop} y2={padTop + plotH}
                stroke={colors.gray[200]} strokeWidth={0.5}
                strokeOpacity={0.35}
                strokeDasharray="2,4"
              />
            );
          })}

          {/* Area gradient fill */}
          <AnimatedPath
            d={areaPath}
            fill={`url(#${gradientId})`}
            clipPath="url(#plotClip)"
            animatedProps={animatedAreaProps}
          />

          {/* Data line with draw-in animation */}
          <AnimatedPath
            d={linePath}
            fill="none"
            stroke={stroke}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray={pathLen}
            animatedProps={animatedLineProps}
          />

          {/* Min / max markers */}
          {showMinMax && !activePoint ? (
            <>
              {maxPt ? (
                <>
                  <Circle
                    cx={toX(maxPt.t)} cy={toY(maxPt.v)} r={3}
                    fill={stroke} fillOpacity={0.6}
                  />
                  <SvgText
                    x={toX(maxPt.t)} y={toY(maxPt.v) - 6}
                    fontSize={9} fill={hexToRgba(stroke, 0.7)}
                    textAnchor="middle" fontWeight="600"
                  >
                    {fmtTick(maxPt.v)}
                  </SvgText>
                </>
              ) : null}
              {minPt ? (
                <>
                  <Circle
                    cx={toX(minPt.t)} cy={toY(minPt.v)} r={3}
                    fill={stroke} fillOpacity={0.6}
                  />
                  <SvgText
                    x={toX(minPt.t)} y={toY(minPt.v) + 12}
                    fontSize={9} fill={hexToRgba(stroke, 0.7)}
                    textAnchor="middle" fontWeight="600"
                  >
                    {fmtTick(minPt.v)}
                  </SvgText>
                </>
              ) : null}
            </>
          ) : null}

          {/* Active crosshair */}
          {activePoint ? (
            <>
              <Line
                x1={toX(activePoint.t)} x2={toX(activePoint.t)}
                y1={padTop} y2={padTop + plotH}
                stroke={colors.brandDark} strokeWidth={1}
                strokeOpacity={0.4}
              />
              <Circle
                cx={toX(activePoint.t)}
                cy={toY(activePoint.v)}
                r={5}
                fill={stroke}
                strokeWidth={2}
                stroke={colors.white}
              />
            </>
          ) : null}

          {/* X-axis tick labels */}
          {xTicks.map((t, i) => {
            const anchor = i === 0 ? 'start' : i === X_TICK_COUNT - 1 ? 'end' : 'middle';
            return (
              <SvgText
                key={`xt-${i}`}
                x={toX(t)}
                y={padTop + plotH + 14}
                fontSize={9}
                fill={colors.gray[500]}
                textAnchor={anchor}
              >
                {formatAxisLabel(t)}
              </SvgText>
            );
          })}
        </Svg>
      </View>
    </View>
  );
}

export default LineChart;
