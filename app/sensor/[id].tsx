// ══════════════════════════════════════════════════════════════
// Sensor detail — premium layout.
//
//  - Navy hero with a prominent "Tilbage" back-button, the
//    sensor's last-reading timestamp, and battery/signal chips.
//  - KPI tiles only rendered for parameters the sensor actually
//    reports. Tap a tile to plot that parameter in the graph.
//  - Chart plots the selected param with threshold-based
//    background bands (green / yellow / red) built from the
//    sensor's per-param thresholds, and can be paginated
//    back/forward in time (no future).
//  - The chart's default period is the last-used one (persisted
//    across app restarts). First-ever visit defaults to 1 week.
// ══════════════════════════════════════════════════════════════
import {
  View,
  Text,
  ScrollView,
  Pressable,
  useWindowDimensions,
  RefreshControl,
  StatusBar,
  Platform,
} from 'react-native';
import { useMemo, useState, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  startOfDay,
  isAfter,
  isSameDay,
} from 'date-fns';

import {
  SectionCard,
  SegmentedControl,
  LoadingIndicator,
  Icon,
  StatusDot,
  ErrorState,
  HeroBackButton,
  KpiTile,
} from '@/components';
import { colors, radius, spacing, type, toneColor } from '@/theme';
import {
  useSensor,
  useSensorHistoryRaw,
  useSensorHistoryHourly,
  useSensorThresholds,
  useSensorTypes,
  buildTypeParamsMap,
  sensorSupports,
} from '@/features/indeklima/hooks';
import { LineChart } from '@/features/indeklima/LineChart';
import {
  normalizeThresholds,
  buildZonesForParam,
  zoneForValue,
  hasThresholds,
  type ThresholdZone,
} from '@/features/indeklima/thresholds';
import {
  historyToPoints,
  rangeForAnchor,
  paramColor,
  unitForParam,
  ymd,
  stepAnchor,
  formatRangeLabel,
} from '@/features/indeklima/chartHelpers';
import type { StatusTone } from '@/theme';
import type { Sensor } from '@/services/api';
import { haptic } from '@/lib/haptics';
import { useDetailPrefsStore, type DetailPeriod } from '@/stores/detailPrefsStore';

type Param = 'temp' | 'hum' | 'co2' | 'voc' | 'pir';

const MONTHS_DA = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

function toneFromStatus(c: Sensor['statusColor']): StatusTone {
  if (c === 'green') return 'good';
  if (c === 'red') return 'bad';
  return 'neutral';
}

function isPresent(v: number | string | undefined): v is number | string {
  if (v == null || v === '-' || v === '') return false;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n);
}

function toNumber(v: number | string | undefined): number | null {
  if (!isPresent(v)) return null;
  return typeof v === 'number' ? v : Number(v);
}

function fmtNum(v: number | string | undefined, digits = 1): string {
  const n = toNumber(v);
  if (n == null) return '—';
  return n.toFixed(digits);
}

