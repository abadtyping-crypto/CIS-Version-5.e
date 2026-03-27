import { useEffect, useMemo, useState } from 'react';
import { FileText, Megaphone, ExternalLink, X } from 'lucide-react';
import { collection, doc, limit, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../lib/firebaseConfig';

const TYPE_LABEL = {
  security_issue: 'Security Issues',
  system_maintenance: 'System Maintenance',
  common_wishes: 'Common Wishes',
  new_tools_launching: 'New Tools Launching',
  service_outage: 'Service Outage',
  bug_fix: 'Bug Fix',
  policy_update: 'Policy Update',
  general_notice: 'General Notice',
};

const TYPE_ACCENT = {
  security_issue: '#ef4444',
  system_maintenance: '#f97316',
  common_wishes: '#22c55e',
  new_tools_launching: '#3b82f6',
  service_outage: '#dc2626',
  bug_fix: '#06b6d4',
  policy_update: '#8b5cf6',
  general_notice: '#64748b',
};

const AppFooter = ({ appName = 'ACIS' }) => {
  const [controller, setController] = useState({
    title: appName,
    subtitle: 'Desktop Workspace',
    headerIcon: '',
    footerIcon: '',
    footerIconOpacity: 0.28,
    privacyPolicy: '',
    termsAndConditions: '',
  });
  const [legalModal, setLegalModal] = useState('');
  const [broadcasts, setBroadcasts] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'acis_system_assets', 'electron_controller'), (snap) => {
      const data = snap.data() || {};
      setController((prev) => ({
        ...prev,
        title: String(data.title || prev.title || appName),
        subtitle: String(data.subtitle || 'Desktop Workspace'),
        headerIcon: String(data.headerIcon || ''),
        footerIcon: String(data.footerIcon || ''),
        footerIconOpacity: Number(data.footerIconOpacity ?? prev.footerIconOpacity ?? 0.28),
        privacyPolicy: String(data.privacyPolicy || ''),
        termsAndConditions: String(data.termsAndConditions || ''),
      }));
    });
    return () => unsub();
  }, [appName]);

  useEffect(() => {
    const q = query(collection(db, 'acis_global_broadcasts'), limit(30));
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
      const toMillis = (value) => {
        if (!value) return 0;
        if (typeof value?.toMillis === 'function') return value.toMillis();
        const dt = new Date(value);
        const ms = dt.getTime();
        return Number.isFinite(ms) ? ms : 0;
      };
      const activeRows = rows
        .filter((item) => item?.isActive !== false)
        .sort((a, b) => toMillis(b.updatedAt || b.createdAt) - toMillis(a.updatedAt || a.createdAt))
        .slice(0, 10);
      setBroadcasts(activeRows);
    });
    return () => unsub();
  }, []);

  const visibleBroadcasts = useMemo(() => broadcasts, [broadcasts]);

  useEffect(() => {
    if (visibleBroadcasts.length <= 1) return undefined;
    const active = visibleBroadcasts[activeIndex % visibleBroadcasts.length] || {};
    const ms = Math.max(4000, Number(active.displayMs || active.rotateMs || 7000));
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % visibleBroadcasts.length);
    }, ms);
    return () => window.clearInterval(timer);
  }, [activeIndex, visibleBroadcasts]);

  const boundedIndex = visibleBroadcasts.length ? (activeIndex % visibleBroadcasts.length) : 0;
  const activeBroadcast = visibleBroadcasts[boundedIndex] || null;
  const iconSrc = String(controller.footerIcon || controller.headerIcon || '').trim() || '/ACIS Icon/appIconx64.png';
  const iconOpacity = Math.min(1, Math.max(0.05, Number(controller.footerIconOpacity) || 0.28));
  const canOpenPrivacy = Boolean(String(controller.privacyPolicy || '').trim());
  const canOpenTerms = Boolean(String(controller.termsAndConditions || '').trim());
  const hasFooterWatermark = Boolean(String(iconSrc || '').trim());
  const broadcastType = String(activeBroadcast?.type || 'general_notice').toLowerCase();
  const accent = TYPE_ACCENT[broadcastType] || TYPE_ACCENT.general_notice;
  const textColor = String(activeBroadcast?.fontColor || '').trim() || 'var(--c-text)';
  const badgeText = TYPE_LABEL[broadcastType] || activeBroadcast?.type || 'General Notice';
  const tickerText = [activeBroadcast?.title, activeBroadcast?.message].filter(Boolean).join(' - ');
  const hasLink = Boolean(String(activeBroadcast?.linkUrl || '').trim());
  const tickerSpeedSec = Math.max(8, Number(activeBroadcast?.speedSec || 22));

  return (
    <>
      <style>
        {`
          @keyframes acisTickerMove {
            0% { transform: translateX(0%); }
            100% { transform: translateX(-50%); }
          }
        `}
      </style>
      <footer className="desktop-footer z-[10] px-3 pb-3 pt-2" style={{ fontSize: '16px' }}>
        <div
          className={`glass flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-[var(--c-surface)]/60 backdrop-blur-xl ${
            hasFooterWatermark ? 'overflow-hidden pl-0 pr-3 sm:pr-3.5' : 'px-3 sm:px-3.5'
          }`}
          style={{ minHeight: '59px' }}
        >
          <div className={`flex min-w-0 items-center ${hasFooterWatermark ? 'gap-2' : 'gap-3'}`}>
            {hasFooterWatermark ? (
              <div className="h-[59px] w-52 shrink-0 overflow-hidden">
                <img src={iconSrc} alt={controller.title || appName} className="h-full w-full object-cover" style={{ opacity: iconOpacity }} />
              </div>
            ) : (
              <div className="h-10 w-10 overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[color:color-mix(in_srgb,white_90%,var(--c-surface)_10%)] shadow-sm">
                <img src={iconSrc} alt={controller.title || appName} className="h-full w-full object-cover scale-[1.08]" />
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-[1rem] font-semibold text-[var(--c-text)]">{controller.title || appName}</p>
              <p className="truncate text-xs text-[var(--c-muted)]">{controller.subtitle || 'Desktop Workspace'}</p>
            </div>
          </div>
          {activeBroadcast ? (
            <div className="mx-2 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => hasLink && window.open(String(activeBroadcast.linkUrl), '_blank', 'noopener,noreferrer')}
                className={`relative flex h-10 w-full items-center gap-2 overflow-hidden rounded-xl px-0 text-left ${
                  hasLink ? 'cursor-pointer' : 'cursor-default'
                }`}
                style={{ backgroundColor: 'transparent' }}
              >
                {activeBroadcast.imageUrl ? (
                  <div className="h-full w-14 shrink-0 overflow-hidden">
                    <img src={activeBroadcast.imageUrl} alt={badgeText} className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="flex h-full w-14 shrink-0 items-center justify-center" style={{ backgroundColor: `${accent}20` }}>
                    <Megaphone strokeWidth={1.5} className="h-4 w-4 shrink-0" style={{ color: accent }} />
                  </div>
                )}
                <span
                  className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider"
                  style={{ backgroundColor: `${accent}26`, color: accent }}
                >
                  {badgeText}
                </span>
                <div className="relative min-w-0 flex-1 overflow-hidden z-[1000]">
                  <div
                    className="inline-flex min-w-max items-center whitespace-nowrap font-semibold text-[var(--c-text)]"
                    style={{
                      animation: `acisTickerMove ${tickerSpeedSec}s linear infinite`,
                      color: textColor,
                    }}
                  >
                    <span className="pr-10">{tickerText || 'Global update posted.'}</span>
                    <span className="pr-10">{tickerText || 'Global update posted.'}</span>
                  </div>
                </div>
                {hasLink ? <ExternalLink strokeWidth={1.5} className="h-3.5 w-3.5 shrink-0 text-[var(--c-muted)]" /> : null}
              </button>
            </div>
          ) : null}
          <div className="shrink-0 text-[11px] font-semibold text-[var(--c-muted)]">
            <span
              className={`transition ${canOpenPrivacy ? 'cursor-pointer hover:text-[var(--c-text)]' : 'cursor-not-allowed opacity-60'}`}
              onClick={() => canOpenPrivacy && setLegalModal('privacy')}
            >
              Privacy Policy
            </span>
            <span className="px-2 opacity-60">|</span>
            <span
              className={`transition ${canOpenTerms ? 'cursor-pointer hover:text-[var(--c-text)]' : 'cursor-not-allowed opacity-60'}`}
              onClick={() => canOpenTerms && setLegalModal('terms')}
            >
              Terms & Conditions
            </span>
          </div>
        </div>
      </footer>

      {legalModal ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/55 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <p className="inline-flex items-center gap-2 text-sm font-black text-slate-800">
                <FileText strokeWidth={1.5} className="h-4 w-4 text-slate-600" />
                {legalModal === 'privacy' ? 'Privacy Policy' : 'Terms & Conditions'}
              </p>
              <button type="button" onClick={() => setLegalModal('')} className="rounded-lg border border-slate-200 p-1 text-slate-500 transition hover:text-slate-800">
                <X strokeWidth={1.5} className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[68vh] overflow-y-auto px-4 py-4">
              <p className="whitespace-pre-line text-sm font-semibold leading-6 text-slate-700">
                {legalModal === 'privacy' ? controller.privacyPolicy : controller.termsAndConditions}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default AppFooter;

