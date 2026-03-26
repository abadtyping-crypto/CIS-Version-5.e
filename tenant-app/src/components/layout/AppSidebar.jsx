import { useEffect, useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import {
  BellIcon,
  RecycleBinIcon,
  SettingsIcon,
  DashboardIcon,
  ClientOnboardingIcon,
  DailyTransactionsIcon,
  TasksTrackingIcon,
  QuotationsIcon,
  ProformaInvoicesIcon,
  ReceivePaymentsIcon,
  InvoiceManagementIcon,
  OperationExpensesIcon,
  PortalManagementIcon,
  DocumentCalendarIcon,
  DynamicAppIcon,
} from '../icons/AppIcons';
import { isVisibleOnPlatform, NAV_ITEMS } from '../../config/appNavigation';
import { getRuntimePlatform } from '../../lib/runtimePlatform';
import { useRecycleBin } from '../../context/useRecycleBin';
import { useRecycleBinSummary } from '../../hooks/useRecycleBinSummary';
import { getCachedSystemAssetsSnapshot, getSystemAssets } from '../../lib/systemAssetsCache';
import { resolvePageIconUrl } from '../../lib/pageIconAssets';

const getNavIconComponent = (iconKey) => {
  if (iconKey === 'dashboard') return DashboardIcon;
  if (iconKey === 'clientOnboarding') return ClientOnboardingIcon;
  if (iconKey === 'dailyTransactions') return DailyTransactionsIcon;
  if (iconKey === 'tasksTracking') return TasksTrackingIcon;
  if (iconKey === 'quotations') return QuotationsIcon;
  if (iconKey === 'proformaInvoices') return ProformaInvoicesIcon;
  if (iconKey === 'receivePayments') return ReceivePaymentsIcon;
  if (iconKey === 'invoiceManagement') return InvoiceManagementIcon;
  if (iconKey === 'operationExpenses') return OperationExpensesIcon;
  if (iconKey === 'portalManagement') return PortalManagementIcon;
  if (iconKey === 'documentCalendar') return DocumentCalendarIcon;
  if (iconKey === 'bell') return BellIcon;
  return null;
};

const SidebarIconTile = ({ children, accent = false, plain = false }) => (
  <span
    aria-hidden="true"
    className={`relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl ${plain
      ? ''
      : `border ${accent
        ? 'border-[color:color-mix(in_srgb,var(--c-accent)_26%,var(--c-border))] bg-[linear-gradient(155deg,color-mix(in_srgb,var(--c-surface)_92%,transparent),color-mix(in_srgb,var(--c-panel)_92%,transparent))] shadow-[inset_0_1px_0_rgba(255,255,255,0.58),0_14px_30px_-22px_color-mix(in_srgb,var(--c-accent)_48%,transparent)]'
        : 'border-[color:color-mix(in_srgb,var(--c-border)_82%,transparent)] bg-[linear-gradient(155deg,color-mix(in_srgb,var(--c-surface)_88%,transparent),color-mix(in_srgb,var(--c-panel)_84%,transparent))] shadow-[inset_0_1px_0_rgba(255,255,255,0.42),0_12px_26px_-22px_rgba(15,23,42,0.32)]'
      }`
      }`}
  >
    {!plain && (
      <>
        <span className="pointer-events-none absolute inset-x-[18%] top-[12%] h-[34%] rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.74),rgba(255,255,255,0))] opacity-90" />
        <span className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_30%_24%,rgba(255,255,255,0.22),transparent_44%)]" />
      </>
    )}
    {children}
  </span>
);

const renderNavIcon = (iconKey, customIconUrl = '', iconLabel = '') => {
  if (customIconUrl) {
    return (
      <SidebarIconTile plain>
        <img
          src={customIconUrl}
          alt={iconLabel || 'Navigation'}
          className="relative z-[1] h-full w-full object-cover drop-shadow-[0_6px_10px_rgba(15,23,42,0.18)]"
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = '/appIcon.png';
          }}
        />
      </SidebarIconTile>
    );
  }
  const IconComponent = getNavIconComponent(iconKey);
  if (IconComponent) {
    return (
      <SidebarIconTile>
        <IconComponent className="relative z-[1] h-[1.15rem] w-[1.15rem] translate-y-[0.5px] text-current drop-shadow-[0_6px_10px_rgba(15,23,42,0.18)]" />
      </SidebarIconTile>
    );
  }

  // Fallback to dynamic icon key if a mapped component is missing
  return (
    <SidebarIconTile>
      <DynamicAppIcon iconKey={iconKey} className="relative z-[1] h-[1.15rem] w-[1.15rem] translate-y-[0.5px] text-current drop-shadow-[0_6px_10px_rgba(15,23,42,0.18)]" />
    </SidebarIconTile>
  );
};

