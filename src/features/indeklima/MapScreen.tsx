// ══════════════════════════════════════════════════════════════
// Kort — geographic map of all sensors the user can see.
//
// Mirrors the sensor-list screen in chrome (same dark header,
// same TreeSelect location picker, same ParamPicker) so the two
// tabs feel like two views of the same data. Below the controls
// a `react-native-maps` MapView shows every visible sensor as a
// coloured pill at its saved GPS position (or a deterministic
// fallback inside the group's bounding box when the sensor has
// not yet been placed on the map in the web admin).
//
// Tapping a marker opens the sensor-detail page on the same
// parameter the user is currently scanning.
//
// Tile data is the OpenStreetMap CARTO tileset, served via the
// Hono `/api/tiles` proxy (no auth required); the same source
// the web Map page uses, so cartographic style stays consistent.
// ══════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueries } from '@tanstack/react-query';

import {
  AppHeader,
  ErrorBanner,
  Icon,
  LoadingIndicator,
  ParamPicker,
  SensorMapMarker,
  TreeSelect,
  type ParamKey,
  type TreeSelectOption,
} from '@/components';
import { colors, radius, spacing, type } from '@/theme';
import {
  buildLocationOptions,
  sensorMatchesLocation,
  sensorSupports,
  buildTypeParamsMap,
  useLocations,
  useSensorGroups,
  useSensorPositions,
  useSensorTypes,
  useSensorsFlat,
} from './hooks';
import {
  DEFAULT_REGION,
  placeSensors,
  regionForSensors,
} from './mapHelpers';
import {
  normalizeThresholds,
  type NormalizedThresholds,
} from './thresholds';
import { useLocationFilter } from '@/hooks/useLocationFilter';
import { useTenantStore } from '@/stores/tenantStore';
import { useSensorListPrefsStore } from '@/stores/sensorListPrefsStore';
import { indeklimaApi } from '@/services/api';
import { cacheTiers } from '@/lib/queryClient';
import { env } from '@/lib/env';
import { friendlyApiErrorMessage } from '@/lib/apiErrorMessage';
import { haptic } from '@/lib/haptics';
import { TILE_CACHE_MAX_AGE_SECONDS, TILE_CACHE_PATH } from '@/lib/tileCache';

const PARAM_ORDER_INTERNAL: readonly ParamKey[] = [
  'temp',
  'hum',
  'co2',
  'voc',
  'pir',
];

/**
 * "Silent" detection — same heuristic the sensor list uses.
 * A sensor whose statusColor is grey or whose `time` is older
 * than ~24h is rendered with reduced opacity so live data wins
 * on the map.
 */
function isSilent(time: string | undefined, statusColor?: string): boolean {
  if (statusColor === 'grey') return true;
  if (!time) return true;
  if (time.length <= 8) {
    return !/^\d{1,2}:\d{2}$/.test(time);
  }
  const d = new Date(time);
  if (Number.isNaN(d.getTime())) return false;
  const diffMs = Date.now() - d.getTime();
  return diffMs / (1000 * 60 * 60) > 48;
}

