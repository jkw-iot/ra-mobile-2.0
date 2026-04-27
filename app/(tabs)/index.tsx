// ══════════════════════════════════════════════════════════════
// Home — module switcher.
//
// Kort-mønster: ydre View bærer baggrund + skygge (aldrig Pressable,
// da backgroundColor i en Pressable style-callback ikke renderes
// stabilt på iOS). Pressable inde i håndterer tryk + skala.
// ══════════════════════════════════════════════════════════════
import {
  View,
  Text,
  ScrollView,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { AppHeader, Icon } from '@/components';
import { colors, fontFamily, spacing } from '@/theme';
import { useAuth } from '@/services/auth/AuthProvider';
import {
  MODULES,
  useModuleStore,
  type ModuleDef,
} from '@/stores/moduleStore';
import { haptic } from '@/lib/haptics';

// Per-module accent colour fra det dusty palette
const ACCENT: Record<string, string> = {
  indeklima:    '#3498DB',
  preservation: '#6c9e83',
  water:        '#5b8fa1',
  space:        '#5D7C8F',
  pushbuttons:  '#f0ad4e',
  doors:        '#8e7c5d',
  usage:        '#7a8c7e',
};

const COL_GAP  = 12;
const H_PAD    = 16;
const CARD_H   = 116;
const R        = 16;

function ModuleCard({
  module: m,
  isActive,
  onPress,
  colW,
}: {
  module: ModuleDef;
  isActive: boolean;
  onPress: () => void;
  colW: number;
}) {
  const { t } = useTranslation();
  const accent = ACCENT[m.slug] ?? colors.brand;
  const locked  = !m.available;

  /* ── AKTIV KORT ────────────────────────────────────────── */
  if (isActive) {
    return (
      <View
        style={{
          width: colW,
          height: CARD_H,
          borderRadius: R,
          backgroundColor: colors.navy,
          shadowColor: '#0b1a2b',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.28,
          shadowRadius: 14,
          elevation: 8,
        }}
      >
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityState={{ selected: true }}
          accessibilityLabel={t(m.i18nKey)}
          style={({ pressed }) => ({
            width: colW,
            height: CARD_H,
            borderRadius: R,
            opacity: pressed ? 0.88 : 1,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          })}
        >
          <View style={{
            width: colW,
            height: CARD_H,
            borderRadius: R,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 12,
            paddingVertical: 12,
          }}>
            <Text numberOfLines={2} textBreakStrategy="simple" style={{
              fontFamily: fontFamily('bold'),
              fontSize: 15, lineHeight: 20,
              letterSpacing: -0.3,
              color: colors.white,
              textAlign: 'center',
              marginBottom: 10,
            }}>
              {t(m.i18nKey)}
            </Text>
            <View style={{
              width: 44, height: 44, borderRadius: 12,
              backgroundColor: 'rgba(255,255,255,0.18)',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name={m.icon} color={colors.white} size={22} />
            </View>
          </View>
        </Pressable>
      </View>
    );
  }

  /* ── INAKTIVT KORT ─────────────────────────────────────── */
  return (
    <View
      style={{
        width: colW,
        height: CARD_H,
        borderRadius: R,
        backgroundColor: colors.white,
        borderTopWidth: 3,
        borderTopColor: accent,
        shadowColor: '#0b1a2b',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 8,
        elevation: 3,
        opacity: locked ? 0.54 : 1,
      }}
    >
      <Pressable
        onPress={onPress}
        disabled={locked}
        accessibilityRole="button"
        accessibilityState={{ selected: false, disabled: locked }}
        accessibilityLabel={t(m.i18nKey)}
        style={({ pressed }) => ({
            width: colW,
            height: CARD_H,
            borderRadius: R,
            opacity: pressed ? 0.88 : 1,
            transform: [{ scale: pressed && !locked ? 0.97 : 1 }],
          })}
      >
        <View style={{
          width: colW,
          height: CARD_H,
          borderRadius: R,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 12,
          paddingVertical: 12,
        }}>
          <View style={{ alignItems: 'center', marginBottom: 10 }}>
            <Text numberOfLines={2} textBreakStrategy="simple" style={{
              fontFamily: fontFamily('semibold'),
              fontSize: 13, lineHeight: 18,
              letterSpacing: -0.2,
              color: colors.brandDark,
              textAlign: 'center',
            }}>
              {t(m.i18nKey)}
            </Text>
            <Text numberOfLines={1} style={{
              fontFamily: fontFamily('regular'),
              fontSize: 11, lineHeight: 15,
              color: colors.gray[400],
              marginTop: 2,
            }}>
              {t('layout.coming_soon')}
            </Text>
          </View>
          <View style={{
            width: 44, height: 44, borderRadius: 12,
            backgroundColor: accent + '22',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name={m.icon} color={accent} size={22} />
          </View>
        </View>
      </Pressable>
    </View>
  );
}

/* ── Screen ─────────────────────────────────────────────── */
export default function HomeScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const { width: screenW } = useWindowDimensions();
  const activeModule = useModuleStore((s) => s.activeModule);
  const setActiveModule = useModuleStore((s) => s.setActiveModule);

  const colW = (screenW - H_PAD * 2 - COL_GAP) / 2;
  const active = MODULES.some((m) => m.slug === activeModule)
    ? activeModule
    : 'indeklima';

  const greetingName = user?.name?.split(' ')[0] ?? user?.email ?? '';

  const rows: ModuleDef[][] = [];
  for (let i = 0; i < MODULES.length; i += 2) {
    rows.push(MODULES.slice(i, i + 2));
  }

  const handlePick = (m: ModuleDef) => {
    if (!m.available) return;
    haptic.medium();
    setActiveModule(m.slug);
    router.push('/(tabs)/sensors');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary }} edges={['bottom']}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: H_PAD,
          paddingTop: spacing.lg,
          paddingBottom: 100,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        {greetingName ? (
          <View style={{ marginBottom: 28 }}>
            <Text style={{
              fontFamily: fontFamily('bold'),
              fontSize: 10, letterSpacing: 1.4,
              color: colors.brandAccent,
              textTransform: 'uppercase',
              marginBottom: 6,
            }}>
              {t('home.title')}
            </Text>
            <Text style={{
              fontFamily: fontFamily('bold'),
              fontSize: 30, lineHeight: 36,
              letterSpacing: -0.8,
              color: colors.brandDark,
            }}>
              {t('home.greeting', { name: greetingName })}
            </Text>
          </View>
        ) : null}

        {/* Section label */}
        <Text style={{
          fontFamily: fontFamily('bold'),
          fontSize: 11, letterSpacing: 1.2,
          color: colors.gray[400],
          textTransform: 'uppercase',
          marginBottom: 12,
        }}>
          {t('home.choose_module')}
        </Text>

        {/* Grid */}
        <View style={{ gap: COL_GAP }}>
          {rows.map((row) => (
            <View
              key={row.map((m) => m.slug).join('-')}
              style={{ flexDirection: 'row', gap: COL_GAP }}
            >
              {row.map((m) => (
                <ModuleCard
                  key={m.slug}
                  module={m}
                  isActive={m.slug === active}
                  onPress={() => handlePick(m)}
                  colW={colW}
                />
              ))}
              {row.length === 1 ? <View style={{ width: colW }} /> : null}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
