// ══════════════════════════════════════════════════════════════
// Sensor list — flat, searchable, pull-to-refresh.
//
// Layout:
//   - AppHeader (logo + burger)
//   - PageHeading (title / subtitle)
//   - Search input
//   - Horizontal location pills (derived from sensor groupTitle)
//   - FlatList of compact sensor rows
// ══════════════════════════════════════════════════════════════
import { View, Text, Pressable, RefreshControl, FlatList, ScrollView } from 'react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import {
  AppHeader,
  PageHeading,
  LoadingIndicator,
  ErrorBanner,
  SectionCard,
  Icon,
  FormInput,
  StatusDot,
} from '@/components';
import { colors, radius, spacing, type } from '@/theme';
import { useSensorsFlat, type FlatSensor } from '@/features/indeklima/hooks';
import { useLocationFilter } from '@/hooks/useLocationFilter';
import { useAuth } from '@/services/auth/AuthProvider';
import { useTenantStore } from '@/stores/tenantStore';
import type { StatusTone } from '@/theme';

const ALL_LOCATIONS = '__all__';

function toneFromStatusColor(c: FlatSensor['statusColor']): StatusTone {
  if (c === 'green') return 'good';
  if (c === 'red') return 'bad';
  return 'neutral';
}

function formatValue(value: number | string | undefined, unit?: string): string {
  if (value == null || value === '-' || value === '') return '—';
  if (typeof value === 'number') return unit ? `${value.toFixed(1)} ${unit}` : String(value);
  return unit ? `${value} ${unit}` : String(value);
}

/** Normalise backend time strings ("2026-04-23T07:33:00Z", "17:33", "21. nov")
 *  into a short, humane label. Falls back to the raw string if unparseable. */
function formatSensorTime(raw: string | undefined): string {
  if (!raw) return '—';
  // Already short (backend usually returns "17:33" or "21. nov")
  if (raw.length <= 8) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  const MONTHS_DA = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  return `${d.getDate()}. ${MONTHS_DA[d.getMonth()]}`;
}

function SensorRow({ sensor, onPress }: { sensor: FlatSensor; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.gray[100],
        backgroundColor: pressed ? colors.gray[50] : colors.white,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        minHeight: 60,
      })}
      accessibilityRole="button"
      accessibilityLabel={sensor.name}
    >
      <StatusDot tone={toneFromStatusColor(sensor.statusColor)} />
      <View style={{ flex: 1 }}>
        <Text
          style={[type.body, { color: colors.brandDark, fontWeight: '600' }]}
          numberOfLines={1}
        >
          {sensor.name}
        </Text>
        <Text style={type.caption} numberOfLines={1}>
          {sensor.groupTitle}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', minWidth: 70 }}>
        <Text style={[type.body, { fontWeight: '600', color: colors.brandDark }]}>
          {formatValue(sensor.temp, sensor.tempUnit ?? '°C')}
        </Text>
        <Text style={type.caption}>{formatSensorTime(sensor.time)}</Text>
      </View>
      <Icon name="chevron-right" color={colors.gray[300]} size={16} />
    </Pressable>
  );
}

function LocationPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => ({
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs + 2,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: active ? colors.brandAccent : colors.gray[300],
        backgroundColor: active
          ? colors.brandAccent
          : pressed
            ? colors.gray[50]
            : colors.white,
      })}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: active ? '600' : '500',
          color: active ? colors.white : colors.gray[700],
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function SensorsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { tenants } = useAuth();
  const activeTenantId = useTenantStore((s) => s.activeTenantId);
  const activeTenant = tenants.find((ten) => ten.id === activeTenantId);

  const { data, isLoading, isError, error, refetch, isRefetching } = useSensorsFlat();
  const [q, setQ] = useState('');
  const [location, setLocation] = useState<string>(ALL_LOCATIONS);

  // Backend already filters by tenant; this hook enforces allowed_locations
  // for location-restricted users.
  const allowed = useLocationFilter(data, (s) => s.groupTitle);

  // Distinct locations derived from the (already allowed-filtered) list —
  // keeps pills in sync with what the user can actually see.
  const locations = useMemo(() => {
    const set = new Set<string>();
    for (const s of allowed) if (s.groupTitle) set.add(s.groupTitle);
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'da'));
  }, [allowed]);

  // If the currently-selected location disappears (e.g. tenant switch),
  // fall back to showing everything.
  const effectiveLocation =
    location !== ALL_LOCATIONS && !locations.includes(location)
      ? ALL_LOCATIONS
      : location;

  const visible = useMemo(() => {
    const query = q.trim().toLowerCase();
    return allowed.filter((s) => {
      if (effectiveLocation !== ALL_LOCATIONS && s.groupTitle !== effectiveLocation) {
        return false;
      }
      if (!query) return true;
      const hay = [s.name, s.groupTitle, ...(s.path ?? [])].join(' ').toLowerCase();
      return hay.includes(query);
    });
  }, [allowed, q, effectiveLocation]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary }} edges={['top']}>
      <AppHeader />
      <PageHeading
        icon="thermometer-half"
        title={t('indeklima.sensors.title')}
        subtitle={t('indeklima.sensors.subtitle', { tenant: activeTenant?.name ?? '' })}
      />
      {isError ? (
        <ErrorBanner message={(error as Error).message ?? t('errors.unknown')} />
      ) : null}

      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.sm }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            backgroundColor: colors.white,
            borderWidth: 1,
            borderColor: colors.gray[300],
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
          }}
        >
          <Icon name="search" color={colors.gray[400]} size={16} />
          <FormInput
            value={q}
            onChangeText={setQ}
            placeholder={t('indeklima.sensors.search_placeholder')}
            style={{
              flex: 1,
              borderWidth: 0,
              backgroundColor: 'transparent',
              paddingHorizontal: 0,
              minHeight: 40,
            }}
          />
          {q ? (
            <Pressable onPress={() => setQ('')} hitSlop={8} accessibilityRole="button">
              <Icon name="x-circle-fill" color={colors.gray[400]} size={16} />
            </Pressable>
          ) : null}
        </View>

        {locations.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.xs, paddingVertical: spacing.xs }}
          >
            <LocationPill
              label={t('indeklima.sensors.all_locations')}
              active={effectiveLocation === ALL_LOCATIONS}
              onPress={() => setLocation(ALL_LOCATIONS)}
            />
            {locations.map((loc) => (
              <LocationPill
                key={loc}
                label={loc}
                active={effectiveLocation === loc}
                onPress={() => setLocation(loc)}
              />
            ))}
          </ScrollView>
        ) : null}
      </View>

      {isLoading ? <LoadingIndicator /> : null}

      <FlatList
        data={visible}
        keyExtractor={(s) => String(s.id)}
        renderItem={({ item }) => (
          <SensorRow sensor={item} onPress={() => router.push(`/sensor/${item.id}`)} />
        )}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.brandAccent}
          />
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={{ padding: spacing.xl }}>
              <SectionCard title={t('indeklima.sensors.empty')} icon="thermometer">
                <Text style={type.body}>{t('indeklima.sensors.empty_subtitle')}</Text>
              </SectionCard>
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        style={{ backgroundColor: colors.white, marginTop: spacing.md }}
      />
    </SafeAreaView>
  );
}
