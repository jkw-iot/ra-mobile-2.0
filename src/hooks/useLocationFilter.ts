// ══════════════════════════════════════════════════════════════
// useLocationFilter — mirror of the web hook.
//
// Filters lists by `location` (or a custom accessor) against the
// current user's `allowedLocations`. Superadmins and users with
// `allowedLocations === null` see everything.
// ══════════════════════════════════════════════════════════════
import { useMemo } from 'react';

import { useAuth } from '@/services/auth/AuthProvider';

export function useLocationFilter<T>(
  items: readonly T[] | null | undefined,
  getLocation: (item: T) => string | number | null | undefined = (i: T) =>
    (i as unknown as { location?: string | number }).location,
): T[] {
  const { allowedLocations, isSuperAdmin } = useAuth();

  return useMemo(() => {
    if (!items) return [];
    if (isSuperAdmin || !allowedLocations) return [...items];
    const allow = new Set(allowedLocations.map(String));
    return items.filter((item) => {
      const loc = getLocation(item);
      return loc != null && allow.has(String(loc));
    });
  }, [items, allowedLocations, isSuperAdmin, getLocation]);
}
