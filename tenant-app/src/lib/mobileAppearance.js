export const MOBILE_APPEARANCE_STORAGE_KEY = 'acis_mobile_appearance_v1';
export const MOBILE_APPEARANCE_EVENT = 'acis-mobile-appearance-change';

export const MOBILE_WALLPAPERS = [
  { id: 'aurora', label: 'Aurora' },
  { id: 'midnight', label: 'Midnight' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'sunrise', label: 'Sunrise' },
];

export const MOBILE_ICON_STYLES = [
  { id: 'glass', label: 'Glass' },
  { id: 'filled', label: 'Filled' },
  { id: 'minimal', label: 'Minimal' },
];

const defaultAppearance = {
  wallpaper: 'aurora',
  iconStyle: 'glass',
};

const sanitizeWallpaper = (value) => {
  const candidate = String(value || '').trim().toLowerCase();
  return MOBILE_WALLPAPERS.some((item) => item.id === candidate) ? candidate : defaultAppearance.wallpaper;
};

const sanitizeIconStyle = (value) => {
  const candidate = String(value || '').trim().toLowerCase();
  return MOBILE_ICON_STYLES.some((item) => item.id === candidate) ? candidate : defaultAppearance.iconStyle;
};

export const readMobileAppearance = () => {
  if (typeof window === 'undefined') return defaultAppearance;
  try {
    const raw = window.localStorage.getItem(MOBILE_APPEARANCE_STORAGE_KEY);
    if (!raw) return defaultAppearance;
    const parsed = JSON.parse(raw);
    return {
      wallpaper: sanitizeWallpaper(parsed?.wallpaper),
      iconStyle: sanitizeIconStyle(parsed?.iconStyle),
    };
  } catch {
    return defaultAppearance;
  }
};

export const saveMobileAppearance = (nextAppearance) => {
  if (typeof window === 'undefined') return defaultAppearance;
  const normalized = {
    wallpaper: sanitizeWallpaper(nextAppearance?.wallpaper),
    iconStyle: sanitizeIconStyle(nextAppearance?.iconStyle),
  };
  window.localStorage.setItem(MOBILE_APPEARANCE_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(MOBILE_APPEARANCE_EVENT, { detail: normalized }));
  return normalized;
};

export const DESKTOP_APPEARANCE_EVENT = 'acis-desktop-appearance-change';

export const DESKTOP_WALLPAPERS = [
  { id: 'aurora', label: 'Aurora' },
  { id: 'midnight', label: 'Midnight' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'sunrise', label: 'Sunrise' },
  { id: 'ember', label: 'Ember' },
  { id: 'sandstone', label: 'Sandstone' },
  { id: 'slate', label: 'Slate' },
  { id: 'forest', label: 'Forest' },
];

export const DESKTOP_FONT_FAMILIES = [
  { id: 'jakarta', label: 'Jakarta Sans' },
  { id: 'system', label: 'System UI' },
  { id: 'serif', label: 'Editorial Serif' },
  { id: 'humanist', label: 'Humanist' },
  { id: 'rounded', label: 'Rounded UI' },
  { id: 'mono', label: 'Mono' },
];

export const DESKTOP_FONT_SCALES = [
  { id: 'compact', label: 'Compact' },
  { id: 'standard', label: 'Standard' },
  { id: 'comfortable', label: 'Comfortable' },
];

const defaultDesktopAppearance = {
  mode: 'preset',
  wallpaper: 'aurora',
  customWallpaperUrl: '',
  glassEnabled: true,
  fontFamily: 'jakarta',
  fontScale: 'standard',
};

const sanitizeDesktopWallpaper = (value) => {
  const candidate = String(value || '').trim().toLowerCase();
  return DESKTOP_WALLPAPERS.some((item) => item.id === candidate) ? candidate : defaultDesktopAppearance.wallpaper;
};

