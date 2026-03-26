import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTenant } from '../../context/useTenant';
import { upsertTracking, fetchTrackings } from '../../lib/workflowStore';
import { resolveTrackingStatus, getStatusBadgeStyle } from '../../lib/statusResolver';
import PageShell from '../../components/layout/PageShell';
import InputActionField from '../../components/common/InputActionField';
import { Route, ClipboardList, Copy, Check, Save, Plus, Trash2, ShieldAlert, Search, RefreshCw, Layers } from 'lucide-react';
import CancellationModal from '../../components/workflows/CancellationModal';

const TrackingPage = () => {
  const { tenantId, user } = useTenant();
  const [searchParams] = useSearchParams();
  const txIdParam = searchParams.get('txId');

  const [trackings, setTrackings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [activeTrackingId, setActiveTrackingId] = useState(txIdParam || '');
  const [numbers, setNumbers] = useState(['']);
  const [trackingStatus, setTrackingStatus] = useState('inProgress');
  const [isSaving, setIsSaving] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const [cancellationCtx, setCancellationCtx] = useState(null);

  const loadTrackings = useCallback(async () => {
    setLoading(true);
    const res = await fetchTrackings(tenantId);
    if (res.ok) setTrackings(res.rows);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    if (tenantId) {
      loadTrackings();
    }
  }, [tenantId, loadTrackings]);

  useEffect(() => {
    if (txIdParam && trackings.length > 0) {
      const existing = trackings.find(t => t.id === txIdParam || t.transactionId === txIdParam);
      if (existing) {
        setActiveTrackingId(existing.transactionId || existing.id);
        setNumbers(existing.trackingNumbers?.length > 0 ? existing.trackingNumbers : ['']);
        setTrackingStatus(existing.status || 'inProgress');
      }
    }
  }, [txIdParam, trackings]);

  const handleCopy = (num, e) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(num);
    setCopiedId(num);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSaveTracking = async () => {
    if (!activeTrackingId) return;
    setIsSaving(true);
    const safeNumbers = numbers.filter(n => n?.trim()).slice(0, 36);
    
    const payload = {
      transactionId: activeTrackingId,
      trackingNumbers: safeNumbers,
      status: trackingStatus,
      updatedBy: user?.uid,
    };

    const res = await upsertTracking(tenantId, activeTrackingId, payload);
    setIsSaving(false);

    if (res.ok) {
      loadTrackings();
      if (!txIdParam) {
        setActiveTrackingId('');
        setNumbers(['']);
        setTrackingStatus('inProgress');
      }
    }
  };

  const updateNumber = (index, value) => {
    const newNums = [...numbers];
    newNums[index] = value;
    if (index === numbers.length - 1 && value?.trim() && numbers.length < 36) {
      newNums.push('');
    }
    setNumbers(newNums);
  };

  const removeNumber = (index) => {
    const newNums = numbers.filter((_, i) => i !== index);
    if (newNums.length === 0) newNums.push('');
    setNumbers(newNums);
  };

  const filteredTrackings = trackings.filter(t => 
    (t.transactionId || t.id).toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.trackingNumbers || []).some(n => n.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <PageShell
      pageID="tracking"
      iconKey="tracking"
      title="Global Tracking Board"
      subtitle="Monitor application lifecycles and manage multi-stage delivery tracking."
      icon={Layers}
      eyebrow="Workflow"
      widthPreset="data"
    >
      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6">
        {/* Editor Panel */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-5 shadow-sm space-y-5 sticky top-24">
            <div className="flex items-center justify-between border-b border-[var(--c-border)] pb-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-[var(--c-text)]">
                {txIdParam ? 'Update Registry' : 'New Tracking Node'}
              </h3>
              <div className="px-2 py-0.5 rounded-lg bg-[var(--c-accent-soft)] text-[var(--c-accent)] text-[10px] font-bold">
                 5.0
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--c-muted)]">Source Transaction ID</label>
                <InputActionField
                  value={activeTrackingId}
                  onValueChange={setActiveTrackingId}
                  placeholder="DTID-XXXX..."
                  disabled={!!txIdParam}
                  className="w-full"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--c-muted)]">Current Phase</label>
                <select
                  className="w-full h-11 rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-4 text-sm font-bold text-[var(--c-text)] outline-none focus:ring-4 focus:ring-[var(--c-accent)]/10 transition appearance-none"
                  value={trackingStatus}
                  onChange={(e) => setTrackingStatus(e.target.value)}
                >
                  <option value="inProgress">In Progress</option>
                  <option value="approved">Approved</option>
                  <option value="modificationRequired">Modification Required</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[var(--c-muted)]">Tracking Numbers</label>
                  <span className="text-[10px] font-bold text-[var(--c-accent)]">{numbers.filter(n => n.trim()).length} / 36</span>
                </div>
                
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                  {numbers.map((val, idx) => (
                    <div key={idx} className="flex gap-2">
                       <InputActionField
                          value={val}
                          onValueChange={(v) => updateNumber(idx, v)}
                          placeholder={`Line ${idx + 1}`}
                          className="flex-1"
                          showPasteButton={idx === 0}
                       />
                       {val && numbers.length > 1 && (
                         <button 
                           onClick={() => removeNumber(idx)}
                           className="h-11 w-11 flex items-center justify-center rounded-xl border border-transparent text-[var(--c-muted)] hover:bg-rose-500/10 hover:text-rose-500 transition-colors shrink-0"
                         >
                           <Trash2 size={16} />
                         </button>
                       )}
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSaveTracking}
                disabled={!activeTrackingId || isSaving}
                className="w-full h-12 rounded-xl flex items-center justify-center gap-2 bg-[var(--c-accent)] text-white font-bold shadow-lg shadow-[var(--c-accent)]/20 hover:opacity-90 active:scale-95 transition-all text-sm disabled:opacity-50 disabled:pointer-events-none mt-4"
              >
                {isSaving ? <RefreshCw className="animate-spin h-4 w-4" /> : <Save size={18} />}
                {isSaving ? 'Processing...' : 'Commit to Registry'}
              </button>
            </div>
          </div>
        </div>

        {/* Board Panel */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--c-muted)] h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search by ID or Tracking #..."
                  className="w-full h-11 pl-11 pr-4 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] text-sm font-bold text-[var(--c-text)] outline-none focus:border-[var(--c-accent)] transition shadow-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
             </div>
             <button onClick={loadTrackings} className="h-11 px-4 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-muted)] hover:text-[var(--c-accent)] transition shadow-sm flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
             </button>
          </div>

          {loading ? (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
                {[1,2,3,4].map(i => <div key={i} className="h-48 rounded-2xl bg-[var(--c-surface)] border border-[var(--c-border)]" />)}
             </div>
          ) : filteredTrackings.length === 0 ? (
             <div className="flex flex-col items-center justify-center p-20 border-2 border-dashed border-[var(--c-border)] rounded-3xl bg-[var(--c-surface)]">
                <div className="w-16 h-16 rounded-full bg-[var(--c-panel)] flex items-center justify-center mb-4">
                   <ClipboardList size={30} className="text-[var(--c-muted)]" />
                </div>
                <h3 className="text-lg font-bold text-[var(--c-text)]">No Nodes Found</h3>
                <p className="text-sm text-[var(--c-muted)] mt-1">Refine your search or create a new tracking record.</p>
             </div>
          ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {filteredTrackings.map((trk) => {
                   const status = resolveTrackingStatus(trk);
                   const badgeStyle = getStatusBadgeStyle(status);
                   const validNums = Array.isArray(trk.trackingNumbers) ? trk.trackingNumbers : [];

                   return (
                      <div 
                        key={trk.id} 
                        className="group relative rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-5 shadow-sm hover:shadow-xl hover:shadow-[var(--c-accent)]/5 hover:border-[var(--c-accent)]/30 transition-all duration-300 flex flex-col h-full cursor-pointer overflow-hidden"
                        onClick={() => { setActiveTrackingId(trk.transactionId || trk.id); setNumbers(validNums.length ? [...validNums, ''] : ['']); setTrackingStatus(trk.status); }}
                      >
                         <div className="flex items-start justify-between mb-4">
                            <div className="space-y-1">
                               <p className="text-[10px] font-black uppercase tracking-widest text-[var(--c-muted)]">Transaction Node</p>
                               <p className="font-black text-sm text-[var(--c-text)] truncate max-w-[140px]">{trk.transactionId || trk.id}</p>
                            </div>
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${badgeStyle}`}>
                               {status}
                            </span>
                         </div>
                         
                         <div className="flex-1 space-y-2">
                             <p className="text-[10px] font-black uppercase tracking-widest text-[var(--c-muted)]">Active Trackers</p>
                             <div className="flex flex-wrap gap-2">
                                {validNums.length > 0 ? (
                                   validNums.slice(0, 6).map((n, i) => (
                                      <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-[var(--c-panel)] border border-[var(--c-border)] rounded-lg group/item transition hover:border-[var(--c-accent)]/50">
                                         <span className="text-[11px] font-bold text-[var(--c-text)]">{n}</span>
                                         <button 
                                           onClick={(e) => handleCopy(n, e)}
                                           className="text-[var(--c-muted)] hover:text-[var(--c-accent)] transition-colors p-0.5"
                                         >
                                            {copiedId === n ? <Check size={12} /> : <Copy size={12} />}
                                         </button>
                                      </div>
                                   ))
                                ) : (
                                   <p className="text-xs font-bold text-[var(--c-muted)] italic">Awaiting numbers...</p>
                                )}
                                {validNums.length > 6 && (
                                    <span className="px-2 py-1 text-[10px] font-black text-[var(--c-muted)] uppercase bg-[var(--c-panel)] rounded-lg">+{validNums.length - 6} more</span>
                                )}
                             </div>
                         </div>

                         <div className="mt-6 pt-4 border-t border-[var(--c-border)] flex items-center justify-between">
                            <div className="flex items-center gap-2">
                               <div className="w-6 h-6 rounded-full bg-[var(--c-accent-soft)] flex items-center justify-center">
                                  <RefreshCw size={10} className="text-[var(--c-accent)]" />
                               </div>
                               <span className="text-[10px] font-bold text-[var(--c-muted)]">Sync'd</span>
                            </div>
                            {status !== 'cancelled' && (
                               <button 
                                 className="opacity-0 group-hover:opacity-100 h-8 w-8 flex items-center justify-center rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all duration-300"
                                 onClick={(e) => { e.stopPropagation(); setCancellationCtx({ id: trk.id, label: trk.transactionId || trk.id }); }}
                               >
                                  <ShieldAlert size={14} />
                               </button>
                            )}
                         </div>

                         {/* Side Accent */}
                         <div className={`absolute left-0 top-0 bottom-0 w-1 ${status === 'completed' ? 'bg-emerald-500' : status === 'approved' ? 'bg-[var(--c-accent)]' : 'bg-amber-500'}`} />
                      </div>
                   );
                })}
             </div>
          )}
        </div>
      </div>

      {cancellationCtx && (
         <CancellationModal
             entityType="tracking"
             entityId={cancellationCtx.id}
             entityLabel={`Tracker Node ${cancellationCtx.label}`}
             onClose={() => setCancellationCtx(null)}
             onSuccess={() => { setCancellationCtx(null); loadTrackings(); }}
         />
      )}
    </PageShell>
  );
};

export default TrackingPage;

