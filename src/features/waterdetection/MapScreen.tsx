// ══════════════════════════════════════════════════════════════
// Water detection — Kort.
//
// Mirrors `src/features/indeklima/MapScreen.tsx` so the two
// "Kort" tabs feel like one product:
//
//   - Same dark navy header + AppHeader chrome
//   - Same `<TreeSelect surface="dark">` location filter, with
//     identical styling (`spacing.xs` inset)
//   - Same auto-fit camera, "Show all sensors" floating FAB and
//     overlay empty state on top of the live tile map
//
// Data model (web parity, see
// `roomalyzer20/src/pages/water/Map.jsx`):
//
//   `/admin/sensors`             — registered fleet (active + type 27)
//   `/waterdetection/map-data`   — live status (alarm/dry/silent…)
//   `/admin/sensor-positions`    — saved GPS pins
//   `/indeklima/locations`       — tenant-wide location tree
//
// Markers are coloured by `status` (alarm = red, dry_unacked =
// orange, silent = grey, dry = sage). Sensors without a saved
// GPS position are filtered out before the map renders — same
// behaviour as the web Map page; an explanatory empty-state
// overlay nudges the user to place the sensors via the web admin.
//
// Tapping a marker shows the default RN-Maps callout with the
// sensor name + location/status. There is no per-sensor detail
// page in the mobile app for water yet, so we deliberately stop
// at the callout instead of routing into a half-built screen.
// ══════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AppHeader,
  ErrorBanner,
  Icon,
  LoadingIndicator,
  TreeSelect,
  type TreeSelectOption,
} from '@/components';
import { colors, radius, spacing, type } from '@/theme';
import {
  buildLocationOptions,
  sensorMatchesLocation,
  useLocations,
} from '@/features/indeklima/hooks';
import { useLocationFilter } from '@/hooks/useLocationFilter';
import { useTenantStore } from '@/stores/tenantStore';
import { useSensorListPrefsStore } from '@/stores/sensorListPrefsStore';
import { env } from '@/lib/env';
import { haptic } from '@/lib/haptics';
import { friendlyApiErrorMessage } from '@/lib/apiErrorMessage';
import { TILE_CACHE_MAX_AGE_SECONDS, TILE_CACHE_PATH } from '@/lib/tileCache';

import { useWaterMapSensors, type WaterMapSensor } from './hooks';
import {
  DEFAULT_WATER_REGION,
  placeWaterSensors,
  regionForWaterSensors,
} from './mapHelpers';
import { WaterMapMarker } from './WaterMapMarker';

import type { WaterMapStatus } from '@/services/api';

/**
 * Translate a status enum into the same translation keys the web
 * map uses, so callout copy and any future pills stay consistent
 * across surfaces.
 */
function statusLabelKey(status: WaterMapStatus): string {
  switch (status) {
    case 'alarm':
      return 'water.map.status.alarm';
    case 'dry_unacked':
      return 'water.map.status.dry_unacked';
    case 'silent':
      return 'water.map.status.silent';
    case 'dry':
    default:
      return 'water.map.status.dry';
  }
}

