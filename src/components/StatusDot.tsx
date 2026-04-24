import { View } from 'react-native';

import { toneColor, type StatusTone } from '@/theme';

export function StatusDot({ tone = 'neutral', size = 8 }: { tone?: StatusTone; size?: number }) {
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`Status: ${tone}`}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: toneColor(tone),
      }}
    />
  );
}

export default StatusDot;
