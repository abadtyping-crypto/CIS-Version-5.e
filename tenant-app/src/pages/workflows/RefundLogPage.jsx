import { useEffect, useState, useCallback } from 'react';
import { useTenant } from '../../context/useTenant';
import { fetchRefundLogs } from '../../lib/workflowStore';
import PageShell from '../../components/layout/PageShell';
import { History, RotateCcw, Calendar, AlertCircle } from 'lucide-react';

const RefundLogPage = () => {
  const { tenantId } = useTenant();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    const res = await fetchRefundLogs(tenantId);
    if (res.ok) setLogs(res.rows);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    if (tenantId) {
        const timer = setTimeout(() => loadLogs(), 0);
        return () => clearTimeout(timer);
    }
  }, [tenantId, loadLogs]);

  return (
    <PageShell
      title="Refund & Cancellation Log"
      iconKey="recycleBin"
      widthPreset="data"
      actionSlot={
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--c-muted)]">
           {logs.length} Records Found
        </p>
      }
    >
      <div className="flex flex-col gap-4 relative">
        {loading ? (
             <p className="text-sm font-bold opacity-50 p-4 text-center">Loading refund logs...</p>
        ) : logs.length === 0 ? (
             <div className="compact-card glass border border-[var(--c-border)] shadow-sm text-center py-10 opacity-60 flex flex-col items-center">
                 <History strokeWidth={1.5} size={40} className="mb-3 text-[var(--c-muted)]" />
                 <p className="text-sm font-bold uppercase tracking-widest text-[var(--c-muted)]">No refund logs found</p>
             </div>
        ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
               {logs.map((log) => (
                  <div key={log.id} className="compact-card glass border border-[var(--c-border)] rounded-2xl p-4 shadow-sm flex flex-col hover:shadow-md transition bg-[var(--c-surface)]">
                      <div className="flex justify-between items-start mb-3 border-b border-[var(--c-border)] pb-3">
                         <div>
                             <h4 className="font-bold text-base text-[var(--c-danger)] flex items-center gap-2">
                                 <RotateCcw strokeWidth={1.5} size={16} /> Refund Authorized
                             </h4>
                             <p className="text-[10px] font-black uppercase tracking-widest text-[var(--c-muted)] mt-1">
                                 ID: {log.refundLogId}
                             </p>
                         </div>
                         <div className="text-right">
                             <span className="block text-[10px] font-black uppercase tracking-widest text-[var(--c-muted)] mb-1">Amount</span>
                             <h3 className="font-black text-xl text-[var(--c-text)]">AED {Number(log.refundAmount || 0).toLocaleString()}</h3>
                         </div>
                      </div>

                      <div className="flex flex-col gap-2 mb-4">
                          <p className="flex items-start gap-1.5 text-xs text-[var(--c-text)]">
                              <AlertCircle strokeWidth={1.5} size={14} className="mt-0.5 text-[var(--c-warning)] shrink-0" />
                              <span className="font-semibold line-clamp-3">{log.refundReason || 'No reason provided.'}</span>
                          </p>
                      </div>

                      <div className="bg-[color:color-mix(in_srgb,var(--c-panel)_80%,transparent)] -mx-4 -mb-4 px-4 py-3 rounded-b-2xl border-t border-[var(--c-border)] flex items-center justify-between">
                         <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-[var(--c-muted)]">
                             <p className="flex items-center gap-1.5 border border-[var(--c-border)] px-2 py-0.5 rounded bg-white">
                                 Method: <span className="text-[var(--c-accent)]">{log.refundMethod || 'wallet'}</span>
                             </p>
                             {log.proformaId && (
                                 <p className="text-xs text-[var(--c-info)] underline cursor-help" title="Linked Proforma">
                                     {log.proformaId}
                                 </p>
                             )}
                         </div>
                         <p className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--c-muted)] uppercase tracking-widest">
                             <Calendar strokeWidth={1.5} size={12} />
                             {log.createdAt ? new Date(log.createdAt?.seconds * 1000 || log.createdAt).toLocaleDateString() : 'N/A'}
                         </p>
                      </div>
                  </div>
               ))}
            </div>
        )}
      </div>
    </PageShell>
  );
};

export default RefundLogPage;
