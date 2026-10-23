import React, { createContext, useContext, useState, useLayoutEffect } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type PastelTheme = 'default' | 'sky' | 'mint' | 'lavender' | 'peach' | 'rose';

export interface PastelThemeOption {
  id: PastelTheme;
  name: string;
  tagline: string;
  description: string;
  primaryColor: string;
  pastelBg: string;
  accentColor: string;
  swatchColors: string[]; // Palette preview, including semantic accents when present.
}

export const PASTEL_THEMES: PastelThemeOption[] = [
  {
    id: 'default',
    name: 'Modern Soft (Cyan)',
    tagline: 'Putih bersih, abu lembut & cyan',
    description: 'Modern Soft UI dengan kartu putih, bayangan minimalis, aksen cyan, dan font Inter.',
    primaryColor: '#06abc9',
    pastelBg: '#f4f6f9',
    accentColor: '#06abc9',
    swatchColors: ['#f4f6f9', '#ffffff', '#06abc9', '#19bda4'],
  },
  {
    id: 'sky',
    name: 'Biru Langit',
    tagline: 'Langit Cerah & Sejuk',
    description: 'Warna biru langit yang segar dan menenangkan, nyaman dipandang saat mencatat kehadiran dan laporan.',
    primaryColor: '#0284c7',
    pastelBg: '#f0f9ff',
    accentColor: '#0369a1',
    swatchColors: ['#0284c7', '#bae6fd', '#f0f9ff'],
  },
  {
    id: 'mint',
    name: 'Hijau Mint',
    tagline: 'Segar & Bersahabat',
    description: 'Nuansa mint alami yang sejuk dan ramah di mata, menghadirkan kesegaran suasana sekolah asri.',
    primaryColor: '#059669',
    pastelBg: '#ecfdf5',
    accentColor: '#047857',
    swatchColors: ['#059669', '#a7f3d0', '#ecfdf5'],
  },
  {
    id: 'lavender',
    name: 'Lavender',
    tagline: 'Damai, Lembut & Elegan',
    description: 'Kombinasi ungu lavender pastel yang anggun dan estetik, memberikan kenyamanan visual maksimal.',
    primaryColor: '#7c3aed',
    pastelBg: '#f5f3ff',
    accentColor: '#6d28d9',
    swatchColors: ['#7c3aed', '#ddd6fe', '#f5f3ff'],
  },
  {
    id: 'peach',
    name: 'Peach',
    tagline: 'Hangat, Ramah & Ceria',
    description: 'Sentuhan warna persik pastel hangat yang membangkitkan keramahan dan semangat positif di pos piket.',
    primaryColor: '#ea580c',
    pastelBg: '#fff7ed',
    accentColor: '#c2410c',
    swatchColors: ['#ea580c', '#fed7aa', '#fff7ed'],
  },
  {
    id: 'rose',
    name: 'Rose',
    tagline: 'Manis, Segar & Bersih',
    description: 'Warna mawar merah muda lembut yang menawan, menghadirkan nuansa bersih, rapi, dan bersahabat.',
    primaryColor: '#e11d48',
    pastelBg: '#fff1f2',
    accentColor: '#be123c',
    swatchColors: ['#e11d48', '#fecdd3', '#fff1f2'],
  },
];

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  pastelTheme: PastelTheme;
  setPastelTheme: (pastel: PastelTheme) => void;
  isDark: boolean;
  pastelThemesList: PastelThemeOption[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'piket_guru_theme';
const PASTEL_THEME_STORAGE_KEY = 'piket_guru_pastel_theme';

const getInitialThemeMode = (): ThemeMode => {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
  } catch (e) {
    console.warn('Unable to read theme mode from localStorage', e);
  }
  // Modern Soft UI opens in light mode on a new browser; saved preferences still win.
  return 'light';
};

const getInitialPastelTheme = (): PastelTheme => {
  try {
    const saved = localStorage.getItem(PASTEL_THEME_STORAGE_KEY);
    if (
      saved === 'default' ||
      saved === 'sky' ||
      saved === 'mint' ||
      saved === 'lavender' ||
      saved === 'peach' ||
      saved === 'rose'
    ) {
      return saved;
    }
  } catch (e) {
    console.warn('Unable to read pastel theme from localStorage', e);
  }
  return 'default';
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(getInitialThemeMode);
  const [pastelTheme, setPastelThemeState] = useState<PastelTheme>(getInitialPastelTheme);
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const initial = getInitialThemeMode();
    if (initial === 'dark') return true;
    if (initial === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Apply theme mode and pastel theme to documentElement synchronously before paint
  useLayoutEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const computeIsDark = () => {
      if (theme === 'system') {
        return mediaQuery.matches;
      }
      return theme === 'dark';
    };

    const resolved = computeIsDark();
    setIsDark(resolved);

    // Apply dark/light class
    if (resolved) {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }

    // Apply pastel theme attribute
    root.setAttribute('data-pastel-theme', pastelTheme);

    // Sync browser theme-color meta tag for seamless status bar integration
    const metaColors: Record<'dark' | 'light', Record<PastelTheme, string>> = {
      dark: {
        default: '#192432',
        sky: '#0c1a26',
        mint: '#0a1f17',
        lavender: '#181028',
        peach: '#1f140b',
        rose: '#200d13',
      },
      light: {
        default: '#ffffff',
        sky: '#0284c7',
        mint: '#059669',
        lavender: '#7c3aed',
        peach: '#ea580c',
        rose: '#e11d48',
      },
    };
    const targetMetaColor = metaColors[resolved ? 'dark' : 'light'][pastelTheme] || (resolved ? '#24221d' : '#fffef8');
    const metaTag = document.querySelector('meta[name="theme-color"]');
    if (metaTag) {
      metaTag.setAttribute('content', targetMetaColor);
    }

    // Save preferences locally
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
      localStorage.setItem(PASTEL_THEME_STORAGE_KEY, pastelTheme);
    } catch (e) {
      console.warn('Unable to save theme settings to localStorage', e);
    }

    const handleChange = () => {
      if (theme === 'system') {
        const darkNow = mediaQuery.matches;
        setIsDark(darkNow);
        if (darkNow) {
          root.classList.add('dark');
          root.style.colorScheme = 'dark';
        } else {
          root.classList.remove('dark');
          root.style.colorScheme = 'light';
        }
        const sysColor = metaColors[darkNow ? 'dark' : 'light'][pastelTheme] || (darkNow ? '#24221d' : '#fffef8');
        if (metaTag) {
          metaTag.setAttribute('content', sysColor);
        }
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, pastelTheme]);

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
  };

  const setPastelTheme = (newPastel: PastelTheme) => {
    setPastelThemeState(newPastel);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        pastelTheme,
        setPastelTheme,
        isDark,
        pastelThemesList: PASTEL_THEMES,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
