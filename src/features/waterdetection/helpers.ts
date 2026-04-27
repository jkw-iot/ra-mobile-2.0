// ══════════════════════════════════════════════════════════════
// Vanddetektering — pure helpers shared between Dashboard screen
// and LiveFeed. Ported 1:1 from the web Dashboard.jsx feed builder
// so the two surfaces stay behaviourally identical.
// ══════════════════════════════════════════════════════════════
import type {
  WaterAlarm,
  WaterHeartbeat,
  WaterSilentSensor,
} from '@/services/api';

export type FeedEventType =
  | 'alarm'
  | 'dry_unacked'
  | 'silent'
  | 'heartbeat'
  | 'ack';

export interface FeedEvent {
  id: string;
  type: FeedEventType;
  pinned?: boolean;
  alarmId?: number;
  iconName: string;
  /** Visual tone for the leading icon. Maps to theme colours. */
  tone: 'good' | 'warn' | 'bad' | 'neutral';
  sensorName: string;
  location: string;
  timestamp: string | null;
  batteryPct?: number | null;
  neverHeardFrom?: boolean;
}

export interface FeedSections {
  alarms: FeedEvent[];
  silents: FeedEvent[];
  heartbeats: FeedEvent[];
}

function tsValue(s: string | null | undefined): number {
  if (!s) return 0;
  const n = new Date(s).getTime();
  return Number.isFinite(n) ? n : 0;
}

const byTimeDesc = (a: FeedEvent, b: FeedEvent) =>
  tsValue(b.timestamp) - tsValue(a.timestamp);

export function buildFeedEvents(
  activeAlarms: WaterAlarm[] | null | undefined,
  silentSensors: WaterSilentSensor[] | null | undefined,
  recentHeartbeats: WaterHeartbeat[] | null | undefined,
): FeedSections {
  const alarms: FeedEvent[] = [];
  const silents: FeedEvent[] = [];
  const heartbeats: FeedEvent[] = [];

  for (const alarm of activeAlarms ?? []) {
    if (!alarm) continue;
    const isDryUnacked = alarm.status === 'dry_unacked';
    alarms.push({
      id: `alarm-${alarm.id}`,
      type: isDryUnacked ? 'dry_unacked' : 'alarm',
      pinned: !isDryUnacked,
      alarmId: alarm.id,
      iconName: isDryUnacked ? 'droplet-half' : 'exclamation-triangle-fill',
      tone: isDryUnacked ? 'warn' : 'bad',
      sensorName: alarm.sensorName ?? alarm.sensorId ?? '—',
      location: alarm.location ?? '',
      timestamp: alarm.triggeredAt ?? null,
    });
  }

  for (const sensor of silentSensors ?? []) {
    if (!sensor) continue;
    silents.push({
      id: `silent-${sensor.sensorId}`,
      type: 'silent',
      iconName: 'volume-mute',
      tone: 'neutral',
      sensorName: sensor.name ?? sensor.sensorId ?? '—',
      location: sensor.location ?? '',
      timestamp: sensor.lastSeen,
      batteryPct: sensor.batteryPct,
      neverHeardFrom: sensor.neverHeardFrom,
    });
  }

  for (const hb of recentHeartbeats ?? []) {
    if (!hb) continue;
    heartbeats.push({
      id: `hb-${hb.sensorId}-${hb.receivedAt}`,
      type: 'heartbeat',
      iconName: 'heart-pulse',
      tone: 'good',
      sensorName: hb.sensorName ?? hb.sensorId ?? '—',
      location: hb.location ?? '',
      timestamp: hb.receivedAt,
      batteryPct: hb.batteryPct,
    });
  }

  alarms.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return byTimeDesc(a, b);
  });
  silents.sort(byTimeDesc);
  heartbeats.sort(byTimeDesc);

  return {
    alarms: alarms.slice(0, 20),
    silents: silents.slice(0, 20),
    heartbeats: heartbeats.slice(0, 30),
  };
}

/** Compact "DD. mon · HH:mm" timestamp for feed rows. */
export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export interface AvgResponseInput {
  triggeredAt: string;
}

/**
 * Average minutes since each alarm was triggered. Used as a proxy
 * for "how long the team has had to react to active alarms" — if
 * it climbs the FM team has lingering acks. Returns 0 if no
 * alarms.
 */
export function avgResponseMinutes(
  alarms: ReadonlyArray<AvgResponseInput | null | undefined>,
): number {
  if (!alarms.length) return 0;
  let total = 0;
  let counted = 0;
  for (const a of alarms) {
    if (!a?.triggeredAt) continue;
    const t = new Date(a.triggeredAt).getTime();
    if (!Number.isFinite(t)) continue;
    total += (Date.now() - t) / 60_000;
    counted++;
  }
  if (counted === 0) return 0;
  return Math.round(total / counted);
}
