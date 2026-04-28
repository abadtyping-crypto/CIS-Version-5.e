import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import PageShell from '../components/layout/PageShell';
import { useTenant } from '../context/useTenant';
import { useAuth } from '../context/useAuth';
import {
    generateNextTransactionId,
    fetchTenantPortals,
    fetchTenantClients,
} from '../lib/backendStore';
import { fetchTasks } from '../lib/workflowStore';
import { db } from '../lib/firebaseConfig';
import { createSyncEvent } from '../lib/syncEvents';
import ClientSearchField from '../components/dailyTransaction/ClientSearchField';
import ServiceSearchField from '../components/dailyTransaction/ServiceSearchField';
import TransactionLiveList from '../components/dailyTransaction/TransactionLiveList';
import QuickAddServiceTemplateModal from '../components/dailyTransaction/QuickAddServiceTemplateModal';
import DirhamIcon from '../components/common/DirhamIcon';
import CurrencyValue from '../components/common/CurrencyValue';
import { Plus, FileText, Calendar, AlertTriangle, ChevronUp, ChevronDown, Eye, EyeOff } from 'lucide-react';
import PortalTransactionSelector from '../components/common/PortalTransactionSelector';
import InputActionField from '../components/common/InputActionField';
import IdentityCardSelector from '../components/common/IdentityCardSelector';
import { ENFORCE_UNIVERSAL_APPLICATION_UID } from '../lib/universalLibraryPolicy';
import { canUserPerformAction } from '../lib/userControlPreferences';
import { toSafeDocId } from '../lib/idUtils';

const activeTabClass = 'bg-[var(--c-accent)] text-white shadow-lg shadow-[color-mix(in_srgb,var(--c-accent)_28%,transparent)]';
const accentHeroClass = 'bg-[color:color-mix(in_srgb,var(--c-accent)_10%,var(--c-surface))] border-[var(--c-accent)]/20';
const accentHeroIconClass = 'bg-[var(--c-accent)] text-white shadow-lg shadow-[color-mix(in_srgb,var(--c-accent)_24%,transparent)]';
const primaryActionClass = 'bg-[var(--c-accent)] text-white shadow-xl shadow-[color-mix(in_srgb,var(--c-accent)_24%,transparent)] hover:opacity-95';

