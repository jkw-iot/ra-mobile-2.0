// ══════════════════════════════════════════════════════════════
// Sensor detail — premium layout.
//
//  - Navy hero with a "Tilbage" pill back-button on the left and
//    the sensor name on the right (row 1), followed by a
//    measurement timestamp (row 2) and a composite status strip
//    (row 3) showing scenario name + battery + coverage icons.
//    Tapping the strip opens a single SensorInfoSheet bottom-sheet
//    combining scenario details, battery level, and coverage info.
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
import { useMemo, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
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
  ErrorState,
  HeroBackButton,
  KpiTile,
} from '@/components';
import type { StatusBarZone } from '@/components';
import { colors, spacing, type, toneColor } from '@/theme';
import {
  useSensor,
  useSensorHistoryRaw,
  useSensorHistoryHourly,
  useSensorThresholds,
  useSensorTypes,
  useMoldZones,
  useEffectiveScenario,
  usePirSince,
  buildTypeParamsMap,
  sensorSupports,
} from '@/features/indeklima/hooks';
import { LineChart } from '@/features/indeklima/LineChart';
import { PresenceChart } from '@/features/indeklima/PresenceChart';
import {
  OutdoorWeatherTile,
  useOutdoorAnchor,
} from '@/features/indeklima/OutdoorWeatherCard';
import { SensorInfoSheet } from '@/features/indeklima/SensorInfoSheet';
import { VttScaleCard } from '@/features/indeklima/VttScaleCard';
import { findScenarioById } from '@/features/indeklima/scenarios';
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
  rangeToTimestamps,
  paramColor,
  unitForParam,
  ymd,
  stepAnchor,
  formatRangeLabel,
} from '@/features/indeklima/chartHelpers';
import { haptic } from '@/lib/haptics';
import { friendlyApiErrorMessage } from '@/lib/apiErrorMessage';
import { useDetailPrefsStore, type DetailPeriod } from '@/stores/detailPrefsStore';
import { useTenantTime } from '@/hooks/useTenantTime';
import type { TenantTime } from '@/lib/datetime';

type Param = 'temp' | 'hum' | 'co2' | 'voc' | 'sound' | 'light' | 'pir' | 'vtt';

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

/**
 * Full "last measured" stamp for the hero, rendered in the tenant's
 * timezone via the shared time model (fixes the device-tz shift that
 * `new Date(raw)` introduced).
 *
 * Short pre-formatted tokens from the API ("17:33" today, "21. nov"
 * older) can't be reparsed reliably; a bare time-of-day is shown as
 * "<today>, kl. HH:MM", anything else verbatim.
 */
function parseMeasurementEpoch(raw: string | undefined, tt: TenantTime): number | null {
  if (!raw) return null;
  if (raw.length <= 8 && /^\d{1,2}:\d{2}$/.test(raw)) {
    const todayYmd = ymd(new Date());
    const d = tt.parseLegacy(`${todayYmd}T${raw}:00`);
    return d?.getTime() ?? null;
  }
  return tt.parseLegacy(raw)?.getTime() ?? null;
}

function formatMeasurementStamp(raw: string | undefined, tt: TenantTime): string {
  if (!raw) return '—';
  if (raw.length <= 8) {
    if (/^\d{1,2}:\d{2}$/.test(raw)) {
      return `${tt.formatMonthDayYear(new Date())}, kl. ${raw}`;
    }
    return raw;
  }
  const d = tt.parseLegacy(raw);
  if (!d) return raw;
  return tt.formatDateTime(d);
}


// ── Battery helpers ────────────────────────────────────────
// Mirrors `deriveBatteryLevel()` from the web app
// (server/utils/sensorBattery.js) exactly.
//
// DT/Efento sensors report 1–100 (percent); legacy A-series
// report mV (typically 2200–3300). Detect by range.
function batteryLevel(raw: number): 0 | 1 | 2 | 3 {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  if (raw <= 100) return raw > 50 ? 3 : raw > 20 ? 2 : 1;
  if (raw > 2800) return 3;
  if (raw >= 2600) return 2;
  return 1;
}

