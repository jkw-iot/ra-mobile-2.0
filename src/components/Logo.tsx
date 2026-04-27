// ══════════════════════════════════════════════════════════════
// Logo — RoomAlyzer wordmark.
//
// We ship rasterised PNGs rather than the SVG because the brand
// SVG depends on the proprietary "DIN Condensed" font. That font
// isn't available on iOS/Android, so react-native-svg falls back
// to the system font and the letters break out of the viewBox
// (visible as "LYZER" overflowing on the right). A pre-rendered
// PNG renders identically on every device.
// ══════════════════════════════════════════════════════════════
import { Image, type ImageStyle, type StyleProp } from 'react-native';

const LOGO_DARK = require('../../assets/logo.png');
const LOGO_WHITE = require('../../assets/logo-white.png');

export interface LogoProps {
  width?: number;
  height?: number;
  /** `dark` wordmark on light backgrounds (default), `white` wordmark
   *  on dark backgrounds (the brand-dark header). */
  variant?: 'dark' | 'white';
  style?: StyleProp<ImageStyle>;
}

// Derived from the rasterised asset (≈1200 × 269).
const ASPECT = 4053 / 876;

export function Logo({ width, height, variant = 'dark', style }: LogoProps) {
  let w = width;
  let h = height;
  if (w && !h) h = Math.round(w / ASPECT);
  if (h && !w) w = Math.round(h * ASPECT);
  if (!w && !h) {
    w = 220;
    h = Math.round(220 / ASPECT);
  }

  return (
    <Image
      source={variant === 'white' ? LOGO_WHITE : LOGO_DARK}
      style={[{ width: w, height: h }, style]}
      resizeMode="contain"
      accessible
      accessibilityLabel="RoomAlyzer"
    />
  );
}

export default Logo;
