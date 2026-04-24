// ══════════════════════════════════════════════════════════════
// RoomAlyzer Mobile — Tailwind config
//
// Mirrors the web app's color tokens (/Users/.../roomalyzer20/tailwind.config.js)
// so the dusty palette, brand colors, and status colors map 1:1.
// Any change to web tokens should be reflected here.
// ══════════════════════════════════════════════════════════════
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#5D7C8F',
          accent: '#3498DB',
          dark: '#2C3E50',
        },
        modal: {
          header: '#EBF5FB',
        },
        bg: {
          primary: '#F4F6F9',
        },
        status: {
          good: '#6c9e83',
          warn: '#f0ad4e',
          bad: '#d65b5b',
          orange: '#d4844a',
        },
        pi: {
          risk: '#d63031',
          unstable: '#e17055',
          good: '#5da83a',
          veryGood: '#1e854a',
          outstanding: '#2980b9',
        },
        // Dusty palette — MANDATORY for any color decision.
        // Never use bright/saturated colors outside this palette.
        dusty: {
          blue: '#5D7C8F',
          sage: '#6c9e83',
          amber: '#f0ad4e',
          red: '#d65b5b',
          navy: '#2C3E50',
          mutedSage: '#7a8c7e',
          taupe: '#8e7c5d',
          teal: '#5b8fa1',
        },
      },
      fontFamily: {
        // Loaded via expo-font in src/theme/fonts.ts
        sans: ['Inter_400Regular'],
        'sans-light': ['Inter_300Light'],
        'sans-medium': ['Inter_500Medium'],
        'sans-semibold': ['Inter_600SemiBold'],
        'sans-bold': ['Inter_700Bold'],
      },
    },
  },
  plugins: [],
};
