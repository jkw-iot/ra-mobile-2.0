// ══════════════════════════════════════════════════════════════
// useNetworkStatus — reactive wrapper around NetInfo.
//
// Returns the device's current connectivity state so UI can
// distinguish "device is offline" from "server is unreachable".
// The onlineManager integration in queryClient.ts handles the
// TanStack Query side; this hook is for rendering the
// OfflineBanner and adjusting error messages.
// ══════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

export interface NetworkStatus {
  /** `true` = connected, `false` = no connectivity, `null` = unknown (initial) */
  isConnected: boolean | null;
  /** `true` = reachable internet (not just WiFi to a captive portal) */
  isInternetReachable: boolean | null;
  /** `wifi`, `cellular`, `none`, `unknown`, etc. */
  type: string;
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isConnected: null,
    isInternetReachable: null,
    type: 'unknown',
  });

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setStatus({
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
      });
    });
    return unsubscribe;
  }, []);

  return status;
}
