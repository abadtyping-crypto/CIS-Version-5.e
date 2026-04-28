import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import { fetchTenantClients, fetchTenantTransactions } from '../lib/backendStore';
import { useTenant } from '../context/useTenant';
import CurrencyValue from '../components/common/CurrencyValue';
import IdentityCardSelector from '../components/common/IdentityCardSelector';

const toDateLabel = (value) => {
  if (!value) return '-';
  if (typeof value?.toDate === 'function') return value.toDate().toLocaleString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleString();
};

const ClientDetailsPage = () => {
  const { clientId } = useParams();
  const { tenantId } = useTenant();
  const [isLoading, setIsLoading] = useState(true);
  const [client, setClient] = useState(null);
  const [rows, setRows] = useState([]);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    if (!tenantId || !clientId) return;
    let active = true;
    const loadData = async () => {
      setIsLoading(true);
      const [clientsRes, txRes] = await Promise.all([
        fetchTenantClients(tenantId),
        fetchTenantTransactions(tenantId),
      ]);
      if (!active) return;
      if (clientsRes.ok) {
        const allRows = clientsRes.rows || [];
        setRows(allRows);
        setClient(allRows.find((item) => item.id === clientId) || null);
      }
      if (txRes.ok) {
        setTransactions((txRes.rows || []).filter((tx) => !tx.deletedAt && tx.clientId === clientId));
      }
      setIsLoading(false);
    };
    const frame = requestAnimationFrame(() => {
      void loadData();
    });
    return () => {
      active = false;
      cancelAnimationFrame(frame);
    };
  }, [tenantId, clientId]);

  const dependents = useMemo(
    () => rows.filter((item) => String(item.parentId || '') === String(clientId)),
    [rows, clientId],
  );

  const totalClientTx = useMemo(
    () => transactions.reduce((sum, tx) => sum + Number(tx.amount || 0), 0),
    [transactions],
  );

  if (isLoading) {
    return (
      <PageShell title="Client Details" subtitle="Loading client profile..." iconKey="clientOnboarding">
        <div className="p-6 text-sm text-[var(--c-muted)]">Loading...</div>
      </PageShell>
    );
  }

  if (!client) {
    return (
      <PageShell title="Client Details" subtitle="Client not found" iconKey="clientOnboarding">
        <div className="space-y-3 p-6">
          <p className="text-sm text-[var(--c-muted)]">This client record could not be found in current tenant data.</p>
          <Link
            to={`/t/${tenantId}/client-onboarding`}
            className="inline-flex rounded-xl border border-[var(--c-border)] px-4 py-2 text-sm font-bold text-[var(--c-text)]"
          >
            Back to Client Onboarding
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={client.tradeName || client.fullName || 'Client Profile'}
      subtitle={`Client 360 • ${client.displayClientId || client.id}`}
      widthPreset="data"
      iconKey="clientOnboarding"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/t/${tenantId}/client-onboarding`}
            className="rounded-xl border border-[var(--c-border)] px-3 py-1.5 text-xs font-bold text-[var(--c-text)]"
          >
            Back to Live List
          </Link>
          <Link
            to={`/t/${tenantId}/daily-transactions?clientId=${clientId}`}
            className="rounded-xl bg-[var(--c-accent)] px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:scale-105"
          >
            + Add Transaction
          </Link>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
            <p className="text-[11px] uppercase tracking-wider text-[var(--c-muted)]">Type</p>
            <p className="mt-2 text-sm font-bold text-[var(--c-text)]">{String(client.type || '-').toUpperCase()}</p>
          </article>
          <article className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
            <p className="text-[11px] uppercase tracking-wider text-[var(--c-muted)]">Opening Balance</p>
            <p className="mt-2 text-sm font-bold text-[var(--c-text)]">
              <CurrencyValue value={client.openingBalance || 0} iconSize="h-3 w-3" />
            </p>
          </article>
          <article className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
            <p className="text-[11px] uppercase tracking-wider text-[var(--c-muted)]">Transactions</p>
            <p className="mt-2 text-sm font-bold text-[var(--c-text)]">{transactions.length}</p>
          </article>
          <article className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
            <p className="text-[11px] uppercase tracking-wider text-[var(--c-muted)]">Dependents</p>
            <p className="mt-2 text-sm font-bold text-[var(--c-text)]">{dependents.length}</p>
          </article>
        </section>

        <section className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
          <h3 className="text-sm font-black text-[var(--c-text)]">Profile Information</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 text-xs">
            <p className="text-[var(--c-muted)]">Primary Mobile: <span className="font-bold text-[var(--c-text)]">{client.primaryMobile || '-'}</span></p>
            <p className="text-[var(--c-muted)]">Primary Email: <span className="font-bold text-[var(--c-text)]">{client.primaryEmail || '-'}</span></p>
            <p className="text-[var(--c-muted)]">Created: <span className="font-bold text-[var(--c-text)]">{toDateLabel(client.createdAt)}</span></p>
            <p className="text-[var(--c-muted)]">Status: <span className="font-bold text-[var(--c-text)]">{client.status || 'active'}</span></p>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-black text-[var(--c-text)]">Transactions</h3>
            <span className="text-xs font-bold text-[var(--c-muted)]">
              Net: <CurrencyValue value={totalClientTx} iconSize="h-3 w-3" />
            </span>
          </div>
          {transactions.length === 0 ? (
            <p className="py-4 text-center text-xs text-[var(--c-muted)]">No client-linked transactions yet.</p>
          ) : (
            <div className="desktop-table-scroll overflow-x-auto rounded-xl border border-[var(--c-border)]">
              <table className="min-w-full text-xs">
                <thead className="bg-[var(--c-panel)] text-[var(--c-muted)] uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">ID</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions
                    .slice()
                    .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
                    .map((tx) => (
                      <tr key={tx.id} className="border-t border-[var(--c-border)]">
                        <td className="px-3 py-2">{tx.displayTransactionId || tx.id}</td>
                        <td className="px-3 py-2">{tx.type || '-'}</td>
                        <td className="px-3 py-2">{toDateLabel(tx.date)}</td>
                        <td className={`px-3 py-2 text-right font-bold ${Number(tx.amount || 0) < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                          <CurrencyValue value={tx.amount || 0} iconSize="h-3 w-3" />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
          <h3 className="text-sm font-black text-[var(--c-text)]">Dependents</h3>
          {dependents.length === 0 ? (
            <p className="py-4 text-center text-xs text-[var(--c-muted)]">No dependents linked to this client.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {dependents.map((dep) => (
                <IdentityCardSelector
                  key={dep.id}
                  entity={dep}
                  tenantId={tenantId}
                  clientId={clientId}
                  dependentId={dep.id}
                  isDependent
                  parentClientName={client.tradeName || client.fullName || ''}
                  parentClientId={client.displayClientId || client.id || clientId}
                  size="sm"
                  className="bg-[var(--c-panel)]"
                />
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
          <h3 className="text-sm font-black text-[var(--c-text)]">Documents / Payments / Invoices</h3>
          <p className="mt-2 text-xs text-[var(--c-muted)]">
            This page is now routed and active. Next step can connect your invoice, payment receipt, and statement collections here.
          </p>
        </section>
      </div>
    </PageShell>
  );
};

export default ClientDetailsPage;
