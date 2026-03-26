import { useState } from 'react';
import { useTenant } from '../../context/useTenant';
import { cancelWorkflowEntities } from '../../lib/workflowStore';
import { X, AlertTriangle, ShieldCheck } from 'lucide-react';

const CancellationModal = ({ entityType, entityId, entityLabel, onClose, onSuccess }) => {
  const { tenantId, user } = useTenant();
  
  const [reason, setReason] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(false); // placeholder for role logic
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
     if (!reason || reason.trim().length < 4) {
         setError('Cancellation reason must be at least 4 characters long.');
         return;
     }

     if (requiresApproval) {
         // Placeholder for strict role-based approval logic (e.g., manager approval required)
         setError('Manager approval placeholder is active. Direct cancellation blocked.');
         return;
     }

     setLoading(true);
     setError(null);
     
     // Payload can include proformaId if it's derived, refundAmount if manually typed, etc.
     const payload = {
        refundAmount: 0, // Placeholder mapping to task amount in real scenario
        refundMethod: 'wallet',
     };

     const res = await cancelWorkflowEntities(tenantId, entityId, entityType, reason, user?.uid, payload);
     
     setLoading(false);
     
     if (res.ok) {
        if (onSuccess) onSuccess();
     } else {
        setError(res.error || 'Failed to cancel.');
     }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
       <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
       <div className="relative z-10 w-full max-w-lg bg-[var(--c-bg)] shadow-[0_16px_44px_-30px_rgba(230,126,34,0.62)] border border-[var(--c-border)] rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
           
           {/* Header */}
           <div className="bg-[var(--c-panel)] px-5 py-4 flex items-center justify-between border-b border-[var(--c-border)]">
              <div className="flex items-center gap-2 text-[var(--c-danger)]">
                 <AlertTriangle size={20} />
                 <h2 className="font-title text-base font-black tracking-widest uppercase">
                    Cancel {entityLabel}
                 </h2>
              </div>
              <button 
                 onClose={onClose}
                 className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--c-muted)] hover:bg-[var(--c-surface)] hover:text-[var(--c-text)] transition-colors border border-transparent hover:border-[var(--c-border)]"
                 onClick={onClose}
              >
                 <X size={16} strokeWidth={2.5} />
              </button>
           </div>

           {/* Body */}
           <div className="p-5 flex flex-col gap-4">
              <p className="text-sm font-semibold text-[var(--c-text)]">
                  You are about to cancel this entity. This action will cascade safely and mark linked trackers or transactions as cancelled.
              </p>

              <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--c-muted)] mb-1">
                      Reason for Cancellation
                  </label>
                  <textarea
                     className="compact-input w-full min-h-[6rem] p-3 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] text-sm font-semibold focus:border-[var(--c-accent)] focus:ring-1 focus:ring-[var(--c-accent)] outline-none resize-none"
                     placeholder="State the reason clearly..."
                     value={reason}
                     onChange={(e) => setReason(e.target.value)}
                  />
              </div>

              <label className="flex items-center gap-2 cursor-pointer mt-2 w-fit">
                  <input
                     type="checkbox"
                     className="rounded border-[var(--c-border)] text-[var(--c-accent)] outline-none"
                     checked={requiresApproval}
                     onChange={(e) => setRequiresApproval(e.target.checked)}
                  />
                  <span className="text-[10px] font-black uppercase tracking-widest text-[var(--c-muted)] flex items-center gap-1">
                      <ShieldCheck size={12} /> Test Manager Approval Block
                  </span>
              </label>

              {error && (
                  <div className="rounded-xl border border-[var(--c-danger)] bg-[var(--c-danger-soft)] p-3 text-xs font-bold text-[var(--c-danger)] shadow-sm">
                      {error}
                  </div>
              )}
           </div>

           {/* Footer */}
           <div className="bg-[var(--c-panel)] px-5 py-4 border-t border-[var(--c-border)] flex items-center justify-end gap-3">
              <button
                 className="h-10 px-5 text-sm font-bold uppercase tracking-widest text-[var(--c-muted)] hover:text-[var(--c-text)] transition-colors"
                 onClick={onClose}
              >
                 Cancel
              </button>
              <button
                 className="h-10 flex items-center justify-center rounded-xl bg-[var(--c-danger)] px-6 text-sm font-bold tracking-widest uppercase text-white shadow-sm hover:scale-105 active:scale-95 transition-transform disabled:opacity-50"
                 onClick={handleSubmit}
                 disabled={loading || reason.trim().length < 4}
              >
                 {loading ? 'Processing...' : 'Confirm Cancellation'}
              </button>
           </div>

       </div>
    </div>
  );
};

export default CancellationModal;
