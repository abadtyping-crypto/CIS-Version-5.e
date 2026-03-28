import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import {
  PortalIcon,
  ReceiptIcon,
  SettingsIcon,
  TasksIcon,
} from '../components/icons/AppIcons';
import PortalSummarySection from '../components/portal/PortalSummarySection';
import LoanManagementSection from '../components/portal/LoanManagementSection';
import InternalTransferSection from '../components/portal/InternalTransferSection';
import PortalSetupSection from '../components/portal/PortalSetupSection';
import PortalFormPage from './PortalFormPage';
import { useRecycleBin } from '../context/useRecycleBin';
import { useAuth } from '../context/useAuth';
import { useTenant } from '../context/useTenant';
import { fetchTenantPortals } from '../lib/backendStore';
import CurrencyValue from '../components/common/CurrencyValue';
import { getCachedSystemAssetsSnapshot, getSystemAssets } from '../lib/systemAssetsCache';
import { canUserPerformAction } from '../lib/userControlPreferences';
import { DEFAULT_PORTAL_ICON, resolvePortalTypeIcon } from '../lib/transactionMethodConfig';
import '../styles/mobile/portal.css';
import SignatureCard from '../components/common/SignatureCard';

const CATEGORY_ASSET_MAP = {
  Bank: 'icon_portal_bank',
  'Card Payment': 'icon_portal_card',
  'Petty Cash': 'icon_portal_cash',
  Portals: 'icon_portal_portals',
  Terminal: 'icon_portal_terminal',
};

const resolvePortalTypeAsset = (type, systemAssets) => {
  const key = CATEGORY_ASSET_MAP[String(type || '').trim()];
  return (key && systemAssets?.[key]?.iconUrl) || resolvePortalTypeIcon(type) || DEFAULT_PORTAL_ICON;
};

const resolvePortalCardIcon = (portal, systemAssets) => {
  const logoUrl = String(portal?.logoUrl || '').trim();
  const iconUrl = String(portal?.iconUrl || '').trim();
  return logoUrl || iconUrl || resolvePortalTypeAsset(portal?.type, systemAssets);
};

const FUNCTION_ITEMS = [
  {
    key: 'summary',
    label: 'Portal Summary',
    short: 'Summary',
    description: 'Quick balance and liquidity overview for all portals.',
    Icon: PortalIcon,
  },
  {
    key: 'setup',
    label: 'Create & Manage Portals',
    short: 'Setup',
    description: 'Create new portals and maintain existing portal configuration.',
    Icon: SettingsIcon,
  },
  {
    key: 'loan',
    label: 'Loan Management',
    short: 'Loan',
    description: 'Track loan disbursement and repayment against portals.',
    Icon: ReceiptIcon,
  },
  {
    key: 'transfer',
    label: 'Internal Transfer',
    short: 'Transfer',
    description: 'Move balances securely between portals with full traceability.',
    Icon: TasksIcon,
  },
  {
    key: 'balance',
    label: 'Direct Balance Adjustment',
    short: 'Adjustment',
    description: 'Open portal details and apply direct balance adjustment safely.',
    Icon: PortalIcon,
  },
];

