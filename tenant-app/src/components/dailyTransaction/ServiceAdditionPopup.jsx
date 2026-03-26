import React, { useState, useEffect } from 'react';
import { X, Save, Box, Info, Image as ImageIcon, Search } from 'lucide-react';
import { useTenant } from '../../context/useTenant';
import { upsertServiceTemplate } from '../../lib/serviceTemplateStore';
import { fetchApplicationIconLibrary } from '../../lib/applicationIconLibraryStore';
import DirhamIcon from '../common/DirhamIcon';
import { ENFORCE_UNIVERSAL_APPLICATION_UID } from '../../lib/universalLibraryPolicy';

const ServiceAdditionPopup = ({ isOpen, onClose, onAdded }) => {
  const lockToUniversalApps = ENFORCE_UNIVERSAL_APPLICATION_UID;
  const { tenantId } = useTenant();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    govtCharge: '',
    clientCharge: '',
    group: 'General',
    iconId: '',
  });
  const [icons, setIcons] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && tenantId) {
      fetchApplicationIconLibrary(tenantId).then(res => {
        if (res.ok) setIcons(res.rows || []);
      });
    }
  }, [isOpen, tenantId]);

  useEffect(() => {
    if (!isOpen || !lockToUniversalApps) return;
    onClose?.();
  }, [isOpen, lockToUniversalApps, onClose]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Service name is required.');
      return;
    }
    setIsSaving(true);
    setError('');

    const templateId = formData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const res = await upsertServiceTemplate(tenantId, templateId, {
      ...formData,
      govtCharge: Number(formData.govtCharge) || 0,
      clientCharge: Number(formData.clientCharge) || 0,
      code: templateId.toUpperCase().slice(0, 6),
      updatedAt: new Date().toISOString(),
    });

    if (res.ok) {
      onAdded({ id: templateId, ...formData });
      onClose();
    } else {
      setError(res.error || 'Failed to add service.');
    }
    setIsSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-[var(--c-surface)] border border-[var(--c-border)] shadow-2xl animate-in zoom-in-95 duration-200">
        <header className="flex items-center justify-between border-b border-[var(--c-border)] bg-[var(--c-panel)] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--c-accent)]/10 text-[var(--c-accent)] border border-[var(--c-accent)]/20">
              <Box size={20} />
            </div>
            <div>
              <h2 className="text-sm font-black text-[var(--c-text)]">New Service Template</h2>
              <p className="text-[10px] font-bold uppercase text-[var(--c-muted)]">Add to your library</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-[var(--c-muted)] hover:bg-[var(--c-border)] transition"><X size={20} /></button>
        </header>

        <div className="max-h-[70vh] overflow-y-auto p-6 space-y-5">
          {error && <p className="text-xs font-bold text-rose-500 bg-rose-50 p-3 rounded-xl border border-rose-100">{error}</p>}

          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--c-muted)] mb-1.5 block">Service Name *</span>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Visa Extension"
              className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-4 py-2.5 text-sm font-bold text-[var(--c-text)] outline-none focus:border-[var(--c-accent)] focus:ring-4 focus:ring-[var(--c-accent)]/5 transition"
            />
          </label>

          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--c-muted)] mb-1.5 block">Description</span>
            <textarea
              rows={2}
              value={formData.description}
              onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
              placeholder="Briefly describe the service..."
              className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-4 py-2.5 text-sm font-bold text-[var(--c-text)] outline-none focus:border-[var(--c-accent)] transition resize-none"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--c-muted)] mb-1.5 block">Govt Charge (Dhs)</span>
              <div className="relative">
                <DirhamIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--c-muted)]" />
                <input
                  type="number"
                  value={formData.govtCharge}
                  onChange={e => setFormData(p => ({ ...p, govtCharge: e.target.value }))}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] pl-9 pr-4 py-2.5 text-sm font-bold text-[var(--c-text)] outline-none focus:border-[var(--c-accent)] transition"
                />
              </div>
            </label>
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--c-muted)] mb-1.5 block">Client Charge (Dhs) *</span>
              <div className="relative">
                <DirhamIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--c-muted)]" />
                <input
                  type="number"
                  value={formData.clientCharge}
                  onChange={e => setFormData(p => ({ ...p, clientCharge: e.target.value }))}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] pl-9 pr-4 py-2.5 text-sm font-bold text-[var(--c-text)] outline-none focus:border-[var(--c-accent)] transition"
                />
              </div>
            </label>
          </div>

          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--c-muted)] mb-1.5 block">Select Icon</span>
            <div className="grid grid-cols-5 gap-3 max-h-40 overflow-y-auto rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] p-3">
              {icons.map(icon => (
                <button
                  key={icon.iconId}
                  type="button"
                  onClick={() => setFormData(p => ({ ...p, iconId: icon.iconId }))}
                  className={`flex h-12 w-12 items-center justify-center rounded-xl border transition ${formData.iconId === icon.iconId ? 'border-[var(--c-accent)] bg-[var(--c-accent)]/10 ring-2 ring-[var(--c-accent)]' : 'border-[var(--c-border)] bg-[var(--c-surface)] hover:border-[var(--c-accent)]/40'}`}
                >
                  <img src={icon.iconUrl} className="h-8 w-8 object-contain" alt={icon.iconName} />
                </button>
              ))}
              {icons.length === 0 && (
                <div className="col-span-5 py-4 text-center">
                  <p className="text-[10px] font-bold text-[var(--c-muted)] italic">No icons found in library.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <footer className="border-t border-[var(--c-border)] bg-[var(--c-panel)] p-6">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--c-accent)] py-3 text-sm font-black uppercase text-white shadow-xl shadow-[var(--c-accent)]/20 transition hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            {isSaving ? 'Adding...' : <><Save size={18} /> Add to Library</>}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ServiceAdditionPopup;
