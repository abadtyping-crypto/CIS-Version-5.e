import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { BellIcon, SearchIcon, DynamicAppIcon } from '../icons/AppIcons';
import { useTheme } from '../../context/useTheme';
import { ArrowUpRight, Eye, LogOut, Monitor, MoonStar, SunMedium, Mail, Printer, FileDown, ExternalLink, ChevronDown, UserRoundPlus, RefreshCcw, Check, Trash2, RotateCcw } from 'lucide-react';
import { DEFAULT_PORTAL_ICON } from '../../lib/transactionMethodConfig';
import { useTenantBrandingLogos } from '../../hooks/useTenantBrandingLogos';
import { resolveNotificationPrimaryVisual } from '../../lib/notificationVisuals';
import QuickViewModal from '../common/QuickViewModal';
import CreatedByIdentityCard from '../common/CreatedByIdentityCard';
import { useTenantNotifications } from '../../hooks/useTenantNotifications';
import { resolveTenantRoute } from '../../lib/tenantRoutes';
import { useSystemAssets } from '../../lib/systemAssetsCache';
import { getRoleBadgeClassName, normalizeRoleLabel } from '../../lib/userRolePresentation';

const toDateLabel = (value) => {
  if (!value) return '';
  if (typeof value?.toDate === 'function') return value.toDate().toLocaleString();
  if (typeof value?.toMillis === 'function') return new Date(value.toMillis()).toLocaleString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString();
};

