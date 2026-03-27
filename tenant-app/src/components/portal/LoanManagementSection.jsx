import { useState, useEffect, useCallback } from 'react';
import SectionCard from './SectionCard';
import { useTenant } from '../../context/useTenant';
import { useAuth } from '../../context/useAuth';
import {
    fetchTenantPortals,
    fetchLoanPersons,
    fetchLoanPendingBalances,
    upsertLoanPerson,
    deleteLoanPerson,
    executeLoanTransaction,
} from '../../lib/backendStore';
import { generateDisplayTxId } from '../../lib/txIdGenerator';
import { canUserPerformAction } from '../../lib/userControlPreferences';
import { createSyncEvent } from '../../lib/syncEvents';
import { generateNotificationId } from '../../lib/notificationTemplate';
import IconSelect from '../common/IconSelect';
import DirhamIcon from '../common/DirhamIcon';
import PortalTransactionSelector from '../common/PortalTransactionSelector';
import MobileContactsField from '../common/MobileContactsField';
import {
    createMobileContact,
    getFilledMobileContacts,
    getPrimaryMobileContact,
    serializeMobileContacts,
    validateMobileContact,
} from '../../lib/mobileContactUtils';
import { sendUniversalNotification } from '../../lib/notificationDrafting';
import { Mail, Plus, X } from 'lucide-react';
import ProgressVideoOverlay from '../common/ProgressVideoOverlay';
import ConfirmDialog from '../common/ConfirmDialog';

const waitForMinimumProgress = async (startedAt, minimumMs = 2400) => {
    const elapsed = Date.now() - startedAt;
    if (elapsed >= minimumMs) return;
    await new Promise((resolve) => window.setTimeout(resolve, minimumMs - elapsed));
};

const makeLoanContactId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const createLoanEmailContact = (overrides = {}) => ({
    id: makeLoanContactId('email'),
    value: '',
    emailEnabled: true,
    ...overrides,
});
const toProperText = (value) =>
    String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());
const validateLoanEmail = (emailValue, fieldLabel = 'Email address') => {
    const normalized = String(emailValue || '').trim().toLowerCase();
    if (!normalized) return '';
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? '' : `${fieldLabel} format is invalid.`;
};

