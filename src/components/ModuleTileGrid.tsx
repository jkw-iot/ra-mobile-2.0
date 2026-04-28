// ══════════════════════════════════════════════════════════════
// ModuleTileGrid — 2-column grid of tappable module tiles.
//
// Used in the burger menu (AppDrawer) so the user can switch
// between product modules (Indeklima, Bevaring, ...). The grid
// sits on the drawer's navy surface and reuses the same
// translucent-white-on-navy chrome as the location TreeSelect
// (closed state) and the parameter picker's active segment at
// the top of the sensor list — so every active control on a
// navy surface reads as the same visual family.
//
// State styling:
//  - active     → brighter translucent-white "lift" + white text
//  - selectable → subtle translucent-white panel + dimmed white text
//  - locked     → almost flat with very dimmed text and a
//                 "Kommer snart" caption underneath
//
// Layout note (mirrored from KpiTile / TenantTileGrid): visual
// styling lives on the inner <View>, not on the function-style
// <Pressable> style — the latter intermittently drops backgrounds
// /borders/shadows in this Expo SDK 54 + NativeWind setup.
// Pressable only carries the static `flex: 1` needed for even
// column distribution.
// ══════════════════════════════════════════════════════════════
import { Pressable, View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, fontFamily, radius, spacing } from '@/theme';
import { Icon } from './Icon';
import {
  MODULES,
  type ModuleDef,
  type ModuleSlug,
} from '@/stores/moduleStore';

export interface ModuleTileGridProps {
  activeSlug: ModuleSlug;
  onSelect: (slug: ModuleSlug) => void;
}

function ModuleTile({
  module: m,
  isActive,
  onPress,
}: {
  module: ModuleDef;
  isActive: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const locked = !m.available;

  // Translucent-white-on-navy palette, mirroring the closed-
  // state TreeSelect (triggerBg `0.08`, border `0.18`, badgeBg
  // `0.16`) and the active param-picker segment (bg `0.16`,
  // border `0.18`, white glyph). Active tiles get a slightly
  // brighter lift so the selection still reads at a glance even
  // without an accent colour.
  const tileBg = isActive
    ? 'rgba(255,255,255,0.16)'
    : 'rgba(255,255,255,0.06)';
  const tileBorder = isActive
    ? 'rgba(255,255,255,0.32)'
    : 'rgba(255,255,255,0.10)';
  const titleColor = isActive
    ? colors.white
    : locked
      ? 'rgba(255,255,255,0.45)'
      : 'rgba(255,255,255,0.85)';
  const iconBg = isActive
    ? 'rgba(255,255,255,0.22)'
    : locked
      ? 'rgba(255,255,255,0.06)'
      : 'rgba(255,255,255,0.10)';
  const iconColor = isActive
    ? colors.white
    : locked
      ? 'rgba(255,255,255,0.40)'
      : 'rgba(255,255,255,0.70)';

  return (
    <Pressable
      onPress={onPress}
      disabled={locked}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive, disabled: locked }}
      accessibilityLabel={t(m.i18nKey)}
      style={{ flex: 1 }}
    >
      <View
        style={{
          // Fixed height (not `minHeight`) so every tile in the
          // grid is identical regardless of state. Locked tiles
          // render an extra "Coming soon" caption below the
          // title, which would otherwise make their row taller
          // than rows with only active/selectable tiles. The
          // icon + title stay visually centred via
          // `justifyContent: 'center'`, so the active tile just
          // shows a slightly larger empty band where the caption
          // would sit instead of shrinking the whole tile.
          height: 140,
          borderRadius: radius.lg,
          padding: spacing.md,
          backgroundColor: tileBg,
          borderWidth: 1,
          borderColor: tileBorder,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isActive ? (
          <View
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
            }}
          >
            <Icon name="check-circle-fill" color={colors.white} size={16} />
          </View>
        ) : null}

        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: iconBg,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing.sm,
          }}
        >
          <Icon name={m.icon} color={iconColor} size={22} />
        </View>

        <Text
          style={{
            fontFamily: fontFamily(isActive ? 'bold' : 'semibold'),
            fontSize: 14,
            lineHeight: 18,
            color: titleColor,
            textAlign: 'center',
            letterSpacing: -0.2,
            paddingHorizontal: 4,
          }}
          numberOfLines={2}
          // Long compound module names (e.g. Danish
          // "Vanddetektering", German "Wasserdetektion") used to
          // force-break mid-word at this tile width because
          // there's no space to wrap on. The locale strings now
          // include a soft hyphen between the compound parts —
          // `numberOfLines={2}` honours it and breaks cleanly,
          // while `adjustsFontSizeToFit` shrinks the few cases
          // that still don't fit onto two lines.
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {t(m.i18nKey)}
        </Text>

        {locked ? (
          <Text
            style={{
              fontFamily: fontFamily('regular'),
              fontSize: 11,
              lineHeight: 14,
              color: 'rgba(255,255,255,0.45)',
              textAlign: 'center',
              marginTop: 2,
            }}
            numberOfLines={1}
          >
            {t('layout.coming_soon')}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function ModuleTileGrid({ activeSlug, onSelect }: ModuleTileGridProps) {
  // Chunk into rows of two; trailing spacer keeps the last tile
  // column-aligned when the count is odd.
  const rowCount = Math.ceil(MODULES.length / 2);

  return (
    <View style={{ gap: spacing.sm }}>
      {Array.from({ length: rowCount }).map((_, rowIdx) => {
        const rowModules = MODULES.slice(rowIdx * 2, rowIdx * 2 + 2);
        return (
          <View key={rowIdx} style={{ flexDirection: 'row', gap: spacing.sm }}>
            {rowModules.map((m) => (
              <ModuleTile
                key={m.slug}
                module={m}
                isActive={m.slug === activeSlug}
                onPress={() => onSelect(m.slug)}
              />
            ))}
            {rowModules.length === 1 ? <View style={{ flex: 1 }} /> : null}
          </View>
        );
      })}
    </View>
  );
}

export default ModuleTileGrid;