export default function WaterMapScreen() {
  const { t } = useTranslation();
  const mapRef = useRef<MapView | null>(null);

  const activeTenantId = useTenantStore((s) => s.activeTenantId);
  const selectedLocationId = useSensorListPrefsStore((s) =>
    activeTenantId === null
      ? null
      : s.selectedWaterLocationByTenant[String(activeTenantId)] ?? null,
  );
  const setSelectedLocation = useSensorListPrefsStore(
    (s) => s.setSelectedWaterLocation,
  );

  const { data: sensors, isLoading, isError, error } = useWaterMapSensors();
  const locationsQuery = useLocations();

  // ── Location-restricted set (RBAC) ─────────────────────────
  const allowed = useLocationFilter<WaterMapSensor>(
    sensors,
    (s) => s.locationId,
  );

  // ── Picker options (full subtree match) ───────────────────
  const locationOptions = useMemo(
    () => buildLocationOptions(allowed, locationsQuery.data),
    [allowed, locationsQuery.data],
  );

  const locationSelectOptions = useMemo<TreeSelectOption[]>(
    () =>
      locationOptions.map((o) => ({
        id: o.id,
        label: o.name,
        depth: o.depth,
      })),
    [locationOptions],
  );

  // Adopt the first available location automatically — same UX
  // as the indeklima map so re-opening the tab never lands on an
  // empty filter.
  useEffect(() => {
    if (activeTenantId === null || locationOptions.length === 0) return;
    const hasStoredLocation =
      selectedLocationId !== null &&
      locationOptions.some((o) => o.id === selectedLocationId);
    if (!hasStoredLocation) {
      const firstLocation = locationOptions[0];
      if (firstLocation) {
        setSelectedLocation(activeTenantId, firstLocation.id);
      }
    }
  }, [activeTenantId, locationOptions, selectedLocationId, setSelectedLocation]);

  const effectiveLocation = useMemo(() => {
    if (
      selectedLocationId &&
      locationOptions.some((o) => o.id === selectedLocationId)
    ) {
      return selectedLocationId;
    }
    return locationOptions[0]?.id ?? null;
  }, [locationOptions, selectedLocationId]);

  const effectiveSubtree = useMemo(() => {
    if (!effectiveLocation) return null;
    const opt = locationOptions.find((o) => o.id === effectiveLocation);
    return opt ? opt.subtreeIds : null;
  }, [effectiveLocation, locationOptions]);

  const visible = useMemo(() => {
    if (!effectiveLocation) return [];
    return allowed.filter((s) => sensorMatchesLocation(s, effectiveSubtree));
  }, [allowed, effectiveLocation, effectiveSubtree]);

  const placedSensors = useMemo(() => placeWaterSensors(visible), [visible]);

  // ── Auto-fit camera ────────────────────────────────────────
  // Same token-guarded animation pattern as the indeklima map:
  // a quick filter change → only the latest target is honoured.
  const fitToken = useRef(0);
  useEffect(() => {
    if (placedSensors.length === 0) return;
    const region = regionForWaterSensors(placedSensors);
    if (!region) return;
    const myToken = ++fitToken.current;
    const id = setTimeout(() => {
      if (myToken !== fitToken.current) return;
      mapRef.current?.animateToRegion(region, 400);
    }, 150);
    return () => clearTimeout(id);
  }, [placedSensors]);

  const onFitAll = useCallback(() => {
    haptic.light();
    if (placedSensors.length === 0) return;
    const region = regionForWaterSensors(placedSensors);
    if (region) mapRef.current?.animateToRegion(region, 350);
  }, [placedSensors]);

  // Decide which empty-state copy to show: nothing-at-all vs.
  // "you have sensors but none are placed". Mirrors the web
  // Map page's two-tier hint.
  const emptyCopyKey =
    visible.length === 0
      ? 'water.map.no_sensors'
      : 'water.map.no_positions';
  const emptySubtitleKey =
    visible.length === 0
      ? 'water.map.no_sensors_subtitle'
      : 'water.map.no_positions_hint';
  const emptyIcon = visible.length === 0 ? 'droplet' : 'geo-alt';

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bgPrimary }}
      edges={[]}
    >
      <AppHeader />

      {isError ? (
        <ErrorBanner message={friendlyApiErrorMessage(error, t)} />
      ) : null}

      <View
        style={{
          backgroundColor: colors.navy,
          paddingTop: spacing.xs,
          paddingBottom: spacing.md,
        }}
      >
        <TreeSelect
          surface="dark"
          icon="geo-alt-fill"
          label={t('indeklima.location_filter.label')}
          value={effectiveLocation}
          onChange={(id) => {
            if (activeTenantId !== null) {
              setSelectedLocation(activeTenantId, id);
            }
          }}
          options={locationSelectOptions}
          placeholder={t('indeklima.sensors.no_locations')}
          inset={spacing.xs}
        />
      </View>

      <View style={{ flex: 1, position: 'relative' }}>
        {isLoading ? <LoadingIndicator /> : null}

        <MapView
          ref={(r) => {
            mapRef.current = r;
          }}
          style={{ flex: 1 }}
          initialRegion={DEFAULT_WATER_REGION}
          maxZoomLevel={19}
          showsCompass={false}
          showsMyLocationButton={false}
          rotateEnabled={false}
          pitchEnabled={false}
          toolbarEnabled={false}
        >
          <UrlTile
            urlTemplate={`${env.apiBaseUrl}/api/tiles/{z}/{x}/{y}`}
            maximumZ={19}
            maximumNativeZ={16}
            tileSize={512}
            flipY={false}
            shouldReplaceMapContent
            tileCachePath={TILE_CACHE_PATH}
            tileCacheMaxAge={TILE_CACHE_MAX_AGE_SECONDS}
          />
          {placedSensors.map((p) => {
            const statusLabel = t(statusLabelKey(p.sensor.status));
            const calloutDescription = p.sensor.location
              ? `${statusLabel} · ${p.sensor.location}`
              : statusLabel;
            return (
              <Marker
                key={p.sensor.numericId}
                coordinate={{ latitude: p.lat, longitude: p.lng }}
                tracksViewChanges={false}
                anchor={{ x: 0.5, y: 0.5 }}
                title={p.sensor.name}
                description={calloutDescription}
                onPress={() => haptic.light()}
              >
                <WaterMapMarker status={p.sensor.status} />
              </Marker>
            );
          })}
        </MapView>

        {/* Empty state — overlaid on the map so the underlying
            tiles still hint at "this is a map" while the user
            understands why no markers are visible. Two variants:
              - No sensors (or location filter removes all of
                them): tell the user there are none.
              - Sensors exist but none have a saved GPS pin:
                explain that placement happens in the web admin. */}
        {!isLoading && placedSensors.length === 0 ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: spacing.md,
              right: spacing.md,
              top: spacing.md,
              padding: spacing.md,
              alignItems: 'center',
              gap: spacing.xs,
              borderRadius: radius.lg,
              backgroundColor: colors.white,
              borderWidth: 1,
              borderColor: colors.gray[200],
              shadowColor: '#0b1a2b',
              shadowOpacity: 0.12,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 3 },
              elevation: 3,
            }}
          >
            <Icon name={emptyIcon} color={colors.gray[300]} size={28} />
            <Text
              style={[
                type.bodyStrong,
                { color: colors.brandDark, textAlign: 'center' },
              ]}
            >
              {t(emptyCopyKey)}
            </Text>
            <Text style={[type.caption, { textAlign: 'center' }]}>
              {t(emptySubtitleKey)}
            </Text>
          </View>
        ) : null}

        {/* Fit-all FAB — floating in the top-right of the map.
            Per `.cursorrules` § "Pressable rendering quirk", the
            absolute positioning lives on the outer <View> (not
            the Pressable's function-style) so iOS doesn't drop
            the layout on re-renders. */}
        {placedSensors.length > 0 ? (
          <View
            style={{
              position: 'absolute',
              top: spacing.sm,
              right: spacing.sm,
              borderRadius: radius.full,
              backgroundColor: colors.white,
              borderWidth: 1,
              borderColor: colors.gray[200],
              shadowColor: '#0b1a2b',
              shadowOpacity: 0.2,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
              elevation: 4,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('indeklima.map.fit_all')}
              onPress={onFitAll}
              style={({ pressed }) => ({
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
              >
                <Icon name="fullscreen" color={colors.brandDark} size={16} />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: colors.brandDark,
                  }}
                >
                  {t('indeklima.map.fit_all')}
                </Text>
              </View>
            </Pressable>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
