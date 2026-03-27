import { useState, useEffect } from 'react';
import { History, ExternalLink, Copy, Search, FileText } from 'lucide-react';
import { fetchTenantProformaInvoices } from '../../lib/backendStore';
import CurrencyValue from '../common/CurrencyValue';

const ClientHistoryPanel = ({ tenantId, clientId, onClone }) => {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadHistory = async () => {
      if (!tenantId || !clientId) {
        setHistory([]);
        return;
      }
      setIsLoading(true);
      const res = await fetchTenantProformaInvoices(tenantId);
      if (res.ok) {
        const clientPIs = (res.rows || [])
          .filter(pi => pi.clientId === clientId)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 5); // Latest 5
        setHistory(clientPIs);
      }
      setIsLoading(false);
    };
    loadHistory();
  }, [tenantId, clientId]);

  if (!clientId) return null;

  return (
    <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)]/30 overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--c-border)] bg-[var(--c-panel)]">
        <div className="flex items-center gap-2">
          <History strokeWidth={1.5} size={14} className="text-[var(--c-accent)]" />
          <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--c-text)]">Client PI History</h3>
        </div>
        <span className="text-[10px] font-bold text-[var(--c-muted)] uppercase">{history.length} Recent</span>
      </header>

      <div className="p-2 space-y-2">
        {isLoading ? (
          <div className="py-8 text-center">
            <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--c-accent)] border-t-transparent" />
          </div>
        ) : history.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-[10px] font-bold text-[var(--c-muted)] uppercase italic">No previous proformas</p>
          </div>
        ) : (
          history.map((pi) => (
            <div 
              key={pi.id} 
              className="group relative flex items-center justify-between gap-3 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] p-3 transition-all hover:border-[var(--c-accent)]/30 hover:shadow-md"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-xs font-black text-[var(--c-text)]">{pi.displayRef || 'No Ref'}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase ${
                    pi.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {pi.status || 'draft'}
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] font-bold text-[var(--c-muted)]">
                  {new Date(pi.createdAt).toLocaleDateString()} • {pi.items?.length || 0} items
                </p>
                <div className="mt-1">
                    <CurrencyValue value={pi.totalAmount} className="text-[10px] font-black text-[var(--c-text)]" iconSize="h-2.5 w-2.5" />
                </div>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => onClone?.(pi)}
                  title="Clone Items"
                  className="rounded-lg p-1.5 text-[var(--c-muted)] hover:bg-[var(--c-accent)]/10 hover:text-[var(--c-accent)] transition-colors"
                >
                  <Copy strokeWidth={1.5} size={14} />
                </button>
                <a
                  href={`/t/${tenantId}/proforma-invoices?id=${pi.id}`}
                  title="View Details"
                  className="rounded-lg p-1.5 text-[var(--c-muted)] hover:bg-[var(--c-accent)]/10 hover:text-[var(--c-accent)] transition-colors"
                >
                  <ExternalLink strokeWidth={1.5} size={14} />
                </a>
              </div>
            </div>
          ))
        )}
      </div>

      <footer className="p-2 bg-[var(--c-panel)]/50 border-t border-[var(--c-border)]">
        <button 
           type="button"
           className="w-full flex items-center justify-center gap-2 py-1.5 text-[10px] font-bold text-[var(--c-muted)] hover:text-[var(--c-accent)] transition-colors"
        >
            <Search strokeWidth={1.5} size={12} /> View All History
        </button>
      </footer>
    </div>
  );
};

export default ClientHistoryPanel;
