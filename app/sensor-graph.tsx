// ══════════════════════════════════════════════════════════════
// Sensor graph — landscape fullscreen viewer.
//
// Renders the same sensor/parameter/period the detail page was
// showing, but in a rotated container that fills the screen
// edge-to-edge. The app stays in portrait (no native orientation
// change needed) — the user simply tilts the phone sideways to
// view naturally.
//
// Initial state is seeded from query params so deep-linking is
// trivial:
//   /sensor-graph?id=123&param=temp&period=week&anchor=2026-04-24
//
// Once on the page, left/right chevrons step the anchor one
// period at a time (clamped to today, matching the detail page).
// ══════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StatusBar,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { isAfter, isSameDay, startOfDay } from 'date-fns';

import { Icon, LoadingIndicator } from '@/components';
import { colors, spacing, radius, type } from '@/theme';
import {
  useSensor,
  useSensorHistoryRaw,
  useSensorHistoryHourly,
  useSensorThresholds,
} from '@/features/indeklima/hooks';
import { LineChart } from '@/features/indeklima/LineChart';
import { PresenceChart } from '@/features/indeklima/PresenceChart';
import {
  historyToPoints,
  rangeForAnchor,
  rangeToTimestamps,
  paramColor,
  unitForParam,
  stepAnchor,
  formatRangeLabel,
  ymd,
} from '@/features/indeklima/chartHelpers';
import {
  normalizeThresholds,
  buildZonesForParam,
  type Param,
} from '@/features/indeklima/thresholds';
import type { DetailPeriod } from '@/stores/detailPrefsStore';
import { haptic } from '@/lib/haptics';
import { friendlyApiErrorMessage } from '@/lib/apiErrorMessage';
import { useTenantTime } from '@/hooks/useTenantTime';
import { useDeviceOrientation } from '@/hooks/useDeviceOrientation';

const VALID_PARAMS: readonly Param[] = ['temp', 'hum', 'co2', 'voc', 'sound', 'light', 'pir'] as const;
const VALID_PERIODS: readonly DetailPeriod[] = [
  'day',
  'week',
  'month',
  'quarter',
] as const;

