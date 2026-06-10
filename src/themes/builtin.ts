/**
 * Built-in Themes
 * Migrated from Incrementum-CPP QSS themes
 */

import { Theme } from '../types/theme';
import { legacyIndexThemes } from './legacyIndex';

// Modern Dark Theme
export const modernDarkTheme: Theme = {
  id: 'modern-dark',
  name: 'Modern Dark',
  variant: 'dark',
  description: 'VS Code-inspired dark theme',
  colors: {
    background: '#1f2227',
    onBackground: '#f5f7fb',
    surface: '#2a2f36',
    onSurface: '#f5f7fb',
    surfaceVariant: '#333a44',
    primary: '#2f86d9',
    onPrimary: '#ffffff',
    primaryContainer: '#1f4f78',
    onPrimaryContainer: '#e3f0ff',
    secondary: '#5c646f',
    onSecondary: '#f5f7fb',
    outline: '#4b5664',
    outlineVariant: '#39414c',
    error: '#f66d6d',
    onError: '#ffffff',
    errorContainer: '#7a2828',
    onErrorContainer: '#ffcaca',
    success: '#6ae0c4',
    warning: '#ffca3a',
    toolbar: '#242931',
    sidebar: '#1b1f25',
    card: '#2a2f36',
    input: '#2a2f36',
    border: '#4b5664',
    text: '#f5f7fb',
    textSecondary: '#c8d0da',
    link: '#7ab4ff',
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  radius: {
    none: '0',
    sm: '0.125rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    '2xl': '1rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
  },
};

// Material You (Material 3) Dark Theme
export const materialYouTheme: Theme = {
  id: 'material-you',
  name: 'Material You',
  variant: 'dark',
  description: 'Material Design 3 inspired theme',
  colors: {
    background: '#0f0d13',
    onBackground: '#f2eff6',
    surface: '#1a1820',
    onSurface: '#f2eff6',
    surfaceVariant: '#24212a',
    primary: '#c6adff',
    onPrimary: '#2f1d4d',
    primaryContainer: '#4d3a80',
    onPrimaryContainer: '#efe6ff',
    secondary: '#cfc6df',
    onSecondary: '#2f2a3a',
    outline: '#4f4a5a',
    outlineVariant: '#34303d',
    error: '#FFD0CE',
    onError: '#702520',
    errorContainer: '#A83A35',
    onErrorContainer: '#FFEAEA',
    success: '#6ae0c4',
    warning: '#FFE03A',
    toolbar: '#14131a',
    sidebar: '#1a1820',
    card: '#1a1820',
    input: '#1a1820',
    border: '#4f4a5a',
    text: '#f2eff6',
    textSecondary: '#c9c2d4',
    link: '#d7c3ff',
  },
  typography: {
    fontFamily: 'Roboto, "Segoe UI", "Helvetica", "Arial", sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  radius: {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.25rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.3)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.4)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.4)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.4)',
  },
};

// Snow Theme (Light)
export const snowTheme: Theme = {
  id: 'snow',
  name: 'Snow',
  variant: 'light',
  description: 'Minimalist light theme inspired by Omarchy Snow',
  colors: {
    background: '#FAFAFA',
    onBackground: '#2E3440',
    surface: '#FFFFFF',
    onSurface: '#2E3440',
    surfaceVariant: '#F0F4F8',
    primary: '#5E81AC',
    onPrimary: '#FFFFFF',
    primaryContainer: '#E5E9F0',
    onPrimaryContainer: '#2E3440',
    secondary: '#81A1C1',
    onSecondary: '#2E3440',
    outline: '#D8DEE9',
    outlineVariant: '#E5E9F0',
    error: '#BF616A',
    onError: '#FFFFFF',
    errorContainer: '#BF616A',
    onErrorContainer: '#FFFFFF',
    success: '#A3BE8C',
    warning: '#EBCB8B',
    toolbar: '#FAFAFA',
    sidebar: '#ECEFF4',
    card: '#FFFFFF',
    input: '#FFFFFF',
    border: '#D8DEE9',
    text: '#2E3440',
    textSecondary: '#4C566A',
    link: '#5E81AC',
  },
  typography: {
    fontFamily: '"Segoe UI", "Helvetica Neue", "Arial", sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  radius: {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.25rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
  },
};

// Windows 95 Theme
export const windows95Theme: Theme = {
  id: 'windows-95',
  name: 'Windows 95',
  variant: 'light',
  description: 'Classic Windows 95 desktop look with beveled UI controls',
  colors: {
    background: '#008080',
    onBackground: '#000000',
    surface: '#c0c0c0',
    onSurface: '#000000',
    surfaceVariant: '#dfdfdf',
    primary: '#000080',
    onPrimary: '#ffffff',
    primaryContainer: '#0a246a',
    onPrimaryContainer: '#ffffff',
    secondary: '#c0c0c0',
    onSecondary: '#000000',
    outline: '#808080',
    outlineVariant: '#404040',
    error: '#ff0000',
    onError: '#ffffff',
    errorContainer: '#800000',
    onErrorContainer: '#ffffff',
    success: '#008000',
    warning: '#808000',
    toolbar: '#c0c0c0',
    sidebar: '#c0c0c0',
    card: '#c0c0c0',
    input: '#ffffff',
    border: '#808080',
    text: '#000000',
    textSecondary: '#222222',
    link: '#0000ff',
  },
  typography: {
    fontFamily: '"MS Sans Serif", Tahoma, "Segoe UI", sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.8125rem',
      md: '0.875rem',
      lg: '1rem',
      xl: '1.125rem',
      '2xl': '1.25rem',
      '3xl': '1.5rem',
    },
    fontWeight: {
      normal: 400,
      medium: 400,
      semibold: 700,
      bold: 700,
    },
    lineHeight: {
      tight: 1.2,
      normal: 1.35,
      relaxed: 1.5,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.5rem',
    '2xl': '2rem',
    '3xl': '3rem',
  },
  radius: {
    none: '0',
    sm: '0',
    md: '0',
    lg: '0',
    xl: '0',
    '2xl': '0',
    full: '0',
  },
  shadows: {
    sm: 'inset -1px -1px #808080, inset 1px 1px #ffffff',
    md: 'inset -1px -1px #808080, inset 1px 1px #ffffff',
    lg: 'inset -2px -2px #808080, inset 2px 2px #ffffff',
    xl: 'inset -2px -2px #808080, inset 2px 2px #ffffff',
  },
};

// Mistral Dark Theme
export const mistralDarkTheme: Theme = {
  id: 'mistral-dark',
  name: 'Mistral Dark',
  variant: 'dark',
  description: 'Elegant dark theme with muted colors',
  colors: {
    background: '#141414',
    onBackground: '#f2f2f2',
    surface: '#222222',
    onSurface: '#f2f2f2',
    surfaceVariant: '#2d2d2d',
    primary: '#7c54e8',
    onPrimary: '#ffffff',
    primaryContainer: '#4d2595',
    onPrimaryContainer: '#e8ddff',
    secondary: '#6f8c9c',
    onSecondary: '#f2f6f8',
    outline: '#4a4a4a',
    outlineVariant: '#363636',
    error: '#ff6b68',
    onError: '#ffffff',
    errorContainer: '#d14442',
    onErrorContainer: '#ffe0df',
    success: '#7bd97f',
    warning: '#ffb84d',
    toolbar: '#1f1f1f',
    sidebar: '#171717',
    card: '#222222',
    input: '#222222',
    border: '#4a4a4a',
    text: '#f2f2f2',
    textSecondary: '#cfd5db',
    link: '#a88cff',
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  radius: {
    none: '0',
    sm: '0.125rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    '2xl': '1rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.3)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.4)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.4)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.4)',
  },
};

// Aurora Light Theme
export const auroraLightTheme: Theme = {
  id: 'aurora-light',
  name: 'Aurora Light',
  variant: 'light',
  description: 'Inspired by aurora borealis with ethereal gradients',
  colors: {
    background: '#f0f4f8',
    onBackground: '#1a202c',
    surface: '#ffffff',
    onSurface: '#1a202c',
    surfaceVariant: '#e2e8f0',
    primary: '#667eea',
    onPrimary: '#ffffff',
    primaryContainer: '#eef2ff',
    onPrimaryContainer: '#1a202c',
    secondary: '#764ba2',
    onSecondary: '#ffffff',
    outline: '#cbd5e0',
    outlineVariant: '#e2e8f0',
    error: '#fc8181',
    onError: '#ffffff',
    errorContainer: '#c53030',
    onErrorContainer: '#fed7d7',
    success: '#68d391',
    warning: '#f6ad55',
    toolbar: '#ffffff',
    sidebar: '#f7fafc',
    card: '#ffffff',
    input: '#ffffff',
    border: '#e2e8f0',
    text: '#1a202c',
    textSecondary: '#4a5568',
    link: '#667eea',
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  radius: {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.25rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
  },
};

// Forest Light Theme
export const forestLightTheme: Theme = {
  id: 'forest-light',
  name: 'Forest Light',
  variant: 'light',
  description: 'Nature-inspired green theme',
  colors: {
    background: '#f2f7f1',
    onBackground: '#1f2b21',
    surface: '#ffffff',
    onSurface: '#1f2b21',
    surfaceVariant: '#e6f0e4',
    primary: '#4e9e53',
    onPrimary: '#ffffff',
    primaryContainer: '#7fc27c',
    onPrimaryContainer: '#0f160f',
    secondary: '#6b9e6f',
    onSecondary: '#ffffff',
    outline: '#c8d9c2',
    outlineVariant: '#b7d0b1',
    error: '#e57373',
    onError: '#ffffff',
    errorContainer: '#ef5350',
    onErrorContainer: '#ffebee',
    success: '#81c784',
    warning: '#ffb74d',
    toolbar: '#e6f0e4',
    sidebar: '#edf5ea',
    card: '#ffffff',
    input: '#ffffff',
    border: '#b7d0b1',
    text: '#1f2b21',
    textSecondary: '#4a5e4d',
    link: '#4e9e53',
  },
  typography: {
    fontFamily: 'Inter, "Segoe UI", sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  radius: {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.25rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
  },
};

// Ice Blue Theme
export const iceBlueTheme: Theme = {
  id: 'ice-blue',
  name: 'Ice Blue',
  variant: 'light',
  description: 'Cool blue crystal-inspired theme',
  colors: {
    background: '#e3eef7',
    onBackground: '#2b3a42',
    surface: '#f6fbff',
    onSurface: '#2b3a42',
    surfaceVariant: '#c1e2f5',
    primary: '#7ab0d6',
    onPrimary: '#1f2933',
    primaryContainer: '#b8dff8',
    onPrimaryContainer: '#1f2933',
    secondary: '#9cccec',
    onSecondary: '#1f2933',
    outline: '#9cccec',
    outlineVariant: '#7ab0d6',
    error: '#e57373',
    onError: '#ffffff',
    errorContainer: '#ef5350',
    onErrorContainer: '#ffebee',
    success: '#81c784',
    warning: '#ffb74d',
    toolbar: '#d9efff',
    sidebar: '#d3ecff',
    card: '#f6fbff',
    input: '#f6fbff',
    border: '#9cccec',
    text: '#2b3a42',
    textSecondary: '#4a5e6d',
    link: '#7ab0d6',
  },
  typography: {
    fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  radius: {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.25rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
  },
};

// Nocturne Dark Theme
export const nocturneDarkTheme: Theme = {
  id: 'nocturne-dark',
  name: 'Nocturne Dark',
  variant: 'dark',
  description: 'Elegant dark theme with blue accents',
  colors: {
    background: '#10131b',
    onBackground: '#f2f5fb',
    surface: '#181d28',
    onSurface: '#f2f5fb',
    surfaceVariant: '#232a39',
    primary: '#5b7fe6',
    onPrimary: '#ffffff',
    primaryContainer: '#3f5fb8',
    onPrimaryContainer: '#e6edff',
    secondary: '#86a6f2',
    onSecondary: '#101824',
    outline: '#3f4a5e',
    outlineVariant: '#2f3748',
    error: '#ff8989',
    onError: '#ffffff',
    errorContainer: '#d14442',
    onErrorContainer: '#ffe0df',
    success: '#9adfa0',
    warning: '#ffc76d',
    toolbar: '#141923',
    sidebar: '#131821',
    card: '#181d28',
    input: '#171c27',
    border: '#3f4a5e',
    text: '#f2f5fb',
    textSecondary: '#c2cddd',
    link: '#9bb5ff',
  },
  typography: {
    fontFamily: '"JetBrains Mono", "Segoe UI", sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  radius: {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.25rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.3)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.4)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.4)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.4)',
  },
};

// MapQuest Theme
export const mapquestTheme: Theme = {
  id: 'mapquest',
  name: 'MapQuest',
  variant: 'light',
  description: 'Vintage parchment map theme',
  colors: {
    background: '#F2E2C4',
    onBackground: '#3B2F25',
    surface: '#E7D3AE',
    onSurface: '#3B2F25',
    surfaceVariant: '#DDC69F',
    primary: '#8C5A2B',
    onPrimary: '#F8F1E4',
    primaryContainer: '#B28A56',
    onPrimaryContainer: '#1A1410',
    secondary: '#B7976A',
    onSecondary: '#3B2F25',
    outline: '#B7976A',
    outlineVariant: '#C8AF83',
    error: '#c1574f',
    onError: '#ffffff',
    errorContainer: '#b93b32',
    onErrorContainer: '#ffebee',
    success: '#7da88e',
    warning: '#d4a045',
    toolbar: '#DDC69F',
    sidebar: '#E7D3AE',
    card: '#E7D3AE',
    input: '#ffffff',
    border: '#B7976A',
    text: '#3B2F25',
    textSecondary: '#5c4a3d',
    link: '#8C5A2B',
  },
  typography: {
    fontFamily: 'Inter, "Segoe UI", sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  radius: {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.25rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
  },
};

// Milky Matcha Theme
export const milkyMatchaTheme: Theme = {
  id: 'milky-matcha',
  name: 'Milky Matcha',
  variant: 'light',
  description: 'Calming green tea-inspired theme',
  colors: {
    background: '#f7f3e9',
    onBackground: '#253024',
    surface: '#fdfaf4',
    onSurface: '#253024',
    surfaceVariant: '#ffffff',
    primary: '#7da88e',
    onPrimary: '#ffffff',
    primaryContainer: '#cbe4c1',
    onPrimaryContainer: '#253024',
    secondary: '#9ec4ab',
    onSecondary: '#253024',
    outline: '#d9d2c3',
    outlineVariant: '#c4bda8',
    error: '#e57373',
    onError: '#ffffff',
    errorContainer: '#ef5350',
    onErrorContainer: '#ffebee',
    success: '#7da88e',
    warning: '#d4a045',
    toolbar: '#f7f3e9',
    sidebar: '#fdfaf4',
    card: '#ffffff',
    input: '#ffffff',
    border: '#d9d2c3',
    text: '#253024',
    textSecondary: '#4a5a4a',
    link: '#7da88e',
  },
  typography: {
    fontFamily: 'Nunito, "Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  radius: {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.25rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
  },
};

// Sandstone Light Theme
export const sandstoneLightTheme: Theme = {
  id: 'sandstone-light',
  name: 'Sandstone Light',
  variant: 'light',
  description: 'Earthy desert-inspired theme',
  colors: {
    background: '#fdf8f1',
    onBackground: '#2b1f17',
    surface: '#ffffff',
    onSurface: '#2b1f17',
    surfaceVariant: '#f9efe3',
    primary: '#e6a24a',
    onPrimary: '#2b1f17',
    primaryContainer: '#f7c97f',
    onPrimaryContainer: '#2b1f17',
    secondary: '#f0b56a',
    onSecondary: '#2b1f17',
    outline: '#e2d4c4',
    outlineVariant: '#d8c2a9',
    error: '#e57373',
    onError: '#ffffff',
    errorContainer: '#ef5350',
    onErrorContainer: '#ffebee',
    success: '#81c784',
    warning: '#ffb74d',
    toolbar: '#f9efe3',
    sidebar: '#f4eadf',
    card: '#ffffff',
    input: '#ffffff',
    border: '#e2d4c4',
    text: '#2b1f17',
    textSecondary: '#5c4a3a',
    link: '#e6a24a',
  },
  typography: {
    fontFamily: 'Inter, "Segoe UI", sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  radius: {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.25rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
  },
};

// Minecraft Theme
export const minecraftTheme: Theme = {
  id: 'minecraft',
  name: 'Minecraft',
  variant: 'dark',
  description: 'Blocky, earthy Minecraft-inspired theme',
  colors: {
    background: '#3d2b23',
    onBackground: '#fbf7f2',
    surface: '#4b352b',
    onSurface: '#fbf7f2',
    surfaceVariant: '#5a3f33',
    primary: '#7fd463',
    onPrimary: '#1a1d1f',
    primaryContainer: '#3f8f52',
    onPrimaryContainer: '#f0fbf4',
    secondary: '#c7a26f',
    onSecondary: '#1D1D21',
    outline: '#6b5143',
    outlineVariant: '#4d3a30',
    error: '#ff6b6b',
    onError: '#ffffff',
    errorContainer: '#a63b3b',
    onErrorContainer: '#ffe0df',
    success: '#65d97b',
    warning: '#ffbf4d',
    toolbar: '#36251f',
    sidebar: '#2b1f18',
    card: '#4b352b',
    input: '#3f2d25',
    border: '#6b5143',
    text: '#fbf7f2',
    textSecondary: '#e0d6ce',
    link: '#8eea73',
  },
  typography: {
    fontFamily: '"Minecraft", "Courier New", "Monaco", monospace',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  radius: {
    none: '0',
    sm: '0',
    md: '0',
    lg: '0',
    xl: '0',
    '2xl': '0',
    full: '0',
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.3)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.4)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.4)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.4)',
  },
};

