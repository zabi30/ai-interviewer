export type Theme = 'light' | 'dark';

export interface ThemeColors {
  // Core colors
  background: string;
  surface: string;
  primary: string;
  secondary: string;
  accent: string;
  // Common UI copy color often used across screens
  subtitle: string;
  
  // Text colors
  text: string;
  textSecondary: string;
  textTertiary: string;
  
  // Border colors
  border: string;
  borderLight: string;
  
  // Semantic colors
  success: string;
  warning: string;
  error: string;
  info: string;
  // Alias commonly referenced in screens
  danger: string;
  
  // UI colors
  card: string;
  cardText: string;
  shadow: string;
  overlay: string;
}

export const themeColors: Record<Theme, ThemeColors> = {
  light: {
    // Core colors
    background: '#FFFFFF',
    surface: '#F8FAFC',
    primary: '#3B82F6',
    secondary: '#6366F1',
    accent: '#10B981',
    subtitle: '#475569',
    
    // Text colors
    text: '#0F172A',
    textSecondary: '#475569',
    textTertiary: '#64748B',
    
    // Border colors
    border: '#E2E8F0',
    borderLight: '#F1F5F9',
    
    // Semantic colors
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
    danger: '#EF4444',
    
    // UI colors
    card: '#FFFFFF',
    cardText: '#0F172A',
    shadow: 'rgba(0, 0, 0, 0.1)',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },
  dark: {
    // Core colors
    background: '#0F172A',
    surface: '#1E293B',
    primary: '#60A5FA',
    secondary: '#818CF8',
    accent: '#34D399',
    subtitle: '#CBD5E1',
    
    // Text colors
    text: '#F8FAFC',
    textSecondary: '#CBD5E1',
    textTertiary: '#94A3B8',
    
    // Border colors
    border: '#334155',
    borderLight: '#475569',
    
    // Semantic colors
    success: '#34D399',
    warning: '#FBBF24',
    error: '#F87171',
    info: '#60A5FA',
    danger: '#F87171',
    
    // UI colors
    card: '#1E293B',
    cardText: '#F8FAFC',
    shadow: 'rgba(0, 0, 0, 0.3)',
    overlay: 'rgba(0, 0, 0, 0.7)',
  },
};

// Gradient presets for common use cases
export const gradients = {
  primary: ['#3B82F6', '#1D4ED8'],
  secondary: ['#6366F1', '#4338CA'],
  success: ['#10B981', '#059669'],
  warning: ['#F59E0B', '#D97706'],
  error: ['#EF4444', '#DC2626'],
  dark: ['#1E293B', '#0F172A'],
  light: ['#F8FAFC', '#E2E8F0'],
} as const;

// Semantic color helpers
export const getSemanticColor = (theme: Theme, type: 'success' | 'warning' | 'error' | 'info'): string => {
  return themeColors[theme][type];
};

// Text color helpers
export const getTextColor = (theme: Theme, variant: 'primary' | 'secondary' | 'tertiary' = 'primary'): string => {
  const variants = {
    primary: 'text',
    secondary: 'textSecondary',
    tertiary: 'textTertiary',
  } as const;
  
  return themeColors[theme][variants[variant]];
};

// Utility functions
export const getContrastColor = (backgroundColor: string): string => {
  // Simple contrast calculation - in production, use a proper color contrast library
  const hex = backgroundColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  
  return brightness > 128 ? '#000000' : '#FFFFFF';
};

export const getOpacityColor = (color: string, opacity: number): string => {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};
