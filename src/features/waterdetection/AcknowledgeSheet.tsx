// ══════════════════════════════════════════════════════════════
// Acknowledge sheet — bottom-sheet form for kvittering of water
// alarms. Mirrors the web modal in `pages/water/Alarms.jsx`:
//   - Read-only "Kvitterer som <user>"
//   - Required arrival status (radio cards, 5 options)
//   - Required note ≥10 chars
//   - "Send afblæsning" toggle (default ON)
//
// Used in two modes:
//   - `mode: 'single'`  → posts /alarms/{id}/acknowledge
//   - `mode: 'bulk'`    → posts /alarms/acknowledge-all
//
// Visual chrome follows the dashboard's navy/grey palette so it
// feels like a natural extension of the location-picker hero and
// KPI tile language. The dark navy header carries the title; the
// body is white-on-light-grey for legibility of the form.
// ══════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Button, Icon } from '@/components';
import { colors, radius, spacing, type } from '@/theme';
import { haptic } from '@/lib/haptics';
import { ApiError } from '@/services/api/client';
import { waterApi } from '@/services/api';
import { useAuth } from '@/services/auth/AuthProvider';
import { useTenantStore } from '@/stores/tenantStore';
import {
  MAX_ATTACHMENTS,
  PhotoPickError,
  pickFromLibrary,
  takePhoto,
  type CompressedPhoto,
} from '@/lib/photoAttachments';

const ARRIVAL_STATUSES = [
  'large_leak',
  'small_leak',
  'false_alarm',
  'condensation',
  'other',
] as const;
type ArrivalStatus = (typeof ARRIVAL_STATUSES)[number];

const ARRIVAL_ICON: Record<ArrivalStatus, string> = {
  large_leak: 'droplet-fill',
  small_leak: 'droplet',
  false_alarm: 'slash-circle',
  condensation: 'cloud-drizzle',
  other: 'three-dots',
};

const MIN_NOTE_LEN = 10;
const MAX_NOTE_LEN = 1000;

export interface AcknowledgeSheetProps {
  open: boolean;
  onClose: () => void;
  /**
   * Either a single alarm to acknowledge, or `'bulk'` to
   * acknowledge every pending alarm in one shot. The header,
   * subtitle and submit label adapt accordingly.
   */
  target:
    | { mode: 'single'; alarmId: number; sensorName: string; location: string | null }
    | { mode: 'bulk'; activeCount: number }
    | null;
  /** Called after a successful POST so the dashboard can refetch. */
  onAcknowledged?: () => void;
}

