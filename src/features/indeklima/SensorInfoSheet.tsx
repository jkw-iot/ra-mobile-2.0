// ══════════════════════════════════════════════════════════════
// SensorInfoSheet — combined bottom-sheet for scenario, battery,
// and coverage details.
//
// Replaces the three separate sheets (ScenarioDetailSheet,
// battery InfoSheet, coverage InfoSheet) with a single modal
// that shows all sensor meta-information in one place. Opened
// by tapping the composite status strip in the navy hero.
// ══════════════════════════════════════════════════════════════
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Icon, StatusBar as LevelBar } from '@/components';
import type { StatusBarZone } from '@/components';
import { colors, radius, spacing, type } from '@/theme';
import { findScenarioById } from './scenarios';
import {
  bandForParam,
  hasThresholds,
  normalizeThresholds,
  type Param,
} from './thresholds';
import type { ScenarioScopeSource, EffectiveScenario } from './hooks';

// ── Types ─────────────────────────────────────────────────

interface SensorInfoSheetProps {
  open: boolean;
  onClose: () => void;

  sensorName: string;

  scenario: EffectiveScenario | null;
  availableParams: readonly Param[];

  batteryIcon: string;
  batteryTone: string;
  batteryLabel: string;
  batteryExplainKey: string;
  batteryRaw: number;
  batteryDisplay: string;
  batteryScaleLabel: string;
  batteryBarZones: StatusBarZone[];

  coverageIcon: string;
  coverageTone: string;
  coverageLabel: string;
  coverageExplainKey: string;
  coverageSignalLevel: number;
  coverageDisplay: string;
  coverageBarZones: StatusBarZone[];
}

// ── Threshold param catalogue ─────────────────────────────

const PARAMS: readonly { key: Param; unit: string; icon: string; tint: string }[] = [
  { key: 'temp', unit: '°C',  icon: 'thermometer-half', tint: '#d65b5b' },
  { key: 'hum',  unit: '%',   icon: 'droplet',          tint: '#3498DB' },
  { key: 'co2',  unit: 'ppm', icon: 'cloud',            tint: '#5b8fa1' },
  { key: 'voc',  unit: 'ppb', icon: 'wind',             tint: '#7a8c7e' },
];

