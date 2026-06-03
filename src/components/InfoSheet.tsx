// ══════════════════════════════════════════════════════════════
// InfoSheet — lightweight bottom-sheet for read-only info.
//
// Same visual shell as ConfirmModal (dark scrim, rounded white
// sheet sliding up from the bottom) but without action buttons.
// Tap outside to dismiss. Use for battery / coverage details,
// parameter explanations, or any short informational overlay.
// ══════════════════════════════════════════════════════════════
import { Modal, Pressable, View, Text } from 'react-native';

import { colors, radius, spacing, type } from '@/theme';
import { Icon } from './Icon';

export interface InfoSheetProps {
  open: boolean;
  onClose: () => void;
  icon: string;
  iconColor: string;
  title: string;
  children: React.ReactNode;
}

export function InfoSheet({
  open,
  onClose,
  icon,
  iconColor,
  title,
  children,
}: InfoSheetProps) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.45)',
          justifyContent: 'flex-end',
        }}
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.white,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            padding: spacing.xl,
            paddingBottom: spacing.xxl,
            gap: spacing.md,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Icon name={icon} color={iconColor} size={22} />
            <Text style={[type.pageTitle, { fontSize: 18, flex: 1 }]}>{title}</Text>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export interface StatusBarZone {
  key: string;
  color: string;
  active: boolean;
}

export function StatusBar({ zones }: { zones: StatusBarZone[] }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 2,
        height: 6,
        borderRadius: radius.full,
        overflow: 'hidden',
      }}
    >
      {zones.map((z) => (
        <View
          key={z.key}
          style={{
            flex: 1,
            backgroundColor: z.color,
            opacity: z.active ? 1 : 0.2,
          }}
        />
      ))}
    </View>
  );
}

export default InfoSheet;