export function AcknowledgeSheet({
  open,
  onClose,
  target,
  onAcknowledged,
}: AcknowledgeSheetProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const tenantId = useTenantStore((s) => s.activeTenantId);

  const [arrival, setArrival] = useState<ArrivalStatus | ''>('');
  const [note, setNote] = useState('');
  const [sendCancellation, setSendCancellation] = useState(true);
  const [noteInvalid, setNoteInvalid] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<CompressedPhoto[]>([]);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  const noteRef = useRef<TextInput>(null);

  // Reset state every time the sheet opens for a new target. Keeps
  // the form predictable when bouncing between alarms.
  useEffect(() => {
    if (open) {
      setArrival('');
      setNote('');
      setSendCancellation(true);
      setNoteInvalid(false);
      setSubmitError(null);
      setAttachments([]);
      setAttachmentBusy(false);
      setAttachmentError(null);
    }
  }, [open, target]);

  // Photo attachments are only meaningful for single-alarm acks —
  // bulk mode submits one note for many alarms and the server
  // ignores `attachments` on `/alarms/acknowledge-all`. Hide the
  // section entirely in bulk mode so users aren't tempted to upload
  // photos that will be silently dropped.
  const canAttachPhotos = target?.mode === 'single';

  const ackUserName = useMemo(() => {
    if (user?.name) return user.name;
    if (user?.email) return user.email.split('@')[0] ?? user.email;
    return '—';
  }, [user]);

  const trimmedLength = note.trim().length;
  const canSubmit =
    !!target && arrival !== '' && trimmedLength >= MIN_NOTE_LEN;

  const ackMutation = useMutation({
    mutationFn: async () => {
      if (!target || arrival === '') throw new Error('invalid_state');
      const statusLabel = t(`water.alarms.arrival_${arrival}`);
      const fullNote = `[${statusLabel}] ${note.trim()}`;

      if (target.mode === 'bulk') {
        return waterApi.acknowledgeAllAlarms({
          note: fullNote,
          sendCancellation,
        });
      }

      const payloadAttachments =
        attachments.length > 0
          ? attachments.map((a) => ({
              filename: a.filename,
              dataUrl: a.dataUrl,
              width: a.width,
              height: a.height,
            }))
          : undefined;

      return waterApi.acknowledgeAlarm(target.alarmId, {
        note: fullNote,
        sendCancellation,
        ...(payloadAttachments ? { attachments: payloadAttachments } : {}),
      });
    },
    onSuccess: () => {
      haptic.success();
      // Dashboard query carries the alarm list — bump it so the
      // newly acknowledged row drops out immediately instead of
      // waiting for the 10s auto-refresh tick.
      queryClient.invalidateQueries({
        queryKey: ['waterdetection', 'dashboard', { tenantId }],
      });
      onAcknowledged?.();
      onClose();
    },
    onError: (err) => {
      haptic.error();
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : t('water.alarms.submit_error');
      setSubmitError(msg);
    },
  });

  const slotsLeft = MAX_ATTACHMENTS - attachments.length;

  const handlePickError = useCallback(
    (err: unknown) => {
      haptic.error();
      if (err instanceof PhotoPickError) {
        if (err.code === 'permission') {
          setAttachmentError(t('water.alarms.attachments_permission_denied'));
          return;
        }
        if (err.code === 'compression') {
          setAttachmentError(t('water.alarms.attachments_compression_failed'));
          return;
        }
      }
      setAttachmentError(t('water.alarms.attachments_pick_failed'));
    },
    [t],
  );

  const addFromLibrary = useCallback(async () => {
    if (slotsLeft <= 0 || attachmentBusy) return;
    setAttachmentError(null);
    setAttachmentBusy(true);
    try {
      const picked = await pickFromLibrary(slotsLeft);
      if (picked.length > 0) {
        haptic.success();
        setAttachments((prev) => [...prev, ...picked].slice(0, MAX_ATTACHMENTS));
      }
    } catch (err) {
      handlePickError(err);
    } finally {
      setAttachmentBusy(false);
    }
  }, [slotsLeft, attachmentBusy, handlePickError]);

  const addFromCamera = useCallback(async () => {
    if (slotsLeft <= 0 || attachmentBusy) return;
    setAttachmentError(null);
    setAttachmentBusy(true);
    try {
      const photo = await takePhoto();
      if (photo) {
        haptic.success();
        setAttachments((prev) => [...prev, photo].slice(0, MAX_ATTACHMENTS));
      }
    } catch (err) {
      handlePickError(err);
    } finally {
      setAttachmentBusy(false);
    }
  }, [slotsLeft, attachmentBusy, handlePickError]);

  const promptAddPhoto = useCallback(() => {
    if (slotsLeft <= 0 || attachmentBusy) return;
    haptic.select();

    const cameraLabel = t('water.alarms.attachments_take_photo');
    const libraryLabel = t('water.alarms.attachments_choose_library');
    const cancelLabel = t('common.cancel');

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [cameraLabel, libraryLabel, cancelLabel],
          cancelButtonIndex: 2,
          title: t('water.alarms.attachments_label'),
        },
        (idx) => {
          if (idx === 0) addFromCamera();
          else if (idx === 1) addFromLibrary();
        },
      );
      return;
    }

    // Android: simple two-option dialog (no native bottom sheet
    // without an extra dependency, and Alert is more than enough
    // for a 2-option fork).
    Alert.alert(
      t('water.alarms.attachments_label'),
      undefined,
      [
        { text: cameraLabel, onPress: addFromCamera },
        { text: libraryLabel, onPress: addFromLibrary },
        { text: cancelLabel, style: 'cancel' },
      ],
      { cancelable: true },
    );
  }, [slotsLeft, attachmentBusy, t, addFromCamera, addFromLibrary]);

  const removeAttachment = useCallback((id: string) => {
    haptic.select();
    setAttachments((prev) => prev.filter((a) => a.id !== id));
    setAttachmentError(null);
  }, []);

  const submit = () => {
    if (!canSubmit) {
      if (trimmedLength < MIN_NOTE_LEN) {
        setNoteInvalid(true);
        noteRef.current?.focus();
      }
      return;
    }
    setSubmitError(null);
    setNoteInvalid(false);
    ackMutation.mutate();
  };

  const isBulk = target?.mode === 'bulk';
  const headerTitle = isBulk
    ? t('water.alarms.ack_all_title')
    : t('water.alarms.ack_title');
  const submitLabel = ackMutation.isPending
    ? t('water.alarms.submitting')
    : isBulk && target
      ? t('water.alarms.ack_all_count', { count: target.activeCount })
      : t('water.alarms.submit');

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          style={{
            flex: 1,
            backgroundColor: 'rgba(15,23,42,0.55)',
            justifyContent: 'flex-end',
          }}
          onPress={onClose}
        >
          {/* Stop the inner press from bubbling up so taps on the
              sheet don't dismiss it.

              Layout note: the sheet is a column with a fixed-height
              header, a flex:1 ScrollView, and a fixed-height footer.
              `maxHeight: 92%` caps the sheet, and the flex:1 on the
              ScrollView (further down) lets it shrink within that
              cap and scroll internally — without flex distribution
              the ScrollView would render at its natural content
              height, push the footer past the cap and `overflow:
              hidden` would clip the Cancel/Submit row when the
              user adds tall content like photo thumbnails. */}
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              flexShrink: 1,
              flexDirection: 'column',
              backgroundColor: colors.bgPrimary,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              maxHeight: '92%',
              overflow: 'hidden',
            }}
          >
            {/* ── Navy header ─────────────────────────────── */}
            <View
              style={{
                backgroundColor: colors.navy,
                paddingTop: spacing.md,
                paddingHorizontal: spacing.lg,
                paddingBottom: spacing.md,
              }}
            >
              {/* Drag-handle */}
              <View
                style={{
                  alignSelf: 'center',
                  width: 36,
                  height: 4,
                  borderRadius: radius.full,
                  backgroundColor: 'rgba(255,255,255,0.18)',
                  marginBottom: spacing.sm,
                }}
              />
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                }}
              >
                <Icon
                  name={isBulk ? 'check2-all' : 'droplet-fill'}
                  color={isBulk ? colors.white : colors.statusBad}
                  size={22}
                />
                <Text
                  style={{
                    flex: 1,
                    color: colors.white,
                    fontSize: 17,
                    fontWeight: '700',
                    letterSpacing: -0.2,
                  }}
                  numberOfLines={1}
                >
                  {headerTitle}
                </Text>
                <Pressable
                  onPress={onClose}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.close')}
                  style={({ pressed }) => ({
                    width: 32,
                    height: 32,
                    borderRadius: radius.full,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: pressed
                      ? 'rgba(255,255,255,0.18)'
                      : 'rgba(255,255,255,0.08)',
                  })}
                >
                  <Icon name="x" color={colors.white} size={18} />
                </Pressable>
              </View>

              {/* Sub-context: alarm details OR bulk count info */}
              {target?.mode === 'single' ? (
                <Text
                  style={{
                    color: 'rgba(255,255,255,0.72)',
                    marginTop: 6,
                    fontSize: 12,
                  }}
                  numberOfLines={2}
                >
                  {target.sensorName}
                  {target.location ? `  ·  ${target.location}` : ''}
                </Text>
              ) : null}
              {target?.mode === 'bulk' ? (
                <View
                  style={{
                    marginTop: spacing.sm,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: radius.md,
                    backgroundColor: 'rgba(52,152,219,0.18)',
                    borderWidth: 1,
                    borderColor: 'rgba(52,152,219,0.32)',
                  }}
                >
                  <Icon name="info-circle" color="#9CC9E8" size={13} />
                  <Text
                    style={{
                      flex: 1,
                      color: 'rgba(255,255,255,0.85)',
                      fontSize: 12,
                    }}
                  >
                    {t('water.alarms.ack_all_info', {
                      count: target.activeCount,
                    })}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* ── Form body ─────────────────────────────── */}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
              style={{ flex: 1 }}
              contentContainerStyle={{
                paddingHorizontal: spacing.lg,
                paddingTop: spacing.lg,
                paddingBottom: spacing.lg,
                gap: spacing.lg,
                flexGrow: 1,
              }}
            >
              {/* Acknowledger — read-only chip */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm + 2,
                  backgroundColor: colors.gray[100],
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.gray[200],
                }}
              >
                <Icon name="person" color={colors.gray[500]} size={14} />
                <Text
                  style={[
                    type.caption,
                    { color: colors.gray[500], width: 110 },
                  ]}
                  numberOfLines={1}
                >
                  {t('water.alarms.ack_as')}
                </Text>
                <Text
                  style={{
                    flex: 1,
                    fontSize: 13,
                    fontWeight: '700',
                    color: colors.brandDark,
                  }}
                  numberOfLines={1}
                >
                  {ackUserName}
                </Text>
              </View>

              {/* Arrival status — radio-card list */}
              <View>
                <Text
                  style={[
                    type.caption,
                    {
                      color: colors.gray[700],
                      fontWeight: '600',
                      marginBottom: 6,
                    },
                  ]}
                >
                  {t('water.alarms.arrival_status')}
                  <Text style={{ color: colors.statusBad }}> *</Text>
                </Text>
                <View style={{ gap: 6 }}>
                  {ARRIVAL_STATUSES.map((s) => {
                    const selected = arrival === s;
                    return (
                      <Pressable
                        key={s}
                        onPress={() => {
                          haptic.select();
                          setArrival(s);
                        }}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        accessibilityLabel={t(`water.alarms.arrival_${s}`)}
                        style={({ pressed }) => ({
                          opacity: pressed ? 0.85 : 1,
                        })}
                      >
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: spacing.sm,
                            paddingHorizontal: spacing.md,
                            paddingVertical: spacing.sm + 2,
                            backgroundColor: selected
                              ? colors.navy
                              : colors.white,
                            borderRadius: radius.md,
                            borderWidth: 1,
                            borderColor: selected
                              ? colors.navy
                              : colors.gray[200],
                          }}
                        >
                          <Icon
                            name={ARRIVAL_ICON[s]}
                            color={
                              selected
                                ? 'rgba(255,255,255,0.9)'
                                : colors.gray[500]
                            }
                            size={16}
                          />
                          <Text
                            style={{
                              flex: 1,
                              fontSize: 14,
                              fontWeight: selected ? '700' : '500',
                              color: selected
                                ? colors.white
                                : colors.brandDark,
                            }}
                          >
                            {t(`water.alarms.arrival_${s}`)}
                          </Text>
                          {selected ? (
                            <Icon
                              name="check"
                              color={colors.white}
                              size={16}
                            />
                          ) : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Photo attachments — optional, max 3, single mode only */}
              {canAttachPhotos ? (
                <AttachmentSection
                  attachments={attachments}
                  busy={attachmentBusy}
                  error={attachmentError}
                  onAdd={promptAddPhoto}
                  onRemove={removeAttachment}
                  disabled={ackMutation.isPending}
                />
              ) : null}

              {/* Note */}
              <View>
                <Text
                  style={[
                    type.caption,
                    {
                      color: colors.gray[700],
                      fontWeight: '600',
                      marginBottom: 6,
                    },
                  ]}
                >
                  {t('water.alarms.action_taken')}
                  <Text style={{ color: colors.statusBad }}> *</Text>
                </Text>
                <TextInput
                  ref={noteRef}
                  value={note}
                  onChangeText={(v) => {
                    setNote(v);
                    if (noteInvalid) setNoteInvalid(false);
                  }}
                  placeholder={t('water.alarms.action_placeholder')}
                  placeholderTextColor={colors.gray[400]}
                  multiline
                  textAlignVertical="top"
                  maxLength={MAX_NOTE_LEN}
                  style={{
                    minHeight: 96,
                    backgroundColor: colors.white,
                    borderWidth: 1,
                    borderColor: noteInvalid
                      ? colors.statusBad
                      : colors.gray[300],
                    borderRadius: radius.md,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm + 2,
                    fontSize: 14,
                    color: colors.gray[800],
                  }}
                />
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 4,
                  }}
                >
                  {noteInvalid ? (
                    <Text
                      style={[type.caption, { color: colors.statusBad }]}
                    >
                      {t('water.alarms.action_required_min', {
                        min: MIN_NOTE_LEN,
                      })}
                    </Text>
                  ) : (
                    <Text style={[type.caption, { opacity: 0 }]}>·</Text>
                  )}
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      fontVariant: ['tabular-nums'],
                      color:
                        trimmedLength < MIN_NOTE_LEN
                          ? colors.statusWarn
                          : colors.gray[400],
                    }}
                  >
                    {trimmedLength < MIN_NOTE_LEN
                      ? `${trimmedLength}/${MIN_NOTE_LEN}`
                      : `${trimmedLength}/${MAX_NOTE_LEN}`}
                  </Text>
                </View>
              </View>

              {/* Cancellation switch — dark-grey card */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm + 2,
                  backgroundColor: colors.gray[100],
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.gray[200],
                }}
              >
                <Icon
                  name="bell-slash"
                  color={
                    sendCancellation ? colors.brandAccent : colors.gray[500]
                  }
                  size={18}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '700',
                      color: colors.brandDark,
                    }}
                  >
                    {t('water.alarms.send_cancellation')}
                  </Text>
                  <Text style={[type.caption, { marginTop: 1 }]}>
                    {t('water.alarms.send_cancellation_desc')}
                  </Text>
                </View>
                <Switch
                  value={sendCancellation}
                  onValueChange={(v) => {
                    haptic.select();
                    setSendCancellation(v);
                  }}
                  trackColor={{
                    false: colors.gray[300],
                    true: colors.brandAccent,
                  }}
                  thumbColor={colors.white}
                  ios_backgroundColor={colors.gray[300]}
                />
              </View>

              {submitError ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderRadius: radius.md,
                    backgroundColor: 'rgba(214,91,91,0.10)',
                    borderWidth: 1,
                    borderColor: 'rgba(214,91,91,0.35)',
                  }}
                >
                  <Icon
                    name="exclamation-circle-fill"
                    color={colors.statusBad}
                    size={16}
                  />
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 12,
                      fontWeight: '600',
                      color: colors.statusBad,
                    }}
                  >
                    {submitError}
                  </Text>
                </View>
              ) : null}
            </ScrollView>

            {/* ── Footer ──────────────────────────────────
                `flexShrink: 0` is load-bearing: when the ScrollView
                is starved for space (lots of attachments + open
                keyboard), RN would otherwise compress the footer
                and the Submit row could end up <44 px tall. */}
            <View
              style={{
                flexShrink: 0,
                flexDirection: 'row',
                gap: spacing.sm,
                paddingHorizontal: spacing.lg,
                paddingTop: spacing.sm,
                paddingBottom: spacing.lg,
                borderTopWidth: 1,
                borderTopColor: colors.gray[200],
                backgroundColor: colors.white,
              }}
            >
              <View style={{ flex: 1 }}>
                <Button
                  label={t('common.cancel')}
                  onPress={onClose}
                  variant="ghost"
                  fullWidth
                />
              </View>
              <View style={{ flex: 1.4 }}>
                <Button
                  label={submitLabel}
                  onPress={submit}
                  variant="primary"
                  icon={isBulk ? 'check2-all' : 'check2-square'}
                  loading={ackMutation.isPending}
                  disabled={!canSubmit || ackMutation.isPending || attachmentBusy}
                  fullWidth
                />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── AttachmentSection ────────────────────────────────────────
