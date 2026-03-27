import { useEffect, useState } from 'react';
import SectionCard from './SectionCard';
import { useTenant } from '../../context/useTenant';
import { fetchTenantPortals, fetchPortalTransactions } from '../../lib/backendStore';
import { generateTenantPdf } from '../../lib/pdfGenerator';

const ReportsSection = ({ isOpen, onToggle, refreshKey }) => {
    const { tenantId } = useTenant();
    const [portals, setPortals] = useState([]);
    const [form, setForm] = useState({
        portalId: '',
        startDate: '',
        endDate: '',
        reportType: 'statement'
    });
    const [isGenerating, setIsGenerating] = useState(false);
    const [status, setStatus] = useState({ message: '', type: '' });

    useEffect(() => {
        if (!tenantId || !isOpen) return;
        fetchTenantPortals(tenantId).then(res => {
            if (res.ok) setPortals(res.rows);
        });
    }, [tenantId, isOpen, refreshKey]);

    const handleGenerate = async (e) => {
        e.preventDefault();
        if (!form.portalId) {
            setStatus({ message: 'Please select a portal.', type: 'error' });
            return;
        }

        setIsGenerating(true);
        setStatus({ message: 'Fetching transactions...', type: 'info' });

        const res = await fetchPortalTransactions(tenantId, form.portalId, form.startDate, form.endDate);

        if (!res.ok || res.rows.length === 0) {
            setStatus({ message: res.error || 'No transactions found for the selected criteria.', type: 'error' });
            setIsGenerating(false);
            return;
        }

        setStatus({ message: 'Generating PDF...', type: 'info' });

        const portalName = portals.find(p => p.id === form.portalId)?.name || 'Portal';
        const totalAmount = res.rows.reduce((sum, tx) => sum + (tx.amount || 0), 0);

        const pdfRes = await generateTenantPdf({
            tenantId,
            documentType: 'portalStatement',
            data: {
                txId: `ST-${Date.now()}`,
                date: new Date().toLocaleDateString(),
                recipientName: portalName,
                amount: totalAmount,
                description: `Statement for ${portalName}${form.startDate ? ` from ${form.startDate}` : ''}${form.endDate ? ` to ${form.endDate}` : ''}`,
                items: res.rows.map(tx => ({
                    name: `${new Date(tx.date).toLocaleDateString()} - ${tx.type}`,
                    qty: 1,
                    price: tx.amount,
                    total: tx.amount
                }))
            }
        });

        if (pdfRes.ok) {
            setStatus({ message: 'Statement generated successfully!', type: 'success' });
        } else {
            setStatus({ message: pdfRes.error || 'Failed to generate PDF.', type: 'error' });
        }
        setIsGenerating(false);
    };

    return (
        <SectionCard
            title="Reports & Statements"
            subtitle="Generate consolidated documents for portals"
            defaultOpen={isOpen}
            onToggle={onToggle}
        >
            <form onSubmit={handleGenerate} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-[var(--c-muted)]">Portal</label>
                        <select
                            required
                            value={form.portalId}
                            onChange={(e) => setForm({ ...form, portalId: e.target.value })}
                            className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-[var(--c-accent)]/20"
                        >
                            <option value="">Select Portal</option>
                            {portals.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-[var(--c-muted)]">Report Type</label>
                        <select
                            value={form.reportType}
                            onChange={(e) => setForm({ ...form, reportType: e.target.value })}
                            className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-[var(--c-accent)]/20"
                        >
                            <option value="statement">Full Statement</option>
                        </select>
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-[var(--c-muted)]">From Date</label>
                        <input
                            type="date"
                            value={form.startDate}
                            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                            className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 text-xs font-bold outline-none"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-[var(--c-muted)]">To Date</label>
                        <input
                            type="date"
                            value={form.endDate}
                            onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                            className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 text-xs font-bold outline-none"
                        />
                    </div>
                </div>

                {status.message && (
                    <div className={`rounded-xl border p-3 text-xs font-bold text-center ${status.type === 'error' ? 'border-rose-500 bg-rose-50 text-rose-700' : status.type === 'success' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-blue-500 bg-blue-50 text-blue-700'}`}>
                        {status.message}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={isGenerating}
                    className="w-full rounded-xl bg-orange-500 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/20 hover:opacity-90 disabled:opacity-50 transition"
                >
                    {isGenerating ? 'Generating...' : '🛠️ Generate Report'}
                </button>
            </form>
        </SectionCard>
    );
};

export default ReportsSection;
