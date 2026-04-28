// ══════════════════════════════════════════════════════════════
// LiveFeed — sectioned list of active alarms, silent sensors and
// recent heartbeats for the Vanddetektering dashboard.
//
// Visual language mirrors the web Dashboard's "Live aktivitet"
// card: each row is a leading icon (tone-coloured), a sensor name
// + location, and a right-aligned timestamp. Empty state is the
// reassuring "Alt i orden" copy from the web app, so users see
// the same answer when nothing is happening regardless of which
// surface they open.
// ══════════════════════════════════════════════════════════════
import { Fragment, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components';
import { colors, radius, spacing, toneColor, type } from '@/theme';
import { haptic } from '@/lib/haptics';

import type { FeedEvent, FeedSections } from './helpers';
import { formatTimestamp } from './helpers';

export interface LiveFeedProps {
  sections: FeedSections;
  /**
   * If provided, alarm rows render a "Kvittér" pill that calls
   * this with the alarm's id. Silent / heartbeat rows are
   * unaffected — they remain non-interactive.
   */
  onAcknowledgeAlarm?: (alarmId: number) => void;
}

interface RowProps {
  event: FeedEvent;
  onAcknowledgeAlarm?: (alarmId: number) => void;
}

function FeedRow({ event, onAcknowledgeAlarm }: RowProps) {
  const { t } = useTranslation();
  const tint = toneColor(event.tone);

  const timestampLabel = event.neverHeardFrom
    ? t('water.dashboard.feed.never_heard_from')
    : formatTimestamp(event.timestamp);

  const isAlarm = event.type === 'alarm' || event.type === 'dry_unacked';
  const showAckPill =
    isAlarm && event.alarmId != null && !!onAcknowledgeAlarm;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.gray[100],
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: radius.full,
          backgroundColor: `${tint}1A`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={event.iconName} color={tint} size={16} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{
            fontSize: 14,
            fontWeight: '700',
            color: colors.brandDark,
          }}
        >
          {event.sensorName}
        </Text>
        {event.location ? (
          <Text
            numberOfLines={1}
            style={{ fontSize: 12, color: colors.gray[500] }}
          >
            {event.location}
          </Text>
        ) : null}
      </View>
      {event.batteryPct != null ? (
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginRight: spacing.xs }}
        >
          <Icon
            name={event.batteryPct < 20 ? 'battery-low' : 'battery-half'}
            color={event.batteryPct < 20 ? colors.statusBad : colors.gray[500]}
            size={12}
          />
          <Text
            style={{
              fontSize: 11,
              fontWeight: '600',
              color: event.batteryPct < 20 ? colors.statusBad : colors.gray[500],
            }}
          >
            {Math.round(event.batteryPct)}%
          </Text>
        </View>
      ) : null}
      {showAckPill ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('water.alarms.acknowledge')}
          hitSlop={6}
          onPress={() => {
            haptic.light();
            onAcknowledgeAlarm?.(event.alarmId!);
          }}
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: radius.full,
              backgroundColor: colors.navy,
            }}
          >
            <Icon name="check2-square" color={colors.white} size={12} />
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                color: colors.white,
                letterSpacing: 0.2,
              }}
            >
              {t('water.alarms.acknowledge')}
            </Text>
          </View>
        </Pressable>
      ) : (
        <Text
          style={{
            fontSize: 11,
            fontWeight: '600',
            color: colors.gray[500],
            letterSpacing: 0.3,
          }}
        >
          {timestampLabel}
        </Text>
      )}
    </View>
  );
}

interface FeedSectionProps {
  title: string;
  icon: string;
  iconTint: string;
  count?: number;
  events: FeedEvent[];
  emptyLabel?: string;
  onAcknowledgeAlarm?: (alarmId: number) => void;
}

function FeedSection({
  title,
  icon,
  iconTint,
  count,
  events,
  emptyLabel,
  onAcknowledgeAlarm,
}: FeedSectionProps) {
  if (events.length === 0 && !emptyLabel) return null;

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
          backgroundColor: colors.gray[50],
          borderBottomWidth: 1,
          borderBottomColor: colors.gray[100],
        }}
      >
        <Icon name={icon} color={iconTint} size={14} />
        <Text
          style={[
            type.sectionLabel,
            { color: colors.gray[600], flex: 1, letterSpacing: 0.6 },
          ]}
        >
          {title.toUpperCase()}
        </Text>
        {typeof count === 'number' ? (
          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.gray[500] }}>
            {count}
          </Text>
        ) : null}
      </View>
      {events.length === 0 && emptyLabel ? (
        <View style={{ padding: spacing.md }}>
          <Text style={[type.caption, { color: colors.gray[500] }]}>{emptyLabel}</Text>
        </View>
      ) : (
        events.map((e) => (
          <FeedRow
            key={e.id}
            event={e}
            onAcknowledgeAlarm={onAcknowledgeAlarm}
          />
        ))
      )}
    </View>
  );
}

export function LiveFeed({ sections, onAcknowledgeAlarm }: LiveFeedProps) {
  const { t } = useTranslation();

  const isEmpty = useMemo(
    () =>
      sections.alarms.length === 0 &&
      sections.silents.length === 0 &&
      sections.heartbeats.length === 0,
    [sections],
  );

  if (isEmpty) {
    return (
      <View
        style={{
          alignItems: 'center',
          gap: spacing.sm,
          paddingVertical: spacing.xl,
          paddingHorizontal: spacing.lg,
        }}
      >
        <Icon name="check-circle-fill" color={colors.statusGood} size={32} />
        <Text
          style={[type.bodyStrong, { color: colors.brandDark, textAlign: 'center' }]}
        >
          {t('water.dashboard.feed.all_clear_title')}
        </Text>
        <Text style={[type.caption, { textAlign: 'center' }]}>
          {t('water.dashboard.feed.all_clear_subtitle')}
        </Text>
      </View>
    );
  }

  return (
    <Fragment>
      <FeedSection
        title={t('water.dashboard.feed.alarms')}
        icon="exclamation-triangle-fill"
        iconTint={colors.statusBad}
        count={sections.alarms.length}
        events={sections.alarms}
        onAcknowledgeAlarm={onAcknowledgeAlarm}
      />
      <FeedSection
        title={t('water.dashboard.feed.silent')}
        icon="volume-mute"
        iconTint={colors.gray[500]}
        count={sections.silents.length}
        events={sections.silents}
      />
      <FeedSection
        title={t('water.dashboard.feed.heartbeats')}
        icon="heart-pulse"
        iconTint={colors.statusGood}
        count={sections.heartbeats.length}
        events={sections.heartbeats}
      />
    </Fragment>
  );
}

export default LiveFeed;
