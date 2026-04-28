// ══════════════════════════════════════════════════════════════
// WaterMapMarker — status-coloured pin for the water map.
//
// Mirrors the web Water Map's `CircleMarker` styling
// (`roomalyzer20/src/pages/water/Map.jsx`):
//
//   alarm        → red   pulsing droplet
//   dry_unacked  → orange droplet
//   silent       → muted grey droplet
//   dry          → sage green check-droplet
//
// The marker is rendered inside `<Marker>` children on the map,
// so it draws as ordinary RN views — no native Leaflet circle.
// We pick a coloured circle with a centred glyph rather than the
// indeklima "value pill" because water sensors don't carry a
// numeric reading the user can scan on the map.
// ══════════════════════════════════════════════════════════════
import { View } from 'react-native';

import { Icon } from '@/components';
import { colors } from '@/theme';

import type { WaterMapStatus } from '@/services/api';

const ICON_BY_STATUS: Record<WaterMapStatus, string> = {
  alarm: 'exclamation-triangle-fill',
  dry_unacked: 'droplet-half',
  silent: 'volume-mute',
  dry: 'check-circle-fill',
};

function colorFor(status: WaterMapStatus): string {
  switch (status) {
    case 'alarm':
      return colors.statusBad;
    case 'dry_unacked':
      return colors.statusOrange;
    case 'silent':
      // Muted slate so silent sensors recede behind live ones,
      // matching the web map's `#4b5563`.
      return '#4b5563';
    case 'dry':
    default:
      return colors.statusGood;
  }
}

export interface WaterMapMarkerProps {
  status: WaterMapStatus;
}

export function WaterMapMarker({ status }: WaterMapMarkerProps) {
  const bg = colorFor(status);
  const isAlarm = status === 'alarm';
  const size = isAlarm ? 30 : status === 'dry_unacked' ? 28 : 24;
  const iconSize = isAlarm ? 16 : status === 'dry_unacked' ? 14 : 12;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        borderWidth: 2,
        borderColor: colors.white,
        alignItems: 'center',
        justifyContent: 'center',
        // Soft lift; matches the indeklima SensorMapMarker pill so
        // both modules feel like the same map family.
        shadowColor: '#0b1a2b',
        shadowOpacity: 0.22,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
      }}
    >
      <Icon name={ICON_BY_STATUS[status]} color={colors.white} size={iconSize} />
    </View>
  );
}

export default WaterMapMarker;
