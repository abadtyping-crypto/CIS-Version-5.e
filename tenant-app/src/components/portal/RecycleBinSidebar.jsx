import { useEffect, useMemo, useState } from 'react';
import { useRecycleBinData } from '../../hooks/useRecycleBinData';
import { useTenant } from '../../context/useTenant';
import { useRecycleBin } from '../../context/useRecycleBin';
import { useAuth } from '../../context/useAuth';
import { canUserPerformAction } from '../../lib/userControlPreferences';

const domains = [
    { id: 'clients', label: 'Clients', badge: 'Onboarding', icon: 'M15 19a4 4 0 00-8 0m8 0a4 4 0 01-8 0m8 0v-2a2 2 0 00-2-2H9a2 2 0 00-2 2v2m10-10a4 4 0 11-8 0 4 4 0 018 0z' },
    { id: 'portals', label: 'Portals', badge: 'Portal', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
    { id: 'transactions', label: 'Transactions', badge: 'Payments', icon: 'M12 8c-1.657 0-3 .895-3 2 0 1.105 1.343 2 3 2s3 .895 3 2c0 1.105-1.343 2-3 2m0-8V6m0 10v2m-7-6h14' },
    { id: 'loanPersons', label: 'Loan Persons', badge: 'Loans', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
    { id: 'paymentReceipts', label: 'Payment Receipts', badge: 'Payments', icon: 'M9 14l2-2 4 4m0 0l4-4m-4 4V4m-7 4h10' },
    { id: 'invoices', label: 'Invoices & Quotations', badge: 'Invoices', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z' },
    { id: 'statements', label: 'Statements', badge: 'Statements', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v14a2 2 0 01-2 2z' },
];

const RecycleBinSidebar = () => {
    const { tenantId } = useTenant();
    const { user } = useAuth();
    const [activeDomain, setActiveDomain] = useState('portals');
    const [expandedId, setExpandedId] = useState(null);
    const [timeFilter, setTimeFilter] = useState('all');
    const [currentTime, setCurrentTime] = useState(0);
    const { data, loading, restoreItem, deleteItemPermanently } = useRecycleBinData(
        tenantId,
        activeDomain,
        user?.uid,
    );
    const canHardDeleteTransaction = canUserPerformAction(tenantId, user, 'hardDeleteTransaction');
    const canHardDeleteCurrentDomain = activeDomain !== 'transactions' || canHardDeleteTransaction;
    const { isOpen, closeRecycleBin, notifyRestore } = useRecycleBin();

    useEffect(() => {
        const refreshCurrentTime = () => setCurrentTime(Date.now());
        const frame = requestAnimationFrame(refreshCurrentTime);
        const timer = window.setInterval(refreshCurrentTime, 60 * 1000);
        return () => {
            cancelAnimationFrame(frame);
            window.clearInterval(timer);
        };
    }, []);

    const handleRestore = async (id) => {
        const res = await restoreItem(id);
        if (res.ok) notifyRestore();
    };

    const handleDelete = async (id) => {
        const res = await deleteItemPermanently(id);
        if (res.ok) notifyRestore();
    };

    const filteredData = useMemo(() => {
        if (timeFilter === 'all') return data;
        const threshold = timeFilter === '24h' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
        return data.filter((item) => {
            const raw = item.deletedAt?.toDate ? item.deletedAt.toDate().getTime() : null;
            if (!raw) return true;
            return currentTime - raw <= threshold;
        });
    }, [currentTime, data, timeFilter]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex justify-end overflow-hidden">
            {/* Overlay Backdrop */}
            <div
                className="absolute inset-0 bg-[color:color-mix(in_srgb,var(--c-bg)_42%,rgba(2,6,23,0.58))] backdrop-blur-sm transition-opacity animate-in fade-in duration-300"
                onClick={closeRecycleBin}
            />

            {/* Sidebar Panel */}
            <div className="glass relative flex h-full w-full max-w-md flex-col overflow-hidden border-l border-[var(--c-border)] animate-in slide-in-from-right duration-300 sm:max-w-md">
                <header className="flex items-center justify-between border-b border-[var(--c-border)] p-4 sm:p-5">
                    <div>
                        <h2 className="text-lg font-bold text-[var(--c-text)]">Universal Recycle Bin</h2>
                        <p className="text-xs text-[var(--c-muted)]">Recover or permanently delete items</p>
                    </div>
                        <button
                        onClick={closeRecycleBin}
                        className="rounded-xl bg-[var(--c-panel)] p-2 text-[var(--c-muted)] hover:text-[var(--c-text)] transition"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </header>

                {/* Domain Tabs */}
                <div className="sticky top-0 z-10 flex flex-wrap gap-1 border-b border-[var(--c-border)] bg-[var(--c-panel)]/80 p-2 backdrop-blur">
                    {domains.map((d) => (
                        <button
                            key={d.id}
                            onClick={() => setActiveDomain(d.id)}
                            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-2 py-2 text-[10px] font-bold transition ${activeDomain === d.id ? 'bg-[var(--c-surface)] text-[var(--c-accent)] shadow-sm' : 'text-[var(--c-muted)] hover:text-[var(--c-text)]'}`}
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={d.icon} />
                            </svg>
                            <span className="hidden sm:inline">{d.label}</span>
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2 border-b border-[var(--c-border)] bg-[var(--c-panel)]/40 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--c-muted)]">
                    <span>Quick Filter</span>
                    {['all', '24h', '7d'].map((key) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setTimeFilter(key)}
                            className={`rounded-full px-2 py-1 text-[10px] font-bold ${timeFilter === key ? 'bg-[var(--c-accent)] text-white' : 'bg-[var(--c-surface)] text-[var(--c-muted)]'}`}
                        >
                            {key === 'all' ? 'All' : key === '24h' ? 'Last 24h' : 'Last 7d'}
                        </button>
                    ))}
                </div>

                {/* Item List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {loading ? (
                        <div className="flex h-40 flex-col items-center justify-center gap-3">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--c-accent)] border-t-transparent" />
                            <p className="text-xs font-medium text-[var(--c-muted)]">Fetching deleted {activeDomain}...</p>
                        </div>
                    ) : filteredData.length === 0 ? (
                        <div className="flex h-60 flex-col items-center justify-center text-center">
                            <div className="mb-4 rounded-full bg-[var(--c-panel)] p-4 text-[var(--c-muted)]">
                                <svg className="h-10 w-10 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </div>
                            <p className="text-sm font-bold text-[var(--c-text)]">Empty Bin</p>
                            <p className="text-xs text-[var(--c-muted)]">No deleted {activeDomain} found.</p>
                        </div>
                    ) : (
                        filteredData.map((item) => (
                            <div key={item.id} className="group rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-3 shadow-sm transition hover:border-[var(--c-accent)]/30 hover:shadow-md">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-bold text-[var(--c-text)]">{item.name || item.displayTransactionId || item.id}</p>
                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[var(--c-muted)]">
                                            <span>Deleted {item.deletedAt?.toDate ? item.deletedAt.toDate().toLocaleDateString() : 'recently'}</span>
                                            <span className="h-1 w-1 rounded-full bg-[var(--c-border)]" />
                                            <span className="truncate">by {item.deletedBy || 'System'}</span>
                                            <span className="rounded-full bg-[var(--c-panel)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[var(--c-muted)]">
                                                {domains.find((d) => d.id === activeDomain)?.badge || 'Module'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                                            className="rounded-lg bg-[var(--c-panel)] p-2 text-[var(--c-muted)] hover:text-[var(--c-text)] transition"
                                            title="Preview"
                                        >
                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => handleRestore(item.id)}
                                            className="rounded-lg bg-[var(--c-success-soft)] p-2 text-[var(--c-success)] transition hover:opacity-85"
                                            title="Restore"
                                        >
                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                        </button>
                                        {canHardDeleteCurrentDomain ? (
                                            <button
                                                onClick={() => {
                                                    if (confirm('Permanently delete this item? This cannot be undone.')) {
                                                        handleDelete(item.id);
                                                    }
                                                }}
                                                className="rounded-lg bg-[var(--c-danger-soft)] p-2 text-[var(--c-danger)] transition hover:opacity-85"
                                                title="Delete Permanently"
                                            >
                                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                                {expandedId === item.id ? (
                                    <div className="mt-3 rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)]/40 p-3 text-xs text-[var(--c-muted)]">
                                        <div className="grid gap-2 sm:grid-cols-2">
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wider">Module</p>
                                                <p>{item.originModule || item.sourceModule || item.module || 'Unknown'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wider">Tenant</p>
                                                <p>{tenantId}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wider">Portal</p>
                                                <p>{item.portalId || '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wider">Client</p>
                                                <p>{item.clientId || '—'}</p>
                                            </div>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        ))
                    )}
                </div>

                <footer className="border-t border-[var(--c-border)] p-4 text-center">
                    <p className="text-[10px] font-medium text-[var(--c-muted)]">
                        {activeDomain === 'transactions' && !canHardDeleteTransaction
                            ? 'Permanent removal is restricted for your user. You can still restore.'
                            : 'Items in the bin are permanently stored until manually cleared.'}
                    </p>
                </footer>
            </div>
        </div>
    );
};

export default RecycleBinSidebar;

