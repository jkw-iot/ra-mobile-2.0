// ══════════════════════════════════════════════════════════════
// KpiTile — white rounded box showing a single at-a-glance metric.
//
// Used for the 2×2 parameter grid on the sensor detail page
// (temperature, humidity, CO₂, VOC) and similar dashboard-style
// layouts. Tapping promotes the tile to "active" — the border
// thickens and turns brand-accent blue.
//
// Layout notes:
// - Parent is expected to be a `flexDirection: 'row'` container;
//   the tile takes `flex: 1` so 2 tiles share a row evenly.
// - For odd tile counts, render a `<View style={{ flex: 1 }} />`
//   spacer in the remaining slot so the last tile stays column-
//   aligned with the grid above it.
//
// Rendering note: the visual styling lives on an inner <View>
// rather than the <Pressable> itself. Function-style Pressable
// styles were observed to intermittently drop background/border/
// shadow in this RN + NativeWind setup (Expo SDK 54). The static
// `{ flex: 1 }` on Pressable is essential for proper flex layout.
// ══════════════════════════════════════════════════════════════
import { Pressable, View, Text } from 'react-native';

import { colors, radius, spacing, type } from '@/theme';
import { haptic } from '@/lib/haptics';
import { Icon } from './Icon';

export interface KpiTileProps {
  label: string;
  value: string;
  unit?: string;
  icon: string;
  /** Icon tint. Defaults to the brand color. */
  iconColor?: string;
  /**
   * Colour for the big value text. Used by the sensor detail page
   * to tint the reading red / yellow / green based on threshold
   * status. Defaults to the dark brand text colour.
   */
  valueColor?: string;
  /** Highlight the tile (thicker brand-accent border + stronger shadow). */
  active?: boolean;
  onPress?: () => void;
}

export function KpiTile({
  label,
  value,
  unit,
  icon,
  iconColor,
  valueColor,
  active,
  onPress,
}: KpiTileProps) {
  const borderCol = active ? colors.brandAccent : colors.gray[200];

  return (
    <Pressable
      onPress={
        onPress
          ? () => {
              haptic.select();
              onPress();
            }
          : undefined
      }
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
      style={{ flex: 1 }}
    >
      <View
        style={{
          overflow: 'hidden',
          backgroundColor: colors.white,
          borderRadius: radius.lg,
          minHeight: 110,
          borderWidth: active ? 2 : 1,
          borderColor: borderCol,
          shadowColor: '#0b1a2b',
          shadowOpacity: active ? 0.12 : 0.06,
          shadowRadius: active ? 10 : 6,
          shadowOffset: { width: 0, height: 3 },
          elevation: active ? 4 : 2,
          padding: spacing.lg,
          gap: 8,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name={icon} color={iconColor ?? colors.brand} size={14} />
          <Text style={type.sectionLabel}>{label}</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            style={{
              fontSize: 40,
              lineHeight: 46,
              fontWeight: '700',
              color: valueColor ?? colors.brandDark,
              letterSpacing: -0.8,
              textAlign: 'center',
            }}
          >
            {value}
            {unit ? (
              <Text
                style={[
                  type.caption,
                  { fontSize: 16, fontWeight: '600', color: colors.gray[500] },
                ]}
              >
                {' '}
                {unit}
              </Text>
            ) : null}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default KpiTile;
