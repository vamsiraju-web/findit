/**
 * FindIt Theme Constants
 * Dark Teal Color Scheme — unified across all screens
 */
import { Platform, StatusBar } from 'react-native';

export const STATUSBAR_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight || 40) : 50;

export const colors = {
  primary: '#1A3A4A',       // Dark navy-teal (tab bar, headers)
  accent: '#178578',        // Deep teal (logo, buttons, highlights)
  accentLight: '#E0F2EF',   // Light teal background tint

  background: '#E4EAEF',    // Page background (slightly darker gray-blue)
  card: '#FFFFFF',          // White cards

  text: '#1A1D2E',          // Near-black
  textSecondary: '#4A5568', // Dark gray
  textMuted: '#7A8A9A',     // Medium gray
  textWhite: '#FFFFFF',

  success: '#178578',
  warning: '#D4820A',
  danger: '#D94545',

  border: '#D1D9E0',
  divider: '#E8EDF2',

  primaryLight: '#E0F2EF',

  // Category tile colors (teal gradient)
  tiles: {
    docs: '#1A3A4A',
    tools: '#178578',
    loaned: '#2E8B7A',
    stored: '#4AADA5',
  },

  loaned: {
    background: '#FEF3C7',
    text: '#D97706',
  },

  category: {
    background: '#E0F2EF',
    text: '#178578',
  },

  location: {
    background: '#E0F2EF',
    text: '#0F6B5E',
  },

  tab: {
    active: '#FFFFFF',
    inactive: '#7A9BA8',
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
} as const;