const sanitizeDesktopFontFamily = (value) => {
  const candidate = String(value || '').trim().toLowerCase();
  return DESKTOP_FONT_FAMILIES.some((item) => item.id === candidate) ? candidate : defaultDesktopAppearance.fontFamily;
};

const sanitizeDesktopFontScale = (value) => {
  const candidate = String(value || '').trim().toLowerCase();
  return DESKTOP_FONT_SCALES.some((item) => item.id === candidate) ? candidate : defaultDesktopAppearance.fontScale;
};

export const readDesktopAppearance = () => {
  if (typeof window === 'undefined') return defaultDesktopAppearance;
  try {
    const raw = window.localStorage.getItem('acis_desktop_appearance_v1');
    if (!raw) return defaultDesktopAppearance;
    const parsed = JSON.parse(raw);
    return {
      mode: parsed?.mode === 'custom' ? 'custom' : 'preset',
      wallpaper: sanitizeDesktopWallpaper(parsed?.wallpaper),
      customWallpaperUrl: parsed?.customWallpaperUrl || '',
      glassEnabled: parsed?.glassEnabled !== false,
      fontFamily: sanitizeDesktopFontFamily(parsed?.fontFamily),
      fontScale: sanitizeDesktopFontScale(parsed?.fontScale),
    };
  } catch {
    return defaultDesktopAppearance;
  }
};

export const saveDesktopAppearance = (nextAppearance) => {
  if (typeof window === 'undefined') return defaultDesktopAppearance;
  const normalized = {
    mode: nextAppearance?.mode === 'custom' ? 'custom' : 'preset',
    wallpaper: sanitizeDesktopWallpaper(nextAppearance?.wallpaper),
    customWallpaperUrl: nextAppearance?.customWallpaperUrl || '',
    glassEnabled: nextAppearance?.glassEnabled !== false,
    fontFamily: sanitizeDesktopFontFamily(nextAppearance?.fontFamily),
    fontScale: sanitizeDesktopFontScale(nextAppearance?.fontScale),
  };
  window.localStorage.setItem('acis_desktop_appearance_v1', JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent('acis-desktop-appearance-change', { detail: normalized }));
  return normalized;
};

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(new Error('Unable to read wallpaper image.'));
  reader.readAsDataURL(file);
});

export const saveDesktopWallpaperFile = async (file) => {
  if (!file) return { ok: false, error: 'No wallpaper file selected.' };
  if (!file.type.startsWith('image/')) return { ok: false, error: 'Please select an image file.' };
  if (file.size > 2 * 1024 * 1024) return { ok: false, error: 'Wallpaper must be 2 MB or less.' };
  const currentAppearance = readDesktopAppearance();

  const hasElectronSaver = Boolean(window.electron?.desktopAppearance?.saveWallpaper);
  if (hasElectronSaver) {
    const dataUrl = await readFileAsDataUrl(file);
    const saveResult = await window.electron.desktopAppearance.saveWallpaper({
      fileName: file.name,
      dataUrl,
    });
    if (!saveResult?.ok || !saveResult?.fileUrl) {
      return { ok: false, error: saveResult?.error || 'Unable to store wallpaper file.' };
    }
    const appearance = saveDesktopAppearance({
      ...currentAppearance,
      mode: 'custom',
      wallpaper: currentAppearance.wallpaper || defaultDesktopAppearance.wallpaper,
      customWallpaperUrl: saveResult.fileUrl,
    });
    return { ok: true, appearance };
  }

  const dataUrl = await readFileAsDataUrl(file);
  if (!dataUrl.startsWith('data:image/')) {
    return { ok: false, error: 'Unable to read wallpaper image.' };
  }
  const appearance = saveDesktopAppearance({
    ...currentAppearance,
    mode: 'custom',
    wallpaper: currentAppearance.wallpaper || defaultDesktopAppearance.wallpaper,
    customWallpaperUrl: dataUrl,
  });
  return { ok: true, appearance };
};
