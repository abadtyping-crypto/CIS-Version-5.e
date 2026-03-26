import { useCallback, useEffect, useMemo, useState } from 'react';
import { getRuntimePlatform, PLATFORM_ELECTRON } from '../lib/runtimePlatform';
import { ThemeContext } from './ThemeContextValue';
import {
  readDesktopAppearance,
  saveDesktopAppearance,
  DESKTOP_APPEARANCE_EVENT,
  DESKTOP_WALLPAPERS,
  DESKTOP_FONT_FAMILIES,
  DESKTOP_FONT_SCALES,
} from '../lib/mobileAppearance';

const THEME_STORAGE_KEY_LEGACY = 'acis_application_theme';
const THEME_STORAGE_KEY_DESKTOP = 'acis_application_theme_desktop';
const THEME_STORAGE_KEY_MOBILE = 'acis_application_theme_mobile';
const SYSTEM_THEME_QUERY = '(prefers-color-scheme: dark)';

const getThemeScope = () => {
  if (typeof window === 'undefined') return 'desktop';
  if (getRuntimePlatform() === PLATFORM_ELECTRON) return 'desktop';
  return window.innerWidth >= 1024 ? 'desktop' : 'mobile';
};

const getStorageKeyForScope = (scope) =>
  scope === 'mobile' ? THEME_STORAGE_KEY_MOBILE : THEME_STORAGE_KEY_DESKTOP;

const getInitialTheme = (scope) => {
  const scopedKey = getStorageKeyForScope(scope);
  const savedTheme =
    localStorage.getItem(scopedKey) ||
    localStorage.getItem(THEME_STORAGE_KEY_LEGACY);
  if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') return savedTheme;
  return 'system';
};