// Burnt Umber Theme
export const burntUmberTheme: Theme = {
  id: 'burnt-umber',
  name: 'Burnt Umber',
  variant: 'dark',
  description: 'Deep, nearly-uniform sepia brown theme',
  colors: {
    // Near-uniform brown backdrop (matches the solid look in the reference screenshot).
    background: '#5A3200',
    onBackground: '#F7E9D6',
    surface: '#5A3200',
    onSurface: '#F7E9D6',
    surfaceVariant: '#623803',
    primary: '#F7B955',
    onPrimary: '#2B1F17',
    primaryContainer: '#7A430A',
    onPrimaryContainer: '#FFE8C7',
    secondary: '#C8923E',
    onSecondary: '#2B1F17',
    outline: '#8B5F2B',
    outlineVariant: '#744814',
    error: '#FF6B6B',
    onError: '#2B1F17',
    errorContainer: '#8C2B2B',
    onErrorContainer: '#FFE0DF',
    success: '#7FBF7F',
    warning: '#FFBF4D',
    // Component colors kept close to background to preserve the flat, solid feel.
    toolbar: '#5A3200',
    sidebar: '#5A3200',
    card: '#5A3200',
    input: '#623803',
    border: '#8B5F2B',
    text: '#F7E9D6',
    textSecondary: '#E7CFAF',
    link: '#FFD08A',
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  radius: {
    none: '0',
    sm: '0.125rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    '2xl': '1rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.25)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.35)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.35)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.35)',
  },
};

// Mistral Light Theme
export const mistralLightTheme: Theme = {
  id: 'mistral-light',
  name: 'Mistral Light',
  variant: 'light',
  description: 'Warm cream with ember accents',
  colors: {
    background: '#f5edd3',
    onBackground: '#1e1e1e',
    surface: '#ffffff',
    onSurface: '#1e1e1e',
    surfaceVariant: '#fff5e1',
    primary: '#ff8205',
    onPrimary: '#ffffff',
    primaryContainer: '#ffaf00',
    onPrimaryContainer: '#1e1e1e',
    secondary: '#ff9e33',
    onSecondary: '#ffffff',
    outline: '#ecdaa2',
    outlineVariant: '#e6cf8a',
    error: '#e57373',
    onError: '#ffffff',
    errorContainer: '#ef5350',
    onErrorContainer: '#ffebee',
    success: '#81c784',
    warning: '#ffb74d',
    toolbar: '#fff5e1',
    sidebar: '#ffefd0',
    card: '#ffffff',
    input: '#ffffff',
    border: '#ecdaa2',
    text: '#1e1e1e',
    textSecondary: '#5a5a5a',
    link: '#ff8205',
  },
  typography: {
    fontFamily: '"IBM Plex Sans", "Segoe UI", "Roboto", "Helvetica", "Arial", sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  radius: {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.25rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
  },
};

// Modern Polished Theme
export const modernPolishedTheme: Theme = {
  id: 'modern-polished',
  name: 'Modern Polished',
  variant: 'dark',
  description: 'Refined modern dark theme',
  colors: {
    background: '#0b0d12',
    onBackground: '#eef3f8',
    surface: '#141825',
    onSurface: '#eef3f8',
    surfaceVariant: '#1b2030',
    primary: '#3b7fd6',
    onPrimary: '#ffffff',
    primaryContainer: '#2c5aa7',
    onPrimaryContainer: '#e0edff',
    secondary: '#c0d2e6',
    onSecondary: '#0f1116',
    outline: '#3a4354',
    outlineVariant: '#2c3342',
    error: '#ff6b6b',
    onError: '#ffffff',
    errorContainer: '#d14442',
    onErrorContainer: '#ffe0df',
    success: '#66c96a',
    warning: '#ffd029',
    toolbar: '#0e1119',
    sidebar: '#141825',
    card: '#141825',
    input: '#141825',
    border: '#3a4354',
    text: '#eef3f8',
    textSecondary: '#c4d0de',
    link: '#6fb0ff',
  },
  typography: {
    fontFamily: '"IBM Plex Sans", "Segoe UI", "Roboto", "Helvetica", "Arial", sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  radius: {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.25rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.3)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.4)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.4)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.4)',
  },
};

// Omar Chy Bliss Theme
export const omarChyBlissTheme: Theme = {
  id: 'omar-chy-bliss',
  name: 'Omar Chy Bliss',
  variant: 'light',
  description: 'Artist-created harmonious theme',
  colors: {
    background: '#f5f5f0',
    onBackground: '#2c2c2c',
    surface: '#ffffff',
    onSurface: '#2c2c2c',
    surfaceVariant: '#e8e8e0',
    primary: '#6b8cce',
    onPrimary: '#ffffff',
    primaryContainer: '#a8c5e8',
    onPrimaryContainer: '#1a1a1a',
    secondary: '#9fa8b8',
    onSecondary: '#2c2c2c',
    outline: '#d0d0c8',
    outlineVariant: '#c0c0b8',
    error: '#e57373',
    onError: '#ffffff',
    errorContainer: '#ef5350',
    onErrorContainer: '#ffebee',
    success: '#81c784',
    warning: '#ffb74d',
    toolbar: '#e8e8e0',
    sidebar: '#f0f0e8',
    card: '#ffffff',
    input: '#ffffff',
    border: '#d0d0c8',
    text: '#2c2c2c',
    textSecondary: '#5a5a5a',
    link: '#6b8cce',
  },
  typography: {
    fontFamily: '"SF Pro Display", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  radius: {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.25rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
  },
};

// Super Game Bro Theme
export const superGameBroTheme: Theme = {
  id: 'super-game-bro',
  name: 'Super Game Bro',
  variant: 'dark',
  description: 'Retro gaming-inspired theme',
  colors: {
    background: '#121426',
    onBackground: '#f7f1f6',
    surface: '#19213f',
    onSurface: '#f7f1f6',
    surfaceVariant: '#223458',
    primary: '#e44b6f',
    onPrimary: '#ffffff',
    primaryContainer: '#c23b5d',
    onPrimaryContainer: '#ffe7ee',
    secondary: '#5e3c95',
    onSecondary: '#ffffff',
    outline: '#3b4a72',
    outlineVariant: '#2a3a5c',
    error: '#ff8080',
    onError: '#ffffff',
    errorContainer: '#d14442',
    onErrorContainer: '#ffe0df',
    success: '#5ef084',
    warning: '#ffd045',
    toolbar: '#151c35',
    sidebar: '#0d2a4b',
    card: '#19213f',
    input: '#121426',
    border: '#3b4a72',
    text: '#f7f1f6',
    textSecondary: '#dacbd9',
    link: '#ff7c98',
  },
  typography: {
    fontFamily: '"Press Start 2P", "Courier New", monospace',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  radius: {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.25rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.3)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.4)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.4)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.4)',
  },
};

// Cartographer Theme
export const cartographerTheme: Theme = {
  id: 'cartographer',
  name: 'Cartographer',
  variant: 'light',
  description: 'Vintage map explorer theme',
  colors: {
    background: '#f4e4c1',
    onBackground: '#2c2416',
    surface: '#faf3e0',
    onSurface: '#2c2416',
    surfaceVariant: '#e8dcc8',
    primary: '#8b7355',
    onPrimary: '#ffffff',
    primaryContainer: '#c4a77d',
    onPrimaryContainer: '#1a1610',
    secondary: '#a89070',
    onSecondary: '#2c2416',
    outline: '#d4c4a8',
    outlineVariant: '#c4b498',
    error: '#c1574f',
    onError: '#ffffff',
    errorContainer: '#b93b32',
    onErrorContainer: '#ffebee',
    success: '#7da88e',
    warning: '#d4a045',
    toolbar: '#e8dcc8',
    sidebar: '#faf3e0',
    card: '#faf3e0',
    input: '#ffffff',
    border: '#d4c4a8',
    text: '#2c2416',
    textSecondary: '#5c4a3a',
    link: '#8b7355',
  },
  typography: {
    fontFamily: '"Crimson Text", "Georgia", serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  radius: {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.25rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
  },
};

// High Contrast Light Theme - WCAG AA Compliant
export const highContrastLightTheme: Theme = {
  id: 'high-contrast-light',
  name: 'High Contrast Light',
  variant: 'light',
  description: 'WCAG AA compliant high contrast light theme (4.5:1 minimum)',
  colors: {
    background: '#ffffff',
    onBackground: '#000000',
    surface: '#ffffff',
    onSurface: '#000000',
    surfaceVariant: '#f5f5f5',
    primary: '#0037cc',
    onPrimary: '#ffffff',
    primaryContainer: '#e6efff',
    onPrimaryContainer: '#000000',
    secondary: '#0066cc',
    onSecondary: '#ffffff',
    outline: '#000000',
    outlineVariant: '#333333',
    error: '#cc0000',
    onError: '#ffffff',
    errorContainer: '#ffcccc',
    onErrorContainer: '#000000',
    success: '#008800',
    warning: '#cc6600',
    toolbar: '#f0f0f0',
    sidebar: '#f5f5f5',
    card: '#ffffff',
    input: '#ffffff',
    border: '#000000',
    text: '#000000',
    textSecondary: '#1a1a1a',
    link: '#0037cc',
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  radius: {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.25rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.1)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.15)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.15)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.15)',
  },
};

// High Contrast Dark Theme - WCAG AA Compliant
export const highContrastDarkTheme: Theme = {
  id: 'high-contrast-dark',
  name: 'High Contrast Dark',
  variant: 'dark',
  description: 'WCAG AA compliant high contrast dark theme (4.5:1 minimum)',
  colors: {
    background: '#000000',
    onBackground: '#ffffff',
    surface: '#0a0a0a',
    onSurface: '#ffffff',
    surfaceVariant: '#1a1a1a',
    primary: '#4da6ff',
    onPrimary: '#000000',
    primaryContainer: '#003366',
    onPrimaryContainer: '#ffffff',
    secondary: '#66b3ff',
    onSecondary: '#000000',
    outline: '#e0e0e0',
    outlineVariant: '#b0b0b0',
    error: '#ff6666',
    onError: '#000000',
    errorContainer: '#660000',
    onErrorContainer: '#ffffff',
    success: '#66ff66',
    warning: '#ffcc00',
    toolbar: '#0f0f0f',
    sidebar: '#0a0a0a',
    card: '#1a1a1a',
    input: '#0a0a0a',
    border: '#e0e0e0',
    text: '#ffffff',
    textSecondary: '#e6e6e6',
    link: '#4da6ff',
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  radius: {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.25rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.5)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.6)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.6)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.6)',
  },
};

