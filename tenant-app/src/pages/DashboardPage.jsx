import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard } from 'lucide-react';
import PageShell from '../components/layout/PageShell';
import { useTenant } from '../context/useTenant';
import { useAuth } from '../context/useAuth';
import CurrencyValue from '../components/common/CurrencyValue';
import {
  fetchLoanPersons,
  fetchLoanPendingBalances,
  fetchTenantClients,
  fetchTenantClientPayments,
  fetchTenantPortals,
  fetchTenantProformaInvoices,
  fetchTenantQuotations,
} from '../lib/backendStore';
import { resolvePortalTypeIcon } from '../lib/transactionMethodConfig';

const fallbackPortalIcon = (type) => resolvePortalTypeIcon(type);

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const toFirstName = (user) => {
  const raw = String(user?.displayName || '').trim();
  if (raw && !emailRegex.test(raw)) return raw.split(' ')[0];
  const email = String(user?.email || '').trim().toLowerCase();
  if (emailRegex.test(email)) return email.split('@')[0];
  return 'there';
};

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const statusBadgeClass = (status) => {
  const s = String(status || '').toLowerCase();
  if (s === 'canceled' || s === 'expired') return 'text-rose-500';
  if (s === 'paid') return 'text-emerald-500';
  if (s === 'partially_paid') return 'text-amber-500';
  if (s === 'sent') return 'text-sky-500';
  return 'text-[var(--c-muted)]';
};

