// ══════════════════════════════════════════════════════════════
// TreeSelect — single-select dropdown with optional tree indent.
//
// Originally extracted from the sensor-list location picker. The
// pattern turns out to be useful anywhere we want a dropdown that:
//
//  - Sits prominently on a dark/coloured header surface OR on a
//    regular light page (`surface: 'dark' | 'light'`).
//  - Reads obviously as tappable: icon badge + tiny uppercase
//    label + bold value + chevron pill — two visual affordances
//    so it never gets mistaken for a static heading.
//  - Expands inline into a lifted white sheet with hairline-
//    divided rows. Active row is tinted brand-accent and gets a
//    check-circle, matching the selection language used by
//    `TenantTileGrid` and `ModuleTileGrid`.
//  - Shows tree relationships when the data has them: pass
//    `depth` on options and the rows indent + draw an L-connector
//    so children read as descendants of their parent.
//
// Usage examples:
//
//   <TreeSelect                                  // light surface
//     value={selected}
//     onChange={setSelected}
//     options={[{ id: '1', label: 'Foo' }, ...]}
//     icon="building"
//     label={t('common.department')}
//   />
//
//   <View style={{ backgroundColor: colors.navy }}>
//     <TreeSelect                                // dark surface
//       surface="dark"
//       value={loc}
//       onChange={setLoc}
//       options={locationsWithDepth}            // tree-aware
//       icon="geo-alt-fill"
//       label={t('indeklima.location_filter.label')}
//     />
//   </View>
//
// Layout note: the trigger itself uses a function-style
// Pressable for press feedback only (opacity / scale). All visual
// styling lives on an inner <View> with static styles — same
// workaround documented on `KpiTile` / `TenantTileGrid` for the
// Expo SDK 54 + NativeWind quirk where function-style Pressable
// styles intermittently drop background/border/shadow.
// ══════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { colors, fontFamily, radius, spacing } from '@/theme';
import { Icon } from './Icon';
import { haptic } from '@/lib/haptics';

export interface TreeSelectOption {
  /** Stable id used as both option key and selection value. */
  id: string;
  /** Visible label. */
  label: string;
  /**
   * Tree depth — 0 = root. Optional; flat option lists work too.
   * Children indent and draw a thin L-connector to their parent.
   * Capped at depth 5 to keep the indent inside reasonable bounds.
   */
  depth?: number;
}

export interface TreeSelectProps {
  /** Currently selected option id, or null when nothing is set. */
  value: string | null;
  /** Fires with the picked option id. */
  onChange: (id: string) => void;
  /** Options to display. Render order is preserved. */
  options: readonly TreeSelectOption[];
  /**
   * Tiny uppercase label shown above the value in the trigger
   * (e.g. "LOCATION", "MODULE"). Also used as the
   * accessibilityLabel for screen readers.
   */
  label: string;
  /** Bootstrap Icons name for the badge in the trigger. */
  icon: string;
  /**
   * Visual surface for the closed-state trigger.
   * - `'dark'` (default): translucent white-on-dark, designed to
   *   sit on a navy / branded header.
   * - `'light'`: white card with brand-dark text, designed to
   *   sit on the regular light page background.
   */
  surface?: 'dark' | 'light';
  /** Text shown when no option is selected (or no options exist). */
  placeholder?: string;
  /** Maximum height of the open dropdown sheet. Defaults to 360. */
  maxSheetHeight?: number;
  /**
   * Horizontal inset around the trigger card and the matching
   * margin on the open dropdown sheet. Use a small value
   * (e.g. `spacing.xs`) when the picker should sit nearly edge-
   * to-edge against the page background — matching adjacent
   * cards on a content-dense screen. Defaults to `spacing.md`
   * for a more "breathing" placement on its own. The same value
   * is also used for vertical padding around the trigger.
   */
  inset?: number;
}

