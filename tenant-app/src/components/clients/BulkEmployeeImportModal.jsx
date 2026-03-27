import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    X, Upload, Check, AlertTriangle, FileText, ChevronDown,
    Trash2, Calendar, CreditCard, User, MoreHorizontal,
    Globe, UserPlus, Fingerprint, Search, ShieldCheck
} from 'lucide-react';
import {
    searchClients,
    generateDisplayClientId,
    upsertDependentUnderParent,
} from '../../lib/backendStore';
import { parseMohreEmployeeList, extractPdfText } from '../../lib/bulkEmployeeParser';
import IconSelect from '../common/IconSelect';
import MobileContactsField from '../common/MobileContactsField';
import EmailContactsField from '../common/EmailContactsField';
import { createMobileContact } from '../../lib/mobileContactUtils';

/**
 * 🎨 BulkEmployeeImportModal - "LIVE GRID" STUDIO EDITION
 * 
 * - All fields (Name, Nationality, WP#, Expiry) editable directly in the list.
 * - Portal-like full screen.
 * - Minimal clicks, maximum editing speed.
 */
const BulkEmployeeImportModal = ({ isOpen, onClose, tenantId, user, onSuccess, preSelectedParent }) => {
    const hasPreSelectedParent = !!preSelectedParent;
    const [step, setStep] = useState(hasPreSelectedParent ? 2 : 1);
    const [parent, setParent] = useState(preSelectedParent || null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [extractedEmployees, setExtractedEmployees] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [fileUrl, setFileUrl] = useState(null);
    const [importStatus, setImportStatus] = useState({ current: 0, total: 0, msg: '' });
    const [parseError, setParseError] = useState('');
    const [expandedCards, setExpandedCards] = useState(new Set());
    const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

    // Safely reset state on open without cascading renders (React recommended "Derived State during Render" for prop changes)
    if (isOpen && !prevIsOpen) {
        setStep(hasPreSelectedParent ? 2 : 1);
        setParent(preSelectedParent || null);
        setExtractedEmployees([]);
        setFileUrl(null);
        setImportStatus({ current: 0, total: 0, msg: '' });
        setParseError('');
        setExpandedCards(new Set());
        setPrevIsOpen(true);
    } else if (!isOpen && prevIsOpen) {
        setPrevIsOpen(false);
    }

    const handleSearch = useCallback(async () => {
        const queryText = String(searchQuery || '').trim();
        const res = await searchClients(tenantId, queryText);
        if (res.ok) {
            setSearchResults((res.rows || []).filter(i => i.type === 'company' || i.type === 'individual'));
        }
    }, [searchQuery, tenantId]);

    useEffect(() => {
        if (!isOpen || step !== 1 || parent) return;
        const timer = setTimeout(handleSearch, 300);
        return () => clearTimeout(timer);
    }, [handleSearch, isOpen, step, parent]);

    const parentOptions = useMemo(() => searchResults.map(i => ({
        value: i.id,
        label: i.tradeName || i.fullName,
        meta: `${i.displayClientId || i.id} • ${i.type}`
    })), [searchResults]);

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setParseError('');
        setFileUrl(URL.createObjectURL(file));
        setIsProcessing(true);
        setImportStatus({ current: 0, total: 0, msg: 'Processing file… this may take a few minutes' });
        try {
            let rawText = '';

            // NEW: Support for direct .txt file uploads!
            if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) {
                rawText = await file.text();
            } else {
                rawText = await extractPdfText(file);
            }

            if (!rawText || rawText.trim().length < 20) {
                setParseError('The PDF text layer is unreadable. Ensure this is a standard MOHRE PDF.');
                setIsProcessing(false);
                setImportStatus({ current: 0, total: 0, msg: '' });
                return;
            }
            const employees = parseMohreEmployeeList(rawText).map(emp => ({
                ...emp,
                mobileContacts: [createMobileContact()],
                emailContacts: [],
                reviewed: false,
                ignored: false,
            }));
            setExtractedEmployees(employees);
            setIsProcessing(false);
            setImportStatus({ current: 0, total: 0, msg: '' });
            setStep(3);
        } catch (err) {
            setParseError(`Parser Error: ${err.message}`);
            setIsProcessing(false);
            setImportStatus({ current: 0, total: 0, msg: '' });
        }
    };

    const updateEmployee = (idx, fields) => {
        setExtractedEmployees(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], ...fields };
            return next;
        });
    };

    const removeEmployee = (idx) => setExtractedEmployees(prev => prev.filter((_, i) => i !== idx));

    const toggleCard = (idx) => {
        setExpandedCards(prev => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx); else next.add(idx);
            return next;
        });
    };

    const handleImportAll = async () => {
        if (!parent) return;
        setIsProcessing(true);
        const rowsToImport = extractedEmployees.filter(e => !e.ignored);
        const total = rowsToImport.length;
        for (let i = 0; i < rowsToImport.length; i++) {
            const emp = rowsToImport[i];
            if (emp.status === 'success') continue;
            setImportStatus({ current: i + 1, total, msg: `IMPORTING: ${emp.fullName}` });
            try {
                const displayId = await generateDisplayClientId(tenantId, 'dependent');
                const res = await upsertDependentUnderParent(tenantId, parent.id, displayId, {
                    fullName: emp.fullName.toUpperCase().trim(),
                    relationship: 'employee',
                    idType: 'person_code',
                    idNumber: emp.personCode,
                    passportNumber: emp.passportNumber,
                    cardId: emp.cardId,
                    expiryDate: emp.expiryDate,
                    nationality: emp.nationality,
                    dateOfBirth: emp.dateOfBirth,
                    mobile: emp.mobileContacts[0]?.value || '',
                    email: emp.emailContacts[0]?.value || '',
                    tenantId,
                    parentId: parent.id,
                    parentName: parent.tradeName || parent.fullName,
                    type: 'dependent',
                    status: 'active',
                    createdBy: user.uid,
                    displayClientId: displayId,
                });
                if (res.ok) updateEmployee(extractedEmployees.indexOf(emp), { status: 'success' });
                else updateEmployee(extractedEmployees.indexOf(emp), { status: 'error', importError: res.error });
            } catch (err) {
                updateEmployee(extractedEmployees.indexOf(emp), { status: 'error', importError: err.message });
            }
        }
        setImportStatus({ current: total, total, msg: 'BATCH OPERATION COMPLETE' });
        setTimeout(() => {
            setIsProcessing(false);
            const successes = extractedEmployees.filter(e => e.status === 'success').length;
            if (successes > 0 && onSuccess) onSuccess();
            if (successes === total) onClose();
        }, 2000);
    };

    if (!isOpen) return null;

    const sponsorName = parent?.tradeName || parent?.fullName || 'NOT SELECTED';

    return (
        <div className="fixed inset-0 z-[2000] flex flex-col bg-[var(--c-bg)] text-[var(--c-text)] animate-in fade-in duration-500 overflow-hidden">

            {/* STUDIO HEADER */}
            <header className="flex h-18 shrink-0 items-center justify-between border-b border-[var(--c-border)] bg-[var(--c-surface)] px-10 shadow-xl z-20">
                <div className="flex items-center gap-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl brand-gradient-bg shadow-lg">
                        <Fingerprint strokeWidth={1.5} size={28} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black uppercase tracking-tight">Bulk Import Studio</h1>
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--c-muted)]">Live Verification Mode</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    {step === 3 && (
                        <div className="flex items-center gap-4 bg-[var(--c-panel)] px-5 py-2 rounded-xl border border-[var(--c-border)]">
                            <div className="text-right">
                                <p className="text-[9px] font-black uppercase text-[var(--c-muted)] opacity-60">Authorized Sponsor</p>
                                <p className="text-sm font-black text-[var(--c-accent)] uppercase">{sponsorName}</p>
                            </div>
                            <ShieldCheck strokeWidth={1.5} size={20} className="text-emerald-500" />
                        </div>
                    )}
                    <button
                        onClick={onClose}
                        className="flex items-center gap-3 rounded-xl border border-[var(--c-danger)]/20 bg-[var(--c-danger-soft)] px-5 py-2.5 text-xs font-black text-[var(--c-danger)] transition hover:bg-[var(--c-danger)] hover:text-white"
                    >
                        <X strokeWidth={1.5} size={16} />
                        EXIT
                    </button>
                </div>
            </header>

            {/* WORKSPACE CONTENT */}
            <div className="flex flex-1 overflow-hidden">

                {(step === 1 || step === 2) && (
                    <main className="flex-1 flex items-center justify-center p-20 bg-[var(--c-bg)]">
                        <div className="w-full max-w-xl bg-[var(--c-surface)] p-12 rounded-[2.5rem] border border-[var(--c-border)] shadow-2xl glass space-y-10">
                            {step === 1 ? (
                                <div className="space-y-8 text-center">
                                    <h2 className="text-3xl font-black">Identify Sponsor</h2>
                                    <IconSelect
                                        value={parent?.id || ''}
                                        onChange={(id) => setParent(searchResults.find(r => r.id === id))}
                                        options={parentOptions}
                                        searchable
                                        searchValue={searchQuery}
                                        onSearchChange={setSearchQuery}
                                        placeholder="Search Company or Individual..."
                                    />
                                    <button
                                        disabled={!parent}
                                        onClick={() => setStep(2)}
                                        className="w-full h-18 rounded-2xl brand-gradient-bg text-lg font-black text-white disabled:opacity-30 transition hover:scale-[1.02]"
                                    >
                                        PROCEED TO UPLOAD
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-8 text-center">
                                    <h2 className="text-3xl font-black">Capture PDF Data</h2>
                                    {parseError && (
                                        <div className="p-4 rounded-xl bg-rose-100 text-rose-700 text-sm font-bold border border-rose-200">{parseError}</div>
                                    )}
                                    <label className={`flex h-72 w-full cursor-pointer flex-col items-center justify-center rounded-[2rem] border-4 border-dashed transition-all
                                    ${isProcessing ? 'border-[var(--c-accent)] bg-[var(--c-accent-soft)]' : 'border-[var(--c-border)] bg-[var(--c-panel)] hover:border-[var(--c-accent)]'}`}>
                                        {isProcessing ? (
                                            <div className="animate-spin h-20 w-20 border-8 border-[var(--c-accent)] border-t-transparent rounded-full" />
                                        ) : (
                                            <div className="text-center">
                                                <Upload strokeWidth={1.5} size={48} className="mx-auto text-[var(--c-accent)] mb-4" />
                                                <p className="font-black text-xl">DROP PDF / TXT FILE</p>
                                            </div>
                                        )}
                                        <input type="file" className="hidden" accept="application/pdf,.txt,text/plain" onChange={handleFileUpload} />
                                    </label>
                                    <button onClick={() => setStep(1)} className="text-[10px] font-black uppercase tracking-widest text-[var(--c-muted)]">Change Sponsor</button>
                                </div>
                            )}
                        </div>
                    </main>
                )}

                {step === 3 && (
                    <div className="flex-1 flex overflow-hidden">
                        {/* PDF ENGINE VIEW (LEFT) */}
                        <div className="w-[55%] min-w-[40%] h-full bg-[#1e1e1e] border-r border-black">
                            <iframe src={fileUrl} className="h-full w-full" style={{ border: 'none' }} title="SOURCE" />
                        </div>

                        {/* LIVE GRID VERIFICATION (RIGHT) */}
                        <div className="flex-1 h-full flex flex-col bg-[var(--c-bg)]">
                            <div className="shrink-0 border-b border-[var(--c-border)] p-6 flex items-center justify-between bg-[var(--c-surface)]">
                                <div>
                                    <h3 className="text-2xl font-black tracking-tight">Live Entry Grid</h3>
                                    <p className="text-[10px] font-bold text-[var(--c-muted)] uppercase tracking-widest">{extractedEmployees.length} RECORDS CAUGHT</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <button onClick={() => setStep(2)} className="h-11 px-6 rounded-xl border border-[var(--c-border)] text-[10px] font-black uppercase">Refresh PDF</button>
                                    <button
                                        onClick={handleImportAll}
                                        disabled={isProcessing || extractedEmployees.length === 0}
                                        className="h-11 px-8 rounded-xl brand-gradient-bg text-[10px] font-black uppercase text-white shadow-lg active:scale-95 transition"
                                    >
                                        FINISH & IMPORT ALL
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {extractedEmployees.map((emp, idx) => {
                                    const isExpanded = expandedCards.has(idx);
                                    const isSuccess = emp.status === 'success';
                                    const ready = emp.reviewed && !emp.ignored;

                                    return (
                                        <div key={idx} className={`relative rounded-[1.5rem] border bg-[var(--c-surface)] transition-all shadow-sm
                                        ${emp.ignored ? 'opacity-40 border-amber-200' : isSuccess ? 'border-emerald-300 opacity-70' : ready ? 'border-[var(--c-accent)]' : 'border-[var(--c-border)] hover:border-[var(--c-accent)]'}
                                    `}>
                                            <div className="p-4 flex items-center gap-4">
                                                {/* Number Bubble */}
                                                <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-[var(--c-panel)] text-[12px] font-black border border-[var(--c-border)]">
                                                    {isSuccess ? <Check strokeWidth={1.5} size={18} className="text-emerald-500" /> : idx + 1}
                                                </div>

                                                {/* LIVE EDITABLE FIELDS GRID */}
                                                <div className="flex-1 grid grid-cols-12 gap-x-3 gap-y-2 items-center">
                                                    {/* 1. Name */}
                                                    <div className="col-span-12 lg:col-span-5">
                                                        <p className="text-[8px] font-black text-[var(--c-muted)] uppercase mb-1 px-1">LEGAL NAME</p>
                                                        <input
                                                            className="w-full bg-[var(--c-panel)] border border-transparent focus:border-[var(--c-accent)] focus:bg-white rounded-lg h-10 px-3 text-[13px] font-black uppercase outline-none transition"
                                                            value={emp.fullName}
                                                            onChange={(e) => updateEmployee(idx, { fullName: e.target.value })}
                                                            disabled={isSuccess}
                                                        />
                                                    </div>

                                                    {/* 2. Nationality */}
                                                    <div className="col-span-6 lg:col-span-2">
                                                        <p className="text-[8px] font-black text-[var(--c-muted)] uppercase mb-1 px-1">RESIDENCE</p>
                                                        <input
                                                            className="w-full bg-[var(--c-panel)] border border-transparent focus:border-[var(--c-accent)] focus:bg-white rounded-lg h-10 px-3 text-[11px] font-black uppercase outline-none transition text-[var(--c-accent)]"
                                                            value={emp.nationality}
                                                            onChange={(e) => updateEmployee(idx, { nationality: e.target.value })}
                                                            disabled={isSuccess}
                                                        />
                                                    </div>

                                                    {/* 3. Work Permit # */}
                                                    <div className="col-span-6 lg:col-span-2">
                                                        <p className="text-[8px] font-black text-[var(--c-muted)] uppercase mb-1 px-1">WP NUMBER</p>
                                                        <input
                                                            className="w-full bg-[var(--c-panel)] border border-transparent focus:border-[var(--c-accent)] focus:bg-white rounded-lg h-10 px-3 text-[11px] font-black outline-none transition text-rose-600"
                                                            value={emp.cardId}
                                                            onChange={(e) => updateEmployee(idx, { cardId: e.target.value })}
                                                            disabled={isSuccess}
                                                        />
                                                    </div>

                                                    {/* 4. Expiry */}
                                                    <div className="col-span-6 lg:col-span-2">
                                                        <p className="text-[8px] font-black text-[var(--c-muted)] uppercase mb-1 px-1">EXPIRY DATE</p>
                                                        <input
                                                            className="w-full bg-[var(--c-panel)] border border-transparent focus:border-[var(--c-accent)] focus:bg-white rounded-lg h-10 px-3 text-[11px] font-black outline-none transition text-rose-600"
                                                            value={emp.expiryDate}
                                                            onChange={(e) => updateEmployee(idx, { expiryDate: e.target.value })}
                                                            disabled={isSuccess}
                                                        />
                                                    </div>

                                                    {/* 5. Flags / More / Trash */}
                                                    <div className="col-span-6 lg:col-span-2 flex items-center justify-end gap-1">
                                                        <label className="flex items-center gap-1 text-[10px] font-bold text-[var(--c-muted)]">
                                                            <input
                                                                type="checkbox"
                                                                checked={emp.reviewed}
                                                                onChange={(e) => updateEmployee(idx, { reviewed: e.target.checked })}
                                                                disabled={isSuccess || emp.ignored}
                                                            />
                                                            Reviewed
                                                        </label>
                                                        <label className="flex items-center gap-1 text-[10px] font-bold text-amber-600">
                                                            <input
                                                                type="checkbox"
                                                                checked={emp.ignored}
                                                                onChange={(e) => updateEmployee(idx, { ignored: e.target.checked })}
                                                                disabled={isSuccess}
                                                            />
                                                            Ignore
                                                        </label>
                                                        <button onClick={() => toggleCard(idx)} className={`p-2 rounded-lg transition ${isExpanded ? 'bg-[var(--c-accent)] text-white' : 'text-[var(--c-muted)]'}`}>
                                                            <MoreHorizontal strokeWidth={1.5} size={18} />
                                                        </button>
                                                        {!isSuccess && (
                                                            <button onClick={() => removeEmployee(idx)} className="p-2 text-rose-300 hover:text-rose-600">
                                                                <Trash2 strokeWidth={1.5} size={18} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* SECONDARY INFO - (Expandable) */}
                                            {isExpanded && (
                                                <div className="border-t border-[var(--c-border)] p-6 bg-[var(--c-panel)]/30 rounded-b-[1.5rem] animate-in slide-in-from-top-2">
                                                    <div className="grid grid-cols-3 gap-6">
                                                        <div className="space-y-2">
                                                            <p className="text-[9px] font-black text-[var(--c-muted)] uppercase tracking-widest">PASSPORT ID</p>
                                                            <input
                                                                className="w-full bg-white border border-[var(--c-border)] rounded-lg h-10 px-4 text-xs font-black outline-none focus:border-[var(--c-accent)]"
                                                                value={emp.passportNumber}
                                                                onChange={(e) => updateEmployee(idx, { passportNumber: e.target.value })}
                                                                disabled={isSuccess}
                                                            />
                                                        </div>
                                                        <MobileContactsField
                                                            contacts={emp.mobileContacts}
                                                            onChange={(clist) => updateEmployee(idx, { mobileContacts: clist })}
                                                            compact
                                                            disabled={isSuccess}
                                                        />
                                                        <EmailContactsField
                                                            contacts={emp.emailContacts}
                                                            onChange={(clist) => updateEmployee(idx, { emailContacts: clist })}
                                                            compact
                                                            disabled={isSuccess}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* PROGRESS OVERLAY */}
            {isProcessing && (
                <div className="absolute inset-0 z-[3000] flex flex-col items-center justify-center bg-[var(--c-bg)]/95 backdrop-blur-3xl">
                    <div className="h-32 w-32 animate-spin rounded-full border-8 border-[var(--c-accent)] border-t-transparent shadow-2xl mb-10" />
                    <h3 className="text-3xl font-black uppercase">{importStatus.msg || 'Working…'}</h3>
                    {importStatus.total > 0 ? (
                        <div className="mt-12 h-1 w-[24rem] bg-[var(--c-panel)] rounded-full overflow-hidden">
                            <div
                                className="h-full brand-gradient-bg transition-all duration-300"
                                style={{ width: `${(importStatus.current / importStatus.total) * 100}%` }}
                            />
                        </div>
                    ) : (
                        <p className="mt-6 text-[11px] font-semibold text-[var(--c-muted)]">
                            Please keep this page open; this step may take up to 10–15 minutes for large files.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

export default BulkEmployeeImportModal;