const toBalanceLabel = (value) => {
  const amount = Number(value || 0);
  const sign = amount < 0 ? '-' : '';
  return `${sign}Dhs ${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const DesktopHeader = ({ tenant, user, onLogout, layoutMode = 'wide', onToggleSidebar }) => {
  const { tenantId } = useParams();
  const { notifications, unreadCount, markAsRead, markActionTaken } = useTenantNotifications(tenantId, user);
  const notificationCount = unreadCount;
  const recentNotifications = (notifications || []).slice(0, 5);
  const onNotificationRead = markAsRead;
  const { theme, resolvedTheme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [activeQuickView, setActiveQuickView] = useState(null);

  const getActionAppearance = (action = {}) => {
    const label = String(action?.label || '').toLowerCase();
    const actionType = String(action?.actionType || '').toLowerCase();

    if (actionType === 'quickview') {
      return {
        label: action.label || 'Quick View',
        Icon: Eye,
        className: 'border-[var(--c-accent)]/20 bg-[color:color-mix(in_srgb,var(--c-accent)_12%,var(--c-surface))] text-[var(--c-accent)] hover:border-[var(--c-accent)]/35 hover:bg-[color:color-mix(in_srgb,var(--c-accent)_18%,var(--c-surface))]',
      };
    }
    if (actionType === 'link') {
      return {
        label: action.label || 'Open',
        Icon: ArrowUpRight,
        className: 'border-[var(--c-border)] bg-[var(--c-panel)] text-[var(--c-text)] hover:border-[var(--c-accent)]/30 hover:text-[var(--c-accent)]',
      };
    }
    if (label.includes('delete') || label.includes('remove') || label.includes('reject')) {
      return {
        label: action.label || 'Delete',
        Icon: Trash2,
        className: 'border-[var(--c-danger)]/20 bg-[var(--c-danger-soft)] text-[var(--c-danger)] hover:border-[var(--c-danger)]/35 hover:bg-[color:color-mix(in_srgb,var(--c-danger)_14%,var(--c-surface))]',
      };
    }
    if (label.includes('confirm') || label.includes('approve')) {
      return {
        label: action.label || 'Confirm',
        Icon: Check,
        className: 'border-[var(--c-success)]/20 bg-[var(--c-success-soft)] text-[var(--c-success)] hover:border-[var(--c-success)]/35 hover:bg-[color:color-mix(in_srgb,var(--c-success)_14%,var(--c-surface))]',
      };
    }
    if (label.includes('retrieve') || label.includes('restore')) {
      return {
        label: action.label || 'Retrieve',
        Icon: RotateCcw,
        className: 'border-[var(--c-warning)]/20 bg-[var(--c-warning-soft)] text-[var(--c-warning)] hover:border-[var(--c-warning)]/35 hover:bg-[color:color-mix(in_srgb,var(--c-warning)_14%,var(--c-surface))]',
      };
    }

    return {
      label: action.label || 'Action',
      Icon: BellIcon, // Using BellIcon from AppIcons, not Lucide's Bell
      className: 'border-[var(--c-border)] bg-[var(--c-panel)] text-[var(--c-text)] hover:border-[var(--c-accent)]/25 hover:text-[var(--c-accent)]',
    };
  };

  const handleNotificationAction = async (e, action, item) => {
    e.stopPropagation();
    if (!item || item.actionTakenBy) return;

    if (action.actionType === 'quickview') {
      handleNotificationQuickView(e, item);
    } else if (action.actionType === 'link' && action.route) {
      setNotificationsOpen(false);
      const targetRoute = resolveTenantRoute(tenantId, action.route);
      if (targetRoute) navigate(targetRoute);
    } else if (action.actionType === 'api') {
      const res = await markActionTaken(item.id, action);
      if (!res.ok) {
        alert(res.error || 'Unable to perform requested action.');
      }
    }
  };
  const systemAssets = useSystemAssets();

  const notificationsRef = useRef(null);
  const notificationsMenuRef = useRef(null);
  const [notificationsMenuPos, setNotificationsMenuPos] = useState({ top: 0, right: 0 });
  const appliedTheme = theme === 'system' ? resolvedTheme : theme;
  const ThemeIcon = theme === 'system' ? Monitor : appliedTheme === 'dark' ? MoonStar : SunMedium;
  const themeLabel = theme === 'system' ? `System (${resolvedTheme})` : appliedTheme === 'dark' ? 'Dark Mode' : 'Light Mode';
  const displayName = String(user?.displayName || '').trim() || 'User';
  const roleLabel = normalizeRoleLabel(user?.role);
  const roleBadgeClassName = getRoleBadgeClassName(roleLabel);
  const tenantLogoUrl = tenant?.logoUrl || '/logo.png';
  const { headerLogoUrl } = useTenantBrandingLogos(tenantId, tenantLogoUrl);
  const tenantLabel = tenant?.name || 'Tenant';

  const goTo = (path) => navigate(`/t/${tenantId}/${path}`);

  useEffect(() => {
    const onPointerDown = (event) => {
      const target = event.target;
      if (notificationsRef.current?.contains(target)) return;
      if (notificationsMenuRef.current?.contains(target)) return;
      setNotificationsOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, []);



  useLayoutEffect(() => {
    if (!notificationsOpen) return;
    if (typeof window === 'undefined') return;

    const update = () => {
      const rect = notificationsRef.current?.getBoundingClientRect?.();
      if (!rect) return;
      const top = Math.round(rect.bottom + 8);
      const right = Math.max(8, Math.round(window.innerWidth - rect.right));
      setNotificationsMenuPos({ top, right });
    };

    update();
    window.addEventListener('resize', update);
    // capture scroll from any scroll container
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [notificationsOpen]);

  const handleNotificationOpen = async (item) => {
    if (!item?.id) return;
    if (!item.isRead) await onNotificationRead?.(item.id);
    if (item.routePath) {
      navigate(item.routePath);
    } else {
      goTo('notifications');
    }
    setNotificationsOpen(false);
  };

  const handleNotificationQuickView = async (event, item) => {
    event.stopPropagation();
    if (!item?.quickView) return;
    if (!item.isRead) await onNotificationRead?.(item.id);
    setActiveQuickView(item.quickView);
  };

  return (
    <header className="sticky top-0 z-40 transition-all duration-300" style={{ padding: 'var(--d-shell-main-pad-y) var(--d-shell-main-pad-x) calc(var(--d-shell-main-pad-y) * 0.5)', fontSize: '16px' }}>
      <div className="glass no-drag flex items-center justify-between gap-2 rounded-2xl border border-[var(--c-border)] px-2.5 sm:px-3" style={{ minHeight: '59px' }}>
        <div className="flex items-center gap-3">
          {/* Hamburger button for mini mode */}
          {layoutMode === 'mini' && onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="compact-icon-action inline-flex items-center justify-center rounded-xl border border-[var(--c-border)] bg-[color:color-mix(in_srgb,var(--c-surface)_84%,transparent)] text-[var(--c-text)] shadow-sm transition hover:border-[var(--c-ring)] hover:bg-[var(--c-panel)]"
              aria-label="Toggle sidebar"
            >
              <DynamicAppIcon iconKey="sidebarHamburger" className="h-5 w-5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => goTo('dashboard')}
            className="brand-button no-drag inline-flex min-w-0 flex-1 appearance-none items-stretch gap-0 overflow-hidden rounded-2xl border border-[var(--c-border)] bg-[color:color-mix(in_srgb,var(--c-surface)_84%,transparent)] p-0 text-left text-[var(--c-text)] no-underline outline-none shadow-sm transition hover:border-[var(--c-ring)] hover:bg-[var(--c-panel)] focus-visible:ring-2 focus-visible:ring-[var(--c-ring)]"
            style={{ textDecoration: 'none' }}
          >
            {headerLogoUrl ? (
              <div className="relative h-14 w-16 shrink-0 overflow-hidden bg-[var(--c-panel)]">
                <img
                  src={headerLogoUrl}
                  alt={tenantLabel}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>
            ) : null}

            {(layoutMode === 'standard' || layoutMode === 'wide') && (
              <div className="flex min-w-0 flex-1 items-center px-4">
                <p className="truncate text-[1rem] font-semibold leading-tight text-[var(--c-text)]">{tenant.name}</p>
              </div>
            )}
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="compact-icon-action inline-flex items-center justify-center rounded-xl border border-[var(--c-border)] bg-[color:color-mix(in_srgb,var(--c-surface)_84%,transparent)] text-sm font-semibold text-[var(--c-text)] shadow-sm transition hover:border-[var(--c-ring)] hover:bg-[var(--c-panel)]"
            aria-label={`Toggle theme (currently ${themeLabel})`}
          >
            <ThemeIcon className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => goTo('search')}
            className="compact-icon-action inline-flex items-center justify-center rounded-xl border border-[var(--c-border)] bg-[color:color-mix(in_srgb,var(--c-surface)_84%,transparent)] text-sm font-semibold text-[var(--c-text)] shadow-sm transition hover:border-[var(--c-ring)] hover:bg-[var(--c-panel)]"
            aria-label="Search clients and dependants"
          >
            <DynamicAppIcon iconKey="search" className="h-5 w-5" />
          </button>

          <div className="relative" ref={notificationsRef}>
            <button
              type="button"
              onClick={() => setNotificationsOpen((prev) => !prev)}
              className="compact-icon-action no-drag relative inline-flex items-center justify-center rounded-xl border border-[var(--c-border)] bg-[color:color-mix(in_srgb,var(--c-surface)_84%,transparent)] text-sm font-semibold text-[var(--c-text)] shadow-sm transition hover:border-[var(--c-ring)] hover:bg-[var(--c-panel)]"
              style={{ WebkitAppRegion: 'no-drag' }}
              aria-label="Notifications"
              aria-expanded={notificationsOpen}
              aria-haspopup="menu"
            >
              <DynamicAppIcon iconKey="bell" className="h-5 w-5" />
              {notificationCount > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--c-danger)] px-1.5 text-[11px] font-bold text-white shadow-sm ring-2 ring-white">
                  {notificationCount > 99 ? '99+' : notificationCount}
                </span>
              ) : null}
            </button>
            {notificationsOpen && typeof document !== 'undefined'
              ? createPortal(
                <div
                  ref={notificationsMenuRef}
                  className="glass no-drag fixed z-[9999] w-[min(23rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] rounded-2xl border border-[var(--c-border)] p-2 shadow-lg animate-in fade-in slide-in-from-top-2 zoom-in-95 duration-150 origin-top-right flex flex-col"
                  style={{
                    top: notificationsMenuPos.top,
                    right: notificationsMenuPos.right,
                    WebkitAppRegion: 'no-drag',
                  }}
                >
                  <div className="mb-2 flex shrink-0 items-center justify-between rounded-xl border border-[var(--c-border)] bg-[color:color-mix(in_srgb,var(--c-surface)_86%,black_14%)] px-3 py-2 shadow-sm">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--c-text)]">Recent Notifications</p>
                    <button
                      type="button"
                      onClick={() => {
                        setNotificationsOpen(false);
                        goTo('notifications');
                      }}
                      className="rounded-lg px-2 py-1 text-[11px] font-bold text-[var(--c-accent)] hover:bg-[var(--c-panel)]"
                    >
                      View All
                    </button>
                  </div>
                  {recentNotifications.length === 0 ? (
                    <p className="shrink-0 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-4 text-xs text-[var(--c-muted)]">
                      No recent notifications.
                    </p>
                  ) : (
                    <div className="space-y-2 overflow-y-auto overflow-x-hidden pr-1" style={{ maxHeight: 'calc(min(var(--d-popover-max-h, 24rem), calc(100dvh - 8rem)) - 4rem)' }}>
                      {recentNotifications.map((item) => (
                        <div
                          key={item.id}
                          className={`w-full rounded-xl border px-3 py-3 transition ${item.isRead ? 'border-[var(--c-border)] bg-[var(--c-surface)]' : 'border-[var(--c-ring)] bg-[var(--c-panel)] shadow-sm'}`}
                        >
                          {(() => {
                            const primaryVisual = resolveNotificationPrimaryVisual(item, systemAssets);
                            return (
                              <div className="flex items-start gap-3 text-left">
                                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--c-border)] bg-[color:color-mix(in_srgb,var(--c-surface)_70%,white_30%)]">
                                  {primaryVisual.kind === 'image' ? (
                                    <img
                                      src={primaryVisual.src}
                                      alt={primaryVisual.alt || 'Notification'}
                                      className="h-full w-full bg-white object-cover"
                                      onError={(event) => {
                                        event.currentTarget.onerror = null;
                                        event.currentTarget.src = primaryVisual.fallbackSrc || DEFAULT_PORTAL_ICON;
                                      }}
                                    />
                                  ) : (
                                    <primaryVisual.Icon className="h-4 w-4 text-[var(--c-accent)]" />
                                  )}
                                </div>
                                <div
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => handleNotificationOpen(item)}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                      event.preventDefault();
                                      handleNotificationOpen(item);
                                    }
                                  }}
                                  className="min-w-0 flex-1 cursor-pointer text-left outline-none"
                                >
                                  <div className="mb-1 flex items-start gap-2">
                                    <p className="line-clamp-2 flex-1 whitespace-normal text-sm font-semibold leading-tight text-[var(--c-text)]">{item.title || item.eventType || 'Notification'}</p>
                                    {!item.isRead ? <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-[var(--c-accent)]" /> : null}
                                  </div>
                                  <p className="line-clamp-3 mb-2 break-words text-sm leading-relaxed text-[var(--c-muted)]">{item.detail || item.message || 'No detail available.'}</p>
                                  {item.entityType === 'portal' && item.entityMeta ? (
                                    <div className="mt-1 flex items-center gap-2">
                                      <div className="relative h-5 w-5 shrink-0">
                                        <img
                                          src={item.entityMeta.iconUrl || DEFAULT_PORTAL_ICON}
                                          alt={item.entityMeta.name || 'Portal'}
                                          className="h-full w-full rounded bg-white object-cover"
                                          onError={(event) => {
                                            event.currentTarget.onerror = null;
                                            event.currentTarget.src = DEFAULT_PORTAL_ICON;
                                          }}
                                        />
                                      </div>
                                      <div className="min-w-0 flex-1 flex items-center gap-1.5 overflow-hidden">
                                        <p className="truncate text-[11px] font-black text-[var(--c-text)]">
                                          {item.entityMeta.name}
                                        </p>
                                        {item.entityMeta.logoId ? (
                                          <span className="whitespace-nowrap rounded bg-[var(--c-panel)] px-1 py-0.5 text-[8px] font-bold text-[var(--c-muted)] uppercase">
                                            {item.entityMeta.logoId}
                                          </span>
                                        ) : null}
                                        <span className="h-1 w-1 rounded-full bg-[var(--c-border)] shrink-0" />
                                        <p className="whitespace-nowrap text-[10px] font-bold text-[var(--c-accent)]">
                                          {toBalanceLabel(item.entityMeta.balance)}
                                        </p>
                                      </div>
                                    </div>
                                  ) : null}
                                  <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-[var(--c-muted)]">
                                    <CreatedByIdentityCard
                                      uid={item.createdBy || item.createdByUser?.uid || ''}
                                      displayName={item.createdByUser?.displayName || 'System'}
                                      avatarUrl={item.createdByUser?.photoURL || '/avatar.png'}
                                      role={item.createdByUser?.role || ''}
                                      as="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setNotificationsOpen(false);
                                        if (item.createdBy) goTo(`profile/edit?uid=${encodeURIComponent(item.createdBy)}`);
                                      }}
                                      className="max-w-[210px]"
                                    />
                                    <span>{toDateLabel(item.createdAt)}</span>
                                  </div>
                                  {item.actionTakenBy ? (
                                    <div className="mt-2 rounded-lg bg-[var(--c-success-soft)] px-2 py-1.5 text-[10px] font-bold text-[var(--c-success)]">
                                      <div className="flex items-center gap-1.5">
                                        <Check strokeWidth={1.5} className="h-3 w-3" />
                                        <span>Taken by {item.actionTakenByUser?.displayName || 'System'}</span>
                                      </div>
                                    </div>
                                  ) : Array.isArray(item.actions) && item.actions.length > 0 ? (
                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                      {item.actions.map((act, ax) => {
                                        const appearance = getActionAppearance(act);
                                        const ActionIcon = appearance.Icon;
                                        return (
                                          <button
                                            key={ax}
                                            type="button"
                                            onClick={(e) => handleNotificationAction(e, act, item)}
                                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-bold transition ${appearance.className}`}
                                          >
                                            <ActionIcon className="h-3.5 w-3.5" />
                                            <span>{appearance.label}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                      {item.quickView ? (
                                        <button
                                          type="button"
                                          onClick={(event) => handleNotificationQuickView(event, item)}
                                          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--c-accent)]/20 bg-[color:color-mix(in_srgb,var(--c-accent)_12%,var(--c-surface))] px-2.5 py-1 text-[10px] font-bold text-[var(--c-accent)] transition hover:border-[var(--c-accent)]/35 hover:bg-[color:color-mix(in_srgb,var(--c-accent)_18%,var(--c-surface))]"
                                          aria-label="Quick View"
                                        >
                                          <Eye strokeWidth={1.5} className="h-3.5 w-3.5" />
                                          <span>Quick View</span>
                                        </button>
                                      ) : null}
                                      {item.routePath ? (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--c-muted)]">
                                          <ArrowUpRight strokeWidth={1.5} className="h-3.5 w-3.5" />
                                          <span>Open in workspace</span>
                                        </span>
                                      ) : null}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      ))}
                    </div>
                  )}
                </div>,
                document.body,
              )
              : null}
          </div>

          <button
            type="button"
            onClick={() => goTo('profile')}
            className="compact-action flex cursor-pointer items-stretch gap-0 overflow-hidden rounded-2xl border border-[var(--c-border)] bg-[color:color-mix(in_srgb,var(--c-surface)_84%,transparent)] transition hover:border-[var(--c-ring)] hover:bg-[var(--c-panel)]"
            aria-label="Open profile page"
          >
            <div className="relative h-14 w-16 shrink-0 overflow-hidden bg-[var(--c-panel)]">
              <img
                src={user.photoURL || '/avatar.png'}
                alt={displayName}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
            <span className="hidden min-w-0 items-center px-4 text-left xl:flex">
              <span className="flex min-w-0 flex-col py-1">
                <span className="truncate text-sm font-semibold leading-tight text-[var(--c-text)]">{displayName}</span>
                <span className={`mt-1 inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] ${roleBadgeClassName}`}>
                  {roleLabel}
                </span>
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => onLogout?.()}
            className="compact-icon-action inline-flex items-center justify-center rounded-xl border border-[var(--c-danger)]/40 bg-[color:color-mix(in_srgb,var(--c-danger)_10%,var(--c-surface))] text-[var(--c-danger)] shadow-sm transition hover:border-[var(--c-danger)] hover:bg-[var(--c-danger-soft)]"
            aria-label="Logout"
          >
            <LogOut strokeWidth={1.5} className="h-5 w-5" />
          </button>
        </div>
      </div>
      <QuickViewModal
        isOpen={Boolean(activeQuickView)}
        quickView={activeQuickView}
        onClose={() => setActiveQuickView(null)}
      />
    </header >
  );
};

export default DesktopHeader;