// Lemon Slice Theme - Fresh citrus burst
export const lemonSliceTheme: Theme = {
  id: 'lemon-slice',
  name: 'Lemon Slice',
  variant: 'light',
  description: 'Zesty citrus freshness with vibrant lemon hues',
  colors: {
    // Base lemon cream background - like lemon meringue
    background: '#FFFBEB',
    onBackground: '#451A03',
    surface: '#FFFFFF',
    onSurface: '#451A03',
    surfaceVariant: '#FEF3C7',
    
    // Bright lemon yellow primary
    primary: '#F59E0B',
    onPrimary: '#FFFFFF',
    primaryContainer: '#FDE68A',
    onPrimaryContainer: '#78350F',
    
    // Lime green secondary for contrast
    secondary: '#84CC16',
    onSecondary: '#FFFFFF',
    outline: '#FCD34D',
    outlineVariant: '#FDE68A',
    
    // Fresh error/warning colors
    error: '#EF4444',
    onError: '#FFFFFF',
    errorContainer: '#FECACA',
    onErrorContainer: '#7F1D1D',
    success: '#22C55E',
    warning: '#F97316',
    
    // Component colors - lemony toolbar/sidebar
    toolbar: '#FEF9C3',
    sidebar: '#FEF3C7',
    card: '#FFFFFF',
    input: '#FFFFFF',
    border: '#FCD34D',
    text: '#451A03',
    textSecondary: '#92400E',
    link: '#D97706',
  },
  typography: {
    fontFamily: '"Quicksand", "Nunito", "Segoe UI", "Helvetica Neue", sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.6,
      relaxed: 1.8,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  radius: {
    none: '0',
    sm: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 2px 4px 0 rgb(251 191 36 / 0.1)',
    md: '0 4px 12px -2px rgb(251 191 36 / 0.15)',
    lg: '0 12px 24px -4px rgb(251 191 36 / 0.2)',
    xl: '0 24px 48px -8px rgb(251 191 36 / 0.25)',
  },
  customCSS: `
    /* Lemon Slice custom styles */
    .sidebar-section {
      background: linear-gradient(180deg, #FEF3C7 0%, #FEF9C3 100%);
    }
    .stats-number {
      color: #D97706;
      font-weight: 700;
    }
    .tab-button-active {
      background: linear-gradient(135deg, #FCD34D 0%, #F59E0B 100%);
      color: white;
    }
  `,
};

// Glassmorphism Theme - Premium glass effect design system
export const glassTheme: Theme = {
  id: 'glass',
  name: 'Glassmorphism',
  variant: 'dark',
  description: 'Premium glassmorphism design with frosted glass effects',
  colors: {
    background: '#0f172a',
    onBackground: '#f1f5f9',
    surface: 'rgba(30, 41, 59, 0.7)',
    onSurface: '#f1f5f9',
    surfaceVariant: 'rgba(51, 65, 85, 0.6)',
    primary: '#38bdf8',
    onPrimary: '#0c4a6e',
    primaryContainer: 'rgba(56, 189, 248, 0.2)',
    onPrimaryContainer: '#e0f2fe',
    secondary: 'rgba(148, 163, 184, 0.5)',
    onSecondary: '#f1f5f9',
    outline: 'rgba(148, 163, 184, 0.2)',
    outlineVariant: 'rgba(148, 163, 184, 0.1)',
    error: '#f87171',
    onError: '#ffffff',
    errorContainer: 'rgba(248, 113, 113, 0.2)',
    onErrorContainer: '#fecaca',
    success: '#34d399',
    warning: '#fbbf24',
    toolbar: 'rgba(15, 23, 42, 0.8)',
    sidebar: 'rgba(15, 23, 42, 0.6)',
    card: 'rgba(30, 41, 59, 0.5)',
    input: 'rgba(30, 41, 59, 0.4)',
    border: 'rgba(148, 163, 184, 0.15)',
    text: '#f1f5f9',
    textSecondary: '#94a3b8',
    link: '#7dd3fc',
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  radius: {
    none: '0',
    sm: '0.125rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.5rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 2px 8px rgba(0, 0, 0, 0.1)',
    md: '0 4px 16px rgba(0, 0, 0, 0.15)',
    lg: '0 8px 32px rgba(31, 38, 135, 0.2)',
    xl: '0 16px 48px rgba(31, 38, 135, 0.25)',
  },
  customCSS: `
    /* Glass theme custom styles */
    .sidebar-section {
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-right: 1px solid rgba(148, 163, 184, 0.1);
    }
    .sidebar-item-active {
      background: rgba(56, 189, 248, 0.15);
      border-left: 3px solid #38bdf8;
    }
    .sidebar-item:hover {
      background: rgba(148, 163, 184, 0.1);
    }
    .bg-sidebar-hover {
      background: rgba(148, 163, 184, 0.08);
    }
    .stats-number {
      color: #38bdf8;
      font-weight: 600;
    }
    .tab-button {
      background: rgba(30, 41, 59, 0.4);
      color: #94a3b8;
      border: 1px solid rgba(148, 163, 184, 0.1);
    }
    .tab-button:hover {
      background: rgba(51, 65, 85, 0.5);
      color: #f1f5f9;
    }
    .tab-button-active {
      background: linear-gradient(135deg, rgba(56, 189, 248, 0.3) 0%, rgba(56, 189, 248, 0.15) 100%);
      color: #f1f5f9;
      border: 1px solid rgba(56, 189, 248, 0.3);
      backdrop-filter: blur(8px);
    }
    .bg-cream {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    }
    /* Glass card effects */
    .glass-card-enhanced {
      background: rgba(30, 41, 59, 0.4);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(148, 163, 184, 0.1);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    }
  `,
};

// Focus Theme (distraction-free reading)
export const focusTheme: Theme = {
  id: 'focus',
  name: 'Focus',
  variant: 'dark',
  description: 'Low-contrast interface with high readability for deep work.',
  colors: {
    background: '#0d1117',
    onBackground: '#c9d1d9',
    surface: '#161b22',
    onSurface: '#c9d1d9',
    surfaceVariant: '#1c2128',
    primary: '#4a5568',
    onPrimary: '#f8fafc',
    primaryContainer: '#2d3748',
    onPrimaryContainer: '#e2e8f0',
    secondary: '#2d3748',
    onSecondary: '#cbd5e1',
    outline: '#30363d',
    outlineVariant: '#21262d',
    error: '#f85149',
    onError: '#ffffff',
    errorContainer: '#7f1d1d',
    onErrorContainer: '#fee2e2',
    success: '#238636',
    warning: '#9e6a03',
    toolbar: '#11161d',
    sidebar: '#11161d',
    card: '#161b22',
    input: '#21262d',
    border: '#30363d',
    text: '#c9d1d9',
    textSecondary: '#8b949e',
    link: '#58a6ff',
  },
  typography: {
    fontFamily: "Charter, 'Iowan Old Style', 'Source Serif 4', Georgia, serif",
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.3,
      normal: 1.6,
      relaxed: 1.8,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  radius: {
    none: '0',
    sm: '2px',
    md: '4px',
    lg: '6px',
    xl: '8px',
    '2xl': '10px',
    full: '9999px',
  },
  shadows: {
    sm: 'none',
    md: '0 2px 8px rgba(0,0,0,0.2)',
    lg: '0 4px 12px rgba(0,0,0,0.3)',
    xl: '0 8px 24px rgba(0,0,0,0.4)',
  },
  customCSS: `
    :root[data-theme-id="focus"] * {
      animation-duration: 80ms !important;
    }
    :root[data-theme-id="focus"] .glass-panel-light,
    :root[data-theme-id="focus"] .glass-panel-heavy,
    :root[data-theme-id="focus"] .glass-card-enhanced {
      backdrop-filter: none !important;
      box-shadow: none !important;
    }
  `,
};

export const focusCompactTheme: Theme = {
  ...focusTheme,
  id: 'focus-compact',
  name: 'Focus (Compact)',
  typography: {
    ...focusTheme.typography,
    fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: {
      xs: '0.7rem',
      sm: '0.8rem',
      md: '0.9rem',
      lg: '1rem',
      xl: '1.1rem',
      '2xl': '1.25rem',
      '3xl': '1.5rem',
    },
    lineHeight: {
      tight: 1.2,
      normal: 1.4,
      relaxed: 1.55,
    },
  },
};

// Solar Sanctuary Theme (Light Animated)
export const solarSanctuaryTheme: Theme = {
  id: 'solar-sanctuary',
  name: 'Solar Sanctuary',
  variant: 'light',
  description: 'Warm light sanctuary with rotating golden solar rays.',
  colors: {
    background: '#fdfbf7',
    onBackground: '#433422',
    surface: 'rgba(255, 253, 249, 0.7)',
    onSurface: '#433422',
    surfaceVariant: 'rgba(247, 241, 227, 0.6)',
    primary: '#e29548',
    onPrimary: '#ffffff',
    primaryContainer: 'rgba(226, 149, 72, 0.15)',
    onPrimaryContainer: '#784408',
    secondary: 'rgba(164, 137, 100, 0.5)',
    onSecondary: '#433422',
    outline: 'rgba(164, 137, 100, 0.2)',
    outlineVariant: 'rgba(164, 137, 100, 0.1)',
    error: '#d9534f',
    onError: '#ffffff',
    errorContainer: 'rgba(217, 83, 79, 0.2)',
    onErrorContainer: '#a94442',
    success: '#60b064',
    warning: '#f0ad4e',
    toolbar: 'rgba(253, 251, 247, 0.8)',
    sidebar: 'rgba(247, 245, 237, 0.65)',
    card: 'rgba(255, 253, 249, 0.55)',
    input: 'rgba(255, 253, 249, 0.45)',
    border: 'rgba(164, 137, 100, 0.18)',
    text: '#433422',
    textSecondary: '#8c765c',
    link: '#d97706',
  },
  typography: {
    fontFamily: '"Outfit", "Inter", -apple-system, sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  radius: {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.25rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 2px 8px rgba(120, 68, 8, 0.05)',
    md: '0 4px 16px rgba(120, 68, 8, 0.08)',
    lg: '0 8px 32px rgba(120, 68, 8, 0.12)',
    xl: '0 16px 48px rgba(120, 68, 8, 0.15)',
  },
  effects: {
    backgroundAnimation: 'sunbeams',
  },
  customCSS: `
    :root[data-theme-id="solar-sanctuary"] .app-shell {
      background: rgba(253, 251, 247, 0.75) !important;
      background-color: rgba(253, 251, 247, 0.75) !important;
    }
    :root[data-theme-id="solar-sanctuary"] .bg-background:not(.app-shell),
    :root[data-theme-id="solar-sanctuary"] .main-content,
    :root[data-theme-id="solar-sanctuary"] .bg-cream {
      background: transparent !important;
      background-color: transparent !important;
    }
    :root[data-theme-id="solar-sanctuary"] .sidebar-section {
      background: rgba(247, 241, 227, 0.5) !important;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-right: 1px solid rgba(164, 137, 100, 0.15);
    }
    :root[data-theme-id="solar-sanctuary"] .sidebar-item-active {
      background: rgba(226, 149, 72, 0.15) !important;
      border-left: 3px solid #e29548 !important;
      color: #784408 !important;
    }
    :root[data-theme-id="solar-sanctuary"] .glass-panel,
    :root[data-theme-id="solar-sanctuary"] .glass-panel-light,
    :root[data-theme-id="solar-sanctuary"] .glass-card-enhanced {
      background: rgba(255, 253, 249, 0.5) !important;
      backdrop-filter: blur(16px);
      border: 1px solid rgba(226, 149, 72, 0.15) !important;
      box-shadow: 0 8px 32px rgba(120, 68, 8, 0.06) !important;
    }
  `,
};

// Serene Meadow Theme (Light Animated)
export const sereneMeadowTheme: Theme = {
  id: 'serene-meadow',
  name: 'Serene Meadow',
  variant: 'light',
  description: 'Fresh botanical light theme with floating dandelion seeds.',
  colors: {
    background: '#f4f8f5',
    onBackground: '#243828',
    surface: 'rgba(255, 255, 255, 0.75)',
    onSurface: '#243828',
    surfaceVariant: 'rgba(230, 240, 232, 0.6)',
    primary: '#5c9c6f',
    onPrimary: '#ffffff',
    primaryContainer: 'rgba(92, 156, 111, 0.15)',
    onPrimaryContainer: '#1e4627',
    secondary: 'rgba(112, 140, 119, 0.5)',
    onSecondary: '#243828',
    outline: 'rgba(112, 140, 119, 0.2)',
    outlineVariant: 'rgba(112, 140, 119, 0.1)',
    error: '#d35b58',
    onError: '#ffffff',
    errorContainer: 'rgba(211, 91, 88, 0.2)',
    onErrorContainer: '#8a2b28',
    success: '#5c9c6f',
    warning: '#dfa73b',
    toolbar: 'rgba(244, 248, 245, 0.8)',
    sidebar: 'rgba(235, 243, 237, 0.65)',
    card: 'rgba(255, 255, 255, 0.55)',
    input: 'rgba(255, 255, 255, 0.45)',
    border: 'rgba(112, 140, 119, 0.18)',
    text: '#243828',
    textSecondary: '#526c58',
    link: '#3f784e',
  },
  typography: {
    fontFamily: '"Outfit", "Inter", sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  radius: {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.25rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 2px 8px rgba(30, 70, 39, 0.04)',
    md: '0 4px 16px rgba(30, 70, 39, 0.06)',
    lg: '0 8px 32px rgba(30, 70, 39, 0.09)',
    xl: '0 16px 48px rgba(30, 70, 39, 0.12)',
  },
  effects: {
    backgroundAnimation: 'dandelions',
  },
  customCSS: `
    :root[data-theme-id="serene-meadow"] .app-shell {
      background: rgba(244, 248, 245, 0.75) !important;
      background-color: rgba(244, 248, 245, 0.75) !important;
    }
    :root[data-theme-id="serene-meadow"] .bg-background:not(.app-shell),
    :root[data-theme-id="serene-meadow"] .main-content,
    :root[data-theme-id="serene-meadow"] .bg-cream {
      background: transparent !important;
      background-color: transparent !important;
    }
    :root[data-theme-id="serene-meadow"] .sidebar-section {
      background: rgba(235, 243, 237, 0.5) !important;
      backdrop-filter: blur(12px);
      border-right: 1px solid rgba(112, 140, 119, 0.15);
    }
    :root[data-theme-id="serene-meadow"] .sidebar-item-active {
      background: rgba(92, 156, 111, 0.15) !important;
      border-left: 3px solid #5c9c6f !important;
      color: #1e4627 !important;
    }
    :root[data-theme-id="serene-meadow"] .glass-panel,
    :root[data-theme-id="serene-meadow"] .glass-panel-light,
    :root[data-theme-id="serene-meadow"] .glass-card-enhanced {
      background: rgba(255, 255, 255, 0.55) !important;
      backdrop-filter: blur(16px);
      border: 1px solid rgba(92, 156, 111, 0.15) !important;
      box-shadow: 0 8px 32px rgba(30, 70, 39, 0.05) !important;
    }
  `,
};

// Rainy Library Theme (Light Animated)
export const rainyLibraryTheme: Theme = {
  id: 'rainy-library',
  name: 'Rainy Library',
  variant: 'light',
  description: 'Cozy academic library under falling rain.',
  colors: {
    background: '#f3f2ee',
    onBackground: '#2f251c',
    surface: 'rgba(255, 254, 250, 0.75)',
    onSurface: '#2f251c',
    surfaceVariant: 'rgba(237, 234, 227, 0.6)',
    primary: '#4a6b82',
    onPrimary: '#ffffff',
    primaryContainer: 'rgba(74, 107, 130, 0.15)',
    onPrimaryContainer: '#1b3240',
    secondary: 'rgba(154, 133, 114, 0.5)',
    onSecondary: '#2f251c',
    outline: 'rgba(154, 133, 114, 0.2)',
    outlineVariant: 'rgba(154, 133, 114, 0.1)',
    error: '#b84a39',
    onError: '#ffffff',
    errorContainer: 'rgba(184, 74, 57, 0.2)',
    onErrorContainer: '#5c1b12',
    success: '#5a8b62',
    warning: '#cc8a2b',
    toolbar: 'rgba(243, 242, 238, 0.8)',
    sidebar: 'rgba(235, 232, 225, 0.65)',
    card: 'rgba(255, 254, 250, 0.55)',
    input: 'rgba(255, 254, 250, 0.45)',
    border: 'rgba(154, 133, 114, 0.18)',
    text: '#2f251c',
    textSecondary: '#75604e',
    link: '#3b5a70',
  },
  typography: {
    fontFamily: '"Outfit", "Inter", -apple-system, sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  radius: {
    none: '0',
    sm: '0.125rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    '2xl': '1rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 2px 8px rgba(47, 37, 28, 0.03)',
    md: '0 4px 16px rgba(47, 37, 28, 0.05)',
    lg: '0 8px 32px rgba(47, 37, 28, 0.08)',
    xl: '0 16px 48px rgba(47, 37, 28, 0.12)',
  },
  effects: {
    backgroundAnimation: 'rainywindow',
  },
  customCSS: `
    :root[data-theme-id="rainy-library"] .app-shell {
      background: rgba(243, 242, 238, 0.75) !important;
      background-color: rgba(243, 242, 238, 0.75) !important;
    }
    :root[data-theme-id="rainy-library"] .bg-background:not(.app-shell),
    :root[data-theme-id="rainy-library"] .main-content,
    :root[data-theme-id="rainy-library"] .bg-cream {
      background: transparent !important;
      background-color: transparent !important;
    }
    :root[data-theme-id="rainy-library"] .sidebar-section {
      background: rgba(235, 232, 225, 0.5) !important;
      backdrop-filter: blur(12px);
      border-right: 1px solid rgba(154, 133, 114, 0.15);
    }
    :root[data-theme-id="rainy-library"] .sidebar-item-active {
      background: rgba(74, 107, 130, 0.15) !important;
      border-left: 3px solid #4a6b82 !important;
      color: #1b3240 !important;
    }
    :root[data-theme-id="rainy-library"] .glass-panel,
    :root[data-theme-id="rainy-library"] .glass-panel-light,
    :root[data-theme-id="rainy-library"] .glass-card-enhanced {
      background: rgba(255, 254, 250, 0.55) !important;
      backdrop-filter: blur(16px);
      border: 1px solid rgba(154, 133, 114, 0.15) !important;
      box-shadow: 0 8px 32px rgba(47, 37, 28, 0.05) !important;
    }
  `,
};

// Cyber Drive Theme (Dark Animated)
export const cyberDriveTheme: Theme = {
  id: 'cyber-drive',
  name: 'Cyber Drive',
  variant: 'dark',
  description: 'Retro-futuristic synthwave ride under neon traffic lights.',
  colors: {
    background: '#05050a',
    onBackground: '#f0f5ff',
    surface: 'rgba(13, 13, 25, 0.7)',
    onSurface: '#f0f5ff',
    surfaceVariant: 'rgba(25, 25, 45, 0.6)',
    primary: '#ff0055',
    onPrimary: '#ffffff',
    primaryContainer: 'rgba(255, 0, 85, 0.2)',
    onPrimaryContainer: '#ffd6e0',
    secondary: 'rgba(0, 255, 204, 0.3)',
    onSecondary: '#f0f5ff',
    outline: 'rgba(153, 0, 255, 0.25)',
    outlineVariant: 'rgba(153, 0, 255, 0.15)',
    error: '#ff3b30',
    onError: '#ffffff',
    errorContainer: 'rgba(255, 59, 48, 0.2)',
    onErrorContainer: '#ffb3b0',
    success: '#00ffcc',
    warning: '#ffcc00',
    toolbar: 'rgba(5, 5, 10, 0.8)',
    sidebar: 'rgba(8, 8, 16, 0.6)',
    card: 'rgba(15, 15, 30, 0.5)',
    input: 'rgba(15, 15, 30, 0.4)',
    border: 'rgba(0, 255, 204, 0.15)',
    text: '#f0f5ff',
    textSecondary: '#94a3b8',
    link: '#ff0055',
  },
  typography: {
    fontFamily: '"Outfit", "Inter", sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  radius: {
    none: '0',
    sm: '0.125rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.5rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 2px 8px rgba(255, 0, 85, 0.08)',
    md: '0 4px 16px rgba(255, 0, 85, 0.15)',
    lg: '0 8px 32px rgba(153, 0, 255, 0.2)',
    xl: '0 16px 48px rgba(153, 0, 255, 0.3)',
  },
  effects: {
    backgroundAnimation: 'cyberhighway',
  },
  customCSS: `
    :root[data-theme-id="cyber-drive"] .app-shell {
      background: rgba(5, 5, 10, 0.6) !important;
      background-color: rgba(5, 5, 10, 0.6) !important;
    }
    :root[data-theme-id="cyber-drive"] .bg-background:not(.app-shell),
    :root[data-theme-id="cyber-drive"] .main-content,
    :root[data-theme-id="cyber-drive"] .bg-cream {
      background: transparent !important;
      background-color: transparent !important;
    }
    :root[data-theme-id="cyber-drive"] .sidebar-section {
      background: rgba(8, 8, 16, 0.5) !important;
      backdrop-filter: blur(12px);
      border-right: 1px solid rgba(153, 0, 255, 0.2);
    }
    :root[data-theme-id="cyber-drive"] .sidebar-item-active {
      background: rgba(255, 0, 85, 0.15) !important;
      border-left: 3px solid #ff0055 !important;
      color: #ffd6e0 !important;
    }
    :root[data-theme-id="cyber-drive"] .glass-panel,
    :root[data-theme-id="cyber-drive"] .glass-panel-light,
    :root[data-theme-id="cyber-drive"] .glass-card-enhanced {
      background: rgba(13, 13, 25, 0.55) !important;
      backdrop-filter: blur(16px);
      border: 1px solid rgba(0, 255, 204, 0.2) !important;
      box-shadow: 0 8px 32px rgba(255, 0, 85, 0.12) !important;
    }
  `,
};

// Stardust Void Theme (Dark Animated)
export const stardustVoidTheme: Theme = {
  id: 'stardust-void',
  name: 'Stardust Void',
  variant: 'dark',
  description: 'Deep cosmic void with swirling stardust and violet waves.',
  colors: {
    background: '#0b0914',
    onBackground: '#eef2ff',
    surface: 'rgba(21, 18, 38, 0.7)',
    onSurface: '#eef2ff',
    surfaceVariant: 'rgba(32, 28, 56, 0.6)',
    primary: '#a855f7',
    onPrimary: '#ffffff',
    primaryContainer: 'rgba(168, 85, 247, 0.2)',
    onPrimaryContainer: '#f3e8ff',
    secondary: 'rgba(245, 158, 11, 0.3)',
    onSecondary: '#eef2ff',
    outline: 'rgba(139, 92, 246, 0.2)',
    outlineVariant: 'rgba(139, 92, 246, 0.1)',
    error: '#ef4444',
    onError: '#ffffff',
    errorContainer: 'rgba(239, 68, 68, 0.2)',
    onErrorContainer: '#fee2e2',
    success: '#10b981',
    warning: '#f59e0b',
    toolbar: 'rgba(11, 9, 20, 0.8)',
    sidebar: 'rgba(14, 11, 26, 0.6)',
    card: 'rgba(21, 18, 38, 0.5)',
    input: 'rgba(21, 18, 38, 0.4)',
    border: 'rgba(168, 85, 247, 0.15)',
    text: '#eef2ff',
    textSecondary: '#a5b4fc',
    link: '#c084fc',
  },
  typography: {
    fontFamily: '"Outfit", "Inter", sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  radius: {
    none: '0',
    sm: '0.125rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.5rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 2px 8px rgba(168, 85, 247, 0.08)',
    md: '0 4px 16px rgba(168, 85, 247, 0.15)',
    lg: '0 8px 32px rgba(139, 92, 246, 0.2)',
    xl: '0 16px 48px rgba(139, 92, 246, 0.25)',
  },
  effects: {
    backgroundAnimation: 'cosmicdust',
  },
  customCSS: `
    :root[data-theme-id="stardust-void"] .app-shell {
      background: rgba(11, 9, 20, 0.6) !important;
      background-color: rgba(11, 9, 20, 0.6) !important;
    }
    :root[data-theme-id="stardust-void"] .bg-background:not(.app-shell),
    :root[data-theme-id="stardust-void"] .main-content,
    :root[data-theme-id="stardust-void"] .bg-cream {
      background: transparent !important;
      background-color: transparent !important;
    }
    :root[data-theme-id="stardust-void"] .sidebar-section {
      background: rgba(14, 11, 26, 0.5) !important;
      backdrop-filter: blur(12px);
      border-right: 1px solid rgba(139, 92, 246, 0.2);
    }
    :root[data-theme-id="stardust-void"] .sidebar-item-active {
      background: rgba(168, 85, 247, 0.15) !important;
      border-left: 3px solid #a855f7 !important;
      color: #f3e8ff !important;
    }
    :root[data-theme-id="stardust-void"] .glass-panel,
    :root[data-theme-id="stardust-void"] .glass-panel-light,
    :root[data-theme-id="stardust-void"] .glass-card-enhanced {
      background: rgba(21, 18, 38, 0.55) !important;
      backdrop-filter: blur(16px);
      border: 1px solid rgba(168, 85, 247, 0.18) !important;
      box-shadow: 0 8px 32px rgba(139, 92, 246, 0.1) !important;
    }
  `,
};

// Biolume Abyss Theme (Dark Animated)
export const biolumeAbyssTheme: Theme = {
  id: 'biolume-abyss',
  name: 'Biolume Abyss',
  variant: 'dark',
  description: 'Deep oceanic abyss with floating bioluminescent spores.',
  colors: {
    background: '#020b14',
    onBackground: '#e0f2fe',
    surface: 'rgba(10, 25, 41, 0.7)',
    onSurface: '#e0f2fe',
    surfaceVariant: 'rgba(15, 38, 64, 0.6)',
    primary: '#06b6d4',
    onPrimary: '#022c22',
    primaryContainer: 'rgba(6, 182, 212, 0.2)',
    onPrimaryContainer: '#cffafe',
    secondary: 'rgba(16, 185, 129, 0.3)',
    onSecondary: '#e0f2fe',
    outline: 'rgba(14, 116, 144, 0.25)',
    outlineVariant: 'rgba(14, 116, 144, 0.15)',
    error: '#ef4444',
    onError: '#ffffff',
    errorContainer: 'rgba(239, 68, 68, 0.2)',
    onErrorContainer: '#fee2e2',
    success: '#10b981',
    warning: '#f59e0b',
    toolbar: 'rgba(2, 11, 20, 0.8)',
    sidebar: 'rgba(3, 16, 30, 0.6)',
    card: 'rgba(10, 25, 41, 0.5)',
    input: 'rgba(10, 25, 41, 0.4)',
    border: 'rgba(6, 182, 212, 0.15)',
    text: '#e0f2fe',
    textSecondary: '#7dd3fc',
    link: '#22d3ee',
  },
  typography: {
    fontFamily: '"Outfit", "Inter", sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  radius: {
    none: '0',
    sm: '0.125rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.5rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 2px 8px rgba(6, 182, 212, 0.08)',
    md: '0 4px 16px rgba(6, 182, 212, 0.15)',
    lg: '0 8px 32px rgba(14, 116, 144, 0.2)',
    xl: '0 16px 48px rgba(14, 116, 144, 0.25)',
  },
  effects: {
    backgroundAnimation: 'bioglow',
  },
  customCSS: `
    :root[data-theme-id="biolume-abyss"] .app-shell {
      background: rgba(2, 11, 20, 0.6) !important;
      background-color: rgba(2, 11, 20, 0.6) !important;
    }
    :root[data-theme-id="biolume-abyss"] .bg-background:not(.app-shell),
    :root[data-theme-id="biolume-abyss"] .main-content,
    :root[data-theme-id="biolume-abyss"] .bg-cream {
      background: transparent !important;
      background-color: transparent !important;
    }
    :root[data-theme-id="biolume-abyss"] .sidebar-section {
      background: rgba(3, 16, 30, 0.5) !important;
      backdrop-filter: blur(12px);
      border-right: 1px solid rgba(14, 116, 144, 0.25);
    }
    :root[data-theme-id="biolume-abyss"] .sidebar-item-active {
      background: rgba(6, 182, 212, 0.15) !important;
      border-left: 3px solid #06b6d4 !important;
      color: #cffafe !important;
    }
    :root[data-theme-id="biolume-abyss"] .glass-panel,
    :root[data-theme-id="biolume-abyss"] .glass-panel-light,
    :root[data-theme-id="biolume-abyss"] .glass-card-enhanced {
      background: rgba(10, 25, 41, 0.55) !important;
      backdrop-filter: blur(16px);
      border: 1px solid rgba(6, 182, 212, 0.18) !important;
      box-shadow: 0 8px 32px rgba(14, 116, 144, 0.1) !important;
    }
  `,
};

// Eucalyptus Mist Theme (Light Non-Animated)
export const eucalyptusMistTheme: Theme = {
  id: 'eucalyptus-mist',
  name: 'Eucalyptus Mist',
  variant: 'light',
  description: 'A peaceful, calming eucalyptus green and warm grey theme.',
  colors: {
    background: '#f5f6f3',
    onBackground: '#2c352a',
    surface: '#ffffff',
    onSurface: '#2c352a',
    surfaceVariant: '#e9ebe4',
    primary: '#6c8567',
    onPrimary: '#ffffff',
    primaryContainer: '#e1e6de',
    onPrimaryContainer: '#202c1d',
    secondary: '#8ba086',
    onSecondary: '#ffffff',
    outline: '#c6ccc1',
    outlineVariant: '#d7dbd3',
    error: '#cf6663',
    onError: '#ffffff',
    errorContainer: '#f9e8e8',
    onErrorContainer: '#cf6663',
    success: '#709176',
    warning: '#d19941',
    toolbar: '#f5f6f3',
    sidebar: '#edf0eb',
    card: '#ffffff',
    input: '#ffffff',
    border: '#c6ccc1',
    text: '#2c352a',
    textSecondary: '#5c665a',
    link: '#587053',
  },
  typography: {
    fontFamily: '"Outfit", "Inter", sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  radius: {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.25rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.08)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  },
};

// Macchiato Cream Theme (Light Non-Animated)
export const macchiatoCreamTheme: Theme = {
  id: 'macchiato-cream',
  name: 'Macchiato Cream',
  variant: 'light',
  description: 'Warm latte tones with rich roasted espresso accents.',
  colors: {
    background: '#fcfaf7',
    onBackground: '#3e2723',
    surface: '#ffffff',
    onSurface: '#3e2723',
    surfaceVariant: '#f3ede2',
    primary: '#8d6e63',
    onPrimary: '#ffffff',
    primaryContainer: '#f5ebe6',
    onPrimaryContainer: '#4e342e',
    secondary: '#bcaaa4',
    onSecondary: '#3e2723',
    outline: '#d7ccc8',
    outlineVariant: '#efebe9',
    error: '#cc5a5a',
    onError: '#ffffff',
    errorContainer: '#fdf3f3',
    onErrorContainer: '#cc5a5a',
    success: '#6c8e68',
    warning: '#cc9642',
    toolbar: '#fcfaf7',
    sidebar: '#f7f1e7',
    card: '#ffffff',
    input: '#ffffff',
    border: '#d7ccc8',
    text: '#3e2723',
    textSecondary: '#6d4c41',
    link: '#795548',
  },
  typography: {
    fontFamily: '"Outfit", "Inter", sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  radius: {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.25rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(62, 39, 35, 0.04)',
    md: '0 4px 6px -1px rgba(62, 39, 35, 0.05)',
    lg: '0 10px 15px -3px rgba(62, 39, 35, 0.07)',
    xl: '0 20px 25px -5px rgba(62, 39, 35, 0.1)',
  },
};

// Nordic Frost Theme (Light Non-Animated)
export const nordicFrostTheme: Theme = {
  id: 'nordic-frost',
  name: 'Nordic Frost',
  variant: 'light',
  description: 'Crisp arctic glacier layout with ice-blue accents.',
  colors: {
    background: '#f0f4f8',
    onBackground: '#1b2a3a',
    surface: '#ffffff',
    onSurface: '#1b2a3a',
    surfaceVariant: '#e1e9f0',
    primary: '#4a90e2',
    onPrimary: '#ffffff',
    primaryContainer: '#dbeafe',
    onPrimaryContainer: '#1e40af',
    secondary: '#85b0d9',
    onSecondary: '#1b2a3a',
    outline: '#cbdbe6',
    outlineVariant: '#e5eef5',
    error: '#cf5252',
    onError: '#ffffff',
    errorContainer: '#fdf3f3',
    onErrorContainer: '#cf5252',
    success: '#4ca679',
    warning: '#d4a343',
    toolbar: '#f0f4f8',
    sidebar: '#e5ebf1',
    card: '#ffffff',
    input: '#ffffff',
    border: '#cbdbe6',
    text: '#1b2a3a',
    textSecondary: '#4b6075',
    link: '#3b7dbd',
  },
  typography: {
    fontFamily: '"Outfit", "Inter", sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  radius: {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.25rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(27, 42, 58, 0.04)',
    md: '0 4px 6px -1px rgba(27, 42, 58, 0.05)',
    lg: '0 10px 15px -3px rgba(27, 42, 58, 0.07)',
    xl: '0 20px 25px -5px rgba(27, 42, 58, 0.1)',
  },
};

// Tokyo Neon Theme (Dark Non-Animated)
export const tokyoNeonTheme: Theme = {
  id: 'tokyo-neon',
  name: 'Tokyo Neon',
  variant: 'dark',
  description: 'Late-night Tokyo slate with rain-reflected magenta and cyan neon.',
  colors: {
    background: '#12121e',
    onBackground: '#e2e2ec',
    surface: '#1a1a2e',
    onSurface: '#e2e2ec',
    surfaceVariant: '#24243e',
    primary: '#ff007f',
    onPrimary: '#ffffff',
    primaryContainer: '#4d003b',
    onPrimaryContainer: '#ffb3d9',
    secondary: '#00f0ff',
    onSecondary: '#12121e',
    outline: '#3d3d5c',
    outlineVariant: '#2b2b40',
    error: '#ff4d4d',
    onError: '#ffffff',
    errorContainer: '#4c0000',
    onErrorContainer: '#ffb3b3',
    success: '#00ff88',
    warning: '#ffdd00',
    toolbar: '#0d0d17',
    sidebar: '#0f0f1c',
    card: '#1a1a2e',
    input: '#1a1a2e',
    border: '#3d3d5c',
    text: '#e2e2ec',
    textSecondary: '#9494b8',
    link: '#ff007f',
  },
  typography: {
    fontFamily: '"Outfit", "Inter", sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  radius: {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.25rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 2px 8px rgba(0, 0, 0, 0.2)',
    md: '0 4px 16px rgba(0, 0, 0, 0.3)',
    lg: '0 8px 32px rgba(255, 0, 127, 0.15)',
    xl: '0 16px 48px rgba(0, 240, 255, 0.15)',
  },
};

// Espresso Roast Theme (Dark Non-Animated)
export const espressoRoastTheme: Theme = {
  id: 'espresso-roast',
  name: 'Espresso Roast',
  variant: 'dark',
  description: 'Rich dark espresso roast layout with warm caramel crema.',
  colors: {
    background: '#1c1613',
    onBackground: '#f3eae5',
    surface: '#241d1a',
    onSurface: '#f3eae5',
    surfaceVariant: '#2e2521',
    primary: '#d7ccc8',
    onPrimary: '#3e2723',
    primaryContainer: '#5d4037',
    onPrimaryContainer: '#f5ebe6',
    secondary: '#a1887f',
    onSecondary: '#1c1613',
    outline: '#4e342e',
    outlineVariant: '#3e2723',
    error: '#e57373',
    onError: '#ffffff',
    errorContainer: '#4c1c1a',
    onErrorContainer: '#ffcdd2',
    success: '#81c784',
    warning: '#ffb74d',
    toolbar: '#16110f',
    sidebar: '#171210',
    card: '#241d1a',
    input: '#241d1a',
    border: '#4e342e',
    text: '#f3eae5',
    textSecondary: '#bcaaa4',
    link: '#d7ccc8',
  },
  typography: {
    fontFamily: '"Outfit", "Inter", sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  radius: {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.25rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 2px 8px rgba(0, 0, 0, 0.2)',
    md: '0 4px 16px rgba(0, 0, 0, 0.3)',
    lg: '0 8px 32px rgba(62, 39, 35, 0.15)',
    xl: '0 16px 48px rgba(62, 39, 35, 0.2)',
  },
};

// Nordic Slate Theme (Dark Non-Animated)
export const nordicSlateTheme: Theme = {
  id: 'nordic-slate',
  name: 'Nordic Slate',
  variant: 'dark',
  description: 'Cool, minimalist dark nordic slate-grey theme.',
  colors: {
    background: '#1b222b',
    onBackground: '#eceff4',
    surface: '#242c37',
    onSurface: '#eceff4',
    surfaceVariant: '#2e3846',
    primary: '#88c0d0',
    onPrimary: '#2e3440',
    primaryContainer: '#434c5e',
    onPrimaryContainer: '#eceff4',
    secondary: '#81a1c1',
    onSecondary: '#2e3440',
    outline: '#4c566a',
    outlineVariant: '#3b4252',
    error: '#bf616a',
    onError: '#ffffff',
    errorContainer: '#4c1f24',
    onErrorContainer: '#ffccd0',
    success: '#a3be8c',
    warning: '#ebcb8b',
    toolbar: '#161b22',
    sidebar: '#181e26',
    card: '#242c37',
    input: '#242c37',
    border: '#4c566a',
    text: '#eceff4',
    textSecondary: '#d8dee9',
    link: '#88c0d0',
  },
  typography: {
    fontFamily: '"Outfit", "Inter", sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  radius: {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.25rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 2px 8px rgba(0, 0, 0, 0.2)',
    md: '0 4px 16px rgba(0, 0, 0, 0.25)',
    lg: '0 8px 32px rgba(46, 52, 64, 0.3)',
    xl: '0 16px 48px rgba(46, 52, 64, 0.4)',
  },
};

// Cozy Windowpane Theme (Dark Animated)
export const cozyWindowpaneTheme: Theme = {
  id: 'cozy-windowpane',
  name: 'Cozy Windowpane',
  variant: 'dark',
  description: 'Late-night rainy windowpane with warm candlelight accents.',
  colors: {
    background: '#070b12',
    onBackground: '#f1f5f9',
    surface: 'rgba(15, 23, 42, 0.65)',
    onSurface: '#f1f5f9',
    surfaceVariant: 'rgba(30, 41, 59, 0.6)',
    primary: '#f59e0b',
    onPrimary: '#020617',
    primaryContainer: 'rgba(245, 158, 11, 0.18)',
    onPrimaryContainer: '#fef3c7',
    secondary: 'rgba(51, 65, 85, 0.5)',
    onSecondary: '#f1f5f9',
    outline: 'rgba(148, 163, 184, 0.15)',
    outlineVariant: 'rgba(148, 163, 184, 0.08)',
    error: '#ef4444',
    onError: '#ffffff',
    errorContainer: 'rgba(239, 68, 68, 0.2)',
    onErrorContainer: '#fee2e2',
    success: '#10b981',
    warning: '#f59e0b',
    toolbar: 'rgba(7, 11, 18, 0.8)',
    sidebar: 'rgba(10, 15, 30, 0.6)',
    card: 'rgba(15, 23, 42, 0.55)',
    input: 'rgba(15, 23, 42, 0.45)',
    border: 'rgba(245, 158, 11, 0.15)',
    text: '#f1f5f9',
    textSecondary: '#94a3b8',
    link: '#f59e0b',
  },
  typography: {
    fontFamily: '"Outfit", "Inter", sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  radius: {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.25rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 2px 8px rgba(0, 0, 0, 0.3)',
    md: '0 4px 16px rgba(0, 0, 0, 0.4)',
    lg: '0 8px 32px rgba(0, 0, 0, 0.5)',
    xl: '0 16px 48px rgba(0, 0, 0, 0.6)',
  },
  effects: {
    backgroundAnimation: 'rainywindow',
  },
  customCSS: `
    :root[data-theme-id="cozy-windowpane"] .app-shell {
      background: rgba(7, 11, 18, 0.65) !important;
      background-color: rgba(7, 11, 18, 0.65) !important;
    }
    :root[data-theme-id="cozy-windowpane"] .bg-background:not(.app-shell),
    :root[data-theme-id="cozy-windowpane"] .main-content,
    :root[data-theme-id="cozy-windowpane"] .bg-cream {
      background: transparent !important;
      background-color: transparent !important;
    }
    :root[data-theme-id="cozy-windowpane"] .sidebar-section {
      background: rgba(15, 23, 42, 0.6) !important;
      backdrop-filter: blur(16px);
      border-right: 1px solid rgba(245, 158, 11, 0.15);
    }
    :root[data-theme-id="cozy-windowpane"] .sidebar-item-active {
      background: rgba(245, 158, 11, 0.12) !important;
      border-left: 3px solid #f59e0b !important;
      color: #fbbf24 !important;
    }
    :root[data-theme-id="cozy-windowpane"] .glass-panel,
    :root[data-theme-id="cozy-windowpane"] .glass-panel-light,
    :root[data-theme-id="cozy-windowpane"] .glass-card-enhanced {
      background: rgba(15, 23, 42, 0.6) !important;
      backdrop-filter: blur(20px);
      border: 1px solid rgba(245, 158, 11, 0.12) !important;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.05) !important;
    }
  `,
};

// Liquid Glass Theme - High fidelity platform-aware translucency & animated fallback
export const liquidGlassTheme: Theme = {
  id: 'liquid-glass',
  name: 'Liquid Glass',
  variant: 'dark',
  description: 'Premium liquid glass design with native OS vibrancy or animated colorful fallback',
  colors: {
    background: 'transparent',
    onBackground: '#f8fafc',
    surface: 'rgba(15, 23, 42, 0.45)',
    onSurface: '#f8fafc',
    surfaceVariant: 'rgba(30, 41, 59, 0.4)',
    primary: '#38bdf8',
    onPrimary: '#0c4a6e',
    primaryContainer: 'rgba(56, 189, 248, 0.15)',
    onPrimaryContainer: '#e0f2fe',
    secondary: 'rgba(148, 163, 184, 0.3)',
    onSecondary: '#f8fafc',
    outline: 'rgba(255, 255, 255, 0.08)',
    outlineVariant: 'rgba(255, 255, 255, 0.04)',
    error: '#f87171',
    onError: '#ffffff',
    errorContainer: 'rgba(248, 113, 113, 0.15)',
    onErrorContainer: '#fecaca',
    success: '#34d399',
    warning: '#fbbf24',
    toolbar: 'rgba(15, 23, 42, 0.55)',
    sidebar: 'rgba(10, 15, 30, 0.5)',
    card: 'rgba(30, 41, 59, 0.4)',
    input: 'rgba(15, 23, 42, 0.3)',
    border: 'rgba(255, 255, 255, 0.08)',
    text: '#f8fafc',
    textSecondary: '#94a3b8',
    link: '#38bdf8',
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  radius: {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.25rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 2px 8px rgba(0, 0, 0, 0.15)',
    md: '0 4px 16px rgba(0, 0, 0, 0.25)',
    lg: '0 8px 32px rgba(0, 0, 0, 0.35)',
    xl: '0 16px 48px rgba(0, 0, 0, 0.45)',
  },
  effects: {
    backgroundAnimation: 'liquid-glow',
  },
  customCSS: `
    /* Liquid Glass Fallback Animated Ambient Backdrop */
    :root[data-theme-id="liquid-glass"] {
      background: radial-gradient(circle at 50% 50%, #0d1117 0%, #07090e 100%) !important;
      position: relative;
      isolation: isolate;
    }

    /* Ambient moving fluid blobs */
    :root[data-theme-id="liquid-glass"]::before,
    :root[data-theme-id="liquid-glass"]::after {
      content: "";
      position: fixed;
      width: 60vw;
      height: 60vw;
      border-radius: 50%;
      filter: blur(100px);
      z-index: -100;
      opacity: 0.22;
      pointer-events: none;
      mix-blend-mode: screen;
      animation: liquid-blob-flow 30s infinite alternate ease-in-out;
    }

    :root[data-theme-id="liquid-glass"]::before {
      background: radial-gradient(circle, rgba(56, 189, 248, 0.6) 0%, transparent 70%);
      top: -20%;
      left: -20%;
      animation-delay: 0s;
    }

    :root[data-theme-id="liquid-glass"]::after {
      background: radial-gradient(circle, rgba(139, 92, 246, 0.5) 0%, transparent 70%);
      bottom: -20%;
      right: -20%;
      animation-delay: -7s;
      animation-duration: 35s;
    }

    @keyframes liquid-blob-flow {
      0% {
        transform: translate(0, 0) scale(1) rotate(0deg);
      }
      33% {
        transform: translate(15vw, 10vh) scale(1.15) rotate(120deg);
      }
      66% {
        transform: translate(-10vw, 25vh) scale(0.9) rotate(240deg);
      }
      100% {
        transform: translate(5vw, -5vh) scale(1.05) rotate(360deg);
      }
    }

    /* Hide CSS ambient gradient blobs when native OS window vibrancy is successfully active */
    :root[data-theme-id="liquid-glass"][data-vibrancy-active="true"] {
      background: transparent !important;
    }
    :root[data-theme-id="liquid-glass"][data-vibrancy-active="true"]::before,
    :root[data-theme-id="liquid-glass"][data-vibrancy-active="true"]::after {
      display: none !important;
    }

    /* Custom layout component transparency and glass blurs */
    :root[data-theme-id="liquid-glass"] .sidebar-section,
    :root[data-theme-id="liquid-glass"] aside {
      background: rgba(10, 15, 30, 0.4) !important;
      backdrop-filter: blur(16px) saturate(130%) !important;
      -webkit-backdrop-filter: blur(16px) saturate(130%) !important;
      border-right: 1px solid rgba(255, 255, 255, 0.07) !important;
    }

    :root[data-theme-id="liquid-glass"] .sidebar-item-active {
      background: rgba(56, 189, 248, 0.12) !important;
      border-left: 3px solid #38bdf8 !important;
      color: #38bdf8 !important;
    }

    :root[data-theme-id="liquid-glass"] .sidebar-item:hover:not(.sidebar-item-active) {
      background: rgba(255, 255, 255, 0.04) !important;
    }

    /* Cards and list items */
    :root[data-theme-id="liquid-glass"] .glass-card-enhanced,
    :root[data-theme-id="liquid-glass"] .card,
    :root[data-theme-id="liquid-glass"] [data-card="true"] {
      background: rgba(30, 41, 59, 0.35) !important;
      backdrop-filter: blur(14px) !important;
      -webkit-backdrop-filter: blur(14px) !important;
      border: 1px solid rgba(255, 255, 255, 0.06) !important;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2) !important;
      border-radius: var(--radius-lg);
    }

    /* Top navigation / toolbar overlays */
    :root[data-theme-id="liquid-glass"] .toolbar,
    :root[data-theme-id="liquid-glass"] .top-bar,
    :root[data-theme-id="liquid-glass"] header {
      background: rgba(15, 23, 42, 0.45) !important;
      backdrop-filter: blur(12px) !important;
      -webkit-backdrop-filter: blur(12px) !important;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06) !important;
    }

    /* Input borders and focus state glow */
    :root[data-theme-id="liquid-glass"] input,
    :root[data-theme-id="liquid-glass"] textarea,
    :root[data-theme-id="liquid-glass"] select {
      background: rgba(15, 23, 42, 0.35) !important;
      border: 1px solid rgba(255, 255, 255, 0.08) !important;
      backdrop-filter: blur(8px) !important;
    }
    
    :root[data-theme-id="liquid-glass"] input:focus,
    :root[data-theme-id="liquid-glass"] textarea:focus {
      border-color: rgba(56, 189, 248, 0.5) !important;
      box-shadow: 0 0 10px rgba(56, 189, 248, 0.25) !important;
    }

    /* Style dynamic iframes in readers to be transparent so the glass background shows through */
    :root[data-theme-id="liquid-glass"] iframe,
    :root[data-theme-id="liquid-glass"] [data-epub-viewer="true"] iframe {
      background: transparent !important;
      background-color: transparent !important;
    }

    /* Force all epubjs host-side container elements transparent */
    :root[data-theme-id="liquid-glass"] [data-epub-viewer="true"] div,
    :root[data-theme-id="liquid-glass"] [data-epub-viewer="true"] * {
      background: transparent !important;
      background-color: transparent !important;
    }

    /* Style the EPUB and HTML reader sheets as floating frosted glass pages */
    :root[data-theme-id="liquid-glass"] [data-epub-viewer="true"],
    :root[data-theme-id="liquid-glass"] [data-html-viewer="true"] {
      position: absolute !important;
      background: rgba(15, 23, 42, 0.6) !important;
      backdrop-filter: blur(20px) saturate(120%) !important;
      -webkit-backdrop-filter: blur(20px) saturate(120%) !important;
      border-radius: var(--radius-xl) !important;
      border: 1px solid rgba(255, 255, 255, 0.08) !important;
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4) !important;
      inset: 1.5rem !important;
      width: calc(100% - 3rem) !important;
      height: calc(100% - 3rem) !important;
    }

    /* Style the Table of Contents sidebar in EPUB Viewer as frosted glass */
    :root[data-theme-id="liquid-glass"] .w-64.bg-card {
      background: rgba(10, 15, 30, 0.45) !important;
      backdrop-filter: blur(16px) !important;
      -webkit-backdrop-filter: blur(16px) !important;
      border-right: 1px solid rgba(255, 255, 255, 0.08) !important;
    }

    /* In mobile viewport, let reader sheets fill the screen to maximize reading space but keep transparency */
    @media (max-width: 768px) {
      :root[data-theme-id="liquid-glass"] [data-epub-viewer="true"],
      :root[data-theme-id="liquid-glass"] [data-html-viewer="true"] {
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
        border: 0 !important;
        border-radius: 0 !important;
      }
    }
  `,
};

// ═══════════════════════════════════════════════════════════════
// Obsidian Noir — Polished obsidian stone catching firelight
// ═══════════════════════════════════════════════════════════════
export const obsidianNoirTheme: Theme = {
  id: 'obsidian-noir',
  name: 'Obsidian Noir',
  variant: 'dark',
  description: 'Polished black obsidian with amber firelight — deep, luxurious, volcanic.',
  colors: {
    background: '#08090c',
    onBackground: '#ede4d3',
    surface: '#111318',
    onSurface: '#ede4d3',
    surfaceVariant: '#1a1c22',
    primary: '#e8a840',
    onPrimary: '#1a1002',
    primaryContainer: 'rgba(232, 168, 64, 0.15)',
    onPrimaryContainer: '#fce8c2',
    secondary: '#5a5550',
    onSecondary: '#ede4d3',
    outline: 'rgba(232, 168, 64, 0.18)',
    outlineVariant: 'rgba(232, 168, 64, 0.08)',
    error: '#f87171',
    onError: '#1a0202',
    errorContainer: 'rgba(248, 113, 113, 0.18)',
    onErrorContainer: '#fecaca',
    success: '#4ade80',
    warning: '#fbbf24',
    toolbar: '#0c0d12',
    sidebar: '#0a0b0f',
    card: '#111318',
    input: '#15171d',
    border: 'rgba(232, 168, 64, 0.15)',
    text: '#ede4d3',
    textSecondary: '#9d9484',
    link: '#e8a840',
  },
  typography: {
    fontFamily: '"Crimson Text", "Lora", Georgia, serif',
    fontSize: { xs: '0.75rem', sm: '0.875rem', md: '1rem', lg: '1.125rem', xl: '1.25rem', '2xl': '1.5rem', '3xl': '1.875rem' },
    fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
    lineHeight: { tight: 1.25, normal: 1.6, relaxed: 1.8 },
  },
  spacing: { xs: '0.25rem', sm: '0.5rem', md: '1rem', lg: '1.5rem', xl: '2rem', '2xl': '3rem', '3xl': '4rem' },
  radius: { none: '0', sm: '0.125rem', md: '0.375rem', lg: '0.5rem', xl: '0.75rem', '2xl': '1rem', full: '9999px' },
  shadows: {
    sm: '0 2px 4px rgba(0,0,0,0.5)',
    md: '0 4px 12px rgba(0,0,0,0.6)',
    lg: '0 8px 24px rgba(0,0,0,0.7)',
    xl: '0 16px 40px rgba(0,0,0,0.8)',
  },
  customCSS: `
    :root[data-theme-id="obsidian-noir"] .sidebar-item-active {
      background: rgba(232, 168, 64, 0.1) !important;
      border-left: 3px solid #e8a840 !important;
      box-shadow: inset 0 0 20px rgba(232, 168, 64, 0.06);
    }
    :root[data-theme-id="obsidian-noir"] .sidebar-item:hover:not(.sidebar-item-active) {
      background: rgba(232, 168, 64, 0.04) !important;
    }
    :root[data-theme-id="obsidian-noir"] input:focus,
    :root[data-theme-id="obsidian-noir"] textarea:focus {
      border-color: rgba(232, 168, 64, 0.5) !important;
      box-shadow: 0 0 12px rgba(232, 168, 64, 0.15) !important;
    }
    :root[data-theme-id="obsidian-noir"] .card:hover {
      border-color: rgba(232, 168, 64, 0.2) !important;
      box-shadow: 0 4px 20px rgba(232, 168, 64, 0.08) !important;
    }
  `,
};

// ═══════════════════════════════════════════════════════════════
// Velvet Twilight — Deep plum velvet with rose gold at dusk
// ═══════════════════════════════════════════════════════════════
export const velvetTwilightTheme: Theme = {
  id: 'velvet-twilight',
  name: 'Velvet Twilight',
  variant: 'dark',
  description: 'Deep aubergine velvet drapes kissed by rose gold — opulent, moody, refined.',
  colors: {
    background: '#100b14',
    onBackground: '#f0e6f6',
    surface: '#1a1222',
    onSurface: '#f0e6f6',
    surfaceVariant: '#241a30',
    primary: '#d4a0b5',
    onPrimary: '#2d0a1a',
    primaryContainer: 'rgba(212, 160, 181, 0.15)',
    onPrimaryContainer: '#fce4ec',
    secondary: '#7d6b87',
    onSecondary: '#f0e6f6',
    outline: 'rgba(212, 160, 181, 0.18)',
    outlineVariant: 'rgba(212, 160, 181, 0.07)',
    error: '#f48b8b',
    onError: '#2d0a0a',
    errorContainer: 'rgba(244, 139, 139, 0.18)',
    onErrorContainer: '#fce4e4',
    success: '#86d9b5',
    warning: '#f0c78e',
    toolbar: '#140e1a',
    sidebar: '#0e0a12',
    card: '#1a1222',
    input: '#1e1628',
    border: 'rgba(212, 160, 181, 0.14)',
    text: '#f0e6f6',
    textSecondary: '#b09eb8',
    link: '#d4a0b5',
  },
  typography: {
    fontFamily: '"Cormorant Garamond", "EB Garamond", Georgia, serif',
    fontSize: { xs: '0.75rem', sm: '0.875rem', md: '1rem', lg: '1.125rem', xl: '1.25rem', '2xl': '1.5rem', '3xl': '1.875rem' },
    fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
    lineHeight: { tight: 1.25, normal: 1.6, relaxed: 1.8 },
  },
  spacing: { xs: '0.25rem', sm: '0.5rem', md: '1rem', lg: '1.5rem', xl: '2rem', '2xl': '3rem', '3xl': '4rem' },
  radius: { none: '0', sm: '0.25rem', md: '0.5rem', lg: '0.75rem', xl: '1rem', '2xl': '1.5rem', full: '9999px' },
  shadows: {
    sm: '0 2px 6px rgba(0,0,0,0.4)',
    md: '0 4px 14px rgba(0,0,0,0.5)',
    lg: '0 8px 28px rgba(0,0,0,0.6)',
    xl: '0 16px 44px rgba(0,0,0,0.7)',
  },
  customCSS: `
    :root[data-theme-id="velvet-twilight"] .sidebar-item-active {
      background: rgba(212, 160, 181, 0.1) !important;
      border-left: 3px solid #d4a0b5 !important;
    }
    :root[data-theme-id="velvet-twilight"] .sidebar-item:hover:not(.sidebar-item-active) {
      background: rgba(212, 160, 181, 0.04) !important;
    }
    :root[data-theme-id="velvet-twilight"] input:focus,
    :root[data-theme-id="velvet-twilight"] textarea:focus {
      border-color: rgba(212, 160, 181, 0.45) !important;
      box-shadow: 0 0 14px rgba(212, 160, 181, 0.12) !important;
    }
    :root[data-theme-id="velvet-twilight"] .card {
      border: 1px solid rgba(212, 160, 181, 0.08) !important;
    }
    :root[data-theme-id="velvet-twilight"] .card:hover {
      border-color: rgba(212, 160, 181, 0.18) !important;
    }
    :root[data-theme-id="velvet-twilight"] ::selection {
      background: rgba(212, 160, 181, 0.35);
      color: #f0e6f6;
    }
  `,
};

// ═══════════════════════════════════════════════════════════════
// Neon Pulse — Synthwave streets, cyan & magenta electricity
// ═══════════════════════════════════════════════════════════════
export const neonPulseTheme: Theme = {
  id: 'neon-pulse',
  name: 'Neon Pulse',
  variant: 'dark',
  description: 'Electric cyan and hot magenta cutting through midnight — cyberpunk, high-voltage, alive.',
  colors: {
    background: '#0a0a14',
    onBackground: '#e8e8ff',
    surface: '#10101f',
    onSurface: '#e8e8ff',
    surfaceVariant: '#181830',
    primary: '#00e5ff',
    onPrimary: '#001a1a',
    primaryContainer: 'rgba(0, 229, 255, 0.12)',
    onPrimaryContainer: '#b3f5ff',
    secondary: '#ff2d95',
    onSecondary: '#1a0010',
    outline: 'rgba(0, 229, 255, 0.2)',
    outlineVariant: 'rgba(0, 229, 255, 0.07)',
    error: '#ff4466',
    onError: '#1a0006',
    errorContainer: 'rgba(255, 68, 102, 0.18)',
    onErrorContainer: '#ffccd5',
    success: '#00ff88',
    warning: '#ffe040',
    toolbar: '#0d0d1a',
    sidebar: '#080812',
    card: '#10101f',
    input: '#141428',
    border: 'rgba(0, 229, 255, 0.18)',
    text: '#e8e8ff',
    textSecondary: '#9898c8',
    link: '#00e5ff',
  },
  typography: {
    fontFamily: '"Space Grotesk", "Inter", system-ui, sans-serif',
    fontSize: { xs: '0.75rem', sm: '0.875rem', md: '1rem', lg: '1.125rem', xl: '1.25rem', '2xl': '1.5rem', '3xl': '1.875rem' },
    fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
    lineHeight: { tight: 1.2, normal: 1.5, relaxed: 1.7 },
  },
  spacing: { xs: '0.25rem', sm: '0.5rem', md: '1rem', lg: '1.5rem', xl: '2rem', '2xl': '3rem', '3xl': '4rem' },
  radius: { none: '0', sm: '0.125rem', md: '0.25rem', lg: '0.375rem', xl: '0.5rem', '2xl': '0.75rem', full: '9999px' },
  shadows: {
    sm: '0 0 6px rgba(0, 229, 255, 0.15)',
    md: '0 0 16px rgba(0, 229, 255, 0.2)',
    lg: '0 0 30px rgba(0, 229, 255, 0.25)',
    xl: '0 0 50px rgba(0, 229, 255, 0.3)',
  },
  effects: { backgroundAnimation: 'cyberhighway' },
  customCSS: `
    :root[data-theme-id="neon-pulse"] .sidebar-item-active {
      background: rgba(0, 229, 255, 0.08) !important;
      border-left: 3px solid #00e5ff !important;
      box-shadow: inset 0 0 16px rgba(0, 229, 255, 0.1), 0 0 10px rgba(0, 229, 255, 0.08);
      color: #00e5ff !important;
    }
    :root[data-theme-id="neon-pulse"] .sidebar-item:hover:not(.sidebar-item-active) {
      background: rgba(255, 45, 149, 0.04) !important;
      border-left: 3px solid rgba(255, 45, 149, 0.3) !important;
    }
    :root[data-theme-id="neon-pulse"] input:focus,
    :root[data-theme-id="neon-pulse"] textarea:focus {
      border-color: #00e5ff !important;
      box-shadow: 0 0 16px rgba(0, 229, 255, 0.25), inset 0 0 8px rgba(0, 229, 255, 0.06) !important;
    }
    :root[data-theme-id="neon-pulse"] .card {
      border: 1px solid rgba(0, 229, 255, 0.08) !important;
    }
    :root[data-theme-id="neon-pulse"] .card:hover {
      border-color: rgba(0, 229, 255, 0.25) !important;
      box-shadow: 0 0 20px rgba(0, 229, 255, 0.12), 0 0 40px rgba(255, 45, 149, 0.06) !important;
    }
    :root[data-theme-id="neon-pulse"] ::selection {
      background: rgba(0, 229, 255, 0.4);
      color: #0a0a14;
    }
    :root[data-theme-id="neon-pulse"] ::-webkit-scrollbar-thumb {
      background: rgba(0, 229, 255, 0.2) !important;
    }
    :root[data-theme-id="neon-pulse"] ::-webkit-scrollbar-thumb:hover {
      background: rgba(0, 229, 255, 0.35) !important;
    }
  `,
};

// ═══════════════════════════════════════════════════════════════
// Ember Dusk — Smoldering campfire coals in charcoal night
// ═══════════════════════════════════════════════════════════════
export const emberDuskTheme: Theme = {
  id: 'ember-dusk',
  name: 'Ember Dusk',
  variant: 'dark',
  description: 'Glowing embers in a bed of charcoal — warm, smoldering, quietly fierce.',
  colors: {
    background: '#0f0c0a',
    onBackground: '#efe4d8',
    surface: '#191410',
    onSurface: '#efe4d8',
    surfaceVariant: '#241d16',
    primary: '#f47b3a',
    onPrimary: '#1f0a02',
    primaryContainer: 'rgba(244, 123, 58, 0.14)',
    onPrimaryContainer: '#ffe0cc',
    secondary: '#6b5d52',
    onSecondary: '#efe4d8',
    outline: 'rgba(244, 123, 58, 0.16)',
    outlineVariant: 'rgba(244, 123, 58, 0.06)',
    error: '#f06050',
    onError: '#1f0502',
    errorContainer: 'rgba(240, 96, 80, 0.16)',
    onErrorContainer: '#ffd8d0',
    success: '#5cb878',
    warning: '#e8a840',
    toolbar: '#13100c',
    sidebar: '#0c0a07',
    card: '#191410',
    input: '#1d1812',
    border: 'rgba(244, 123, 58, 0.14)',
    text: '#efe4d8',
    textSecondary: '#a89a8a',
    link: '#f47b3a',
  },
  typography: {
    fontFamily: '"Merriweather", "Georgia", serif',
    fontSize: { xs: '0.75rem', sm: '0.875rem', md: '1rem', lg: '1.125rem', xl: '1.25rem', '2xl': '1.5rem', '3xl': '1.875rem' },
    fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
    lineHeight: { tight: 1.25, normal: 1.55, relaxed: 1.75 },
  },
  spacing: { xs: '0.25rem', sm: '0.5rem', md: '1rem', lg: '1.5rem', xl: '2rem', '2xl': '3rem', '3xl': '4rem' },
  radius: { none: '0', sm: '0.25rem', md: '0.5rem', lg: '0.625rem', xl: '0.875rem', '2xl': '1.25rem', full: '9999px' },
  shadows: {
    sm: '0 2px 6px rgba(244, 123, 58, 0.08)',
    md: '0 4px 14px rgba(244, 123, 58, 0.1)',
    lg: '0 8px 28px rgba(244, 123, 58, 0.14)',
    xl: '0 16px 44px rgba(244, 123, 58, 0.18)',
  },
  customCSS: `
    :root[data-theme-id="ember-dusk"] .sidebar-item-active {
      background: rgba(244, 123, 58, 0.1) !important;
      border-left: 3px solid #f47b3a !important;
      box-shadow: inset 0 0 18px rgba(244, 123, 58, 0.06);
    }
    :root[data-theme-id="ember-dusk"] .sidebar-item:hover:not(.sidebar-item-active) {
      background: rgba(244, 123, 58, 0.03) !important;
    }
    :root[data-theme-id="ember-dusk"] input:focus,
    :root[data-theme-id="ember-dusk"] textarea:focus {
      border-color: rgba(244, 123, 58, 0.5) !important;
      box-shadow: 0 0 12px rgba(244, 123, 58, 0.2), inset 0 0 6px rgba(244, 123, 58, 0.04) !important;
    }
    :root[data-theme-id="ember-dusk"] .card {
      border: 1px solid rgba(244, 123, 58, 0.06) !important;
    }
    :root[data-theme-id="ember-dusk"] .card:hover {
      border-color: rgba(244, 123, 58, 0.18) !important;
      box-shadow: 0 4px 16px rgba(244, 123, 58, 0.1) !important;
    }
    :root[data-theme-id="ember-dusk"] ::selection {
      background: rgba(244, 123, 58, 0.35);
      color: #efe4d8;
    }
  `,
};

// ═══════════════════════════════════════════════════════════════
// Abyssal Depths — Bioluminescent trench, crushing deep ocean
// ═══════════════════════════════════════════════════════════════
export const abyssalDepthsTheme: Theme = {
  id: 'abyssal-depths',
  name: 'Abyssal Depths',
  variant: 'dark',
  description: 'Deep-ocean abyss with bioluminescent teal — crushing pressure, otherworldly glow.',
  colors: {
    background: '#030b10',
    onBackground: '#c8e6f0',
    surface: '#081820',
    onSurface: '#c8e6f0',
    surfaceVariant: '#0c2430',
    primary: '#00d4c8',
    onPrimary: '#001a18',
    primaryContainer: 'rgba(0, 212, 200, 0.12)',
    onPrimaryContainer: '#b0faf4',
    secondary: '#2d6b78',
    onSecondary: '#c8e6f0',
    outline: 'rgba(0, 212, 200, 0.16)',
    outlineVariant: 'rgba(0, 212, 200, 0.05)',
    error: '#ff6677',
    onError: '#1a0206',
    errorContainer: 'rgba(255, 102, 119, 0.14)',
    onErrorContainer: '#ffced4',
    success: '#3dd9a0',
    warning: '#f0d060',
    toolbar: '#050e14',
    sidebar: '#02080c',
    card: '#081820',
    input: '#0b1e28',
    border: 'rgba(0, 212, 200, 0.14)',
    text: '#c8e6f0',
    textSecondary: '#6b9aaa',
    link: '#00d4c8',
  },
  typography: {
    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
    fontSize: { xs: '0.75rem', sm: '0.875rem', md: '1rem', lg: '1.125rem', xl: '1.25rem', '2xl': '1.5rem', '3xl': '1.875rem' },
    fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
    lineHeight: { tight: 1.2, normal: 1.5, relaxed: 1.7 },
  },
  spacing: { xs: '0.25rem', sm: '0.5rem', md: '1rem', lg: '1.5rem', xl: '2rem', '2xl': '3rem', '3xl': '4rem' },
  radius: { none: '0', sm: '0.125rem', md: '0.25rem', lg: '0.375rem', xl: '0.5rem', '2xl': '0.75rem', full: '9999px' },
  shadows: {
    sm: '0 0 4px rgba(0, 212, 200, 0.1)',
    md: '0 0 12px rgba(0, 212, 200, 0.15)',
    lg: '0 0 24px rgba(0, 212, 200, 0.2)',
    xl: '0 0 40px rgba(0, 212, 200, 0.25)',
  },
  effects: { backgroundAnimation: 'bioglow' },
  customCSS: `
    :root[data-theme-id="abyssal-depths"] .sidebar-item-active {
      background: rgba(0, 212, 200, 0.08) !important;
      border-left: 3px solid #00d4c8 !important;
      box-shadow: inset 0 0 14px rgba(0, 212, 200, 0.08);
    }
    :root[data-theme-id="abyssal-depths"] .sidebar-item:hover:not(.sidebar-item-active) {
      background: rgba(0, 212, 200, 0.03) !important;
    }
    :root[data-theme-id="abyssal-depths"] input:focus,
    :root[data-theme-id="abyssal-depths"] textarea:focus {
      border-color: #00d4c8 !important;
      box-shadow: 0 0 14px rgba(0, 212, 200, 0.25), inset 0 0 8px rgba(0, 212, 200, 0.04) !important;
    }
    :root[data-theme-id="abyssal-depths"] .card:hover {
      border-color: rgba(0, 212, 200, 0.2) !important;
      box-shadow: 0 0 18px rgba(0, 212, 200, 0.1) !important;
    }
    :root[data-theme-id="abyssal-depths"] ::selection {
      background: rgba(0, 212, 200, 0.35);
      color: #030b10;
    }
    :root[data-theme-id="abyssal-depths"] ::-webkit-scrollbar-thumb {
      background: rgba(0, 212, 200, 0.15) !important;
    }
  `,
};

// ═══════════════════════════════════════════════════════════════
// Pearl Haze — Iridescent pearl with lavender whispers (LIGHT)
// ═══════════════════════════════════════════════════════════════
export const pearlHazeTheme: Theme = {
  id: 'pearl-haze',
  name: 'Pearl Haze',
  variant: 'light',
  description: 'Soft pearl white with iridescent lavender and pink whispers — ethereal, luminous, delicate.',
  colors: {
    background: '#faf7fc',
    onBackground: '#2d2330',
    surface: '#ffffff',
    onSurface: '#2d2330',
    surfaceVariant: '#f3eef8',
    primary: '#9b7ec4',
    onPrimary: '#ffffff',
    primaryContainer: '#ede4f8',
    onPrimaryContainer: '#2a1840',
    secondary: '#b8a0c8',
    onSecondary: '#2d2330',
    outline: '#d4c8e0',
    outlineVariant: '#e8ddf0',
    error: '#e0556a',
    onError: '#ffffff',
    errorContainer: '#ffe8ec',
    onErrorContainer: '#4a1018',
    success: '#58b894',
    warning: '#e0a840',
    toolbar: '#f5f0fa',
    sidebar: '#f8f4fc',
    card: '#ffffff',
    input: '#f8f5fb',
    border: '#e0d4ec',
    text: '#2d2330',
    textSecondary: '#7d6b88',
    link: '#9b7ec4',
  },
  typography: {
    fontFamily: '"DM Sans", "Inter", system-ui, sans-serif',
    fontSize: { xs: '0.75rem', sm: '0.875rem', md: '1rem', lg: '1.125rem', xl: '1.25rem', '2xl': '1.5rem', '3xl': '1.875rem' },
    fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
    lineHeight: { tight: 1.25, normal: 1.5, relaxed: 1.75 },
  },
  spacing: { xs: '0.25rem', sm: '0.5rem', md: '1rem', lg: '1.5rem', xl: '2rem', '2xl': '3rem', '3xl': '4rem' },
  radius: { none: '0', sm: '0.25rem', md: '0.5rem', lg: '0.75rem', xl: '1rem', '2xl': '1.5rem', full: '9999px' },
  shadows: {
    sm: '0 1px 3px rgba(155, 126, 196, 0.06)',
    md: '0 4px 12px rgba(155, 126, 196, 0.08)',
    lg: '0 8px 24px rgba(155, 126, 196, 0.1)',
    xl: '0 16px 40px rgba(155, 126, 196, 0.12)',
  },
  customCSS: `
    :root[data-theme-id="pearl-haze"] .sidebar-item-active {
      background: linear-gradient(135deg, rgba(155, 126, 196, 0.12), rgba(200, 160, 220, 0.08)) !important;
      border-left: 3px solid #9b7ec4 !important;
    }
    :root[data-theme-id="pearl-haze"] .sidebar-item:hover:not(.sidebar-item-active) {
      background: rgba(155, 126, 196, 0.04) !important;
    }
    :root[data-theme-id="pearl-haze"] input:focus,
    :root[data-theme-id="pearl-haze"] textarea:focus {
      border-color: #9b7ec4 !important;
      box-shadow: 0 0 0 3px rgba(155, 126, 196, 0.12) !important;
    }
    :root[data-theme-id="pearl-haze"] .card:hover {
      box-shadow: 0 8px 30px rgba(155, 126, 196, 0.1) !important;
    }
    :root[data-theme-id="pearl-haze"] ::selection {
      background: rgba(155, 126, 196, 0.2);
      color: #2d2330;
    }
  `,
};

// ═══════════════════════════════════════════════════════════════
// Golden Hour — The last hour of sunlight, honey & amber (LIGHT)
// ═══════════════════════════════════════════════════════════════
export const goldenHourTheme: Theme = {
  id: 'golden-hour',
  name: 'Golden Hour',
  variant: 'light',
  description: 'Warm honeyed sunlight flooding through tall grass — rich amber, soft cream, radiant.',
  colors: {
    background: '#fef9f0',
    onBackground: '#3d2e1a',
    surface: '#fffdf8',
    onSurface: '#3d2e1a',
    surfaceVariant: '#fdf3e0',
    primary: '#d4913e',
    onPrimary: '#ffffff',
    primaryContainer: '#fde8cc',
    onPrimaryContainer: '#3d2004',
    secondary: '#c8a060',
    onSecondary: '#3d2e1a',
    outline: '#e0c898',
    outlineVariant: '#f0dcc0',
    error: '#d05345',
    onError: '#ffffff',
    errorContainer: '#ffe6e0',
    onErrorContainer: '#4a1410',
    success: '#5ca870',
    warning: '#e0a840',
    toolbar: '#fdf5e8',
    sidebar: '#fef8ee',
    card: '#fffdf8',
    input: '#fefaf2',
    border: '#ecd8b0',
    text: '#3d2e1a',
    textSecondary: '#8a7048',
    link: '#d4913e',
  },
  typography: {
    fontFamily: '"Fraunces", "Georgia", serif',
    fontSize: { xs: '0.75rem', sm: '0.875rem', md: '1rem', lg: '1.125rem', xl: '1.25rem', '2xl': '1.5rem', '3xl': '1.875rem' },
    fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
    lineHeight: { tight: 1.25, normal: 1.55, relaxed: 1.75 },
  },
  spacing: { xs: '0.25rem', sm: '0.5rem', md: '1rem', lg: '1.5rem', xl: '2rem', '2xl': '3rem', '3xl': '4rem' },
  radius: { none: '0', sm: '0.25rem', md: '0.5rem', lg: '0.625rem', xl: '0.875rem', '2xl': '1.25rem', full: '9999px' },
  shadows: {
    sm: '0 1px 4px rgba(212, 145, 62, 0.08)',
    md: '0 4px 14px rgba(212, 145, 62, 0.1)',
    lg: '0 8px 28px rgba(212, 145, 62, 0.14)',
    xl: '0 16px 44px rgba(212, 145, 62, 0.18)',
  },
  effects: { backgroundAnimation: 'sunbeams' },
  customCSS: `
    :root[data-theme-id="golden-hour"] .sidebar-item-active {
      background: linear-gradient(135deg, rgba(212, 145, 62, 0.12), rgba(232, 180, 100, 0.06)) !important;
      border-left: 3px solid #d4913e !important;
    }
    :root[data-theme-id="golden-hour"] .sidebar-item:hover:not(.sidebar-item-active) {
      background: rgba(212, 145, 62, 0.05) !important;
    }
    :root[data-theme-id="golden-hour"] input:focus,
    :root[data-theme-id="golden-hour"] textarea:focus {
      border-color: #d4913e !important;
      box-shadow: 0 0 0 3px rgba(212, 145, 62, 0.15) !important;
    }
    :root[data-theme-id="golden-hour"] .card:hover {
      box-shadow: 0 6px 24px rgba(212, 145, 62, 0.12) !important;
    }
    :root[data-theme-id="golden-hour"] ::selection {
      background: rgba(212, 145, 62, 0.25);
      color: #3d2e1a;
    }
  `,
};

// ═══════════════════════════════════════════════════════════════
// Seafoam Breeze — Fresh ocean mist, mint & sand (LIGHT)
// ═══════════════════════════════════════════════════════════════
export const seafoamBreezeTheme: Theme = {
  id: 'seafoam-breeze',
  name: 'Seafoam Breeze',
  variant: 'light',
  description: 'Cool seafoam green with warm sandy beige — a calm morning on the shore, crisp and airy.',
  colors: {
    background: '#f5faf8',
    onBackground: '#1e3028',
    surface: '#ffffff',
    onSurface: '#1e3028',
    surfaceVariant: '#e8f4ee',
    primary: '#5aad8a',
    onPrimary: '#ffffff',
    primaryContainer: '#d4f0e2',
    onPrimaryContainer: '#0e3020',
    secondary: '#a0c8b0',
    onSecondary: '#1e3028',
    outline: '#c0dcc8',
    outlineVariant: '#d8ece0',
    error: '#d06860',
    onError: '#ffffff',
    errorContainer: '#ffe8e4',
    onErrorContainer: '#401410',
    success: '#4ab878',
    warning: '#e0b850',
    toolbar: '#f0f8f4',
    sidebar: '#f3faf6',
    card: '#ffffff',
    input: '#f7fcfa',
    border: '#d4e8dc',
    text: '#1e3028',
    textSecondary: '#6d8878',
    link: '#5aad8a',
  },
  typography: {
    fontFamily: '"Work Sans", "Inter", system-ui, sans-serif',
    fontSize: { xs: '0.75rem', sm: '0.875rem', md: '1rem', lg: '1.125rem', xl: '1.25rem', '2xl': '1.5rem', '3xl': '1.875rem' },
    fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
    lineHeight: { tight: 1.25, normal: 1.5, relaxed: 1.7 },
  },
  spacing: { xs: '0.25rem', sm: '0.5rem', md: '1rem', lg: '1.5rem', xl: '2rem', '2xl': '3rem', '3xl': '4rem' },
  radius: { none: '0', sm: '0.25rem', md: '0.5rem', lg: '0.625rem', xl: '0.875rem', '2xl': '1.25rem', full: '9999px' },
  shadows: {
    sm: '0 1px 3px rgba(90, 173, 138, 0.06)',
    md: '0 4px 12px rgba(90, 173, 138, 0.08)',
    lg: '0 8px 24px rgba(90, 173, 138, 0.1)',
    xl: '0 16px 40px rgba(90, 173, 138, 0.12)',
  },
  customCSS: `
    :root[data-theme-id="seafoam-breeze"] .sidebar-item-active {
      background: linear-gradient(135deg, rgba(90, 173, 138, 0.1), rgba(130, 200, 160, 0.05)) !important;
      border-left: 3px solid #5aad8a !important;
    }
    :root[data-theme-id="seafoam-breeze"] .sidebar-item:hover:not(.sidebar-item-active) {
      background: rgba(90, 173, 138, 0.04) !important;
    }
    :root[data-theme-id="seafoam-breeze"] input:focus,
    :root[data-theme-id="seafoam-breeze"] textarea:focus {
      border-color: #5aad8a !important;
      box-shadow: 0 0 0 3px rgba(90, 173, 138, 0.12) !important;
    }
    :root[data-theme-id="seafoam-breeze"] .card:hover {
      box-shadow: 0 6px 24px rgba(90, 173, 138, 0.08) !important;
    }
    :root[data-theme-id="seafoam-breeze"] ::selection {
      background: rgba(90, 173, 138, 0.2);
      color: #1e3028;
    }
  `,
};

// ═══════════════════════════════════════════════════════════════
// Rose Quartz — Soft dusty rose, mauve, and warm cream (LIGHT)
// ═══════════════════════════════════════════════════════════════
export const roseQuartzTheme: Theme = {
  id: 'rose-quartz',
  name: 'Rose Quartz',
  variant: 'light',
  description: 'Polished rose quartz crystal with dusty mauve — gentle, elegant, healing warmth.',
  colors: {
    background: '#fcf7f7',
    onBackground: '#38282a',
    surface: '#ffffff',
    onSurface: '#38282a',
    surfaceVariant: '#f8edee',
    primary: '#c47a7a',
    onPrimary: '#ffffff',
    primaryContainer: '#f8e0e0',
    onPrimaryContainer: '#381818',
    secondary: '#c8a0a0',
    onSecondary: '#38282a',
    outline: '#e0c8c8',
    outlineVariant: '#f0dcdc',
    error: '#c85050',
    onError: '#ffffff',
    errorContainer: '#ffe0e0',
    onErrorContainer: '#381010',
    success: '#68a878',
    warning: '#d8a850',
    toolbar: '#faf2f3',
    sidebar: '#fcf5f5',
    card: '#ffffff',
    input: '#fdf8f8',
    border: '#ecd8d8',
    text: '#38282a',
    textSecondary: '#907878',
    link: '#c47a7a',
  },
  typography: {
    fontFamily: '"Libre Baskerville", "Georgia", serif',
    fontSize: { xs: '0.75rem', sm: '0.875rem', md: '1rem', lg: '1.125rem', xl: '1.25rem', '2xl': '1.5rem', '3xl': '1.875rem' },
    fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
    lineHeight: { tight: 1.25, normal: 1.55, relaxed: 1.75 },
  },
  spacing: { xs: '0.25rem', sm: '0.5rem', md: '1rem', lg: '1.5rem', xl: '2rem', '2xl': '3rem', '3xl': '4rem' },
  radius: { none: '0', sm: '0.25rem', md: '0.5rem', lg: '0.75rem', xl: '1rem', '2xl': '1.5rem', full: '9999px' },
  shadows: {
    sm: '0 1px 3px rgba(196, 122, 122, 0.06)',
    md: '0 4px 12px rgba(196, 122, 122, 0.08)',
    lg: '0 8px 24px rgba(196, 122, 122, 0.1)',
    xl: '0 16px 40px rgba(196, 122, 122, 0.12)',
  },
  customCSS: `
    :root[data-theme-id="rose-quartz"] .sidebar-item-active {
      background: linear-gradient(135deg, rgba(196, 122, 122, 0.1), rgba(220, 160, 160, 0.05)) !important;
      border-left: 3px solid #c47a7a !important;
    }
    :root[data-theme-id="rose-quartz"] .sidebar-item:hover:not(.sidebar-item-active) {
      background: rgba(196, 122, 122, 0.04) !important;
    }
    :root[data-theme-id="rose-quartz"] input:focus,
    :root[data-theme-id="rose-quartz"] textarea:focus {
      border-color: #c47a7a !important;
      box-shadow: 0 0 0 3px rgba(196, 122, 122, 0.12) !important;
    }
    :root[data-theme-id="rose-quartz"] .card:hover {
      box-shadow: 0 6px 24px rgba(196, 122, 122, 0.1) !important;
    }
    :root[data-theme-id="rose-quartz"] ::selection {
      background: rgba(196, 122, 122, 0.2);
      color: #38282a;
    }
  `,
};

// ═══════════════════════════════════════════════════════════════
// Alpine Snow — Crisp mountain snow, cool blue-gray (LIGHT)
// ═══════════════════════════════════════════════════════════════
export const alpineSnowTheme: Theme = {
  id: 'alpine-snow',
  name: 'Alpine Snow',
  variant: 'light',
  description: 'Crisp alpine snowfields under a cerulean sky — clean, sharp, soaringly fresh.',
  colors: {
    background: '#f8fafb',
    onBackground: '#1e282e',
    surface: '#ffffff',
    onSurface: '#1e282e',
    surfaceVariant: '#ecf2f6',
    primary: '#4a8ab5',
    onPrimary: '#ffffff',
    primaryContainer: '#d8ecf8',
    onPrimaryContainer: '#0c2840',
    secondary: '#90b8d0',
    onSecondary: '#1e282e',
    outline: '#c4d8e4',
    outlineVariant: '#dce8f0',
    error: '#c86060',
    onError: '#ffffff',
    errorContainer: '#ffe4e4',
    onErrorContainer: '#381010',
    success: '#50a870',
    warning: '#d8b050',
    toolbar: '#f2f6f9',
    sidebar: '#f6f9fb',
    card: '#ffffff',
    input: '#fafcfd',
    border: '#dce8f0',
    text: '#1e282e',
    textSecondary: '#6d8088',
    link: '#4a8ab5',
  },
  typography: {
    fontFamily: '"Inter", "SF Pro Display", system-ui, sans-serif',
    fontSize: { xs: '0.75rem', sm: '0.875rem', md: '1rem', lg: '1.125rem', xl: '1.25rem', '2xl': '1.5rem', '3xl': '1.875rem' },
    fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
    lineHeight: { tight: 1.2, normal: 1.5, relaxed: 1.65 },
  },
  spacing: { xs: '0.25rem', sm: '0.5rem', md: '1rem', lg: '1.5rem', xl: '2rem', '2xl': '3rem', '3xl': '4rem' },
  radius: { none: '0', sm: '0.125rem', md: '0.25rem', lg: '0.375rem', xl: '0.5rem', '2xl': '0.75rem', full: '9999px' },
  shadows: {
    sm: '0 1px 3px rgba(74, 138, 181, 0.05)',
    md: '0 4px 12px rgba(74, 138, 181, 0.07)',
    lg: '0 8px 24px rgba(74, 138, 181, 0.09)',
    xl: '0 16px 40px rgba(74, 138, 181, 0.1)',
  },
  customCSS: `
    :root[data-theme-id="alpine-snow"] .sidebar-item-active {
      background: rgba(74, 138, 181, 0.08) !important;
      border-left: 3px solid #4a8ab5 !important;
    }
    :root[data-theme-id="alpine-snow"] .sidebar-item:hover:not(.sidebar-item-active) {
      background: rgba(74, 138, 181, 0.03) !important;
    }
    :root[data-theme-id="alpine-snow"] input:focus,
    :root[data-theme-id="alpine-snow"] textarea:focus {
      border-color: #4a8ab5 !important;
      box-shadow: 0 0 0 3px rgba(74, 138, 181, 0.1) !important;
    }
    :root[data-theme-id="alpine-snow"] .card:hover {
      box-shadow: 0 4px 20px rgba(74, 138, 181, 0.08) !important;
    }
    :root[data-theme-id="alpine-snow"] ::selection {
      background: rgba(74, 138, 181, 0.18);
      color: #1e282e;
    }
  `,
};

// Export all built-in themes
export const builtInThemes: Theme[] = [
  ...legacyIndexThemes,
  modernDarkTheme,
  materialYouTheme,
  snowTheme,
  windows95Theme,
  mistralDarkTheme,
  auroraLightTheme,
  forestLightTheme,
  iceBlueTheme,
  nocturneDarkTheme,
  mapquestTheme,
  milkyMatchaTheme,
  sandstoneLightTheme,
  minecraftTheme,
  burntUmberTheme,
  mistralLightTheme,
  modernPolishedTheme,
  omarChyBlissTheme,
  superGameBroTheme,
  cartographerTheme,
  highContrastLightTheme,
  highContrastDarkTheme,
  lemonSliceTheme,
  glassTheme,
  focusTheme,
  focusCompactTheme,
  solarSanctuaryTheme,
  sereneMeadowTheme,
  rainyLibraryTheme,
  cyberDriveTheme,
  stardustVoidTheme,
  biolumeAbyssTheme,
  eucalyptusMistTheme,
  macchiatoCreamTheme,
  nordicFrostTheme,
  tokyoNeonTheme,
  espressoRoastTheme,
  nordicSlateTheme,
  cozyWindowpaneTheme,
  liquidGlassTheme,
  obsidianNoirTheme,
  velvetTwilightTheme,
  neonPulseTheme,
  emberDuskTheme,
  abyssalDepthsTheme,
  pearlHazeTheme,
  goldenHourTheme,
  seafoamBreezeTheme,
  roseQuartzTheme,
  alpineSnowTheme,
];
