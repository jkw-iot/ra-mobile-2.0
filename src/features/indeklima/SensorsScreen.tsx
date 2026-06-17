// ══════════════════════════════════════════════════════════════
// Sensor list — premium card layout with threshold colours,
// per-location filter, silent-sensor indicators, in-range and
// trend badges on the primary metric.
//
// The "primary" parameter picker (temp/hum/co2/voc) affects what
// value is surfaced in the right column of every card. For that
// parameter we render:
//  - A large coloured value (tinted if outside thresholds)
//  - An "Indenfor" / "Over" / "Under" pill from threshold checks
//  - A trend arrow (stigende/faldende) derived from a small
//    hourly-history fetch for each visible sensor.
// ══════════════════════════════════════════════════════════════
import {
  View,
  Text,
  Pressable,
  RefreshControl,
  FlatList,
  ScrollView,
  InteractionManager,
} from 'react-native';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useIsRestoring, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import {
  AppHeader,
  ErrorBanner,
  Icon,
  StatusDot,
  TreeSelect,
  type TreeSelectOption,
  ParamPicker,
  type ParamKey,
} from '@/components';
import { SkeletonGroup } from '@/components/Skeleton';
import { SensorCardSkeleton } from './SensorCardSkeleton';
import { colors, radius, spacing, type, toneColor } from '@/theme';
import {
  useSensorsFlat,
  useSensorTypes,
  useLocations,
  useMoldZones,
  buildTypeParamsMap,
  buildLocationOptions,
  sensorMatchesLocation,
  sensorSupports,
  type FlatSensor,
} from './hooks';
import type { MoldZone } from '@/services/api';
import {
  normalizeThresholds,
  zoneForValue,
  hasThresholds,
  type NormalizedThresholds,
} from './thresholds';
import { useLocationFilter } from '@/hooks/useLocationFilter';
import { useTenantTime } from '@/hooks/useTenantTime';
import type { TenantTime } from '@/lib/datetime';
import { useTenantStore } from '@/stores/tenantStore';
import { useSensorListPrefsStore } from '@/stores/sensorListPrefsStore';
import { indeklimaApi } from '@/services/api';
import { useQueries } from '@tanstack/react-query';
import { cacheTiers } from '@/lib/queryClient';
import type { StatusTone } from '@/theme';
import { haptic } from '@/lib/haptics';
import { friendlyApiErrorMessage } from '@/lib/apiErrorMessage';
import { format } from 'date-fns';

// ── Helpers ───────────────────────────────────────────────

function toneFromStatusColor(c: FlatSensor['statusColor']): StatusTone {
  if (c === 'green') return 'good';
  if (c === 'red') return 'bad';
  return 'neutral';
}

function isPresent(v: number | string | undefined): boolean {
  if (v == null || v === '-' || v === '') return false;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n);
}

