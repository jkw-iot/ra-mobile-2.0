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
  'plus': 'plus',
  'plus-lg': 'plus',
  'dash': 'minus',
  'three-dots': 'dots-horizontal',
  'three-dots-vertical': 'dots-vertical',

  // Status / indicators
  'circle-fill': 'circle',
  'exclamation-triangle': 'alert-outline',
  'exclamation-triangle-fill': 'alert',
  'exclamation-circle': 'alert-circle-outline',
  'info-circle': 'information-outline',
  'bell': 'bell-outline',
  'bell-fill': 'bell',
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
  'cloud': 'cloud-outline',
  'cloud-fog': 'weather-fog',
  'wind': 'weather-windy',
  'sun': 'weather-sunny',
  'moon': 'weather-night',
  'broadcast': 'broadcast',
  'wifi': 'wifi',
  'wifi-off': 'wifi-off',
  'battery': 'battery',
  'battery-half': 'battery-50',
  'battery-full': 'battery',
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
