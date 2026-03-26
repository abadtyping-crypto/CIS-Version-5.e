import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { NAV_ITEMS } from '../../config/appNavigation';
import { getCachedSystemAssetsSnapshot, getSystemAssets } from '../../lib/systemAssetsCache';
import { resolvePageIconUrl } from '../../lib/pageIconAssets';
import '../../styles/desktop/layout.css';

const TRANSITION_DURATION_MS = 850;
const DEFAULT_PAGE_ICON = '/ACIS Icon/appIconx64.png';
const HUB_LOGO_ICON = '/ACIS Icon/appIconx256.png';
const STATIC_PAGE_ORDER = ['dashboard', 'quotations', 'proforma-invoices', 'portal-management', 'tasks-tracking'];

const STATUS_BY_ROUTE = Object.freeze({
  dashboard: 'Opening Dashboard',
  settings: 'Opening Settings Studio',
  'client-onboarding': 'Preparing Client Workspace',
  'daily-transactions': 'Syncing Transaction Workspace',
  'tasks-tracking': 'Connecting Task Workspace',
  quotations: 'Preparing Quotation Workspace',
  'proforma-invoices': 'Preparing Proforma Workspace',
  'receive-payments': 'Opening Receive Payments Workspace',
  'invoice-management': 'Loading Invoice Workspace',
  'operation-expenses': 'Loading Operation Expense Workspace',
  'portal-management': 'Loading Portal Workspace',
  'document-calendar': 'Opening Document Calendar',
  notifications: 'Refreshing Notifications',
  profile: 'Opening Profile Workspace',
});

const NAV_ROUTE_MAP = NAV_ITEMS.reduce((acc, item) => {
  acc[item.path] = {
    key: item.key,
    label: item.label,
    status: STATUS_BY_ROUTE[item.path] || `Opening ${item.label}`,
  };
  return acc;
}, {});

const EXTRA_ROUTE_MAP = Object.freeze({
  settings: {
    key: 'settings',
    label: 'Settings',
    status: STATUS_BY_ROUTE.settings,
  },
  notifications: {
    key: 'notifications',
    label: 'Notifications',
    status: STATUS_BY_ROUTE.notifications,
  },
  profile: {
    key: 'dashboard',
    label: 'Profile',
    status: STATUS_BY_ROUTE.profile,
  },
});

const normalizeRoutePath = (pathname = '') => {
  const segments = String(pathname || '').split('/').filter(Boolean);
  const appSegments = segments[0] === 't' ? segments.slice(2) : segments;
  const [head = 'dashboard'] = appSegments;

  if (!head || head === 'login') return '';
  if (head === 'clients') return 'client-onboarding';
  if (head === 'portal-management') return 'portal-management';
  if (head === 'profile') return 'profile';
  return head;
};

const resolveRouteMeta = (routePath = '') => {
  if (!routePath) return null;
  return NAV_ROUTE_MAP[routePath] || EXTRA_ROUTE_MAP[routePath] || {
    key: 'dashboard',
    label: routePath
      .split('-')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' '),
    status: 'Connecting Workspace',
  };
};

const resolveNodeIcon = (routeMeta, routePath, systemAssets) => {
  const byPageKey = resolvePageIconUrl(systemAssets, routeMeta?.key || '');
  if (byPageKey) return byPageKey;

  if (routePath === 'settings') return resolvePageIconUrl(systemAssets, 'settings') || DEFAULT_PAGE_ICON;
  if (routePath === 'notifications') return resolvePageIconUrl(systemAssets, 'notifications') || DEFAULT_PAGE_ICON;
  return DEFAULT_PAGE_ICON;
};

const createNode = (routePath, systemAssets) => {
  const meta = resolveRouteMeta(routePath);
  if (!meta) {
    return {
      id: 'dashboard',
      label: 'Dashboard',
      status: STATUS_BY_ROUTE.dashboard,
      icon: DEFAULT_PAGE_ICON,
    };
  }

  return {
    id: routePath,
    label: meta.label,
    status: meta.status,
    icon: resolveNodeIcon(meta, routePath, systemAssets),
  };
};

const getRelevantPages = (currentRoutePath, systemAssets) => {
  const ordered = ['dashboard', currentRoutePath, ...STATIC_PAGE_ORDER].filter(Boolean);
  const unique = [];

  ordered.forEach((routePath) => {
    if (!unique.includes(routePath)) unique.push(routePath);
  });

  while (unique.length < 4) {
    unique.push('dashboard');
  }

  return unique.slice(0, 4).map((routePath) => createNode(routePath, systemAssets));
};

