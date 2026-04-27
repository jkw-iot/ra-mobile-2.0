// ══════════════════════════════════════════════════════════════
// Vanddetektering — Dashboard.
//
// Mirrors the web Dashboard (`roomalyzer20/src/pages/water/
// Dashboard.jsx`) for mobile: a 2x2 KPI grid (active alarms,
// silent devices, average response time, low battery) and a
// scrollable live feed of alarms / silent / heartbeats.
//
// Visual chrome follows the indeklima screens — the navy
// AppHeader bleeds straight into a navy heading band before the
// content starts on the bg-primary surface. There's no inline
// admin settings UI: the silent threshold is controlled from the
// web app.
//
// Pull-to-refresh forces both endpoints (`/waterdetection/dashboard`
// + `/admin/sensors`) to revalidate so users can confirm the
// latest state without waiting for the 10 s auto-refresh tick.
// ══════════════════════════════════════════════════════════════
import { useCallback, useMemo } from 'react';
import { ScrollView, View, Text, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AppHeader,
  ErrorBanner,
  ErrorState,
  Icon,
  KpiTile,
  LoadingIndicator,
  SectionCard,
} from '@/components';
import { colors, spacing } from '@/theme';
import { haptic } from '@/lib/haptics';

import { useWaterDashboard } from './hooks';
import { buildFeedEvents, avgResponseMinutes } from './helpers';
import { LiveFeed } from './LiveFeed';

// ── Header ────────────────────────────────────────────────────
//
// Replaces the white `<PageHeading>` for this screen with a navy
// band that matches the indeklima sensor list / map chrome — the
// AppHeader, the location-picker strip and this title share the
// same surface so the visual rhythm reads as one calm dark band
// before the content cards start.
function DashboardHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.navy,
        paddingHorizontal: spacing.md,
        paddingTop: spacing.xs,
        paddingBottom: spacing.md,
      }}
    >
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
      >
        <Icon name="droplet" color={colors.white} size={22} />
        <Text
          numberOfLines={1}
          style={{
            fontSize: 22,
            fontWeight: '700',
            color: colors.white,
            letterSpacing: -0.3,
          }}
        >
          {title}
        </Text>
      </View>
      <Text
        numberOfLines={2}
        style={{
          fontSize: 12,
          color: 'rgba(255,255,255,0.65)',
          marginTop: 2,
        }}
      >
        {subtitle}
      </Text>
    </View>
  );
}

