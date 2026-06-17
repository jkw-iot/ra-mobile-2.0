// ══════════════════════════════════════════════════════════════
// PresenceChart — discrete two-state timeline for PIR sensors.
//
// Mirrors the web app's QuickGraphModal PIR chart (see
// ../../../../roomalyzer20/src/components/QuickGraphModal.jsx,
// the `pirIntervals` block + transition-point dataset). The
// principle: a single linear timeline showing two horizontal
// "rows" — Optaget (occupied) on top and Ledigt (vacant) below —
// with the background painted light-green by default and red
// across every interval where the sensor reported occupancy.
// Dots sit on the appropriate row at every transition point.
//
// Why not the regular LineChart? PIR is binary (or a count we
// threshold to binary). A line plot of 0s and 1s reads as noise;
// what users actually want to know is "when was someone here?",
// which is exactly what bands + transition dots communicate.
//
// Interaction model: matches LineChart — tap or drag anywhere on
// the chart to drop a sticky vertical crosshair at that time. The
// tooltip surfaces the state at that moment (the most recent
// reading at-or-before the touched time, i.e. step-state lookup)
// plus the precise timestamp.
// ══════════════════════════════════════════════════════════════
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  PanResponder,
  type GestureResponderEvent,
} from 'react-native';
import Svg, {
  Rect,
  Circle,
  Line,
  Text as SvgText,
} from 'react-native-svg';

import { colors, radius, type } from '@/theme';
import { haptic } from '@/lib/haptics';
import type { LinePoint } from '@/features/indeklima/LineChart';
import {
  generateNiceTimeTicks,
  maxTicksForWidth,
  type TickFormat,
} from '@/features/indeklima/chartHelpers';

type TextAnchor = 'start' | 'middle' | 'end';

export interface PresenceChartProps {
  points: readonly LinePoint[];
  width: number;
  height?: number;
  /** Inclusive left edge of the X axis (ms). */
  fromTs: number;
  /** Inclusive right edge of the X axis (ms). */
  toTs: number;
  /**
   * When the visible period includes "right now", pass `Date.now()`
   * here. The chart will clip colored bands at this timestamp, leave
   * the future blank, and draw a "now" marker with the current status.
   * Omit for fully historical periods (e.g. viewing yesterday).
   */
  nowTs?: number;
  /** Localised label for the top row (e.g. "Optaget"). */
  occupiedLabel: string;
  /** Localised label for the bottom row (e.g. "Ledigt"). */
  vacantLabel: string;
  /** Short "now" label shown at the now-marker (e.g. "Nu"). */
  nowLabel?: string;
  /** Tenant timezone for snapping ticks to round boundaries. */
  tz?: string;
  /**
   * Tenant-tz-aware formatters (from `useTenantTime`). Provide these
   * so axis ticks + tooltip render the tenant's wall clock on any
   * device; both fall back to a device-local format when omitted.
   */
  formatClock?: (ms: number) => string;
  formatDate?: (ms: number) => string;
  /** Format for combined date+time axis labels (e.g. "15. jun 12:00"). */
  formatDateTime?: (ms: number) => string;
  /**
   * Live occupied/vacant state from the sensor snapshot. When provided,
   * the chart extends the last known occupied interval all the way to
   * `nowTs` even when hourly aggregates report pir_sum = 0 for the
   * still-in-progress current hour (which would otherwise close the
   * interval early and incorrectly show green up to "now").
   */
  currentOccupied?: boolean;
}

interface ClassifiedPoint {
  t: number;
  occupied: boolean;
}

interface OccupiedInterval {
  from: number;
  to: number;
}

interface TransitionDot {
  t: number;
  occupied: boolean;
}


const MONTHS_DA = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

