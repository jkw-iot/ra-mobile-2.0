// ══════════════════════════════════════════════════════════════
// Sensor detail — KPI tiles + history chart + metadata.
// Uses the tiered cache strategy (raw / hourly) depending on
// selected period.
// ══════════════════════════════════════════════════════════════
import { View, Text, ScrollView, Pressable, useWindowDimensions, RefreshControl } from 'react-native';
import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, subDays, subMonths, subYears } from 'date-fns';

import {
  PageHeading,
  SectionCard,
  SegmentedControl,
  LoadingIndicator,
  ErrorBanner,
  Icon,
  StatusDot,
} from '@/components';
import { colors, radius, spacing, type } from '@/theme';
import { useSensor, useSensorHistoryRaw, useSensorHistoryHourly } from '@/features/indeklima/hooks';
import { LineChart, type LinePoint } from '@/features/indeklima/LineChart';
import type { StatusTone } from '@/theme';
import type { HistoryResponse, Sensor } from '@/services/api';

type Period = 'day' | 'week' | 'month' | 'year';
type Param = 'temp' | 'hum' | 'co2' | 'voc';

function toneFromStatus(c: Sensor['statusColor']): StatusTone {
  if (c === 'green') return 'good';
  if (c === 'red') return 'bad';
  return 'neutral';
}

function fmtNum(v: number | string | undefined, digits = 1): string {
  if (v == null || v === '-' || v === '') return '—';
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(digits);
}

function formatSensorTime(raw: string | undefined): string {
  if (!raw) return '—';
  if (raw.length <= 8) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  const MONTHS_DA = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  return `${d.getDate()}. ${MONTHS_DA[d.getMonth()]}`;
}

function ymd(d: Date) {
  return format(d, 'yyyy-MM-dd');
}

function KpiTile({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.gray[200],
        borderRadius: radius.md,
        padding: spacing.md,
        minHeight: 84,
        justifyContent: 'space-between',
      }}
    >
      <Text style={type.sectionLabel}>{label}</Text>
      <Text
        style={{
          fontSize: 22,
          fontWeight: '700',
          color: colors.brandDark,
          marginTop: 4,
        }}
      >
        {value} <Text style={type.caption}>{unit}</Text>
      </Text>
    </View>
  );
}

// Convert a history response (raw or hourly) to simple line points for one param.
function historyToPoints(
  hist: HistoryResponse | undefined,
  param: Param,
): LinePoint[] {
  if (!hist) return [];
  // Hourly shape
  if (!Array.isArray(hist) && 'resolution' in hist && hist.resolution === 'hourly') {
    return hist.readings.map((r) => {
      const raw = r[`${param}_avg` as keyof typeof r];
      const v = raw == null ? null : typeof raw === 'number' ? raw : Number(raw);
      return {
        t: new Date(r.hour_ts.replace(' ', 'T')).getTime(),
        v: v == null || !Number.isFinite(v) ? null : v,
      };
    });
  }
  // Raw shape
  if (Array.isArray(hist)) {
    return hist.map((r) => {
      const raw = r[param];
      const v = raw == null ? null : Number(raw);
      return {
        t: r.timestamp * 1000,
        v: v == null || !Number.isFinite(v) ? null : v,
      };
    });
  }
  return [];
}

