import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SectionCard from './SectionCard';
import { fetchTenantPortals } from '../../lib/backendStore';
import { useTenant } from '../../context/useTenant';
import CurrencyValue from '../common/CurrencyValue';
import { DEFAULT_PORTAL_ICON, resolvePortalTypeIcon } from '../../lib/transactionMethodConfig';

const fallbackPortalIcon = (type) => resolvePortalTypeIcon(type);

const formatCurrency = (value) => {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('en-AE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const PortalSummarySection = ({ onQuickAction, refreshKey }) => {
  const navigate = useNavigate();
  const { tenantId } = useTenant();
  const [portals, setPortals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPortalIds, setSelectedPortalIds] = useState([]);

  useEffect(() => {
    if (!tenantId) return;
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      setIsLoading(true);
      return fetchTenantPortals(tenantId).then((res) => {
        if (!active) return;
        if (res.ok) {
          const rows = Array.isArray(res.rows) ? res.rows : [];
          setPortals(rows);
          setSelectedPortalIds((prev) => prev.filter((id) => rows.some((item) => item.id === id)));
        }
        setIsLoading(false);
      });
    });
    return () => {
      active = false;
    };
  }, [tenantId, refreshKey]);

  const selectedPortals = useMemo(
    () => portals.filter((item) => selectedPortalIds.includes(item.id)),
    [portals, selectedPortalIds],
  );

  const selectedBalanceTotal = useMemo(
    () => selectedPortals.reduce((sum, item) => sum + Number(item.balance || 0), 0),
    [selectedPortals],
  );

  const togglePortal = (portalId) => {
    setSelectedPortalIds((prev) =>
      prev.includes(portalId) ? prev.filter((id) => id !== portalId) : [...prev, portalId],
    );
  };

  const handleSelectAll = () => {
    setSelectedPortalIds(portals.map((item) => item.id));
  };

  const handleClear = () => {
    setSelectedPortalIds([]);
  };

  const handlePrintSelected = () => {
    if (selectedPortals.length === 0) return;
    const summaryHtml = selectedPortals
      .map((item, index) => {
        const methods = Array.isArray(item.methods) && item.methods.length > 0
          ? item.methods.join(', ')
          : 'No methods configured';
        const balance = Number(item.balance || 0);
        const balanceTone = balance < 0 ? '#d14343' : '#157347';
        return `
          <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(item.id)}</td>
            <td>${escapeHtml(item.name || item.id)}</td>
            <td>${escapeHtml(item.type || '-')}</td>
            <td>${escapeHtml(item.status || 'active')}</td>
            <td>${escapeHtml(methods)}</td>
            <td style="color:${balanceTone}; font-weight:700;">Dhs ${escapeHtml(formatCurrency(balance))}</td>
          </tr>
        `;
      })
      .join('');

    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=900');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Portal Summary</title>
          <style>
            body {
              font-family: "Segoe UI", Arial, sans-serif;
              margin: 32px;
              color: #20160f;
              background: #ffffff;
            }
            .header {
              margin-bottom: 24px;
            }
            .eyebrow {
              font-size: 12px;
              letter-spacing: 0.18em;
              text-transform: uppercase;
              color: #8b6b50;
              font-weight: 700;
              margin-bottom: 8px;
            }
            h1 {
              margin: 0 0 8px;
              font-size: 28px;
              line-height: 1.1;
            }
            .meta {
              font-size: 14px;
              color: #6c4f39;
            }
            .summary {
              display: grid;
              grid-template-columns: repeat(3, minmax(0, 1fr));
              gap: 12px;
              margin: 20px 0 24px;
            }
            .stat {
              border: 1px solid #e5d1bf;
              border-radius: 16px;
              padding: 14px 16px;
              background: #fff8f2;
            }
            .stat .label {
              font-size: 11px;
              letter-spacing: 0.14em;
              text-transform: uppercase;
              color: #8b6b50;
              font-weight: 700;
              margin-bottom: 6px;
            }
            .stat .value {
              font-size: 22px;
              font-weight: 800;
              color: #20160f;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              border: 1px solid #e5d1bf;
              border-radius: 18px;
              overflow: hidden;
            }
            thead {
              background: #f7e4d0;
            }
            th, td {
              padding: 12px 14px;
              text-align: left;
              font-size: 13px;
              border-bottom: 1px solid #efdfd0;
              vertical-align: top;
            }
            th {
              font-size: 11px;
              letter-spacing: 0.14em;
              text-transform: uppercase;
              color: #8b6b50;
            }
            tbody tr:nth-child(even) {
              background: #fffaf6;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="eyebrow">Portal Management</div>
            <h1>Selected Portal Summary</h1>
            <div class="meta">Generated on ${escapeHtml(new Date().toLocaleString())}</div>
          </div>
          <div class="summary">
            <div class="stat">
              <div class="label">Selected Portals</div>
              <div class="value">${selectedPortals.length}</div>
            </div>
            <div class="stat">
              <div class="label">Combined Balance</div>
              <div class="value">Dhs ${escapeHtml(formatCurrency(selectedBalanceTotal))}</div>
            </div>
            <div class="stat">
              <div class="label">Tenant</div>
              <div class="value">${escapeHtml(tenantId || '-')}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Portal ID</th>
                <th>Portal Name</th>
                <th>Type</th>
                <th>Status</th>
                <th>Allowed Methods</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>${summaryHtml}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  };

  return (
    <SectionCard
      title="Portal Summary"
      subtitle="Select one or more portals and print a clean combined summary."
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--c-muted)]">Selected Portals</p>
            <p className="mt-1.5 text-xl font-semibold text-[var(--c-text)]">{selectedPortals.length}</p>
          </div>
          <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--c-muted)]">Combined Balance</p>
            <div className={`mt-1.5 text-base font-semibold ${selectedBalanceTotal < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
              <CurrencyValue value={selectedBalanceTotal} iconSize="h-4 w-4" />
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--c-muted)]">Print Ready</p>
            <p className="mt-1.5 text-[13px] font-semibold text-[var(--c-text)]">
              {selectedPortals.length > 0 ? 'Selected portals can be printed now.' : 'Select portals to enable printing.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSelectAll}
            disabled={isLoading || portals.length === 0}
            className="rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-4 py-2 text-xs font-bold text-[var(--c-text)] transition hover:border-[var(--c-accent)] hover:text-[var(--c-accent)] disabled:opacity-50"
          >
            Select All
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={selectedPortalIds.length === 0}
            className="rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-4 py-2 text-xs font-bold text-[var(--c-text)] transition hover:border-[var(--c-accent)] hover:text-[var(--c-accent)] disabled:opacity-50"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={handlePrintSelected}
            disabled={selectedPortalIds.length === 0}
            className="rounded-xl border border-[var(--c-accent)] bg-[color:color-mix(in_srgb,var(--c-accent)_14%,transparent)] px-4 py-2 text-xs font-bold text-[var(--c-accent)] transition hover:bg-[var(--c-accent)] hover:text-white disabled:opacity-50"
          >
            Print Selected
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--c-accent)] border-t-transparent" />
          </div>
        ) : portals.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--c-border)] bg-[var(--c-panel)] p-5 text-sm text-[var(--c-muted)]">
            No portals found yet. Create a portal first.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {portals.map((portal) => {
              const isSelected = selectedPortalIds.includes(portal.id);
              const balance = Number(portal.balance || 0);
              const isNegative = balance < 0;
              return (
                <div
                  key={portal.id}
                  className={`rounded-2xl border p-3 transition ${
                    isSelected
                      ? 'border-[var(--c-accent)] bg-[color:color-mix(in_srgb,var(--c-accent)_10%,var(--c-surface))] shadow-[0_18px_40px_-28px_var(--c-accent)]'
                      : 'border-[var(--c-border)] bg-[var(--c-surface)]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => togglePortal(portal.id)}
                      className="flex min-w-0 flex-1 items-start gap-3 text-left"
                    >
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-[var(--c-border)] bg-white">
                        <img
                          src={portal.iconUrl || fallbackPortalIcon(portal.type)}
                          alt={portal.name || portal.id}
                          className="h-full w-full object-contain"
                          onError={(event) => {
                            event.currentTarget.onerror = null;
                            event.currentTarget.src = DEFAULT_PORTAL_ICON;
                          }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-[var(--c-text)]">{portal.name || portal.id}</p>
                          {isSelected ? (
                            <span className="rounded-full border border-[var(--c-accent)]/30 bg-[color:color-mix(in_srgb,var(--c-accent)_16%,transparent)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--c-accent)]">
                              Selected
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 truncate text-[11px] font-semibold text-[var(--c-muted)]">Portal ID: {portal.id}</p>
                        <p className="mt-1 text-[11px] font-semibold text-[var(--c-muted)]">
                          {portal.type || 'Portal'} • {portal.status || 'active'}
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/t/${tenantId}/portal-management/${portal.id}`)}
                      className="rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2 text-[11px] font-bold text-[var(--c-text)] transition hover:border-[var(--c-accent)] hover:text-[var(--c-accent)]"
                    >
                      Open
                    </button>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--c-muted)]">Balance</p>
                      <div className={`mt-1 text-sm font-semibold ${isNegative ? 'text-rose-500' : 'text-emerald-500'}`}>
                        <CurrencyValue value={balance} iconSize="h-3.5 w-3.5" />
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--c-muted)]">Methods</p>
                      <p className="mt-1 text-xs font-bold text-[var(--c-text)]">
                        {Array.isArray(portal.methods) ? portal.methods.length : 0} configured
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onQuickAction('loan')}
            className="rounded-xl border border-[var(--c-accent)]/35 bg-[color:color-mix(in_srgb,var(--c-accent)_12%,transparent)] px-4 py-2 text-xs font-bold text-[var(--c-accent)] transition hover:bg-[var(--c-accent)] hover:text-white"
          >
            + New Loan
          </button>
          <button
            type="button"
            onClick={() => onQuickAction('transfer')}
            className="rounded-xl border border-[var(--c-accent)]/35 bg-[color:color-mix(in_srgb,var(--c-accent)_12%,transparent)] px-4 py-2 text-xs font-bold text-[var(--c-accent)] transition hover:bg-[var(--c-accent)] hover:text-white"
          >
            ⇄ Internal Transfer
          </button>
          <button
            type="button"
            onClick={() => onQuickAction('setup')}
            className="rounded-xl border border-[var(--c-accent)]/35 bg-[color:color-mix(in_srgb,var(--c-accent)_12%,transparent)] px-4 py-2 text-xs font-bold text-[var(--c-accent)] transition hover:bg-[var(--c-accent)] hover:text-white"
          >
            ⚙️ Portal Setup
          </button>
        </div>
      </div>
    </SectionCard>
  );
};

export default PortalSummarySection;
