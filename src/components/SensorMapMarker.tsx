// ══════════════════════════════════════════════════════════════
// SensorMapMarker — the visible content of a sensor map pin.
//
// Renders a coloured pill containing the parameter value (e.g.
// "21.4 °C") tinted by the same threshold-zone helpers the
// sensor-list cards use. The pill is intentionally compact so
// many markers can sit on the map without overwhelming it; tap
// is handled on the parent <Marker>.
//
// PIR (presence) gets a worded pill ("Optaget" / "Ledig") rather
// than a numeric value, matching the web Map's behaviour.
// Sensors that lack a value or thresholds for the current param
// fall back to a small grey dot so they remain locatable but
// don't shout for attention.
// ══════════════════════════════════════════════════════════════
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius } from '@/theme';
import type { ParamKey } from './ParamPicker';
import type { FlatSensor } from '@/features/indeklima/hooks';
import {
  hasThresholds,
  zoneForValue,
  type NormalizedThresholds,
} from '@/features/indeklima/thresholds';

export type MarkerTone = 'good' | 'warn' | 'bad' | 'neutral';

function toneFor(
  param: ParamKey,
  value: number | null,
  thresholds: NormalizedThresholds | undefined,
): MarkerTone {
  if (value == null) return 'neutral';
  if (!thresholds) return 'neutral';
  if (!hasThresholds(thresholds, param)) return 'neutral';
  const zone = zoneForValue(thresholds, param, value);
  if (zone === 'red') return 'bad';
  if (zone === 'yellow') return 'warn';
  return 'good';
}

function backgroundFor(tone: MarkerTone): string {
  switch (tone) {
    case 'good':
      return colors.statusGood;
    case 'warn':
      return colors.statusWarn;
    case 'bad':
      return colors.statusBad;
    default:
      return '#7a8c7e';
  }
}

function textColorFor(tone: MarkerTone): string {
  // Warn (amber) needs dark text for contrast — same rule the web uses.
  return tone === 'warn' ? colors.brandDark : colors.white;
}

function readNumeric(v: number | string | undefined): number | null {
  if (v == null || v === '-' || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function unitFor(param: ParamKey, sensor: FlatSensor): string {
  switch (param) {
    case 'temp':
      return sensor.tempUnit ?? '°C';
    case 'hum':
      return sensor.humUnit ?? '%';
    case 'co2':
      return sensor.co2Unit ?? 'ppm';
    case 'voc':
      return sensor.vocUnit ?? 'ppb';
    case 'sound':
      return sensor.soundUnit ?? 'dB';
    case 'light':
      return sensor.lightUnit ?? 'lux';
    case 'pir':
    default:
      return '';
  }
}

function isPresenceActive(v: number | string | undefined): boolean {
  const n = readNumeric(v);
  return n != null && n > 0;
}

export interface SensorMapMarkerProps {
  sensor: FlatSensor;
  param: ParamKey;
  thresholds?: NormalizedThresholds;
  /**
   * `true` when the sensor's last reading is older than the
   * silent threshold or its statusColor is grey. Renders the
   * pill at reduced opacity so live data dominates the map.
   */
  silent?: boolean;
}

export function SensorMapMarker({
  sensor,
  param,
  thresholds,
  silent = false,
}: SensorMapMarkerProps) {
  const { t } = useTranslation();

  // Presence is binary — render a worded pill.
  if (param === 'pir') {
    if (sensor.pir == null || sensor.pir === '-' || sensor.pir === '') {
      return <DotFallback silent={silent} />;
    }
    const active = isPresenceActive(sensor.pir);
    const tone: MarkerTone = active ? 'bad' : 'good';
    const label = active
      ? t('indeklima.sensors.presence.occupied')
      : t('indeklima.sensors.presence.vacant');
    return <Pill text={label} tone={tone} silent={silent} />;
  }

  const numeric = readNumeric(sensor[param]);
  if (numeric == null) {
    return <DotFallback silent={silent} />;
  }
  const tone = toneFor(param, numeric, thresholds);
  const display = param === 'temp' ? numeric.toFixed(1) : String(Math.round(numeric));
  const unit = unitFor(param, sensor);
  return <Pill text={`${display} ${unit}`.trim()} tone={tone} silent={silent} />;
}

function Pill({
  text,
  tone,
  silent,
}: {
  text: string;
  tone: MarkerTone;
  silent: boolean;
}) {
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: radius.full,
        borderWidth: 2,
        borderColor: colors.white,
        backgroundColor: backgroundFor(tone),
        opacity: silent ? 0.55 : 1,
        // RN map markers don't pick up box-shadow on Android; this
        // pair gives a soft "lift" on iOS while staying neutral on
        // Android — both look fine on top of the CARTO tiles.
        shadowColor: '#0b1a2b',
        shadowOpacity: 0.22,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          color: textColorFor(tone),
          fontSize: 12,
          fontWeight: '700',
          letterSpacing: -0.1,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

function DotFallback({ silent }: { silent: boolean }) {
  return (
    <View
      style={{
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: colors.white,
        backgroundColor: '#7a8c7e',
        opacity: silent ? 0.5 : 0.85,
        shadowColor: '#0b1a2b',
        shadowOpacity: 0.2,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 },
        elevation: 2,
      }}
    />
  );
}

export default SensorMapMarker;
