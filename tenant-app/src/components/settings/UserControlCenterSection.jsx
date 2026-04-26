import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/useAuth';
import { useTenant } from '../../context/useTenant';
import { fetchTenantUsersMap } from '../../lib/backendStore';
import UserFunctionAccessSection from './UserFunctionAccessSection';
import { NAV_ITEMS } from '../../config/appNavigation';
import { getCachedSystemAssetsSnapshot, getSystemAssets } from '../../lib/systemAssetsCache';
import { resolvePageIconUrl } from '../../lib/pageIconAssets';

const normalizeRoleLabel = (role) => {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'superadmin' || normalized === 'super admin') return 'Owner';
  return role || 'Staff';
};

const UserControlCenterSection = () => {
  const { tenantId } = useTenant();
  const { user: currentUser } = useAuth();
  const [decoratedUsers, setDecoratedUsers] = useState([]);
  const [selectedUid, setSelectedUid] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPageKey, setSelectedPageKey] = useState('');
  const [systemAssets, setSystemAssets] = useState(() => getCachedSystemAssetsSnapshot());

  useEffect(() => {
    if (!tenantId) return;
    fetchTenantUsersMap(tenantId).then((res) => {
      if (res.ok) {
        setDecoratedUsers(res.rows);
        if (res.rows.length > 0) setSelectedUid(res.rows[0].uid);
      }
      setIsLoading(false);
    });
  }, [tenantId]);

  useEffect(() => {
    getSystemAssets().then(setSystemAssets).catch(() => {});
  }, []);

  const selectedUser = decoratedUsers.find((u) => u.uid === selectedUid);

  const pageItems = useMemo(
    () => NAV_ITEMS.filter((item) => item.key !== 'dashboard'),
    [],
  );

  useEffect(() => {
    if (!selectedPageKey && pageItems.length > 0) {
      setSelectedPageKey(pageItems[0].key);
    }
  }, [selectedPageKey, pageItems]);

  const pageActionMap = {
    clientOnboarding: ['createClient', 'notifyCreateClient'],
    portalManagement: ['createPortal', 'notifyCreatePortal', 'directBalanceAdjust', 'notifyDirectBalanceAdjust', 'loanManagement', 'notifyLoanManagement', 'internalTransfer', 'notifyInternalTransfer'],
    dailyTransactions: ['recordDailyTransaction', 'softDeleteTransaction', 'notifySoftDeleteTransaction', 'hardDeleteTransaction'],
    proformaInvoices: [],
    quotations: ['extendQuotation', 'cancelQuotation'],
    receivePayments: [],
    invoiceManagement: [],
    operationExpenses: [],
    tasksTracking: [],
    documentCalendar: [],
  };
  const selectedActionKeys = pageActionMap[selectedPageKey] || [];

  if (isLoading) return <p className="text-xs text-(--c-muted)">Loading users...</p>;

  return (
    <div className="space-y-6">
      {/* User Selection Row */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-(--c-muted)">Select Tenant User</p>
          <span className="text-[10px] font-bold text-(--c-accent) bg-(--c-accent)/10 px-2 py-0.5 rounded-full">
            {decoratedUsers.length} Total
          </span>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
          {decoratedUsers.map((u) => (
            <button
              key={u.uid}
              type="button"
              onClick={() => setSelectedUid(u.uid)}
              className={`group flex min-w-[160px] max-w-[220px] items-stretch overflow-hidden rounded-2xl border text-left transition ${selectedUid === u.uid
                ? 'border-(--c-accent) bg-(--c-accent)/5 shadow-sm'
                : 'border-(--c-border) bg-(--c-panel) hover:border-(--c-muted)'
                }`}
            >
              <div className={`flex w-14 shrink-0 items-center justify-center overflow-hidden border-r ${selectedUid === u.uid ? 'border-(--c-accent)/30' : 'border-(--c-border)'} bg-white`}>
                {u.photoURL ? (
                  <img src={u.photoURL} alt={u.displayName || u.email || 'User'} className="h-full w-full object-cover" />
                ) : (
                  <span className={`text-sm font-black ${selectedUid === u.uid ? 'text-(--c-accent)' : 'text-(--c-text)'}`}>
                    {String(u.displayName || u.email || '?').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1 px-3 py-2">
                <p className={`text-[13px] font-black truncate ${selectedUid === u.uid ? 'text-(--c-accent)' : 'text-(--c-text)'}`}>
                  {u.displayName || 'Unnamed'}
                </p>
                <p className="text-[10px] uppercase font-bold text-(--c-muted)">
                  {normalizeRoleLabel(u.role)}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Content Area */}
      {selectedUser ? (
        <div className="space-y-6">
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--c-muted)]">Select Page</p>
              <span className="text-[10px] font-bold text-[var(--c-accent)] bg-[var(--c-accent)]/10 px-2 py-0.5 rounded-full">
                {pageItems.length} Total
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {pageItems.map((item) => {
                const isActive = selectedPageKey === item.key;
                const iconUrl = resolvePageIconUrl(systemAssets, item.icon);
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSelectedPageKey(item.key)}
                    className={`group flex min-h-[48px] items-stretch overflow-hidden rounded-2xl border text-left transition ${
                      isActive
                        ? 'border-[var(--c-accent)] bg-[color:color-mix(in_srgb,var(--c-accent)_12%,var(--c-panel))]'
                        : 'border-[var(--c-border)] bg-[var(--c-panel)] hover:border-[var(--c-accent)]/40'
                    }`}
                  >
                    <div className={`flex w-14 shrink-0 items-center justify-center overflow-hidden border-r ${isActive ? 'border-[var(--c-accent)]/30' : 'border-[var(--c-border)]'} bg-white`}>
                      {iconUrl ? (
                        <img src={iconUrl} alt={item.label} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-[var(--c-muted)] text-xs font-bold">{item.label?.[0] || 'P'}</span>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 items-center px-3 py-2">
                      <span className="block text-[13px] font-black text-[var(--c-text)]">{item.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
          <div className="flex items-center justify-between rounded-2xl border border-(--c-border) bg-(--c-surface) p-2 shadow-sm">
            <div className="rounded-xl bg-(--c-accent) px-5 py-2.5 text-xs font-bold text-white shadow-md">
              Function Access
            </div>
            <div className="hidden pr-4 sm:flex flex-col items-end">
              <p className="text-sm font-bold text-(--c-text)">{selectedUser.displayName}</p>
              <p className="text-[10px] uppercase font-bold text-(--c-muted)">{selectedUser.email || normalizeRoleLabel(selectedUser.role)}</p>
            </div>
          </div>

          <div className="grid gap-6">
            <UserFunctionAccessSection tenantId={tenantId} selectedUser={selectedUser} currentUser={currentUser} actionKeys={selectedActionKeys} />
          </div>
        </div>
      ) : (
        <div className="flex h-64 items-center justify-center rounded-3xl border-2 border-dashed border-(--c-border) bg-(--c-panel)/30">
          <div className="text-center">
            <p className="text-sm font-bold text-(--c-muted)">No User Selected</p>
            <p className="text-xs text-(--c-muted)/60">Choose a user from the row above to manage preferences</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserControlCenterSection;
