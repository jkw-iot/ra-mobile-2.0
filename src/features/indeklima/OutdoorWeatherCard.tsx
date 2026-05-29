// ══════════════════════════════════════════════════════════════
// OutdoorWeatherTile — current outdoor conditions, rendered as
// a tile that matches the indoor KPI grid on the sensor detail
// screen.
//
// Visual contract:
//   - Same white-on-gray-200 box, radius, shadow and minHeight
//     as `<KpiTile>` so it can drop into the same 2-up row
//     without looking like an afterthought.
//   - Header: small icon + "UDENDØRS" sectionLabel.
//   - Body: a tappable weather glyph (left) plus temperature
//     and humidity stacked on the right. The condition name and
//     the Open-Meteo attribution are NOT shown inline — they
//     surface in the native Alert that pops on tapping the icon.
//
// Pulls a snapshot from Open-Meteo for the sensor's saved GPS
// position (or the centre of its group's bounding box if the
// sensor hasn't been placed on the map yet). Loading and error
// states are intentionally compact — this tile is supplementary,
// never the main reason the user opened the page.
// ══════════════════════════════════════════════════════════════
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components';
import { colors, radius, spacing, type } from '@/theme';
import {
  useOutdoorWeather,
  useSensorGroups,
  useSensorPositions,
  type FlatSensor,
} from './hooks';
import { sensorAnchorPosition } from './mapHelpers';
import type { OutdoorWeatherCondition } from '@/services/openMeteo';

interface OutdoorWeatherTileProps {
  sensor: FlatSensor;
}

// Steel-teal from the dusty palette — pulled out as a named
// const so we don't rely on tuple-index access in a strict
// `noUncheckedIndexedAccess` setup.
const STEEL_TEAL = '#5b8fa1';

/**
 * Map our coarse condition bucket to the icon + tint we want to
 * render in the tile. Tints come from the dusty palette so the
 * tile reads as part of the same visual family as the indoor
 * KPI tiles (no saturated weather-app yellows / blues).
 *
 * `clear` switches to a moon glyph at night so the icon stops
 * lying when the sensor is in a different timezone than the user.
 */
function visualForCondition(
  condition: OutdoorWeatherCondition,
  isNight: boolean,
): { icon: string; tint: string } {
  switch (condition) {
    case 'clear':
      return isNight
        ? { icon: 'moon', tint: STEEL_TEAL }
        : { icon: 'sun', tint: colors.statusWarn };
    case 'partly_cloudy':
      return { icon: 'cloud-sun', tint: STEEL_TEAL };
    case 'cloudy':
      return { icon: 'cloud', tint: colors.gray[500] };
    case 'fog':
      return { icon: 'cloud-fog', tint: colors.gray[500] };
    case 'drizzle':
      return { icon: 'cloud-drizzle', tint: STEEL_TEAL };
    case 'rain':
      return { icon: 'cloud-rain', tint: colors.brand };
    case 'snow':
      return { icon: 'cloud-snow', tint: STEEL_TEAL };
    case 'thunderstorm':
      return { icon: 'cloud-lightning-rain', tint: colors.statusBad };
    default:
      return { icon: 'cloud', tint: colors.gray[500] };
  }
}

function formatNumber(v: number | null, digits: number): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toFixed(digits);
}

/**
 * Returns the lat/lng we'd query Open-Meteo with for this sensor,
 * or `null` when no usable coordinates exist. Exposed so the
 * parent screen can decide whether to slot the outdoor tile into
 * the KPI grid at all — without this we'd render a placeholder
 * tile for sensors that have no position AND no group bounds.
 */
export function useOutdoorAnchor(sensor: FlatSensor | null) {
  const groupsQuery = useSensorGroups();
  const positionsQuery = useSensorPositions();
  return sensorAnchorPosition(sensor, groupsQuery.data, positionsQuery.data);
}

export function OutdoorWeatherTile({ sensor }: OutdoorWeatherTileProps) {
  const { t } = useTranslation();
  const anchor = useOutdoorAnchor(sensor);
  const { data, isLoading, isError } = useOutdoorWeather(
    anchor?.lat ?? null,
    anchor?.lng ?? null,
  );

  // No usable coordinates → don't render the tile at all. The
  // sensor either has no saved GPS position AND its group has no
  // bounds, which is rare but happens for fresh tenants. Showing
  // a placeholder tile with "—°C" everywhere would be noisy.
  if (!anchor) return null;

  const condition = data?.condition ?? 'cloudy';
  const visual = visualForCondition(condition, data?.isNight ?? false);
  const conditionLabel = t(`indeklima.sensor_detail.outdoor.condition.${condition}`);

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          overflow: 'hidden',
          backgroundColor: colors.white,
          borderRadius: radius.lg,
          minHeight: 92,
          borderWidth: 1,
          borderColor: colors.gray[200],
          shadowColor: '#0b1a2b',
          shadowOpacity: 0.06,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 3 },
          elevation: 2,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          gap: 6,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="cloud-sun" color={colors.brand} size={14} />
          <Text style={type.sectionLabel}>
            {t('indeklima.sensor_detail.outdoor.title').toUpperCase()}
          </Text>
        </View>

        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
          }}
        >
          {/* Weather glyph — purely informational; no tap target.
              Accessibility label still surfaces the condition name
              so a screen reader user knows what's outside without
              needing a tooltip layer. */}
          <View
            accessibilityRole="image"
            accessibilityLabel={`${t(
              'indeklima.sensor_detail.outdoor.title',
            )}: ${conditionLabel}`}
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.bgPrimary,
            }}
          >
            <Icon name={visual.icon} color={visual.tint} size={28} />
          </View>

          <View style={{ flex: 1, gap: 4 }}>
            {isLoading ? (
              <Text style={[type.caption, { color: colors.gray[500] }]} numberOfLines={1}>
                {t('common.loading')}
              </Text>
            ) : isError ? (
              <Text style={[type.caption, { color: colors.gray[500] }]} numberOfLines={2}>
                {t('indeklima.sensor_detail.outdoor.error')}
              </Text>
            ) : (
              <>
                <DataRow
                  iconName="thermometer-half"
                  iconColor={colors.statusBad}
                  value={formatNumber(data?.temperatureC ?? null, 1)}
                  unit="°C"
                />
                <DataRow
                  iconName="droplet"
                  iconColor={colors.brandAccent}
                  value={formatNumber(data?.humidityPct ?? null, 0)}
                  unit="%"
                />
              </>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

function DataRow({
  iconName,
  iconColor,
  value,
  unit,
}: {
  iconName: string;
  iconColor: string;
  value: string;
  unit: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
      <Icon name={iconName} color={iconColor} size={14} />
      <Text
        style={{
          fontSize: 18,
          fontWeight: '700',
          color: colors.brandDark,
          letterSpacing: -0.3,
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text style={[type.caption, { fontSize: 12, color: colors.gray[500] }]}>
        {unit}
      </Text>
    </View>
  );
}

// Backwards-compatible alias — the screen previously imported
// `OutdoorWeatherCard`; keep the old name working so we don't
// break any callers we missed during the rename.
export const OutdoorWeatherCard = OutdoorWeatherTile;

export default OutdoorWeatherTile;
