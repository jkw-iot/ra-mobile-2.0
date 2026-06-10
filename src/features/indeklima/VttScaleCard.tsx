// ══════════════════════════════════════════════════════════════
// VttScaleCard — inline VTT mould-index scale visualisation.
//
// Mirrors the web app's VttScalePopover (PopoverBody) adapted for
// React Native. Shows the current value on the 0–6 VTT risk
// scale with a proportional color bar, position marker, tick
// labels, and a legend with active-zone highlighting.
// ══════════════════════════════════════════════════════════════
import { View, Text, type TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components';
import { colors, radius, spacing } from '@/theme';
import { fontFamily } from '@/theme/fonts';

// ── Scale definition (same 3 zones as web) ────────────────

interface ScaleItem {
  min: number;
  max: number;
  labelKey: string;
  hex: string;
}

const VTT_SCALE: readonly ScaleItem[] = [
  { min: 0, max: 1, labelKey: 'indeklima.sensors.vtt.no_risk',      hex: '#6c9e83' },
  { min: 1, max: 3, labelKey: 'indeklima.sensors.vtt.microscopic',   hex: '#f0ad4e' },
  { min: 3, max: 6, labelKey: 'indeklima.sensors.vtt.visual_growth', hex: '#d65b5b' },
];

function statusColor(value: number): string {
  if (value < 1) return colors.statusGood;
  if (value < 3) return colors.statusWarn;
  return colors.statusBad;
}

function activeIndex(value: number): number {
  const idx = VTT_SCALE.findIndex((s) => value >= s.min && value < s.max);
  if (idx >= 0) return idx;
  return VTT_SCALE.findIndex((s) => value >= s.min && value <= s.max);
}

// ── Component ─────────────────────────────────────────────

export type VttTrend = 'rising' | 'falling' | 'stable';

export interface VttScaleCardProps {
  value: number;
  trend?: VttTrend;
  trendDays?: number;
}

function trendIcon(trend: VttTrend): string {
  if (trend === 'rising') return 'arrow-up';
  if (trend === 'falling') return 'arrow-down';
  return 'dash';
}

function trendColor(trend: VttTrend): string {
  if (trend === 'rising') return colors.statusBad;
  if (trend === 'falling') return colors.statusGood;
  return colors.gray[400];
}

export function VttScaleCard({ value, trend, trendDays }: VttScaleCardProps) {
  const { t } = useTranslation();
  const active = activeIndex(value);
  const valColor = statusColor(value);

  return (
    <View
      style={{
        backgroundColor: colors.navy,
        borderRadius: radius.xl,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.1)',
        }}
      >
        <Text
          style={{
            color: colors.white,
            fontFamily: fontFamily('bold'),
            fontSize: 13,
            letterSpacing: 0.3,
          }}
        >
          {t('indeklima.sensors.vtt.scale_title')}
        </Text>
        <Text
          style={{
            color: colors.gray[400],
            fontSize: 10,
            marginTop: 1,
          }}
        >
          {t('indeklima.sensors.vtt.scale_subtitle')}
        </Text>
      </View>

      {/* Large value + trend */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.sm,
          alignItems: 'center',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text
            style={{
              fontSize: 38,
              fontFamily: fontFamily('bold'),
              fontWeight: '800',
              color: valColor,
              fontVariant: ['tabular-nums'],
              letterSpacing: -0.5,
            }}
          >
            {value.toFixed(2).replace('.', ',')}
          </Text>
          {trend ? (
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: 'rgba(255,255,255,0.1)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={trendIcon(trend)} color={trendColor(trend)} size={16} />
            </View>
          ) : null}
        </View>
        {trend && trendDays != null && trendDays > 0 ? (
          <Text
            style={{
              fontSize: 10,
              color: trendColor(trend),
              marginTop: 2,
              fontFamily: fontFamily('semibold'),
            }}
          >
            {t(`indeklima.sensors.vtt.trend_${trend}`)} · {trendDays} {t('common.days')}
          </Text>
        ) : null}
      </View>

      {/* Scale bar + ticks + legend */}
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>
        {/* Color bar */}
        <View style={{ marginBottom: spacing.md }}>
          <View
            style={{
              flexDirection: 'row',
              height: 14,
              borderRadius: radius.md,
              overflow: 'hidden',
            }}
          >
            {VTT_SCALE.map((item, i) => {
              const isActive = i === active;
              return (
                <View
                  key={i}
                  style={{
                    flex: item.max - item.min,
                    backgroundColor: item.hex,
                    opacity: isActive ? 1 : 0.35,
                  }}
                />
              );
            })}
          </View>

          {/* Triangle marker positioned proportionally to value on 0–6 */}
          {active >= 0 && (() => {
            const clamped = Math.max(0, Math.min(6, value));
            const markerColor = VTT_SCALE[active]?.hex ?? colors.gray[400];
            return (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <View style={{ flex: clamped }} />
                <View
                  style={{
                    width: 0,
                    height: 0,
                    borderLeftWidth: 5,
                    borderRightWidth: 5,
                    borderTopWidth: 6,
                    borderLeftColor: 'transparent',
                    borderRightColor: 'transparent',
                    borderTopColor: markerColor,
                    marginLeft: -5,
                  }}
                />
                <View style={{ flex: 6 - clamped }} />
              </View>
            );
          })()}

          {/* Tick labels aligned to zone boundaries */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: active >= 0 ? 0 : spacing.xs,
            }}
          >
            <Text style={tickStyle}>0</Text>
            <View style={{ flex: 1 }} />
            <Text style={tickStyle}>1</Text>
            <View style={{ flex: 2 }} />
            <Text style={tickStyle}>3</Text>
            <View style={{ flex: 3 }} />
            <Text style={tickStyle}>6</Text>
          </View>
        </View>

        {/* Legend rows */}
        <View style={{ gap: 3 }}>
          {VTT_SCALE.map((item, i) => {
            const isActive = i === active;
            return (
              <View
                key={i}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  borderRadius: radius.sm,
                  paddingHorizontal: 6,
                  paddingVertical: 4,
                  ...(isActive
                    ? {
                        backgroundColor: `${item.hex}22`,
                        borderWidth: 1,
                        borderColor: `${item.hex}55`,
                      }
                    : {
                        borderWidth: 1,
                        borderColor: 'transparent',
                      }),
                }}
              >
                {/* Colored dot */}
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: item.hex,
                    ...(isActive
                      ? {
                          shadowColor: item.hex,
                          shadowOpacity: 0.5,
                          shadowRadius: 4,
                          shadowOffset: { width: 0, height: 0 },
                          elevation: 3,
                        }
                      : {}),
                  }}
                />
                {/* Range */}
                <Text
                  style={{
                    fontSize: 11,
                    fontFamily: fontFamily('bold'),
                    fontVariant: ['tabular-nums'],
                    color: item.hex,
                    minWidth: 36,
                  }}
                >
                  {item.min}–{item.max}
                </Text>
                {/* Label */}
                <Text
                  style={{
                    fontSize: 11,
                    fontFamily: fontFamily('semibold'),
                    color: isActive ? colors.white : 'rgba(255,255,255,0.5)',
                    flex: 1,
                  }}
                >
                  {t(item.labelKey)}
                </Text>
                {/* Active indicator */}
                {isActive && (
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '900',
                      color: item.hex,
                    }}
                  >
                    {'◄'}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const tickStyle: TextStyle = {
  fontSize: 9,
  color: colors.gray[400],
  fontVariant: ['tabular-nums'],
};

export default VttScaleCard;