const PageTransitionOverlay = () => {
  const location = useLocation();
  const [active, setActive] = useState(false);
  const [systemAssets, setSystemAssets] = useState(() => getCachedSystemAssetsSnapshot());
  const previousPathRef = useRef(location.pathname);

  const currentRoutePath = useMemo(() => normalizeRoutePath(location.pathname), [location.pathname]);

  const currentPage = useMemo(() => createNode(currentRoutePath, systemAssets), [currentRoutePath, systemAssets]);
  const currentPages = useMemo(
    () => getRelevantPages(currentRoutePath, systemAssets),
    [currentRoutePath, systemAssets],
  );

  useEffect(() => {
    let mounted = true;

    getSystemAssets({ forceRefresh: true })
      .then((snapshot) => {
        if (!mounted) return;
        setSystemAssets(snapshot || {});
      })
      .catch(() => {
        // Use cached/default icons when system assets are unavailable.
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!currentRoutePath) return;

    if (location.pathname === previousPathRef.current) return;
    previousPathRef.current = location.pathname;

    const activateTimer = window.setTimeout(() => {
      setActive(true);
    }, 0);

    const deactivateTimer = window.setTimeout(() => {
      setActive(false);
    }, TRANSITION_DURATION_MS);

    return () => {
      window.clearTimeout(activateTimer);
      window.clearTimeout(deactivateTimer);
    };
  }, [currentRoutePath, location.pathname]);

  if (!currentRoutePath) return null;

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-300 ${
        active ? 'opacity-100' : 'opacity-0'
      }`}
      style={{
        background:
          'radial-gradient(circle at center, color-mix(in srgb, var(--c-bg) 18%, rgba(3, 7, 18, 0.84)) 0%, rgba(2, 6, 23, 0.97) 100%)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
      aria-hidden={!active}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="ultra-container">
          <svg viewBox="0 0 700 300" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="docGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="100%" stopColor="#D0E3F7" />
              </linearGradient>
              <linearGradient id="arrowGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--c-accent)" />
                <stop offset="100%" stopColor="var(--c-accent-2)" />
              </linearGradient>
              <linearGradient id="laserGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(0, 240, 255, 0)" />
                <stop offset="80%" stopColor="rgba(0, 240, 255, 0.2)" />
                <stop offset="100%" stopColor="rgba(0, 240, 255, 1)" />
              </linearGradient>
              <linearGradient id="shineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                <stop offset="50%" stopColor="rgba(255,255,255,0.9)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </linearGradient>
              <filter id="proShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#000000" floodOpacity="0.5" />
              </filter>
              <filter id="glowNode" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            <g id="networkLinks">
              <path className="net-link" d="M 290 105 L 230 105 L 180 75 L 155 75" />
              <path className="net-packet-out" style={{ animationDelay: '0s' }} d="M 290 105 L 230 105 L 180 75 L 155 75" />
              <path className="net-packet-in" style={{ animationDelay: '1.2s' }} d="M 290 105 L 230 105 L 180 75 L 155 75" />
              <path className="net-link" d="M 290 195 L 230 195 L 180 225 L 155 225" />
              <path className="net-packet-out" style={{ animationDelay: '0.5s' }} d="M 290 195 L 230 195 L 180 225 L 155 225" />
              <path className="net-link" d="M 410 105 L 470 105 L 520 75 L 545 75" />
              <path className="net-packet-out" style={{ animationDelay: '0.8s' }} d="M 410 105 L 470 105 L 520 75 L 545 75" />
              <path className="net-packet-in" style={{ animationDelay: '0.2s' }} d="M 410 105 L 470 105 L 520 75 L 545 75" />
              <path className="net-link" d="M 410 195 L 470 195 L 520 225 L 545 225" />
              <path className="net-packet-out" style={{ animationDelay: '0.3s' }} d="M 410 195 L 470 195 L 520 225 L 545 225" />
            </g>

            <g transform="translate(120, 75)">
              <circle cx="0" cy="0" r="30" className="sat-bg" filter="url(#glowNode)" />
              <circle cx="0" cy="0" r="36" className="sat-ring" />
              <image href={currentPages[0]?.icon || DEFAULT_PAGE_ICON} x="-16" y="-16" width="32" height="32" preserveAspectRatio="xMidYMid meet" />
              <text x="0" y="55" textAnchor="middle" className="sat-text">{currentPages[0]?.label || 'Dashboard'}</text>
            </g>
            <g transform="translate(120, 225)">
              <circle cx="0" cy="0" r="30" className="sat-bg" filter="url(#glowNode)" />
              <circle cx="0" cy="0" r="36" className="sat-ring reverse" />
              <image href={currentPages[1]?.icon || DEFAULT_PAGE_ICON} x="-16" y="-16" width="32" height="32" preserveAspectRatio="xMidYMid meet" />
              <text x="0" y="55" textAnchor="middle" className="sat-text">{currentPages[1]?.label || 'Workspace'}</text>
            </g>
            <g transform="translate(580, 75)">
              <circle cx="0" cy="0" r="30" className="sat-bg" filter="url(#glowNode)" />
              <circle cx="0" cy="0" r="36" className="sat-ring reverse" />
              <image href={currentPages[2]?.icon || DEFAULT_PAGE_ICON} x="-16" y="-16" width="32" height="32" preserveAspectRatio="xMidYMid meet" />
              <text x="0" y="55" textAnchor="middle" className="sat-text">{currentPages[2]?.label || 'Quotations'}</text>
            </g>
            <g transform="translate(580, 225)">
              <circle cx="0" cy="0" r="30" className="sat-bg" filter="url(#glowNode)" />
              <circle cx="0" cy="0" r="36" className="sat-ring" />
              <image href={currentPages[3]?.icon || DEFAULT_PAGE_ICON} x="-16" y="-16" width="32" height="32" preserveAspectRatio="xMidYMid meet" />
              <text x="0" y="55" textAnchor="middle" className="sat-text">{currentPages[3]?.label || 'Portals'}</text>
            </g>

            <g transform="translate(250, 50)" className="core-breathe">
              <path className="tech-base" d="M100 20 L160 55 L160 145 L100 180 L40 145 L40 55 Z" />
              <path className="tech-base" d="M100 40 L140 65 L140 135 L100 160 L60 135 L60 65 Z" />
              <path className="tech-base" d="M40 55 L60 65 M160 55 L140 65 M160 145 L140 135 M40 145 L60 135 M100 20 L100 40 M100 180 L100 160" />
              <g>
                <path d="M70 50 L115 50 L135 70 L135 150 L70 150 Z" fill="url(#docGrad)" filter="url(#proShadow)" />
                <path d="M115 50 L115 70 L135 70 Z" fill="#A8C9ED" />
                <rect x="80" y="80" width="40" height="4" rx="2" fill="var(--c-accent)" opacity="0.3" />
                <rect x="80" y="95" width="40" height="4" rx="2" fill="var(--c-accent)" opacity="0.3" />
                <rect x="80" y="110" width="30" height="4" rx="2" fill="var(--c-accent)" opacity="0.3" />
                <rect x="70" y="0" width="65" height="15" className="laser-scanner" />
                <path className="pulse-arrow" d="M102 10 L120 30 L108 30 L108 45 L96 45 L96 30 L84 30 Z" fill="url(#arrowGrad)" />
                <path className="pulse-arrow" style={{ animationDelay: '0.5s' }} d="M90 140 L155 75 L155 105 L120 140 Z" fill="url(#arrowGrad)" filter="url(#proShadow)" />
              </g>
              <g>
                <circle cx="155" cy="150" r="20" fill="#002B7F" stroke="var(--c-accent)" strokeWidth="3" filter="url(#proShadow)" />
                <path className="badge-ring" d="M155 130 A20 20 0 0 1 175 150" fill="none" stroke="#00f0ff" strokeWidth="4" strokeLinecap="round" />
                <path className="badge-ring" style={{ animationDirection: 'reverse', animationDuration: '3s' }} d="M155 170 A20 20 0 0 1 135 150" fill="none" stroke="var(--c-accent-2)" strokeWidth="2" strokeLinecap="round" />
                <path className="badge-check" d="M145 150 L152 157 L165 142" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              </g>
              <g transform="translate(25, 135)">
                <image href={HUB_LOGO_ICON} x="-8" y="-10" width="96" height="54" clipPath="url(#pillClipTransition)" preserveAspectRatio="xMidYMid meet" />
                <rect width="80" height="34" rx="12" fill="none" stroke="var(--c-accent)" strokeWidth="2" filter="url(#proShadow)" />
                <clipPath id="pillClipTransition"><rect width="80" height="34" rx="12" /></clipPath>
                <rect width="40" height="40" y="-5" fill="url(#shineGrad)" clipPath="url(#pillClipTransition)" className="pill-shine" transform="skewX(-20)" />
              </g>
            </g>
          </svg>
        </div>
        <div className="system-status">{currentPage.status || 'Connecting Workspace'}</div>
      </div>
    </div>
  );
};

export default PageTransitionOverlay;
