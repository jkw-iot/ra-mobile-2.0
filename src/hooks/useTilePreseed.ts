// ══════════════════════════════════════════════════════════════
// useTilePreseed — warm the tile cache for the active tenant's
// geographic footprint so the Kort screen opens without
// white-grid flicker.
//
// Fires once per unique bounding box (derived from sensor group
// locations). Runs in the background with no UI — errors are
// swallowed since pre-seeding is purely an optimisation.
// ══════════════════════════════════════════════════════════════
import { useEffect, useRef } from 'react';
import { InteractionManager } from 'react-native';

import { useSensorGroups } from '@/features/indeklima/hooks';
import { preseedTiles, type Bounds } from '@/lib/tileCache';

/**
 * Derive the overall bounding box from all sensor groups that
 * have valid `location` bounds.
 */
function boundsFromGroups(
  groups: readonly { location?: { latMin?: number; latMax?: number; lngMin?: number; lngMax?: number } | null }[],
): Bounds | null {
  let latMin = Infinity;
  let latMax = -Infinity;
  let lngMin = Infinity;
  let lngMax = -Infinity;
  let found = false;

  for (const g of groups) {
    const loc = g.location;
    if (
      !loc ||
      typeof loc.latMin !== 'number' || !Number.isFinite(loc.latMin) ||
      typeof loc.latMax !== 'number' || !Number.isFinite(loc.latMax) ||
      typeof loc.lngMin !== 'number' || !Number.isFinite(loc.lngMin) ||
      typeof loc.lngMax !== 'number' || !Number.isFinite(loc.lngMax)
    ) {
      continue;
    }
    if (loc.latMin < latMin) latMin = loc.latMin;
    if (loc.latMax > latMax) latMax = loc.latMax;
    if (loc.lngMin < lngMin) lngMin = loc.lngMin;
    if (loc.lngMax > lngMax) lngMax = loc.lngMax;
    found = true;
  }

  if (!found) return null;
  return { latMin, latMax, lngMin, lngMax };
}

const PRESEED_DELAY_MS = 3000;

export function useTilePreseed() {
  const { data: groups } = useSensorGroups();
  const lastKey = useRef('');

  useEffect(() => {
    if (!groups || groups.length === 0) return;
    const bounds = boundsFromGroups(groups);
    if (!bounds) return;

    const key = `${bounds.latMin},${bounds.latMax},${bounds.lngMin},${bounds.lngMax}`;
    if (key === lastKey.current) return;
    lastKey.current = key;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const handle = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      timer = setTimeout(() => void preseedTiles(bounds), PRESEED_DELAY_MS);
    });

    return () => {
      cancelled = true;
      handle.cancel();
      if (timer) clearTimeout(timer);
    };
  }, [groups]);
}