const PortalBalanceAdjustmentPanel = ({ refreshKey }) => {
  const navigate = useNavigate();
  const { tenantId } = useTenant();
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [systemAssets, setSystemAssets] = useState(() => getCachedSystemAssetsSnapshot());

  useEffect(() => {
    getSystemAssets().then(setSystemAssets).catch(() => { });
  }, []);

  useEffect(() => {
    if (!tenantId) return;
    let active = true;
    fetchTenantPortals(tenantId).then((res) => {
      if (!active) return;
      if (res.ok) setRows(res.rows || []);
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [tenantId, refreshKey]);

  return (
    <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4 shadow-sm sm:p-5">
      <div className="mb-4">
        <h3 className="text-sm font-black text-[var(--c-text)] sm:text-base">Direct Balance Adjustment</h3>
        <p className="text-xs text-[var(--c-muted)]">
          Open a portal and perform controlled edits from the detail workspace.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--c-accent)] border-t-transparent" />
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--c-border)] bg-[var(--c-panel)] p-4 text-sm text-[var(--c-muted)]">
          No portals found. Create a portal first.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((item) => (
            <SignatureCard
              key={item.id}
              as="div"
              title={item.name || item.id}
              subtitle={
                <span className={`font-bold ${Number(item.balance || 0) < 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                  <CurrencyValue value={item.balance || 0} iconSize="h-3 w-3" />
                </span>
              }
              badge={item.id}
              image={resolvePortalCardIcon(item, systemAssets)}
              className="min-h-[56px]"
            >
              <div className="flex items-center px-4 self-stretch border-l border-[var(--c-border)]">
                <button
                  type="button"
                  onClick={() => navigate(`/t/${tenantId}/portal-management/${item.id}`)}
                  className="h-10 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 text-xs font-black uppercase tracking-wider text-[var(--c-text)] transition hover:border-[var(--c-accent)] hover:text-[var(--c-accent)] active:scale-95"
                >
                  Open & Adjust
                </button>
              </div>
            </SignatureCard>
          ))}
        </div>
      )}
    </div>
  );
};

const PortalManagementPage = () => {
  const { tenantId, portalId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { registerRestoreListener } = useRecycleBin();
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [activeFunction, setActiveFunction] = useState('summary');
  const [isNavHovered, setIsNavHovered] = useState(false);
  const [isNavPinned, setIsNavPinned] = useState(false);
  const pathname = window.location.pathname;
  const isCreateRoute = pathname.endsWith('/portal-management/new');
  const isEditRoute = pathname.includes('/portal-management/edit/');
  const isPortalFormRoute = isCreateRoute || isEditRoute;
  const currentFunction = isPortalFormRoute ? 'setup' : activeFunction;
  const isNavExpanded = isNavPinned || isNavHovered;

  const filteredFunctionItems = useMemo(() => {
    const canAdjust = canUserPerformAction(tenantId, user, 'directBalanceAdjust');
    return FUNCTION_ITEMS.filter((item) => {
      if (item.key === 'balance') return canAdjust;
      return true;
    });
  }, [tenantId, user]);

  useEffect(() => {
    const unsubscribe = registerRestoreListener(() => {
      setRefreshCounter((prev) => prev + 1);
    });
    return unsubscribe;
  }, [registerRestoreListener]);

  const handleQuickAction = (key) => {
    if (FUNCTION_ITEMS.some((item) => item.key === key)) {
      setActiveFunction(key);
      if (isPortalFormRoute && tenantId) {
        navigate(`/t/${tenantId}/portal-management`);
      }
    }
  };

  const activeMeta = useMemo(
    () => {
      if (isCreateRoute) {
        return {
          key: 'setup-create',
          label: 'Create Portal',
          description: 'Create a new portal without leaving the portal management workspace.',
          Icon: SettingsIcon,
        };
      }
      if (isEditRoute) {
        return {
          key: 'setup-edit',
          label: 'Edit Portal',
          description: `Update portal ${portalId || ''} inside the same portal management workspace.`,
          Icon: SettingsIcon,
        };
      }
      return filteredFunctionItems.find((item) => item.key === currentFunction) || filteredFunctionItems[0];
    },
    [currentFunction, isCreateRoute, isEditRoute, portalId, filteredFunctionItems],
  );

  const renderActiveContent = () => {
    if (isPortalFormRoute) {
      return <PortalFormPage embedded />;
    }
    if (currentFunction === 'setup') {
      return <PortalSetupSection isOpen={true} onToggle={() => null} refreshKey={refreshCounter} />;
    }
    if (currentFunction === 'loan') {
      return <LoanManagementSection isOpen={true} onToggle={() => null} refreshKey={refreshCounter} />;
    }
    if (currentFunction === 'transfer') {
      return <InternalTransferSection isOpen={true} onToggle={() => null} refreshKey={refreshCounter} />;
    }
    if (currentFunction === 'balance') {
      return <PortalBalanceAdjustmentPanel refreshKey={refreshCounter} />;
    }
    return <PortalSummarySection onQuickAction={handleQuickAction} refreshKey={refreshCounter} />;
  };

  if (!user) return null;

  return (
    <PageShell
      pageID="portal-management"
      widthPreset="data"
    >
      <div className="grid h-full gap-4 overflow-hidden lg:grid-cols-[auto_1fr]">
        <aside
          onMouseEnter={() => setIsNavHovered(true)}
          onMouseLeave={() => setIsNavHovered(false)}
          className={`sticky top-0 hidden h-fit p-3 transition-[width] duration-300 ease-in-out lg:block ${isNavExpanded ? 'w-[260px]' : 'w-[72px]'}`}
        >
          <div>
            <div className={`mb-3 flex items-center rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] transition-all ${isNavExpanded ? 'gap-3 px-3 py-3' : 'justify-center px-0 py-2.5'}`}>
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--c-accent)]/25 bg-[color:color-mix(in_srgb,var(--c-accent)_14%,transparent)] text-[var(--c-accent)]">
                <PortalIcon className="h-4.5 w-4.5" />
              </span>
              <div className={`min-w-0 overflow-hidden transition-all duration-200 ${isNavExpanded ? 'max-w-[180px] opacity-100' : 'max-w-0 opacity-0'}`}>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--c-muted)]">
                  Workspace
                </p>
                <p className="truncate text-sm font-black text-[var(--c-text)]">
                  Portal Functions
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsNavPinned((prev) => !prev)}
              className={`mb-2 w-full rounded-lg border px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] transition ${
                isNavPinned
                  ? 'border-[var(--c-accent)]/40 bg-[var(--c-accent)]/12 text-[var(--c-accent)]'
                  : 'border-[var(--c-border)] bg-[var(--c-panel)] text-[var(--c-muted)] hover:text-[var(--c-text)]'
              } ${isNavExpanded ? '' : 'hidden'}`}
            >
              {isNavPinned ? 'Pinned' : 'Pin Menu'}
            </button>
            <div className="grid gap-1.5">
              {filteredFunctionItems.map((item) => {
                const isActive = currentFunction === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleQuickAction(item.key)}
                    aria-label={item.label}
                    title={!isNavExpanded ? item.label : undefined}
                    className={`group relative flex items-center min-h-[56px] h-14 rounded-2xl border border-[var(--c-border)] text-left text-sm font-semibold transition ${
                      isNavExpanded ? 'justify-start gap-3 px-4' : 'justify-center gap-0 px-0'
                    } ${isActive
                      ? 'border-[var(--c-accent)] bg-[color:color-mix(in_srgb,var(--c-accent)_16%,transparent)] text-[var(--c-text)]'
                      : 'bg-[var(--c-panel)] text-[var(--c-muted)] hover:border-[var(--c-border)] hover:bg-[color:color-mix(in_srgb,var(--c-panel)_92%,var(--c-surface)_8%)]'
                      }`}
                  >
                    <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${isActive ? 'border-[var(--c-accent)]/30 bg-[color:color-mix(in_srgb,var(--c-accent)_16%,transparent)] text-[var(--c-accent)]' : 'border-[var(--c-border)] bg-[var(--c-panel)] text-[var(--c-muted)]'}`}>
                      <item.Icon className="h-4 w-4" />
                    </span>
                    <span
                      className={`overflow-hidden whitespace-nowrap text-xs font-bold transition-all duration-200 ${
                        isNavExpanded ? 'max-w-[180px] opacity-100' : 'max-w-0 opacity-0'
                      }`}
                    >
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <div className="mb-3 lg:hidden">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--c-muted)]">
                Portal Function
                <select
                  value={currentFunction}
                  onChange={(event) => handleQuickAction(event.target.value)}
                  className="mt-1 w-full min-h-[56px] h-14 rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] px-4 py-3 text-sm font-semibold text-[var(--c-text)] outline-none"
                >
                {FUNCTION_ITEMS.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mb-3 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--c-accent)]/30 bg-[color:color-mix(in_srgb,var(--c-accent)_14%,transparent)] text-[var(--c-accent)]">
                <activeMeta.Icon className="h-4 w-4" />
              </span>
              <p className="text-sm font-black text-[var(--c-text)]">{activeMeta.label}</p>
            </div>
            <p className="text-xs text-[var(--c-muted)]">{activeMeta.description}</p>
          </div>

          <div key={`${currentFunction}-${portalId || 'base'}-${isCreateRoute ? 'create' : isEditRoute ? 'edit' : 'view'}`} className="portal-workspace-fade pb-20">
            {renderActiveContent()}
          </div>
        </div>
      </div>
    </PageShell>
  );
};

export default PortalManagementPage;