const NON_REPLACEABLE_BATTERY_TYPES: ReadonlySet<string> = new Set([
  'air-temperature',
  'space-desk',
  'space-button',
]);

type BatteryKey = 'empty' | 'low' | 'medium' | 'high';
const BATTERY_META: Record<0 | 1 | 2 | 3, { icon: string; tone: string; key: BatteryKey }> = {
  0: { icon: 'battery-empty',  tone: colors.statusBad,  key: 'empty' },
  1: { icon: 'battery-low',    tone: colors.statusBad,  key: 'low' },
  2: { icon: 'battery-medium', tone: colors.statusWarn, key: 'medium' },
  3: { icon: 'battery-high',   tone: colors.statusGood, key: 'high' },
};

function signalLevel(raw: number): 0 | 1 | 2 | 3 | 4 {
  if (!Number.isFinite(raw) || raw === 0) return 0;
  if (raw > 0 && raw <= 4) return Math.round(raw) as 0 | 1 | 2 | 3 | 4;
  if (raw > -80) return 4;
  if (raw > -100) return 3;
  if (raw > -110) return 2;
  return 1;
}

type CoverageKey = 'excellent' | 'good' | 'medium' | 'poor' | 'none';
const COVERAGE_META: Record<0 | 1 | 2 | 3 | 4, { icon: string; tone: string; key: CoverageKey }> = {
  4: { icon: 'signal-4', tone: colors.statusGood, key: 'excellent' },
  3: { icon: 'signal-3', tone: colors.statusGood, key: 'good' },
  2: { icon: 'signal-2', tone: colors.statusWarn, key: 'medium' },
  1: { icon: 'signal-1', tone: colors.statusBad,  key: 'poor' },
  0: { icon: 'signal-0', tone: colors.gray[400],  key: 'none' },
};

