import PageShell from '../components/layout/PageShell';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { useTenant } from '../context/useTenant';
import { useTenantNotifications } from '../hooks/useTenantNotifications';
import QuickViewModal from '../components/common/QuickViewModal';
import {
  Settings,
  Users,
  Briefcase,
  FileText,
  Bell,
  CheckCircle2,
  Eye,
  ArrowUpRight,
  Check,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { DEFAULT_PORTAL_ICON } from '../lib/transactionMethodConfig';
import { resolveNotificationPrimaryVisual } from '../lib/notificationVisuals';
import { getCachedSystemAssetsSnapshot, getSystemAssets } from '../lib/systemAssetsCache';
import { resolveTenantRoute } from '../lib/tenantRoutes';

const TOPIC_ICONS = {
  settings: Settings,
  users: Users,
  finance: Briefcase,
  documents: FileText,
  default: Bell,
};

const getActionAppearance = (action = {}) => {
  const label = String(action?.label || '').toLowerCase();
  const actionType = String(action?.actionType || '').toLowerCase();

  if (actionType === 'quickView') {
    return {
      label: 'Quick View',
      Icon: Eye,
      className: 'border-[var(--c-accent)]/20 bg-[color:color-mix(in_srgb,var(--c-accent)_12%,var(--c-surface))] text-[var(--c-accent)] hover:border-[var(--c-accent)]/35 hover:bg-[color:color-mix(in_srgb,var(--c-accent)_18%,var(--c-surface))]',
    };
  }
  if (actionType === 'link') {
    return {
      label: 'Open',
      Icon: ArrowUpRight,
      className: 'border-[var(--c-border)] bg-[var(--c-panel)] text-[var(--c-text)] hover:border-[var(--c-accent)]/30 hover:text-[var(--c-accent)]',
    };
  }
  if (label.includes('delete') || label.includes('remove')) {
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
    Icon: Bell,
    className: 'border-[var(--c-border)] bg-[var(--c-panel)] text-[var(--c-text)] hover:border-[var(--c-accent)]/25 hover:text-[var(--c-accent)]',
  };
};

const toDateLabel = (value) => {
  if (!value) return '';
  if (typeof value?.toDate === 'function') return value.toDate().toLocaleString();
  if (typeof value?.toMillis === 'function') return new Date(value.toMillis()).toLocaleString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString();
};

const toRelativeTime = (value) => {
  const now = Date.now();
  const exact = toDateLabel(value);
  let then = 0;
  if (typeof value?.toMillis === 'function') then = value.toMillis();
  else if (typeof value?.toDate === 'function') then = value.toDate().getTime();
  else then = new Date(value).getTime();
  if (!Number.isFinite(then)) return exact;
  const diffSeconds = Math.max(1, Math.floor((now - then) / 1000));
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return toDateLabel(value);
};



const toBalanceLabel = (value) => {
  const amount = Number(value || 0);
  const sign = amount < 0 ? '-' : '';
  return `${sign}Dhs ${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const NotificationsPage = () => {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { notifications, isLoading, markAsRead, markActionTaken } = useTenantNotifications(tenantId, user);
  const [activeQuickView, setActiveQuickView] = useState(null);
  const [systemAssets, setSystemAssets] = useState(() => getCachedSystemAssetsSnapshot());

  useEffect(() => {
    let mounted = true;
    getSystemAssets({ forceRefresh: true })
      .then((snapshot) => {
        if (!mounted) return;
        setSystemAssets(snapshot || {});
      })
      .catch(() => {
        // Keep default icon fallback path.
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleActionClick = async (e, action, item) => {
    e.stopPropagation(); // Avoid triggering the main card click
    if (!item || item.actionTakenBy) return;
    
    const notificationId = item.id;
    if (action.actionType === 'quickView') {
      if (!item.isRead) {
        await markAsRead(notificationId);
      }
      setActiveQuickView(item.quickView || null);
    } else if (action.actionType === 'link' && action.route) {
      if (!item.isRead) {
         await markAsRead(notificationId);
      }
      const targetRoute = resolveTenantRoute(tenantId, action.route);
      if (targetRoute) navigate(targetRoute);
    } else if (action.actionType === 'api') {
      const actionRes = await markActionTaken(notificationId, action);
      if (!actionRes.ok) {
        alert(actionRes.error || 'Unable to complete action.');
      }
    }
  };

  return (
    <PageShell title="Notifications" subtitle="System alerts and operational updates." iconKey="notifications">
      <div className="space-y-3">
        {isLoading ? (
          <p className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4 text-sm text-[var(--c-muted)]">
            Loading notifications...
          </p>
        ) : notifications.length === 0 ? (
          <p className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4 text-sm text-[var(--c-muted)]">
            No notifications found.
          </p>
        ) : notifications.map((item) => {
          const TopicIcon = TOPIC_ICONS[item.topic] || TOPIC_ICONS.default;
          const primaryVisual = resolveNotificationPrimaryVisual(item, systemAssets);
          
          return (
          <article
            key={item.id}
            className={`rounded-2xl border p-4 transition ${item.isRead
              ? 'border-[var(--c-border)] bg-[var(--c-surface)]'
              : 'border-[var(--c-ring)] bg-[var(--c-panel)]'
              } ${item.routePath ? 'cursor-pointer hover:border-[var(--c-ring)]' : ''}`}
            onClick={async () => {
              if (!item.isRead) await markAsRead(item.id);
              if (item.routePath) {
                const targetRoute = resolveTenantRoute(tenantId, item.routePath);
                if (targetRoute) navigate(targetRoute);
              } else if (item.quickView) {
                setActiveQuickView(item.quickView);
              }
            }}
          >
            <div className="mb-3 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--c-border)] bg-[color:color-mix(in_srgb,var(--c-surface)_70%,white_30%)] shadow-sm">
                  {primaryVisual.kind === 'image' ? (
                    <img
                      src={primaryVisual.src}
                      alt={primaryVisual.alt || 'Notification'}
                      className="h-full w-full object-cover"
                      onError={(event) => {
                        event.currentTarget.onerror = null;
                        event.currentTarget.src = primaryVisual.fallbackSrc || DEFAULT_PORTAL_ICON;
                      }}
                    />
                  ) : (
                    <primaryVisual.Icon className="h-5 w-5 text-[var(--c-accent)]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <TopicIcon className="h-4 w-4 text-[var(--c-muted)]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">
                      [{item.topic || 'System'}]
                    </span>
                    {!item.isRead ? <span className="h-2 w-2 rounded-full bg-[var(--c-accent)]" /> : null}
                  </div>
                  <p className="mt-1 text-sm font-black text-[var(--c-text)]">
                    {item.title || item.subject || item.eventType || 'Notification'}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[var(--c-muted)]">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (item.createdBy) navigate(`/t/${tenantId}/profile/edit?uid=${encodeURIComponent(item.createdBy)}`);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] px-1.5 py-1 transition hover:border-[var(--c-accent)] hover:text-[var(--c-text)]"
                      aria-label="View profile"
                    >
                      <img
                        src={item.createdByUser?.photoURL || '/avatar.png'}
                        alt={item.createdByUser?.displayName || 'User'}
                        className="h-5 w-5 rounded-full border border-[var(--c-border)] object-cover"
                      />
                      <span className="max-w-[12rem] truncate pr-1">
                        {item.createdByUser?.displayName || 'System'}
                      </span>
                    </button>
                    {item.createdAt ? (
                      <span>
                        {toRelativeTime(item.createdAt)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium leading-relaxed text-[var(--c-muted)]">
                {item.detail || item.message || item.body || 'No detail available.'}
              </p>

              {item.entityType === 'portal' && item.entityMeta ? (
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-[var(--c-border)] bg-[color:color-mix(in_srgb,var(--c-surface)_50%,transparent)] px-3 py-2">
                  <img
                    src={item.entityMeta.iconUrl || DEFAULT_PORTAL_ICON}
                    alt={item.entityMeta.name || 'Portal'}
                    className="h-8 w-8 rounded-lg object-cover"
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = DEFAULT_PORTAL_ICON;
                    }}
                  />
                  <div>
                    <p className="text-sm font-bold text-[var(--c-text)]">{item.entityMeta.name}</p>
                    <p className="text-xs font-semibold text-[var(--c-muted)]">{toBalanceLabel(item.entityMeta.balance)}</p>
                  </div>
                </div>
              ) : null}

              {item.actionTakenBy ? (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>
                      Action taken by {item.actionTakenByUser?.displayName || item.actionTakenBy}
                      {item.actionTakenLabel ? ` (${item.actionTakenLabel})` : ''}
                    </span>
                  </div>
                </div>
              ) : Array.isArray(item.actions) && item.actions.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--c-border)] pt-4">
                  {item.actions.map((action, idx) => (
                    (() => {
                      const appearance = getActionAppearance(action);
                      const ActionIcon = appearance.Icon;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={(e) => handleActionClick(e, action, item)}
                          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${appearance.className}`}
                        >
                          <ActionIcon className="h-3.5 w-3.5" />
                          <span>{appearance.label}</span>
                        </button>
                      );
                    })()
                  ))}
                </div>
              ) : null}
            </div>
          </article>
        )})}
      </div>
      <QuickViewModal
        isOpen={Boolean(activeQuickView)}
        quickView={activeQuickView}
        onClose={() => setActiveQuickView(null)}
      />
    </PageShell>
  );
};

export default NotificationsPage;