function fmt(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

// ── Divider ───────────────────────────────────────────────

function Divider() {
  return (
    <View
      style={{
        height: 1,
        backgroundColor: colors.gray[200],
        marginVertical: spacing.lg,
      }}
    />
  );
}

// ── Sheet ─────────────────────────────────────────────────

export function SensorInfoSheet({
  open,
  onClose,
  sensorName,
  scenario,
  availableParams,
  batteryIcon,
  batteryTone,
  batteryLabel,
  batteryExplainKey,
  batteryRaw,
  batteryDisplay,
  batteryScaleLabel,
  batteryBarZones,
  coverageIcon,
  coverageTone,
  coverageLabel,
  coverageExplainKey,
  coverageSignalLevel,
  coverageDisplay,
  coverageBarZones,
}: SensorInfoSheetProps) {
  const { t } = useTranslation();

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        {/* Scrim — separate layer so it doesn't compete with
            ScrollView for gesture recognition. */}
        <Pressable
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.45)',
          }}
          onPress={onClose}
        />

        {/* Sheet — plain View, not Pressable. The scrim is a
            separate sibling behind us (absolute-positioned), so
            touches here never reach it — no responder trick needed. */}
        <View
          style={{
            backgroundColor: colors.white,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingTop: spacing.lg,
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.xxl,
            maxHeight: '80%',
          }}
        >
          {/* drag handle */}
          <View
            style={{
              alignSelf: 'center',
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.gray[200],
              marginBottom: spacing.md,
            }}
          />

          <ScrollView
            showsVerticalScrollIndicator
            contentContainerStyle={{ gap: spacing.xs }}
          >
            {/* ── Sheet title + close button ────────────── */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
              <Text style={[type.pageTitle, { fontSize: 18, flex: 1 }]} numberOfLines={2}>
                {sensorName}
              </Text>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
                hitSlop={8}
                style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.gray[100],
                  }}
                >
                  <Icon name="x" color={colors.gray[600]} size={16} />
                </View>
              </Pressable>
            </View>

            {/* ── Scenario section (conditional) ──────── */}
            {scenario ? (
              <ScenarioSection
                scenario={scenario}
                availableParams={availableParams}
              />
            ) : null}

            {scenario ? <Divider /> : null}

            {/* ── Battery section ─────────────────────── */}
            <SectionRow
              icon={batteryIcon}
              iconColor={batteryTone}
              title={`${t('indeklima.sensor_detail.battery.label')}: ${batteryLabel}`}
            />
            <Text style={[type.caption, { color: colors.gray[500] }]}>
              {t(batteryExplainKey)}
            </Text>
            {Number.isFinite(batteryRaw) && batteryRaw > 0 ? (
              <View style={{ gap: spacing.sm }}>
                <Text style={[type.caption, { color: colors.gray[500], fontVariant: ['tabular-nums'] }]}>
                  {t('indeklima.sensor_detail.battery.raw_label')}: {batteryDisplay}
                </Text>
                <LevelBar zones={batteryBarZones} />
                <Text style={{ fontSize: 9, color: colors.gray[400], fontVariant: ['tabular-nums'] }}>
                  {batteryScaleLabel}
                </Text>
              </View>
            ) : null}

            <Divider />

            {/* ── Coverage section ────────────────────── */}
            <SectionRow
              icon={coverageIcon}
              iconColor={coverageTone}
              title={`${t('indeklima.sensor_detail.coverage.label')}: ${coverageLabel}`}
            />
            <Text style={[type.caption, { color: colors.gray[500] }]}>
              {t(coverageExplainKey)}
            </Text>
            {coverageSignalLevel > 0 ? (
              <View style={{ gap: spacing.sm }}>
                <Text style={[type.caption, { color: colors.gray[500], fontVariant: ['tabular-nums'] }]}>
                  {t('indeklima.sensor_detail.coverage.rssi_label')}: {coverageDisplay}
                </Text>
                <LevelBar zones={coverageBarZones} />
                <Text style={{ fontSize: 9, color: colors.gray[400], fontVariant: ['tabular-nums'] }}>
                  −110 · −100 · −80 dBm
                </Text>
              </View>
            ) : null}

            {/* ── Close button ────────────────────────── */}
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              style={({ pressed }) => ({
                marginTop: spacing.md,
                alignItems: 'center',
                paddingVertical: spacing.md,
                borderRadius: radius.md,
                backgroundColor: pressed ? colors.gray[200] : colors.gray[100],
              })}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '700',
                  color: colors.brandDark,
                }}
              >
                {t('common.close')}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Section header row ────────────────────────────────────

function SectionRow({
  icon,
  iconColor,
  title,
}: {
  icon: string;
  iconColor: string;
  title: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.bgPrimary,
        }}
      >
        <Icon name={icon} color={iconColor} size={18} />
      </View>
      <Text style={[type.pageTitle, { fontSize: 16, flex: 1 }]} numberOfLines={2}>
        {title}
      </Text>
    </View>
  );
}

// ── Scenario section ──────────────────────────────────────

