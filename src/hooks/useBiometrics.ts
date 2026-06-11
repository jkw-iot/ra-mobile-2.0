// ══════════════════════════════════════════════════════════════
// useBiometrics — exposes biometric capability + human-friendly label
// ══════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';

import { getBiometricCapability, type BiometryType } from '@/services/auth/biometrics';

interface BiometricInfo {
  available: boolean;
  type: BiometryType;
  label: string;
  loading: boolean;
}

const TYPE_LABELS: Record<BiometryType, string> = {
  face: 'Face ID',
  fingerprint: 'Fingeraftryk',
  iris: 'Iris',
  none: 'Biometri',
};

export function useBiometrics(): BiometricInfo {
  const [info, setInfo] = useState<BiometricInfo>({
    available: false,
    type: 'none',
    label: 'Biometri',
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    getBiometricCapability().then((cap) => {
      if (cancelled) return;
      setInfo({
        available: cap.available,
        type: cap.biometryType,
        label: TYPE_LABELS[cap.biometryType],
        loading: false,
      });
    });
    return () => { cancelled = true; };
  }, []);

  return info;
}
