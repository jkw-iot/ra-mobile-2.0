// ══════════════════════════════════════════════════════════════
// AuthProvider — Firebase + backend profile sync
//
// Mirrors ../roomalyzer20/src/contexts/AuthContext.jsx. Listens to
// Firebase auth state, then fetches the user's profile + tenants +
// modules + allowed locations from the Hono API on each sign-in.
//
// On logout:
//   - Sign out of Firebase (fire-and-forget)
//   - Clear all roomalyzer_* storage
//   - Clear the TanStack Query cache
//   - Redirect to /login (handled by the route guard in app/_layout.tsx)
// ══════════════════════════════════════════════════════════════
import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { isFirebaseConfigured, logout as firebaseLogout, onAuthChange, type FirebaseUser } from './firebase';
import { apiClient } from '@/services/api/client';
import { storage, StorageKeys } from '@/lib/storage';

// ── Types ───────────────────────────────────────────────────
export interface Tenant {
  id: number;
  name: string;
  slug?: string;
}

export interface Module {
  id: number;
  slug: string;
  name?: string;
}

export interface Role {
  id: number;
  slug: string;
  name?: string;
}

export interface UserProfile {
  id: number;
  email: string;
  name?: string;
  firebase_uid?: string;
}

export interface AuthProfile {
  user: UserProfile | null;
  roles: Role[];
  permissions: string[];
  modules: Module[];
  tenants: Tenant[];
  allowedLocations: string[] | null;
  mfaEnrollmentRequired: boolean;
  mfaEnrolled: boolean;
  tenantRequires2fa: boolean;
}

const EMPTY_PROFILE: AuthProfile = {
  user: null,
  roles: [],
  permissions: [],
  modules: [],
  tenants: [],
  allowedLocations: null,
  mfaEnrollmentRequired: false,
  mfaEnrolled: false,
  tenantRequires2fa: false,
};

interface AuthContextValue extends AuthProfile {
  loading: boolean;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  isLocationRestricted: boolean;
  /**
   * Last error from the post-Firebase backend sync (`/auth/login`
   * → `/auth/me`). Set when Hono is unreachable, Legacy is down,
   * or anything else prevented us from finishing sign-in. The
   * login screen reads this and renders our friendly localised
   * outage message via `friendlyApiErrorMessage`. Reset on
   * successful sync, on `clearLoginError`, and on logout.
   */
  loginError: Error | null;
  clearLoginError: () => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  hasRole: (slug: string) => boolean;
  hasPermission: (slug: string) => boolean;
  hasLocationAccess: (locationId: string | number) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Helpers ─────────────────────────────────────────────────
const SENSITIVE_STORAGE_KEYS = [
  StorageKeys.ACTIVE_TENANT,
  StorageKeys.ACTIVE_MODULE,
];

// ── Provider ────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState<AuthProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState<Error | null>(null);
  const cancelledRef = useRef(false);

  const clearLoginError = useCallback(() => setLoginError(null), []);

  const applyBackend = useCallback((data: Record<string, unknown>) => {
    // Backend returns tenants as { tenant_id, tenant_name, tenant_slug } —
    // normalise to our internal { id, name, slug } shape. De-duplicate by id
    // because inherited-from-parent rows can appear multiple times.
    const rawTenants = (data.tenants as Array<Record<string, unknown>>) ?? [];
    const tenantMap = new Map<number, Tenant>();
    for (const row of rawTenants) {
      const id = Number(row.tenant_id ?? row.id);
      if (!Number.isFinite(id)) continue;
      if (tenantMap.has(id)) continue;
      tenantMap.set(id, {
        id,
        name: String(row.tenant_name ?? row.name ?? ''),
        slug: (row.tenant_slug ?? row.slug) as string | undefined,
      });
    }
    setProfile({
      user: (data.user as UserProfile) ?? null,
      roles: (data.roles as Role[]) ?? [],
      permissions: (data.permissions as string[]) ?? [],
      modules: (data.modules as Module[]) ?? [],
      tenants: Array.from(tenantMap.values()),
      allowedLocations: (data.allowed_locations as string[] | null) ?? null,
      mfaEnrollmentRequired: Boolean(data.mfa_enrollment_required),
      mfaEnrolled: Boolean(data.mfa_enrolled),
      tenantRequires2fa: Boolean(data.tenant_requires_2fa),
    });
  }, []);

  const clear = useCallback(() => {
    setProfile(EMPTY_PROFILE);
  }, []);

  useEffect(() => {
    cancelledRef.current = false;

    if (!isFirebaseConfigured()) {
      // Firebase not yet set up — stay unauthenticated but not loading.
      setLoading(false);
      return;
    }

    const unsub = onAuthChange(async (fbUser: FirebaseUser | null) => {
      if (cancelledRef.current) return;
      if (!fbUser) {
        clear();
        setLoading(false);
        return;
      }
      try {
        const data = await apiClient.post<Record<string, unknown>>('/auth/login', {});
        if (!cancelledRef.current) {
          applyBackend(data);
          setLoginError(null);
        }
      } catch (err) {
        // Stash the error so the login screen can render our
        // friendly outage message via `friendlyApiErrorMessage`.
        // We deliberately use `console.warn` instead of
        // `console.error` so RN's dev LogBox doesn't paint a
        // red toast on top of the (already correctly-rendered)
        // banner — the UI is now the canonical surface for this
        // failure, the log line is just trace context.
        console.warn('Backend sync after Firebase auth failed:', err);
        if (!cancelledRef.current) {
          setLoginError(err instanceof Error ? err : new Error(String(err)));
          clear();
          try {
            await firebaseLogout();
          } catch {
            // ignore
          }
        }
      }
      if (!cancelledRef.current) {
        setLoading(false);
      }
    });

    return () => {
      cancelledRef.current = true;
      unsub();
    };
  }, [applyBackend, clear]);

  const logout = useCallback(async () => {
    try {
      await firebaseLogout();
    } catch {
      // ignore
    }
    clear();
    setLoginError(null);
    for (const key of SENSITIVE_STORAGE_KEYS) {
      storage.delete(key);
    }
    queryClient.clear();
  }, [clear, queryClient]);

  const refresh = useCallback(async () => {
    try {
      const data = await apiClient.get<Record<string, unknown>>('/auth/me');
      applyBackend(data);
    } catch (err) {
      console.error('Profile refresh failed:', err);
    }
  }, [applyBackend]);

  const hasRole = useCallback(
    (slug: string) => profile.roles.some((r) => r.slug === slug),
    [profile.roles],
  );
  const hasPermission = useCallback(
    (slug: string) => profile.permissions.includes(slug),
    [profile.permissions],
  );
  const isSuperAdmin = hasRole('superadmin');
  const hasLocationAccess = useCallback(
    (locationId: string | number) => {
      if (isSuperAdmin || !profile.allowedLocations) return true;
      return profile.allowedLocations.includes(String(locationId));
    },
    [isSuperAdmin, profile.allowedLocations],
  );

  const value: AuthContextValue = {
    ...profile,
    loading,
    isAuthenticated: profile.user !== null,
    isSuperAdmin,
    isLocationRestricted: profile.allowedLocations !== null && !isSuperAdmin,
    loginError,
    clearLoginError,
    logout,
    refresh,
    hasRole,
    hasPermission,
    hasLocationAccess,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
