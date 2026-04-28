// ══════════════════════════════════════════════════════════════
// Alerts — list of indoor-climate alert rules.
// Note: the `/indeklima/alerts` endpoint returns alert *rules*
// (configurations), not occurrences. We tag active/inactive.
// ══════════════════════════════════════════════════════════════
import { View, Text, FlatList, RefreshControl } from 'react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  PageHeading,
  LoadingIndicator,
  ErrorBanner,
  SectionCard,
  SegmentedControl,
  StatusDot,
  Icon,
  AppHeader,
} from '@/components';
import { colors, spacing, type } from '@/theme';
import { useAlerts } from '@/features/indeklima/hooks';
import { friendlyApiErrorMessage } from '@/lib/apiErrorMessage';

type Tab = 'active' | 'resolved';

export default function AlertsScreen() {
  const { t } = useTranslation();
  const { data, isLoading, isError, error, refetch, isRefetching } = useAlerts();
  const [tab, setTab] = useState<Tab>('active');

  const filtered = useMemo(() => {
    if (!data) return [];
    if (tab === 'active') return data.filter((a) => a.active);
    return data.filter((a) => !a.active);
  }, [data, tab]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary }} edges={['top']}>
      <AppHeader />
      <PageHeading
        icon="bell"
        title={t('indeklima.alerts.title')}
        subtitle={t('indeklima.alerts.subtitle')}
      />
      {isLoading ? <LoadingIndicator /> : null}

      {isError ? (
        <ErrorBanner message={friendlyApiErrorMessage(error, t)} />
      ) : null}

      <View style={{ padding: spacing.md }}>
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { id: 'active',   label: t('indeklima.alerts.active') },
            { id: 'resolved', label: t('indeklima.alerts.resolved') },
          ]}
          ariaLabel={t('indeklima.alerts.title')}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item, idx) => `${item.sensorId}-${item.param}-${idx}`}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandAccent} />
        }
        renderItem={({ item }) => (
          <View
            style={{
              backgroundColor: colors.white,
              borderBottomWidth: 1,
              borderBottomColor: colors.gray[100],
              padding: spacing.md,
              flexDirection: 'row',
              gap: spacing.sm,
              alignItems: 'flex-start',
            }}
          >
            <Icon
              name={item.active ? 'bell-fill' : 'bell'}
              color={item.active ? colors.statusWarn : colors.gray[400]}
              size={20}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <StatusDot tone={item.active ? 'warn' : 'neutral'} />
                <Text style={[type.body, { color: colors.brandDark, fontWeight: '600', flex: 1 }]}>
                  {item.sensorName}
                </Text>
              </View>
              <Text style={type.caption} numberOfLines={1}>
                {item.location}
              </Text>
              <Text style={type.caption}>
                {item.param.toUpperCase()} · {item.rule} · {item.limit}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={{ padding: spacing.xl }}>
            <SectionCard title={t('indeklima.alerts.empty')} icon="bell">
              <Text style={type.body}>{t('indeklima.alerts.empty')}</Text>
            </SectionCard>
          </View>
        }
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        style={{ backgroundColor: colors.white }}
      />
    </SafeAreaView>
  );
}
