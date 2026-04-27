// ══════════════════════════════════════════════════════════════
// TenantTileGrid — 2-column grid of tappable tenant tiles.
//
// Used in two places:
//  - The post-login `/select-tenant` flow when the user has
//    access to more than one tenant.
//  - The Profile tab, where the active tenant can be switched
//    after the initial selection.
//
// Visual language matches `KpiTile` on the sensor detail page:
// white rounded tiles in a 2-column grid, the active one lifts
// with a thicker brand-accent border, soft tint, stronger shadow
// and a check-circle in the top-right corner.
//
// Layout note (mirrored from KpiTile): visual styling lives on
// the inner <View>, not on the function-style <Pressable> style
// — the latter intermittently drops backgrounds/borders/shadows
// in this Expo SDK 54 + NativeWind setup. Pressable only carries
// the static `flex: 1` needed for even column distribution.
// ══════════════════════════════════════════════════════════════
import { Pressable, View, Text } from 'react-native';

import { colors, radius, spacing } from '@/theme';
import { Icon } from './Icon';
import type { Tenant } from '@/services/auth/AuthProvider';

export interface TenantTileGridProps {
  tenants: readonly Tenant[];
  activeTenantId: number | null;
  onSelect: (tenantId: number) => void;
}

function TenantTile({
  tenant,
  isActive,
  onPress,
}: {
  tenant: Tenant;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={tenant.name}
      style={{ flex: 1 }}
    >
      <View
        style={{
          minHeight: 96,
          borderRadius: radius.lg,
          padding: spacing.md,
          backgroundColor: isActive ? 'rgba(52,152,219,0.08)' : colors.white,
          borderWidth: isActive ? 2 : 1,
          borderColor: isActive ? colors.brandAccent : colors.gray[200],
          shadowColor: '#0b1a2b',
          shadowOpacity: isActive ? 0.10 : 0.04,
          shadowRadius: isActive ? 8 : 4,
          shadowOffset: { width: 0, height: 2 },
          elevation: isActive ? 3 : 1,
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
            <Icon name="check-circle-fill" color={colors.brandAccent} size={16} />
          </View>
        ) : null}
        <Text
          style={{
            fontSize: 15,
            fontWeight: isActive ? '700' : '600',
            color: isActive ? colors.brandAccent : colors.brandDark,
            textAlign: 'center',
            letterSpacing: -0.2,
            paddingHorizontal: 4,
          }}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
        >
          {tenant.name}
        </Text>
      </View>
    </Pressable>
  );
}

export function TenantTileGrid({
  tenants,
  activeTenantId,
  onSelect,
}: TenantTileGridProps) {
  if (tenants.length === 0) return null;

  // Chunk into rows of two; trailing spacer keeps the last tile
  // column-aligned when the count is odd.
  const rowCount = Math.ceil(tenants.length / 2);

  return (
    <View style={{ gap: spacing.sm }}>
      {Array.from({ length: rowCount }).map((_, rowIdx) => {
        const rowTenants = tenants.slice(rowIdx * 2, rowIdx * 2 + 2);
        return (
          <View key={rowIdx} style={{ flexDirection: 'row', gap: spacing.sm }}>
            {rowTenants.map((tenant) => (
              <TenantTile
                key={tenant.id}
                tenant={tenant}
                isActive={tenant.id === activeTenantId}
                onPress={() => onSelect(tenant.id)}
              />
            ))}
            {rowTenants.length === 1 ? <View style={{ flex: 1 }} /> : null}
          </View>
        );
      })}
    </View>
  );
}

export default TenantTileGrid;
