// ══════════════════════════════════════════════════════════════
// Vanddetektering — Dashboard.
//
// Mirrors the web Dashboard (`roomalyzer20/src/pages/water/
// Dashboard.jsx`) for mobile: a 2x2 KPI grid (active alarms,
// silent devices, average response time, low battery) and a
// scrollable live feed of alarms / silent / heartbeats.
//
// Visual chrome follows the indeklima screens. There's no inline
// admin settings UI: the silent threshold is controlled from the
// web app.
//
// Pull-to-refresh forces both endpoints (`/waterdetection/dashboard`
// + `/admin/sensors`) to revalidate so users can confirm the
// latest state without waiting for the 10 s auto-refresh tick.
// ══════════════════════════════════════════════════════════════
import { useCallback, useMemo, useState } from "react";
import { ScrollView, View, Text, RefreshControl, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  AppHeader,
  ErrorBanner,
  ErrorState,
  Icon,
  KpiTile,
  LoadingIndicator,
  SectionCard,
} from "@/components";
import { colors, radius, spacing } from "@/theme";
import { haptic } from "@/lib/haptics";
import { friendlyApiErrorMessage, isBackendUnreachable } from "@/lib/apiErrorMessage";

import { useWaterDashboard } from "./hooks";
import { buildFeedEvents, avgResponseMinutes } from "./helpers";
import { LiveFeed } from "./LiveFeed";
import {
  AcknowledgeSheet,
  type AcknowledgeSheetProps,
} from "./AcknowledgeSheet";

