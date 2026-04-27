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
import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StatusBar,
  Platform,
  useWindowDimensions,
} from 'react-native';
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
import {
  historyToPoints,
  rangeForAnchor,
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

const VALID_PARAMS: readonly Param[] = ['temp', 'hum', 'co2', 'voc', 'pir'] as const;
const VALID_PERIODS: readonly DetailPeriod[] = [
  'day',
  'week',
  'month',
  'year',
] as const;

export default function SensorGraphFullscreen() {
  const { t } = useTranslation();
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

  const { width: screenW, height: screenH } = useWindowDimensions();

  const sensorQuery = useSensor(id);
  const thresholdsQuery = useSensorThresholds(id);

  const dateRange = useMemo(() => rangeForAnchor(period, anchor), [period, anchor]);
  const useRaw = dateRange.useRaw;
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
    () => historyToPoints(historyData, activeParam),
    [historyData, activeParam],
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

  // Rotated container: pre-rotation it's (screenH × screenW). After
  // a 90° CCW rotation the rect visually covers (screenW × screenH)
  // — i.e. the full screen. Centering offsets keep the rect aligned
  // with the screen viewport.
  const rotatedLeft = (screenW - screenH) / 2;
  const rotatedTop = (screenH - screenW) / 2;

  // Layout budgets inside the rotated container. Keep margins tight
  // so the chart truly goes edge-to-edge.
  const PAD = spacing.md;
  const BUTTON_ROOM = 56; // reserved top strip for the close button
  const chartWidth = screenH - PAD * 2;
  const chartHeight = screenW - PAD * 2 - BUTTON_ROOM;

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
          width: screenH,
          height: screenW,
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
                  ? (historyError as Error)?.message ?? t('errors.unknown')
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
