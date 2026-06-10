// ══════════════════════════════════════════════════════════════
// OfflineBanner — persistent, non-dismissible strip shown when
// the device has no network connectivity. Renders nothing when
// online. Uses a calm, muted tone (not alarm-red) so the user
// understands it's a local condition, not a server error.
// ══════════════════════════════════════════════════════════════
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing, type as typography } from '@/theme';
import { Icon } from './Icon';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export function OfflineBanner() {
  const { isConnected } = useNetworkStatus();
  const { t } = useTranslation();

  // null = still determining, true = online → render nothing
  if (isConnected !== false) return null;

  return (
    <View
      accessibilityRole="alert"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: '#EEF0F3',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(93,124,143,0.2)',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(93,124,143,0.14)',
        }}
      >
        <Icon name="wifi-off" color={colors.brand} size={14} />
      </View>
      <Text
        style={[
          typography.caption,
          {
            color: colors.brandDark,
            flex: 1,
            fontWeight: '600',
          },
        ]}
        numberOfLines={1}
      >
        {t('common.offline')}
      </Text>
    </View>
  );
}
