import { memo, useEffect, useRef, useState } from 'react';
import { Search, ChevronRight, Plus, Globe } from 'lucide-react';
import { fetchMergedServiceTemplates } from '../../lib/serviceTemplateStore';
import { useTenant } from '../../context/useTenant';
import { fetchApplicationIconLibrary } from '../../lib/applicationIconLibraryStore';
import { getTenantSettingDoc } from '../../lib/backendStore';
import DirhamIcon from '../common/DirhamIcon';
import InputActionField from '../common/InputActionField';
import { ENFORCE_UNIVERSAL_APPLICATION_UID } from '../../lib/universalLibraryPolicy';
import {
    getRememberDescriptionPreference,
    getRememberedServiceDescription,
    saveRememberedServiceDescription,
    setRememberDescriptionPreference,
} from '../../lib/serviceDescriptionMemoryStore';

const EMIRATES = [
    { name: 'Abu Dhabi', icon: '/emiratesIcon/abudhabi.png' },
    { name: 'Ajman', icon: '/emiratesIcon/ajman.png' },
    { name: 'Dubai', icon: '/emiratesIcon/dubai.png' },
    { name: 'Fujairah', icon: '/emiratesIcon/fujairah.png' },
    { name: 'Ras Al Khaimah', icon: '/emiratesIcon/rasAlKhaaimah.png' },
    { name: 'Sharjah', icon: '/emiratesIcon/sharjah.png' },
    { name: 'Umm Al Quwain', icon: '/emiratesIcon/ummAlQuwain.png' },
];

const formatChargeValue = (value) => {
    const num = Number(value || 0);
    if (!Number.isFinite(num)) return '0.00';
    return num.toFixed(2);
};

/**
 * Reusable Service/Template Search Component
 * Optimized for quick selection of application types.
 */
