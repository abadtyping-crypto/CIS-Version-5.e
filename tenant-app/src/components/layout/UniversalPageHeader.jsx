import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import { fetchGlobalHeaderConfig } from '../../lib/backendStore';
import { NAV_ITEMS } from '../../config/appNavigation';
import { resolvePageIconUrl } from '../../lib/pageIconAssets';
import { DynamicAppIcon } from '../icons/AppIcons';
import PageInstructionOverlay from './PageInstructionOverlay';

const EMPTY_OBJ = Object.freeze({});

/**
 * UniversalPageHeader Component
 * Fetches page identity data from 'global_header_configs' collection and renders a premium card-style header.
 * 
 * @param {string} pageID - The unique ID matching the Firestore document in 'global_header_configs'.
 */
const UniversalPageHeader = ({
  pageID,
  title,
  subtitle,
  icon: Icon,
  iconKey,
  actionSlot,
  enableRemoteConfig = true,
}) => {
  const [loading, setLoading] = useState(Boolean(enableRemoteConfig && pageID));
  const [config, setConfig] = useState(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const outletContext = useOutletContext();
  const systemAssets = outletContext?.systemAssets || EMPTY_OBJ;

  const fallbackConfig = useMemo(() => {
    const safePageID = String(pageID || '').trim();
    const safeTitle = String(title || '').trim();
    const safeSubtitle = String(subtitle || '').trim();
    const fallbackKey = String(iconKey || '').trim();

    if (!safePageID && !safeTitle) return null;

    const navMatch =
      NAV_ITEMS.find((item) => item.path === safePageID) ||
      NAV_ITEMS.find((item) => item.key === safePageID) ||
      NAV_ITEMS.find((item) => item.icon === safePageID) ||
      (fallbackKey ? NAV_ITEMS.find((item) => item.key === fallbackKey || item.icon === fallbackKey) : null);

    const humanized = (safePageID || safeTitle)
      .replace(/^\/+/, '')
      .replace(/\/+$/, '')
      .split(/[-_/]+/g)
      .filter(Boolean)
      .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
      .join(' ');

    const titleText = safeTitle || (navMatch?.key === 'dashboard' ? 'Dashboard' : (navMatch?.label || humanized || 'Page'));
    const descriptionText = safeSubtitle || navMatch?.description || '';
    const effectiveIconKey = fallbackKey || navMatch?.icon || '';

    return {
      titleText,
      descriptionText,
      iconUrl: effectiveIconKey ? resolvePageIconUrl(systemAssets, effectiveIconKey) : '',
      iconKey: effectiveIconKey,
      instructionID: '',
      isHelpEnabled: false,
    };
  }, [pageID, title, subtitle, iconKey, systemAssets]);

  useEffect(() => {
    if (!enableRemoteConfig) return;
    if (!pageID) return;
    let active = true;
    void (async () => {
      setLoading(true);
      const res = await fetchGlobalHeaderConfig(pageID);
      if (!active) return;
      if (res.ok) setConfig(res.data);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [enableRemoteConfig, pageID]);

  if (loading) {
    return (
      <header className="mb-4 flex h-20 w-full animate-pulse gap-0 overflow-hidden rounded-2xl bg-[var(--c-surface)] ring-1 ring-inset ring-[var(--c-border)] sm:h-24 md:h-28">
        <div className="h-full w-20 bg-[var(--c-panel)] sm:w-24 md:w-28" />
        <div className="flex flex-1 flex-col justify-center px-6 space-y-2">
          <div className="h-4 w-1/4 rounded-full bg-[var(--c-panel)]" />
          <div className="h-3 w-1/2 rounded-full bg-[var(--c-panel)] opacity-60" />
        </div>
      </header>
    );
  }

  const effectiveConfig = config || fallbackConfig;
  if (!effectiveConfig) return null;

  const instructionID = String(effectiveConfig.instructionID || '').trim();
  const helpEnabled = effectiveConfig.isHelpEnabled !== false;

  return (
    <>
      <header className="group mb-4 flex w-full flex-row items-stretch gap-0 overflow-hidden rounded-2xl bg-[var(--c-surface)] shadow-sm ring-1 ring-inset ring-[var(--c-border)] transition-all duration-300 hover:shadow-md sm:mb-5 lg:mb-6">
        {/* Icon Slot: Square Box (Left Side) */}
        <div className="relative w-20 shrink-0 bg-[var(--c-surface)] sm:w-24 md:w-28">
            {effectiveConfig.iconUrl ? (
              <img
                src={effectiveConfig.iconUrl}
                alt={effectiveConfig.titleText || 'Page Icon'}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                loading="lazy"
              />
            ) : effectiveConfig.iconKey ? (
              <div className="flex h-full w-full items-center justify-center bg-[var(--c-surface)]">
                <DynamicAppIcon
                  iconKey={effectiveConfig.iconKey}
                  className="h-full w-full p-3 text-[var(--c-accent)]"
                />
              </div>
            ) : Icon ? (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--c-accent)] to-[var(--c-accent-2)] text-white shadow-inner">
                <Icon className="h-10 w-10" strokeWidth={2.1} aria-hidden="true" />
              </div>
            ) : (
              <div className="flex w-full items-center justify-center bg-[color:color-mix(in_srgb,var(--c-accent)_20%,var(--c-surface))] text-[var(--c-accent)] shadow-inner">
                <span className="font-title text-2xl font-black uppercase tracking-tighter sm:text-3xl md:text-4xl">
                  {(effectiveConfig.titleText || 'A')[0]}
                </span>
              </div>
            )}
        </div>

        {/* Content Slot: Title & Subtitle (Right Side) */}
        <div className="flex min-w-0 flex-1 flex-col justify-center px-5 py-3 sm:px-8">
          <div className="flex items-center justify-between gap-3">
            <h1 className="truncate font-title text-xl font-black tracking-tight text-[var(--c-text)] sm:text-2xl md:text-[1.75rem] lg:text-[2.15rem]">
              {effectiveConfig.titleText}
            </h1>
            {actionSlot || helpEnabled ? (
              <div className="flex shrink-0 items-center gap-2">
                {actionSlot ? <div className="flex items-center">{actionSlot}</div> : null}
                {helpEnabled ? (
                  <button
                    type="button"
                    disabled={!instructionID}
                    onClick={() => setIsHelpOpen(true)}
                    className={`group/help flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-[var(--c-panel)] transition-all ${instructionID
                      ? 'border-[var(--c-border)] text-[var(--c-muted)] hover:scale-105 hover:border-[var(--c-accent)] hover:bg-[var(--c-accent-soft)] hover:text-[var(--c-accent)] active:scale-95'
                      : 'border-[var(--c-border)]/60 text-[var(--c-muted)]/50 opacity-70 cursor-not-allowed'
                      }`}
                    aria-label="Get page help"
                    title={instructionID ? 'Page Instructions' : 'No instructions configured'}
                  >
                    <HelpCircle className="h-5 w-5 transition-transform duration-300 group-hover/help:rotate-12" />
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          {effectiveConfig.descriptionText && (
            <p className="mt-0.5 line-clamp-1 text-[13px] font-semibold text-[var(--c-muted)] sm:mt-1 sm:text-sm lg:text-base">
              {effectiveConfig.descriptionText}
            </p>
          )}
        </div>
      </header>
      <PageInstructionOverlay
        open={isHelpOpen}
        instructionID={instructionID}
        onClose={() => setIsHelpOpen(false)}
      />
    </>
  );
};

export default UniversalPageHeader;
