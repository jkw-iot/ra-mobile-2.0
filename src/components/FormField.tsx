// ══════════════════════════════════════════════════════════════
// Form primitives — FormField wrapper + FormInput.
//
// Web parity: label + field + optional error/help. Never hand-roll
// a raw <TextInput> + <Text> label — always wrap in FormField so
// accessibility and styling stay consistent.
// ══════════════════════════════════════════════════════════════
import { View, Text, TextInput, type TextInputProps } from 'react-native';
import type { ReactNode } from 'react';

import { colors, radius, spacing, type } from '@/theme';

export interface FormFieldProps {
  label?: string;
  required?: boolean;
  help?: string;
  error?: string;
  children: ReactNode;
}

export function FormField({ label, required, help, error, children }: FormFieldProps) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? (
        <Text
          style={[
            type.caption,
            { color: colors.gray[700], marginBottom: 4, fontWeight: '600' },
          ]}
        >
          {label}
          {required ? <Text style={{ color: colors.statusBad }}> *</Text> : null}
        </Text>
      ) : null}
      {children}
      {error ? (
        <Text style={[type.caption, { color: colors.statusBad, marginTop: 4 }]}>{error}</Text>
      ) : help ? (
        <Text style={[type.caption, { marginTop: 4 }]}>{help}</Text>
      ) : null}
    </View>
  );
}

export interface FormInputProps extends TextInputProps {
  invalid?: boolean;
}

export function FormInput({ invalid, style, ...rest }: FormInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.gray[400]}
      style={[
        {
          backgroundColor: colors.white,
          borderWidth: 1,
          borderColor: invalid ? colors.statusBad : colors.gray[300],
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm + 2,
          fontSize: 15,
          color: colors.gray[800],
          minHeight: 44,
        },
        style,
      ]}
      {...rest}
    />
  );
}

export default FormField;
