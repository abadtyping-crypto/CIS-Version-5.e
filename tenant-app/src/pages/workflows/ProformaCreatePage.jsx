import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '../../context/useTenant';
import { createProforma } from '../../lib/workflowStore';
import { toSafeDocId } from '../../lib/idUtils';
import PageShell from '../../components/layout/PageShell';
import { FileText, Plus, Save, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import ClientSearchField from '../../components/dailyTransaction/ClientSearchField';
import InputActionField from '../../components/common/InputActionField';
import DirhamIcon from '../../components/common/DirhamIcon';

const ProformaCreatePage = () => {
  const { tenantId, user } = useTenant();
  const navigate = useNavigate();

  const [clientId, setClientId] = useState('');
  const [items, setItems] = useState([
    {
      applicationId: '',
      applicationName: '',
      amount: '',
      quantity: 1,
      visibility: 'universal',
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const totalAmount = items.reduce((sum, item) => sum + (Number(item.amount) || 0) * (Number(item.quantity) || 1), 0);

  const addItem = () => setItems([...items, { applicationId: '', applicationName: '', amount: '', quantity: 1, visibility: 'universal' }]);

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const removeItem = (index) => setItems(items.filter((_, i) => i !== index));

  const handleSave = async () => {
    if (!clientId) {
      setError('Please select a client.');
      return;
    }
    if (items.some(i => !i.applicationName || !i.amount)) {
      setError('All items must have a service name and amount.');
      return;
    }

    setLoading(true);
    setError(null);

    const proformaId = toSafeDocId(`PROF-${Date.now()}`, 'proforma');
    const payload = {
      clientId,
      items: items.map(item => ({
        ...item,
        amount: Number(item.amount || 0),
        quantity: Number(item.quantity || 1),
      })),
      totalAmount,
      status: 'pending',
      createdBy: user?.uid,
    };

    const res = await createProforma(tenantId, proformaId, payload);
    setLoading(false);

    if (res.ok) {
      navigate(`/t/${tenantId}/workflows/proformas/${proformaId}`);
    } else {
      setError(res.error || 'Failed to create Proforma.');
    }
  };

  return (
    <PageShell
      title="Create Proforma"
      iconKey="proformaInvoices"
      widthPreset="form"
      actionSlot={
        <button
          className="flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--c-accent)] px-6 font-bold text-white shadow-sm hover:bg-[var(--c-accent-2)] active:scale-95 disabled:opacity-50 transition-all"
          onClick={handleSave}
          disabled={loading}
        >
          <Save strokeWidth={1.5} size={18} />
          {loading ? 'Saving...' : 'Save Proforma'}
        </button>
      }
    >
      <div className="flex flex-col gap-6">
        
        {/* Client Selection Card */}
        <div className="compact-card glass border border-[var(--c-border)] shadow-sm">
          <h2 className="mb-4 text-sm font-black uppercase tracking-widest text-[var(--c-muted)]">Select Client</h2>
          <div className="relative z-20">
            <ClientSearchField tenantId={tenantId} onSelect={(client) => setClientId(client?.id || '')} selectedId={clientId} autoFocus />
          </div>
        </div>

        {/* Line Items Card */}
        <div className="compact-card glass border border-[var(--c-border)] shadow-sm relative z-10 w-full overflow-hidden">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-widest text-[var(--c-muted)]">Line Items</h2>
            <button
              onClick={addItem}
              className="flex items-center gap-1 rounded-lg border border-[var(--c-ring)] bg-[var(--c-accent-soft)] px-3 py-1 text-xs font-bold text-[var(--c-accent)] hover:bg-[var(--c-accent)] hover:text-white transition-colors"
            >
              <Plus strokeWidth={1.5} size={14} /> Add Item
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {items.map((item, index) => (
              <div key={index} className="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] p-3 shadow-inner sm:flex-nowrap">
                <div className="min-w-[12rem] flex-1">
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[var(--c-muted)]">Service Description</label>
                  <InputActionField
                    value={item.applicationName}
                    onValueChange={(val) => updateItem(index, 'applicationName', val)}
                    placeholder="E.g., Trade License Renewal"
                    className="w-full"
                  />
                </div>
                <div className="w-32 shrink-0">
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[var(--c-muted)]">Qty</label>
                  <div className="flex h-10 w-full overflow-hidden rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] focus-within:border-[var(--c-accent)] focus-within:ring-4 focus-within:ring-[var(--c-accent)]/5">
                    <input
                      type="number"
                      min="1"
                      className="no-spinner min-w-0 flex-1 bg-transparent px-2 text-center text-sm font-bold text-[var(--c-text)] outline-none"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', Math.max(1, Number(e.target.value) || 1))}
                    />
                    <div className="flex w-7 flex-col border-l border-[var(--c-border)]">
                      <button
                        type="button"
                        onClick={() => updateItem(index, 'quantity', Math.max(1, (Number(item.quantity) || 1) + 1))}
                        className="flex h-1/2 items-center justify-center bg-[var(--c-surface)] text-[var(--c-muted)] transition hover:text-[var(--c-accent)]"
                      >
                        <ChevronUp strokeWidth={1.5} size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateItem(index, 'quantity', Math.max(1, (Number(item.quantity) || 1) - 1))}
                        className="flex h-1/2 items-center justify-center border-t border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-muted)] transition hover:text-[var(--c-accent)]"
                      >
                        <ChevronDown strokeWidth={1.5} size={12} />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="w-40 shrink-0">
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[var(--c-muted)]">Amount (AED)</label>
                  <InputActionField
                    type="number"
                    value={String(item.amount)}
                    onValueChange={(val) => updateItem(index, 'amount', val)}
                    placeholder="0.00"
                    className="w-full"
                    showPasteButton={false}
                  />
                </div>
                {items.length > 1 && (
                  <button
                    onClick={() => removeItem(index)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors"
                    title="Remove item"
                  >
                    <Trash2 strokeWidth={1.5} size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end border-t border-[var(--c-border)] pt-4">
            <div className="text-right">
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--c-muted)]">Total Amount</p>
              <p className="font-title text-3xl font-black tracking-tighter text-[var(--c-text)]">
                AED {totalAmount.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-[var(--c-danger)] bg-[var(--c-danger-soft)] p-4 text-sm font-semibold text-[var(--c-danger)] shadow-sm">
            {error}
          </div>
        )}
      </div>
    </PageShell>
  );
};

export default ProformaCreatePage;
