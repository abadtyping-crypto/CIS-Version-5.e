import { useState, useRef } from 'react';
import { X, User, Building2, Smartphone, CreditCard, Save } from 'lucide-react';
import { useTenant } from '../../context/useTenant';
import { useAuth } from '../../context/useAuth';
import {
  upsertClient,
  checkIndividualDuplicate,
  checkTradeLicenseDuplicate,
  generateDisplayClientId,
} from '../../lib/backendStore';

const QuickAddClientModal = ({ isOpen, onClose, onSuccess }) => {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  
  const [activeType, setActiveType] = useState('individual'); // 'individual' | 'company'
  const [form, setForm] = useState({
    fullName: '',
    tradeName: '',
    primaryMobile: '',
    emiratesId: '',
    tradeLicenseNumber: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const submitLockRef = useRef(false);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitLockRef.current || isSaving) return;
    
    setError('');
    setIsSaving(true);
    submitLockRef.current = true;

    try {
      const type = activeType;
      const payload = {
        tenantId,
        type,
        status: 'active',
        createdBy: user?.uid || '',
        createdAt: new Date().toISOString(),
      };

      if (type === 'individual') {
        if (!form.fullName.trim()) throw new Error('Full Name is required.');
        payload.fullName = form.fullName.trim().toUpperCase();
        payload.primaryMobile = form.primaryMobile.trim();
        payload.emiratesId = form.emiratesId.replace(/-/g, '').trim();
        
        if (payload.emiratesId) {
            const exists = await checkIndividualDuplicate(tenantId, payload.emiratesId);
            if (exists) throw new Error(`Emirates ID ${payload.emiratesId} is already registered.`);
        }
      } else {
        if (!form.tradeName.trim()) throw new Error('Trade Name is required.');
        payload.tradeName = form.tradeName.trim().toUpperCase();
        payload.primaryMobile = form.primaryMobile.trim();
        payload.tradeLicenseNumber = form.tradeLicenseNumber.trim().toUpperCase();

        if (payload.tradeLicenseNumber) {
            const exists = await checkTradeLicenseDuplicate(tenantId, payload.tradeLicenseNumber);
            if (exists) throw new Error(`Trade License ${payload.tradeLicenseNumber} is already registered.`);
        }
      }

      const displayId = await generateDisplayClientId(tenantId, type);
      payload.displayClientId = displayId;

      const res = await upsertClient(tenantId, null, payload);
      if (res.ok) {
        onSuccess?.({ id: res.id, ...payload });
        onClose();
      } else {
        throw new Error(res.error || 'Failed to save client.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
      submitLockRef.current = false;
    }
  };

  return (
    <div className="fixed inset-0 z-[1500] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="w-full max-w-md overflow-hidden rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-[var(--c-border)] bg-[var(--c-panel)] px-4 py-3">
          <div>
            <h3 className="text-sm font-bold text-[var(--c-text)] uppercase tracking-wider">Quick Add Client</h3>
            <p className="text-[10px] font-semibold text-[var(--c-muted)] uppercase italic">Create minimum-safe record</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-[var(--c-muted)] hover:bg-[var(--c-surface)] hover:text-[var(--c-text)]">
            <X strokeWidth={1.5} size={18} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="flex gap-2 p-1 rounded-xl bg-[var(--c-panel)] border border-[var(--c-border)]">
            <button
              type="button"
              onClick={() => setActiveType('individual')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
                activeType === 'individual' 
                  ? 'bg-[var(--c-surface)] text-[var(--c-accent)] shadow-sm' 
                  : 'text-[var(--c-muted)] hover:text-[var(--c-text)]'
              }`}
            >
              <User strokeWidth={1.5} size={14} /> Individual
            </button>
            <button
              type="button"
              onClick={() => setActiveType('company')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
                activeType === 'company' 
                  ? 'bg-[var(--c-surface)] text-[var(--c-accent)] shadow-sm' 
                  : 'text-[var(--c-muted)] hover:text-[var(--c-text)]'
              }`}
            >
              <Building2 strokeWidth={1.5} size={14} /> Company
            </button>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--c-muted)]">
                {activeType === 'individual' ? 'Full Name *' : 'Trade Name *'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  name={activeType === 'individual' ? 'fullName' : 'tradeName'}
                  value={activeType === 'individual' ? form.fullName : form.tradeName}
                  onChange={handleChange}
                  required
                  placeholder={activeType === 'individual' ? "AS PER EID / PASSPORT" : "AS PER LICENSE"}
                  className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2.5 text-sm font-bold placeholder:text-[var(--c-muted)]/50 focus:border-[var(--c-accent)] focus:ring-4 focus:ring-[var(--c-accent)]/5 outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--c-muted)]">Mobile Number</label>
              <div className="relative">
                <Smartphone strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--c-muted)]" size={14} />
                <input
                  type="tel"
                  name="primaryMobile"
                  value={form.primaryMobile}
                  onChange={handleChange}
                  placeholder="e.g. 0501234567"
                  className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] pl-9 pr-3 py-2.5 text-sm font-bold placeholder:text-[var(--c-muted)]/50 focus:border-[var(--c-accent)] focus:ring-4 focus:ring-[var(--c-accent)]/5 outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--c-muted)]">
                {activeType === 'individual' ? 'Emirates ID' : 'Trade License'}
              </label>
              <div className="relative">
                <CreditCard strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--c-muted)]" size={14} />
                <input
                  type="text"
                  name={activeType === 'individual' ? 'emiratesId' : 'tradeLicenseNumber'}
                  value={activeType === 'individual' ? form.emiratesId : form.tradeLicenseNumber}
                  onChange={handleChange}
                  placeholder={activeType === 'individual' ? "784-XXXX-XXXXXXX-X" : "LICENSE NUMBER"}
                  className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] pl-9 pr-3 py-2.5 text-sm font-bold placeholder:text-[var(--c-muted)]/50 focus:border-[var(--c-accent)] focus:ring-4 focus:ring-[var(--c-accent)]/5 outline-none"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-600">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-xs font-bold text-[var(--c-muted)] rounded-xl border border-[var(--c-border)] hover:bg-[var(--c-panel)] hover:text-[var(--c-text)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold bg-[var(--c-accent)] text-white rounded-xl shadow-lg shadow-[var(--c-accent)]/20 hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {isSaving ? 'Directing...' : <><Save strokeWidth={1.5} size={14} /> Save Client</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default QuickAddClientModal;