function ScenarioSection({
  scenario,
  availableParams,
}: {
  scenario: EffectiveScenario;
  availableParams: readonly Param[];
}) {
  const { t } = useTranslation();
  const meta = findScenarioById(scenario.scenarioId);

  const scenarioName = meta
    ? t(`indeklima.scenarios.${meta.labelKey}`)
    : scenario.scenarioId;
  const scenarioDesc = meta?.descKey
    ? t(`indeklima.scenarios.${meta.descKey}`)
    : '';
  const scopeLabel = t(`indeklima.sensor_detail.scenario.scope_${scenario.source}`);

  const normalised = normalizeThresholds(
    scenario.thresholds as Parameters<typeof normalizeThresholds>[0],
  );
  const supportedSet = new Set(availableParams);
  const visibleParams = PARAMS.filter(
    (p) => supportedSet.has(p.key) && hasThresholds(normalised, p.key),
  );

  return (
    <View style={{ gap: spacing.sm }}>
      {/* Header — icon + name + scope */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.bgPrimary,
          }}
        >
          <Icon
            name={meta?.icon ?? 'sliders'}
            color={colors.brand}
            size={18}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[type.pageTitle, { fontSize: 16 }]} numberOfLines={2}>
            {scenarioName}
          </Text>
          <Text
            style={[type.caption, { fontSize: 11, color: colors.gray[500], marginTop: 1 }]}
            numberOfLines={1}
          >
            {scopeLabel}
          </Text>
        </View>
      </View>

      {/* Description */}
      {scenarioDesc ? (
        <View style={{ gap: 4 }}>
          <Text style={type.sectionLabel}>
            {t('indeklima.sensor_detail.scenario.description_heading').toUpperCase()}
          </Text>
          <Text style={type.body}>{scenarioDesc}</Text>
        </View>
      ) : null}

      {/* Threshold rows */}
      <View style={{ gap: 4 }}>
        <Text style={type.sectionLabel}>
          {t('indeklima.sensor_detail.scenario.thresholds_heading').toUpperCase()}
        </Text>
        {visibleParams.length === 0 ? (
          <Text style={type.caption}>
            {t('indeklima.sensor_detail.scenario.no_thresholds')}
          </Text>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {visibleParams.map((p) => {
              const band = bandForParam(normalised, p.key);
              const greenLow = band?.lower;
              const greenHigh = band?.upper;
              const warnLow = band?.yellowLower;
              const warnHigh = band?.yellowUpper;

              let greenLine: string;
              if (greenLow != null && greenHigh != null) {
                greenLine = t('indeklima.sensor_detail.scenario.range_between', {
                  low: fmt(greenLow),
                  high: fmt(greenHigh),
                  unit: p.unit,
                });
              } else if (greenHigh != null) {
                greenLine = t('indeklima.sensor_detail.scenario.range_below', {
                  value: fmt(greenHigh),
                  unit: p.unit,
                });
              } else if (greenLow != null) {
                greenLine = t('indeklima.sensor_detail.scenario.range_above', {
                  value: fmt(greenLow),
                  unit: p.unit,
                });
              } else {
                greenLine = '—';
              }

              const hasWarn =
                (warnLow != null && greenLow != null && warnLow < greenLow)
                || (warnHigh != null && greenHigh != null && warnHigh > greenHigh);

              return (
                <View
                  key={p.key}
                  style={{
                    padding: spacing.md,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: colors.gray[200],
                    backgroundColor: colors.gray[50],
                    gap: 4,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Icon name={p.icon} color={p.tint} size={14} />
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '700',
                        color: colors.brandDark,
                        letterSpacing: -0.1,
                        flex: 1,
                      }}
                    >
                      {t(`indeklima.sensor_detail.params.${p.key}`)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: colors.statusGood,
                      }}
                    />
                    <Text style={[type.body, { fontSize: 14, flex: 1 }]}>
                      {greenLine}
                    </Text>
                  </View>
                  {hasWarn ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: colors.statusWarn,
                        }}
                      />
                      <Text style={[type.caption, { fontSize: 12, flex: 1 }]}>
                        {t('indeklima.sensor_detail.scenario.range_warn_band', {
                          low: fmt(warnLow ?? greenLow),
                          high: fmt(warnHigh ?? greenHigh),
                          unit: p.unit,
                        })}
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

export default SensorInfoSheet;
