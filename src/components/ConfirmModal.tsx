// ══════════════════════════════════════════════════════════════
// ConfirmModal — bottom-sheet style confirmation dialog.
// Use for destructive / warning / info confirmations. Never
// re-implement a confirm UI inline.
// ══════════════════════════════════════════════════════════════
import { Modal, Pressable, View, Text } from 'react-native';

import { colors, radius, spacing, type } from '@/theme';
import { Button } from './Button';
import { Icon } from './Icon';

export type ConfirmTone = 'danger' | 'warn' | 'info';

export interface ConfirmModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  tone?: ConfirmTone;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel: string;
  confirmIcon?: string;
}

const TONE_ICON: Record<ConfirmTone, { icon: string; color: string }> = {
  danger: { icon: 'exclamation-triangle-fill', color: colors.statusBad },
  warn:   { icon: 'exclamation-triangle',      color: colors.statusWarn },
  info:   { icon: 'info-circle',                color: colors.brandAccent },
};

export function ConfirmModal({
  open,
  onCancel,
  onConfirm,
  tone = 'info',
  title,
  body,
  confirmLabel,
  cancelLabel,
  confirmIcon,
}: ConfirmModalProps) {
  const t = TONE_ICON[tone];
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.45)',
          justifyContent: 'flex-end',
        }}
        onPress={onCancel}
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
            <Icon name={t.icon} color={t.color} size={22} />
            <Text style={[type.pageTitle, { fontSize: 18, flex: 1 }]}>{title}</Text>
          </View>
          {body ? <Text style={type.body}>{body}</Text> : null}
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button label={cancelLabel} onPress={onCancel} variant="ghost" fullWidth />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label={confirmLabel}
                onPress={onConfirm}
                icon={confirmIcon}
                variant={tone === 'danger' ? 'danger' : 'primary'}
                fullWidth
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default ConfirmModal;
