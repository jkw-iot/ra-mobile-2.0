// ══════════════════════════════════════════════════════════════
// LineChart — time-series chart with threshold zone bands, nice
// Y-axis labels, and interactive touch-to-inspect crosshair.
//
// `zones` is the primary API for colour-coded backgrounds. Build
// it via `buildZonesForParam` in features/indeklima/thresholds.ts
// so mobile and web render identical green/yellow/red bands for
// the same sensor + parameter.
// ══════════════════════════════════════════════════════════════
import { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, PanResponder, type GestureResponderEvent } from 'react-native';
import Svg, { Polyline, Line, Rect, Circle, Text as SvgText } from 'react-native-svg';

import { colors, type, radius } from '@/theme';
import { haptic } from '@/lib/haptics';

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

function fmtDateTime(ms: number): string {
  const d = new Date(ms);
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  return `${d.getDate()}. ${MONTHS[d.getMonth()]} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Zone min/max can be "infinite" sentinels (±1e6) used to paint
// open-ended red bands. We only want the finite values to influence
// the axis scale — otherwise a single zone squashes the whole data
// series into a single pixel.
const FINITE_LIMIT = 1e5;
function isFiniteBound(v: number): boolean {
  return Number.isFinite(v) && Math.abs(v) < FINITE_LIMIT;
}

export function LineChart({
  points,
  width,
  height = 200,
  stroke = colors.dusty[0],
  unit,
  zones,
}: LineChartProps) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  // Reset the sticky tooltip when the underlying series changes so
  // a stale index doesn't anchor the tooltip to an unrelated point.
  useEffect(() => {
    setActiveIdx(null);
  }, [points]);

  const valid = points.filter((p): p is LinePoint & { v: number } => p.v != null);
  if (valid.length < 2) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={type.caption}>—</Text>
      </View>
    );
  }

  // Y-axis labels right-align to `padLeft - 4`. 32px is enough for
  // up to 4-digit ticks ("1000") plus the gridline offset, and saves
  // 8px of internal whitespace versus the previous 40px gutter.
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

  const pointStr = valid.map((p) => `${toX(p.t)},${toY(p.v)}`).join(' ');

  // Clip zones into visible rects (avoids giant off-screen draws).
  const renderZones = (zones ?? [])
    .map((z) => {
      const lo = Math.max(z.min, minV);
      const hi = Math.min(z.max, maxV);
      if (hi <= lo) return null;
      const yTop = toY(hi);
      const yBottom = toY(lo);
      return {
        color: z.color,
        y: yTop,
        height: Math.max(0, yBottom - yTop),
      };
    })
    .filter((z): z is { color: string; y: number; height: number } => z !== null);

  // Touch handler — operates in the local (pre-transform) coordinate
  // system via `locationX`, so the chart responds correctly whether
  // it's rendered upright or rotated 90° in a fullscreen view.
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

  // PanResponder is created once (useRef) so it captures whatever
  // findNearestIdx existed on first render. Routing touches through
  // a ref keeps the PanResponder stable while always using the
  // latest data-aware closure.
  const findNearestIdxRef = useRef(findNearestIdx);
  findNearestIdxRef.current = findNearestIdx;

  // Tooltip is "sticky" — once placed it remains visible until the
  // user taps again (or the data changes via the effect above).
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        haptic.light();
        setActiveIdx(findNearestIdxRef.current(e.nativeEvent.locationX));
      },
      onPanResponderMove: (e: GestureResponderEvent) => {
        setActiveIdx(findNearestIdxRef.current(e.nativeEvent.locationX));
      },
    }),
  ).current;

  const activePoint = activeIdx != null ? valid[activeIdx] : null;

  return (
    <View>
      {/* Tooltip */}
      {activePoint ? (
        <View
          style={{
            position: 'absolute',
            top: -2,
            left: 0,
            right: 0,
            alignItems: 'center',
            zIndex: 10,
          }}
        >
          <View
            style={{
              backgroundColor: colors.navy,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: radius.md,
            }}
          >
            <Text style={{ color: colors.white, fontSize: 12, fontWeight: '700' }}>
              {activePoint.v.toFixed(1)}{unit ? ` ${unit}` : ''}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, textAlign: 'center' }}>
              {fmtDateTime(activePoint.t)}
            </Text>
          </View>
        </View>
      ) : null}

      <View {...panResponder.panHandlers}>
        <Svg width={width} height={height}>
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

          {/* Gridlines + Y-axis labels */}
          {ticks.map((tick, i) => {
            const y = toY(tick);
            if (y < padTop - 2 || y > padTop + plotH + 2) return null;
            return [
              <Line
                key={`grid-${i}`}
                x1={padLeft} x2={width - padRight}
                y1={y} y2={y}
                stroke={colors.gray[200]} strokeWidth={1}
                strokeOpacity={0.6}
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

          {/* Data line */}
          <Polyline
            points={pointStr}
            fill="none"
            stroke={stroke}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

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
        </Svg>
      </View>

      {/* Time axis */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingLeft: padLeft,
          paddingRight: padRight,
          marginTop: -4,
        }}
      >
        <Text style={[type.caption, { fontSize: 10 }]}>
          {new Date(minT).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
        <Text style={[type.caption, { fontSize: 10 }]}>
          {new Date(maxT).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    </View>
  );
}

export default LineChart;