// ── Screen ─────────────────────────────────────────────────
export default function SensorDetailScreen() {
  const { t } = useTranslation();
  const tt = useTenantTime();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { id: idParam, param: paramParam } = useLocalSearchParams<{
    id: string;
    /**
     * Optional param hint passed by the sensor list when the user
     * tapped a card while filtering on a specific metric — see
     * `app/(tabs)/index.tsx`. We use it as the initial selection
     * if the sensor actually reports that param, falling back to
     * its first available param otherwise (handled below).
     */
    param?: string;
  }>();
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

  // Hint coming from the list screen, e.g. ?param=hum. Validated
  // against the Param union here so a malformed deep-link can't
  // poison `param` state.
  const initialParamHint = useMemo<Param | null>(() => {
    const v = typeof paramParam === 'string' ? paramParam : null;
    if (v === 'temp' || v === 'hum' || v === 'co2' || v === 'voc' || v === 'sound' || v === 'light' || v === 'pir' || v === 'vtt') {
      return v;
    }
    return null;
  }, [paramParam]);

  const [period, setPeriodLocal] = useState<DetailPeriod>(lastPeriod);
  const [param, setParam] = useState<Param | null>(initialParamHint);
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
  const { moldIndexMap } = useMoldZones();
  const typeMap = useMemo(
    () => buildTypeParamsMap(sensorTypesQuery.data),
    [sensorTypesQuery.data],
  );

  const today = useMemo(() => ymd(new Date()), []);

  // PIR "since" — always called before early-return guards to preserve
  // hook call order. Shares the day-view cache when period === 'day'.
  const pirSinceMs = usePirSince(id, today, sensor?.pir);

  const dateRange = useMemo(() => rangeForAnchor(period, anchor), [period, anchor]);
  const { useRaw } = dateRange;

  // Inclusive ms bounds of the selected period. The presence
  // chart uses these to span the whole window even when readings
  // only fall inside part of it (e.g. sensor offline overnight).
  const presenceBounds = useMemo(
    () => rangeToTimestamps(dateRange.from, dateRange.to, tt.tz),
    [dateRange.from, dateRange.to, tt.tz],
  );

  const activeParam: Param = param ?? 'temp';
  const isVttParam = activeParam === 'vtt';

  const raw = useSensorHistoryRaw(useRaw && !isVttParam ? id : null, dateRange.from);
  const hourly = useSensorHistoryHourly(!useRaw && !isVttParam ? id : null, dateRange.from, dateRange.to);

  const historyData = useRaw ? raw.data : hourly.data;
  const historyLoading = useRaw ? raw.isLoading : hourly.isLoading;
  const historyError = useRaw ? raw.error : hourly.error;

  const points = useMemo(
    () => isVttParam ? [] : historyToPoints(historyData, activeParam, tt.tz),
    [historyData, activeParam, tt.tz, isVttParam],
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
  const sensorMoldZone = useMemo(() => {
    if (!sensor) return undefined;
    return moldIndexMap.get(String(sensor.id));
  }, [sensor, moldIndexMap]);

  const availableParams = useMemo<Param[]>(() => {
    if (!sensor) return [];
    type SensorParam = Exclude<Param, 'vtt'>;
    const all: SensorParam[] = ['temp', 'hum', 'co2', 'voc', 'sound', 'light', 'pir'];
    const result: Param[] = all.filter((p) => {
      if (!sensorSupports(sensor.sensorType, p, typeMap)) return false;
      return isPresent(sensor[p]);
    });
    if (sensorMoldZone) result.push('vtt');
    return result;
  }, [sensor, typeMap, sensorMoldZone]);

  // Default to the first available param the moment we have one.
  useEffect(() => {
    if (availableParams.length === 0) return;
    if (param == null || !availableParams.includes(param)) {
      setParam(availableParams[0]!);
    }
  }, [availableParams, param]);

  // Whether the outdoor weather tile is renderable for this
  // sensor — needs SOME usable position. Computed up here so the
  // hook order stays stable across the early-return guards below.
  const outdoorAnchor = useOutdoorAnchor(sensor);
  const showOutdoorTile = outdoorAnchor != null;

  // Effective scenario (sensor -> location -> global). Used in
  // the composite status strip to show the scenario name and
  // passed to SensorInfoSheet for full details.
  const effectiveScenario = useEffectiveScenario(sensor);
  const showScenarioRow =
    !effectiveScenario.isLoading && effectiveScenario.data != null;

  const canGoNext = !isSameDay(anchor, startOfDay(new Date()))
    && isAfter(startOfDay(new Date()), anchor);

  const onRefresh = useCallback(() => {
    refetch();
    queryClient.invalidateQueries({
      queryKey: ['indeklima', 'scope-thresholds'],
    });
  }, [refetch, queryClient]);

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
    const apiMessage = isError ? friendlyApiErrorMessage(error, t) : undefined;
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

  const bat = batteryLevel(Number(sensor.battery));
  const batMeta = BATTERY_META[bat];
  const sig = signalLevel(Number(sensor.coverage));
  const sigMeta = COVERAGE_META[sig];
  const batLabel = t(`indeklima.sensor_detail.battery.level.${batMeta.key}`);
  const sigLabel = t(`indeklima.sensor_detail.coverage.${sigMeta.key}`);

  const [infoSheetOpen, setInfoSheetOpen] = useState(false);

  const rawBattery = Number(sensor.battery);
  const isPctBattery = Number.isFinite(rawBattery) && rawBattery > 0 && rawBattery <= 100;
  const batteryDisplay = isPctBattery ? `${rawBattery}%` : `${rawBattery} mV`;
  const batteryScaleLabel = isPctBattery ? '20% · 50%' : '2600 · 2800 mV';
  const batteryBarZones: StatusBarZone[] = [
    { key: 'low',    color: colors.statusBad,  active: bat <= 1 },
    { key: 'medium', color: colors.statusWarn, active: bat === 2 },
    { key: 'good',   color: colors.statusGood, active: bat === 3 },
  ];

  const rawCoverage = Number(sensor.coverage);
  const coverageDisplay = Number.isFinite(rawCoverage) && rawCoverage !== 0
    ? `${rawCoverage} dBm` : '—';
  const coverageBarZones: StatusBarZone[] = [
    { key: 'poor',      color: colors.statusBad,  active: sig === 1 },
    { key: 'medium',    color: colors.statusWarn, active: sig === 2 },
    { key: 'good',      color: colors.statusGood, active: sig === 3 },
    { key: 'excellent', color: colors.statusGood, active: sig === 4 },
  ];

  const unitFor = (p: Param) => unitForParam(sensor, p);

  const rangeLabel = formatRangeLabel(period, anchor, today);
  const fullMeasurementTime = formatMeasurementStamp(sensor.time, tt);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      {Platform.OS === 'ios' ? <StatusBar barStyle="light-content" /> : null}

      {/* Navy hero */}
      <View
        style={{
          backgroundColor: colors.navy,
          paddingTop: insets.top + spacing.xs,
          paddingBottom: spacing.sm,
        }}
      >
        {/* Row 1: back button + sensor name */}
        <View
          style={{
            paddingHorizontal: spacing.md,
            paddingTop: spacing.sm,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
          }}
        >
          <HeroBackButton onPress={() => router.back()} label={t('common.back')} />
          <Text
            style={{
              flex: 1,
              color: colors.white,
              fontSize: 19,
              fontWeight: '700',
              letterSpacing: -0.3,
              textAlign: 'right',
            }}
            numberOfLines={2}
          >
            {sensor.name}
          </Text>
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
          <Icon name="clock" color="rgba(255,255,255,0.7)" size={12} />
          <Text
            style={{
              flex: 1,
              color: 'rgba(255,255,255,0.9)',
              fontSize: 12,
              fontWeight: '600',
            }}
            numberOfLines={1}
          >
            {t('indeklima.sensor_detail.measurement_at', { when: fullMeasurementTime })}
          </Text>
        </View>

        {/* Row 3: composite status strip — scenario + battery + coverage.
            Always rendered. Tapping opens the combined SensorInfoSheet. */}
        <Pressable
          onPress={() => {
            haptic.light();
            setInfoSheetOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={t('indeklima.sensor_detail.sensor_info_title')}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: spacing.md,
              marginTop: 2,
              minHeight: 24,
            }}
          >
            {showScenarioRow && effectiveScenario.data ? (() => {
              const meta = findScenarioById(effectiveScenario.data.scenarioId);
              const name = meta
                ? t(`indeklima.scenarios.${meta.labelKey}`)
                : effectiveScenario.data.scenarioId;
              return (
                <>
                  <Icon name="sliders" color="rgba(255,255,255,0.7)" size={13} />
                  <Text
                    style={{
                      color: 'rgba(255,255,255,0.9)',
                      fontSize: 13,
                      fontWeight: '600',
                      flexShrink: 1,
                    }}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {name}
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>·</Text>
                </>
              );
            })() : null}
            <Icon name={batMeta.icon} color={batMeta.tone} size={14} />
            <Icon name={sigMeta.icon} color={sigMeta.tone} size={14} />
            <Icon name="chevron-right" color="rgba(255,255,255,0.8)" size={14} />
          </View>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.xs,
          paddingTop: spacing.md,
          paddingBottom: spacing.xl + 40,
          gap: spacing.md,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching || raw.isRefetching || hourly.isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.navy}
          />
        }
      >
        {(() => {
          // Build a single ordered list of tile elements (param
          // KPI tiles + optional outdoor-weather tile) and then
          // chunk it into 2-up rows. This keeps the outdoor tile
          // visually identical to the rest of the grid — it just
          // takes the next available slot, including the trailing
          // spacer when the param count is odd.
          const tiles: ReactNode[] = availableParams.map((p) => {
            if (p === 'vtt' && sensorMoldZone) {
              const vttValue = sensorMoldZone.mouldIndex.toFixed(1);
              const vttColor =
                sensorMoldZone.status === 'visual_growth' ? colors.statusBad
                : sensorMoldZone.status === 'microscopic' ? colors.statusWarn
                : colors.statusGood;
              return (
                <KpiTile
                  key={p}
                  label={t('indeklima.sensor_detail.params.vtt')}
                  value={vttValue}
                  unit="M"
                  icon={paramIcon(p)}
                  iconColor={paramColor(p)}
                  valueColor={vttColor}
                  active={activeParam === p}
                  onPress={() => setParam(p)}
                />
              );
            }
            const sp = p as Exclude<Param, 'vtt'>;
            const isPir = sp === 'pir';
            const pirOccupied = isPir ? (toNumber(sensor[sp]) ?? 0) > 0 : false;
            const value =
              isPir
                ? (() => {
                    const n = toNumber(sensor[sp]);
                    if (n == null) return '—';
                    return n > 0
                      ? t('indeklima.sensors.presence.occupied')
                      : t('indeklima.sensors.presence.vacant');
                  })()
                : fmtNum(sensor[sp], sp === 'temp' ? 1 : 0);
            const valueColor = ((): string | undefined => {
              if (isPir) return pirOccupied ? colors.statusBad : colors.statusGood;
              if (!hasThresholds(normalizedThresholds, sp)) return undefined;
              const zone: ThresholdZone = zoneForValue(
                normalizedThresholds,
                sp,
                toNumber(sensor[sp]),
              );
              if (zone === 'red') return colors.statusBad;
              if (zone === 'yellow') return colors.statusWarn;
              return colors.statusGood;
            })();

            // "Siden: kl. HH:MM" subtitle for the PIR tile
            const pirSubtitle = isPir
              ? (() => {
                  const sinceMs = pirSinceMs ?? parseMeasurementEpoch(sensor.time, tt);
                  if (sinceMs == null) return undefined;
                  const d = new Date(sinceMs);
                  if (isSameDay(d, new Date())) {
                    return t('indeklima.sensor_detail.pir_since_today', {
                      time: tt.formatTime(d),
                    });
                  }
                  return t('indeklima.sensor_detail.pir_since_dated', {
                    when: tt.formatDateTime(d),
                  });
                })()
              : undefined;

            return (
              <KpiTile
                key={p}
                label={t(`indeklima.sensor_detail.params.${p}`)}
                value={value}
                unit={unitFor(p)}
                icon={paramIcon(p)}
                iconColor={paramColor(p)}
                valueColor={valueColor}
                valueFontSize={isPir ? 24 : undefined}
                subtitle={pirSubtitle}
                active={activeParam === p}
                onPress={() => setParam(p)}
              />
            );
          });
          if (showOutdoorTile) {
            tiles.push(<OutdoorWeatherTile key="outdoor" sensor={sensor} />);
          }
          if (tiles.length === 0) return null;
          return (
            <View style={{ gap: spacing.sm }}>
              {chunk(tiles, 2).map((row, idx) => (
                <View
                  key={idx}
                  style={{ flexDirection: 'row', gap: spacing.sm }}
                >
                  {row}
                  {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
                </View>
              ))}
            </View>
          );
        })()}

        {availableParams.length > 0 ? (
          <SectionCard
            title={t('indeklima.sensor_detail.history')}
            icon="graph-up"
            padding={spacing.sm}
            trailing={!isVttParam ? (
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
                hitSlop={12}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.7 : 1,
                  padding: 8,
                  marginRight: -8,
                  marginVertical: -4,
                })}
              >
                <Icon name="fullscreen" color={colors.gray[500]} size={30} />
              </Pressable>
            ) : undefined}
          >
            <View style={{ gap: spacing.sm }}>
              {!isVttParam ? (
                <>
                  <SegmentedControl
                    value={period}
                    onChange={(p) => {
                      haptic.select();
                      setPeriodLocal(p);
                      setAnchor(startOfDay(new Date()));
                    }}
                    options={[
                      { id: 'day',   label: t('indeklima.sensor_detail.period.day') },
                      { id: 'week',  label: t('indeklima.sensor_detail.period.week') },
                      { id: 'month', label: t('indeklima.sensor_detail.period.month') },
                      { id: 'quarter', label: t('indeklima.sensor_detail.period.quarter') },
                    ]}
                    ariaLabel={t('indeklima.sensor_detail.history')}
                  />
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
                </>
              ) : null}

              {isVttParam && sensorMoldZone ? (
                <VttScaleCard
                  value={sensorMoldZone.mouldIndex}
                  trend={sensorMoldZone.trend}
                  trendDays={sensorMoldZone.trendDays}
                />
              ) : historyLoading ? (
                <LoadingIndicator inline />
              ) : activeParam === 'pir' ? (
                points.length < 1 ? (
                  <View
                    style={{
                      padding: spacing.lg,
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Icon name="motion-sensor" color={colors.gray[300]} size={24} />
                    <Text style={[type.caption, { textAlign: 'center' }]}>
                      {historyError
                        ? friendlyApiErrorMessage(historyError, t)
                        : t('indeklima.sensor_detail.no_history')}
                    </Text>
                  </View>
                ) : (
                  <PresenceChart
                    // Width matches the LineChart calc below — same
                    // ScrollView (spacing.xs × 2) + SectionCard
                    // (spacing.sm × 2) inset.
                    points={points}
                    width={width - spacing.xs * 2 - spacing.sm * 2}
                    fromTs={presenceBounds.fromTs}
                    toTs={presenceBounds.toTs}
                    occupiedLabel={t('indeklima.sensors.presence.occupied')}
                    vacantLabel={t('indeklima.sensors.presence.vacant')}
                    formatClock={(ms) => tt.formatTime(new Date(ms))}
                    formatDate={(ms) => tt.formatMonthDay(new Date(ms))}
                  />
                )
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
                      ? friendlyApiErrorMessage(historyError, t)
                      : t('indeklima.sensor_detail.no_history')}
                  </Text>
                </View>
              ) : (
                <LineChart
                  points={points}
                  width={width - spacing.xs * 2 - spacing.sm * 2}
                  unit={unitFor(activeParam)}
                  stroke={paramColor(activeParam)}
                  zones={chartZones}
                  smooth={period !== 'day'}
                  formatTimestamp={(ms) => tt.formatMonthDayTime(new Date(ms))}
                  formatAxisLabel={(ms) => tt.formatMonthDayTime(new Date(ms))}
                />
              )}
            </View>
          </SectionCard>
        ) : null}
      </ScrollView>

      {/* Combined sensor info sheet */}
      <SensorInfoSheet
        open={infoSheetOpen}
        onClose={() => setInfoSheetOpen(false)}
        sensorName={sensor.name}
        scenario={effectiveScenario.data ?? null}
        availableParams={availableParams}
        batteryIcon={batMeta.icon}
        batteryTone={batMeta.tone}
        batteryLabel={batLabel}
        batteryExplainKey={
          batMeta.key !== 'high' && sensor.sensorType && NON_REPLACEABLE_BATTERY_TYPES.has(sensor.sensorType)
            ? `indeklima.sensor_detail.battery.explain.${batMeta.key}_no_replace`
            : `indeklima.sensor_detail.battery.explain.${batMeta.key}`
        }
        batteryRaw={rawBattery}
        batteryDisplay={batteryDisplay}
        batteryScaleLabel={batteryScaleLabel}
        batteryBarZones={batteryBarZones}
        coverageIcon={sigMeta.icon}
        coverageTone={sigMeta.tone}
        coverageLabel={sigLabel}
        coverageExplainKey={`indeklima.sensor_detail.coverage.explain.${sigMeta.key}`}
        coverageSignalLevel={sig}
        coverageDisplay={coverageDisplay}
        coverageBarZones={coverageBarZones}
      />
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
        width: 48,
        height: 48,
        borderRadius: 24,
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
      <Icon name={icon} color={disabled ? colors.gray[300] : colors.brandDark} size={24} />
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
    case 'sound': return 'volume-up';
    case 'light': return 'brightness-high';
    case 'pir': return 'person';
    case 'vtt': return 'bacteria';
  }
}

// Silence the unused-var warning on toneColor import (kept for
// potential status-color computations added downstream).
void toneColor;
