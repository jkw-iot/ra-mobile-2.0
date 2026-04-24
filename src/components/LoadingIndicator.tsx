import { View, Text, ActivityIndicator } from 'react-native';

import { colors, spacing, type } from '@/theme';

export interface LoadingIndicatorProps {
  message?: string;
  inline?: boolean;
}

export function LoadingIndicator({ message, inline }: LoadingIndicatorProps) {
  return (
    <View
      style={{
        flex: inline ? 0 : 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
        gap: spacing.md,
      }}
    >
      <ActivityIndicator size="large" color={colors.brandAccent} />
      {message ? <Text style={type.caption}>{message}</Text> : null}
    </View>
  );
}

export default LoadingIndicator;
