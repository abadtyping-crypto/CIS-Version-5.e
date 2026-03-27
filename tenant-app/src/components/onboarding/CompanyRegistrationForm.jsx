import { useState, useEffect, useRef } from 'react';
import { CircleHelp } from 'lucide-react';
import {
    fetchTenantPortals,
    upsertClient,
    checkTradeLicenseDuplicate,
    generateDisplayClientId,
    previewDisplayClientId,
    upsertTenantPortalTransaction,
    sendTenantWelcomeEmail,
} from '../../lib/backendStore';
import SectionCard from '../portal/SectionCard';
import { generateDisplayTxId, toSafeDocId } from '../../lib/txIdGenerator';
import IconSelect from '../common/IconSelect';
import PortalTransactionSelector from '../common/PortalTransactionSelector';
import MobileContactsField from '../common/MobileContactsField';
import EmailContactsField from '../common/EmailContactsField';
import InputActionField from '../common/InputActionField';
import DirhamIcon from '../common/DirhamIcon';
import { canUserPerformAction } from '../../lib/userControlPreferences';
import { sendUniversalNotification } from '../../lib/notificationDrafting';
import { createSyncEvent } from '../../lib/syncEvents';
import {
    createMobileContact,
    getPrimaryMobileContact,
    getFilledMobileContacts,
    serializeMobileContacts,
    validateMobileContact,
} from '../../lib/mobileContactUtils';
import EmirateSelect from '../common/EmirateSelect';
import AddressField from '../common/AddressField';
import ConfirmDialog from '../common/ConfirmDialog';
import ActionProgressOverlay from '../common/ActionProgressOverlay';
import { useTenant } from '../../context/useTenant';

const BALANCE_TYPE_OPTIONS = [
    { value: 'credit', label: 'Credit (Money with us)' },
    { value: 'debit', label: 'Debit (Our money with client)' },
];

const PORTAL_TOGGLE_OPTIONS = [
    { value: 'no', label: 'No' },
    { value: 'yes', label: 'Yes' },
];

const toTitleCase = (value) => {
    if (!value) return '';
    return String(value)
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
};

const dedupeRepeatedPhrase = (value) => {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return '';

    // Handles exact contiguous repeats like "ABAD TYPINGABAD TYPING"
    if (normalized.length % 2 === 0) {
        const half = normalized.length / 2;
        const firstHalf = normalized.slice(0, half);
        const secondHalf = normalized.slice(half);
        if (firstHalf === secondHalf) return firstHalf.trim();
    }

    // Handles spaced repeats like "ABAD TYPING ABAD TYPING"
    const tokens = normalized.split(' ');
    if (tokens.length % 2 !== 0) return normalized;
    const half = tokens.length / 2;
    const first = tokens.slice(0, half).join(' ');
    const second = tokens.slice(half).join(' ');
    return first === second ? first : normalized;
};

const removeEmptyEntries = (value) => {
    if (Array.isArray(value)) {
        const cleanedArray = value
            .map((entry) => removeEmptyEntries(entry))
            .filter((entry) => {
                if (entry === undefined || entry === null || entry === '') return false;
                if (Array.isArray(entry)) return entry.length > 0;
                if (typeof entry === 'object') return Object.keys(entry).length > 0;
                return true;
            });
        return cleanedArray.length ? cleanedArray : undefined;
    }
    if (value && typeof value === 'object') {
        const cleanedObject = {};
        Object.entries(value).forEach(([key, entry]) => {
            const cleanedEntry = removeEmptyEntries(entry);
            if (cleanedEntry !== undefined) cleanedObject[key] = cleanedEntry;
        });
        return Object.keys(cleanedObject).length ? cleanedObject : undefined;
    }
    if (value === '' || value === null || value === undefined) return undefined;
    return value;
};