function fmtNumberUnit(
  value: number | string | undefined,
  unit: string,
  digits = 1,
): string | null {
  if (value == null || value === '-' || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return `${n.toFixed(digits)} ${unit}`;
}

function fmtInt(
  value: number | string | undefined,
  unit: string,
): string | null {
  if (value == null || value === '-' || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return `${Math.round(n)} ${unit}`;
}

function toFiniteNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Time formatting per spec:
 * - Less than 24 hours: HH:mm
 * - More than 24 hours: date (DD. mon)
 *
 * All parsing/formatting goes through the tenant-time model so the
 * displayed wall clock is the tenant's local time regardless of the
 * device timezone (fixes the "1 time foran" bug where Legacy's
 * misleading `Z`/offset marker was honoured by `new Date(raw)`).
 *
 * Some payloads still arrive as a short pre-formatted token (e.g.
 * "17:33" or "21. nov"); those can't be reparsed reliably, so we
 * render them verbatim.
 */
function sensorTimeInfo(
  raw: string | undefined,
  tt: TenantTime,
): { text: string; isSilent: boolean } {
  if (!raw) return { text: '—', isSilent: true };
  if (raw.length <= 8) {
    const isTimeFormat = /^\d{1,2}:\d{2}$/.test(raw);
    return { text: raw, isSilent: !isTimeFormat };
  }
  const d = tt.parseLegacy(raw);
  if (!d) return { text: raw, isSilent: false };
  return tt.formatSensorListTime(d);
}

/**
 * Threshold tone for a single value, using the same normalised
 * threshold helpers as the sensor-detail screen.
 *
 * Importantly this delegates to `zoneForValue` (and the
 * underlying `normalizeThresholds`) so the overview honours:
 *   - all three API threshold shapes (canonical, MySQL native,
 *     legacy raapi long-form),
 *   - the param alias map (e.g. `temperature` ↔ `temp`),
 *   - the four-point yellow/red logic.
 *
 * Previously we had an ad-hoc local check that only understood
 * the canonical `{ lower, upper }` shape, which meant any sensor
 * whose thresholds came back in the legacy or MySQL shape was
 * silently coloured "good" regardless of the actual reading —
 * even when the detail page (which uses the proper helpers)
 * showed it as red/yellow.
 */
function valueTone(
  thresholds: NormalizedThresholds | undefined,
  param: ParamKey,
  value: number | string | undefined,
): 'good' | 'warn' | 'bad' | undefined {
  if (!thresholds) return undefined;
  if (!hasThresholds(thresholds, param)) return undefined;
  if (value == null || value === '-' || value === '') return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return undefined;
  const zone = zoneForValue(thresholds, param, n);
  if (zone === 'red') return 'bad';
  if (zone === 'yellow') return 'warn';
  return 'good';
}

function toneBg(_tone: 'good' | 'warn' | 'bad' | undefined): string {
  return colors.gray[100];
}

function toneText(_tone: 'good' | 'warn' | 'bad' | undefined): string {
  return colors.gray[700];
}

// ── Metric pill (colour-coded secondary metric) ───────────
function MetricPill({
  value,
  icon,
  tone,
}: {
  value: string;
  icon: string;
  tone?: 'good' | 'warn' | 'bad';
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radius.full,
        backgroundColor: toneBg(tone),
      }}
    >
      <Icon name={icon} color={toneText(tone)} size={11} />
      <Text
        style={{
          fontSize: 11,
          fontWeight: '600',
          color: toneText(tone),
        }}
      >
        {value}
      </Text>
    </View>
  );
}

// ── Sensor card ────────────────────────────────────────────
type Trend = 'up' | 'down' | 'flat' | 'unknown';

function TrendIndicator({
  trend,
  label,
}: {
  trend: Trend;
  label: string;
}) {
  const icon =
    trend === 'up' ? 'arrow-up'
    : trend === 'down' ? 'arrow-down'
    : 'dash';

  return (
    <View
      accessibilityLabel={label}
      style={{
        width: 16,
        height: 16,
        borderRadius: radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.gray[100],
        marginLeft: 1,
      }}
    >
      <Icon name={icon} color={colors.gray[500]} size={11} />
    </View>
  );
}

/** True when the sensor reports a presence (PIR) reading. */
function isPresenceActive(v: number | string | undefined): boolean {
  if (v == null || v === '-' || v === '') return false;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0;
}

interface SensorCardProps {
  sensor: FlatSensor;
  onPress: () => void;
  typeMap: Map<string, Set<string>>;
  /**
   * Pre-normalised thresholds for this sensor — folded through
   * `normalizeThresholds` upstream so this component never has
   * to know which API shape the data originally came from.
   */
  thresholds?: NormalizedThresholds;
  primaryParam: ParamKey;
  trend: Trend;
  moldZone?: MoldZone;
}

function vttTone(status: MoldZone['status']): 'good' | 'warn' | 'bad' {
  if (status === 'visual_growth') return 'bad';
  if (status === 'microscopic') return 'warn';
  return 'good';
}