export default function WaterDashboardScreen() {
  const { t } = useTranslation();

  const { data, isLoading, isError, error, refetch, isRefetching } =
    useWaterDashboard();

  const kpi = data?.kpi;
  const activeAlarms = data?.activeAlarms ?? [];
  const silentSensors = data?.silentSensors ?? [];
  const heartbeats = data?.recentHeartbeats ?? [];
  const totalSensors = kpi?.total ?? 0;

  const alarmCount = useMemo(
    () => activeAlarms.filter((a) => a.status !== 'dry_unacked').length,
    [activeAlarms],
  );
  const dryUnackedCount = useMemo(
    () => activeAlarms.filter((a) => a.status === 'dry_unacked').length,
    [activeAlarms],
  );
  const silentCount = silentSensors.length;
  const lowBatteryCount = kpi?.lowBattery ?? 0;
  const avgResponse = useMemo(
    () => avgResponseMinutes(activeAlarms),
    [activeAlarms],
  );

  const feed = useMemo(
    () => buildFeedEvents(activeAlarms, silentSensors, heartbeats),
    [activeAlarms, silentSensors, heartbeats],
  );

  const onRefresh = useCallback(() => {
    haptic.light();
    refetch();
  }, [refetch]);

  // ── Top-level states ───────────────────────────────────────

  const headingTitle = t('water.dashboard.title');
  const headingSubtitle = t('water.dashboard.subtitle');

  if (isLoading && !data) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.bgPrimary }}
        edges={['bottom']}
      >
        <AppHeader />
        <DashboardHeading title={headingTitle} subtitle={headingSubtitle} />
        <LoadingIndicator />
      </SafeAreaView>
    );
  }

  if (isError && !data) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.bgPrimary }}
        edges={['bottom']}
      >
        <AppHeader />
        <DashboardHeading title={headingTitle} subtitle={headingSubtitle} />
        <ErrorState
          title={t('errors.unknown')}
          message={(error as Error)?.message}
          actions={[
            {
              label: t('common.retry'),
              icon: 'arrow-clockwise',
              onPress: () => refetch(),
            },
          ]}
        />
      </SafeAreaView>
    );
  }

  if (totalSensors === 0) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.bgPrimary }}
        edges={['bottom']}
      >
        <AppHeader />
        <DashboardHeading title={headingTitle} subtitle={headingSubtitle} />
        <ErrorState
          tone="empty"
          icon="droplet"
          title={t('water.dashboard.no_sensors')}
          message={t('water.dashboard.no_sensors_subtitle')}
        />
      </SafeAreaView>
    );
  }

  // ── KPI tones / colours ────────────────────────────────────

  const totalActive = alarmCount + dryUnackedCount;
  const alarmIcon =
    alarmCount > 0
      ? 'exclamation-triangle-fill'
      : dryUnackedCount > 0
        ? 'droplet-half'
        : 'check-circle-fill';
  const alarmColor =
    alarmCount > 0
      ? colors.statusBad
      : dryUnackedCount > 0
        ? colors.statusOrange
        : colors.statusGood;

  const silentIcon = silentCount > 0 ? 'volume-mute' : 'wifi';
  const silentColor = silentCount > 0 ? colors.gray[600] : colors.statusGood;

  const lowBatteryIcon = lowBatteryCount > 0 ? 'battery-low' : 'battery-full';
  const lowBatteryColor =
    lowBatteryCount > 0 ? colors.statusWarn : colors.statusGood;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bgPrimary }}
      edges={['bottom']}
    >
      <AppHeader />

      {isError ? (
        <ErrorBanner
          message={(error as Error).message ?? t('errors.unknown')}
        />
      ) : null}

      <DashboardHeading title={headingTitle} subtitle={headingSubtitle} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.md,
          paddingTop: spacing.md,
          paddingBottom: spacing.xl + 80,
          gap: spacing.md,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.navy}
          />
        }
      >
        {/* KPI grid 2x2 */}
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <KpiTile
              label={t('water.dashboard.kpi.active_alarms')}
              value={String(totalActive)}
              icon={alarmIcon}
              iconColor={alarmColor}
              valueColor={alarmColor}
            />
            <KpiTile
              label={t('water.dashboard.kpi.silent_devices')}
              value={String(silentCount)}
              icon={silentIcon}
              iconColor={silentColor}
              valueColor={silentColor}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <KpiTile
              label={t('water.dashboard.kpi.avg_response')}
              value={String(avgResponse)}
              unit={t('water.dashboard.unit_min')}
              icon="stopwatch"
              iconColor={colors.gray[600]}
              valueColor={colors.brandDark}
            />
            <KpiTile
              label={t('water.dashboard.kpi.low_battery')}
              value={String(lowBatteryCount)}
              icon={lowBatteryIcon}
              iconColor={lowBatteryColor}
              valueColor={lowBatteryColor}
            />
          </View>
        </View>

        {/* Sub-line: dry-unacked secondary count */}
        {dryUnackedCount > 0 && alarmCount > 0 ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: spacing.xs,
            }}
          >
            <Icon name="droplet-half" color={colors.statusOrange} size={12} />
            <Text
              style={{
                fontSize: 11,
                fontWeight: '600',
                color: colors.statusOrange,
              }}
            >
              {t('water.dashboard.kpi_dry_unacked_sub', {
                count: dryUnackedCount,
              })}
            </Text>
          </View>
        ) : null}

        {/* Live feed */}
        <SectionCard
          title={t('water.dashboard.live_feed')}
          icon="broadcast"
          headerShaded
          padding={0}
          trailing={
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Icon name="arrow-clockwise" color={colors.gray[400]} size={11} />
              <Text
                style={{
                  fontSize: 10,
                  color: colors.gray[500],
                  fontWeight: '600',
                }}
              >
                {t('water.dashboard.auto_refresh').toUpperCase()}
              </Text>
            </View>
          }
        >
          <LiveFeed sections={feed} />
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}