// Device-local fallbacks used only when the caller doesn't pass the
// tenant-tz formatters from `useTenantTime`.
function fallbackClock(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function fallbackDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()}. ${MONTHS_DA[d.getMonth()]}`;
}

/**
 * Step-state lookup: return the most recent classified reading
 * at-or-before `t`. Uses binary search on the pre-sorted array
 * so dragging across the chart stays cheap even with thousands
 * of points. Returns `null` if `t` is before any reading.
 */
function stateAt(sorted: readonly ClassifiedPoint[], t: number): ClassifiedPoint | null {
  if (sorted.length === 0) return null;
  if (t < sorted[0]!.t) return null;
  let lo = 0;
  let hi = sorted.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (sorted[mid]!.t <= t) lo = mid;
    else hi = mid - 1;
  }
  return sorted[lo] ?? null;
}

export function PresenceChart({
  points,
  width,
  height = 170,
  fromTs,
  toTs,
  nowTs,
  occupiedLabel,
  vacantLabel,
  nowLabel = 'Nu',
  tz,
  formatClock = fallbackClock,
  formatDate = fallbackDate,
  formatDateTime,
  currentOccupied,
}: PresenceChartProps) {
  const fmtDateTime = (ms: number): string => `${formatDate(ms)} · ${formatClock(ms)}`;
  const padLeft = 56;
  const padRight = 8;
  const padTop = 18;
  const padBottom = 22;

  const plotW = Math.max(0, width - padLeft - padRight);
  const plotH = Math.max(0, height - padTop - padBottom);
  const tSpan = Math.max(1, toTs - fromTs);

  const toX = (t: number) => padLeft + ((t - fromTs) / tSpan) * plotW;

  // Effective "now" edge: bands and base color stop here.
  // Clamped to the visible range so historical periods are unaffected.
  const effectiveNow = nowTs != null
    ? Math.max(fromTs, Math.min(nowTs, toTs))
    : null;
  const bandEndTs = effectiveNow ?? toTs;
  const bandEndX = toX(bandEndTs);

  // Stack the two rows in the upper / lower thirds — leaves room
  // for the gridline + dot without crowding the band edges.
  const yOccupied = padTop + plotH * 0.28;
  const yVacant = padTop + plotH * 0.72;

  // ── Derived data ──────────────────────────────────────────
  // All three of these only depend on `points`, so memoising them
  // means a drag gesture (which fires `setActiveTs` on every
  // frame) doesn't re-run the sort + interval scan.
  const sorted = useMemo<ClassifiedPoint[]>(
    () =>
      [...points]
        .filter((p): p is LinePoint & { v: number } => p.v != null && Number.isFinite(p.v))
        .sort((a, b) => a.t - b.t)
        .map((p) => ({ t: p.t, occupied: p.v > 0 })),
    [points],
  );

  const intervals = useMemo<OccupiedInterval[]>(() => {
    const out: OccupiedInterval[] = [];
    let intStart: number | null = null;
    for (const p of sorted) {
      if (p.occupied && intStart === null) {
        intStart = p.t;
      } else if (!p.occupied && intStart !== null) {
        out.push({ from: intStart, to: p.t });
        intStart = null;
      }
    }
    if (intStart !== null && sorted.length > 0) {
      out.push({ from: intStart, to: bandEndTs });
    }
    // Hourly aggregates report pir_sum = 0 for the still-in-progress
    // current hour even when the sensor is occupied (no new trigger yet
    // this hour). This closes the occupied interval early and leaves a
    // green gap from the last complete hour to "now". When the caller
    // passes the live snapshot state, use it to extend the last known
    // occupied interval to bandEndTs.
    if (currentOccupied === true && effectiveNow != null && out.length > 0) {
      const last = out[out.length - 1]!;
      if (last.to < bandEndTs) {
        out[out.length - 1] = { from: last.from, to: bandEndTs };
      }
    }
    return out;
  }, [sorted, bandEndTs, currentOccupied, effectiveNow]);

  const transitions = useMemo<TransitionDot[]>(() => {
    const out: TransitionDot[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const cur = sorted[i]!;
      if (cur.occupied !== prev.occupied) {
        out.push({ t: cur.t, occupied: cur.occupied });
      }
    }
    return out;
  }, [sorted]);

  // X-axis tick labels — snapped to round boundaries.
  const maxXTicks = maxTicksForWidth(plotW);
  const { ticks: tickValues, format: xTickFormat } = useMemo(
    () => generateNiceTimeTicks(fromTs, toTs, maxXTicks, tz),
    [fromTs, toTs, maxXTicks, tz],
  );

  const xTickLabel = (t: number): string => {
    if (xTickFormat === 'time') return formatClock(t);
    if (xTickFormat === 'date') return formatDate(t);
    if (formatDateTime) return formatDateTime(t);
    return `${formatDate(t)} ${formatClock(t)}`;
  };

  const empty = sorted.length === 0;

  // ── Touch handling (sticky crosshair tooltip) ─────────────
  const [activeTs, setActiveTs] = useState<number | null>(null);
  const prevStateRef = useRef<boolean | null>(null);

  useEffect(() => {
    setActiveTs(null);
    prevStateRef.current = null;
  }, [points, fromTs, toTs]);

  const handleTouchRef = useRef<(localX: number) => void>(() => {});
  handleTouchRef.current = (localX: number) => {
    if (plotW <= 0) return;
    const ratio = (localX - padLeft) / plotW;
    const t = fromTs + ratio * tSpan;
    const clamped = Math.max(fromTs, Math.min(toTs, t));
    const st = stateAt(sorted, clamped);
    const occ = st?.occupied ?? null;
    if (prevStateRef.current !== occ) {
      haptic.select();
      prevStateRef.current = occ;
    }
    setActiveTs(clamped);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        haptic.light();
        handleTouchRef.current(e.nativeEvent.locationX);
      },
      onPanResponderMove: (e: GestureResponderEvent) => {
        handleTouchRef.current(e.nativeEvent.locationX);
      },
    }),
  ).current;

  const activeState = useMemo(
    () => (activeTs == null ? null : stateAt(sorted, activeTs)),
    [activeTs, sorted],
  );
  const activeX = activeTs == null ? null : toX(activeTs);

  return (
    <View>
      {/* Floating tooltip — follows the active X position */}
      {activeTs != null ? (() => {
        const tipWidth = 110;
        const tipX = toX(activeTs);
        const tipLeft = Math.max(4, Math.min(tipX - tipWidth / 2, width - tipWidth - 4));
        return (
          <View
            style={{
              position: 'absolute',
              top: -2,
              left: tipLeft,
              width: tipWidth,
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
              <Text
                style={{
                  color: activeState
                    ? activeState.occupied
                      ? colors.statusBad
                      : colors.statusGood
                    : colors.white,
                  fontSize: 12,
                  fontWeight: '700',
                  textAlign: 'center',
                }}
              >
                {activeState
                  ? activeState.occupied
                    ? occupiedLabel
                    : vacantLabel
                  : '—'}
              </Text>
              <Text
                style={{
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: 10,
                  textAlign: 'center',
                }}
              >
                {fmtDateTime(activeTs)}
              </Text>
            </View>
          </View>
        );
      })() : null}

      <View {...panResponder.panHandlers}>
        <Svg width={width} height={height}>
          {/* Light dusty-sage base — only up to "now" (or end of period). */}
          <Rect
            x={padLeft}
            y={padTop}
            width={Math.max(0, bandEndX - padLeft)}
            height={plotH}
            fill="rgba(108,158,131,0.10)"
          />

          {/* Red bands across every occupied interval, clipped at now. */}
          {intervals.map((iv, i) => {
            const clampedTo = Math.min(iv.to, bandEndTs);
            const x1 = Math.max(toX(iv.from), padLeft);
            const x2 = Math.min(toX(clampedTo), bandEndX);
            if (x2 <= x1) return null;
            return (
              <Rect
                key={`band-${i}`}
                x={x1}
                y={padTop}
                width={x2 - x1}
                height={plotH}
                fill="rgba(214,91,91,0.18)"
              />
            );
          })}

          {/* Vertical gridlines */}
          {tickValues.map((t, i) => {
            if (i === 0 || i === tickValues.length - 1) return null;
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

          {/* Row gridlines */}
          <Line
            x1={padLeft}
            x2={padLeft + plotW}
            y1={yOccupied}
            y2={yOccupied}
            stroke={colors.gray[300]}
            strokeWidth={0.5}
            strokeOpacity={0.4}
            strokeDasharray="2,3"
          />
          <Line
            x1={padLeft}
            x2={padLeft + plotW}
            y1={yVacant}
            y2={yVacant}
            stroke={colors.gray[300]}
            strokeWidth={0.5}
            strokeOpacity={0.4}
            strokeDasharray="2,3"
          />

          {/* Y-axis row labels. */}
          <SvgText
            x={padLeft - 6}
            y={yOccupied + 3}
            fontSize={10}
            fontWeight="600"
            fill={colors.statusBad}
            textAnchor="end"
          >
            {occupiedLabel}
          </SvgText>
          <SvgText
            x={padLeft - 6}
            y={yVacant + 3}
            fontSize={10}
            fontWeight="600"
            fill={colors.statusGood}
            textAnchor="end"
          >
            {vacantLabel}
          </SvgText>

          {/* Transition dots. */}
          {transitions.map((tr, i) => (
            <Circle
              key={`dot-${i}`}
              cx={toX(tr.t)}
              cy={tr.occupied ? yOccupied : yVacant}
              r={4}
              fill={tr.occupied ? colors.statusBad : colors.statusGood}
              stroke={colors.white}
              strokeWidth={1}
            />
          ))}

          {/* X-axis tick labels. */}
          {tickValues.map((t, i) => {
            const anchor: TextAnchor =
              i === 0 ? 'start' : i === tickValues.length - 1 ? 'end' : 'middle';
            return (
              <SvgText
                key={`xt-${i}`}
                x={toX(t)}
                y={padTop + plotH + 14}
                fontSize={9}
                fill={colors.gray[500]}
                textAnchor={anchor}
              >
                {xTickLabel(t)}
              </SvgText>
            );
          })}

          {/* "Now" marker — vertical line + status dot + label. */}
          {effectiveNow != null ? (() => {
            const nowX = toX(effectiveNow);
            const nowState = stateAt(sorted, effectiveNow);
            const nowOccupied = nowState?.occupied ?? false;
            const dotColor = nowOccupied ? colors.statusBad : colors.statusGood;
            const dotY = nowOccupied ? yOccupied : yVacant;
            return (
              <>
                <Line
                  x1={nowX}
                  x2={nowX}
                  y1={padTop}
                  y2={padTop + plotH}
                  stroke={colors.brandDark}
                  strokeWidth={1.5}
                  strokeOpacity={0.6}
                  strokeDasharray="4,3"
                />
                {nowState ? (
                  <Circle
                    cx={nowX}
                    cy={dotY}
                    r={5}
                    fill={dotColor}
                    stroke={colors.white}
                    strokeWidth={1.5}
                  />
                ) : null}
                <SvgText
                  x={nowX}
                  y={padTop - 4}
                  fontSize={9}
                  fontWeight="700"
                  fill={colors.brandDark}
                  textAnchor="middle"
                >
                  {nowLabel}
                </SvgText>
              </>
            );
          })() : null}

          {/* Crosshair + active state marker. Drawn last so it
              always sits on top of bands / dots / labels. */}
          {activeX != null ? (
            <>
              <Line
                x1={activeX}
                x2={activeX}
                y1={padTop}
                y2={padTop + plotH}
                stroke={colors.brandDark}
                strokeWidth={1}
                strokeOpacity={0.45}
              />
              {activeState ? (
                <Circle
                  cx={activeX}
                  cy={activeState.occupied ? yOccupied : yVacant}
                  r={6}
                  fill={activeState.occupied ? colors.statusBad : colors.statusGood}
                  stroke={colors.white}
                  strokeWidth={2}
                />
              ) : null}
            </>
          ) : null}
        </Svg>
      </View>

      {empty ? (
        <View
          style={{
            position: 'absolute',
            left: padLeft,
            right: padRight,
            top: padTop,
            height: plotH,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          pointerEvents="none"
        >
          <Text style={type.caption}>—</Text>
        </View>
      ) : null}
    </View>
  );
}

export default PresenceChart;