function SensorCard({
  sensor,
  onPress,
  typeMap,
  thresholds,
  primaryParam,
  trend,
  moldZone,
}: SensorCardProps) {
  const { t } = useTranslation();
  const tt = useTenantTime();
  const tone = toneFromStatusColor(sensor.statusColor);
  const stripe = toneColor(tone);
  const timeInfo = sensorTimeInfo(sensor.time, tt);
  const isSilent = timeInfo.isSilent || sensor.statusColor === 'grey';

  const supports = (p: string) => sensorSupports(sensor.sensorType, p, typeMap);

  const paramUnit: Record<ParamKey, string> = {
    temp: sensor.tempUnit ?? '°C',
    hum: sensor.humUnit ?? '%',
    co2: sensor.co2Unit ?? 'ppm',
    voc: sensor.vocUnit ?? 'ppb',
    sound: sensor.soundUnit ?? 'dB',
    light: sensor.lightUnit ?? 'lux',
    pir: '',
    vtt: 'M',
  };
  const paramIcon: Record<ParamKey, string> = {
    temp: 'thermometer-half',
    hum: 'droplet',
    co2: 'cloud',
    voc: 'wind',
    sound: 'volume-up',
    light: 'brightness-high',
    pir: 'person',
    vtt: 'bacteria',
  };

  // Presence is binary — show a localised "occupied / vacant"
  // label instead of a number + unit.
  const formatPrimary = (p: ParamKey): string | null => {
    if (p === 'vtt') {
      if (!moldZone) return null;
      return fmtNumberUnit(moldZone.mouldIndex, paramUnit[p], 1);
    }
    if (!supports(p)) return null;
    if (p === 'pir') {
      if (sensor.pir == null || sensor.pir === '-' || sensor.pir === '') return null;
      return isPresenceActive(sensor.pir)
        ? t('indeklima.sensors.presence.occupied')
        : t('indeklima.sensors.presence.vacant');
    }
    if (p === 'temp') return fmtNumberUnit(sensor[p], paramUnit[p], 1);
    return fmtInt(sensor[p], paramUnit[p]);
  };

  const primaryValue = formatPrimary(primaryParam);
  // Thresholds don't apply to presence — fall back to a binary
  // tone based on occupancy so the room reads at a glance:
  // occupied → red ("bad"), vacant → green ("good"). This mirrors
  // the map marker pill which already colours presence this way.
  const primaryTone =
    primaryValue
      ? primaryParam === 'vtt'
        ? moldZone ? vttTone(moldZone.status) : undefined
        : primaryParam === 'pir'
          ? isPresenceActive(sensor.pir)
            ? 'bad'
            : 'good'
          : valueTone(thresholds, primaryParam, sensor[primaryParam])
      : undefined;

  const secondaryParams: ParamKey[] = (
    ['temp', 'hum', 'co2', 'voc', 'sound', 'light', 'pir', 'vtt'] as ParamKey[]
  ).filter((p) => {
    if (p === primaryParam) return false;
    if (p === 'vtt') return !!moldZone;
    return supports(p) && isPresent(sensor[p]);
  });

  const primaryValueColor = primaryTone === 'bad'
    ? colors.statusBad
    : primaryTone === 'warn'
      ? colors.statusWarn
      : primaryTone === 'good'
        ? colors.statusGood
        : colors.brandDark;

  const trendLabel =
    trend === 'up' ? t('indeklima.sensors.trend_rising')
    : trend === 'down' ? t('indeklima.sensors.trend_falling')
    : trend === 'flat' ? t('indeklima.sensors.trend_flat')
    : t('indeklima.sensors.trend_flat');

  return (
    // Outer wrapper carries the layout (margins) on a plain
    // <View>, NOT on the function-style <Pressable.style>.
    // Function-style Pressable styles intermittently drop both
    // visual props (bg/border/shadow) and layout props (margin)
    // in this Expo SDK 54 + NativeWind setup. Pressable now only
    // owns press feedback; the View around it owns spacing, and
    // the View inside it owns the visible card chrome.
    <View style={{ marginHorizontal: spacing.xs, marginBottom: spacing.xs }}>
    <Pressable
      onPress={() => { haptic.light(); onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={sensor.name}
      style={({ pressed }) => ({
        opacity: isSilent ? 0.6 : 1,
        transform: [{ scale: pressed ? 0.995 : 1 }],
      })}
    >
      <View
        style={{
          borderRadius: radius.lg,
          backgroundColor: colors.white,
          // Page bg is `#F4F6F9` and the card is white — only 11
          // levels of RGB delta, so without a border the cards
          // visually melt into the page. The hairline border + a
          // slightly stronger shadow give each sensor a clear
          // contained card identity, matching the language card
          // and TenantTile patterns elsewhere in the app.
          borderWidth: 1,
          borderColor: isSilent ? colors.gray[100] : colors.gray[200],
          shadowColor: '#0b1a2b',
          shadowOpacity: isSilent ? 0.03 : 0.08,
          shadowRadius: isSilent ? 6 : 10,
          shadowOffset: { width: 0, height: 3 },
          elevation: isSilent ? 1 : 2,
          flexDirection: 'row',
          overflow: 'hidden',
        }}
      >
      {/* Status stripe — only rendered when the tone actually
          carries information (good = green, bad = red). For
          neutral / silent / unknown statuses the stripe would be
          a flat gray band that just adds noise on the left edge,
          so we drop it entirely. `tone === 'neutral'` covers
          both silent sensors (`isSilent === true`) and live
          sensors whose `statusColor` is `'grey'` or unmapped. */}
      {tone === 'bad' ? (
        <View style={{ width: 4, backgroundColor: stripe }} />
      ) : null}
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.md,
        }}
      >
        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text
              style={{
                fontSize: 15,
                fontWeight: '700',
                color: colors.brandDark,
                letterSpacing: -0.2,
                flex: 1,
              }}
              numberOfLines={1}
            >
              {sensor.name}
            </Text>
            {isSilent ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 3,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: radius.full,
                  backgroundColor: 'rgba(214,91,91,0.10)',
                }}
              >
                <Icon name="volume-mute" color={colors.statusBad} size={10} />
                <Text style={{ fontSize: 9, fontWeight: '700', color: colors.statusBad }}>
                  {t('indeklima.sensors.silent').toUpperCase()}
                </Text>
              </View>
            ) : null}
          </View>
          {(secondaryParams.length > 0) ? (
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 6,
                marginTop: 2,
              }}
            >
              {secondaryParams.map((p) => {
                const val =
                  p === 'vtt'
                    ? moldZone ? fmtNumberUnit(moldZone.mouldIndex, 'M', 1) : null
                    : p === 'pir'
                      ? isPresenceActive(sensor.pir)
                        ? t('indeklima.sensors.presence.occupied')
                        : t('indeklima.sensors.presence.vacant')
                      : p === 'temp'
                        ? fmtNumberUnit(sensor[p], paramUnit[p], 1)
                        : fmtInt(sensor[p], paramUnit[p]);
                if (!val) return null;
                const pillTone =
                  p === 'vtt'
                    ? moldZone ? vttTone(moldZone.status) : undefined
                    : p === 'pir'
                      ? isPresenceActive(sensor.pir)
                        ? 'bad'
                        : 'good'
                      : valueTone(thresholds, p, sensor[p]);
                return <MetricPill key={p} value={val} icon={paramIcon[p]} tone={pillTone} />;
              })}
            </View>
          ) : null}
        </View>

        {/* Right-aligned KPI column */}
        <View style={{ alignItems: 'flex-end', minWidth: 88, gap: 4 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <StatusDot tone={tone} size={8} />
            <Text
              style={{
                fontSize: 10,
                fontWeight: '600',
                color: isSilent ? colors.statusBad : colors.gray[500],
                letterSpacing: 0.4,
                fontVariant: ['tabular-nums'],
              }}
            >
              {timeInfo.text.toUpperCase()}
            </Text>
          </View>
          {primaryValue ? (
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              accessibilityLabel={
                trendLabel ? `${primaryValue} · ${trendLabel}` : primaryValue
              }
            >
              <Text
                style={{
                  fontSize: 26,
                  fontWeight: '700',
                  color: primaryValueColor,
                  letterSpacing: -0.5,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {primaryValue}
              </Text>
              {primaryParam !== 'pir' ? (
                <TrendIndicator
                  trend={trend}
                  label={trendLabel}
                />
              ) : null}
            </View>
          ) : (
            <Text style={{ fontSize: 26, fontWeight: '700', color: colors.gray[300] }}>—</Text>
          )}
        </View>
      </View>
      </View>
    </Pressable>
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────

const TREND_MIN_DELTA: Record<ParamKey, number> = {
  temp: 0.1,
  hum: 1,
  co2: 20,
  voc: 5,
  sound: 2,
  light: 20,
  pir: 3,
  vtt: 0.1,
};

export default function IndeklimaSensorsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const activeTenantId = useTenantStore((s) => s.activeTenantId);
  const selectedLocationId = useSensorListPrefsStore((s) =>
    activeTenantId === null
      ? null
      : s.selectedLocationByTenant[String(activeTenantId)] ?? null,
  );
  const setSelectedLocation = useSensorListPrefsStore((s) => s.setSelectedLocation);

  const queryClient = useQueryClient();
  const isRestoring = useIsRestoring();
  const { data, isLoading, isError, error, refetch, isRefetching } = useSensorsFlat();
  const sensorTypesQuery = useSensorTypes();
  const locationsQuery = useLocations();
  const moldZonesQuery = useMoldZones();
  const { moldIndexMap } = moldZonesQuery;
  const typeMap = useMemo(
    () => buildTypeParamsMap(sensorTypesQuery.data),
    [sensorTypesQuery.data],
  );

  // Gate: show spinner until all critical data is ready so the screen
  // is fully interactive from the first visible frame.
  const isScreenReady =
    !isRestoring &&
    !isLoading &&
    !sensorTypesQuery.isLoading &&
    !locationsQuery.isLoading &&
    !moldZonesQuery.isLoading;

  // Defer secondary batch queries (thresholds + trends) until after
  // animations/interactions complete to keep the JS thread free for
  // touch handling during the critical first frames.
  const [interactionsComplete, setInteractionsComplete] = useState(false);
  useEffect(() => {
    if (!isScreenReady) return;
    const handle = InteractionManager.runAfterInteractions(() => {
      setInteractionsComplete(true);
    });
    return () => handle.cancel();
  }, [isScreenReady]);

  // Pull-to-refresh refetches everything that feeds the screen,
  // not just the sensor snapshot. Without including locations the
  // user wouldn't see e.g. a renamed location until staleTime
  // expired (or the app was killed and remounted). Sensor types
  // are along for the ride so a newly-installed sensor type's
  // capability list reaches the param picker the same way.
  const onRefresh = useCallback(() => {
    refetch();
    locationsQuery.refetch();
    sensorTypesQuery.refetch();
    moldZonesQuery.refetch();
    queryClient.invalidateQueries({
      queryKey: ['indeklima', 'scope-thresholds'],
    });
  }, [refetch, locationsQuery, sensorTypesQuery, moldZonesQuery, queryClient]);

  const refreshing =
    isRefetching || locationsQuery.isRefetching || sensorTypesQuery.isRefetching || moldZonesQuery.isRefetching;

  const [primaryParam, setPrimaryParam] = useState<ParamKey>('temp');

  const allowed = useLocationFilter(data, (s) => s.locationId);

  const locationOptions = useMemo(
    () => buildLocationOptions(allowed, locationsQuery.data),
    [allowed, locationsQuery.data],
  );

  // Project the rich location options into the generic shape
  // expected by `<TreeSelect>` so the picker stays decoupled from
  // our domain-specific subtree metadata.
  const locationSelectOptions = useMemo<TreeSelectOption[]>(
    () => locationOptions.map((o) => ({ id: o.id, label: o.name, depth: o.depth })),
    [locationOptions],
  );

  useEffect(() => {
    if (activeTenantId === null || locationOptions.length === 0) {
      return;
    }
    const hasStoredLocation =
      selectedLocationId !== null && locationOptions.some((o) => o.id === selectedLocationId);
    if (!hasStoredLocation) {
      const firstLocation = locationOptions[0];
      if (firstLocation) {
        setSelectedLocation(activeTenantId, firstLocation.id);
      }
    }
  }, [activeTenantId, locationOptions, selectedLocationId, setSelectedLocation]);

  const effectiveLocation = useMemo(() => {
    if (selectedLocationId && locationOptions.some((o) => o.id === selectedLocationId)) {
      return selectedLocationId;
    }
    return locationOptions[0]?.id ?? null;
  }, [locationOptions, selectedLocationId]);

  // Look up the option for the effective selection so we can match
  // by its full subtree (e.g. picking "Sommerhus" includes any
  // sensors under "Sommerhus → Test").
  const effectiveSubtree = useMemo(() => {
    if (!effectiveLocation) return null;
    const opt = locationOptions.find((o) => o.id === effectiveLocation);
    return opt ? opt.subtreeIds : null;
  }, [effectiveLocation, locationOptions]);

  // Sensors in the current location, BEFORE filtering by the
  // active parameter. Drives the param picker's "available" set
  // so the user can always switch back to a metric another sensor
  // in the location still reports. The rendered list itself is
  // narrower (see `visible` below).
  const locationFiltered = useMemo(() => {
    if (!effectiveLocation) return [];
    return allowed.filter((s) => sensorMatchesLocation(s, effectiveSubtree));
  }, [allowed, effectiveLocation, effectiveSubtree]);

  // Which parameters does at least one sensor in the current
  // location actually measure? Drives the param picker below so
  // we don't offer e.g. "Tilstedeværelse" when no sensor in the
  // location has a PIR. We rely on the sensor-types map (each
  // sensor type publishes the params it reports); if that's still
  // loading we fall back to "all" so the picker stays responsive.
  const availableParams = useMemo<Set<ParamKey>>(() => {
    const all: ParamKey[] = ['temp', 'hum', 'co2', 'voc', 'sound', 'light', 'pir'];
    if (typeMap.size === 0 || locationFiltered.length === 0) return new Set(all);
    const found = new Set<ParamKey>();
    for (const s of locationFiltered) {
      for (const p of all) {
        if (found.has(p)) continue;
        if (sensorSupports(s.sensorType, p, typeMap)) found.add(p);
      }
      // Check if this sensor has VTT configured
      if (!found.has('vtt') && moldIndexMap.has(String(s.id))) {
        found.add('vtt');
      }
    }
    return found;
  }, [locationFiltered, typeMap, moldIndexMap]);

  // Final list rendered in the FlatList: location-filtered AND
  // restricted to sensors that actually measure the active
  // parameter. A sensor that reports temp+hum only should never
  // show up under "CO₂" — even with a "—" placeholder on the
  // right, it just adds noise and makes the user wonder why
  // their CO₂ count is so low.
  //
  // While the sensor-types map is still loading (`typeMap.size === 0`)
  // `sensorSupports` falls back to "true" for every sensor, so
  // we briefly show everything rather than flashing an empty
  // list.
  const visible = useMemo(() => {
    if (primaryParam === 'vtt') {
      return locationFiltered.filter((s) => moldIndexMap.has(String(s.id)));
    }
    return locationFiltered.filter((s) =>
      sensorSupports(s.sensorType, primaryParam, typeMap),
    );
  }, [locationFiltered, primaryParam, typeMap, moldIndexMap]);

  // Keep `primaryParam` valid as the user changes location —
  // jump to the first available one if the currently selected
  // param isn't reported anywhere in the new location.
  useEffect(() => {
    if (availableParams.size === 0) return;
    if (availableParams.has(primaryParam)) return;
    const first = (['temp', 'hum', 'co2', 'voc', 'sound', 'light', 'pir', 'vtt'] as const).find((p) =>
      availableParams.has(p),
    );
    if (first) setPrimaryParam(first);
  }, [availableParams, primaryParam]);

  // Batch threshold queries for visible sensors — deferred until
  // interactions complete so the screen is responsive first.
  const thresholdQueries = useQueries({
    queries: visible.map((s) => ({
      queryKey: ['indeklima', 'sensor', s.id, 'thresholds', { tenantId: activeTenantId }],
      queryFn: () => indeklimaApi.getSensorThresholds(s.id),
      enabled: interactionsComplete && activeTenantId !== null,
      staleTime: cacheTiers.downsampled.staleTime,
      gcTime: cacheTiers.downsampled.gcTime,
    })),
  });

  // Normalise once at the boundary so each <SensorCard> can call
  // `zoneForValue` directly without re-folding the API payload —
  // and so the overview honours the same shape variants
  // (canonical, MySQL native, legacy raapi long-form) and aliases
  // (`temperature` ↔ `temp`, etc.) the detail screen does.
  const thresholdMap = useMemo(() => {
    const m = new Map<number, NormalizedThresholds>();
    visible.forEach((s, i) => {
      const data = thresholdQueries[i]?.data;
      if (data) m.set(s.id, normalizeThresholds(data));
    });
    return m;
  }, [visible, thresholdQueries]);

  // Trend: fetch today's raw readings per visible sensor and
  // compare the last two non-null values for the selected param.
  // Raw readings are always available (live data, not a deferred
  // hourly-aggregation cache), so this reliably detects whether the
  // metric is rising or falling. Capped at 24 sensors to avoid
  // pathological cases.
  //
  // For VTT, trends come pre-computed from the mold zones API
  // (moldZone.trend) — no history fetch needed.
  const isVttParam = primaryParam === 'vtt';
  const trendDate = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const trendCandidates = visible.slice(0, 24);
  const trendQueries = useQueries({
    queries: trendCandidates.map((s) => ({
      queryKey: [
        'indeklima',
        'sensor',
        s.id,
        'trend',
        { date: trendDate, tenantId: activeTenantId },
      ],
      queryFn: () =>
        indeklimaApi.getSensorHistory(s.id, {
          date: trendDate,
          resolution: 'raw',
        }),
      enabled: interactionsComplete && activeTenantId !== null && !isVttParam,
      staleTime: cacheTiers.snapshot.staleTime,
      gcTime: cacheTiers.raw.gcTime,
    })),
  });

  const trendMap = useMemo(() => {
    const m = new Map<number, Trend>();

    // VTT: use server-computed trend from mold zones API
    if (isVttParam) {
      for (const s of visible) {
        const zone = moldIndexMap.get(String(s.id));
        if (!zone) { m.set(s.id, 'unknown'); continue; }
        if (zone.trend === 'rising') m.set(s.id, 'up');
        else if (zone.trend === 'falling') m.set(s.id, 'down');
        else m.set(s.id, 'flat');
      }
      return m;
    }

    trendCandidates.forEach((s, i) => {
      const data = trendQueries[i]?.data;
      const readings = Array.isArray(data) ? data : undefined;
      if (!readings || readings.length < 2) {
        m.set(s.id, 'unknown');
        return;
      }
      const rawKey = primaryParam;
      const recent: number[] = [];
      for (let j = readings.length - 1; j >= 0 && recent.length < 2; j--) {
        const v = toFiniteNumber((readings[j] as Record<string, unknown>)[rawKey]);
        if (v !== null) recent.push(v);
      }
      if (recent.length < 2) {
        m.set(s.id, 'unknown');
        return;
      }
      const delta = recent[0]! - recent[1]!;
      const min = TREND_MIN_DELTA[primaryParam];
      if (Math.abs(delta) < min) m.set(s.id, 'flat');
      else m.set(s.id, delta > 0 ? 'up' : 'down');
    });
    return m;
  }, [trendCandidates, trendQueries, primaryParam, isVttParam, visible, moldIndexMap]);

  if (!isScreenReady) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary }} edges={['bottom']}>
        <AppHeader />
        {/* Navy panel skeleton: location picker + param chips */}
        <View style={{ backgroundColor: colors.navy, paddingTop: spacing.xs, paddingBottom: spacing.md }}>
          <SkeletonGroup>
            <View style={{ paddingHorizontal: spacing.xs, gap: spacing.sm }}>
              <View style={{ height: 36, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.08)' }} />
              <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xs }}>
                {[72, 64, 56, 64].map((w, i) => (
                  <View key={i} style={{ width: w, height: 28, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.08)' }} />
                ))}
              </View>
            </View>
          </SkeletonGroup>
        </View>
        <ScrollView contentContainerStyle={{ paddingTop: spacing.sm, paddingBottom: spacing.xl }}>
          <SkeletonGroup>
            {Array.from({ length: 6 }).map((_, i) => (
              <SensorCardSkeleton key={i} />
            ))}
          </SkeletonGroup>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary }} edges={['bottom']}>
      <AppHeader />

      {isError ? (
        <ErrorBanner message={friendlyApiErrorMessage(error, t)} />
      ) : null}

      <View
        style={{
          backgroundColor: colors.navy,
          paddingTop: spacing.xs,
        }}
      >
        <TreeSelect
          surface="dark"
          icon="geo-alt-fill"
          label={t('indeklima.location_filter.label')}
          value={effectiveLocation}
          onChange={(id) => {
            if (activeTenantId !== null) {
              setSelectedLocation(activeTenantId, id);
            }
          }}
          options={locationSelectOptions}
          placeholder={t('indeklima.sensors.no_locations')}
          inset={spacing.xs}
        />

        <View
          style={{
            paddingHorizontal: spacing.xs,
            paddingTop: spacing.xs,
            paddingBottom: spacing.md,
          }}
        >
          <ParamPicker
            value={primaryParam}
            onChange={setPrimaryParam}
            available={availableParams}
          />
        </View>
      </View>

      <FlatList
        data={visible}
        keyExtractor={(s) => String(s.id)}
        renderItem={({ item }) => (
          <SensorCard
            sensor={item}
            onPress={() => {
              haptic.light();
              router.push({
                pathname: '/sensor/[id]',
                params: { id: String(item.id), param: primaryParam },
              });
            }}
            typeMap={typeMap}
            thresholds={thresholdMap.get(item.id)}
            primaryParam={primaryParam}
            trend={trendMap.get(item.id) ?? 'unknown'}
            moldZone={moldIndexMap.get(String(item.id))}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.navy}
          />
        }
        ListEmptyComponent={
          // When the fetch errored, the empty data set is a
          // side-effect of the failure — not a "no sensors
          // configured" state. The ErrorBanner above already
          // owns the messaging, so we suppress the misleading
          // "Ingen sensorer fundet" card to avoid double-talk.
          !isLoading && !isError ? (
            <View
              style={{
                marginHorizontal: spacing.xs,
                marginTop: spacing.xl,
                padding: spacing.xl,
                alignItems: 'center',
                gap: spacing.sm,
                borderRadius: radius.lg,
                backgroundColor: colors.white,
                borderWidth: 1,
                borderColor: colors.gray[200],
              }}
            >
              <Icon name="thermometer" color={colors.gray[300]} size={36} />
              <Text
                style={[type.bodyStrong, { color: colors.brandDark, textAlign: 'center' }]}
              >
                {t('indeklima.sensors.empty')}
              </Text>
              <Text style={[type.caption, { textAlign: 'center' }]}>
                {t('indeklima.sensors.empty_subtitle')}
              </Text>
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingTop: spacing.sm, paddingBottom: spacing.xl + 80 }}
        style={{ marginTop: spacing.xs }}
      />
    </SafeAreaView>
  );
}
