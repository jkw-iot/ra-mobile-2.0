// ══════════════════════════════════════════════════════════════
// Icon — bridges web Bootstrap Icons names to @expo/vector-icons
//
// The web app uses Bootstrap Icons (`bi bi-...`). In React Native
// we use MaterialCommunityIcons from @expo/vector-icons because it
// has the closest visual style and the widest coverage.
//
// Pass the Bootstrap Icons name (with or without the `bi-` prefix)
// and this component maps it to the nearest MaterialCommunityIcons
// glyph. Unknown names fall back to a generic broadcast icon so
// nothing ever renders blank.
//
// ONLY this file should import from @expo/vector-icons — every
// other place in the app uses <Icon name="..." />.
// ══════════════════════════════════════════════════════════════
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo } from 'react';

import { colors } from '@/theme';

type MciName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

// Map Bootstrap Icons name → MaterialCommunityIcons name.
// Extend as new icons are needed. The RIGHT-hand side must be an
// existing MCI glyph (see https://icons.expo.fyi/Index).
const ICON_MAP: Record<string, MciName> = {
  // Navigation / generic
  'house': 'home-outline',
  'list': 'format-list-bulleted',
  'list-ul': 'format-list-bulleted',
  'grid': 'view-grid-outline',
  'arrow-left': 'arrow-left',
  'arrow-right': 'arrow-right',
  'arrow-up': 'arrow-up',
  'arrow-down': 'arrow-down',
  'chevron-left': 'chevron-left',
  'chevron-right': 'chevron-right',
  'chevron-up': 'chevron-up',
  'chevron-down': 'chevron-down',
  'x': 'close',
  'x-lg': 'close',
  'check': 'check',
  'check-lg': 'check',
  'check2': 'check',
  'check2-all': 'check-all',
  'check2-square': 'checkbox-marked-outline',
  'check-all': 'check-all',
  'slash-circle': 'cancel',
  'plus': 'plus',
  'plus-lg': 'plus',
  'dash': 'minus',
  'three-dots': 'dots-horizontal',
  'three-dots-vertical': 'dots-vertical',
  'arrows-fullscreen': 'fullscreen',
  'fullscreen': 'fullscreen',
  'fullscreen-exit': 'fullscreen-exit',
  'arrow-expand': 'arrow-expand',

  // Status / indicators
  'circle-fill': 'circle',
  'exclamation-triangle': 'alert-outline',
  'exclamation-triangle-fill': 'alert',
  'exclamation-circle': 'alert-circle-outline',
  'exclamation-circle-fill': 'alert-circle',
  'info-circle': 'information-outline',
  'bell': 'bell-outline',
  'bell-fill': 'bell',
  'bell-slash': 'bell-off-outline',
  'check-circle': 'check-circle-outline',
  'check-circle-fill': 'check-circle',

  // Auth / account
  'person': 'account-outline',
  'person-fill': 'account',
  'person-circle': 'account-circle-outline',
  'people': 'account-group-outline',
  'lock': 'lock-outline',
  'envelope': 'email-outline',
  'eye': 'eye-outline',
  'eye-slash': 'eye-off-outline',
  'key': 'key-outline',
  'shield-check': 'shield-check-outline',
  'box-arrow-right': 'logout',
  'box-arrow-in-right': 'login',

  // Sensors / climate
  'thermometer-half': 'thermometer',
  'thermometer': 'thermometer',
  'droplet': 'water-outline',
  'droplet-fill': 'water',
  'droplet-half': 'water-percent',
  'water-alert': 'water-alert',
  'volume-mute': 'volume-mute',
  'volume-off': 'volume-off',
  'mic-mute': 'microphone-off',
  'heart-pulse': 'heart-pulse',
  'speedometer': 'speedometer',
  'stopwatch': 'timer-outline',
  'shield': 'shield-outline',
  // Humidity — droplet with a percent sign. Reads "humidity" at a
  // glance without needing a text label next to it.
  'humidity': 'water-percent',
  'cloud': 'cloud-outline',
  'cloud-fog': 'weather-fog',
  'cloud-drizzle': 'weather-rainy',
  'wind': 'weather-windy',
  // CO₂ — the literal "CO₂" molecule glyph. Used for the param
  // selector on sensor-detail where there's no room for text.
  'co2': 'molecule-co2',
  // VOC — air-quality / filter glyph. The closest unambiguous icon
  // for "volatile organic compounds" in MaterialCommunityIcons.
  'air-filter': 'air-filter',
  // Presence (PIR) — motion-sensor glyph. Communicates "presence
  // detection" far more precisely than a person silhouette.
  'motion-sensor': 'motion-sensor',
  'sun': 'weather-sunny',
  'moon': 'weather-night',
  'broadcast': 'broadcast',
  'wifi': 'wifi',
  'wifi-off': 'wifi-off',
  'battery': 'battery',
  'battery-half': 'battery-50',
  'battery-full': 'battery',
  // Battery level icons (0-3 — maps to the legacy "battery" field).
  'battery-empty': 'battery-alert',
  'battery-low': 'battery-30',
  'battery-medium': 'battery-60',
  'battery-high': 'battery',
  // Signal / coverage bars (0-4 — maps to the "coverage" field).
  // MCI tops out at 3 bars; we use the same glyph for 3 and 4.
  'signal-0': 'signal-cellular-outline',
  'signal-1': 'signal-cellular-1',
  'signal-2': 'signal-cellular-2',
  'signal-3': 'signal-cellular-3',
  'signal-4': 'signal-cellular-3',
  'lightning': 'lightning-bolt',

  // Charts / data
  'graph-up': 'chart-line',
  'graph-down': 'chart-line-variant',
  'bar-chart': 'chart-bar',
  'pie-chart': 'chart-pie',
  'calendar': 'calendar-outline',
  'clock': 'clock-outline',

  // Buildings / places
  'building': 'office-building-outline',
  'door-open': 'door-open',
  'door-closed': 'door-closed',
  'geo-alt': 'map-marker-outline',
  'geo-alt-fill': 'map-marker',
  'map': 'map-outline',
  'layout-text-window': 'view-dashboard-outline',

  // Actions
  'gear': 'cog-outline',
  'sliders': 'tune-variant',
  'sliders2': 'tune-variant',
  'search': 'magnify',
  'filter': 'filter-outline',
  'arrow-clockwise': 'refresh',
  'trash': 'trash-can-outline',
  'pencil': 'pencil-outline',
  'save': 'content-save-outline',
  'download': 'download-outline',
  'upload': 'upload-outline',
  'share': 'share-variant-outline',
  'printer': 'printer-outline',

  // Misc
  'star': 'star-outline',
  'star-fill': 'star',
  'heart': 'heart-outline',
  'heart-fill': 'heart',
  'flag': 'flag-outline',
  'tag': 'tag-outline',
  'bookmark': 'bookmark-outline',
  'layers': 'layers-outline',
  'chat': 'chat-outline',
  'qr-code': 'qrcode',
  'camera': 'camera-outline',
};

export interface IconProps {
  /**
   * Bootstrap Icons name — with or without the `bi-` prefix.
   * Unknown names render a fallback glyph.
   */
  name: string;
  size?: number;
  color?: string;
}

function normalise(name: string): string {
  return name.replace(/^bi[ -]/, '').trim();
}

export function Icon({ name, size = 18, color = colors.gray[600] }: IconProps) {
  const mciName = useMemo<MciName>(() => {
    const key = normalise(name);
    return ICON_MAP[key] ?? 'broadcast';
  }, [name]);

  return <MaterialCommunityIcons name={mciName} size={size} color={color} />;
}

export default Icon;
