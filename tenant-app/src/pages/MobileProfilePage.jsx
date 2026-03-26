import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import { useTheme } from '../context/useTheme';
import { useAuth } from '../context/useAuth';
import UserControlCenterSection from '../components/settings/UserControlCenterSection';
import {
  MOBILE_ICON_STYLES,
  MOBILE_WALLPAPERS,
  readMobileAppearance,
  saveDesktopWallpaperFile,
  saveMobileAppearance,
} from '../lib/mobileAppearance';
import { useState } from 'react';

const MobileProfilePage = () => {
  const { tenantId } = useParams();
  const navigate = useNavigate();
  const { logout } = useAuth();
  
  // theme: 'light' | 'dark' | 'system'
  // appearance: desktop appearance (wallpaper, font, glass)
  const { theme, resolvedTheme, setTheme, appearance: desktopAppearance, updateAppearance: updateDesktopAppearance, DESKTOP_WALLPAPERS } = useTheme();
  
  const [appearance, setAppearance] = useState(() => readMobileAppearance());

  const selectedWallpaperLabel = useMemo(
    () => MOBILE_WALLPAPERS.find((item) => item.id === appearance.wallpaper)?.label || 'Aurora',
    [appearance.wallpaper],
  );
  const selectedIconStyleLabel = useMemo(
    () => MOBILE_ICON_STYLES.find((item) => item.id === appearance.iconStyle)?.label || 'Glass',
    [appearance.iconStyle],
  );
  const selectedDesktopWallpaperLabel = useMemo(
    () => DESKTOP_WALLPAPERS.find((item) => item.id === desktopAppearance.wallpaper)?.label || 'Aurora',
    [desktopAppearance.wallpaper, DESKTOP_WALLPAPERS],
  );

  const updateMobileAppearance = (patch) => {
    const next = saveMobileAppearance({ ...appearance, ...patch });
    setAppearance(next);
  };

  const handleDesktopWallpaperUpload = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    void (async () => {
      const result = await saveDesktopWallpaperFile(file);
      if (!result.ok) return;
      // Note: saveDesktopWallpaperFile saves to localStorage and returns the new appearance.
      // We still want to update our context to reflect this.
      updateDesktopAppearance(result.appearance);
    })();
  };

  const handleLogout = () => {
    logout();
    navigate(`/t/${tenantId}/login`, { replace: true });
  };

  return (
    <PageShell title="Profile" subtitle="Mobile profile keeps essential controls and user access management.">
      <section className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
        <p className="text-sm font-semibold text-[var(--c-text)]">Theme</p>
        <p className="mt-1 text-xs text-[var(--c-muted)]">Choose default device theme behavior.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`rounded-lg px-3 py-2 text-xs font-semibold ${
              theme === 'light' ? 'mobile-profile-chip-active text-white' : 'bg-[var(--c-panel)] text-[var(--c-muted)]'
            }`}
          >
            Light
          </button>
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`rounded-lg px-3 py-2 text-xs font-semibold ${
              theme === 'dark' ? 'mobile-profile-chip-active text-white' : 'bg-[var(--c-panel)] text-[var(--c-muted)]'
            }`}
          >
            Dark
          </button>
          <button
            type="button"
            onClick={() => setTheme('system')}
            className={`rounded-lg px-3 py-2 text-xs font-semibold ${
              theme === 'system' ? 'mobile-profile-chip-active text-white' : 'bg-[var(--c-panel)] text-[var(--c-muted)]'
            }`}
          >
            System
          </button>
        </div>
        <p className="mt-2 text-xs text-[var(--c-muted)]">Current resolved theme: {resolvedTheme}</p>
      </section>

      <section className="mt-3 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
        <p className="text-sm font-semibold text-[var(--c-text)]">Mobile Appearance</p>
        <p className="mt-1 text-xs text-[var(--c-muted)]">Customize mobile-only wallpaper gradient and icon style.</p>

        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--c-muted)]">Wallpaper</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {MOBILE_WALLPAPERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => updateMobileAppearance({ wallpaper: item.id })}
                className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                  appearance.wallpaper === item.id
                    ? 'mobile-profile-chip-active text-white'
                    : 'bg-[var(--c-panel)] text-[var(--c-muted)]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-[var(--c-muted)]">Selected wallpaper: {selectedWallpaperLabel}</p>
        </div>

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--c-muted)]">Icon Style</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {MOBILE_ICON_STYLES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => updateMobileAppearance({ iconStyle: item.id })}
                className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                  appearance.iconStyle === item.id
                    ? 'mobile-profile-chip-active text-white'
                    : 'bg-[var(--c-panel)] text-[var(--c-muted)]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-[var(--c-muted)]">Selected icon style: {selectedIconStyleLabel}</p>
        </div>
      </section>

      <section className="mt-3 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
        <p className="text-sm font-semibold text-[var(--c-text)]">Edit Profile</p>
        <p className="mt-1 text-xs text-[var(--c-muted)]">Open edit page to update profile details.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate(`/t/${tenantId}/profile/edit`)}
            className="mobile-profile-chip-active rounded-xl px-4 py-2 text-sm font-semibold text-white"
          >
            Open Edit Page
          </button>
          <button
            type="button"
            onClick={() => navigate(`/t/${tenantId}/settings`)}
            className="rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-4 py-2 text-sm font-semibold text-[var(--c-text)]"
          >
            Open Full Settings
          </button>
        </div>
      </section>

      <section className="mt-3 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
        <p className="text-sm font-semibold text-[var(--c-text)]">User Control</p>
        <p className="mt-1 text-xs text-[var(--c-muted)]">Manage function access and notification rules.</p>
        <div className="mt-3">
          <UserControlCenterSection />
        </div>
      </section>

      <section className="mt-3 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
        <p className="text-sm font-semibold text-[var(--c-text)]">Desktop Wallpaper</p>
        <p className="mt-1 text-xs text-[var(--c-muted)]">Set desktop preset or upload your own wallpaper.</p>
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--c-muted)]">Preset</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DESKTOP_WALLPAPERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => updateDesktopAppearance({ wallpaper: item.id, mode: 'preset' })}
                className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                  desktopAppearance.mode === 'preset' && desktopAppearance.wallpaper === item.id
                    ? 'mobile-profile-chip-active text-white'
                    : 'bg-[var(--c-panel)] text-[var(--c-muted)]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-[var(--c-muted)]">
            Selected desktop wallpaper: {desktopAppearance.mode === 'custom' ? 'Custom' : selectedDesktopWallpaperLabel}
          </p>
        </div>

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--c-muted)]">Custom Upload</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2 text-xs font-semibold text-[var(--c-text)]">
              Upload Wallpaper
              <input
                type="file"
                accept="image/*"
                onChange={handleDesktopWallpaperUpload}
                className="hidden"
              />
            </label>
            {desktopAppearance.mode === 'custom' ? (
              <button
                type="button"
                onClick={() => updateDesktopAppearance({ mode: 'preset', customWallpaperUrl: '' })}
                className="rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2 text-xs font-semibold text-[var(--c-text)]"
              >
                Use Preset
              </button>
            ) : null}
          </div>
          <p className="mt-2 text-[11px] text-[var(--c-muted)]">Max upload size: 2 MB.</p>
        </div>
      </section>

      <section className="mt-3 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
        <p className="text-sm font-semibold text-[var(--c-text)]">Session</p>
        <p className="mt-1 text-xs text-[var(--c-muted)]">Sign out from this workspace session.</p>
        <div className="mt-3">
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300"
          >
            Logout
          </button>
        </div>
      </section>
    </PageShell>
  );
};

export default MobileProfilePage;
