// ══════════════════════════════════════════════════════════════
// ParamPicker — segmented icon-only param selector.
//
// Shared by the sensor-list and map screens so a user moving
// between the two reads the same control. Renders icons only
// (no labels) so long parameter names like "Tilstedeværelse"
// can never truncate at narrow phone widths; accessibility
// labels still announce the parameter by name.
//
// Visual style mirrors the closed-state TreeSelect icon-badge:
// translucent-white "lift" on the navy header background,
// matched border, plain white glyph for the active segment.
// ══════════════════════════════════════════════════════════════
import { Pressable, View } from 'react-native';

import { Icon } from './Icon';
import { colors, radius } from '@/theme';
import { haptic } from '@/lib/haptics';

export type ParamKey = 'temp' | 'hum' | 'co2' | 'voc' | 'sound' | 'light' | 'pir' | 'vtt';

export const PARAM_ORDER: readonly ParamKey[] = [
  'temp',
  'hum',
  'co2',
  'voc',
  'sound',
  'light',
  'pir',
  'vtt',
];

// `label` powers VoiceOver / TalkBack — it is intentionally not
// rendered, since the icon set has been chosen to read
// unambiguously on its own. Keep the icon names in sync with
// `src/components/Icon.tsx`'s mapping table.
export const PARAM_META: Record<ParamKey, { label: string; icon: string }> = {
  temp: { label: 'Temperatur', icon: 'thermometer' },
  hum: { label: 'Fugt', icon: 'humidity' },
  co2: { label: 'CO₂', icon: 'co2' },
  voc: { label: 'VOC', icon: 'air-filter' },
  sound: { label: 'Lyd', icon: 'volume-up' },
  light: { label: 'Lys', icon: 'brightness-high' },
  pir: { label: 'Tilstedeværelse', icon: 'motion-sensor' },
  vtt: { label: 'Skimmelrisiko', icon: 'bacteria' },
};

export interface ParamPickerProps {
  value: ParamKey;
  onChange: (p: ParamKey) => void;
  /**
   * Subset of params that at least one sensor in the current
   * scope (location, map view, …) actually reports. Pills for
   * params outside this set are hidden so the row stays
   * dynamic and never offers an empty parameter.
   */
  available: Set<ParamKey>;
}

export function ParamPicker({ value, onChange, available }: ParamPickerProps) {
  const params = PARAM_ORDER.filter((p) => available.has(p));
  if (params.length === 0) return null;
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.08)',
        padding: 4,
        borderRadius: radius.md,
        gap: 4,
      }}
    >
      {params.map((p) => {
        const meta = PARAM_META[p];
        const active = p === value;
        return (
          <Pressable
            key={p}
            onPress={() => {
              haptic.select();
              onChange(p);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={meta.label}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 7,
              borderRadius: radius.sm,
              backgroundColor: active ? 'rgba(255,255,255,0.16)' : 'transparent',
              borderWidth: active ? 1 : 0,
              borderColor: active ? 'rgba(255,255,255,0.18)' : 'transparent',
            }}
          >
            <Icon
              name={meta.icon}
              color={active ? colors.white : 'rgba(255,255,255,0.55)'}
              size={26}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

export default ParamPicker;
