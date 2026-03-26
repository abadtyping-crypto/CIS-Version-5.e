import { useEffect, useState } from 'react';
import SectionCard from './SectionCard';
import { useTenant } from '../../context/useTenant';
import { fetchRecentTransactions, sendTenantDocumentEmail } from '../../lib/backendStore';
import { generateTenantPdf } from '../../lib/pdfGenerator';
import CurrencyValue from '../common/CurrencyValue';

const RecentTransactionsSection = ({ isOpen, onToggle, refreshKey }) => {
    const { tenantId } = useTenant();
    const [txs, setTxs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);


    useEffect(() => {
        if (!tenantId || !isOpen) return;

        let isMounted = true;
        const fetchData = async () => {
            setIsLoading(true);
            const res = await fetchRecentTransactions(tenantId, 15);
            if (res.ok && isMounted) setTxs(res.rows);
            if (isMounted) setIsLoading(false);
        };

        fetchData();
        return () => { isMounted = false; };
    }, [tenantId, isOpen, refreshKey]);

    const handleDownload = async (tx) => {
        let docType = 'paymentReceipt';
        if (tx.type?.includes('Disbursement') || tx.type === 'Internal Transfer') {
            docType = 'performerInvoice';
        }

        await generateTenantPdf({
            tenantId,
            documentType: docType,
            data: {
                txId: tx.displayTransactionId || tx.id,
                amount: Math.abs(tx.amount || 0),
                recipientName: tx.entityId || 'Client',
                description: tx.description || tx.type,
                date: tx.date ? new Date(tx.date).toLocaleDateString() : new Date().toLocaleDateString()
            }
        });
    };

    const handleEmail = async (tx) => {
        const email = prompt("Enter client email for document delivery:", tx.entityId?.includes('@') ? tx.entityId : '');
        if (!email) return;

        let docType = 'paymentReceipt';
        if (tx.type?.includes('Disbursement') || tx.type === 'Internal Transfer') {
            docType = 'performerInvoice';
        }

        setIsSaving(true);
        const pdfRes = await generateTenantPdf({
            tenantId,
            documentType: docType,
            data: {
                txId: tx.displayTransactionId || tx.id,
                amount: Math.abs(tx.amount || 0),
                recipientName: tx.entityId || 'Client',
                description: tx.description || tx.type,
                date: tx.date ? new Date(tx.date).toLocaleDateString() : new Date().toLocaleDateString()
            },
            save: false,
            returnBase64: true
        });

        if (pdfRes.ok) {
            const emailRes = await sendTenantDocumentEmail(
                tenantId,
                email,
                docType,
                pdfRes.base64,
                {
                    txId: tx.displayTransactionId || tx.id,
                    recipientName: tx.entityId || 'Client'
                }
            );
            if (emailRes.ok) alert("Email sent successfully!");
            else alert("Failed to send email: " + emailRes.error);
        }
        setIsSaving(false);
    };

    return (
        <SectionCard
            title="Recent Activity"
            subtitle="Historical view of transactions and document triggers"
            defaultOpen={isOpen}
            onToggle={onToggle}
        >
            <div className="space-y-3">
                {isLoading ? (
                    <div className="flex justify-center p-6">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--c-accent)] border-t-transparent" />
                    </div>
                ) : txs.length === 0 ? (
                    <p className="py-4 text-center text-xs text-[var(--c-muted)]">No recent transactions.</p>
                ) : (
                    <div className="overflow-hidden rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)]">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-[var(--c-panel)] font-bold text-[var(--c-muted)] uppercase tracking-wider">
                                <tr>
                                    <th className="px-4 py-3">ID / Date</th>
                                    <th className="px-4 py-3">Type / Description</th>
                                    <th className="px-4 py-3 text-right">Amount</th>
                                    <th className="px-4 py-3 text-center">Docs</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--c-border)]">
                                {txs.map((tx) => (
                                    <tr key={tx.id} className="group hover:bg-[var(--c-panel)]/50 transition">
                                        <td className="px-4 py-3">
                                            <p className="font-bold text-[var(--c-text)]">{tx.displayTransactionId || 'N/A'}</p>
                                            <p className="text-[10px] text-[var(--c-muted)]">{tx.date ? new Date(tx.date).toLocaleDateString() : '-'}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="font-semibold text-[var(--c-text)]">{tx.type || 'Other'}</p>
                                            <p className="truncate text-[10px] text-[var(--c-muted)] max-w-[200px]">{tx.description || '-'}</p>
                                        </td>
                                        <td className={`px-4 py-3 text-right font-bold ${tx.amount < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                            <CurrencyValue value={Math.abs(tx.amount || 0)} iconSize="h-3 w-3" />
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => handleDownload(tx)}
                                                    className="rounded-lg bg-[var(--c-panel)] p-2 text-[var(--c-muted)] hover:text-[var(--c-foreground)] hover:bg-[var(--c-surface)] border border-transparent hover:border-[var(--c-accent)]/20 transition shadow-sm"
                                                    title="Download PDF"
                                                >
                                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    disabled={isSaving}
                                                    onClick={() => handleEmail(tx)}
                                                    className="rounded-lg bg-[var(--c-panel)] p-2 text-[var(--c-muted)] hover:text-indigo-600 hover:bg-[var(--c-surface)] border border-transparent hover:border-indigo-600/20 transition shadow-sm disabled:opacity-50"
                                                    title="Email PDF"
                                                >
                                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </SectionCard>
    );
};

export default RecentTransactionsSection;