export default function SensorDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const id = idParam ? Number(idParam) : null;
  const { width } = useWindowDimensions();

  const [period, setPeriod] = useState<Period>('day');
  const [param, setParam] = useState<Param>('temp');

  const { data: sensor, isLoading: sensorLoading, isError, error, refetch, isRefetching } = useSensor(id);

  const { dateRange, useRaw } = useMemo(() => {
    const now = new Date();
    if (period === 'day') return { dateRange: { from: ymd(now), to: ymd(now) }, useRaw: true };
    if (period === 'week') return { dateRange: { from: ymd(subDays(now, 7)), to: ymd(now) }, useRaw: false };
    if (period === 'month') return { dateRange: { from: ymd(subMonths(now, 1)), to: ymd(now) }, useRaw: false };
    return { dateRange: { from: ymd(subYears(now, 1)), to: ymd(now) }, useRaw: false };
  }, [period]);

  const raw = useSensorHistoryRaw(useRaw ? id : null, dateRange.from);
  const hourly = useSensorHistoryHourly(!useRaw ? id : null, dateRange.from, dateRange.to);

  const historyData = useRaw ? raw.data : hourly.data;
  const historyLoading = useRaw ? raw.isLoading : hourly.isLoading;

  const points = useMemo(() => historyToPoints(historyData, param), [historyData, param]);

  if (sensorLoading) return <LoadingIndicator />;

  if (!sensor) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary }} edges={['top']}>
        <PageHeading
          icon="thermometer-half"
          title={t('common.error')}
        >
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              marginBottom: 4,
            }}
          >
            <Icon name="chevron-left" color={colors.brandAccent} size={16} />
            <Text style={[type.caption, { color: colors.brandAccent }]}>
              {t('common.back')}
            </Text>
          </Pressable>
        </PageHeading>
        <ErrorBanner message={t('common.empty')} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary }} edges={['top']}>
      <PageHeading
        icon={sensor.icon ?? 'thermometer-half'}
        title={sensor.name}
        subtitle={[sensor.groupTitle, ...(sensor.path ?? [])].join(' / ')}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            marginBottom: 4,
          }}
        >
          <Icon name="chevron-left" color={colors.brandAccent} size={16} />
          <Text style={[type.caption, { color: colors.brandAccent }]}>
            {t('common.back')}
          </Text>
        </Pressable>
      </PageHeading>

      {isError ? <ErrorBanner message={(error as Error).message ?? t('errors.unknown')} /> : null}

      <ScrollView
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching || raw.isRefetching || hourly.isRefetching}
            onRefresh={refetch}
            tintColor={colors.brandAccent}
          />
        }
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <StatusDot tone={toneFromStatus(sensor.statusColor)} size={10} />
          <Text style={type.caption}>
            {t('indeklima.sensor_detail.last_update')}: {formatSensorTime(sensor.time)}
          </Text>
        </View>

        {/* KPI row */}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <KpiTile
            label={t('indeklima.sensor_detail.params.temp')}
            value={fmtNum(sensor.temp)}
            unit={sensor.tempUnit ?? '°C'}
          />
          <KpiTile
            label={t('indeklima.sensor_detail.params.hum')}
            value={fmtNum(sensor.hum, 0)}
            unit={sensor.humUnit ?? '%'}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <KpiTile
            label={t('indeklima.sensor_detail.params.co2')}
            value={fmtNum(sensor.co2, 0)}
            unit={sensor.co2Unit ?? 'ppm'}
          />
          <KpiTile
            label={t('indeklima.sensor_detail.params.voc')}
            value={fmtNum(sensor.voc, 0)}
            unit={sensor.vocUnit ?? 'ppb'}
          />
        </View>

        {/* Meta row */}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: colors.white,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.gray[200],
              padding: spacing.sm,
            }}
          >
            <Icon name="battery-half" color={colors.gray[600]} size={16} />
            <Text style={type.caption}>
              {t('indeklima.sensor_detail.battery')}: {sensor.battery}
            </Text>
          </View>
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: colors.white,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.gray[200],
              padding: spacing.sm,
            }}
          >
            <Icon name="broadcast" color={colors.gray[600]} size={16} />
            <Text style={type.caption}>
              {t('indeklima.sensor_detail.signal')}: {sensor.coverage}/4
            </Text>
          </View>
        </View>

        {/* History */}
        <SectionCard title={t('indeklima.sensor_detail.history')} icon="graph-up">
          <View style={{ gap: spacing.sm }}>
            <SegmentedControl
              value={period}
              onChange={setPeriod}
              options={[
                { id: 'day',   label: t('indeklima.sensor_detail.period.day') },
                { id: 'week',  label: t('indeklima.sensor_detail.period.week') },
                { id: 'month', label: t('indeklima.sensor_detail.period.month') },
                { id: 'year',  label: t('indeklima.sensor_detail.period.year') },
              ]}
              ariaLabel={t('indeklima.sensor_detail.history')}
            />
            <SegmentedControl
              value={param}
              onChange={setParam}
              options={[
                { id: 'temp', label: t('indeklima.sensor_detail.params.temp') },
                { id: 'hum',  label: t('indeklima.sensor_detail.params.hum') },
                { id: 'co2',  label: t('indeklima.sensor_detail.params.co2') },
                { id: 'voc',  label: t('indeklima.sensor_detail.params.voc') },
              ]}
              size="sm"
            />
            {historyLoading ? (
              <LoadingIndicator inline />
            ) : (
              <LineChart
                points={points}
                width={width - spacing.md * 2 - spacing.md * 2}
                unit={
                  param === 'temp'
                    ? sensor.tempUnit ?? '°C'
                    : param === 'hum'
                    ? sensor.humUnit ?? '%'
                    : param === 'co2'
                    ? sensor.co2Unit ?? 'ppm'
                    : sensor.vocUnit ?? 'ppb'
                }
              />
            )}
          </View>
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}
