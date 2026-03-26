import { useState, useEffect, useCallback } from 'react';
import SectionCard from './SectionCard';
import { useTenant } from '../../context/useTenant';
import { useAuth } from '../../context/useAuth';
import { fetchTenantPortals, executeInternalTransfer, sendTenantDocumentEmail } from '../../lib/backendStore';
import { generateDisplayTxId } from '../../lib/txIdGenerator';
import { canUserPerformAction } from '../../lib/userControlPreferences';
import { generateTenantPdf } from '../../lib/pdfGenerator';
import DirhamIcon from '../common/DirhamIcon';
import PortalTransactionSelector from '../common/PortalTransactionSelector';
import ProgressVideoOverlay from '../common/ProgressVideoOverlay';
import ConfirmDialog from '../common/ConfirmDialog';

const waitForMinimumProgress = async (startedAt, minimumMs = 2400) => {
    const elapsed = Date.now() - startedAt;
    if (elapsed >= minimumMs) return;
    await new Promise((resolve) => window.setTimeout(resolve, minimumMs - elapsed));
};

const InternalTransferSection = ({ isOpen, onToggle, refreshKey }) => {
    const { tenantId } = useTenant();
    const { user } = useAuth();

    const [portals, setPortals] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [status, setStatus] = useState({ message: '', type: '' });
    const [confirmDialog, setConfirmDialog] = useState({ open: false });
    const [showSourceBalance, setShowSourceBalance] = useState(false);
    const [showDestinationBalance, setShowDestinationBalance] = useState(false);
    const openConfirm = (options) => setConfirmDialog({ open: true, isDangerous: false, ...options });
    const closeConfirm = () => setConfirmDialog((prev) => ({ ...prev, open: false }));

    const [form, setForm] = useState({
        fromPortalId: '',
        fromMethodId: '',
        toPortalId: '',
        toMethodId: '',
        amount: '',
        fee: '0',
        description: '',
    });

    const selectedSourcePortal = portals.find((item) => item.id === form.fromPortalId) || null;
    const selectedDestinationPortal = portals.find((item) => item.id === form.toPortalId) || null;
    const transferAmount = Math.max(0, Number(form.amount || 0));
    const transferFee = Math.max(0, Number(form.fee || 0));
    const sourceProjectedBalance = selectedSourcePortal
        ? Number(selectedSourcePortal.balance || 0) - transferAmount - transferFee
        : null;
    const destinationProjectedBalance = selectedDestinationPortal
        ? Number(selectedDestinationPortal.balance || 0) + transferAmount
        : null;

    const fetchPortals = useCallback(async () => {
        const res = await fetchTenantPortals(tenantId);
        if (res.ok) setPortals(res.rows);
    }, [tenantId]);

    useEffect(() => {
        if (!tenantId || !isOpen) return;
        fetchPortals();
    }, [tenantId, isOpen, fetchPortals, refreshKey]);

    useEffect(() => {
        if (!selectedSourcePortal) {
            setShowSourceBalance(false);
            return;
        }
        if (form.fromMethodId && Array.isArray(selectedSourcePortal.methods) && selectedSourcePortal.methods.includes(form.fromMethodId)) return;
        setForm((prev) => ({
            ...prev,
            fromMethodId: Array.isArray(selectedSourcePortal.methods) && selectedSourcePortal.methods.length ? selectedSourcePortal.methods[0] : '',
        }));
    }, [selectedSourcePortal, form.fromMethodId]);

    useEffect(() => {
        if (!selectedDestinationPortal) {
            setShowDestinationBalance(false);
            return;
        }
    }, [selectedDestinationPortal]);

    useEffect(() => {
        if (!selectedDestinationPortal) return;
        if (form.toMethodId && Array.isArray(selectedDestinationPortal.methods) && selectedDestinationPortal.methods.includes(form.toMethodId)) return;
        setForm((prev) => ({
            ...prev,
            toMethodId: Array.isArray(selectedDestinationPortal.methods) && selectedDestinationPortal.methods.length ? selectedDestinationPortal.methods[0] : '',
        }));
    }, [selectedDestinationPortal, form.toMethodId]);

    const performTransfer = async () => {
        setIsSaving(true);
        const startedAt = Date.now();
        try {
            const displayTxId = await generateDisplayTxId(tenantId, 'TRF');
            const res = await executeInternalTransfer(tenantId, {
                ...form,
                amount: Number(form.amount),
                fee: Number(form.fee || 0),
                displayTxId,
                createdBy: user.uid,
            });

            if (res.ok) {
                await waitForMinimumProgress(startedAt);
                const finalTxId = res.displayTxId || displayTxId;
                setStatus({
                    message: `Transfer successful! ID: ${finalTxId}`,
                    type: 'success',
                    download: {
                        docType: 'performerInvoice',
                        data: {
                            txId: finalTxId,
                            amount: form.amount,
                            recipientName: selectedDestinationPortal?.name || 'Destination Portal',
                            description: form.description || `Internal transfer from ${selectedSourcePortal?.name || 'Source Portal'}`,
                            date: new Date().toLocaleDateString()
                        }
                    }
                });
                setForm({ fromPortalId: '', fromMethodId: '', toPortalId: '', toMethodId: '', amount: '', fee: '0', description: '' });
                setShowSourceBalance(false);
                setShowDestinationBalance(false);
                fetchPortals();
                // No auto-clear to allow download
            } else {
                setStatus({ message: res.error || "Transfer failed.", type: 'error' });
            }
        } catch (err) {
            setStatus({ message: err.message, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleTransfer = (e) => {
        e.preventDefault();
        setStatus({ message: '', type: '' });

        if (!form.fromPortalId || !form.fromMethodId || !form.toPortalId || !form.toMethodId || !form.amount) {
            setStatus({ message: "Please fill in all required fields.", type: 'error' });
            return;
        }

        if (form.fromPortalId === form.toPortalId) {
            setStatus({ message: "Source and destination must be different.", type: 'error' });
            return;
        }

        openConfirm({
            title: 'Confirm Internal Transfer?',
            message: 'Please confirm this transfer between selected portals.',
            confirmText: 'Transfer',
            onConfirm: async () => {
                closeConfirm();
                await performTransfer();
            },
        });
    };

    return (
        <SectionCard
            title="Internal Transfer"
            subtitle="Move funds between operational portals"
            defaultOpen={isOpen}
            onToggle={onToggle}
        >
            <form onSubmit={handleTransfer} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                    <PortalTransactionSelector
                        portalLabel="Source Portal"
                        methodLabel="Sending Method"
                        portalId={form.fromPortalId}
                        methodId={form.fromMethodId}
                        onPortalChange={(nextFromPortalId) => setForm((prev) => ({
                            ...prev,
                            fromPortalId: nextFromPortalId,
                            fromMethodId: '',
                            toPortalId: prev.toPortalId === nextFromPortalId ? '' : prev.toPortalId,
                            toMethodId: prev.toPortalId === nextFromPortalId ? '' : prev.toMethodId,
                        }))}
                        onMethodChange={(nextMethodId) => setForm((prev) => ({ ...prev, fromMethodId: nextMethodId }))}
                        portals={portals}
                        portal={selectedSourcePortal}
                        portalPlaceholder="Select Source"
                        methodPlaceholder="Select Sending Method"
                        showBalancePanel
                        showBalance={showSourceBalance}
                        onToggleBalance={() => setShowSourceBalance((prev) => !prev)}
                        projectedBalance={sourceProjectedBalance}
                    />
                    <PortalTransactionSelector
                        portalLabel="Destination Portal"
                        methodLabel="Receiving Method"
                        portalId={form.toPortalId}
                        methodId={form.toMethodId}
                        onPortalChange={(nextToPortalId) => setForm((prev) => ({ ...prev, toPortalId: nextToPortalId, toMethodId: '' }))}
                        onMethodChange={(nextMethodId) => setForm((prev) => ({ ...prev, toMethodId: nextMethodId }))}
                        portals={portals}
                        portal={selectedDestinationPortal}
                        excludePortalId={form.fromPortalId}
                        portalPlaceholder={form.fromPortalId ? 'Select Destination' : 'Select source first'}
                        methodPlaceholder="Select Receiving Method"
                        disabled={!form.fromPortalId}
                        showBalancePanel={Boolean(form.toPortalId)}
                        showBalance={showDestinationBalance}
                        onToggleBalance={() => setShowDestinationBalance((prev) => !prev)}
                        projectedBalance={destinationProjectedBalance}
                    />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    {/* Amount */}
                    <div>
                        <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--c-muted)]">Transfer Amount</label>
                        <div className="mt-1 flex items-center rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 focus-within:ring-2 focus-within:ring-[var(--c-accent)]/20">
                            <DirhamIcon className="mr-2 h-4 w-4 shrink-0 text-[var(--c-muted)]" />
                            <input
                                type="number"
                                required
                                placeholder="0.00"
                                value={form.amount}
                                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                                className="w-full bg-transparent py-1.5 text-sm font-semibold outline-none"
                            />
                        </div>
                    </div>

                    {/* Fee */}
                    <div>
                        <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--c-muted)]">Transfer Fee (Optional)</label>
                        <div className="mt-1 flex items-center rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 focus-within:ring-2 focus-within:ring-[var(--c-accent)]/20">
                            <DirhamIcon className="mr-2 h-4 w-4 shrink-0 text-[var(--c-muted)]" />
                            <input
                                type="number"
                                placeholder="0.00"
                                value={form.fee}
                                onChange={(e) => setForm({ ...form, fee: e.target.value })}
                                className="w-full bg-transparent py-1.5 text-sm font-semibold outline-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Description */}
                <div>
                    <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--c-muted)]">Reference / Note</label>
                    <textarea
                        placeholder="Reason for transfer..."
                        rows={2}
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-[var(--c-accent)]/20 resize-none"
                    />
                </div>

                {/* Status Message */}
                {status.message && (
                    <div className={`rounded-xl border p-3 text-xs font-bold text-center animate-pulse ${status.type === 'error' ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-emerald-500 bg-emerald-50 text-emerald-700'}`}>
                        <div>{status.message}</div>
                        {status.download && (
                            <div className="mt-2 flex flex-wrap justify-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => generateTenantPdf({
                                        tenantId,
                                        documentType: status.download.docType,
                                        data: status.download.data
                                    })}
                                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-700 transition"
                                >
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    Download Transfer Note
                                </button>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        const email = prompt("Enter email for transfer note delivery:");
                                        if (!email) return;

                                        setIsSaving(true);
                                        const pdfRes = await generateTenantPdf({
                                            tenantId,
                                            documentType: status.download.docType,
                                            data: status.download.data,
                                            save: false,
                                            returnBase64: true
                                        });

                                        if (pdfRes.ok) {
                                            const emailRes = await sendTenantDocumentEmail(
                                                tenantId,
                                                email,
                                                status.download.docType,
                                                pdfRes.base64,
                                                status.download.data
                                            );
                                            if (emailRes.ok) alert("Email sent successfully!");
                                            else alert("Failed to send email: " + emailRes.error);
                                        }
                                        setIsSaving(false);
                                    }}
                                    className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-1.5 text-white hover:bg-slate-800 transition"
                                >
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                    Email Note
                                </button>
                            </div>
                        )}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={isSaving || !canUserPerformAction(tenantId, user, 'internalTransfer')}
                    className="compact-action w-full rounded-xl bg-[var(--c-accent)] py-2.5 text-sm font-semibold text-white shadow-lg shadow-[var(--c-accent)]/20 hover:opacity-90 disabled:opacity-50 transition"
                >
                    {isSaving ? 'Processing...' : 'Confirm Transfer'}
                </button>
            </form>
            <ProgressVideoOverlay
                open={isSaving}
                dismissible={false}
                minimal
                title="Your transfer is in progress"
                subtitle="Please wait while we complete the portal transfer."
                videoSrc="/Video/portalManagmentProgress.mp4"
                frameWidthClass="max-w-[30rem]"
                backdropClassName="bg-[rgba(255,255,255,0.94)] backdrop-blur-sm"
            />
            <ConfirmDialog
                isOpen={confirmDialog.open}
                onCancel={closeConfirm}
                onConfirm={confirmDialog.onConfirm}
                title={confirmDialog.title}
                message={confirmDialog.message}
                confirmText={confirmDialog.confirmText}
                isDangerous={confirmDialog.isDangerous}
            />
        </SectionCard>
    );
};

export default InternalTransferSection;
