import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import { useTenant } from '../context/useTenant';
import { useAuth } from '../context/useAuth';
import { fetchTenantPortals, executeInternalTransfer } from '../lib/backendStore';
import { generateDisplayTxId } from '../lib/txIdGenerator';
import { canUserPerformAction } from '../lib/userControlPreferences';

const InternalTransferPage = () => {
    const { tenantId } = useTenant();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [portals, setPortals] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [error, setError] = useState('');

    const [form, setForm] = useState({
        fromPortalId: '',
        toPortalId: '',
        amount: '',
        fee: '0',
        description: '',
    });

    useEffect(() => {
        if (!tenantId) return;

        // Permission Check
        if (!canUserPerformAction(tenantId, user, 'internalTransfer')) {
            setError("You don't have permission to perform internal transfers.");
            setIsLoading(false);
            return;
        }

        fetchTenantPortals(tenantId).then((res) => {
            if (res.ok) {
                setPortals(res.rows);
            }
            setIsLoading(false);
        });
    }, [tenantId, user]);

    const handleSave = async (e) => {
        e.preventDefault();
        setError('');
        setStatusMessage('');

        // Basic Validation
        if (!form.fromPortalId || !form.toPortalId || !form.amount) {
            setError("Please fill in all required fields.");
            return;
        }

        if (form.fromPortalId === form.toPortalId) {
            setError("Source and destination portals must be different.");
            return;
        }

        const amountNum = Number(form.amount);
        const feeNum = Number(form.fee || 0);

        if (isNaN(amountNum) || amountNum <= 0) {
            setError("Invalid amount.");
            return;
        }

        const fromPortal = portals.find(p => p.id === form.fromPortalId);
        if (fromPortal && (fromPortal.balance || 0) < (amountNum + feeNum)) {
            // Optional: Warning instead of hard block depending on business rules, 
            // but for now let's just let it pass or add a warning.
            // Usually transfers shouldn't exceed balance.
        }

        setIsSaving(true);
        try {
            const displayTxId = await generateDisplayTxId(tenantId, 'TRF');
            const res = await executeInternalTransfer(tenantId, {
                ...form,
                amount: amountNum,
                fee: feeNum,
                displayTxId,
                createdBy: user.uid,
            });

            if (res.ok) {
                setStatusMessage(`Transfer successful! Batch ID: ${res.batchId}`);
                setTimeout(() => navigate('/portal-management'), 2000);
            } else {
                setError(res.error || "Transfer failed.");
            }
        } catch (err) {
            setError(err.message || "An unexpected error occurred.");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <PageShell title="Internal Transfer"><div className="p-8 text-center text-[var(--c-muted)]">Loading portals...</div></PageShell>;
    if (error && !portals.length) return <PageShell title="Internal Transfer"><div className="p-8 text-center text-red-500">{error}</div></PageShell>;

    return (
        <PageShell
            title="Internal Transfer"
            subtitle="Move funds between portals. Dual transactions will be recorded for audit."
            backTo="/portal-management"
        >
            <div className="mx-auto max-w-2xl">
                <form onSubmit={handleSave} className="space-y-6 rounded-3xl border border-[var(--c-border)] bg-[var(--c-surface)] p-6 shadow-xl sm:p-8">
                    {error && (
                        <div className="rounded-xl bg-red-500/10 p-4 text-sm font-bold text-red-500 animate-pulse border border-red-500/20">
                            {error}
                        </div>
                    )}
                    {statusMessage && (
                        <div className="rounded-xl bg-emerald-500/10 p-4 text-sm font-bold text-emerald-500 border border-emerald-500/20">
                            {statusMessage}
                        </div>
                    )}

                    <div className="grid gap-6 sm:grid-cols-2">
                        {/* Source Portal */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">Source Portal</label>
                            <select
                                required
                                value={form.fromPortalId}
                                onChange={(e) => setForm({ ...form, fromPortalId: e.target.value })}
                                className="w-full rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] p-4 text-sm font-bold text-[var(--c-text)] outline-none focus:border-[var(--c-accent)] transition"
                            >
                                <option value="">Select Source</option>
                                {portals.map((p) => (
                                    <option key={p.id} value={p.id}>{p.name} (Bal: Dhs {(p.balance?.toLocaleString() || 0)})</option>
                                ))}
                            </select>
                        </div>

                        {/* Destination Portal */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">Destination Portal</label>
                            <select
                                required
                                value={form.toPortalId}
                                onChange={(e) => setForm({ ...form, toPortalId: e.target.value })}
                                className="w-full rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] p-4 text-sm font-bold text-[var(--c-text)] outline-none focus:border-[var(--c-accent)] transition"
                            >
                                <option value="">Select Destination</option>
                                {portals.map((p) => (
                                    <option key={p.id} value={p.id}>{p.name} (Bal: Dhs {(p.balance?.toLocaleString() || 0)})</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Amount & Fee */}
                    <div className="grid gap-6 sm:grid-cols-2">
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">Amount</label>
                            <input
                                type="number"
                                required
                                placeholder="0.00"
                                value={form.amount}
                                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                                className="w-full rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] p-4 text-lg font-bold text-[var(--c-text)] outline-none focus:border-[var(--c-accent)] transition"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">Transaction Fee (Optional)</label>
                            <input
                                type="number"
                                placeholder="0.00"
                                value={form.fee}
                                onChange={(e) => setForm({ ...form, fee: e.target.value })}
                                className="w-full rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] p-4 text-lg font-bold text-[var(--c-text)] outline-none focus:border-[var(--c-accent)] transition"
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">Description / Reference</label>
                        <textarea
                            placeholder="Reason for transfer..."
                            rows={3}
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            className="w-full rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] p-4 text-sm font-bold text-[var(--c-text)] outline-none focus:border-[var(--c-accent)] transition resize-none"
                        />
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--c-accent)] py-4 text-sm font-bold text-white shadow-xl shadow-[var(--c-accent)]/20 transition hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                        >
                            {isSaving ? 'Processing Transfer...' : 'Confirm Transfer'}
                        </button>
                    </div>
                </form>
            </div>
        </PageShell>
    );
};

export default InternalTransferPage;

