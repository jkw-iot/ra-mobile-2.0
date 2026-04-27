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
} from 'react-native';
import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import {
  AppHeader,
  LoadingIndicator,
  ErrorBanner,
  Icon,
  StatusDot,
} from '@/components';
import { colors, fontFamily, radius, spacing, type, toneColor } from '@/theme';
import {
  useSensorsFlat,
  useSensorTypes,
  useLocations,
  buildTypeParamsMap,
  buildLocationOptions,
  sensorMatchesLocation,
  sensorSupports,
  type FlatSensor,
  type LocationOption,
} from '@/features/indeklima/hooks';
import { useLocationFilter } from '@/hooks/useLocationFilter';
import { useTenantStore } from '@/stores/tenantStore';
import { useSensorListPrefsStore } from '@/stores/sensorListPrefsStore';
import { indeklimaApi } from '@/services/api';
import { useQueries } from '@tanstack/react-query';
import { cacheTiers } from '@/lib/queryClient';
import type { StatusTone } from '@/theme';
import { haptic } from '@/lib/haptics';
import { format, subHours } from 'date-fns';

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

/**
 * Time formatting per spec:
 * - Less than 24 hours: HH:mm
 * - More than 24 hours: date (DD. mon)
 */
function formatSensorTime(raw: string | undefined): { text: string; isSilent: boolean } {
  if (!raw) return { text: '—', isSilent: true };
  if (raw.length <= 8) {
    const isTimeFormat = /^\d{1,2}:\d{2}$/.test(raw);
    return { text: raw, isSilent: !isTimeFormat };
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return { text: raw, isSilent: false };

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const hoursDiff = diffMs / (1000 * 60 * 60);

  if (hoursDiff < 24) {
    return {
      text: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
      isSilent: false,
    };
  }
  const MONTHS_DA = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  return {
    text: `${d.getDate()}. ${MONTHS_DA[d.getMonth()]}`,
    isSilent: hoursDiff > 48,
  };
}

/** Determine threshold tone for a single value. */
function valueTone(
  value: number | string | undefined,
  thresholds: { lower?: number; upper?: number } | undefined,
): 'good' | 'warn' | 'bad' | undefined {
  if (!thresholds) return undefined;
  if (value == null || value === '-' || value === '') return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return undefined;
  if (thresholds.lower != null && n < thresholds.lower) return 'bad';
  if (thresholds.upper != null && n > thresholds.upper) return 'warn';
  return 'good';
}

function toneBg(tone: 'good' | 'warn' | 'bad' | undefined): string {
  switch (tone) {
    case 'good': return 'rgba(108,158,131,0.15)';
    case 'warn': return 'rgba(240,173,78,0.15)';
    case 'bad': return 'rgba(214,91,91,0.15)';
    default: return colors.gray[100];
  }
}

function toneText(tone: 'good' | 'warn' | 'bad' | undefined): string {
  switch (tone) {
    case 'good': return colors.statusGood;
    case 'warn': return colors.statusWarn;
    case 'bad': return colors.statusBad;
    default: return colors.gray[700];
  }
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
type ParamKey = 'temp' | 'hum' | 'co2' | 'voc' | 'pir';
type Trend = 'up' | 'down' | 'flat' | 'unknown';

/** True when the sensor reports a presence (PIR) reading. */
function isPresenceActive(v: number | string | undefined): boolean {
  if (v == null || v === '-' || v === '') return false;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0;
}

interface SensorCardProps {
  sensor: FlatSensor;
  showGroup: boolean;
  onPress: () => void;
  typeMap: Map<string, Set<string>>;
  thresholds?: Record<string, { lower?: number; upper?: number }>;
  primaryParam: ParamKey;
  trend: Trend;
}

function SensorCard({
  sensor,
  showGroup,
  onPress,
  typeMap,
  thresholds,
  primaryParam,
  trend,
}: SensorCardProps) {
  const { t } = useTranslation();
  const tone = toneFromStatusColor(sensor.statusColor);
  const stripe = toneColor(tone);
  const timeInfo = formatSensorTime(sensor.time);
  const isSilent = timeInfo.isSilent || sensor.statusColor === 'grey';

  const supports = (p: string) => sensorSupports(sensor.sensorType, p, typeMap);

  const paramUnit: Record<ParamKey, string> = {
    temp: sensor.tempUnit ?? '°C',
    hum: sensor.humUnit ?? '%',
    co2: sensor.co2Unit ?? 'ppm',
    voc: sensor.vocUnit ?? 'ppb',
    pir: '',
  };
  const paramIcon: Record<ParamKey, string> = {
    temp: 'thermometer-half',
    hum: 'droplet',
    co2: 'cloud',
    voc: 'wind',
    pir: 'person',
  };

  const thresholdFor = (p: ParamKey) =>
    thresholds?.[p]
    ?? thresholds?.[
      p === 'hum' ? 'humidity'
      : p === 'co2' ? 'carbondioxide'
      : p === 'temp' ? 'temperature'
      : p
    ];

  // Presence is binary — show a localised "occupied / vacant"
  // label instead of a number + unit.
  const formatPrimary = (p: ParamKey): string | null => {
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
  // Thresholds don't apply to presence — skip tone lookup for it.
  const primaryTone =
    primaryValue && primaryParam !== 'pir'
      ? valueTone(sensor[primaryParam], thresholdFor(primaryParam))
      : undefined;

  const secondaryParams: ParamKey[] = (
    ['temp', 'hum', 'co2', 'voc', 'pir'] as ParamKey[]
  ).filter(
    (p) => p !== primaryParam && supports(p) && isPresent(sensor[p]),
  );

  const primaryValueColor = primaryTone === 'bad'
    ? colors.statusBad
    : primaryTone === 'warn'
      ? colors.statusWarn
      : primaryTone === 'good'
        ? colors.statusGood
        : colors.brandDark;

  const trendIcon =
    trend === 'up' ? 'arrow-up'
    : trend === 'down' ? 'arrow-down'
    : trend === 'flat' ? 'dash'
    : null;
  const trendLabel =
    trend === 'up' ? t('indeklima.sensors.trend_rising')
    : trend === 'down' ? t('indeklima.sensors.trend_falling')
    : undefined;

  return (
    <Pressable
      onPress={() => { haptic.light(); onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={sensor.name}
      style={({ pressed }) => ({
        marginHorizontal: spacing.md,
        marginBottom: spacing.sm,
        borderRadius: radius.lg,
        backgroundColor: colors.white,
        shadowColor: '#0b1a2b',
        shadowOpacity: isSilent ? 0.03 : 0.06,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
        elevation: isSilent ? 1 : 2,
        flexDirection: 'row',
        overflow: 'hidden',
        opacity: isSilent ? 0.6 : 1,
        transform: [{ scale: pressed ? 0.995 : 1 }],
      })}
    >
      <View style={{ width: 4, backgroundColor: isSilent ? colors.gray[300] : stripe }} />
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
          {showGroup ? (
            <Text style={type.caption} numberOfLines={1}>
              {[sensor.groupTitle, ...(sensor.path ?? [])].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
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
                  p === 'pir'
                    ? isPresenceActive(sensor.pir)
                      ? t('indeklima.sensors.presence.occupied')
                      : t('indeklima.sensors.presence.vacant')
                    : p === 'temp'
                      ? fmtNumberUnit(sensor[p], paramUnit[p], 1)
                      : fmtInt(sensor[p], paramUnit[p]);
                if (!val) return null;
                const pillTone =
                  p === 'pir' ? undefined : valueTone(sensor[p], thresholdFor(p));
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
                  fontSize: 22,
                  fontWeight: '700',
                  color: primaryValueColor,
                  letterSpacing: -0.5,
                }}
              >
                {primaryValue}
              </Text>
              {trendIcon ? (
                <Icon
                  name={trendIcon}
                  color={primaryValueColor}
                  size={16}
                />
              ) : null}
            </View>
          ) : (
            <Text style={{ fontSize: 22, fontWeight: '700', color: colors.gray[300] }}>—</Text>
          )}
        </View>

        <Icon name="chevron-right" color={colors.gray[300]} size={16} />
      </View>
    </Pressable>
  );
}

// ── Location selector ─────────────────────────────────────
// A fixed, prominent selector: current location stays visible above
// the scrollable sensor list, while location choice expands inline.
function LocationDropdown({
  value,
  onChange,
  options,
  label,
}: {
  value: string | null;
  onChange: (id: string) => void;
  options: LocationOption[];
  label: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const current = value ? options.find((o) => o.id === value) : null;
  const displayValue = current?.name ?? t('indeklima.sensors.no_locations');
  const hasOptions = options.length > 0;

  return (
    <View>
      <Pressable
        disabled={!hasOptions}
        onPress={() => {
          haptic.select();
          setOpen((v) => !v);
        }}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: displayValue }}
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => ({
          backgroundColor: pressed && hasOptions ? 'rgba(255,255,255,0.08)' : 'transparent',
        })}
      >
        <View
          style={{
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.xl,
            paddingBottom: spacing.lg,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{
                fontFamily: fontFamily(hasOptions && current ? 'bold' : 'regular'),
                fontSize: 26,
                lineHeight: 32,
                color: hasOptions ? colors.white : 'rgba(255,255,255,0.55)',
                letterSpacing: -0.5,
              }}
              numberOfLines={2}
            >
              {displayValue}
            </Text>
          </View>
          <Icon
            name={open ? 'chevron-up' : 'chevron-down'}
            color={hasOptions ? colors.white : 'rgba(255,255,255,0.45)'}
            size={22}
          />
        </View>
      </Pressable>

      {open && hasOptions ? (
        <View
          style={{
            marginHorizontal: spacing.md,
            marginTop: spacing.xs,
            backgroundColor: colors.white,
            borderWidth: 1,
            borderColor: colors.gray[200],
            borderRadius: radius.lg,
            maxHeight: 360,
            shadowColor: '#0b1a2b',
            shadowOpacity: 0.08,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 4,
            overflow: 'hidden',
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingVertical: spacing.xs }}
          >
            {options.map((o) => (
              <LocationRow
                key={o.id}
                name={o.name}
                depth={o.depth}
                active={value === o.id}
                onPress={() => {
                  haptic.select();
                  onChange(o.id);
                  setOpen(false);
                }}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

function LocationRow({
  name,
  depth,
  active,
  onPress,
}: {
  name: string;
  depth: number;
  active: boolean;
  onPress: () => void;
}) {
  const indent = Math.min(depth, 5) * 18;

  return (
    <View
      style={{
        marginHorizontal: spacing.sm,
        marginVertical: 4,
        borderRadius: radius.md,
        backgroundColor: active ? colors.gray[100] : colors.white,
        borderWidth: 1,
        borderColor: active ? colors.gray[300] : colors.gray[200],
      }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        style={({ pressed }) => ({
          borderRadius: radius.md,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingLeft: spacing.md + indent,
            paddingRight: spacing.md,
            paddingVertical: 12,
          }}
        >
          {depth > 0 ? (
            <View
              style={{
                width: 10,
                height: 10,
                borderLeftWidth: 2,
                borderBottomWidth: 2,
                borderColor: colors.gray[300],
                marginRight: spacing.sm,
                marginLeft: -spacing.xs,
              }}
            />
          ) : null}
          <Text
            style={{
              flex: 1,
              fontFamily: fontFamily('regular'),
              fontSize: 19,
              lineHeight: 24,
              color: colors.brandDark,
              letterSpacing: -0.2,
            }}
            numberOfLines={2}
          >
            {name}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

// ── Parameter picker ──────────────────────────────────────
// A segmented-style picker for the primary parameter on the list.
// Every selected segment uses the same brand-accent light blue so
// the filter reads as a unified control rather than five individual
// per-parameter tints.
const PARAM_META: Record<ParamKey, { label: string; icon: string }> = {
  temp: { label: 'Temp', icon: 'thermometer-half' },
  hum:  { label: 'Fugt', icon: 'droplet' },
  co2:  { label: 'CO₂', icon: 'cloud' },
  voc:  { label: 'VOC', icon: 'wind' },
  pir:  { label: 'Tilstede', icon: 'person' },
};

function ParamPicker({
  value,
  onChange,
}: {
  value: ParamKey;
  onChange: (p: ParamKey) => void;
}) {
  const params: ParamKey[] = ['temp', 'hum', 'co2', 'voc', 'pir'];
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.08)',
        padding: 4,
        borderRadius: radius.md,
        gap: 4,
      }}
    >
      {params.map((p) => {
        const meta = PARAM_META[p];
        const active = p === value;
        return (
          <Pressable
            key={p}
            onPress={() => {
              haptic.select();
              onChange(p);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={meta.label}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingVertical: 10,
              paddingHorizontal: 8,
              borderRadius: radius.sm,
              backgroundColor: active ? colors.white : 'transparent',
              borderWidth: active ? 1 : 0,
              borderColor: active ? colors.brandAccent : 'transparent',
              shadowColor: '#000',
              shadowOpacity: active ? 0.18 : 0,
              shadowRadius: active ? 6 : 0,
              shadowOffset: { width: 0, height: 2 },
              elevation: active ? 2 : 0,
            }}
          >
            <Icon
              name={meta.icon}
              color={active ? colors.brandAccent : 'rgba(255,255,255,0.7)'}
              size={16}
            />
            <Text
              numberOfLines={1}
              style={{
                fontSize: 13,
                fontWeight: active ? '700' : '500',
                color: active ? colors.brandAccent : 'rgba(255,255,255,0.85)',
                letterSpacing: -0.1,
                flexShrink: 1,
              }}
            >
              {meta.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────
// Which hourly-aggregate column represents the param in the
// `/history?resolution=hourly` payload. Most params are averaged;
// presence is the only count-style aggregate (`pir_sum`).
const PARAM_AVG_KEY: Record<ParamKey, string> = {
  temp: 'temp_avg',
  hum: 'hum_avg',
  co2: 'co2_avg',
  voc: 'voc_avg',
  pir: 'pir_sum',
};

const TREND_MIN_DELTA: Record<ParamKey, number> = {
  temp: 0.1,
  hum: 1,
  co2: 20,
  voc: 5,
  // Presence trend compares hourly PIR counts: "more active than
  // before" takes a noticeable jump to qualify.
  pir: 3,
};

export default function SensorsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const activeTenantId = useTenantStore((s) => s.activeTenantId);
  const selectedLocationId = useSensorListPrefsStore((s) =>
    activeTenantId === null
      ? null
      : s.selectedLocationByTenant[String(activeTenantId)] ?? null,
  );
  const setSelectedLocation = useSensorListPrefsStore((s) => s.setSelectedLocation);

  const { data, isLoading, isError, error, refetch, isRefetching } = useSensorsFlat();
  const sensorTypesQuery = useSensorTypes();
  const locationsQuery = useLocations();
  const typeMap = useMemo(
    () => buildTypeParamsMap(sensorTypesQuery.data),
    [sensorTypesQuery.data],
  );

  const [primaryParam, setPrimaryParam] = useState<ParamKey>('temp');

  const allowed = useLocationFilter(data, (s) => s.locationId);

  const locationOptions = useMemo(
    () => buildLocationOptions(allowed, locationsQuery.data),
    [allowed, locationsQuery.data],
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

  const visible = useMemo(() => {
    if (!effectiveLocation) return [];
    return allowed.filter((s) => {
      if (!sensorMatchesLocation(s, effectiveLocation)) {
        return false;
      }
      return true;
    });
  }, [allowed, effectiveLocation]);

  // Batch threshold queries for visible sensors
  const thresholdQueries = useQueries({
    queries: visible.map((s) => ({
      queryKey: ['indeklima', 'sensor', s.id, 'thresholds', { tenantId: activeTenantId }],
      queryFn: () => indeklimaApi.getSensorThresholds(s.id),
      enabled: activeTenantId !== null,
      staleTime: cacheTiers.downsampled.staleTime,
      gcTime: cacheTiers.downsampled.gcTime,
    })),
  });

  const thresholdMap = useMemo(() => {
    const m = new Map<number, Record<string, { lower?: number; upper?: number }>>();
    visible.forEach((s, i) => {
      const data = thresholdQueries[i]?.data;
      if (data) m.set(s.id, data as Record<string, { lower?: number; upper?: number }>);
    });
    return m;
  }, [visible, thresholdQueries]);

  // Trend: small batched hourly fetch per visible sensor for the
  // last ~4h. Gives us enough points to tell rising from falling
  // without spamming the API. Capped at 24 sensors per screen to
  // avoid pathological cases.
  const trendFrom = useMemo(() => format(subHours(new Date(), 4), 'yyyy-MM-dd'), []);
  const trendTo = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const trendCandidates = visible.slice(0, 24);
  const trendQueries = useQueries({
    queries: trendCandidates.map((s) => ({
      queryKey: [
        'indeklima',
        'sensor',
        s.id,
        'trend',
        { from: trendFrom, to: trendTo, tenantId: activeTenantId },
      ],
      queryFn: () =>
        indeklimaApi.getSensorHistory(s.id, {
          resolution: 'hourly',
          from: trendFrom,
          to: trendTo,
        }),
      enabled: activeTenantId !== null,
      staleTime: cacheTiers.downsampled.staleTime,
      gcTime: cacheTiers.downsampled.gcTime,
    })),
  });

  const trendMap = useMemo(() => {
    const m = new Map<number, Trend>();
    trendCandidates.forEach((s, i) => {
      const data = trendQueries[i]?.data as
        | { resolution?: string; readings?: Array<Record<string, number | null>> }
        | undefined;
      const readings = data?.readings;
      if (!readings || readings.length < 2) {
        m.set(s.id, 'unknown');
        return;
      }
      const avgKey = PARAM_AVG_KEY[primaryParam];
      const first = readings[0]?.[avgKey];
      const last = readings[readings.length - 1]?.[avgKey];
      if (typeof first !== 'number' || typeof last !== 'number') {
        m.set(s.id, 'unknown');
        return;
      }
      const delta = last - first;
      const min = TREND_MIN_DELTA[primaryParam];
      if (Math.abs(delta) < min) m.set(s.id, 'flat');
      else m.set(s.id, delta > 0 ? 'up' : 'down');
    });
    return m;
  }, [trendCandidates, trendQueries, primaryParam]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary }} edges={['bottom']}>
      <AppHeader />

      {isError ? (
        <ErrorBanner message={(error as Error).message ?? t('errors.unknown')} />
      ) : null}

      <View
        style={{
          backgroundColor: colors.navy,
        }}
      >
        <LocationDropdown
          value={effectiveLocation}
          onChange={(id) => {
            if (activeTenantId !== null) {
              setSelectedLocation(activeTenantId, id);
            }
          }}
          options={locationOptions}
          label={t('indeklima.location_filter.label')}
        />

        <View
          style={{
            paddingHorizontal: spacing.md,
            paddingBottom: spacing.md,
          }}
        >
          <ParamPicker value={primaryParam} onChange={setPrimaryParam} />
        </View>
      </View>

      {isLoading ? <LoadingIndicator /> : null}

      <FlatList
        data={visible}
        keyExtractor={(s) => String(s.id)}
        renderItem={({ item }) => (
          <SensorCard
            sensor={item}
            showGroup
            onPress={() => { haptic.light(); router.push(`/sensor/${item.id}`); }}
            typeMap={typeMap}
            thresholds={thresholdMap.get(item.id)}
            primaryParam={primaryParam}
            trend={trendMap.get(item.id) ?? 'unknown'}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.navy}
          />
        }
        ListEmptyComponent={
          !isLoading ? (
            <View
              style={{
                marginHorizontal: spacing.md,
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
