// ══════════════════════════════════════════════════════════════
// ScenarioDetailSheet — bottom-sheet shown when the user taps
// the scenario badge in the navy hero.
//
// Shows:
//   - Scenario icon + name + scope source ("Inherited from
//     location" / "Global default" / "Assigned to this sensor")
//   - The translated description ("hvad er vigtigt for
//     scenariet")
//   - The current effective limits per parameter, rendered as
//     compact "between X – Y", "below X" or "above X" rows that
//     match the chart's threshold zones.
//
// All threshold values come from the live API response, NOT
// from a duplicate of the web's threshold defaults — so users
// always see the limits actually applied to this sensor, even
// when they've been customised on top of a scenario.
// ══════════════════════════════════════════════════════════════
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components';
import { colors, radius, spacing, type } from '@/theme';
import { findScenarioById } from './scenarios';
import {
  bandForParam,
  hasThresholds,
  normalizeThresholds,
  type Param,
} from './thresholds';
import type { ScenarioScopeSource } from './hooks';

interface ScenarioDetailSheetProps {
  open: boolean;
  onClose: () => void;
  scenarioId: string;
  source: ScenarioScopeSource;
  thresholds: Record<string, unknown> | null;
  /**
   * Parameters the underlying sensor actually measures. We only
   * surface threshold rows for these — a temp+hum-only sensor in
   * a CO₂-aware scenario otherwise reads as if CO₂ were being
   * monitored, which is misleading (no graph, no tile, no value
   * for the user to compare against).
   */
  availableParams: readonly Param[];
}

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

export function ScenarioDetailSheet({
  open,
  onClose,
  scenarioId,
  source,
  thresholds,
  availableParams,
}: ScenarioDetailSheetProps) {
  const { t } = useTranslation();
  const meta = findScenarioById(scenarioId);

  const scenarioName = meta
    ? t(`indeklima.scenarios.${meta.labelKey}`)
    : scenarioId;
  const scenarioDesc = meta && meta.descKey
    ? t(`indeklima.scenarios.${meta.descKey}`)
    : '';
  const scopeLabel = t(`indeklima.sensor_detail.scenario.scope_${source}`);

  // The Sensor#thresholds endpoint returns a slightly different
  // shape than the scope-thresholds endpoint, but both fold
  // through `normalizeThresholds` into the same canonical form
  // we use for the chart bands.
  const normalised = normalizeThresholds(
    thresholds as Parameters<typeof normalizeThresholds>[0],
  );
  const supportedSet = new Set(availableParams);
  const visibleParams = PARAMS.filter(
    (p) => supportedSet.has(p.key) && hasThresholds(normalised, p.key),
  );

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.45)',
          justifyContent: 'flex-end',
        }}
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
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
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.md }}
          >
            {/* Header — icon + name + scope source */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.bgPrimary,
                }}
              >
                <Icon
                  name={meta?.icon ?? 'sliders'}
                  color={colors.brand}
                  size={22}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[type.pageTitle, { fontSize: 18 }]} numberOfLines={2}>
                  {scenarioName}
                </Text>
                <Text style={[type.caption, { fontSize: 12, color: colors.gray[500], marginTop: 2 }]} numberOfLines={1}>
                  {scopeLabel}
                </Text>
              </View>
            </View>

            {/* "What matters" — the descKey copy from the web. Hidden when
                we don't have a description (custom scenarios, missing
                catalogue entry). */}
            {scenarioDesc ? (
              <View style={{ gap: 6 }}>
                <Text style={type.sectionLabel}>
                  {t('indeklima.sensor_detail.scenario.description_heading').toUpperCase()}
                </Text>
                <Text style={type.body}>{scenarioDesc}</Text>
              </View>
            ) : null}

            {/* Threshold rows — green / yellow / red bands per param. */}
            <View style={{ gap: 6 }}>
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

                    // Warning band is the gap between the inner (green)
                    // and outer (yellow) bounds. Render both sides as
                    // a single descriptive line.
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

            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              style={({ pressed }) => ({
                marginTop: spacing.sm,
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
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default ScenarioDetailSheet;
