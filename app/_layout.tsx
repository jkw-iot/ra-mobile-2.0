// ══════════════════════════════════════════════════════════════
// Root layout — providers, font loading, auth-gated routing.
// ══════════════════════════════════════════════════════════════
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, Text } from 'react-native';

import '@/i18n';
import '../global.css';

import { fontMap } from '@/theme/fonts';
import { colors, type } from '@/theme';
import { QueryProvider } from '@/lib/QueryProvider';
import { AuthProvider, useAuth } from '@/services/auth/AuthProvider';
import { LoadingIndicator } from '@/components';
import { useTenantStore } from '@/stores/tenantStore';

SplashScreen.preventAutoHideAsync().catch(() => {});

function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading, isAuthenticated, tenants } = useAuth();
  const activeTenantId = useTenantStore((s) => s.activeTenantId);
  const setActiveTenant = useTenantStore((s) => s.setActiveTenant);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const first = segments[0] as string | undefined;
    const inAuthGroup = first === '(auth)';
    const inTenantSelect = first === 'select-tenant';

    // 1. Not authenticated → force login
    if (!isAuthenticated) {
      if (!inAuthGroup) router.replace('/(auth)/login');
      return;
    }

    // 2. Authenticated but no tenants → backend hasn't granted any access
    if (tenants.length === 0) {
      if (!inAuthGroup) router.replace('/(auth)/login');
      return;
    }

    // 3. Authenticated, single tenant → auto-select and skip picker
    if (tenants.length === 1) {
      const only = tenants[0];
      if (only && activeTenantId !== only.id) {
        setActiveTenant(only.id);
      }
      if (inAuthGroup || inTenantSelect) router.replace('/(tabs)/sensors');
      return;
    }

    // 4. Authenticated, multiple tenants, no active selection → force picker
    if (activeTenantId === null || !tenants.some((t) => t.id === activeTenantId)) {
      if (!inTenantSelect) router.replace('/select-tenant');
      return;
    }

    // 5. Authenticated with valid tenant, sitting on auth/picker → move on
    if (inAuthGroup || inTenantSelect) {
      router.replace('/(tabs)/sensors');
    }
  }, [loading, isAuthenticated, tenants, activeTenantId, setActiveTenant, segments, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
        <LoadingIndicator />
      </View>
    );
  }
  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontMap);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  if (fontError) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          backgroundColor: colors.bgPrimary,
        }}
      >
        <Text style={[type.body, { color: colors.statusBad }]}>
          Font loading failed: {fontError.message}
        </Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryProvider>
          <AuthProvider>
            <StatusBar style="dark" />
            <AuthGate>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.bgPrimary },
                }}
              />
            </AuthGate>
          </AuthProvider>
        </QueryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
