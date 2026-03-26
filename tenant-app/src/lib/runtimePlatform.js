export const PLATFORM_WEB = 'web';
export const PLATFORM_ELECTRON = 'electron';

export const getRuntimePlatform = () => {
  if (typeof window === 'undefined') return PLATFORM_WEB;

  const hasElectronBridge = Boolean(window.electron?.windowControls);
  const ua = window.navigator?.userAgent || '';
  const hasElectronUserAgent = ua.toLowerCase().includes('electron');
  const hasElectronProcess = Boolean(window.process?.versions?.electron);

  if (hasElectronBridge || hasElectronUserAgent || hasElectronProcess) return PLATFORM_ELECTRON;
  return PLATFORM_WEB;
};