const DailyTransactionPage = () => {
    const lockToUniversalApps = ENFORCE_UNIVERSAL_APPLICATION_UID;
    const { tenantId } = useTenant();
    const { user } = useAuth();
    const [searchParams] = useSearchParams();

    // Form State
    const [selectedParent, setSelectedParent] = useState(null);
    const [selectedDependent, setSelectedDependent] = useState(null);
    const [selectedService, setSelectedService] = useState(null);
    const [selectedPortalId, setSelectedPortalId] = useState('');
    const [selectedPortalMethod, setSelectedPortalMethod] = useState('');
    const [govCharge, setGovCharge] = useState('');
    const [clientCharge, setClientCharge] = useState('');
    const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);

    const [portals, setPortals] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [refreshListKey, setRefreshListKey] = useState(0);
    const [serviceRefreshKey, setServiceRefreshKey] = useState(0);
    const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
    const [hasDependentsForSelectedClient, setHasDependentsForSelectedClient] = useState(false);
    const [activeView, setActiveView] = useState('add');
    const [showPortalBalance, setShowPortalBalance] = useState(false);
    const [showProfit, setShowProfit] = useState(false);

    // Context from URL
    const urlClientId = searchParams.get('clientId');
    const urlDependentId = searchParams.get('dependentId');
    const urlTaskId = searchParams.get('taskId');

    const loadEssentials = useCallback(async () => {
        if (!tenantId) return;
        try {
            const [portalRes, clientRes] = await Promise.all([
                fetchTenantPortals(tenantId),
                (urlClientId || urlDependentId) ? fetchTenantClients(tenantId) : Promise.resolve({ ok: false, rows: [] })
            ]);
            if (portalRes.ok) {
                setPortals(portalRes.rows);
                setSelectedPortalId('');
                setSelectedPortalMethod('');
            }

            if (clientRes.ok) {
                const rows = clientRes.rows || [];

                if (urlTaskId) {
                    const tasksRes = await fetchTasks(tenantId);
                    if (tasksRes.ok) {
                        const task = tasksRes.rows.find(t => t.taskId === urlTaskId);
                        if (task) {
                            const foundParent = rows.find(c => c.id === task.clientId);
                            if (foundParent) setSelectedParent(foundParent);
                            setClientCharge(String(task.amount || '0'));
                            setSelectedService({ id: task.applicationId, description: task.applicationName });
                        }
                    }
                } else if (urlDependentId) {
                    const foundDependent = rows.find((item) => item.id === urlDependentId);
                    const foundParent = rows.find((item) => item.id === foundDependent?.parentId);
                    if (foundDependent) setSelectedDependent(foundDependent);
                    if (foundParent) setSelectedParent(foundParent);
                } else if (urlClientId) {
                    const found = rows.find(c => c.id === urlClientId);
                    if (found) setSelectedParent(found);
                }
            }
        } catch (err) {
            console.error('[DailyTransactionPage] Load failed:', err);
            setError('Failed to load initial data.');
        }
    }, [tenantId, urlClientId, urlDependentId, urlTaskId]);

    useEffect(() => {
        const handle = requestAnimationFrame(loadEssentials);
        return () => cancelAnimationFrame(handle);
    }, [loadEssentials]);

    useEffect(() => {
        let active = true;
        const checkDependents = async () => {
            if (!tenantId || !selectedParent?.id) {
                setHasDependentsForSelectedClient(false);
                return;
            }
            const res = await fetchTenantClients(tenantId);
            if (!active || !res.ok) {
                setHasDependentsForSelectedClient(false);
                return;
            }
            const hasDependents = (res.rows || []).some(
                (item) =>
                    String(item.type || '').toLowerCase() === 'dependent' &&
                    String(item.parentId) === String(selectedParent.id),
            );
            setHasDependentsForSelectedClient(hasDependents);
            if (!hasDependents) setSelectedDependent(null);
        };
        void checkDependents();
        return () => {
            active = false;
        };
    }, [tenantId, selectedParent?.id]);

    const profit = useMemo(() => {
        const c = Number(clientCharge) || 0;
        const g = Number(govCharge) || 0;
        return c - g;
    }, [clientCharge, govCharge]);

    const selectedPortal = useMemo(
        () => portals.find((item) => item.id === selectedPortalId) || null,
        [portals, selectedPortalId],
    );
    const selectedClientBalance = useMemo(() => {
        const balanceRaw = selectedParent?.balance ?? selectedParent?.openingBalance ?? 0;
        const numeric = Number(balanceRaw);
        return Number.isFinite(numeric) ? numeric : 0;
    }, [selectedParent]);
    const projectedClientBalance = useMemo(() => selectedClientBalance - (Number(clientCharge) || 0), [selectedClientBalance, clientCharge]);
    const isNegativeBalance = projectedClientBalance < 0;
    const isClientContext = Boolean(urlClientId) && !urlDependentId;
    const isDependentContext = Boolean(urlDependentId);

    const handleServiceSelect = (tpl) => {
        setSelectedService(tpl);
        setGovCharge(String(tpl.govCharge || '0'));
        setClientCharge(String(tpl.clientCharge || '0'));
    };

    const handleReset = () => {
        if (!isClientContext && !isDependentContext) {
            setSelectedParent(null);
            setSelectedDependent(null);
        }
        setSelectedService(null);
        setGovCharge('');
        setClientCharge('');
        setSuccess('');
        setError('');
        setShowPortalBalance(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSaving) return; // Prevention
        const clientToSave = selectedDependent || selectedParent;
        if (!clientToSave) return setError('Please select a client.');
        if (!selectedService) return setError('Please select an application type.');
        if (!selectedPortalId) return setError('Please select a payment portal.');
        if (!selectedPortalMethod) return setError('Please select a portal transaction method.');
        if (!clientCharge || isNaN(clientCharge)) return setError('Invalid client charge.');

        if (!canUserPerformAction(tenantId, user, 'recordDailyTransaction')) {
            return setError('You do not have permission to record daily transactions.');
        }

        setIsSaving(true);
        setError('');

        const selectedClient = selectedParent;
        const actorUid = String(user?.uid || '').trim();

        try {
            if (!actorUid) {
                setError('Authenticated user UID is required.');
                return;
            }

            const txId = await generateNextTransactionId(tenantId, 'DTID');
            const clientId = String(selectedClient?.id || clientToSave.id || '').trim();
            const dependentId = String(selectedDependent?.id || '').trim();
            const portalId = String(selectedPortalId || '').trim();
            const portalMethod = String(selectedPortalMethod || '').trim();
            const applicationId = String(selectedService?.id || '').trim();
            const applicationDescription = String(selectedService?.description || '').trim();
            const safeGovCharge = Number(govCharge || 0);
            const safeClientCharge = Number(clientCharge || 0);
            const createdAtIso = new Date(transactionDate).toISOString();

            const forbiddenIdentityKeys = ['userName', 'displayName'];

            const payload = {
                transactionId: txId,
                applicationId: applicationId || null,
                applicationDescription,
                clientId,
                dependentId: dependentId || null,
                paidPortalId: portalId,
                portalTransactionMethod: portalMethod,
                govCharge: safeGovCharge,
                clientCharge: safeClientCharge,
                profit: profit,
                status: 'active',
                invoiced: false,
                createdBy: actorUid,
                updatedBy: actorUid,
                createdAt: createdAtIso,
                updatedAt: createdAtIso,
            };

            if (forbiddenIdentityKeys.some((key) => key in payload)) {
                setError('Display identity fields are blocked. Only raw UID actor fields are allowed.');
                return;
            }

            const dailyTxRef = doc(db, 'tenants', tenantId, 'dailyTransactions', txId);
            const clientRef = doc(db, 'tenants', tenantId, 'clients', clientId);
            const portalRef = doc(db, 'tenants', tenantId, 'portals', portalId);
            const portalTxId = toSafeDocId(`${txId}-PORT`, 'portal_tx');
            const portalTxRef = doc(db, 'tenants', tenantId, 'portalTransactions', portalTxId);
            const negativeBalanceNotificationId = toSafeDocId(`negative_client_balance_${txId}`, 'ntf');
            const notificationRef = doc(db, 'tenants', tenantId, 'notifications', negativeBalanceNotificationId);
            const syncEventRef = doc(collection(db, 'tenants', tenantId, 'syncEvents'));
            const taskRef = urlTaskId ? doc(db, 'tenants', tenantId, 'tasks', urlTaskId) : null;

            const [clientSnap, portalSnap, taskSnap] = await Promise.all([
                getDoc(clientRef),
                getDoc(portalRef),
                taskRef ? getDoc(taskRef) : Promise.resolve(null),
            ]);

            if (!clientSnap.exists()) {
                setError('Selected client not found.');
                return;
            }
            if (!portalSnap.exists()) {
                setError('Selected portal not found.');
                return;
            }
            if (taskRef && taskSnap && !taskSnap.exists()) {
                setError('Linked task no longer exists.');
                return;
            }

            const clientData = clientSnap.data() || {};
            const portalData = portalSnap.data() || {};
            const currentClientBalance = Number(clientData.balance ?? clientData.openingBalance ?? 0) || 0;
            const currentPortalBalance = Number(portalData.balance ?? 0) || 0;
            const nextClientBalance = currentClientBalance - safeClientCharge;
            const nextPortalBalance = currentPortalBalance - safeGovCharge;
            const softDeleteAudience = ['super admin', 'admin', 'manager', 'accountant', 'staff'];
            const syncEvent = await createSyncEvent({
                tenantId,
                eventType: 'create',
                entityType: 'transaction',
                entityId: txId,
                changedFields: Object.keys(payload),
                createdBy: actorUid,
            });

            if (forbiddenIdentityKeys.some((key) => key in syncEvent)) {
                setError('Sync payload contains blocked identity fields.');
                return;
            }

            const batch = writeBatch(db);
            batch.set(dailyTxRef, {
                ...payload,
                updatedAt: serverTimestamp(),
            });
            batch.set(clientRef, {
                openingBalance: nextClientBalance,
                balance: nextClientBalance,
                updatedAt: serverTimestamp(),
                updatedBy: actorUid,
            }, { merge: true });
            batch.set(portalRef, {
                balance: nextPortalBalance,
                balanceType: nextPortalBalance < 0 ? 'negative' : 'positive',
                updatedAt: serverTimestamp(),
                updatedBy: actorUid,
            }, { merge: true });

            if (safeGovCharge > 0) {
                batch.set(portalTxRef, {
                    portalId,
                    displayTransactionId: txId,
                    amount: -safeGovCharge,
                    type: 'Daily Transaction',
                    category: 'Government Charge',
                    method: portalMethod,
                    description: `Government charge for ${txId}`,
                    date: createdAtIso,
                    entityType: 'transaction',
                    entityId: txId,
                    affectsPortalBalance: true,
                    status: 'active',
                    createdAt: serverTimestamp(),
                    createdBy: actorUid,
                    updatedAt: serverTimestamp(),
                    updatedBy: actorUid,
                });
            }

            if (nextClientBalance < 0) {
                batch.set(notificationRef, {
                    title: 'Insufficient Client Balance',
                    message: `Transaction ${txId} resulted in a negative balance.`,
                    eventKey: 'negativeClientBalance',
                    tenantId,
                    transactionId: txId,
                    clientId,
                    targetRoles: softDeleteAudience,
                    routePath: `/t/${tenantId}/daily-transactions`,
                    status: 'unread',
                    createdAt: serverTimestamp(),
                    createdBy: actorUid,
                    updatedAt: serverTimestamp(),
                    updatedBy: actorUid,
                }, { merge: true });
            }

            batch.set(syncEventRef, {
                ...syncEvent,
                updatedAt: serverTimestamp(),
                updatedBy: actorUid,
            });

            if (taskRef) {
                batch.set(taskRef, {
                    status: 'completed',
                    transactionId: txId,
                    updatedAt: serverTimestamp(),
                    updatedBy: actorUid,
                }, { merge: true });
            }

            await batch.commit();

            setSuccess(`Transaction ${txId} saved successfully!`);
            setRefreshListKey(prev => prev + 1);
            setTimeout(() => handleReset(), 2000);
        } catch (submitError) {
            setError(submitError?.message || 'Transaction submission failed.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <PageShell
            title="Daily Transactions"
            subtitle="Record and manage daily applications and financial entries."
            iconKey="dailyTransactions"
            eyebrow="Transactions"
            widthPreset="data"
        >
            <div className="space-y-4">
                <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-2 shadow-sm">
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveView('add')}
                            className={`h-14 rounded-2xl px-3 text-base font-black transition ${activeView === 'add' ? activeTabClass : 'bg-[var(--c-panel)] text-[var(--c-muted)]'}`}
                        >
                            Add New
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveView('existing')}
                            className={`h-14 rounded-2xl px-3 text-base font-black transition ${activeView === 'existing' ? activeTabClass : 'bg-[var(--c-panel)] text-[var(--c-muted)]'}`}
                        >
                            Existing
                        </button>
                    </div>
                </div>
                {activeView === 'add' ? (
                    <>
                        {/* Hero Header matching screenshot */}
                        <div className={`flex items-center gap-3 rounded-2xl p-4 shadow-sm ${accentHeroClass}`}>
                            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accentHeroIconClass}`}>
                                <FileText strokeWidth={1.5} size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-[var(--c-text)]">Transaction Entry Details</h2>
                                <p className="text-[13px] font-medium text-[var(--c-muted)]">Complete application, client, and payment information</p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Section 1: Date & Template */}
                            <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4 shadow-sm space-y-3">
                                <div className="grid gap-6 md:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[11px] font-black uppercase tracking-wider text-[var(--c-text)]">Date *</label>
                                        </div>
                                        <InputActionField
                                            type="date"
                                            value={transactionDate}
                                            onValueChange={setTransactionDate}
                                            required
                                            className="w-full"
                                            showPasteButton={false}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--c-text)]">Application Name *</label>
                                            {!lockToUniversalApps ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setIsQuickAddOpen(true)}
                                                    className="flex items-center gap-1 text-[10px] font-semibold uppercase text-[var(--c-accent)] hover:underline"
                                                >
                                                    <Plus strokeWidth={1.5} size={10} /> Add
                                                </button>
                                            ) : null}
                                        </div>
                                        <ServiceSearchField
                                            onSelect={handleServiceSelect}
                                            selectedId={selectedService?.id}
                                            placeholder="Search applications..."
                                            onCreateNew={lockToUniversalApps ? null : () => setIsQuickAddOpen(true)}
                                            refreshKey={serviceRefreshKey}
                                            editableDescription
                                            descriptionValue={selectedService?.description || ''}
                                            onDescriptionChange={(value) => setSelectedService((prev) => (prev ? { ...prev, description: value } : prev))}
                                            descriptionPlaceholder="Application description (optional)"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Client Selection - Separated Parents and Dependents */}
                            <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4 shadow-sm space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-black uppercase tracking-wider text-[var(--c-text)]">
                                        {isDependentContext ? 'Client (Auto-linked)' : 'Client *'}
                                    </label>
                                    {isClientContext || isDependentContext ? (
                                        <IdentityCardSelector
                                            entity={selectedParent || {}}
                                            tenantId={tenantId}
                                            clientId={selectedParent?.id || urlClientId}
                                            className="bg-[var(--c-panel)]"
                                        />
                                    ) : (
                                        <ClientSearchField
                                            onSelect={(c) => {
                                                setSelectedParent(c);
                                                setSelectedDependent(null);
                                                setHasDependentsForSelectedClient(false);
                                            }}
                                            selectedId={selectedParent?.id}
                                            filterType="parent"
                                            placeholder="Search clients..."
                                        />
                                    )}
                                </div>

                                {selectedParent ? (
                                    <div className={`rounded-2xl border px-4 py-3 transition ${isNegativeBalance ? 'border-amber-300 bg-amber-50' : 'border-[var(--c-border)] bg-[var(--c-panel)]'}`}>
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--c-muted)]">Current Client Balance</p>
                                                <div className={`mt-1 text-sm font-black ${selectedClientBalance < 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                                                    <CurrencyValue value={selectedClientBalance} iconSize="h-3 w-3" />
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--c-muted)]">After This Transaction</p>
                                                <div className={`mt-1 text-sm font-black ${isNegativeBalance ? 'text-rose-500' : 'text-[var(--c-text)]'}`}>
                                                    <CurrencyValue value={projectedClientBalance} iconSize="h-3 w-3" />
                                                </div>
                                            </div>
                                        </div>
                                        {isNegativeBalance ? (
                                            <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-300 bg-white/70 px-3 py-2 text-xs font-bold text-amber-700">
                                                <AlertTriangle strokeWidth={1.5} className="h-4 w-4" />
                                                Insufficient Client Balance. Transaction will still save and create a notification record.
                                            </div>
                                        ) : null}
                                    </div>
                                ) : null}

                                {selectedParent && !isDependentContext && hasDependentsForSelectedClient && (
                                    <div className="animate-in slide-in-from-top-2 duration-200">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-black uppercase tracking-wider text-[var(--c-text)]">Dependent Selection (Optional)</label>
                                            <ClientSearchField
                                                onSelect={setSelectedDependent}
                                                selectedId={selectedDependent?.id}
                                                filterType="dependent"
                                                parentId={selectedParent.id}
                                                placeholder={`Search dependents for ${selectedParent.fullName || selectedParent.tradeName}...`}
                                            />
                                        </div>
                                    </div>
                                )}

                                {isDependentContext && selectedDependent ? (
                                    <IdentityCardSelector
                                        entity={selectedDependent}
                                        tenantId={tenantId}
                                        clientId={selectedParent?.id || urlClientId}
                                        dependentId={selectedDependent.id || urlDependentId}
                                        isDependent
                                        parentClientName={selectedParent?.tradeName || selectedParent?.fullName || ''}
                                        parentClientId={selectedParent?.displayClientId || selectedParent?.id || ''}
                                        className="bg-[var(--c-panel)] font-bold"
                                    />
                                ) : null}

                            </div>

                            {/* Section 3: Financials */}
                            <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4 shadow-sm space-y-4">
                                <div className="flex items-center justify-between border-b border-[var(--c-border)] pb-2">
                                    <h3 className="text-[11px] font-black uppercase tracking-widest text-[var(--c-text)]">Financial Entry</h3>
                                    <button
                                        type="button"
                                        onClick={() => setShowProfit(prev => !prev)}
                                        className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--c-border)] bg-[var(--c-panel)] px-2 text-[10px] font-bold uppercase text-[var(--c-muted)] transition-colors hover:text-[var(--c-accent)]"
                                    >
                                        {showProfit ? <EyeOff strokeWidth={1.5} size={14} /> : <Eye strokeWidth={1.5} size={14} />}
                                        {showProfit ? 'Hide Sensitives' : 'Show Profit'}
                                    </button>
                                </div>
                                <div className="grid gap-4 sm:grid-cols-2 font-bold">
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-black uppercase tracking-wider text-[var(--c-text)]">Gov Charge *</label>
                                        <InputActionField
                                            type="number"
                                            value={String(govCharge)}
                                            onValueChange={setGovCharge}
                                            placeholder="0.00"
                                            required
                                            className="w-full font-bold"
                                            showPasteButton={false}
                                            leadIcon={DirhamIcon}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-black uppercase tracking-wider text-[var(--c-text)]">Client Charge *</label>
                                        <InputActionField
                                            type="number"
                                            value={String(clientCharge)}
                                            onValueChange={setClientCharge}
                                            placeholder="0.00"
                                            required
                                            className="w-full font-bold"
                                            showPasteButton={false}
                                            leadIcon={DirhamIcon}
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-black uppercase tracking-wider text-[var(--c-text)]">Profit Display</label>
                                        <div className="flex min-h-[3.5rem] items-center rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] px-4 text-sm font-black shadow-inner">
                                            <div className="flex h-14 w-14 shrink-0 items-center justify-center border-r border-[var(--c-border)] bg-[var(--c-panel)] mr-4 -ml-4">
                                                <DirhamIcon className="h-6 w-6 text-[var(--c-muted)]" />
                                            </div>
                                            <div className="flex-1">
                                                {showProfit ? (
                                                    <span className="text-emerald-500 animate-in fade-in duration-300">
                                                        {profit.toFixed(2)}
                                                    </span>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-[var(--c-muted)] opacity-30 select-none">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <PortalTransactionSelector
                                        portalLabel="Paid Portal *"
                                        methodLabel="Portal Transaction Method *"
                                        portalId={selectedPortalId}
                                        methodId={selectedPortalMethod}
                                        onPortalChange={(portalId) => {
                                            setSelectedPortalId(portalId);
                                            setSelectedPortalMethod('');
                                            setShowPortalBalance(false);
                                        }}
                                        onMethodChange={setSelectedPortalMethod}
                                        portals={portals}
                                        portal={selectedPortal}
                                        portalPlaceholder="Select payment portal first..."
                                        methodPlaceholder="Select transaction method"
                                        showBalancePanel={Boolean(selectedPortal)}
                                        showBalance={showPortalBalance}
                                        onToggleBalance={() => setShowPortalBalance((prev) => !prev)}
                                        projectedBalance={selectedPortal ? Number(selectedPortal.balance || 0) : null}
                                        currentBalanceTitle="Current Balance"
                                        projectedBalanceTitle="Current Balance"
                                        className="border-none bg-transparent p-0 shadow-none"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className={`min-w-[200px] rounded-2xl py-4 px-8 text-sm font-black transition active:scale-95 disabled:opacity-50 ${primaryActionClass}`}
                                >
                                    {isSaving ? 'Processing...' : 'Save Transaction'}
                                </button>
                            </div>

                            {error && <p className="text-center text-xs font-bold text-rose-500 uppercase tracking-widest">{error}</p>}
                            {success && <p className="text-center text-xs font-bold text-emerald-500 uppercase tracking-widest">{success}</p>}
                        </form>

                    </>
                ) : (
                    <TransactionLiveList
                        tenantId={tenantId}
                        refreshKey={refreshListKey}
                    />
                )}
            </div>
            <QuickAddServiceTemplateModal
                isOpen={isQuickAddOpen}
                onClose={() => setIsQuickAddOpen(false)}
                onCreated={(template) => {
                    handleServiceSelect(template);
                    setServiceRefreshKey((prev) => prev + 1);
                    setSuccess(`Application "${template.name}" created and selected.`);
                    setError('');
                }}
            />
        </PageShell>
    );
};

export default DailyTransactionPage;
