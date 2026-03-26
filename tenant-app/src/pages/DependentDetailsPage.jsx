import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import { useTenant } from '../context/useTenant';
import { fetchTenantClients, fetchTenantTransactions } from '../lib/backendStore';
import CurrencyValue from '../components/common/CurrencyValue';

const toDateLabel = (value) => {
  if (!value) return '-';
  if (typeof value?.toDate === 'function') return value.toDate().toLocaleString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleString();
};

const DependentDetailsPage = () => {
  const { clientId, dependentId } = useParams();
  const { tenantId } = useTenant();

  const [isLoading, setIsLoading] = useState(true);
  const [parent, setParent] = useState(null);
  const [dependent, setDependent] = useState(null);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    if (!tenantId || !clientId || !dependentId) return;
    let active = true;
    const loadData = async () => {
      setIsLoading(true);
      const [clientsRes, txRes] = await Promise.all([
        fetchTenantClients(tenantId),
        fetchTenantTransactions(tenantId),
      ]);
      if (!active) return;

      if (clientsRes.ok) {
        const rows = clientsRes.rows || [];
        setParent(rows.find((item) => item.id === clientId) || null);
        setDependent(rows.find((item) => item.id === dependentId) || null);
      }

      if (txRes.ok) {
        setTransactions((txRes.rows || []).filter((tx) => !tx.deletedAt && tx.dependentId === dependentId));
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
  }, [tenantId, clientId, dependentId]);

  const relationshipIsValid = useMemo(() => {
    if (!parent || !dependent) return false;
    return String(dependent.parentId || '') === String(parent.id);
  }, [parent, dependent]);

  const totalTx = useMemo(
    () => transactions.reduce((sum, tx) => sum + Number(tx.amount || 0), 0),
    [transactions],
  );

  const isDependentType = String(dependent?.type || '').toLowerCase() === 'dependent';
  const pageTitle = dependent?.fullName || dependent?.tradeName || 'Dependent Profile';
  const pageSubtitle = dependent
    ? `${dependent.displayClientId || dependent.id} | Dependent`
    : 'Dependent record';

  if (isLoading) {
    return (
      <PageShell title="Dependent Details" subtitle="Loading dependent profile..." iconKey="clientOnboarding">
        <div className="p-6 text-sm text-[var(--c-muted)]">Loading...</div>
      </PageShell>
    );
  }

  const notFound = !dependent || !isDependentType || !relationshipIsValid;

  if (notFound) {
    return (
      <PageShell title="Dependent Details" subtitle="Dependent not found" iconKey="clientOnboarding">
        <div className="space-y-3 p-6">
          <p className="text-sm text-[var(--c-muted)]">
            We could not find this dependent under the selected client.
          </p>
          <div className="flex flex-wrap gap-2">
            {parent ? (
              <Link
                to={`/t/${tenantId}/clients/${clientId}`}
                className="inline-flex rounded-xl border border-[var(--c-border)] px-4 py-2 text-sm font-bold text-[var(--c-text)]"
              >
                Back to Client
              </Link>
            ) : null}
            <Link
              to={`/t/${tenantId}/client-onboarding`}
              className="inline-flex rounded-xl border border-[var(--c-border)] px-4 py-2 text-sm font-bold text-[var(--c-text)]"
            >
              Back to Onboarding
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title={pageTitle} subtitle={pageSubtitle} widthPreset="data" iconKey="clientOnboarding">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/t/${tenantId}/clients/${clientId}`}
            className="rounded-xl border border-[var(--c-border)] px-3 py-1.5 text-xs font-bold text-[var(--c-text)]"
          >
            Back to Client
          </Link>
          <Link
            to={`/t/${tenantId}/client-onboarding`}
            className="rounded-xl border border-[var(--c-border)] px-3 py-1.5 text-xs font-bold text-[var(--c-text)]"
          >
            Live List
          </Link>
          <Link
            to={`/t/${tenantId}/daily-transactions?clientId=${clientId}&dependentId=${dependentId}`}
            className="rounded-xl bg-[var(--c-accent)] px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:scale-105"
          >
            + Add Transaction
          </Link>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
            <p className="text-[11px] uppercase tracking-wider text-[var(--c-muted)]">Relationship</p>
            <p className="mt-2 text-sm font-bold text-[var(--c-text)]">
              {dependent.relationship || 'Dependent'}
            </p>
          </article>
          <article className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
            <p className="text-[11px] uppercase tracking-wider text-[var(--c-muted)]">Parent</p>
            <Link
              to={`/t/${tenantId}/clients/${clientId}`}
              className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-[var(--c-text)] hover:text-[var(--c-accent)]"
            >
              {parent?.tradeName || parent?.fullName || parent?.displayClientId || clientId}
            </Link>
          </article>
          <article className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
            <p className="text-[11px] uppercase tracking-wider text-[var(--c-muted)]">Transactions</p>
            <p className="mt-2 text-sm font-bold text-[var(--c-text)]">{transactions.length}</p>
          </article>
          <article className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
            <p className="text-[11px] uppercase tracking-wider text-[var(--c-muted)]">Status</p>
            <p className="mt-2 text-sm font-bold text-[var(--c-text)]">{dependent.status || 'active'}</p>
          </article>
        </section>

        <section className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
          <h3 className="text-sm font-black text-[var(--c-text)]">Profile Information</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 text-xs">
            <p className="text-[var(--c-muted)]">
              Full Name:{' '}
              <span className="font-bold text-[var(--c-text)]">
                {dependent.fullName || dependent.tradeName || '-'}
              </span>
            </p>
            <p className="text-[var(--c-muted)]">
              Relationship:{' '}
              <span className="font-bold text-[var(--c-text)]">{dependent.relationship || 'Dependent'}</span>
            </p>
            <p className="text-[var(--c-muted)]">
              Primary Mobile:{' '}
              <span className="font-bold text-[var(--c-text)]">{dependent.primaryMobile || '-'}</span>
            </p>
            <p className="text-[var(--c-muted)]">
              Primary Email:{' '}
              <span className="font-bold text-[var(--c-text)]">{dependent.primaryEmail || '-'}</span>
            </p>
            <p className="text-[var(--c-muted)]">
              Date of Birth:{' '}
              <span className="font-bold text-[var(--c-text)]">{dependent.dateOfBirth || '-'}</span>
            </p>
            <p className="text-[var(--c-muted)]">
              Created:{' '}
              <span className="font-bold text-[var(--c-text)]">{toDateLabel(dependent.createdAt)}</span>
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-black text-[var(--c-text)]">Transactions</h3>
            <span className="text-xs font-bold text-[var(--c-muted)]">
              Net: <CurrencyValue value={totalTx} iconSize="h-3 w-3" />
            </span>
          </div>
          {transactions.length === 0 ? (
            <p className="py-4 text-center text-xs text-[var(--c-muted)]">No transactions linked to this dependent.</p>
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
          <h3 className="text-sm font-black text-[var(--c-text)]">Documents / Payments / Invoices</h3>
          <p className="mt-2 text-xs text-[var(--c-muted)]">
            This nested page is active. You can wire invoices, payments, and statements here without changing the data model.
          </p>
        </section>
      </div>
    </PageShell>
  );
};

export default DependentDetailsPage;
