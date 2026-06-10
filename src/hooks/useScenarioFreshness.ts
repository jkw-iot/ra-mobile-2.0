import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Invalidate cached scope-threshold queries (which carry the
 * `scenarioId`) whenever the app returns to the foreground.
 *
 * Scenario assignments can be changed at any time by an admin in
 * the web app. A foreground return is the cheapest moment to mark
 * these queries stale so they're re-fetched next time a component
 * observes them — e.g. when the user navigates to a sensor detail
 * page. The actual network request only happens if a component is
 * mounted that uses the data; invalidation alone is free.
 */
export function useScenarioFreshness(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    let prev: AppStateStatus = AppState.currentState;

    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && prev !== 'active') {
        queryClient.invalidateQueries({
          queryKey: ['indeklima', 'scope-thresholds'],
        });
      }
      prev = next;
    });

    return () => sub.remove();
  }, [queryClient]);
}
