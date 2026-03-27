import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTenant } from '../../context/useTenant';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebaseConfig';
import { convertProformaToTasks, fetchTasksByGroup } from '../../lib/workflowStore';
import { resolveProformaStatus, getStatusBadgeStyle } from '../../lib/statusResolver';
import PageShell from '../../components/layout/PageShell';
import { FileText, Play, CheckCircle2, ChevronLeft } from 'lucide-react';

const ProformaViewPage = () => {
  const { tenantId, user } = useTenant();
  const { proformaId } = useParams();
  const navigate = useNavigate();

  const [proforma, setProforma] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    if (!tenantId || !proformaId) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const ref = doc(db, 'tenants', tenantId, 'proformas', proformaId);
        const snap = await getDoc(ref);
        
        if (!snap.exists()) {
          if (isMounted) setError('Proforma not found.');
          return;
        }
        
        const pd = { id: snap.id, ...snap.data() };
        
        if (pd.taskGroupId) {
            const taskRes = await fetchTasksByGroup(tenantId, pd.taskGroupId);
            if (taskRes.ok) setTasks(taskRes.rows);
        }
        
        if (isMounted) setProforma(pd);
      } catch (err) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadData();
    return () => { isMounted = false; };
  }, [tenantId, proformaId]);

  const handleConvertToTask = async () => {
    if (!proforma) return;
    setConverting(true);
    setError(null);
    const res = await convertProformaToTasks(tenantId, proformaId, user?.uid);
    setConverting(false);
    
    if (res.ok) {
       // refresh
       window.location.reload();
    } else {
       setError(res.error || 'Failed to convert to tasks.');
    }
  };

  if (loading) return <PageShell title="Loading..." iconKey="proformaInvoices"> <span className="p-4 block animate-pulse">Loading proforma...</span> </PageShell>;
  if (error || !proforma) return <PageShell title="Not Found" iconKey="proformaInvoices"> <span className="p-4 block text-[var(--c-danger)]">{error}</span> </PageShell>;

  const derivedStatus = resolveProformaStatus(proforma, tasks);
  const statusStyle = getStatusBadgeStyle(derivedStatus);
  const isConverted = !!proforma.taskGroupId;

  return (
    <PageShell
      title={`Proforma: ${proforma.id}`}
      iconKey="proformaInvoices"
      widthPreset="form"
      actionSlot={
        <div className="flex items-center gap-3">
          <button
             onClick={() => navigate(`/t/${tenantId}/dashboard`)}
             className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--c-panel)] border border-[var(--c-border)] hover:bg-[var(--c-surface)] shadow-sm transition"
             title="Back"
          >
             <ChevronLeft strokeWidth={1.5} size={18} />
          </button>
          {!isConverted ? (
             <button
                className="flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--c-accent)] px-6 font-bold text-white shadow-sm hover:scale-105 active:scale-95 disabled:opacity-50 transition-all"
                onClick={handleConvertToTask}
                disabled={converting}
             >
                <Play strokeWidth={1.5} size={18} fill="currentColor" />
                {converting ? 'Converting...' : 'Convert to Tasks'}
             </button>
          ) : (
             <div className="flex h-10 items-center gap-2 rounded-xl bg-[var(--c-success-soft)] px-5 font-bold text-[var(--c-success)] border border-[var(--c-success)] shadow-sm">
                <CheckCircle2 strokeWidth={1.5} size={18} /> Tasks Generated
             </div>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        
        <div className="compact-card glass border border-[var(--c-border)] shadow-sm flex items-center justify-between">
            <div>
               <p className="text-xs font-black uppercase tracking-widest text-[var(--c-muted)]">Client ID</p>
               <h2 className="text-lg font-bold text-[var(--c-text)]">{proforma.clientId || 'Unknown'}</h2>
            </div>
            <div className={`px-4 py-1.5 rounded-lg border text-sm font-black uppercase tracking-widest ${statusStyle}`}>
               {derivedStatus}
            </div>
        </div>

        {error && (
            <div className="rounded-xl border border-[var(--c-danger)] bg-[var(--c-danger-soft)] p-3 text-xs font-bold text-[var(--c-danger)]">
                {error}
            </div>
        )}

        <div className="compact-card flex flex-col gap-3 glass border border-[var(--c-border)] shadow-sm">
           <h3 className="text-sm font-black uppercase tracking-widest text-[var(--c-muted)] border-b border-[var(--c-border)] pb-2 mb-2">Line Items</h3>
           {(proforma.items || []).map((item, idx) => (
               <div key={idx} className="flex items-center justify-between bg-[var(--c-surface)] rounded-xl border border-[var(--c-border)] p-3 shadow-sm">
                   <div className="flex flex-col">
                       <span className="font-bold text-[var(--c-text)] text-[15px]">{item.applicationName}</span>
                       {item.applicationId && <span className="text-[10px] uppercase font-black tracking-wider text-[var(--c-muted)]">ID: {item.applicationId}</span>}
                   </div>
                   <div className="flex items-center gap-6">
                       <div className="text-center">
                           <span className="block text-[10px] font-black uppercase tracking-widest text-[var(--c-muted)]">QTY</span>
                           <span className="font-bold">{item.quantity}</span>
                       </div>
                       <div className="text-right min-w-[5rem]">
                           <span className="block text-[10px] font-black uppercase tracking-widest text-[var(--c-muted)]">NET</span>
                           <span className="font-bold">AED {(Number(item.quantity || 1) * Number(item.amount || 0)).toLocaleString()}</span>
                       </div>
                   </div>
               </div>
           ))}

           <div className="mt-4 flex justify-end">
               <div className="text-right">
                    <span className="text-xs font-black uppercase tracking-widest text-[var(--c-muted)]">Total</span>
                    <h3 className="font-black text-2xl text-[var(--c-text)] tracking-tighter">AED {Number(proforma.totalAmount || 0).toLocaleString()}</h3>
               </div>
           </div>
        </div>

        {tasks.length > 0 && (
           <div className="compact-card flex flex-col gap-3 glass border border-[var(--c-border)] shadow-sm">
               <h3 className="text-sm font-black uppercase tracking-widest text-[var(--c-muted)] border-b border-[var(--c-border)] pb-2 mb-2">Generated Tasks ({tasks.length})</h3>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                   {tasks.map(t => (
                       <div key={t.taskId} className="bg-[color:color-mix(in_srgb,var(--c-panel)_50%,transparent)] p-3 rounded-xl border border-[var(--c-border)] flex items-center justify-between">
                           <div>
                               <p className="font-bold text-sm line-clamp-1">{t.applicationName}</p>
                               <p className="text-[10px] font-black uppercase text-[var(--c-muted)] tracking-widest">{t.taskId}</p>
                           </div>
                           <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getStatusBadgeStyle(t.status)}`}>
                               {t.status}
                           </span>
                       </div>
                   ))}
               </div>
           </div>
        )}

      </div>
    </PageShell>
  );
};

export default ProformaViewPage;
