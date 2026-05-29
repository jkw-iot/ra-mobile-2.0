// ══════════════════════════════════════════════════════════════
// ScenarioBadge — slim navy-hero label "Scenarie: <name>"
//
// Sits directly under the measurement-time row on the sensor
// detail screen. Same compact 12 px font/weight as the
// measurement timestamp so it visually belongs to the same row
// stack and adds as little vertical chrome to the dark hero as
// possible. Long names truncate with `…`.
//
// Tapping opens `<ScenarioDetailSheet>` — a bottom sheet showing
// the scenario description, the scope it was inherited from
// (sensor / location / global) and the resolved thresholds.
// ══════════════════════════════════════════════════════════════
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components';
import { spacing } from '@/theme';
import { haptic } from '@/lib/haptics';
import {
  useEffectiveScenario,
  type FlatSensor,
} from './hooks';
import { findScenarioById } from './scenarios';
import { ScenarioDetailSheet } from './ScenarioDetailSheet';
import type { Param } from './thresholds';

interface ScenarioBadgeProps {
  sensor: FlatSensor;
  /**
   * The set of parameters the sensor actually reports. The detail
   * sheet uses this to hide threshold rows for parameters the
   * sensor cannot measure — e.g. a temp+hum sensor in a CO₂
   * scenario should not show a CO₂ row, since the user can never
   * see a CO₂ reading from this device.
   */
  availableParams: readonly Param[];
}

export function ScenarioBadge({ sensor, availableParams }: ScenarioBadgeProps) {
  const { t } = useTranslation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const { data: effective, isLoading } = useEffectiveScenario(sensor);

  // While the scope queries are still in flight we don't render
  // anything — the row would otherwise jump in and out of view
  // every navigation. The badge appears the moment a scenario
  // is resolved.
  if (isLoading || !effective) return null;

  const meta = findScenarioById(effective.scenarioId);
  // Falls back to the raw id (e.g. "open-office") when the
  // mobile catalogue is out of date relative to the web. Keeps
  // the user informed instead of silently hiding the badge.
  const scenarioName = meta
    ? t(`indeklima.scenarios.${meta.labelKey}`)
    : effective.scenarioId;

  return (
    <>
      <Pressable
        onPress={() => {
          haptic.light();
          setSheetOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${t('indeklima.sensor_detail.scenario.label')}: ${scenarioName}`}
        hitSlop={6}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Icon name="sliders" color="rgba(255,255,255,0.7)" size={12} />
          <Text
            style={{
              flex: 1,
              color: 'rgba(255,255,255,0.9)',
              fontSize: 12,
              fontWeight: '600',
            }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {`${t('indeklima.sensor_detail.scenario.label')}: ${scenarioName}`}
          </Text>
        </View>
      </Pressable>

      <ScenarioDetailSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        scenarioId={effective.scenarioId}
        source={effective.source}
        thresholds={effective.thresholds}
        availableParams={availableParams}
      />
    </>
  );
}

// Spacing token re-export so the parent screen knows roughly how
// much vertical room the badge occupies (one line + small gap).
// Kept as a constant export rather than a styled wrapper so the
// caller controls the surrounding margin/padding precisely.
export const SCENARIO_BADGE_ROW_GAP = spacing.xs;