const renderUtilityIcon = (IconComponent, accent = false, customIconUrl = '', iconLabel = '') => (
  <SidebarIconTile accent={accent} plain={Boolean(customIconUrl)}>
    {customIconUrl ? (
      <img
        src={customIconUrl}
        alt={iconLabel || 'Utility'}
        className="relative z-[1] h-full w-full object-cover drop-shadow-[0_6px_10px_rgba(15,23,42,0.18)]"
        onError={(event) => {
          event.currentTarget.onerror = null;
          event.currentTarget.src = '/appIcon.png';
        }}
      />
    ) : (
      <IconComponent className="relative z-[1] h-[1.1rem] w-[1.1rem] text-current drop-shadow-[0_6px_10px_rgba(15,23,42,0.18)]" />
    )}
  </SidebarIconTile>
);

const AppSidebar = ({ isCollapsed, isHidden = false, isOverlay = false, layoutMode, onToggle }) => {
  const { tenantId } = useParams();
  const [systemAssets, setSystemAssets] = useState(() => getCachedSystemAssetsSnapshot());
  const runtimePlatform = getRuntimePlatform();
  const visibleNavItems = NAV_ITEMS.filter((item) => isVisibleOnPlatform(item, runtimePlatform));
  const { openRecycleBin } = useRecycleBin();
  const { isOpen: recycleBinIsOpen } = useRecycleBin();
  const recycleDomains = ['clients', 'portals', 'transactions', 'loanPersons', 'statements', 'paymentReceipts', 'invoices'];
  const { total: recycleTotal } = useRecycleBinSummary(tenantId, recycleDomains);

  useEffect(() => {
    let mounted = true;
    getSystemAssets({ forceRefresh: true })
      .then((snapshot) => {
        if (!mounted) return;
        setSystemAssets(snapshot || {});
      })
      .catch(() => {
        // Keep default local icons when system assets are unavailable.
      });
    return () => {
      mounted = false;
    };
  }, []);

  // In mini mode: overlay sidebar slides in via transform
  if (isHidden && !isOverlay) return null;

  const sidebarDensityClass = isCollapsed ? 'desktop-sidebar-collapsed' : 'desktop-sidebar-expanded';

  const overlayClasses = isOverlay
    ? 'desktop-sidebar-overlay absolute top-0 bottom-0 left-0 z-50 shadow-2xl'
    : 'relative';

  const overlayTransform = isOverlay
    ? { transform: 'translateX(0)', transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)' }
    : isHidden
      ? { transform: 'translateX(-100%)', transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)' }
      : {};

  return (
    <aside
      className={`desktop-sidebar ${sidebarDensityClass} block shrink-0 overflow-hidden border border-[var(--c-border)] glass rounded-2xl shadow-sm transition-all duration-300 ${overlayClasses}`}
      style={isOverlay ? overlayTransform : { ...overlayTransform, height: '100%' }}
    >
      <div className="flex h-full flex-col">
        <div className={`flex-1 overflow-y-auto scrollbar-hide ${isCollapsed ? 'px-2.5 py-4' : 'px-3 py-4'}`}>
          <nav className="space-y-1.5">
            {visibleNavItems.map((item) => (
              <div key={item.key} className="group relative flex items-center gap-1">
                <NavLink
                  to={`/t/${tenantId}/${item.path}`}
                  title={isCollapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    `compact-nav-item flex flex-1 items-center gap-3 rounded-xl px-3 text-[13px] font-semibold transition ${isActive
                      ? 'bg-[color:color-mix(in_srgb,var(--c-panel)_88%,transparent)] text-[var(--c-accent)] ring-1 ring-[var(--c-ring)]'
                      : 'text-[var(--c-muted)] hover:bg-[color:color-mix(in_srgb,var(--c-panel)_75%,transparent)] hover:text-[var(--c-accent)]'
                    } ${isCollapsed ? 'justify-center px-0' : 'justify-start'}`
                  }
                >
                  {renderNavIcon(item.icon, resolvePageIconUrl(systemAssets, item.key), item.label)}
                  <span className={`transition-opacity duration-300 ${isCollapsed ? 'hidden' : 'inline'}`}>{item.label}</span>
                </NavLink>
              </div>
            ))}
          </nav>
        </div>
        <div className={`desktop-sidebar-footer border-t border-[var(--c-border)] pb-3 pt-2 ${isCollapsed ? 'px-2.5' : 'px-3'}`}>
          <div className="space-y-1.5">
            {layoutMode !== 'compact' && (
              <button
                type="button"
                onClick={onToggle}
                aria-label={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
                title={isCollapsed ? 'Expand Sidebar' : undefined}
                className={`flex min-h-11 w-full items-center gap-2.5 rounded-xl border border-[var(--c-border)] bg-[color:color-mix(in_srgb,var(--c-panel)_72%,transparent)] px-2.5 text-[13px] font-semibold text-[var(--c-muted)] transition hover:border-[var(--c-ring)] hover:text-[var(--c-accent)] ${isCollapsed ? 'justify-center' : 'justify-start'}`}
                style={{ minHeight: 'var(--d-control-h)' }}
              >
                <SidebarIconTile>
                  <DynamicAppIcon
                    iconKey="sidebarToggle"
                    className={`relative z-[1] h-4.5 w-4.5 shrink-0 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`}
                  />
                </SidebarIconTile>
                <span className={isCollapsed ? 'hidden' : 'inline'}>{isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={openRecycleBin}
              title={isCollapsed ? 'Recycle Bin' : undefined}
              className={`relative flex min-h-11 w-full items-center gap-2.5 rounded-xl border transition ${recycleBinIsOpen
                ? 'border-[var(--c-ring)] bg-[color:color-mix(in_srgb,var(--c-panel)_88%,transparent)] text-[var(--c-accent)] ring-1 ring-[var(--c-ring)]'
                : 'border-[var(--c-border)] bg-[color:color-mix(in_srgb,var(--c-surface)_58%,transparent)] text-[var(--c-text)] hover:border-[var(--c-ring)] hover:bg-[color:color-mix(in_srgb,var(--c-panel)_72%,transparent)] hover:text-[var(--c-accent)]'
                } px-2.5 text-[13px] font-semibold ${isCollapsed ? 'justify-center' : 'justify-start'}`}
              style={{ minHeight: 'var(--d-control-h)' }}
            >
              {renderUtilityIcon(
                RecycleBinIcon,
                recycleBinIsOpen,
                resolvePageIconUrl(systemAssets, 'recycleBin'),
                'Recycle Bin',
              )}
              <span className={isCollapsed ? 'hidden' : 'inline'}>Recycle Bin</span>
              {recycleTotal > 0 ? (
                <span className={`rounded-full bg-[var(--c-accent)] px-1.5 py-0.5 text-[10px] font-bold text-white ${isCollapsed ? 'absolute right-1.5 top-1.5' : 'ml-auto'}`}>
                  {recycleTotal}
                </span>
              ) : null}
            </button>

            <NavLink
              to={`/t/${tenantId}/settings`}
              title={isCollapsed ? 'Settings' : undefined}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-2.5 rounded-xl px-2.5 text-[13px] font-semibold transition ${isActive
                  ? 'bg-[color:color-mix(in_srgb,var(--c-panel)_74%,transparent)] text-[var(--c-accent)] ring-1 ring-[var(--c-ring)]'
                  : 'text-[var(--c-muted)] hover:bg-[color:color-mix(in_srgb,var(--c-panel)_72%,transparent)] hover:text-[var(--c-accent)]'
                } ${isCollapsed ? 'justify-center' : 'justify-start'}`
              }
              style={{ minHeight: 'var(--d-control-h)' }}
            >
              {renderUtilityIcon(SettingsIcon, false, resolvePageIconUrl(systemAssets, 'settings'), 'Settings')}
              <span className={isCollapsed ? 'hidden' : 'inline'}>Settings</span>
            </NavLink>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default AppSidebar;