const DESKTOP_APPEARANCE_THEME_MAP = {
  aurora: {
    light: {
      bg: '#FFF7EE', surface: '#FFFFFF', panel: '#FFF1E0', border: '#E7CFB1', text: '#4B2B16',
      muted: '#87634A', primary: '#E67E22', secondary: '#F59E0B', tertiary: '#E6B054',
      textOnAccent: '#FFFFFF', gradientEnabled: true,
      glassBg: 'linear-gradient(150deg, rgba(255,255,255,0.84), rgba(255,241,224,0.68) 48%, rgba(255,227,194,0.44) 100%)',
      glassBorder: 'rgba(229,168,96,0.34)', glassShadow: '0 26px 60px -34px rgba(230,126,34,0.34), 0 14px 26px -20px rgba(148,85,19,0.18)',
    },
    dark: {
      bg: '#1E0F08', surface: '#2B1710', panel: '#3B2218', border: '#6B4531', text: '#FFF4EA',
      muted: '#E2BE9F', primary: '#F39C12', secondary: '#F97316', tertiary: '#FBBF24',
      textOnAccent: '#251108', gradientEnabled: true,
      glassBg: 'linear-gradient(150deg, rgba(59,34,24,0.72), rgba(30,15,8,0.52))',
      glassBorder: 'rgba(255,214,176,0.2)', glassShadow: '0 18px 48px -30px rgba(249,115,22,0.3)',
    },
  },
  midnight: {
    light: {
      bg: '#F8F0F7', surface: '#FFFFFF', panel: '#F3E8F0', border: '#DCC7D5', text: '#341E34',
      muted: '#785D78', primary: '#A855F7', secondary: '#C084FC', tertiary: '#E879F9',
      textOnAccent: '#FFFFFF', gradientEnabled: true,
      glassBg: 'linear-gradient(150deg, rgba(255,255,255,0.84), rgba(245,232,240,0.68) 48%, rgba(238,214,247,0.44) 100%)',
      glassBorder: 'rgba(177,126,232,0.34)', glassShadow: '0 26px 60px -34px rgba(168,85,247,0.32), 0 14px 26px -20px rgba(109,40,217,0.16)',
    },
    dark: {
      bg: '#1E1021', surface: '#2A1630', panel: '#392044', border: '#5F3C69', text: '#FBF3FF',
      muted: '#D8B7E0', primary: '#C084FC', secondary: '#E879F9', tertiary: '#F0ABFC',
      textOnAccent: '#1A0B1D', gradientEnabled: true,
      glassBg: 'linear-gradient(150deg, rgba(57,32,68,0.72), rgba(30,16,33,0.54))',
      glassBorder: 'rgba(241,199,255,0.2)', glassShadow: '0 18px 48px -30px rgba(232,121,249,0.28)',
    },
  },
  ocean: {
    light: {
      bg: '#EAF7FF', surface: '#FFFFFF', panel: '#DFF1FF', border: '#B7D9EE', text: '#0F2C46',
      muted: '#4C6E87', primary: '#0284C7', secondary: '#0EA5E9', tertiary: '#22D3EE',
      textOnAccent: '#FFFFFF', gradientEnabled: true,
      glassBg: 'linear-gradient(150deg, rgba(255,255,255,0.84), rgba(223,241,255,0.68) 48%, rgba(194,232,255,0.44) 100%)',
      glassBorder: 'rgba(80,163,212,0.34)', glassShadow: '0 26px 60px -34px rgba(2,132,199,0.3), 0 14px 26px -20px rgba(14,116,144,0.16)',
    },
    dark: {
      bg: '#071828', surface: '#0B2337', panel: '#123149', border: '#2D5A78', text: '#E8F6FF',
      muted: '#A4C7DE', primary: '#38BDF8', secondary: '#22D3EE', tertiary: '#67E8F9',
      textOnAccent: '#052033', gradientEnabled: true,
      glassBg: 'linear-gradient(150deg, rgba(18,49,73,0.74), rgba(7,24,40,0.56))',
      glassBorder: 'rgba(147,229,255,0.18)', glassShadow: '0 18px 48px -30px rgba(34,211,238,0.26)',
    },
  },
  sunrise: {
    light: {
      bg: '#FFF9E6', surface: '#FFFFFF', panel: '#FFF3CC', border: '#E7D8A3', text: '#4B3410',
      muted: '#8A7240', primary: '#F59E0B', secondary: '#F97316', tertiary: '#FACC15',
      textOnAccent: '#FFFFFF', gradientEnabled: true,
      glassBg: 'linear-gradient(150deg, rgba(255,255,255,0.84), rgba(255,243,204,0.68) 48%, rgba(255,227,150,0.44) 100%)',
      glassBorder: 'rgba(235,182,88,0.34)', glassShadow: '0 26px 60px -34px rgba(245,158,11,0.34), 0 14px 26px -20px rgba(180,120,20,0.18)',
    },
    dark: {
      bg: '#2A1A04', surface: '#3A2608', panel: '#4D3410', border: '#765620', text: '#FFF7D9',
      muted: '#E8CF93', primary: '#FBBF24', secondary: '#F59E0B', tertiary: '#F97316',
      textOnAccent: '#261603', gradientEnabled: true,
      glassBg: 'linear-gradient(150deg, rgba(77,52,16,0.72), rgba(42,26,4,0.56))',
      glassBorder: 'rgba(255,226,144,0.2)', glassShadow: '0 18px 48px -30px rgba(251,191,36,0.34)',
    },
  },
  ember: {
    light: {
      bg: '#FFF0F1', surface: '#FFFFFF', panel: '#FFE2E5', border: '#E8BBC2', text: '#4A1820',
      muted: '#87535F', primary: '#DC2626', secondary: '#E11D48', tertiary: '#FB7185',
      textOnAccent: '#FFFFFF', gradientEnabled: true,
      glassBg: 'linear-gradient(150deg, rgba(255,255,255,0.84), rgba(255,226,229,0.68) 48%, rgba(255,188,199,0.44) 100%)',
      glassBorder: 'rgba(226,97,121,0.34)', glassShadow: '0 26px 60px -34px rgba(220,38,38,0.34), 0 14px 26px -20px rgba(158,34,70,0.18)',
    },
    dark: {
      bg: '#210910', surface: '#32121B', panel: '#431A26', border: '#6A2F3D', text: '#FFEAF0',
      muted: '#E0B1BE', primary: '#FB7185', secondary: '#F43F5E', tertiary: '#EF4444',
      textOnAccent: '#2A0912', gradientEnabled: true,
      glassBg: 'linear-gradient(150deg, rgba(67,26,38,0.72), rgba(33,9,16,0.56))',
      glassBorder: 'rgba(255,188,201,0.18)', glassShadow: '0 18px 48px -30px rgba(244,63,94,0.32)',
    },
  },
};

