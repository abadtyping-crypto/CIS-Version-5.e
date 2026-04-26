import { memo, useCallback, useEffect, useState } from 'react';
import { fetchDailyTransactionsPage, fetchTenantClients, fetchTenantUsersMap, softDeleteTransaction } from '../../lib/backendStore';
import { fetchServiceTemplates } from '../../lib/serviceTemplateStore';
import { useAuth } from '../../context/useAuth';
import { canUserPerformAction } from '../../lib/userControlPreferences';
import CurrencyValue from '../common/CurrencyValue';
import CreatedByIdentityCard from '../common/CreatedByIdentityCard';
import { Trash2, Lock, Clock } from 'lucide-react';

const TransactionLiveList = ({ tenantId, refreshKey }) => {
    const { user } = useAuth();
    const [rows, setRows] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [deletingId, setDeletingId] = useState(null);

    const [clientsById, setClientsById] = useState({});
    const [applicationsById, setApplicationsById] = useState({});
    const [usersById, setUsersById] = useState({});
    const [pageSize, setPageSize] = useState(50);
    const [pageIndex, setPageIndex] = useState(0);
    const [pageCursors, setPageCursors] = useState([null]);
    const [nextCursor, setNextCursor] = useState(null);
    const [hasNext, setHasNext] = useState(false);
    const canSoftDelete = canUserPerformAction(tenantId, user, 'softDeleteTransaction');

    const loadLookupData = useCallback(async () => {
        if (!tenantId) return;
        const [clientsRes, appRes, usersRes] = await Promise.all([
            fetchTenantClients(tenantId),
            fetchServiceTemplates(tenantId),
            fetchTenantUsersMap(tenantId),
        ]);
        if (clientsRes.ok) {
            const next = {};
            (clientsRes.rows || []).forEach((item) => {
                next[item.id] = item;
            });
            setClientsById(next);
        }
        if (appRes.ok) {
            const next = {};
            (appRes.rows || []).forEach((item) => {
                next[item.id] = item;
            });
            setApplicationsById(next);
        }
        if (usersRes.ok) {
            const next = {};
            (usersRes.rows || []).forEach((item) => {
                const key = String(item?.uid || item?.id || '').trim();
                if (!key || item?.deletedAt) return;
                next[key] = item;
            });
            setUsersById(next);
        }
    }, [tenantId]);

    const loadPage = useCallback(async (index, cursorOverride = null) => {
        if (!tenantId) return;
        setIsLoading(true);
        try {
            const cursor = cursorOverride !== null ? cursorOverride : (pageCursors[index] || null);
            const txRes = await fetchDailyTransactionsPage(tenantId, { pageSize, cursor });
            if (txRes.ok) {
                setRows(txRes.rows || []);
                setNextCursor(txRes.lastDoc || null);
                setHasNext(txRes.hasNext === true && Boolean(txRes.lastDoc));
                setPageIndex(index);
            }
        } finally {
            setIsLoading(false);
        }
    }, [tenantId, pageCursors, pageSize]);

    useEffect(() => {
        loadLookupData();
    }, [loadLookupData, refreshKey]);

    useEffect(() => {
        setPageIndex(0);
        setPageCursors([null]);
        void loadPage(0, null);
    }, [loadPage, pageSize, refreshKey]);

    const handleNextPage = async () => {
        if (!hasNext || !nextCursor) return;
        const nextIndex = pageIndex + 1;
        const updated = [...pageCursors];
        updated[nextIndex] = nextCursor;
        setPageCursors(updated);
        await loadPage(nextIndex, nextCursor);
    };

    const handlePrevPage = async () => {
        if (pageIndex <= 0) return;
        const prevIndex = pageIndex - 1;
        await loadPage(prevIndex, pageCursors[prevIndex] || null);
    };

    const handlePageSizeChange = (event) => {
        setPageSize(Number(event.target.value || 50));
    };

    const handleDelete = async (txId) => {
        if (!window.confirm('Are you sure you want to soft-delete this transaction for audit reversal?')) return;
        setDeletingId(txId);
        const res = await softDeleteTransaction(tenantId, txId, user.uid);
        if (res.ok) {
            await loadPage(pageIndex, pageCursors[pageIndex] || null);
        } else {
            alert(res.error || 'Failed to delete transaction.');
        }
        setDeletingId(null);
    };

    if (isLoading && rows.length === 0) {
        return (
            <div className="flex items-center justify-center rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-8 italic text-[var(--c-muted)]">
                Loading live list...
            </div>
        );
    }

    if (rows.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--c-border)] bg-[var(--c-panel)]/30 p-8 text-center text-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--c-muted)]">No Transactions Recorded</p>
                <p className="mt-2 text-[10px] text-[var(--c-muted)]">Try switching to Add New and post a transaction.</p>
            </div>
        );
    }

    return (
        <section className="space-y-4">
            <div className="flex items-center justify-between gap-3 px-2">
                <h3 className="text-sm font-semibold text-[var(--c-text)]">Existing Transactions</h3>
                <div className="flex items-center gap-2">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--c-muted)]">Per page</label>
                    <select
                        value={pageSize}
                        onChange={handlePageSizeChange}
                        className="compact-field rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-2 text-[11px] font-semibold text-[var(--c-text)]"
                    >
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={200}>200</option>
                    </select>
                </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] shadow-sm">
                <div className="desktop-table-scroll overflow-x-auto">
                    <table className="compact-table w-full text-left text-xs">
                        <thead className="border-b border-[var(--c-border)] bg-[var(--c-panel)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--c-muted)]">
                            <tr>
                                <th>Transaction ID</th>
                                <th>Client</th>
                                <th>Service</th>
                                <th className="text-right">Charge</th>
                                <th>Created By</th>
                                <th className="text-center">Audit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--c-border)]">
                            {rows.map((row) => {
                                const normalizedStatus = String(row.status || '').toLowerCase();
                                const isLocked = row.invoiced === true || Boolean(row.invoiceId) || normalizedStatus === 'invoiced';
                                const client = clientsById[row.clientId];
                                const app = applicationsById[row.applicationId];
                                const creator = usersById[String(row.createdBy || '')] || null;
                                const clientName = client?.fullName || client?.tradeName || 'Unknown Client';
                                const applicationName = app?.name || 'Unknown Application';
                                return (
                                    <tr key={row.id} className="transition hover:bg-[var(--c-panel)]/50">
                                        <td>
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-[var(--c-text)]">{row.transactionId || row.id}</span>
                                            </div>
                                            <p className="mt-1 flex items-center gap-1.5 text-[10px] text-[var(--c-muted)]">
                                                <Clock strokeWidth={1.5} className="h-2.5 w-2.5" />
                                                {new Date(row.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </td>
                                        <td>
                                            <p className="font-semibold text-[var(--c-text)]">{clientName}</p>
                                            <p className="text-[10px] text-[var(--c-muted)] uppercase">{String(client?.type || 'client')}</p>
                                        </td>
                                        <td>
                                            <p className="font-semibold text-[var(--c-text)]">{applicationName}</p>
                                        </td>
                                        <td className="text-right">
                                            <div className="font-semibold text-[var(--c-text)]">
                                                <CurrencyValue value={row.clientCharge || 0} iconSize="h-3 w-3" />
                                            </div>
                                            <p className="text-[9px] font-semibold text-emerald-500">
                                                + <CurrencyValue value={row.profit || 0} iconSize="h-2 w-2" />
                                            </p>
                                        </td>
                                        <td>
                                            <CreatedByIdentityCard
                                                uid={row.createdBy || ''}
                                                displayName={creator?.displayName || creator?.name || creator?.email || 'System'}
                                                avatarUrl={creator?.photoURL || '/avatar.png'}
                                                role={creator?.role || ''}
                                                className="max-w-[190px]"
                                            />
                                        </td>
                                        <td>
                                            <div className="flex items-center justify-center gap-2">
                                                {isLocked ? (
                                                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500" aria-label="Invoiced and locked">
                                                        <Lock strokeWidth={1.5} className="h-4 w-4" />
                                                    </div>
                                                ) : (
                                                    <>
                                                        {canSoftDelete ? (
                                                            <button
                                                                disabled={deletingId === row.id}
                                                                onClick={() => handleDelete(row.id)}
                                                                className="compact-icon-action flex items-center justify-center rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] text-rose-500 transition hover:bg-rose-500 hover:text-white disabled:opacity-50"
                                                                aria-label="Soft Delete"
                                                            >
                                                                <Trash2 strokeWidth={1.5} className="h-4 w-4" />
                                                            </button>
                                                        ) : null}
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex items-center justify-end gap-2">
                <button
                    type="button"
                    onClick={handlePrevPage}
                    disabled={isLoading || pageIndex <= 0}
                    className="compact-action rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 text-xs font-semibold text-[var(--c-text)] disabled:opacity-50"
                >
                    Previous
                </button>
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--c-muted)]">Page {pageIndex + 1}</span>
                <button
                    type="button"
                    onClick={handleNextPage}
                    disabled={isLoading || !hasNext}
                    className="compact-action rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 text-xs font-semibold text-[var(--c-text)] disabled:opacity-50"
                >
                    Next
                </button>
            </div>
        </section>
    );
};

export default memo(TransactionLiveList);
