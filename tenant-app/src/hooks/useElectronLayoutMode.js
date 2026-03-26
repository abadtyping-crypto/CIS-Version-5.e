import { useCallback, useEffect, useRef, useState } from 'react';
import { getRuntimePlatform, PLATFORM_ELECTRON } from '../lib/runtimePlatform';

/**
 * Layout mode tiers for Electron desktop window.
 * On non-Electron platforms this hook always returns 'wide' (no change).
 *
 *  mini     : 350 – 500 px   → sidebar hidden, overlay on demand
 *  compact  : 500 – 768 px   → sidebar force-collapsed (icon-only)
 *  standard : 768 – 1200 px  → sidebar collapsed by default, toggleable
 *  wide     : 1200 px +      → sidebar honours saved preference
 */
export const LAYOUT_MINI = 'mini';
export const LAYOUT_COMPACT = 'compact';
export const LAYOUT_STANDARD = 'standard';
export const LAYOUT_WIDE = 'wide';

export const modeToDensityTier = (mode) => {
  if (mode === LAYOUT_MINI || mode === LAYOUT_COMPACT) return 'compact-tight';
  if (mode === LAYOUT_WIDE) return 'compact-wide';
  return 'compact-standard';
};

const widthToMode = (width) => {
  if (width < 500) return LAYOUT_MINI;
  if (width < 768) return LAYOUT_COMPACT;
  if (width < 1200) return LAYOUT_STANDARD;
  return LAYOUT_WIDE;
};

const useElectronLayoutMode = () => {
  const isElectron = getRuntimePlatform() === PLATFORM_ELECTRON;

  const [overrideMode, setOverrideMode] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('acis_layout_mode_override') || null;
    }
    return null;
  });

  const [autoMode, setAutoMode] = useState(() => {
    if (!isElectron) return LAYOUT_WIDE;
    if (typeof window === 'undefined') return LAYOUT_WIDE;
    return widthToMode(window.innerWidth);
  });

  const timerRef = useRef(null);
  const DEBOUNCE_MS = 120;

  const handleResize = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setAutoMode(widthToMode(window.innerWidth));
    }, DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    if (!isElectron) return;

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isElectron, handleResize]);

  const setMode = useCallback((newMode) => {
    if (newMode) {
      localStorage.setItem('acis_layout_mode_override', newMode);
      setOverrideMode(newMode);
    } else {
      localStorage.removeItem('acis_layout_mode_override');
      setOverrideMode(null);
    }
  }, []);

  const activeMode = !isElectron ? LAYOUT_WIDE : (overrideMode || autoMode);

  return { layoutMode: activeMode, setMode, autoMode, overrideMode };
};

export default useElectronLayoutMode;