export default function WaterDashboardScreen() {
  const { t } = useTranslation();
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const { data, isLoading, isError, error, refetch } = useWaterDashboard();

  const kpi = data?.kpi;
  const activeAlarms = data?.activeAlarms ?? [];
  const silentSensors = data?.silentSensors ?? [];
  const heartbeats = data?.recentHeartbeats ?? [];
  const totalSensors = kpi?.total ?? 0;

  const alarmCount = useMemo(
    () => activeAlarms.filter((a) => a.status !== "dry_unacked").length,
    [activeAlarms],
  );
  const dryUnackedCount = useMemo(
    () => activeAlarms.filter((a) => a.status === "dry_unacked").length,
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

  const onRefresh = useCallback(async () => {
    haptic.light();
    setIsManualRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsManualRefreshing(false);
    }
  }, [refetch]);

  // ── Acknowledge flow ───────────────────────────────────────
  // The bottom-sheet covers both single-alarm and bulk
  // acknowledgement. `target` doubles as the "open" flag — null
  // means closed.
  const [ackTarget, setAckTarget] =
    useState<AcknowledgeSheetProps["target"]>(null);

  const openAckForAlarm = useCallback(
    (alarmId: number) => {
      const alarm = activeAlarms.find((a) => a.id === alarmId);
      if (!alarm) return;
      setAckTarget({
        mode: "single",
        alarmId,
        sensorName: alarm.sensorName ?? alarm.sensorId ?? "—",
        location: alarm.location ?? null,
      });
    },
    [activeAlarms],
  );

  const openAckAll = useCallback(() => {
    const total = activeAlarms.length;
    if (total < 2) return;
    haptic.light();
    setAckTarget({ mode: "bulk", activeCount: total });
  }, [activeAlarms.length]);

  const closeAck = useCallback(() => setAckTarget(null), []);

  // ── Top-level states ───────────────────────────────────────

  if (isLoading && !data) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.bgPrimary }}
        edges={["bottom"]}
      >
        <AppHeader />
        <LoadingIndicator />
      </SafeAreaView>
    );
  }

  if (isError && !data) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.bgPrimary }}
        edges={["bottom"]}
      >
        <AppHeader />
        <ErrorState
          title={isBackendUnreachable(error) ? t("errors.legacy_unavailable_title") : t("errors.unknown")}
          message={isBackendUnreachable(error) ? t("errors.legacy_unavailable") : (error as Error)?.message}
          actions={[
            {
              label: t("common.retry"),
              icon: "arrow-clockwise",
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
        edges={["bottom"]}
      >
        <AppHeader />
        <ErrorState
          tone="empty"
          icon="droplet"
          title={t("water.dashboard.no_sensors")}
          message={t("water.dashboard.no_sensors_subtitle")}
        />
      </SafeAreaView>
    );
  }

  // ── KPI tones / colours ────────────────────────────────────

  const totalActive = alarmCount + dryUnackedCount;
  const alarmIcon =
    alarmCount > 0
      ? "exclamation-triangle-fill"
      : dryUnackedCount > 0
        ? "droplet-half"
        : "check-circle-fill";
  const alarmColor =
    alarmCount > 0
      ? colors.statusBad
      : dryUnackedCount > 0
        ? colors.statusOrange
        : colors.statusGood;

  const silentIcon = silentCount > 0 ? "volume-mute" : "wifi";

  const lowBatteryIcon = lowBatteryCount > 0 ? "battery-low" : "battery-full";
  const lowBatteryColor =
    lowBatteryCount > 0 ? colors.statusWarn : colors.statusGood;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bgPrimary }}
      edges={["bottom"]}
    >
      <AppHeader />

      {isError ? (
        <ErrorBanner message={friendlyApiErrorMessage(error, t)} />
      ) : null}
      <ScrollView
        contentContainerStyle={{
          paddingBottom: spacing.xl + 80,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isManualRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.navy}
          />
        }
      >
        {/* KPI grid 2x2 */}
        <View
          style={{
            backgroundColor: colors.navy,
            paddingHorizontal: spacing.xs,
            paddingTop: spacing.xs,
            paddingBottom: spacing.md,
            gap: spacing.sm,
          }}
        >
          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <KpiTile
                variant="dark"
                label={t("water.dashboard.kpi.active_alarms")}
                value={String(totalActive)}
                icon={alarmIcon}
                iconColor={alarmColor}
                valueColor={alarmColor}
              />
              <KpiTile
                variant="dark"
                label={t("water.dashboard.kpi.silent_devices")}
                value={String(silentCount)}
                icon={silentIcon}
                iconColor={
                  silentCount > 0 ? colors.statusWarn : colors.statusGood
                }
                valueColor={
                  silentCount > 0 ? colors.statusWarn : colors.statusGood
                }
              />
            </View>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <KpiTile
                variant="dark"
                label={t("water.dashboard.kpi.avg_response")}
                value={String(avgResponse)}
                unit={t("water.dashboard.unit_min")}
                icon="stopwatch"
                iconColor="rgba(255,255,255,0.72)"
              />
              <KpiTile
                variant="dark"
                label={t("water.dashboard.kpi.low_battery")}
                value={String(lowBatteryCount)}
                icon={lowBatteryIcon}
                iconColor={lowBatteryColor}
                valueColor={lowBatteryColor}
              />
            </View>
          </View>
        </View>

        {/* Live feed */}
        <View
          style={{
            paddingHorizontal: spacing.md,
            paddingTop: spacing.md,
          }}
        >
          <SectionCard
            title={t("water.dashboard.live_feed")}
            icon="broadcast"
            headerShaded
            padding={0}
            trailing={
              activeAlarms.length > 1 ? (
                <Pressable
                  onPress={openAckAll}
                  accessibilityRole="button"
                  accessibilityLabel={t("water.alarms.ack_all_count", {
                    count: activeAlarms.length,
                  })}
                  hitSlop={6}
                  style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: radius.full,
                      backgroundColor: colors.navy,
                    }}
                  >
                    <Icon
                      name="check2-all"
                      color={colors.white}
                      size={12}
                    />
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "700",
                        color: colors.white,
                        letterSpacing: 0.2,
                      }}
                    >
                      {t("water.alarms.ack_all_count", {
                        count: activeAlarms.length,
                      })}
                    </Text>
                  </View>
                </Pressable>
              ) : (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Icon
                    name="arrow-clockwise"
                    color={colors.gray[400]}
                    size={11}
                  />
                  <Text
                    style={{
                      fontSize: 10,
                      color: colors.gray[500],
                      fontWeight: "600",
                    }}
                  >
                    {t("water.dashboard.auto_refresh").toUpperCase()}
                  </Text>
                </View>
              )
            }
          >
            <LiveFeed
              sections={feed}
              onAcknowledgeAlarm={openAckForAlarm}
            />
          </SectionCard>
        </View>
      </ScrollView>

      <AcknowledgeSheet
        open={ackTarget !== null}
        target={ackTarget}
        onClose={closeAck}
        onAcknowledged={() => {
          // Kick off a quick refresh so optimistic UI is correct
          // without waiting for the 10s auto-refresh tick.
          refetch();
        }}
      />
    </SafeAreaView>
  );
}
