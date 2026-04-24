// ══════════════════════════════════════════════════════════════
// QueryProvider — wires QueryClient + PersistQueryClientProvider
//
// Maximum cache age is 7 days. On app start, the persisted cache
// is restored from storage, then stale-revalidation kicks in as
// the user navigates. Offline users see the last hydrated snapshot.
// ══════════════════════════════════════════════════════════════
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import type { ReactNode } from 'react';

import { queryClient, queryPersister, cacheTiers } from './queryClient';

const MAX_AGE = cacheTiers.downsampled.gcTime; // 30 days

export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        maxAge: MAX_AGE,
        buster: 'v1',
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