const hexToRgba = (hex, alpha = 1) => {
  const safe = String(hex || '#E67E22').trim().replace('#', '');
  const r = parseInt(safe.slice(0, 2), 16) || 0;
  const g = parseInt(safe.slice(2, 4), 16) || 0;
  const b = parseInt(safe.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const applyPageTheme = (themeConfig) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (themeConfig.bg) root.style.setProperty('--c-bg', themeConfig.bg);
  if (themeConfig.surface) root.style.setProperty('--c-surface', themeConfig.surface);
  if (themeConfig.panel) root.style.setProperty('--c-panel', themeConfig.panel);
  if (themeConfig.border) root.style.setProperty('--c-border', themeConfig.border);
  if (themeConfig.text) root.style.setProperty('--c-text', themeConfig.text);
  if (themeConfig.muted) root.style.setProperty('--c-muted', themeConfig.muted);
  root.style.setProperty('--c-accent', themeConfig.primary);
  root.style.setProperty('--c-accent-2', themeConfig.secondary);
  root.style.setProperty('--c-accent-3', themeConfig.tertiary);
  root.style.setProperty('--c-on-accent', themeConfig.textOnAccent);
  root.style.setProperty('--c-ring', hexToRgba(themeConfig.primary, 0.24));
  root.style.setProperty(
    '--brand-gradient',
    themeConfig.gradientEnabled
      ? `linear-gradient(125deg, ${themeConfig.primary} 0%, ${themeConfig.secondary} 54%, ${themeConfig.tertiary} 100%)`
      : themeConfig.primary,
  );
  if (themeConfig.glassBg) root.style.setProperty('--glass-bg', themeConfig.glassBg);
  if (themeConfig.glassBorder) root.style.setProperty('--glass-border', themeConfig.glassBorder);
  if (themeConfig.glassShadow) root.style.setProperty('--glass-shadow', themeConfig.glassShadow);
  if (themeConfig.glassBlur) root.style.setProperty('--glass-blur', themeConfig.glassBlur);
};

export const ThemeProvider = ({ children }) => {
  const [scope, setScope] = useState(getThemeScope);
  const [theme, setTheme] = useState(() => getInitialTheme(getThemeScope()));
  const [systemDark, setSystemDark] = useState(() => window.matchMedia(SYSTEM_THEME_QUERY).matches);
  const [appearance, setAppearance] = useState(() => readDesktopAppearance());

  useEffect(() => {
    const media = window.matchMedia(SYSTEM_THEME_QUERY);
    const onChange = (event) => setSystemDark(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const onResize = () => {
      setScope((current) => {
        const next = getThemeScope();
        return current === next ? current : next;
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    setTheme(getInitialTheme(scope));
  }, [scope]);

  useEffect(() => {
    const syncAppearance = () => setAppearance(readDesktopAppearance());
    window.addEventListener('storage', syncAppearance);
    window.addEventListener(DESKTOP_APPEARANCE_EVENT, syncAppearance);
    return () => {
      window.removeEventListener('storage', syncAppearance);
      window.removeEventListener(DESKTOP_APPEARANCE_EVENT, syncAppearance);
    };
  }, []);

  const resolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.dataset.fontFamily = appearance.fontFamily;
    root.dataset.fontScale = appearance.fontScale;
    root.dataset.glass = appearance.glassEnabled ? 'on' : 'off';
    
    // Apply preset colors
    const themeVariant = resolvedTheme === 'dark' ? 'dark' : 'light';
    const config = DESKTOP_APPEARANCE_THEME_MAP[appearance.wallpaper]?.[themeVariant] 
      || DESKTOP_APPEARANCE_THEME_MAP.aurora[themeVariant];
    
    // Final glass adjustments
    const finalConfig = appearance.glassEnabled === false
      ? {
          ...config,
          glassBlur: '0px',
          glassBg: themeVariant === 'dark' ? 'rgba(34, 24, 18, 0.96)' : 'rgba(255, 251, 245, 0.97)',
          glassBorder: themeVariant === 'dark' ? 'rgba(116, 88, 67, 0.78)' : 'rgba(224, 198, 166, 0.86)',
          glassShadow: themeVariant === 'dark' ? '0 14px 34px -28px rgba(0, 0, 0, 0.48)' : '0 16px 34px -28px rgba(148, 85, 19, 0.16)',
        }
      : config;

    applyPageTheme(finalConfig);

    localStorage.setItem(getStorageKeyForScope(scope), theme);
    localStorage.setItem(THEME_STORAGE_KEY_LEGACY, theme);
  }, [scope, theme, resolvedTheme, appearance]);

  const updateAppearance = useCallback((patch) => {
    setAppearance((current) => {
      const next = saveDesktopAppearance({ ...current, ...patch });
      return next;
    });
  }, []);

  const value = useMemo(() => {
    const isDark = resolvedTheme === 'dark';
    return {
      theme,
      resolvedTheme,
      isDark,
      setTheme,
      appearance,
      updateAppearance,
      DESKTOP_WALLPAPERS,
      DESKTOP_FONT_FAMILIES,
      DESKTOP_FONT_SCALES,
      toggleTheme: () =>
        setTheme((current) => {
          const currentResolved = current === 'system' ? (systemDark ? 'dark' : 'light') : current;
          return currentResolved === 'dark' ? 'light' : 'dark';
        }),
    };
  }, [theme, resolvedTheme, systemDark, appearance, updateAppearance]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