// Optional photo strip rendered between "arrival status" and the
// note. Mirrors the web implementation in
// `pages/water/Alarms.jsx` — same layout (3-column grid), same
// 3-photo cap, same error placement. The web uses a hidden
// `<input type=file>`; we route through ActionSheet → ImagePicker
// (camera or library) instead since the native picker is the
// expected mobile pattern.
//
// Visual styling lives on inner `<View>` to match the project's
// "Pressable rendering quirk" workaround documented in
// `.cursorrules`.

interface AttachmentSectionProps {
  attachments: CompressedPhoto[];
  busy: boolean;
  error: string | null;
  onAdd: () => void;
  onRemove: (id: string) => void;
  disabled: boolean;
}

function AttachmentSection({
  attachments,
  busy,
  error,
  onAdd,
  onRemove,
  disabled,
}: AttachmentSectionProps) {
  const { t } = useTranslation();
  const slotsLeft = MAX_ATTACHMENTS - attachments.length;
  const canAdd = slotsLeft > 0 && !busy && !disabled;

  return (
    <View
      style={{
        gap: spacing.sm,
        padding: spacing.md,
        backgroundColor: colors.gray[100],
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.gray[200],
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: spacing.sm,
        }}
      >
        <Text
          style={[
            type.caption,
            { color: colors.gray[700], fontWeight: '600' },
          ]}
        >
          {t('water.alarms.attachments_label')}
          <Text style={{ color: colors.gray[400], fontWeight: '500' }}>
            {' '}
            ({t('common.optional')})
          </Text>
        </Text>
        <Text
          style={{
            fontSize: 11,
            fontWeight: '600',
            fontVariant: ['tabular-nums'],
            color: colors.gray[400],
          }}
        >
          {attachments.length}/{MAX_ATTACHMENTS}
        </Text>
      </View>
      <Text style={[type.caption, { color: colors.gray[500] }]}>
        {t('water.alarms.attachments_optional_hint')}
      </Text>

      {attachments.length > 0 ? (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            marginHorizontal: -3,
          }}
        >
          {attachments.map((a) => (
            <View
              key={a.id}
              style={{
                width: '33.333%',
                aspectRatio: 1,
                padding: 3,
              }}
            >
              <View
                style={{
                  flex: 1,
                  borderRadius: radius.md,
                  overflow: 'hidden',
                  backgroundColor: colors.gray[200],
                  borderWidth: 1,
                  borderColor: colors.gray[200],
                  position: 'relative',
                }}
              >
                <Image
                  source={{ uri: a.previewUri }}
                  style={{ flex: 1 }}
                  resizeMode="cover"
                />
                <Pressable
                  onPress={() => onRemove(a.id)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t('water.alarms.attachments_remove')}
                  disabled={disabled}
                  style={({ pressed }) => ({
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
                  })}
                >
                  <View
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: radius.full,
                      backgroundColor: 'rgba(0,0,0,0.55)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name="x" color={colors.white} size={14} />
                  </View>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {slotsLeft > 0 ? (
        <Pressable
          onPress={canAdd ? onAdd : undefined}
          accessibilityRole="button"
          accessibilityLabel={t('water.alarms.attachments_add')}
          accessibilityState={{ disabled: !canAdd }}
          style={({ pressed }) => ({
            opacity: !canAdd ? 0.5 : pressed ? 0.85 : 1,
          })}
        >
          <View
            style={{
              minHeight: 44,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: colors.gray[300],
              borderRadius: radius.md,
              backgroundColor: colors.white,
            }}
          >
            {busy ? (
              <ActivityIndicator size="small" color={colors.brandAccent} />
            ) : (
              <Icon name="camera" color={colors.brandAccent} size={16} />
            )}
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: colors.brandAccent,
              }}
            >
              {busy
                ? t('water.alarms.attachments_compressing')
                : t('water.alarms.attachments_add')}
            </Text>
          </View>
        </Pressable>
      ) : null}

      {error ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Icon
            name="exclamation-circle-fill"
            color={colors.statusBad}
            size={12}
          />
          <Text
            style={{
              flex: 1,
              fontSize: 11,
              fontWeight: '600',
              color: colors.statusBad,
            }}
          >
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default AcknowledgeSheet;
