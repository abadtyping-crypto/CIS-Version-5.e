import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    searchClients,
    generateDisplayClientId,
    previewDisplayClientId,
    checkIndividualDuplicate,
    upsertDependentUnderParent
} from '../../lib/backendStore';
import { resolveClientTypeIcon } from '../../lib/clientIcons';
import { canUserPerformAction } from '../../lib/userControlPreferences';

// Common Components
import IconSelect from '../common/IconSelect';
import RelationSelect from '../common/RelationSelect';
import IdentityDocumentField from '../common/IdentityDocumentField';
import MobileContactsField from '../common/MobileContactsField';
import EmailContactsField from '../common/EmailContactsField';
import InputActionField from '../common/InputActionField';

import {
    createMobileContact,
    getPrimaryMobileContact,
    serializeMobileContacts,
    validateMobileContact,
} from '../../lib/mobileContactUtils';
import { getCachedSystemAssetsSnapshot, getSystemAssets } from '../../lib/systemAssetsCache';
import BulkEmployeeImportModal from '../clients/BulkEmployeeImportModal';
import { Upload, Users } from 'lucide-react';
import ActionProgressOverlay from '../common/ActionProgressOverlay';


const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

const DependentRegistrationForm = ({ activeType, tenantId, user, onCancel, onSuccess }) => {
    // --- SEARCH / PARENT SELECTION ---
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [parent, setParent] = useState(null);

    // --- FORM STATE ---
    const [nextId, setNextId] = useState('...');
    const [form, setForm] = useState({
        fullName: '',
        relationship: 'wife',
        idType: 'emirates_id',
        idNumber: '',
        mobileContacts: [createMobileContact()],
        emailContacts: [{ id: 'init-1', value: '' }],
    });

    const [isSaving, setIsSaving] = useState(false);
    const [status, setStatus] = useState({ type: '', message: '' });
    const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
    const [systemAssets, setSystemAssets] = useState(() => getCachedSystemAssetsSnapshot());

    const submitLockRef = useRef(false);

    const parentType = String(parent?.type || '').toLowerCase();
    const isCompanyParent = parentType === 'company';

    // Fetch next available ID once parent is selected
    useEffect(() => {
        if (!parent) return;
        const loadNextId = async () => {
            const previewId = await previewDisplayClientId(tenantId, 'dependent');
            setNextId(previewId);
        };
        loadNextId();
    }, [tenantId, parent]);

    const handleSearch = useCallback(async () => {
        const queryText = String(searchQuery || '').trim();
        const res = await searchClients(tenantId, queryText);
        if (res.ok) {
            const eligibleParents = (res.rows || []).filter(
                (item) => item.type === 'company' || item.type === 'individual',
            );
            setSearchResults(eligibleParents);
        }
    }, [searchQuery, tenantId]);

    useEffect(() => {
        if (!tenantId || parent) return;
        const timer = setTimeout(() => {
            handleSearch();
        }, 250);
        return () => clearTimeout(timer);
    }, [handleSearch, parent, tenantId]);

    useEffect(() => {
        getSystemAssets().then(setSystemAssets).catch(() => {});
    }, []);

    const parentOptions = useMemo(() => searchResults.map((item) => ({
        value: item.id,
        label: item.fullName || item.tradeName || item.displayClientId || item.id,
        icon: resolveClientTypeIcon(item, null, systemAssets),
        meta: `${item.displayClientId || item.id} • ${item.type}`,
    })), [searchResults, systemAssets]);

    // Allowed identification types based on parent
    const allowedIdTypes = useMemo(() => {
        if (isCompanyParent) {
            return ['emirates_id', 'passport', 'person_code', 'work_permit'];
        }
        return ['emirates_id', 'passport'];
    }, [isCompanyParent]);

    // Update relationship and reset ID if parent type changes
    useEffect(() => {
        if (!parent?.id) return;
        setForm((prev) => ({
            ...prev,
            relationship: isCompanyParent ? 'employee' : 'wife',
            idType: 'emirates_id',
            idNumber: '',
        }));
    }, [parent?.id, isCompanyParent]);

    // --- SUBMISSION ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (submitLockRef.current || isSaving) return;
        submitLockRef.current = true;
        setIsSaving(true);
        let shouldUnlock = true;
        setStatus({ type: 'info', message: 'Validating dependent data...' });

        try {
            if (!canUserPerformAction(tenantId, user, 'createClient')) {
                setStatus({ type: 'error', message: "You don't have permission to create clients." });
                return;
            }

            const normalizedEmailContacts = (Array.isArray(form.emailContacts) ? form.emailContacts : [])
                .map((contact) => ({
                    id: contact?.id || Math.random().toString(36).slice(2, 11),
                    value: String(contact?.value || '').trim().toLowerCase(),
                }))
                .filter((contact) => contact.value);
            const primaryEmail = normalizedEmailContacts[0]?.value || '';
            const primaryMobile = getPrimaryMobileContact(form.mobileContacts).value;

            // Final normalization
            const normalized = {
                fullName: form.fullName.toUpperCase().trim(),
                relationship: String(form.relationship || '').trim().toLowerCase(),
                idType: form.idType,
                idNumber: form.idNumber,
                mobile: primaryMobile,
                mobileContacts: serializeMobileContacts(form.mobileContacts),
                email: primaryEmail,
                emailContacts: normalizedEmailContacts,
                tenantId,
                parentId: parent.id,
                parentName: parent.fullName || parent.tradeName,
                parentClientType: parentType,
                createdBy: user.uid,
                status: 'active',
                type: 'dependent',
            };

            // Basic Validation
            if (!normalized.fullName) {
                setStatus({ type: 'error', message: 'Dependent Full Name is required.' });
                return;
            }
            if (!normalized.relationship) {
                setStatus({ type: 'error', message: 'Relation is required.' });
                return;
            }
            if (!normalized.idNumber) {
                setStatus({ type: 'error', message: 'Identification number is required.' });
                return;
            }
            if (!normalized.email) {
                setStatus({ type: 'error', message: 'Primary email is required.' });
                return;
            }
            if (!EMAIL_REGEX.test(normalized.email)) {
                setStatus({ type: 'error', message: 'Primary email format is invalid.' });
                return;
            }
            const invalidEmail = normalized.emailContacts.find((contact) => !EMAIL_REGEX.test(contact.value));
            if (invalidEmail) {
                setStatus({ type: 'error', message: `Email format is invalid: ${invalidEmail.value}` });
                return;
            }

            const mobileError = validateMobileContact(normalized.mobile, getPrimaryMobileContact(form.mobileContacts).countryIso2, 'Mobile number');
            if (mobileError) {
                setStatus({ type: 'error', message: mobileError });
                return;
            }

            // Identification Specific Rules
            if (normalized.idType === 'emirates_id') {
                if (normalized.idNumber.length !== 15) {
                    setStatus({ type: 'error', message: 'Emirates ID must be 15 digits.' });
                    return;
                }
                if (!normalized.idNumber.startsWith('784')) {
                    setStatus({ type: 'error', message: 'Emirates ID must start with 784.' });
                    return;
                }
            }

            // Check Duplicates
            setStatus({ type: 'info', message: 'Checking for duplicates...' });
            const exists = await checkIndividualDuplicate(tenantId, {
                method: normalized.idType,
                emiratesId: normalized.idType === 'emirates_id' ? normalized.idNumber : '',
                passportNumber: normalized.idType === 'passport' ? normalized.idNumber : '',
                fullName: normalized.fullName,
            });

            if (exists) {
                setStatus({ type: 'error', message: 'A client with similar identification already exists.' });
                return;
            }

            setStatus({ type: 'info', message: 'Generating Dependent ID...' });
            const displayId = await generateDisplayClientId(tenantId, 'dependent');
            const finalPayloadRaw = { ...normalized, displayClientId: displayId };
            const finalPayload = removeEmptyEntries(finalPayloadRaw) || {};

            setStatus({ type: 'info', message: 'Saving to database...' });
            const res = await upsertDependentUnderParent(tenantId, parent.id, displayId, finalPayload);

            if (res.ok) {
                shouldUnlock = false;
                setStatus({ type: 'success', message: `Successfully registered as ${displayId} !` });
                setTimeout(() => {
                    if (onSuccess) onSuccess({ id: res.id, ...finalPayload });
                }, 1000);
            } else {
                setStatus({ type: 'error', message: res.error || 'Failed to register dependent.' });
            }
        } finally {
            if (shouldUnlock) {
                submitLockRef.current = false;
                setIsSaving(false);
            }
        }
    };

    // --- RENDER ---
    if (!parent) {
        return (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <header className="mb-4 border-b border-[var(--c-border)] pb-4">
                    <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--c-text)]">Link Sponsor (Company or Individual)</h2>
                </header>
                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">Sponsor/Parent *</label>
                    <IconSelect
                        value=""
                        onChange={(selectedId) => {
                            const selected = searchResults.find((item) => item.id === selectedId) || null;
                            if (selected) setParent(selected);
                        }}
                        options={parentOptions}
                        searchable
                        searchValue={searchQuery}
                        onSearchChange={setSearchQuery}
                    />
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Header / Meta */}
            <header className="flex items-center justify-between border-b border-[var(--c-border)] pb-5">
                <div>
                    <h2 className="text-lg font-bold text-[var(--c-text)] uppercase">{activeType} Registration</h2>
                    <div className="mt-1-5 flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--c-muted)]">Sponsored By:</span>
                        <span className="rounded-full bg-[var(--c-accent)]/10 px-3 py-0.5 text-[10px] font-bold text-[var(--c-accent)] border border-[var(--c-accent)]/20 shadow-sm">
                            {parent.fullName || parent.tradeName} ({parent.displayClientId})
                        </span>
                        <button type="button" onClick={() => setParent(null)} className="text-[10px] font-bold text-rose-500 hover:underline transition-all">Change Sponsor</button>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setIsBulkImportOpen(true)}
                        className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-4 py-2 text-[11px] font-bold text-amber-600 border border-amber-500/20 hover:bg-amber-500 hover:text-white transition-all shadow-sm"
                    >
                        <Upload strokeWidth={1.5} size={14} />
                        Bulk Import List
                    </button>
                    <div className="text-right border-l border-[var(--c-border)] pl-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--c-muted)]">Assigned ID</p>
                        <p className="text-lg font-bold text-[var(--c-accent)]">{nextId}</p>
                    </div>
                </div>
            </header>
            
            <BulkEmployeeImportModal 
                isOpen={isBulkImportOpen}
                onClose={() => setIsBulkImportOpen(false)}
                tenantId={tenantId}
                user={user}
                preSelectedParent={parent}
                onSuccess={() => onSuccess({ fullName: 'Bulk Import Batch', type: 'dependent' })}
            />


            {/* Main Content Grid */}
            <div className="grid gap-6 md:grid-cols-2">
                {/* Left Side: Identity */}
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--c-muted)]">Dependent Name (Full) *</label>
                        <InputActionField
                            name="fullName"
                            required
                            value={form.fullName}
                            onValueChange={(val) => {
                                const sanitized = String(val || '')
                                    .toUpperCase()
                                    .replace(/[^A-Z\s]/g, '')
                                    .replace(/\s+/g, ' ');
                                setForm(prev => ({ ...prev, fullName: sanitized }));
                            }}
                            className="w-full"
                            inputClassName="uppercase text-sm font-bold tracking-tight"
                        />
                        <p className="text-[9px] font-medium text-[var(--c-muted)] opacity-70 italic">Uppercase only • Alphabetic chars and spaces only</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--c-muted)]">Relationship to Sponsor *</label>
                        <RelationSelect
                            value={form.relationship}
                            onChange={(next) => setForm(prev => ({ ...prev, relationship: next }))}
                            parentType={parentType}
                        />
                    </div>
                </div>

                {/* Right Side: Identity Document */}
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--c-muted)]">Identity Verification *</label>
                        <IdentityDocumentField
                            type={form.idType}
                            number={form.idNumber}
                            onTypeChange={(type) => setForm(prev => ({ ...prev, idType: type, idNumber: '' }))}
                            onNumberChange={(num) => setForm(prev => ({ ...prev, idNumber: num }))}
                            allowedTypes={allowedIdTypes}
                        />
                    </div>
                </div>
            </div>

            {/* Bottom Section: Contacts */}
            <div className="grid gap-6 md:grid-cols-2 pt-2">
                <MobileContactsField
                    label="Mobile Numbers (Primary First)"
                    contacts={form.mobileContacts}
                    onChange={(list) => setForm(prev => ({ ...prev, mobileContacts: list }))}
                    required
                />
                <EmailContactsField
                    label="Email Addresses *"
                    contacts={form.emailContacts}
                    onChange={(list) => setForm(prev => ({ ...prev, emailContacts: list }))}
                />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-4 pt-6">
                <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 rounded-2xl bg-[var(--c-accent)] py-3 text-sm font-bold text-white shadow-xl shadow-[var(--c-accent)]/30 transition-all hover:scale-[1.01] hover:shadow-2xl active:scale-[0.99] disabled:opacity-50 disabled:grayscale"
                >
                    {isSaving ? (
                        <span className="flex items-center justify-center gap-2">
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                            Processing Registration...
                        </span>
                    ) : 'Complete Dependent Registration'}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] px-10 py-3 text-sm font-bold text-[var(--c-muted)] transition-all hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200"
                >
                    Cancel
                </button>
            </div>

            {/* Floating Status Message */}
            {status.message && (
                <div className={`fixed bottom-8 left-1/2 z-50 -translate-x-1/2 px-8 py-3 rounded-2xl border shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-500 ${
                    status.type === 'error' 
                    ? 'border-rose-500 bg-rose-50 text-rose-700 font-bold' 
                    : 'border-[var(--c-accent)] bg-[var(--c-accent)]/5 text-[var(--c-accent)] font-bold'
                }`}>
                    {status.message}
                </div>
            )}
            <ActionProgressOverlay
                open={isSaving}
                kind="process"
                title="Dependent Registration In Progress"
                subtitle="Validating sponsor relationship and creating dependent record safely."
                status="Processing Registration..."
            />
        </form>
    );
};

export default DependentRegistrationForm;