const statusLabel = (status) => {
  const s = String(status || '').toLowerCase();
  if (s === 'partially_paid') return 'Partial';
  if (s === 'generated' || !s) return 'Open';
  if (s === 'drafted') return 'Draft';
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const dedupeRowsByIdentity = (rows = []) => {
  const seen = new Set();
  return rows.filter((row, index) => {
    const identity = String(
      row?.id ||
      row?.displayRef ||
      row?.displayQuotationId ||
      row?.displayProformaId ||
      `${row?.clientId || 'row'}-${index}`,
    );
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
};

const KpiCard = ({ label, value, sub }) => (
  <article className="compact-section rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)]">
    <p className="text-xs uppercase tracking-[0.16em] text-[var(--c-muted)]">{label}</p>
    <p className="mt-1.5 text-[1.35rem] font-semibold text-[var(--c-text)]">{value}</p>
    <p className="text-[13px] text-[var(--c-muted)]">{sub}</p>
  </article>
);

const DashboardPage = () => {
  const navigate = useNavigate();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [portals, setPortals] = useState([]);
  const [loanSummary, setLoanSummary] = useState([]);
  const [clients, setClients] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [proformas, setProformas] = useState([]);
  const [payments, setPayments] = useState([]);
  const [showAllPortals, setShowAllPortals] = useState(false);
  const [showAllLoans, setShowAllLoans] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    let active = true;
    const loadData = async () => {
      setIsLoading(true);
      const [portalRes, personRes, txRes, clientRes, quotationRes, proformaRes, paymentRes] =
        await Promise.all([
          fetchTenantPortals(tenantId),
          fetchLoanPersons(tenantId),
          fetchLoanPendingBalances(tenantId),
          fetchTenantClients(tenantId),
          fetchTenantQuotations(tenantId),
          fetchTenantProformaInvoices(tenantId),
          fetchTenantClientPayments(tenantId),
        ]);
      if (!active) return;
      if (portalRes.ok) setPortals(portalRes.rows || []);
      if (personRes.ok) {
        const people = (personRes.rows || []).filter((p) => !p.deletedAt);
        const pendingByPerson = txRes.ok ? (txRes.rows || {}) : {};
        setLoanSummary(
          people.map((person) => ({
            ...person,
            pendingBalance: pendingByPerson[person.id] || 0,
          })),
        );
      }
      if (clientRes.ok) setClients(clientRes.rows || []);
      if (quotationRes.ok) setQuotations(quotationRes.rows || []);
      if (proformaRes.ok) setProformas(proformaRes.rows || []);
      if (paymentRes.ok) setPayments(paymentRes.rows || []);
      setIsLoading(false);
    };

    const frame = requestAnimationFrame(() => {
      void loadData();
    });

    return () => {
      active = false;
      cancelAnimationFrame(frame);
    };
  }, [tenantId]);

  const totalPortalBalance = useMemo(
    () => portals.reduce((sum, item) => sum + Number(item.balance || 0), 0),
    [portals],
  );

  const totalLoanOutstanding = useMemo(
    () => loanSummary.reduce((sum, item) => sum + Number(item.pendingBalance || 0), 0),
    [loanSummary],
  );

  const activeQuotations = useMemo(
    () => quotations.filter((q) => String(q.status || '').toLowerCase() !== 'canceled'),
    [quotations],
  );

  const rootClients = useMemo(
    () => clients.filter((c) => String(c.type || '').toLowerCase() !== 'dependent'),
    [clients],
  );

  const openProformas = useMemo(
    () =>
      proformas.filter((p) => {
        const status = String(p.status || '').toLowerCase();
        return status !== 'paid' && status !== 'canceled';
      }),
    [proformas],
  );

  const recentQuotations = useMemo(
    () =>
      dedupeRowsByIdentity(activeQuotations)
        .filter((q) => String(q.status || '').toLowerCase() !== 'expired' && !q.proformaId)
        .slice(0, 5),
    [activeQuotations],
  );

  const recentProformas = useMemo(() => dedupeRowsByIdentity(openProformas).slice(0, 5), [openProformas]);

  const loanPersonsWithBalance = useMemo(
    () => loanSummary.filter((p) => Number(p.pendingBalance || 0) > 0),
    [loanSummary],
  );

  const visiblePortals = showAllPortals ? portals : portals.slice(0, 3);

  return (
    <PageShell
      pageID="dashboard"
      widthPreset="data"
    >
      {/* Welcome row */}
      <div className="mb-4 flex items-baseline gap-2">
        <p className="text-base font-semibold text-[var(--c-text)]">
          {getGreeting()}, {toFirstName(user)}.
        </p>
        <p className="text-xs text-[var(--c-muted)]">
          {new Date().toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {/* KPI row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          label="Active Clients"
          value={isLoading ? '—' : rootClients.length}
          sub="Registered clients"
        />
        <KpiCard
          label="Quotations"
          value={isLoading ? '—' : activeQuotations.length}
          sub="Non-canceled"
        />
        <KpiCard
          label="Proformas"
          value={isLoading ? '—' : proformas.length}
          sub="Total issued"
        />
        <KpiCard
          label="Payments Received"
          value={isLoading ? '—' : payments.length}
          sub="Recorded payments"
        />
        <article className="compact-section rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)]">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--c-muted)]">Net Liquidity</p>
          <div className="mt-1.5 text-[1.35rem] font-semibold text-[var(--c-text)]">
            {isLoading ? (
              <span className="text-[var(--c-muted)]">—</span>
            ) : (
              <CurrencyValue value={totalPortalBalance - totalLoanOutstanding} iconSize="h-6 w-6" />
            )}
          </div>
          <p className="text-[13px] text-[var(--c-muted)]">Portals less loan exposure</p>
        </article>
      </div>

      {/* Operational overview: Portal Summary + Loan Summary */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Portal Summary */}
        <article className="compact-section rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)]">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--c-text)]">Portal Summary</p>
              <p className="text-xs text-[var(--c-muted)]">
                {isLoading
                  ? 'Loading…'
                  : portals.length === 0
                    ? 'No portals configured'
                    : `${portals.length} portal${portals.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            {portals.length > 3 && (
              <button
                type="button"
                onClick={() => setShowAllPortals((prev) => !prev)}
                className="rounded-lg border border-[var(--c-border)] px-2.5 py-1 text-[11px] font-semibold text-[var(--c-muted)] hover:text-[var(--c-text)]"
              >
                {showAllPortals ? 'Collapse' : `+${portals.length - 3} more`}
              </button>
            )}
          </div>
          <div className="space-y-2">
            {isLoading ? (
              <p className="py-4 text-center text-xs text-[var(--c-muted)]">Loading…</p>
            ) : portals.length === 0 ? (
              <p className="py-4 text-center text-xs text-[var(--c-muted)]">No portals configured.</p>
            ) : (
              visiblePortals.map((portal) => (
                <button
                  key={portal.id}
                  type="button"
                  onClick={() => navigate(`/t/${tenantId}/portal-management/${portal.id}`)}
                  className="flex w-full items-center gap-2.5 rounded-xl border border-[var(--c-border)] bg-gradient-to-br from-[var(--c-surface)] to-[var(--c-panel)] px-2.5 py-2 text-left transition hover:border-[var(--c-accent)]"
                  aria-label={`Open ${portal.name} details`}
                >
                  <div className="h-10 w-10 overflow-hidden rounded-lg">
                    <img
                      src={portal.iconUrl || fallbackPortalIcon(portal.type)}
                      alt={portal.name}
                      className="h-full w-full object-cover"
                      onError={(event) => {
                        event.currentTarget.onerror = null;
                        event.currentTarget.src = fallbackPortalIcon(portal.type);
                      }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--c-text)]">{portal.name}</p>
                    <p className={`text-xs font-semibold ${portal.balance < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                      <CurrencyValue value={portal.balance || 0} iconSize="h-3 w-3" />
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </article>

        {/* Loan Summary */}
        <article className="compact-section rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)]">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--c-text)]">Loan Summary</p>
              <p className="text-xs text-[var(--c-muted)]">
                {isLoading
                  ? 'Loading…'
                  : loanPersonsWithBalance.length === 0
                    ? 'No outstanding balances'
                    : `${loanPersonsWithBalance.length} person${loanPersonsWithBalance.length !== 1 ? 's' : ''} with balance`}
              </p>
            </div>
            {!isLoading && loanPersonsWithBalance.length > 0 && (
              <button
                type="button"
                onClick={() => setShowAllLoans((prev) => !prev)}
                className="rounded-lg border border-[var(--c-border)] px-2.5 py-1 text-[11px] font-semibold text-[var(--c-muted)] hover:text-[var(--c-text)]"
              >
                {showAllLoans ? 'Collapse' : 'Expand'}
              </button>
            )}
          </div>
          <div className="mb-3 rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--c-muted)]">
              Total Pending
            </p>
            <p className={`text-sm font-semibold ${totalLoanOutstanding > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
              <CurrencyValue value={totalLoanOutstanding} iconSize="h-3.5 w-3.5" />
            </p>
          </div>
          {showAllLoans && !isLoading && (
            <div className="space-y-2">
              {loanPersonsWithBalance.length === 0 ? (
                <p className="py-3 text-center text-xs text-[var(--c-muted)]">No outstanding balances.</p>
              ) : (
                loanPersonsWithBalance.map((person) => (
                  <div
                    key={person.id}
                    className="flex items-center justify-between rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-1.5"
                  >
                    <p className="truncate text-sm font-semibold text-[var(--c-text)]">{person.name}</p>
                    <p className="text-xs font-semibold text-amber-500">
                      <CurrencyValue value={person.pendingBalance} iconSize="h-3 w-3" />
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </article>
      </div>

      {/* Commercial Workflow */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Recent Quotations */}
        <article className="compact-section rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)]">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--c-text)]">Quotations</p>
              <p className="text-xs text-[var(--c-muted)]">Recent open quotations</p>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/t/${tenantId}/quotations`)}
              className="rounded-lg border border-[var(--c-border)] px-2.5 py-1 text-[11px] font-semibold text-[var(--c-muted)] hover:text-[var(--c-text)]"
            >
              View all
            </button>
          </div>
          <div className="space-y-1.5">
            {isLoading ? (
              <p className="py-4 text-center text-xs text-[var(--c-muted)]">Loading…</p>
            ) : recentQuotations.length === 0 ? (
              <p className="py-4 text-center text-xs text-[var(--c-muted)]">No open quotations.</p>
            ) : (
              recentQuotations.map((q) => (
                <div
                  key={`quotation-${q.id || q.displayRef || q.clientId || 'unknown'}`}
                  className="flex items-center justify-between rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-[var(--c-text)]">{q.displayRef || q.id}</p>
                    <p className="truncate text-[11px] text-[var(--c-muted)]">
                      {q.clientSnapshot?.name || q.clientSnapshot?.tradeName || '—'}
                    </p>
                  </div>
                  <div className="ml-3 shrink-0 text-right">
                    <p className={`text-[11px] font-bold ${statusBadgeClass(q.status)}`}>
                      {statusLabel(q.status)}
                    </p>
                    <p className="text-[11px] font-semibold text-[var(--c-text)]">
                      <CurrencyValue value={q.totalAmount || 0} iconSize="h-3 w-3" />
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        {/* Proformas */}
        <article className="compact-section rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)]">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--c-text)]">Proformas</p>
              <p className="text-xs text-[var(--c-muted)]">Open and partially settled proformas</p>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/t/${tenantId}/proforma-invoices`)}
              className="rounded-lg border border-[var(--c-border)] px-2.5 py-1 text-[11px] font-semibold text-[var(--c-muted)] hover:text-[var(--c-text)]"
            >
              View all
            </button>
          </div>
          <div className="space-y-1.5">
            {isLoading ? (
              <p className="py-4 text-center text-xs text-[var(--c-muted)]">Loading…</p>
            ) : recentProformas.length === 0 ? (
              <p className="py-4 text-center text-xs text-[var(--c-muted)]">No open proformas.</p>
            ) : (
              recentProformas.map((p) => (
                <div
                  key={`proforma-${p.id || p.displayRef || p.clientId || 'unknown'}`}
                  className="flex items-center justify-between rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-[var(--c-text)]">{p.displayRef || p.id}</p>
                    <p className="truncate text-[11px] text-[var(--c-muted)]">
                      {p.clientSnapshot?.name || p.clientSnapshot?.tradeName || '—'}
                    </p>
                  </div>
                  <div className="ml-3 shrink-0 text-right">
                    <p className={`text-[11px] font-bold ${statusBadgeClass(p.status)}`}>
                      {statusLabel(p.status)}
                    </p>
                    <p className="text-[11px] font-semibold text-[var(--c-text)]">
                      <CurrencyValue value={p.totalAmount || 0} iconSize="h-3 w-3" />
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
      </div>

      {/* Safety / Analysis — reserved slot for future modules */}
    </PageShell>
  );
};

export default DashboardPage;