export default function SensorGraphFullscreen() {
  const { t } = useTranslation();
  const tt = useTenantTime();
  const router = useRouter();
  const raw = useLocalSearchParams<{
    id?: string;
    param?: string;
    period?: string;
    anchor?: string;
  }>();

  const id = raw.id ?? '';
  const activeParam: Param = VALID_PARAMS.includes(raw.param as Param)
    ? (raw.param as Param)
    : 'temp';
  const period: DetailPeriod = VALID_PERIODS.includes(raw.period as DetailPeriod)
    ? (raw.period as DetailPeriod)
    : 'week';

  // Seed the anchor from the query param (if any) and fall back to
  // today. After the initial render it's fully controlled locally —
  // url is not rewritten so back still returns to the detail view.
  const [anchor, setAnchor] = useState<Date>(() =>
    raw.anchor ? new Date(raw.anchor) : startOfDay(new Date()),
  );

  const today = useMemo(() => ymd(new Date()), []);
  const canGoNext = useMemo(
    () =>
      !isSameDay(anchor, startOfDay(new Date()))
        && isAfter(startOfDay(new Date()), anchor),
    [anchor],
  );

  const goPrev = useCallback(() => {
    haptic.light();
    setAnchor((a) => stepAnchor(period, a, -1));
  }, [period]);

  const goNext = useCallback(() => {
    if (!canGoNext) return;
    haptic.light();
    setAnchor((a) => {
      const next = stepAnchor(period, a, +1);
      const todayStart = startOfDay(new Date());
      return isAfter(next, todayStart) ? todayStart : next;
    });
  }, [canGoNext, period]);

  // Auto-return to detail page when tilted back to portrait.
  // A short mount grace period prevents an immediate back-nav
  // if the phone hasn't settled into landscape yet.
  const devicePosture = useDeviceOrientation(true);
  const mountedAtRef = useRef(Date.now());

  useEffect(() => {
    if (devicePosture !== 'portrait') return;
    if (Date.now() - mountedAtRef.current < 800) return;
    router.back();
  }, [devicePosture, router]);

  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const sensorQuery = useSensor(id);
  const thresholdsQuery = useSensorThresholds(id);

  const dateRange = useMemo(() => rangeForAnchor(period, anchor), [period, anchor]);
  const useRaw = dateRange.useRaw;
  const presenceBounds = useMemo(
    () => rangeToTimestamps(dateRange.from, dateRange.to, tt.tz),
    [dateRange.from, dateRange.to, tt.tz],
  );
  const rawHistory = useSensorHistoryRaw(useRaw ? id : null, dateRange.from);
  const hourlyHistory = useSensorHistoryHourly(
    !useRaw ? id : null,
    dateRange.from,
    dateRange.to,
  );

  const historyData = useRaw ? rawHistory.data : hourlyHistory.data;
  const historyLoading = useRaw ? rawHistory.isLoading : hourlyHistory.isLoading;
  const historyError = useRaw ? rawHistory.error : hourlyHistory.error;

  const points = useMemo(
    () => historyToPoints(historyData, activeParam, tt.tz),
    [historyData, activeParam, tt.tz],
  );
  const zones = useMemo(
    () =>
      buildZonesForParam(
        normalizeThresholds(thresholdsQuery.data),
        activeParam,
      ),
    [thresholdsQuery.data, activeParam],
  );

  const rangeLabel = useMemo(
    () => formatRangeLabel(period, anchor, today),
    [period, anchor, today],
  );

  const close = () => {
    haptic.light();
    router.back();
  };

  // Rounded display corners (iPhone 15/16 Pro etc.) clip text and
  // buttons rendered right at the screen edge — `useSafeAreaInsets`
  // only covers the Dynamic Island / home indicator, not the corner
  // radius. CORNER_PAD is the additional clearance we keep from
  // every edge so labels in the corners (e.g. the sensor name in
  // the bottom-left of the rotated layout) stay fully visible.
  const CORNER_PAD = 16;

  // The visible rect we want the rotated content to occupy in real
  // screen coordinates: the full window minus iOS safe-area insets
  // and our extra corner clearance on all four sides.
  const vx = insets.left + CORNER_PAD;
  const vy = insets.top + CORNER_PAD;
  const vw = screenW - insets.left - insets.right - CORNER_PAD * 2;
  const vh = screenH - insets.top - insets.bottom - CORNER_PAD * 2;

  // Rotated container: pre-rotation rect has dimensions swapped
  // (90° rotation around its centre), then offset so its centre
  // lines up with the centre of the visible rect. The result is
  // that after `rotate(-90deg)` the rect visually fills exactly
  // the visible rect — never the rounded corners.
  const rotW = vh;
  const rotH = vw;
  const rotatedLeft = vx + vw / 2 - rotW / 2;
  const rotatedTop = vy + vh / 2 - rotH / 2;

  // Layout budgets inside the rotated container. Keep margins tight
  // so the chart goes as close to edge-to-edge as the safe area
  // allows.
  const PAD = spacing.md;
  const BUTTON_ROOM = 56; // reserved top strip for the close button
  const chartWidth = rotW - PAD * 2;
  const chartHeight = rotH - PAD * 2 - BUTTON_ROOM;

  const unit = unitForParam(sensorQuery.data, activeParam);
  const stroke = paramColor(activeParam);

  const sensorName = sensorQuery.data?.name ?? '';

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.navy,
        overflow: 'hidden',
      }}
    >
      {Platform.OS === 'ios' ? (
        <StatusBar hidden />
      ) : (
        <StatusBar hidden backgroundColor={colors.navy} />
      )}

      <View
        style={{
          position: 'absolute',
          top: rotatedTop,
          left: rotatedLeft,
          width: rotW,
          height: rotH,
          transform: [{ rotate: '-90deg' }],
          padding: PAD,
        }}
      >
        {/* Top row — sensor name, range nav (prev / label / next), close */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            height: BUTTON_ROOM - spacing.sm,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            {sensorName ? (
              <Text
                style={{
                  color: colors.white,
                  fontSize: 16,
                  fontWeight: '700',
                  letterSpacing: -0.2,
                }}
                numberOfLines={1}
              >
                {sensorName}
              </Text>
            ) : null}
            <Text
              style={{
                color: 'rgba(255,255,255,0.6)',
                fontSize: 12,
                marginTop: 2,
              }}
              numberOfLines={1}
            >
              {t(`indeklima.sensor_detail.period.${period}`)} ·{' '}
              {t(`indeklima.sensor_detail.params.${activeParam}`)}
            </Text>
          </View>

          {/* Anchor navigation */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              paddingHorizontal: spacing.sm,
              paddingVertical: 4,
              backgroundColor: 'rgba(255,255,255,0.08)',
              borderRadius: radius.full,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.15)',
            }}
          >
            <NavButton
              icon="chevron-left"
              label={t('indeklima.sensor_detail.prev_period')}
              onPress={goPrev}
            />
            <Text
              style={{
                minWidth: 120,
                textAlign: 'center',
                color: colors.white,
                fontSize: 13,
                fontWeight: '700',
                letterSpacing: -0.1,
              }}
              numberOfLines={1}
            >
              {rangeLabel}
            </Text>
            <NavButton
              icon="chevron-right"
              label={t('indeklima.sensor_detail.next_period')}
              disabled={!canGoNext}
              onPress={goNext}
            />
          </View>

          <Pressable
            onPress={close}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            style={({ pressed }) => ({
              opacity: pressed ? 0.8 : 1,
              transform: [{ scale: pressed ? 0.96 : 1 }],
            })}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255,255,255,0.12)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.25)',
              }}
            >
              <Icon name="fullscreen-exit" color={colors.white} size={20} />
            </View>
          </Pressable>
        </View>

        {/* Chart body */}
        <View style={{ flex: 1, justifyContent: 'center' }}>
          {historyLoading ? (
            <LoadingIndicator />
          ) : activeParam === 'pir' ? (
            points.length < 1 ? (
              <View
                style={{
                  alignItems: 'center',
                  gap: 6,
                  padding: spacing.lg,
                }}
              >
                <Icon name="motion-sensor" color="rgba(255,255,255,0.4)" size={28} />
                <Text
                  style={[
                    type.caption,
                    { color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
                  ]}
                >
                  {historyError
                    ? friendlyApiErrorMessage(historyError, t)
                    : t('indeklima.sensor_detail.no_history')}
                </Text>
              </View>
            ) : (
              <View
                style={{
                  backgroundColor: colors.white,
                  borderRadius: radius.lg,
                  padding: spacing.md,
                }}
              >
                <PresenceChart
                  points={points}
                  width={chartWidth - spacing.md * 2}
                  height={chartHeight - spacing.md * 2}
                  fromTs={presenceBounds.fromTs}
                  toTs={presenceBounds.toTs}
                  occupiedLabel={t('indeklima.sensors.presence.occupied')}
                  vacantLabel={t('indeklima.sensors.presence.vacant')}
                  formatClock={(ms) => tt.formatTime(new Date(ms))}
                  formatDate={(ms) => tt.formatMonthDay(new Date(ms))}
                />
              </View>
            )
          ) : points.length < 2 ? (
            <View
              style={{
                alignItems: 'center',
                gap: 6,
                padding: spacing.lg,
              }}
            >
              <Icon name="graph-up" color="rgba(255,255,255,0.4)" size={28} />
              <Text
                style={[
                  type.caption,
                  { color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
                ]}
              >
                {historyError
                  ? friendlyApiErrorMessage(historyError, t)
                  : t('indeklima.sensor_detail.no_history')}
              </Text>
            </View>
          ) : (
            <View
              style={{
                backgroundColor: colors.white,
                borderRadius: radius.lg,
                padding: spacing.md,
              }}
            >
              <LineChart
                points={points}
                width={chartWidth - spacing.md * 2}
                height={chartHeight - spacing.md * 2}
                unit={unit}
                stroke={stroke}
                zones={zones}
                smooth={period !== 'day'}
                formatTimestamp={(ms) => tt.formatMonthDayTime(new Date(ms))}
                formatAxisLabel={(ms) => tt.formatMonthDayTime(new Date(ms))}
              />
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────

// Compact navigation chevron sized to live inside the top-row pill.
// The inner <View> carries the visual styling so the Pressable
// rendering quirk (see .cursorrules) can't eat the background.
function NavButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: string;
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => ({
        opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
      })}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255,255,255,0.06)',
        }}
      >
        <Icon
          name={icon}
          color={disabled ? 'rgba(255,255,255,0.5)' : colors.white}
          size={16}
        />
      </View>
    </Pressable>
  );
}