const ServiceSearchField = ({
    onSelect,
    selectedId,
    placeholder = 'Search Template...',
    onCreateNew,
    refreshKey = 0,
    openOnMount = false,
    variant = 'default',
    editableDescription = false,
    descriptionValue = '',
    onDescriptionChange = null,
    descriptionPlaceholder = 'Add description (optional)',
    descriptionMemoryLabel = 'Keep this description for next time',
}) => {
    const lockToUniversal = ENFORCE_UNIVERSAL_APPLICATION_UID;
    const { tenantId } = useTenant();
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [rows, setRows] = useState([]);
    const [iconUrlById, setIconUrlById] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [universalEnabled, setUniversalEnabled] = useState(false);
    const [rememberDescription, setRememberDescription] = useState(true);
    const wrapperRef = useRef(null);

    useEffect(() => {
        let isMounted = true;
        const load = async () => {
            if (!tenantId) return;
            setIsLoading(true);
            try {
                const [res, iconRes, settingsRes] = await Promise.all([
                    fetchMergedServiceTemplates(tenantId),
                    fetchApplicationIconLibrary(tenantId),
                    getTenantSettingDoc(tenantId, 'branding'),
                ]);
                const allowUniversalSetting = settingsRes.ok ? Boolean(settingsRes.data?.universalAppLibraryEnabled) : false;
                const allowUniversal = lockToUniversal ? true : allowUniversalSetting;
                if (isMounted) setUniversalEnabled(allowUniversal);
                if (isMounted && res.ok) {
                    const sourceRows = Array.isArray(res.rows) ? res.rows : [];
                    const visibleRows = lockToUniversal
                        ? sourceRows.filter((item) => (item?._isUniversal || item?.source === 'universal'))
                        : allowUniversal
                            ? sourceRows
                            : sourceRows.filter((item) => !(item?._isUniversal || item?.source === 'universal'));
                    setRows(visibleRows);
                }
                if (isMounted && iconRes.ok) {
                    const next = {};
                    (iconRes.rows || []).forEach((item) => {
                        if (item.iconId && item.iconUrl) next[item.iconId] = item.iconUrl;
                    });
                    setIconUrlById(next);
                }
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };
        load();
        return () => { isMounted = false; };
    }, [lockToUniversal, tenantId, refreshKey]);

    useEffect(() => {
        if (!openOnMount || selectedId) return;
        setIsOpen(true);
    }, [openOnMount, selectedId]);

    useEffect(() => {
        setRememberDescription(getRememberDescriptionPreference(tenantId));
    }, [tenantId]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filtered = query.trim() === ''
        ? rows.slice(0, 10)
        : rows.filter(item => {
            const q = query.toLowerCase();
            return (
                (item.name || '').toLowerCase().includes(q) ||
                (item.code || '').toLowerCase().includes(q) ||
                (item.group || '').toLowerCase().includes(q)
            );
        }).slice(0, 20);

    const getTemplateIcon = (item) => {
        if (!item) return <Search className="h-5 w-5" />;
        const resolvedIconId = String(item?.iconId || item?.globalIconId || '').trim();
        const iconUrl = iconUrlById[resolvedIconId] || String(item?.iconUrl || '').trim();
        if (iconUrl) return <img src={iconUrl} className="h-full w-full object-cover rounded-[inherit]" alt="" />;
        if (item?._isUniversal) return <Globe className="h-5 w-5 text-sky-500" />;

        // Match Emirates
        const name = item?.name || '';
        const foundEmirate = EMIRATES.find(e => name.toLowerCase().includes(e.name.toLowerCase()));
        if (foundEmirate) return <img src={foundEmirate.icon} className="h-6 w-6 object-contain" alt="" />;

        return <img src="/defaultIcons/documents.png" className="h-3/5 w-3/5 object-contain opacity-60 dark:invert" alt="Default Icon" />;
    };

    const selectedItem = rows.find(r => r.id === selectedId);
    const isCompact = variant === 'compact';
    const canCreateCustom = !lockToUniversal && typeof onCreateNew === 'function';
    const canEditDescription = editableDescription && Boolean(selectedItem) && typeof onDescriptionChange === 'function';
    const selectedDescription = canEditDescription ? descriptionValue : (selectedItem?.description || '');

    const handleSelect = (item) => {
        const baseDescription = String(item?.description || '').trim();
        const rememberedDescription = rememberDescription
            ? getRememberedServiceDescription(tenantId, item?.id)
            : '';
        const resolvedDescription = rememberedDescription || baseDescription;
        const nextItem = resolvedDescription && resolvedDescription !== baseDescription
            ? { ...item, description: resolvedDescription }
            : item;
        onSelect(nextItem);
        setIsOpen(false);
        setQuery('');
    };

    useEffect(() => {
        if (!canEditDescription || !tenantId || !rememberDescription) return;
        const serviceId = String(selectedItem?.id || '').trim();
        if (!serviceId) return;
        saveRememberedServiceDescription(tenantId, serviceId, descriptionValue);
    }, [canEditDescription, descriptionValue, rememberDescription, selectedItem?.id, tenantId]);

    return (
        <div ref={wrapperRef} className="relative w-full">
            <div
                onClick={() => setIsOpen(true)}
                className={`flex w-full cursor-pointer items-center h-14 gap-3 border bg-[var(--c-panel)] transition-all ${
                    isCompact ? 'rounded-2xl px-3' : 'rounded-2xl px-3'
                } ${isOpen ? 'border-[var(--c-accent)] ring-4 ring-[var(--c-accent)]/5' : 'border-[var(--c-border)]'
                    }`}
            >
                <div className={`flex flex-shrink-0 items-center justify-center bg-[var(--c-surface)] text-[var(--c-muted)] ${isCompact ? 'h-10 w-10 rounded-xl' : 'h-11 w-11 rounded-xl'}`}>
                    {getTemplateIcon(selectedItem)}
                </div>
                <div className="min-w-0 flex-1">
                    {selectedItem ? (
                        <>
                            <div className="flex items-center gap-1.5">
                                <p className={`truncate font-semibold text-[var(--c-text)] ${isCompact ? 'text-xs' : 'text-sm'}`}>
                                    {selectedItem.name}
                                </p>
                                {selectedItem._isUniversal ? (
                                    <Globe className="h-3.5 w-3.5 shrink-0 text-sky-500" title="Universal" />
                                ) : null}
                            </div>
                            {selectedDescription ? (
                                <p className={`truncate text-[var(--c-muted)] ${isCompact ? 'text-[9px]' : 'text-[10px]'}`}>{selectedDescription}</p>
                            ) : null}
                            <p className={`${isCompact ? 'text-[9px]' : 'text-[10px]'} font-bold uppercase text-[var(--c-muted)]`}>
                                {[selectedItem.code, selectedItem.group].filter(Boolean).join(' • ') || 'Application'}
                            </p>
                        </>
                    ) : (
                        <p className={`${isCompact ? 'text-xs' : 'text-sm'} font-bold text-[var(--c-muted)]`}>{placeholder}</p>
                    )}
                </div>
                {isOpen && (
                    <div className={`flex items-center justify-center bg-[var(--c-surface)] ${isCompact ? 'h-7 w-7 rounded-md' : 'h-8 w-8 rounded-lg'}`}>
                        <ChevronRight className="h-4 w-4 rotate-90 text-[var(--c-muted)]" />
                    </div>
                )}
            </div>
            {canEditDescription ? (
                <div className="mt-2 text-left">
                    <InputActionField
                        multiline
                        rows={2}
                        value={descriptionValue}
                        onValueChange={onDescriptionChange}
                        placeholder={descriptionPlaceholder}
                        className="w-full"
                        showPasteButton={false}
                    />
                    <label className="mt-2 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[var(--c-muted)] ml-1">
                        <input
                            type="checkbox"
                            checked={rememberDescription}
                            onChange={(event) => {
                                const checked = Boolean(event.target.checked);
                                setRememberDescription(checked);
                                setRememberDescriptionPreference(tenantId, checked);
                            }}
                            className="h-3.5 w-3.5 rounded border border-[var(--c-border)] accent-[var(--c-accent)]"
                        />
                        {descriptionMemoryLabel}
                    </label>
                </div>
            ) : null}

            {isOpen && (
                <div className="absolute left-0 right-0 top-full z-[100] mt-2 max-h-[400px] overflow-hidden rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="sticky top-0 border-b border-[var(--c-border)] bg-[var(--c-surface)] p-2">
                        <InputActionField
                            autoFocus
                            value={query}
                            onValueChange={setQuery}
                            placeholder="Search applications..."
                            className="w-full"
                            showPasteButton={false}
                            leadIcon={Search}
                        />
                    </div>

                    <div className="max-h-[300px] overflow-y-auto scrollbar-hide py-2">
                        {isLoading && rows.length === 0 ? (
                            <p className="p-8 text-center text-xs text-[var(--c-muted)] italic">Fetching templates...</p>
                        ) : filtered.length === 0 ? (
                            <div className="p-8 text-center space-y-3">
                                <p className="text-xs font-bold text-[var(--c-muted)]">No matching template found.</p>
                                {canCreateCustom ? (
                                    <button
                                        type="button"
                                        onClick={() => onCreateNew?.()}
                                        className="compact-action flex items-center gap-2 mx-auto rounded-xl bg-[var(--c-accent)] px-4 text-[10px] font-semibold text-white uppercase shadow-lg shadow-[var(--c-accent)]/20"
                                    >
                                        <Plus size={12} /> Create Custom
                                    </button>
                                ) : null}
                            </div>
                        ) : (
                            filtered.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => handleSelect(item)}
                                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[var(--c-accent)]/5 ${selectedId === item.id ? 'bg-[var(--c-accent)]/10' : ''
                                        }`}
                                >
                                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--c-panel)] text-[var(--c-muted)]">
                                        {getTemplateIcon(item)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            {item._isUniversal && universalEnabled ? <Globe className="h-3.5 w-3.5 shrink-0 text-sky-500" title="Universal" /> : null}
                                            <p className="truncate text-sm font-semibold text-[var(--c-text)]">
                                                {item.name}
                                            </p>
                                        </div>
                                        {item.description ? (
                                            <p className="truncate text-[10px] text-[var(--c-muted)]">{item.description}</p>
                                        ) : null}
                                        <p className="text-[10px] font-bold uppercase text-[var(--c-muted)]">
                                            {[item.code, item.group].filter(Boolean).join(' • ') || 'Application'}
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1.5 text-right">
                                        <DirhamIcon className="h-3.5 w-3.5" />
                                        <p className="text-xs font-semibold text-[var(--c-text)]">
                                            {formatChargeValue(item.clientCharge)}
                                        </p>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default memo(ServiceSearchField);
