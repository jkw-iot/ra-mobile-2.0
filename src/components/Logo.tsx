// ══════════════════════════════════════════════════════════════
// Logo — vector RoomAlyzer wordmark.
// Use `variant="dark"` (default, gray/brand) on light backgrounds,
// `variant="white"` on dark/brand backgrounds.
// Width/height are maintained by the original aspect ratio.
// ══════════════════════════════════════════════════════════════
import LogoDark from '../../assets/logo.svg';
import LogoWhite from '../../assets/logo-white.svg';

export interface LogoProps {
  width?: number;
  height?: number;
  variant?: 'dark' | 'white';
}

const ASPECT = 4053 / 876; // viewBox w/h

export function Logo({ width, height, variant = 'dark' }: LogoProps) {
  let w = width;
  let h = height;
  if (w && !h) h = Math.round(w / ASPECT);
  if (h && !w) w = Math.round(h * ASPECT);
  if (!w && !h) {
    w = 220;
    h = Math.round(220 / ASPECT);
  }

  const Component = variant === 'white' ? LogoWhite : LogoDark;
  return <Component width={w} height={h} />;
}

export default Logo;
