// ══════════════════════════════════════════════════════════════
// Typography scale — matches web app tokens
//
// Web conventions (from /tailwind.config.js and .cursorrules):
//   Page title     text-xl font-bold text-brand-dark
//   Section label  text-xs font-bold uppercase tracking-wider
//   Body           text-sm text-gray-700
//   Table          text-[13px]
//   Small          text-[10px]..text-[11px]
//
// On mobile we scale everything up slightly (touch targets +
// readability). Keep names identical to web for mental continuity.
// ══════════════════════════════════════════════════════════════
import type { TextStyle } from 'react-native';
import { fontFamily } from './fonts';
import { colors } from './colors';

export const type: Record<string, TextStyle> = {
  pageTitle: {
    fontSize: 22,
    fontFamily: fontFamily('bold'),
    color: colors.brandDark,
  },
  pageSubtitle: {
    fontSize: 12,
    fontFamily: fontFamily('regular'),
    color: colors.gray[500],
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: fontFamily('bold'),
    color: colors.gray[500],
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  body: {
    fontSize: 15,
    fontFamily: fontFamily('regular'),
    color: colors.gray[700],
  },
  bodyStrong: {
    fontSize: 15,
    fontFamily: fontFamily('semibold'),
    color: colors.gray[800],
  },
  list: {
    fontSize: 14,
    fontFamily: fontFamily('regular'),
    color: colors.gray[700],
  },
  caption: {
    fontSize: 12,
    fontFamily: fontFamily('regular'),
    color: colors.gray[500],
  },
  kpiValue: {
    fontSize: 28,
    fontFamily: fontFamily('bold'),
    color: colors.brandDark,
  },
  kpiUnit: {
    fontSize: 14,
    fontFamily: fontFamily('medium'),
    color: colors.gray[500],
  },
  buttonLabel: {
    fontSize: 15,
    fontFamily: fontFamily('semibold'),
    letterSpacing: 0.2,
  },
};
