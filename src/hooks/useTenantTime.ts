// ══════════════════════════════════════════════════════════════
// useTenantTime — React binding for the app's time model.
//
// Resolves the active tenant's IANA timezone (from the auth
// profile, falling back to DEFAULT_TENANT_TIMEZONE) and the active
// UI language, and returns a memoised `TenantTime` whose formatters
// always render in the tenant's wall clock + the user's locale.
//
// Use this in any component that displays a sensor timestamp — never
// call `new Date(apiString)` / `.toLocaleString` directly.
// ══════════════════════════════════════════════════════════════
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  createTenantTime,
  localeForLang,
  DEFAULT_TENANT_TIMEZONE,
  type TenantTime,
} from '@/lib/datetime';
import { useAuth } from '@/services/auth/AuthProvider';
import { useTenantStore } from '@/stores/tenantStore';

export function useTenantTime(): TenantTime {
  const { i18n } = useTranslation();
  const tenants = useAuth().tenants;
  const activeTenantId = useTenantStore((s) => s.activeTenantId);

  const tz =
    tenants.find((t) => t.id === activeTenantId)?.timezone ??
    DEFAULT_TENANT_TIMEZONE;
  const locale = localeForLang(i18n.language);

  return useMemo(() => createTenantTime(tz, locale), [tz, locale]);
}

export default useTenantTime;
