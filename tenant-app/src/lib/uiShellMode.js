import { PLATFORM_ELECTRON, getRuntimePlatform } from './runtimePlatform';

export const SHELL_MODE_DESKTOP = 'desktop';
export const SHELL_MODE_MOBILE = 'mobile';

const SHELL_MODE_STORAGE_KEY = 'acis_ui_shell_mode';

const normalizeMode = (value) => {
  const mode = String(value || '').trim().toLowerCase();
  if (mode === SHELL_MODE_MOBILE) return SHELL_MODE_MOBILE;
  if (mode === SHELL_MODE_DESKTOP) return SHELL_MODE_DESKTOP;
  return '';
};

const readModeFromQuery = () => {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search || '');
  return normalizeMode(params.get('ui'));
};

const readModeFromStorage = () => {
  if (typeof window === 'undefined') return '';
  try {
    return normalizeMode(window.localStorage.getItem(SHELL_MODE_STORAGE_KEY));
  } catch {
    return '';
  }
};

const hasNativeMobileContainer = () => {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.Capacitor ||
      window.ReactNativeWebView ||
      window.webkit?.messageHandlers,
  );
};

export const getUiShellMode = () => {
  if (typeof window === 'undefined') return SHELL_MODE_DESKTOP;

  if (getRuntimePlatform() === PLATFORM_ELECTRON) return SHELL_MODE_DESKTOP;

  const fromQuery = readModeFromQuery();
  if (fromQuery) return fromQuery;

  const fromStorage = readModeFromStorage();
  if (fromStorage) return fromStorage;

  if (hasNativeMobileContainer()) return SHELL_MODE_MOBILE;

  return SHELL_MODE_DESKTOP;
};