function formatFullDateTime(raw: string | undefined): string {
  if (!raw) return '—';
  // Short pre-formatted strings from the API (e.g. "17:33" today,
  // "21. nov" older). If it's a short time-of-day string, assume
  // today and render as "I dag kl. HH:MM" etc.
  if (raw.length <= 8) {
    if (/^\d{1,2}:\d{2}$/.test(raw)) {
      const now = new Date();
      return `${now.getDate()}. ${MONTHS_DA[now.getMonth()]} ${now.getFullYear()}, kl. ${raw}`;
    }
    return raw;
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()}. ${MONTHS_DA[d.getMonth()]} ${d.getFullYear()}, kl. ${hh}:${mm}`;
}


// ── Battery helpers ────────────────────────────────────────
// Backend ships battery as either 0–3 (mock) or millivolts (legacy).
// For display we quantise to 0 (empty) / 1 (low) / 2 (med) / 3 (full).
function batteryLevel(raw: number): 0 | 1 | 2 | 3 {
  if (!Number.isFinite(raw)) return 0;
  if (raw <= 10) {
    const n = Math.round(raw);
    return Math.max(0, Math.min(3, n)) as 0 | 1 | 2 | 3;
  }
  // Millivolts → percent, clamped to 0..1 then bucketed.
  const pct = (raw - 2300) / (3000 - 2300);
  if (pct <= 0.2) return 0;
  if (pct <= 0.4) return 1;
  if (pct <= 0.75) return 2;
  return 3;
}

const BATTERY_META = {
  0: { icon: 'battery-empty', tone: colors.statusBad,   label: 'Lavt' },
  1: { icon: 'battery-low',   tone: colors.statusWarn,  label: 'Lavt' },
  2: { icon: 'battery-medium', tone: colors.statusGood, label: 'Ok' },
  3: { icon: 'battery-high',   tone: colors.statusGood, label: 'Godt' },
} as const;

function signalLevel(raw: number): 0 | 1 | 2 | 3 | 4 {
  if (!Number.isFinite(raw) || raw === 0) return 0;
  if (raw > 0 && raw <= 4) return Math.round(raw) as 0 | 1 | 2 | 3 | 4;
  if (raw > -80) return 4;
  if (raw > -100) return 3;
  if (raw > -110) return 2;
  return 1;
}

function signalMeta(level: 0 | 1 | 2 | 3 | 4, t: (k: string) => string) {
  const cfg: Record<number, { icon: string; tone: string; label: string }> = {
    4: { icon: 'signal-4', tone: colors.statusGood, label: t('indeklima.sensor_detail.coverage.excellent') },
    3: { icon: 'signal-3', tone: colors.statusGood, label: t('indeklima.sensor_detail.coverage.good') },
    2: { icon: 'signal-2', tone: colors.statusWarn, label: t('indeklima.sensor_detail.coverage.medium') },
    1: { icon: 'signal-1', tone: colors.statusBad,  label: t('indeklima.sensor_detail.coverage.poor') },
    0: { icon: 'signal-0', tone: colors.gray[400],  label: t('indeklima.sensor_detail.coverage.none') },
  };
  return cfg[level] ?? cfg[0]!;
}

// ── Meta chip ──────────────────────────────────────────────
function MetaChip({ icon, tone, label }: { icon: string; tone: string; label: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: radius.full,
        backgroundColor: 'rgba(255,255,255,0.1)',
      }}
    >
      <Icon name={icon} color={tone} size={14} />
      <Text
        style={{
          color: colors.white,
          fontSize: 12,
          fontWeight: '600',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────
export default function SensorDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  // Keep the id as-is (string or numeric). `Number(idParam)` would
  // mangle UUID-style ids that some newer backends return, leading
  // to `NaN` lookups downstream — see the "Fejl" bug on v2 tenants.
  const id = useMemo<number | string | null>(() => {
    if (!idParam) return null;
    const trimmed = String(idParam).trim();
    if (!trimmed) return null;
    if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
    return trimmed;
  }, [idParam]);
  const { width } = useWindowDimensions();

  const lastPeriod = useDetailPrefsStore((s) => s.lastPeriod);
  const setLastPeriod = useDetailPrefsStore((s) => s.setLastPeriod);

  const [period, setPeriodLocal] = useState<DetailPeriod>(lastPeriod);
  const [param, setParam] = useState<Param | null>(null);
  const [anchor, setAnchor] = useState<Date>(() => startOfDay(new Date()));

  // Keep the Zustand store in sync with current selection.
  useEffect(() => {
    setLastPeriod(period);
  }, [period, setLastPeriod]);

  const {
    data: sensor,
    isWaiting: sensorWaiting,
    isError,
    error,
    refetch,
    isRefetching,
  } = useSensor(id);

  const thresholdsQuery = useSensorThresholds(id);
  const sensorTypesQuery = useSensorTypes();
  const typeMap = useMemo(
    () => buildTypeParamsMap(sensorTypesQuery.data),
    [sensorTypesQuery.data],
  );

  const today = useMemo(() => ymd(new Date()), []);
  const dateRange = useMemo(() => rangeForAnchor(period, anchor), [period, anchor]);
  const { useRaw } = dateRange;

  const raw = useSensorHistoryRaw(useRaw ? id : null, dateRange.from);
  const hourly = useSensorHistoryHourly(!useRaw ? id : null, dateRange.from, dateRange.to);

  const historyData = useRaw ? raw.data : hourly.data;
  const historyLoading = useRaw ? raw.isLoading : hourly.isLoading;
  const historyError = useRaw ? raw.error : hourly.error;

  const activeParam: Param = param ?? 'temp';
  const points = useMemo(
    () => historyToPoints(historyData, activeParam),
    [historyData, activeParam],
  );
  const normalizedThresholds = useMemo(
    () => normalizeThresholds(thresholdsQuery.data),
    [thresholdsQuery.data],
  );
  const chartZones = useMemo(
    () => buildZonesForParam(normalizedThresholds, activeParam),
    [normalizedThresholds, activeParam],
  );

  // Which params does this sensor expose?
  const availableParams = useMemo<Param[]>(() => {
    if (!sensor) return [];
    const all: Param[] = ['temp', 'hum', 'co2', 'voc', 'pir'];
    return all.filter((p) => {
      if (!sensorSupports(sensor.sensorType, p, typeMap)) return false;
      return isPresent(sensor[p]);
    });
  }, [sensor, typeMap]);

  // Default to the first available param the moment we have one.
  useEffect(() => {
    if (availableParams.length === 0) return;
    if (param == null || !availableParams.includes(param)) {
      setParam(availableParams[0]!);
    }
  }, [availableParams, param]);

  const canGoNext = !isSameDay(anchor, startOfDay(new Date()))
    && isAfter(startOfDay(new Date()), anchor);

  // ── Loading / empty guards ───────────────────────────────
  if (!sensor && sensorWaiting) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
        <HeaderShell title={t('common.loading')} onBack={() => router.back()} insetTop={insets.top} backLabel={t('common.back')} />
        <LoadingIndicator />
      </View>
    );
  }

  if (!sensor) {
    const apiMessage = isError ? (error as Error)?.message : undefined;
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
        <HeaderShell
          title={t('indeklima.sensor_detail.error_title')}
          onBack={() => router.back()}
          insetTop={insets.top}
          backLabel={t('common.back')}
        />
        <ErrorState
          title={t('indeklima.sensor_detail.error_title')}
          message={apiMessage ?? t('indeklima.sensor_detail.error_description')}
          actions={[
            {
              label: t('common.retry'),
              icon: 'arrow-clockwise',
              onPress: () => {
                haptic.medium();
                refetch();
              },
              variant: 'primary',
            },
            {
              label: t('common.back'),
              icon: 'chevron-left',
              onPress: () => {
                haptic.light();
                router.back();
              },
              variant: 'secondary',
            },
          ]}
        />
      </View>
    );
  }

  const tone = toneFromStatus(sensor.statusColor);
  const bat = batteryLevel(Number(sensor.battery));
  const batMeta = BATTERY_META[bat];
  const sig = signalLevel(Number(sensor.coverage));
  const sigMeta = signalMeta(sig, t);

  const unitFor = (p: Param) => unitForParam(sensor, p);

  const rangeLabel = formatRangeLabel(period, anchor, today);
  const fullMeasurementTime = formatFullDateTime(sensor.time);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      {Platform.OS === 'ios' ? <StatusBar barStyle="light-content" /> : null}

      {/* Navy hero */}
      <View style={{ backgroundColor: colors.navy, paddingTop: insets.top + spacing.xs, paddingBottom: spacing.lg }}>
        <View
          style={{
            paddingHorizontal: spacing.md,
            paddingTop: spacing.sm,
            flexDirection: 'row',
            alignItems: 'flex-start',
          }}
        >
          <HeroBackButton onPress={() => router.back()} label={t('common.back')} />
          <View style={{ flex: 1 }} />
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.08)',
              marginTop: 4,
            }}
          >
            <StatusDot tone={tone} size={10} />
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.md, marginTop: spacing.md, gap: 2 }}>
          <Text
            style={{
              color: colors.white,
              fontSize: 24,
              fontWeight: '700',
              letterSpacing: -0.4,
            }}
            numberOfLines={2}
          >
            {sensor.name}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginTop: spacing.sm,
            }}
          >
            <Icon name="clock" color="rgba(255,255,255,0.7)" size={12} />
            <Text
              style={{
                color: 'rgba(255,255,255,0.9)',
                fontSize: 12,
                fontWeight: '600',
              }}
              numberOfLines={1}
            >
              {t('indeklima.sensor_detail.measurement_at', { when: fullMeasurementTime })}
            </Text>
          </View>
        </View>

        <View
          style={{
            flexDirection: 'row',
            gap: spacing.xs,
            paddingHorizontal: spacing.md,
            marginTop: spacing.md,
          }}
        >
          <MetaChip icon={batMeta.icon} tone={batMeta.tone} label={batMeta.label} />
          <MetaChip icon={sigMeta.icon} tone={sigMeta.tone} label={sigMeta.label} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl + 40 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching || raw.isRefetching || hourly.isRefetching}
            onRefresh={refetch}
            tintColor={colors.navy}
          />
        }
      >
        {availableParams.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            {chunk(availableParams, 2).map((row, idx) => (
              <View key={idx} style={{ flexDirection: 'row', gap: spacing.sm }}>
                {row.map((p) => {
                  // Presence shows a label ("Optaget"/"Ledig")
                  // rather than a numeric reading.
                  const value =
                    p === 'pir'
                      ? (() => {
                          const n = toNumber(sensor[p]);
                          if (n == null) return '—';
                          return n > 0
                            ? t('indeklima.sensors.presence.occupied')
                            : t('indeklima.sensors.presence.vacant');
                        })()
                      : fmtNum(sensor[p], p === 'temp' ? 1 : 0);
                  // Threshold tint — mirrors the chart zone logic so
                  // the tile value colour matches the graph bands.
                  // Presence is binary, and params without configured
                  // thresholds fall back to the default text colour
                  // (no green/yellow/red would be misleading).
                  const valueColor = ((): string | undefined => {
                    if (p === 'pir') return undefined;
                    if (!hasThresholds(normalizedThresholds, p)) return undefined;
                    const zone: ThresholdZone = zoneForValue(
                      normalizedThresholds,
                      p,
                      toNumber(sensor[p]),
                    );
                    if (zone === 'red') return colors.statusBad;
                    if (zone === 'yellow') return colors.statusWarn;
                    return colors.statusGood;
                  })();
                  return (
                    <KpiTile
                      key={p}
                      label={t(`indeklima.sensor_detail.params.${p}`)}
                      value={value}
                      unit={unitFor(p)}
                      icon={paramIcon(p)}
                      iconColor={paramColor(p)}
                      valueColor={valueColor}
                      active={activeParam === p}
                      onPress={() => setParam(p)}
                    />
                  );
                })}
                {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
              </View>
            ))}
          </View>
        ) : null}

        {availableParams.length > 0 ? (
          <SectionCard
            title={t('indeklima.sensor_detail.history')}
            icon="graph-up"
            trailing={
              <Pressable
                onPress={() => {
                  haptic.light();
                  router.push({
                    pathname: '/sensor-graph',
                    params: {
                      id: String(id ?? ''),
                      param: activeParam,
                      period,
                      anchor: anchor.toISOString(),
                    },
                  });
                }}
                accessibilityRole="button"
                accessibilityLabel={t('indeklima.sensor_detail.open_fullscreen')}
                hitSlop={8}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.7 : 1,
                  padding: 4,
                  marginRight: -4,
                })}
              >
                <Icon name="fullscreen" color={colors.gray[500]} size={18} />
              </Pressable>
            }
          >
            <View style={{ gap: spacing.sm }}>
              <SegmentedControl
                value={period}
                onChange={(p) => {
                  haptic.select();
                  setPeriodLocal(p);
                  // Reset anchor when switching periods so we jump back to "now".
                  setAnchor(startOfDay(new Date()));
                }}
                options={[
                  { id: 'day',   label: t('indeklima.sensor_detail.period.day') },
                  { id: 'week',  label: t('indeklima.sensor_detail.period.week') },
                  { id: 'month', label: t('indeklima.sensor_detail.period.month') },
                  { id: 'year',  label: t('indeklima.sensor_detail.period.year') },
                ]}
                ariaLabel={t('indeklima.sensor_detail.history')}
              />

              {/* Prev / range-label / next */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 4,
                }}
              >
                <ChartNavButton
                  icon="chevron-left"
                  label={t('indeklima.sensor_detail.prev_period')}
                  onPress={() => {
                    haptic.light();
                    setAnchor((a) => stepAnchor(period, a, -1));
                  }}
                />
                <Text
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    fontSize: 13,
                    fontWeight: '700',
                    color: colors.brandDark,
                    letterSpacing: -0.1,
                  }}
                  numberOfLines={1}
                >
                  {rangeLabel}
                </Text>
                <ChartNavButton
                  icon="chevron-right"
                  label={t('indeklima.sensor_detail.next_period')}
                  disabled={!canGoNext}
                  onPress={() => {
                    if (!canGoNext) return;
                    haptic.light();
                    const next = stepAnchor(period, anchor, +1);
                    const todayStart = startOfDay(new Date());
                    setAnchor(isAfter(next, todayStart) ? todayStart : next);
                  }}
                />
              </View>

              {historyLoading ? (
                <LoadingIndicator inline />
              ) : points.length < 2 ? (
                <View
                  style={{
                    padding: spacing.lg,
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Icon name="graph-up" color={colors.gray[300]} size={24} />
                  <Text style={[type.caption, { textAlign: 'center' }]}>
                    {historyError
                      ? (historyError as Error)?.message ?? t('errors.unknown')
                      : t('indeklima.sensor_detail.no_history')}
                  </Text>
                </View>
              ) : (
                <LineChart
                  points={points}
                  width={width - spacing.md * 2 - spacing.md * 2}
                  unit={unitFor(activeParam)}
                  stroke={paramColor(activeParam)}
                  zones={chartZones}
                />
              )}
            </View>
          </SectionCard>
        ) : null}
      </ScrollView>
    </View>
  );
}

// ── Helper components ─────────────────────────────────────
function ChartNavButton({
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
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: disabled
          ? colors.gray[100]
          : pressed
            ? colors.gray[200]
            : colors.white,
        borderWidth: 1,
        borderColor: disabled ? colors.gray[100] : colors.gray[200],
        opacity: disabled ? 0.5 : 1,
      })}
    >
      <Icon name={icon} color={disabled ? colors.gray[300] : colors.brandDark} size={18} />
    </Pressable>
  );
}

function HeaderShell({
  title,
  onBack,
  insetTop,
  backLabel,
}: {
  title: string;
  onBack: () => void;
  insetTop: number;
  backLabel: string;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.navy,
        paddingTop: insetTop + spacing.xs,
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
      }}
    >
      {Platform.OS === 'ios' ? <StatusBar barStyle="light-content" /> : null}
      <HeroBackButton onPress={onBack} label={backLabel} />
      <Text
        style={{
          flex: 1,
          color: colors.white,
          fontSize: 18,
          fontWeight: '700',
          textAlign: 'right',
        }}
        numberOfLines={1}
      >
        {title}
      </Text>
    </View>
  );
}

// ── Misc helpers ──────────────────────────────────────────
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function paramIcon(p: Param): string {
  switch (p) {
    case 'temp': return 'thermometer-half';
    case 'hum': return 'droplet';
    case 'co2': return 'cloud';
    case 'voc': return 'wind';
    case 'pir': return 'person';
  }
}

// Silence the unused-var warning on toneColor import (kept for
// potential status-color computations added downstream).
void toneColor;