const LoanManagementSection = ({ isOpen, onToggle, refreshKey }) => {
    const { tenantId } = useTenant();
    const { user } = useAuth();

    const [portals, setPortals] = useState([]);
    const [persons, setPersons] = useState([]);
    const [view, setView] = useState('form'); // 'form' or 'list'
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [status, setStatus] = useState({ message: '', type: '' });

    const [form, setForm] = useState({
        personId: '',
        portalId: '',
        methodId: '',
        amount: '',
        type: 'disbursement', // 'disbursement' or 'repayment'
        description: '',
    });

    const [pendingBalance, setPendingBalance] = useState(0);
    const [showPortalBalance, setShowPortalBalance] = useState(false);

    const [showQuickAdd, setShowQuickAdd] = useState(false);
    const [newPerson, setNewPerson] = useState({
        name: '',
        mobileContacts: [createMobileContact()],
        emailContacts: [createLoanEmailContact()],
    });
    const [quickAddEmailErrors, setQuickAddEmailErrors] = useState({});
    const [confirmDialog, setConfirmDialog] = useState({ open: false });
    const openConfirm = (options) => setConfirmDialog({ open: true, isDangerous: false, ...options });
    const closeConfirm = () => setConfirmDialog((prev) => ({ ...prev, open: false }));

    const fetchData = useCallback(async () => {
        if (!tenantId) return;
        setIsLoading(true);
        const [pRes, psRes, balancesRes] = await Promise.all([
            fetchTenantPortals(tenantId),
            fetchLoanPersons(tenantId),
            fetchLoanPendingBalances(tenantId),
        ]);
        if (pRes.ok) setPortals(pRes.rows || []);
        if (psRes.ok) {
            const rows = (psRes.rows || []).filter((row) => !row.deletedAt);
            setPersons(rows);
        }
        if (balancesRes.ok) {
            setPendingBalanceMap(balancesRes.rows || {});
        }
        setIsLoading(false);
    }, [tenantId]);

    useEffect(() => {
        fetchData();
    }, [fetchData, refreshKey]);

    const [pendingBalanceMap, setPendingBalanceMap] = useState({});

    useEffect(() => {
        if (!form.personId) {
            setPendingBalance(0);
            return;
        }
        setPendingBalance(Number(pendingBalanceMap?.[form.personId] || 0));
    }, [form.personId, pendingBalanceMap]);

    useEffect(() => {
        if (!form.portalId) return;
        const portal = portals.find((item) => item.id === form.portalId);
        const nextMethodId = Array.isArray(portal?.methods) && portal.methods.length ? portal.methods[0] : '';
        setShowPortalBalance(false);
        setForm((prev) => {
            if (prev.portalId !== form.portalId) return prev;
            if (prev.methodId && Array.isArray(portal?.methods) && portal.methods.includes(prev.methodId)) return prev;
            return { ...prev, methodId: nextMethodId };
        });
    }, [form.portalId, portals]);

    const performQuickAdd = async () => {
        const normalizedName = toProperText(newPerson.name);
        if (!normalizedName) {
            setStatus({ message: 'Loan person name is required.', type: 'error' });
            return;
        }

        const filledMobiles = getFilledMobileContacts(newPerson.mobileContacts);
        const mobileError = filledMobiles
            .map((contact, index) => validateMobileContact(contact.value, contact.countryIso2, `Mobile number ${index + 1}`))
            .find(Boolean);
        if (mobileError) {
            setStatus({ message: mobileError, type: 'error' });
            return;
        }

        const filledEmailContacts = (Array.isArray(newPerson.emailContacts) ? newPerson.emailContacts : [])
            .filter((contact) => String(contact?.value || '').trim());
        const emailErrors = {};
        filledEmailContacts.forEach((contact, index) => {
            const nextError = validateLoanEmail(contact.value, `Email ${index + 1}`);
            if (nextError) emailErrors[contact.id] = nextError;
        });
        setQuickAddEmailErrors(emailErrors);
        if (Object.keys(emailErrors).length > 0) {
            setStatus({ message: 'Please fix the email format before saving.', type: 'error' });
            return;
        }

        setIsSaving(true);
        const personId = await generateDisplayTxId(tenantId, 'LOAN');
        const primaryMobile = getPrimaryMobileContact(newPerson.mobileContacts);
        const primaryEmail = filledEmailContacts[0]?.value?.trim().toLowerCase() || '';
        const res = await upsertLoanPerson(tenantId, personId, {
            name: normalizedName,
            phone: primaryMobile?.value || '',
            email: primaryEmail,
            pendingBalance: 0,
            totalDisbursed: 0,
            totalRepaid: 0,
            mobileContacts: serializeMobileContacts(newPerson.mobileContacts),
            emailContacts: filledEmailContacts.map((contact) => ({
                value: String(contact.value || '').trim().toLowerCase(),
                emailEnabled: contact.emailEnabled !== false,
            })),
            displayPersonId: personId,
            status: 'active',
            createdAt: new Date().toISOString(),
            createdBy: user.uid
        });

        if (res.ok) {
            setPersons(prev => [...prev, {
                id: personId,
                name: normalizedName,
                phone: primaryMobile?.value || '',
                email: primaryEmail,
                displayPersonId: personId,
                mobileContacts: serializeMobileContacts(newPerson.mobileContacts),
                emailContacts: filledEmailContacts.map((contact) => ({
                    value: String(contact.value || '').trim().toLowerCase(),
                    emailEnabled: contact.emailEnabled !== false,
                })),
            }]);
            setForm(f => ({ ...f, personId }));
            setNewPerson({ name: '', mobileContacts: [createMobileContact()], emailContacts: [createLoanEmailContact()] });
            setQuickAddEmailErrors({});
            setShowQuickAdd(false);
            setStatus({ message: "Person added!", type: 'success' });
            await createSyncEvent({
                tenantId,
                eventType: 'create',
                entityType: 'loanPerson',
                entityId: personId,
                createdBy: user.uid,
                changedFields: ['name', 'phone', 'email', 'status']
            });
            await sendUniversalNotification({
                tenantId,
                notificationId: generateNotificationId({ topic: 'finance', subTopic: 'loan' }),
                topic: 'finance',
                subTopic: 'loan',
                type: 'create',
                title: 'Loan Person Added',
                detail: `${normalizedName} added to loan management.`,
                createdBy: user.uid,
                routePath: `/t/${tenantId}/portal-management`,
                actionPresets: ['view'],
                eventType: 'create',
                entityType: 'loanPerson',
                entityId: personId,
                entityLabel: normalizedName,
                pageKey: 'portalManagement',
                sectionKey: 'loanManagement',
                quickView: {
                    badge: 'Loan Person',
                    title: normalizedName,
                    subtitle: personId,
                    description: 'Loan person created and ready for loan disbursement or repayment tracking.',
                    fields: [
                        { label: 'Mobile', value: primaryMobile?.value || 'Not provided' },
                        { label: 'Email', value: primaryEmail || 'Not provided' },
                    ],
                },
            });
            setTimeout(() => setStatus({ message: '', type: '' }), 2000);
        } else {
            setStatus({ message: res.error, type: 'error' });
        }
        setIsSaving(false);
    };

    const handleQuickAdd = () => {
        const normalizedName = toProperText(newPerson.name);
        openConfirm({
            title: 'Add Loan Person?',
            message: `Confirm adding ${normalizedName || 'this person'} to loan management.`,
            confirmText: 'Add Person',
            onConfirm: async () => {
                closeConfirm();
                await performQuickAdd();
            },
        });
    };

    const performDeletePerson = async (p) => {
        setIsSaving(true);
        const res = await deleteLoanPerson(tenantId, p.id, user.uid);
        if (res.ok) {
            setStatus({ message: 'Person moved to Recycle Bin.', type: 'success' });
            fetchData();
            setTimeout(() => setStatus({ message: '', type: '' }), 2000);
        } else {
            setStatus({ message: res.error || 'Delete failed.', type: 'error' });
        }
        setIsSaving(false);
    };

    const handleDeletePerson = (p) => {
        openConfirm({
            title: 'Delete Loan Person?',
            message: `Permanently delete ${p.name}? This can be recovered from the Recycle Bin.`,
            confirmText: 'Delete',
            isDangerous: true,
            onConfirm: async () => {
                closeConfirm();
                await performDeletePerson(p);
            },
        });
    };

    const performTransaction = async () => {
        setIsSaving(true);
        const startedAt = Date.now();
        try {
            const displayTxId = await generateDisplayTxId(tenantId, 'LON');
            const res = await executeLoanTransaction(tenantId, {
                ...form,
                amount: Number(form.amount),
                displayTxId,
                createdBy: user.uid,
            });

            if (res.ok) {
                await waitForMinimumProgress(startedAt);
                const finalTxId = res.displayTxId || displayTxId;
                setStatus({
                    message: `Success! ID: ${finalTxId}`,
                    type: 'success',
                });
                setForm(f => ({ ...f, amount: '', description: '' }));
                fetchData();

                await createSyncEvent({
                    tenantId,
                    eventType: 'transaction',
                    entityType: 'loan',
                    entityId: res.batchId,
                    createdBy: user.uid
                });

                setTimeout(() => setStatus({ message: '', type: '' }), 3000);
            } else {
                setStatus({ message: res.error || "Failed unexpectedly.", type: 'error' });
            }
        } catch (err) {
            setStatus({ message: err.message, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleTransaction = (e) => {
        e.preventDefault();
        setStatus({ message: '', type: '' });

        if (!form.personId || !form.portalId || !form.methodId || !form.amount) {
            setStatus({ message: "Please fill in all required fields.", type: 'error' });
            return;
        }

        openConfirm({
            title: form.type === 'disbursement' ? 'Disburse Loan?' : 'Record Repayment?',
            message: form.type === 'disbursement'
                ? 'Confirm this loan disbursement transaction.'
                : 'Confirm this repayment transaction.',
            confirmText: form.type === 'disbursement' ? 'Disburse' : 'Record',
            onConfirm: async () => {
                closeConfirm();
                await performTransaction();
            },
        });
    };

    const selectedPerson = persons.find(p => p.id === form.personId);
    const selectedPortal = portals.find((item) => item.id === form.portalId) || null;
    const typedAmount = Math.max(0, Number(form.amount || 0));
    const hasTypedAmount = Number.isFinite(typedAmount) && typedAmount > 0;
    const projectedPortalBalance = selectedPortal
        ? Number(selectedPortal.balance || 0) + (form.type === 'repayment' ? typedAmount : -typedAmount)
        : null;

    return (
        <SectionCard
            title="Loan Management"
            subtitle="Originate loans or record repayments"
            defaultOpen={isOpen}
            onToggle={onToggle}
        >
            <div className="space-y-4">
                {/* Pending Balance Banner */}
                {selectedPerson && (
                    <div className="flex items-center justify-between rounded-2xl border border-[var(--c-border)] bg-[color:color-mix(in_srgb,var(--c-accent)_10%,var(--c-surface)_90%)] p-3 text-[var(--c-text)] shadow-sm">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--c-muted)]">Pending Balance</p>
                            <p className="text-xl font-semibold">
                                <span className="inline-flex items-center gap-2">
                                    <img src="/dirham.svg" alt="Dhs" className="h-5 w-5 object-contain" />
                                    {(pendingBalance || 0).toLocaleString()}
                                </span>
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--c-muted)]">Loan Person</p>
                            <p className="text-xs font-bold">{selectedPerson.name}</p>
                        </div>
                    </div>
                )}

                {/* Mode Selector */}
                <div className="flex rounded-xl bg-[var(--c-panel)] p-1">
                    <button
                        onClick={() => setForm(f => ({ ...f, type: 'disbursement' }))}
                        className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${form.type === 'disbursement' ? 'bg-[var(--c-accent)] text-white shadow-sm' : 'text-[var(--c-muted)] hover:text-[var(--c-text)]'}`}
                    >
                        Give Loan
                    </button>
                    <button
                        onClick={() => setForm(f => ({ ...f, type: 'repayment' }))}
                        className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${form.type === 'repayment' ? 'bg-[var(--c-accent)] text-white shadow-sm' : 'text-[var(--c-muted)] hover:text-[var(--c-text)]'}`}
                    >
                        Receive Payment
                    </button>
                </div>

                {view === 'list' ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                        {isLoading ? (
                            <p className="col-span-full py-4 text-center text-xs text-[var(--c-muted)]">Loading loan persons...</p>
                        ) : persons.length === 0 ? (
                            <p className="col-span-full py-4 text-center text-xs text-[var(--c-muted)]">No persons found.</p>
                        ) : (
                            persons.map(p => (
                                <div key={p.id} className="flex items-center justify-between rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] p-3 shadow-sm transition hover:border-[var(--c-accent)]">
                                    <div className="min-w-0">
                                        <p className="truncate text-xs font-bold text-[var(--c-text)]">{p.name}</p>
                                        <p className="text-[10px] text-[var(--c-muted)]">{p.phone || 'No phone'}</p>
                                    </div>
                                    <button
                                        onClick={() => handleDeletePerson(p)}
                                        className="rounded-lg bg-[var(--c-panel)] p-1.5 text-[var(--c-muted)] hover:text-rose-500 transition"
                                    >
                                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            ))
                        )}
                        <button
                            onClick={() => setView('form')}
                            className="col-span-full mt-2 text-xs font-bold text-[var(--c-accent)] hover:underline"
                        >
                            ← Back to Transaction
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleTransaction} className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            {/* Person Selection */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-bold uppercase text-[var(--c-muted)]">Loan Person</label>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setView('list')}
                                            className="text-[10px] font-bold text-[var(--c-muted)] hover:text-[var(--c-text)] hover:underline"
                                        >
                                            Manage
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowQuickAdd(!showQuickAdd)}
                                            className="text-[10px] font-bold text-[var(--c-accent)] hover:underline"
                                        >
                                            {showQuickAdd ? 'Cancel' : '+ Quick Add'}
                                        </button>
                                    </div>
                                </div>

                                {showQuickAdd ? (
                                    <div className="mt-2 space-y-3 rounded-2xl border border-[var(--c-accent)]/20 bg-[color:color-mix(in_srgb,var(--c-accent)_7%,var(--c-surface))] p-3 animate-in fade-in slide-in-from-top-2">
                                        <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2">
                                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--c-accent)]">Quick Add</p>
                                            <p className="mt-1 text-xs font-semibold text-[var(--c-text)]">Create a loan person without leaving this page.</p>
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Full Name"
                                            value={newPerson.name}
                                            onChange={e => setNewPerson(p => ({ ...p, name: e.target.value }))}
                                            className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 text-xs font-bold text-[var(--c-text)] outline-none transition focus:border-[var(--c-accent)] focus:ring-2 focus:ring-[var(--c-accent)]/15 placeholder:text-[var(--c-muted)]"
                                        />
                                        <MobileContactsField
                                            label="Mobile Numbers"
                                            contacts={newPerson.mobileContacts}
                                            onChange={(contacts) => setNewPerson((prev) => ({ ...prev, mobileContacts: contacts }))}
                                        />
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <p className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">Email Address</p>
                                                <button
                                                    type="button"
                                                    onClick={() => setNewPerson((prev) => (
                                                        prev.emailContacts.length >= 3 || !String(prev.emailContacts[0]?.value || '').trim()
                                                            ? prev
                                                            : { ...prev, emailContacts: [...prev.emailContacts, createLoanEmailContact()] }
                                                    ))}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] text-[var(--c-text)] transition hover:border-[var(--c-accent)] hover:text-[var(--c-accent)] disabled:cursor-not-allowed disabled:opacity-35"
                                                    disabled={newPerson.emailContacts.length >= 3 || !String(newPerson.emailContacts[0]?.value || '').trim()}
                                                    aria-label="Add email"
                                                >
                                                    <Plus strokeWidth={1.5} className="h-4 w-4" />
                                                </button>
                                            </div>
                                            <div className="space-y-3">
                                                {newPerson.emailContacts.map((contact) => (
                                                    <div key={contact.id} className="flex items-start gap-2">
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex h-11 items-center rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 focus-within:border-[var(--c-accent)] focus-within:ring-4 focus-within:ring-[var(--c-accent)]/5">
                                                                <input
                                                                    type="email"
                                                                    value={contact.value}
                                                                    onChange={(e) => {
                                                                        const normalized = String(e.target.value || '').toLowerCase().replace(/\s+/g, '');
                                                                        setNewPerson((prev) => ({
                                                                            ...prev,
                                                                            emailContacts: prev.emailContacts.map((row) => (
                                                                                row.id === contact.id ? { ...row, value: normalized } : row
                                                                            )),
                                                                        }));
                                                                        setQuickAddEmailErrors((prev) => (
                                                                            prev[contact.id]
                                                                                ? { ...prev, [contact.id]: validateLoanEmail(normalized) }
                                                                                : prev
                                                                        ));
                                                                    }}
                                                                    onBlur={() => {
                                                                        setQuickAddEmailErrors((prev) => ({
                                                                            ...prev,
                                                                            [contact.id]: validateLoanEmail(contact.value),
                                                                        }));
                                                                    }}
                                                                    placeholder="email@domain.com"
                                                                    className="w-full bg-transparent text-sm font-semibold text-[var(--c-text)] outline-none placeholder:text-[var(--c-muted)]"
                                                                />
                                                            </div>
                                                            {quickAddEmailErrors[contact.id] ? (
                                                                <p className="mt-2 text-xs font-bold text-red-400">{quickAddEmailErrors[contact.id]}</p>
                                                            ) : null}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => setNewPerson((prev) => {
                                                                const target = prev.emailContacts.find((row) => row.id === contact.id);
                                                                if (!target) return prev;
                                                                const nextEnabled = !target.emailEnabled;
                                                                let nextContacts = prev.emailContacts.map((row) => (
                                                                    row.id === contact.id ? { ...row, emailEnabled: nextEnabled } : row
                                                                ));
                                                                if (!nextEnabled && nextContacts.length < 3) {
                                                                    nextContacts = [...nextContacts, createLoanEmailContact()];
                                                                }
                                                                return { ...prev, emailContacts: nextContacts };
                                                            })}
                                                            className={`mt-1 inline-flex h-11 w-11 items-center justify-center rounded-xl border transition ${
                                                                contact.emailEnabled
                                                                    ? 'border-[var(--c-accent)]/45 bg-[color:color-mix(in_srgb,var(--c-accent)_12%,transparent)] text-[var(--c-accent)]'
                                                                    : 'border-[var(--c-border)] bg-[var(--c-panel)] text-[var(--c-muted)]'
                                                            }`}
                                                            aria-label={contact.emailEnabled ? 'Disable email conversation for this address' : 'Enable email conversation for this address'}
                                                        >
                                                            <Mail strokeWidth={1.5} className="h-4 w-4" />
                                                        </button>
                                                        {newPerson.emailContacts.length > 1 ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setNewPerson((prev) => {
                                                                        if (prev.emailContacts.length <= 1) {
                                                                            return { ...prev, emailContacts: [createLoanEmailContact()] };
                                                                        }
                                                                        return {
                                                                            ...prev,
                                                                            emailContacts: prev.emailContacts.filter((row) => row.id !== contact.id),
                                                                        };
                                                                    });
                                                                    setQuickAddEmailErrors((prev) => {
                                                                        const next = { ...prev };
                                                                        delete next[contact.id];
                                                                        return next;
                                                                    });
                                                                }}
                                                                className="mt-1 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] text-[var(--c-muted)] transition hover:border-rose-400/60 hover:bg-rose-500/10 hover:text-rose-400"
                                                                aria-label="Remove email address"
                                                            >
                                                                <X strokeWidth={1.5} className="h-4 w-4" />
                                                            </button>
                                                        ) : null}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex justify-end">
                                            <button
                                                type="button"
                                                onClick={handleQuickAdd}
                                                className="rounded-xl bg-[var(--c-accent)] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:opacity-90"
                                            >
                                                Add Person
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <select
                                        required
                                        value={form.personId}
                                        onChange={(e) => setForm({ ...form, personId: e.target.value })}
                                        className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-[var(--c-accent)]/20"
                                    >
                                        <option value="">Select Person</option>
                                        {persons.map((p) => (
                                            <option key={p.id} value={p.id}>
                                                {p.name || 'Unnamed'}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            <PortalTransactionSelector
                                portalLabel="Source/Target Portal"
                                methodLabel="Transaction Method"
                                portalId={form.portalId}
                                methodId={form.methodId}
                                onPortalChange={(nextPortalId) => setForm((prev) => ({ ...prev, portalId: nextPortalId, methodId: '' }))}
                                onMethodChange={(nextMethodId) => setForm((prev) => ({ ...prev, methodId: nextMethodId }))}
                                portals={portals}
                                portal={selectedPortal}
                                portalPlaceholder="Select Portal"
                                methodPlaceholder="Select Method"
                                showBalancePanel
                                showBalance={showPortalBalance}
                                onToggleBalance={() => setShowPortalBalance((prev) => !prev)}
                                projectedBalance={hasTypedAmount ? projectedPortalBalance : null}
                                currentBalanceTitle="Current Balance"
                                projectedBalanceTitle={form.type === 'disbursement' ? 'Balance After Disbursement' : 'Balance After Repayment'}
                                className="p-0 border-none bg-transparent shadow-none"
                            />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {/* Amount */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-[var(--c-muted)]">Amount</label>
                                <div className="flex items-center rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 focus-within:ring-2 focus-within:ring-[var(--c-accent)]/20">
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

                            {/* Note */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-[var(--c-muted)]">Note</label>
                                <input
                                    type="text"
                                    placeholder="..."
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    className="compact-field w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-[var(--c-accent)]/20"
                                />
                            </div>
                        </div>

                        {/* Status Message */}
                        {status.message && (
                            <div className={`rounded-xl border p-3 text-xs font-bold text-center animate-pulse ${status.type === 'error' ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-emerald-500 bg-emerald-50 text-emerald-700'}`}>
                                <div>{status.message}</div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isSaving || !canUserPerformAction(tenantId, user, 'loanManagement')}
                            className={`compact-action w-full rounded-xl py-2.5 text-sm font-semibold text-white shadow-lg transition hover:opacity-90 disabled:opacity-50 ${form.type === 'disbursement' ? 'bg-orange-500 shadow-orange-500/20' : 'bg-emerald-500 shadow-emerald-500/20'}`}
                        >
                            {form.type === 'disbursement' ? 'Disburse Funds' : 'Record Repayment'}
                        </button>
                    </form>
                )}
                <ProgressVideoOverlay
                    open={isSaving && !showQuickAdd && view === 'form'}
                    dismissible={false}
                    minimal
                    title={form.type === 'disbursement' ? 'Your loan disbursement is in progress' : 'Your repayment is in progress'}
                    subtitle="Please wait while we complete the portal transaction."
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
            </div>
        </SectionCard >
    );
};

export default LoanManagementSection;