export default function IndeklimaMapScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const mapRef = useRef<MapView | null>(null);

  const activeTenantId = useTenantStore((s) => s.activeTenantId);
  const selectedLocationId = useSensorListPrefsStore((s) =>
    activeTenantId === null
      ? null
      : s.selectedLocationByTenant[String(activeTenantId)] ?? null,
  );
  const setSelectedLocation = useSensorListPrefsStore(
    (s) => s.setSelectedLocation,
  );

  const groupsQuery = useSensorGroups();
  const { data: flatSensors, isLoading, isError, error } = useSensorsFlat();
  const sensorTypesQuery = useSensorTypes();
  const locationsQuery = useLocations();
  const positionsQuery = useSensorPositions();

  const typeMap = useMemo(
    () => buildTypeParamsMap(sensorTypesQuery.data),
    [sensorTypesQuery.data],
  );

  const [primaryParam, setPrimaryParam] = useState<ParamKey>('temp');

  const allowed = useLocationFilter(flatSensors, (s) => s.locationId);

  const locationOptions = useMemo(
    () => buildLocationOptions(allowed, locationsQuery.data),
    [allowed, locationsQuery.data],
  );

  const locationSelectOptions = useMemo<TreeSelectOption[]>(
    () =>
      locationOptions.map((o) => ({ id: o.id, label: o.name, depth: o.depth })),
    [locationOptions],
  );

  // Adopt the first available location automatically — same UX
  // pattern as the sensor list, so re-opening the app on either
  // tab never lands on an empty filter.
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

  const availableParams = useMemo<Set<ParamKey>>(() => {
    if (typeMap.size === 0) return new Set(PARAM_ORDER_INTERNAL);
    const found = new Set<ParamKey>();
    for (const s of visible) {
      for (const p of PARAM_ORDER_INTERNAL) {
        if (found.has(p)) continue;
        if (sensorSupports(s.sensorType, p, typeMap)) found.add(p);
      }
      if (found.size === PARAM_ORDER_INTERNAL.length) break;
    }
    return found;
  }, [visible, typeMap]);

  useEffect(() => {
    if (availableParams.size === 0) return;
    if (availableParams.has(primaryParam)) return;
    const first = PARAM_ORDER_INTERNAL.find((p) => availableParams.has(p));
    if (first) setPrimaryParam(first);
  }, [availableParams, primaryParam]);

  const placedSensors = useMemo(
    () => placeSensors(visible, groupsQuery.data, positionsQuery.data),
    [visible, groupsQuery.data, positionsQuery.data],
  );

  // Threshold queries — same batched pattern the list uses, so
  // marker tinting matches the cards 1:1 (down to which API
  // shape variant is honoured per sensor).
  const thresholdQueries = useQueries({
    queries: visible.map((s) => ({
      queryKey: [
        'indeklima',
        'sensor',
        s.id,
        'thresholds',
        { tenantId: activeTenantId },
      ],
      queryFn: () => indeklimaApi.getSensorThresholds(s.id),
      enabled: activeTenantId !== null,
      staleTime: cacheTiers.downsampled.staleTime,
      gcTime: cacheTiers.downsampled.gcTime,
    })),
  });

  const thresholdMap = useMemo(() => {
    const m = new Map<number, NormalizedThresholds>();
    visible.forEach((s, i) => {
      const data = thresholdQueries[i]?.data;
      if (data) m.set(s.id, normalizeThresholds(data));
    });
    return m;
  }, [visible, thresholdQueries]);

  // Auto-fit when the visible sensor set changes. We animate so
  // the user sees the camera move (acts as feedback for their
  // location filter pick), and we guard with a token so very
  // rapid changes only animate to the latest target.
  const fitToken = useRef(0);
  useEffect(() => {
    if (placedSensors.length === 0) return;
    const region = regionForSensors(placedSensors);
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
    const region = regionForSensors(placedSensors);
    if (region) mapRef.current?.animateToRegion(region, 350);
  }, [placedSensors]);

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

        <View
          style={{
            paddingHorizontal: spacing.xs,
            paddingTop: spacing.xs,
            paddingBottom: spacing.md,
          }}
        >
          <ParamPicker
            value={primaryParam}
            onChange={setPrimaryParam}
            available={availableParams}
          />
        </View>
      </View>

      <View style={{ flex: 1, position: 'relative' }}>
        {isLoading ? <LoadingIndicator /> : null}

        <MapView
          ref={(r) => {
            mapRef.current = r;
          }}
          style={{ flex: 1 }}
          initialRegion={DEFAULT_REGION}
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
          {placedSensors.map((p) => (
            <Marker
              key={p.sensor.id}
              coordinate={{ latitude: p.lat, longitude: p.lng }}
              // Children-style markers re-render on every camera
              // change unless we opt out — the pill content is
              // static for the lifetime of a fetch, so we can
              // safely turn tracking off and reclaim a lot of FPS
              // on busy maps.
              tracksViewChanges={false}
              anchor={{ x: 0.5, y: 0.5 }}
              onPress={() => {
                haptic.light();
                router.push({
                  pathname: '/sensor/[id]',
                  params: {
                    id: String(p.sensor.id),
                    param: primaryParam,
                  },
                });
              }}
            >
              <SensorMapMarker
                sensor={p.sensor}
                param={primaryParam}
                thresholds={thresholdMap.get(p.sensor.id)}
                silent={isSilent(p.sensor.time, p.sensor.statusColor)}
              />
            </Marker>
          ))}
        </MapView>

        {/* Empty state — overlaid on the map so the underlying tiles
            still hint at "this is a map", but the user has a clear
            message about why no markers are visible. */}
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
            <Icon name="thermometer" color={colors.gray[300]} size={28} />
            <Text
              style={[
                type.bodyStrong,
                { color: colors.brandDark, textAlign: 'center' },
              ]}
            >
              {t('indeklima.sensors.empty')}
            </Text>
            <Text style={[type.caption, { textAlign: 'center' }]}>
              {t('indeklima.sensors.empty_subtitle')}
            </Text>
          </View>
        ) : null}

        {/* Fit-all FAB — floating in the top-right corner of the
            map. Per `.cursorrules` § "Pressable rendering quirk",
            the absolute positioning lives on the outer <View> (not
            the Pressable's function-style) so iOS doesn't
            sporadically drop the layout and re-render the button
            inline at the bottom of the flex column. */}
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