const CompanyRegistrationForm = ({ activeType, tenantId, user, onCancel, onSuccess }) => {
    const { tenant } = useTenant();
    const [portals, setPortals] = useState([]);
    const [nextId, setNextId] = useState('...');
    const [form, setForm] = useState({
        tradeLicenseNumber: '',
        registeredEmirate: '',
        tradeName: '',
        primaryMobile: '',
        secondaryMobile: '',
        mobileContacts: [createMobileContact()],
        landline1: '',
        landline2: '',
        emailContacts: [{ id: 'init-1', value: '' }],
        address: '',
        poBox: '',
        poBoxEmirate: '',
        openingBalance: '',
        balanceType: '',
        createPortalTransaction: false,
        portalId: '',
        portalMethod: '',
        sendWelcomeEmail: true
    });
    const [showSecondaryLandline, setShowSecondaryLandline] = useState(false);

    const [isSaving, setIsSaving] = useState(false);
    const [status, setStatus] = useState({ type: '', message: '' });
    const submitLockRef = useRef(false);
    const [confirmDialog, setConfirmDialog] = useState({ open: false });

    const openConfirm = (opts) => setConfirmDialog({ open: true, isDangerous: false, ...opts });
    const closeConfirm = () => setConfirmDialog((prev) => ({ ...prev, open: false }));

    useEffect(() => {
        const loadInitialData = async () => {
            fetchTenantPortals(tenantId).then(res => {
                if (res.ok) setPortals(res.rows);
            });
            const previewId = await previewDisplayClientId(tenantId, 'company');
            setNextId(previewId);
        };
        loadInitialData();
    }, [tenantId]);

    const handleOpeningBalanceChange = (nextValue) => {
        const parsed = Number(nextValue);
        const hasPositiveBalance = Number.isFinite(parsed) && parsed > 0;
        setForm((prev) => ({
            ...prev,
            openingBalance: nextValue,
            balanceType: hasPositiveBalance ? prev.balanceType : '',
            createPortalTransaction: hasPositiveBalance ? prev.createPortalTransaction : false,
            portalId: hasPositiveBalance && prev.createPortalTransaction ? prev.portalId : '',
            portalMethod: hasPositiveBalance && prev.createPortalTransaction ? prev.portalMethod : '',
        }));
    };

    const handleBalanceTypeChange = (nextType) => {
        setForm((prev) => ({
            ...prev,
            balanceType: nextType,
            createPortalTransaction: nextType ? prev.createPortalTransaction : false,
            portalId: nextType && prev.createPortalTransaction ? prev.portalId : '',
            portalMethod: nextType && prev.createPortalTransaction ? prev.portalMethod : '',
        }));
    };

    const handlePortalToggleChange = (nextValue) => {
        const enabled = nextValue === 'yes';
        setForm((prev) => ({
            ...prev,
            createPortalTransaction: enabled,
            portalId: enabled ? prev.portalId : '',
            portalMethod: enabled ? prev.portalMethod : '',
        }));
    };

    const handleTradeNameChange = (value) => {
        setForm((prev) => ({ ...prev, tradeName: String(value || '').toUpperCase() }));
    };

    const handleTradeNameBlur = (value) => {
        const normalized = dedupeRepeatedPhrase(String(value || '').toUpperCase());
        setForm((prev) => ({ ...prev, tradeName: normalized }));
    };

    const handleAddressChange = (value) => {
        setForm((prev) => ({ ...prev, address: value }));
    };

    const handleLandline1Change = (value) => {
        const nextValue = String(value || '');
        setForm((prev) => ({
            ...prev,
            landline1: nextValue,
            landline2: nextValue.trim() ? prev.landline2 : '',
        }));
        if (!nextValue.trim()) setShowSecondaryLandline(false);
    };

    const normalizePhone = (val) => {
        if (!val) return '';
        const digits = val.replace(/\D/g, '');
        return digits.startsWith('0') ? digits.slice(1) : digits;
    };

    const handleSaveClick = (e) => {
        e.preventDefault();
        
        // Basic required field pre-check so dialog doesn't pop up if totally empty
        if (!form.tradeName || !form.tradeLicenseNumber || !form.registeredEmirate) {
           setStatus({ type: 'error', message: 'Trade Name, License Number, and Registered Emirates are required.' });
           return;
        }

        openConfirm({
            title: 'Confirm Registration',
            message: `Are you sure you want to register "${form.tradeName.toUpperCase().trim()}"?`,
            confirmText: 'Register Company',
            onConfirm: confirmSubmit
        });
    };

    const confirmSubmit = async () => {
        if (submitLockRef.current || isSaving) return;
        submitLockRef.current = true;
        setIsSaving(true);
        let shouldUnlock = true;
        setStatus({ type: 'info', message: 'Validating data...' });

        try {
            if (!canUserPerformAction(tenantId, user, 'createClient')) {
                setStatus({ type: 'error', message: "You don't have permission to create clients." });
                return;
            }

            const normalizedEmailContacts = (Array.isArray(form.emailContacts) ? form.emailContacts : [])
                .map((contact) => ({
                    value: String(contact?.value || '').trim().toLowerCase(),
                    emailEnabled: contact?.emailEnabled !== false,
                }))
                .filter((contact) => contact.value);

            // Normalization
            const normalized = {
                ...form,
                tradeLicenseNumber: form.tradeLicenseNumber.toUpperCase().trim(),
                tradeName: form.tradeName.toUpperCase().trim(),
                primaryMobile: getPrimaryMobileContact(form.mobileContacts).value,
                secondaryMobile: getFilledMobileContacts(form.mobileContacts)[1]?.value || '',
                mobileContacts: serializeMobileContacts(form.mobileContacts),
                landline1: normalizePhone(form.landline1),
                landline2: normalizePhone(form.landline2),
                primaryEmail: normalizedEmailContacts[0]?.value || '',
                secondaryEmail: normalizedEmailContacts[1]?.value || '',
                emailContacts: normalizedEmailContacts,
                sendWelcomeEmail: normalizedEmailContacts.length > 0 ? Boolean(form.sendWelcomeEmail) : false,
                address: toTitleCase(form.address).trim(),
                openingBalance: parseFloat(form.openingBalance) || 0,
                tenantId,
                createdBy: user.uid,
                status: 'active'
            };

            const primaryMobileError = validateMobileContact(normalized.primaryMobile, getPrimaryMobileContact(form.mobileContacts).countryIso2, 'Mobile number');
            if (primaryMobileError) {
                setStatus({ type: 'error', message: primaryMobileError });
                return;
            }
            if (!normalized.registeredEmirate) {
                setStatus({ type: 'error', message: 'Registered Emirates is required.' });
                return;
            }

            if (normalized.createPortalTransaction && !normalized.portalId) {
                setStatus({ type: 'error', message: 'Select target portal when portal transaction is enabled.' });
                return;
            }
            if (normalized.createPortalTransaction && normalized.openingBalance > 0 && !normalized.portalMethod) {
                setStatus({ type: 'error', message: 'Select portal transaction method.' });
                return;
            }

            // Duplicate Check
            setStatus({ type: 'info', message: 'Checking for duplicates...' });
            const exists = await checkTradeLicenseDuplicate(tenantId, normalized.tradeLicenseNumber);
            if (exists) {
                setStatus({ type: 'error', message: `Trade License ${normalized.tradeLicenseNumber} is already registered.` });
                return;
            }

            // ID Generation
            setStatus({ type: 'info', message: 'Generating Client ID...' });
            const displayId = await generateDisplayClientId(tenantId, 'company');

            const {
                createPortalTransaction: _createPortalTransaction,
                portalId: _portalId,
                portalMethod: _portalMethod,
                sendWelcomeEmail: _sendWelcomeEmail,
                ...clientFields
            } = normalized;

            const { openingBalance, ...persistedClientFields } = clientFields;
            const finalPayloadRaw = {
                ...persistedClientFields,
                balance: Number(openingBalance) || 0,
                displayClientId: displayId,
                type: 'company'
            };
            const finalPayload = removeEmptyEntries(finalPayloadRaw) || {};

            setStatus({ type: 'info', message: 'Saving to database...' });
            const res = await upsertClient(tenantId, null, finalPayload);

            if (res.ok) {
                await createSyncEvent({
                    tenantId,
                    eventType: 'create',
                    entityType: 'client',
                    entityId: res.id,
                    createdBy: user.uid,
                    changedFields: Object.keys(finalPayload),
                });

                if (normalized.createPortalTransaction && normalized.portalId && normalized.openingBalance > 0) {
                    const displayTxId = await generateDisplayTxId(tenantId, 'POR');
                    const portalTxId = toSafeDocId(displayTxId, 'tx');
                    const txAmount =
                        normalized.balanceType === 'debit'
                            ? -Math.abs(normalized.openingBalance)
                            : Math.abs(normalized.openingBalance);
                    const txRes = await upsertTenantPortalTransaction(tenantId, portalTxId, {
                        portalId: normalized.portalId,
                        displayTransactionId: displayTxId,
                        amount: txAmount,
                        type: 'Client Opening Balance',
                        method: normalized.portalMethod,
                        category: 'Client Onboarding',
                        description: `Opening balance for ${normalized.tradeName || normalized.tradeLicenseNumber}`,
                        clientId: res.id,
                        date: new Date().toISOString(),
                        createdBy: user.uid,
                    });
                    if (!txRes.ok) {
                        setStatus({ type: 'error', message: txRes.error || 'Portal transaction failed during onboarding.' });
                        return;
                    }
                }
                if (normalized.sendWelcomeEmail) {
                    const mailRes = await sendTenantWelcomeEmail(tenantId, {
                        toEmail: normalized.primaryEmail,
                        clientName: normalized.tradeName,
                        clientType: 'company',
                        displayClientId: displayId,
                    });
                    if (!mailRes.ok) {
                        setStatus({ type: 'error', message: mailRes.error || 'Welcome email failed after registration.' });
                        return;
                    }
                }
                if (canUserPerformAction(tenantId, user, 'notifyCreateClient')) {
                    await sendUniversalNotification({
                        tenantId,
                        topic: 'users',
                        subTopic: 'client',
                        type: 'create',
                        title: 'Company Client Added',
                        message: `${normalized.tradeName} was added successfully.`,
                        createdBy: user.uid,
                        routePath: `/t/${tenantId}/clients/${res.id}`,
                        actionPresets: ['view'],
                        eventType: 'create',
                        entityType: 'client',
                        entityId: res.id,
                        entityLabel: normalized.tradeName,
                        pageKey: 'clientOnboarding',
                        sectionKey: 'companyRegistration',
                        quickView: {
                            badge: 'Company',
                            title: normalized.tradeName,
                            subtitle: displayId,
                            description: 'Company client created from onboarding.',
                            fields: [
                                { label: 'Client ID', value: displayId },
                                { label: 'Trade License', value: normalized.tradeLicenseNumber },
                                { label: 'Mobile', value: normalized.primaryMobile },
                                { label: 'Opening Balance', value: String(normalized.openingBalance || 0) },
                            ],
                        },
                    });
                }
                shouldUnlock = false;
                setStatus({ type: 'success', message: `Successfully registered as ${displayId} !` });
                setTimeout(() => {
                    if (onSuccess) onSuccess({ id: res.id, ...finalPayload });
                }, 1000);
            } else {
                setStatus({ type: 'error', message: res.error || 'Failed to register company.' });
            }
        } finally {
            if (shouldUnlock) {
                submitLockRef.current = false;
                setIsSaving(false);
            }
        }
    };

    const selectedPortal = portals.find((p) => p.id === form.portalId) || null;
    const openingAmount = Math.abs(Number(form.openingBalance) || 0);
    const signedOpeningAmount = form.balanceType === 'debit' ? -openingAmount : openingAmount;
    const projectedBalance = selectedPortal ? Number(selectedPortal.balance || 0) + (form.createPortalTransaction ? signedOpeningAmount : 0) : null;
    const hasWelcomeEmailTarget = (Array.isArray(form.emailContacts) ? form.emailContacts : [])
        .some((contact) => String(contact?.value || '').trim().length > 0);

    return (
        <form onSubmit={handleSaveClick} className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="mb-6 flex items-center justify-between border-b border-[var(--c-border)] pb-4">
                <div>
                    <h2 className="text-lg font-semibold text-[var(--c-text)] uppercase">{activeType} Registration</h2>
                    <p className="text-xs font-semibold text-[var(--c-muted)]">Registering under {tenant?.name || tenantId}</p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--c-muted)]">Next Available ID</p>
                    <p className="text-base font-semibold text-[var(--c-accent)]">{nextId}</p>
                </div>
            </header>

            {/* 4.1 Mandatory Identity Fields */}
            <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">Trade License Number *</label>
                        <InputActionField
                            name="tradeLicenseNumber"
                            required
                            maxLength={15}
                            value={form.tradeLicenseNumber}
                            onValueChange={(value) => setForm((prev) => ({ ...prev, tradeLicenseNumber: String(value || '').toUpperCase() }))}
                            placeholder="Example: CN-1234567"
                            className="w-full"
                            inputClassName="uppercase text-sm font-bold"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">Registered Emirates *</label>
                        <EmirateSelect
                            value={form.registeredEmirate}
                            onChange={(nextEmirate) => setForm((prev) => ({ ...prev, registeredEmirate: nextEmirate }))}
                        />
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">
                            <span>Trade Name *</span>
                            <span className="inline-flex cursor-help text-[var(--c-muted)]" title="Trade Name as per License.">
                                <CircleHelp strokeWidth={1.5} className="h-3.5 w-3.5" />
                            </span>
                        </label>
                        <InputActionField
                            name="tradeName"
                            required
                            value={form.tradeName}
                            onValueChange={handleTradeNameChange}
                            onBlur={handleTradeNameBlur}
                            placeholder="ABC Company LLC"
                            autoComplete="new-password"
                            autoCorrect="off"
                            spellCheck={false}
                            className="w-full"
                            inputClassName="uppercase text-sm font-bold"
                        />
                    </div>

                    <div className="space-y-2">
                        <MobileContactsField
                            label="Mobile Numbers"
                            contacts={form.mobileContacts}
                            onChange={(contacts) => setForm((prev) => ({
                                ...prev,
                                mobileContacts: contacts,
                                primaryMobile: getPrimaryMobileContact(contacts).value,
                                secondaryMobile: getFilledMobileContacts(contacts)[1]?.value || '',
                            }))}
                            required
                        />
                    </div>
                </div>
            </div>

            {/* 4.2 & 4.4 Contact & Address */}
            <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-4">
                    <div className={`grid gap-4 ${showSecondaryLandline ? 'sm:grid-cols-2' : 'sm:grid-cols-1'}`}>
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">Landline</label>
                            <InputActionField
                                type="tel"
                                name="landline1"
                                value={form.landline1}
                                onValueChange={handleLandline1Change}
                                placeholder="Example: 04XXXXXXX"
                                inputMode="numeric"
                                className="w-full"
                                inputClassName="text-sm font-bold"
                                onAppend={form.landline1.trim() && !showSecondaryLandline ? () => setShowSecondaryLandline(true) : undefined}
                                appendLabel=""
                            />
                        </div>
                        {showSecondaryLandline ? (
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">Landline 2</label>
                                <InputActionField
                                    type="tel"
                                    name="landline2"
                                    value={form.landline2}
                                    onValueChange={(value) => setForm((prev) => ({ ...prev, landline2: value }))}
                                    placeholder="Example: 04XXXXXXX"
                                    inputMode="numeric"
                                    className="w-full"
                                    inputClassName="text-sm font-bold"
                                />
                            </div>
                        ) : null}
                    </div>

                    <div className="space-y-2">
                        <EmailContactsField
                            label="Email Addresses"
                            contacts={form.emailContacts}
                            onChange={(contacts) => setForm((prev) => ({ ...prev, emailContacts: contacts }))}
                        />
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">PO Box</label>
                            <InputActionField
                                name="poBox"
                                maxLength={10}
                                value={form.poBox}
                                onValueChange={(value) => setForm((prev) => ({ ...prev, poBox: String(value || '').replace(/\D/g, '') }))}
                                placeholder="Numbers only"
                                inputMode="numeric"
                                className="w-full"
                                inputClassName="text-sm font-bold"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className={`text-xs font-bold uppercase tracking-wider transition ${form.poBox ? 'text-[var(--c-muted)]' : 'text-slate-300'}`}>PO Box Emirate {form.poBox && '*'}</label>
                            <EmirateSelect
                                value={form.poBoxEmirate}
                                disabled={!form.poBox}
                                onChange={(val) => setForm((prev) => ({ ...prev, poBoxEmirate: val }))}
                            />
                        </div>
                    </div>

                    <AddressField
                        value={form.address}
                        onValueChange={handleAddressChange}
                    />
                </div>
            </div>

            {/* 4.5 Balance & Portal Transaction */}
            <div className="rounded-2xl border-2 border-dashed border-[var(--c-border)] bg-[var(--c-panel)]/30 p-4">
                <div className="mb-4 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-[var(--c-accent)]" />
                    <h3 className="text-sm font-semibold uppercase tracking-widest text-[var(--c-text)]">Opening Balance & Finance</h3>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">Opening Balance</label>
                        <div className="relative">
                            <DirhamIcon insideTab className="h-4 w-4 text-[var(--c-muted)]" />
                            <InputActionField
                                type="number"
                                name="openingBalance"
                                value={form.openingBalance}
                                onValueChange={handleOpeningBalanceChange}
                                placeholder="0.00"
                                inputMode="decimal"
                                showPasteButton={false}
                                className="w-full"
                                inputClassName="pl-10 text-sm font-bold"
                            />
                        </div>
                    </div>

                    {(Number(form.openingBalance) || 0) > 0 ? (
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">Balance Type *</label>
                            <IconSelect
                                value={form.balanceType}
                                onChange={handleBalanceTypeChange}
                                options={BALANCE_TYPE_OPTIONS}
                            />
                        </div>
                    ) : null}

                    {form.balanceType ? (
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">Create Portal Transaction *</label>
                            <IconSelect
                                value={form.createPortalTransaction ? 'yes' : 'no'}
                                onChange={handlePortalToggleChange}
                                options={PORTAL_TOGGLE_OPTIONS}
                            />
                        </div>
                    ) : null}

                    {form.createPortalTransaction ? (
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">Portal Selection & Transaction Method *</label>
                            <PortalTransactionSelector
                                portalLabel="Portal Selection"
                                methodLabel="Transaction Method *"
                                portalId={form.portalId}
                                methodId={form.portalMethod}
                                onPortalChange={(nextPortalId) => setForm((prev) => ({ ...prev, portalId: nextPortalId, portalMethod: '' }))}
                                onMethodChange={(nextMethod) => setForm((prev) => ({ ...prev, portalMethod: nextMethod }))}
                                portals={portals}
                                portal={selectedPortal}
                                portalPlaceholder="Select Portal"
                                methodPlaceholder="Select Method"
                                disabled={!form.createPortalTransaction}
                                showBalancePanel={form.createPortalTransaction && !!selectedPortal}
                                showBalance
                                projectedBalance={projectedBalance}
                                currentBalanceTitle="Portal Balance"
                                projectedBalanceTitle="After Posting"
                            />
                        </div>
                    ) : null}
                </div>
                <div className="mt-4 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3">
                    <label className="flex items-center justify-between gap-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">Send Welcome Email</span>
                        <input
                            type="checkbox"
                            name="sendWelcomeEmail"
                            checked={hasWelcomeEmailTarget && !!form.sendWelcomeEmail}
                            disabled={!hasWelcomeEmailTarget}
                            onChange={(e) => setForm((prev) => ({ ...prev, sendWelcomeEmail: e.target.checked }))}
                            className="h-4 w-4 accent-[var(--c-accent)] disabled:cursor-not-allowed disabled:opacity-60"
                        />
                    </label>
                    <p className="mt-1 text-[10px] text-[var(--c-muted)]">
                        {hasWelcomeEmailTarget
                            ? 'Applies to this client only. Uses Mail Configuration template.'
                            : 'Add at least one email address to enable welcome email.'}
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-3 pt-4">
                <button
                    type="submit"
                    disabled={isSaving}
                    className="compact-action flex-1 rounded-xl bg-[var(--c-accent)] py-2.5 text-sm font-semibold text-white shadow-lg shadow-[var(--c-accent)]/20 transition hover:opacity-90 disabled:opacity-50"
                >
                    {isSaving ? 'Registering...' : 'Register Company'}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="compact-action rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-6 py-2.5 text-sm font-semibold text-[var(--c-muted)] transition hover:text-[var(--c-text)]"
                >
                    Cancel
                </button>
            </div>

            {status.message && (
                <div className={`rounded-xl border p-3 text-center text-sm font-semibold animate-pulse ${status.type === 'error' ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-emerald-500 bg-emerald-50 text-emerald-700'}`}>
                    {status.message}
                </div>
            )}

            <ConfirmDialog 
                isOpen={confirmDialog.open}
                onCancel={closeConfirm}
                onConfirm={confirmDialog.onConfirm}
                title={confirmDialog.title}
                message={confirmDialog.message}
                confirmText={confirmDialog.confirmText}
                isDangerous={confirmDialog.isDangerous}
            />
            <ActionProgressOverlay
                open={isSaving}
                kind="process"
                title="Company Registration In Progress"
                subtitle="Validating, creating client profile, and synchronizing records safely."
                status="Processing Registration..."
            />
        </form>
    );
};

export default CompanyRegistrationForm;