export function TreeSelect({
  value,
  onChange,
  options,
  label,
  icon,
  surface = 'light',
  placeholder = '—',
  maxSheetHeight = 360,
  inset = spacing.md,
}: TreeSelectProps) {
  const [open, setOpen] = useState(false);

  const current = value ? options.find((o) => o.id === value) : null;
  const displayValue = current?.label ?? placeholder;
  const hasOptions = options.length > 0;

  // Close any open dropdown if the option set disappears (e.g.
  // after a tenant switch); avoids a phantom panel hovering
  // with no items.
  useEffect(() => {
    if (!hasOptions && open) setOpen(false);
  }, [hasOptions, open]);

  const isDark = surface === 'dark';
  const triggerBg = isDark
    ? open
      ? 'rgba(255,255,255,0.16)'
      : 'rgba(255,255,255,0.08)'
    : open
      ? 'rgba(52,152,219,0.06)'
      : colors.white;
  const triggerBorder = isDark
    ? open
      ? 'rgba(255,255,255,0.32)'
      : 'rgba(255,255,255,0.18)'
    : open
      ? colors.brandAccent
      : colors.gray[200];
  const badgeBg = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(52,152,219,0.10)';
  const chevronBg = isDark ? 'rgba(255,255,255,0.18)' : colors.gray[100];
  const labelColor = isDark ? 'rgba(255,255,255,0.65)' : colors.gray[400];
  const valueColor = isDark
    ? hasOptions
      ? colors.white
      : 'rgba(255,255,255,0.55)'
    : hasOptions
      ? colors.brandDark
      : colors.gray[400];
  const iconColor = isDark ? colors.white : colors.brandAccent;
  const chevronColor = isDark ? colors.white : colors.brandDark;

  return (
    <View>
      <View
        style={{
          paddingHorizontal: inset,
          paddingTop: inset,
          paddingBottom: open ? spacing.sm : inset,
        }}
      >
        <Pressable
          disabled={!hasOptions}
          onPress={() => {
            haptic.select();
            setOpen((v) => !v);
          }}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityValue={{ text: displayValue }}
          accessibilityState={{ expanded: open, disabled: !hasOptions }}
          style={({ pressed }) => ({
            opacity: pressed && hasOptions ? 0.92 : 1,
            transform: [{ scale: pressed && hasOptions ? 0.997 : 1 }],
          })}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: radius.lg,
              backgroundColor: triggerBg,
              borderWidth: 1,
              borderColor: triggerBorder,
              shadowColor: '#0b1a2b',
              shadowOpacity: isDark ? 0 : 0.04,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 2 },
              elevation: isDark ? 0 : 1,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: badgeBg,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={icon} color={iconColor} size={18} />
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  fontFamily: fontFamily('bold'),
                  fontSize: 10,
                  lineHeight: 12,
                  letterSpacing: 1.2,
                  color: labelColor,
                  textTransform: 'uppercase',
                  marginBottom: 2,
                }}
                numberOfLines={1}
              >
                {label}
              </Text>
              <Text
                style={{
                  fontFamily: fontFamily(hasOptions && current ? 'bold' : 'semibold'),
                  fontSize: 18,
                  lineHeight: 22,
                  color: valueColor,
                  letterSpacing: -0.3,
                }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {displayValue}
              </Text>
            </View>

            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                backgroundColor: chevronBg,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon
                name={open ? 'chevron-up' : 'chevron-down'}
                color={chevronColor}
                size={14}
              />
            </View>
          </View>
        </Pressable>
      </View>

      {open && hasOptions ? (
        <View
          style={{
            marginHorizontal: inset,
            marginBottom: inset,
            backgroundColor: colors.white,
            borderRadius: radius.lg,
            maxHeight: maxSheetHeight,
            shadowColor: '#0b1a2b',
            shadowOpacity: 0.18,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
            elevation: 8,
            overflow: 'hidden',
            // On a light surface the open trigger and the sheet
            // share the same horizontal edges, so a hairline keeps
            // the seam between them legible.
            borderWidth: isDark ? 0 : 1,
            borderColor: colors.gray[200],
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingVertical: spacing.xs }}
          >
            {options.map((o, i) => (
              <TreeSelectRow
                key={o.id}
                option={o}
                active={value === o.id}
                isLast={i === options.length - 1}
                onPress={() => {
                  haptic.select();
                  onChange(o.id);
                  setOpen(false);
                }}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

function TreeSelectRow({
  option,
  active,
  isLast,
  onPress,
}: {
  option: TreeSelectOption;
  active: boolean;
  isLast: boolean;
  onPress: () => void;
}) {
  const depth = option.depth ?? 0;
  const indent = Math.min(depth, 5) * 16;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => ({
        backgroundColor: active
          ? 'rgba(52,152,219,0.10)'
          : pressed
            ? colors.gray[100]
            : colors.white,
      })}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingLeft: spacing.md + indent,
          paddingRight: spacing.md,
          paddingVertical: 12,
          borderBottomWidth: isLast ? 0 : 1,
          borderBottomColor: colors.gray[100],
        }}
      >
        {depth > 0 ? (
          <View
            style={{
              width: 10,
              height: 10,
              borderLeftWidth: 1.5,
              borderBottomWidth: 1.5,
              borderColor: colors.gray[300],
              marginLeft: -spacing.xs,
            }}
          />
        ) : null}
        <Text
          style={{
            flex: 1,
            fontFamily: fontFamily(active ? 'bold' : 'regular'),
            fontSize: 16,
            lineHeight: 20,
            color: active ? colors.brandAccent : colors.brandDark,
            letterSpacing: -0.2,
          }}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {option.label}
        </Text>
        {active ? (
          <Icon name="check-circle-fill" color={colors.brandAccent} size={18} />
        ) : null}
      </View>
    </Pressable>
  );
}

export default TreeSelect;
