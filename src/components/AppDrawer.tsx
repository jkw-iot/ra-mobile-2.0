// ══════════════════════════════════════════════════════════════
// AppDrawer — slide-in side sheet triggered by AppHeader's burger.
//
// Acts as the module switcher: lets the user jump between
// Indeklima, Bevaring, Vanddetektering, etc. The active module
// drives which data is shown elsewhere in the app via
// `useModuleStore`.
//
// Visual language: the entire panel is navy and reuses the same
// translucent-white-on-navy chrome we use at the top of the
// sensor list (location TreeSelect closed-state, parameter
// picker active segment). That makes the drawer feel like an
// extension of the app's brand header rather than a separate
// white sheet bolted on the side.
//
// Tile chrome lives in `ModuleTileGrid`, which carries the
// matching dark-surface styling so every active control on top
// of navy reads as the same family.
//
// Tenant switching, language and sign-out have their own home
// in the Profile tab and are intentionally not duplicated here.
// The Roomalyzer logo isn't repeated either — it already lives
// in the AppHeader behind the dimmed scrim, so duplicating it
// in the drawer was visual noise.
// ══════════════════════════════════════════════════════════════
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { colors, fontFamily, spacing } from '@/theme';
import { Icon } from './Icon';
import { ModuleTileGrid } from './ModuleTileGrid';
import {
  useModuleStore,
  getModulePrimaryRoute,
  type ModuleSlug,
} from '@/stores/moduleStore';
import { haptic } from '@/lib/haptics';

export interface AppDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function AppDrawer({ open, onClose }: AppDrawerProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const activeModule = useModuleStore((s) => s.activeModule);
  const setActiveModule = useModuleStore((s) => s.setActiveModule);

  const handlePickModule = (slug: ModuleSlug) => {
    haptic.medium();
    setActiveModule(slug);
    onClose();
    // The store ignores unavailable modules, so we only land on
    // the new module's primary screen when the picked module
    // actually changed (or was re-selected). The route mapping
    // lives next to each ModuleDef in `moduleStore` so it can
    // diverge per module as more of them ship.
    router.push(getModulePrimaryRoute(slug));
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }}
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            right: 0,
            width: '86%',
            maxWidth: 380,
            // The dim scrim behind the drawer already provides
            // the visual edge; a hairline border on top of it
            // rendered as a too-bright "tick" at the top-left
            // corner where it met the navy header. Dropping the
            // border lets the panel sit cleanly against the
            // dimmed background.
            backgroundColor: colors.navy,
          }}
        >
          {/* Top close-button row. Navy extends up under the
              status bar via `paddingTop: insets.top` so the
              system status text (rendered light-content by
              AppHeader) stays legible. */}
          <View
            style={{
              paddingTop: insets.top,
              paddingHorizontal: spacing.md,
              paddingBottom: spacing.xs,
              alignItems: 'flex-end',
            }}
          >
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              style={({ pressed }) => ({
                width: 36,
                height: 36,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 999,
                backgroundColor: pressed
                  ? 'rgba(255,255,255,0.20)'
                  : 'rgba(255,255,255,0.08)',
              })}
            >
              <Icon name="x" color={colors.white} size={22} />
            </Pressable>
          </View>

          {/* Body — module switcher. */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: spacing.md,
              paddingTop: spacing.md,
              paddingBottom: spacing.xl + insets.bottom,
              paddingRight: spacing.md + insets.right,
            }}
            showsVerticalScrollIndicator={false}
          >
            <Text
              style={{
                fontFamily: fontFamily('bold'),
                fontSize: 11,
                letterSpacing: 1.2,
                // Mirrors the closed-state TreeSelect label
                // (`isDark ? 'rgba(255,255,255,0.65)' : ...`) so
                // the picker section header reads with the same
                // weight as the location-filter label above it.
                color: 'rgba(255,255,255,0.65)',
                textTransform: 'uppercase',
                marginBottom: spacing.md,
              }}
            >
              {t('home.choose_module')}
            </Text>

            <ModuleTileGrid
              activeSlug={activeModule}
              onSelect={handlePickModule}
            />

            <Text
              style={{
                fontFamily: fontFamily('regular'),
                fontSize: 12,
                lineHeight: 16,
                color: 'rgba(255,255,255,0.55)',
                marginTop: spacing.lg,
                textAlign: 'center',
                paddingHorizontal: spacing.sm,
              }}
            >
              {t('home.modules_coming_soon')}
            </Text>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default AppDrawer;
