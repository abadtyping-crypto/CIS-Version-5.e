import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Building2,
    Check,
    ImagePlus,
    Layers,
    Plus,
    Wallet,
    X,
    Zap,
} from 'lucide-react';
import PageShell from '../components/layout/PageShell';
import ImageStudio from '../components/common/ImageStudio';
import DirhamIcon from '../components/common/DirhamIcon';
import ConfirmDialog from '../components/common/ConfirmDialog';
import ProgressVideoOverlay from '../components/common/ProgressVideoOverlay';
import { useAuth } from '../context/useAuth';
import { useTenant } from '../context/useTenant';
import { getCachedSystemAssetsSnapshot, getSystemAssets } from '../lib/systemAssetsCache';
import { createSyncEvent } from '../lib/syncEvents';
import { generateNotificationId } from '../lib/notificationTemplate';
import { sendUniversalNotification } from '../lib/notificationDrafting';
import { getCroppedImg } from '../lib/imageStudioUtils';
import {
    fetchTenantPortals,
    upsertTenantPortal,
    upsertTenantPortalTransaction,
    generateDisplayPortalId,
} from '../lib/backendStore';
import { deletePortalIconByUrl, uploadPortalIcon } from '../lib/portalStorage';
import { fetchApplicationIconLibrary } from '../lib/applicationIconLibraryStore';
import { fetchAllGlobalPortalLogos } from '../lib/portalLogoLibraryStore';
import { canUserPerformAction } from '../lib/userControlPreferences';
import { generateDisplayTxId, toSafeDocId } from '../lib/txIdGenerator';
import { toSafeDocId as toSafeIconId } from '../lib/idUtils';
import {
    DEFAULT_PORTAL_CATEGORIES,
    buildMethodIconMap,
    createCustomCategoryDefinition,
    createCustomMethodDefinition,
    resolvePortalCategories,
    resolvePortalCategory,
    resolveCategoryMethodIds,
    resolvePortalMethodDefinitions,
    resolveMethodIconUrl,
    resolvePortalTypeIcon,
    DEFAULT_PORTAL_ICON,
    sanitizePortalEntityName,
} from '../lib/transactionMethodConfig';

/* ─── Constants ──────────────────────────────────────────────── */
const ICON_OUTPUT_SIZE = 256;
const ICON_MAX_BYTES = 100 * 1024;

// Map method IDs to their real local asset (if available)
const METHOD_ASSET_MAP = {
    cashByHand: ['icon_method_cash'],
    bankTransfer: ['icon_method_bank_transfer'],
    cdmDeposit: ['icon_method_cdm_deposit', 'icon_method_bank_transfer'],
    checqueDeposit: ['icon_method_cheque'],
    onlinePayment: ['icon_method_online'],
    cashWithdrawals: ['icon_method_cash_withdrawals', 'icon_method_cash'],
    tabby: ['icon_method_tabby'],
    tamara: ['icon_method_tamara'],
};

const CATEGORY_ASSET_MAP = {
    Bank: 'icon_portal_bank',
    'Card Payment': 'icon_portal_card',
    'Petty Cash': 'icon_portal_cash',
    Portals: 'icon_portal_portals',
    Terminal: 'icon_portal_terminal',
};

/* ─── Helpers ────────────────────────────────────────────────── */
const fallbackTypeIcon = (type) => {
    return resolvePortalTypeIcon(type);
};

const resolveMethodAsset = (methodId, firestoreIconMap, systemAssets) => {
    // 1. Check cloud system assets (Global Master Icons)
    const systemKeys = METHOD_ASSET_MAP[methodId] || [];
    for (const key of systemKeys) {
        if (key && systemAssets[key]?.iconUrl) return systemAssets[key].iconUrl;
    }

    // 2. Check local application icon library (legacy fallback)
    const fromFirestore = resolveMethodIconUrl(firestoreIconMap, methodId);
    if (fromFirestore) return fromFirestore;

    return null;
};

/* ─── Sub-components ─────────────────────────────────────────── */

const resolveCategoryIcon = (category, systemAssets) => {
    const cloudKey = CATEGORY_ASSET_MAP[category.label] || CATEGORY_ASSET_MAP[category.id];
    return systemAssets[cloudKey]?.iconUrl || category.icon || fallbackTypeIcon(category.id);
};

/** Single portal-category tile */
const CategoryTile = ({ category, isActive, onClick, systemAssets }) => {
    const icon = resolveCategoryIcon(category, systemAssets);
    return (
        <button
            type="button"
            onClick={onClick}
            className={`relative flex flex-col items-center gap-2 rounded-2xl border p-3 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--c-accent)] ${
                isActive
                    ? 'border-[var(--c-accent)] bg-[color:color-mix(in_srgb,var(--c-accent)_10%,var(--c-surface))] shadow-md'
                    : 'border-[var(--c-border)] bg-[var(--c-panel)] hover:border-[var(--c-accent)]/40 hover:bg-[var(--c-surface)]'
            }`}
        >
            {isActive && (
                <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--c-accent)] text-white">
                    <Check className="h-2.5 w-2.5" strokeWidth={3} />
                </span>
            )}
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--c-border)] bg-white">
                <img
                    src={icon}
                    alt={category.label}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = DEFAULT_PORTAL_ICON;
                    }}
                />
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-[var(--c-accent)]' : 'text-[var(--c-muted)]'}`}>
                {category.label}
            </span>
        </button>
    );
};

/** Single transaction method pill / toggle */
const MethodPill = ({ method, isSelected, isCustom, onToggle, onRemove, firestoreIconMap, systemAssets }) => {
    const asset = resolveMethodAsset(method.id, firestoreIconMap, systemAssets);
    const MethodIcon = method.Icon;

    return (
        <div
            className={`group flex items-center gap-2.5 rounded-xl border px-3 py-2 transition-all duration-150 ${
                isSelected
                    ? 'border-[var(--c-accent)] bg-[color:color-mix(in_srgb,var(--c-accent)_8%,var(--c-surface))]'
                    : 'border-[var(--c-border)] bg-[var(--c-panel)]'
            }`}
        >
            {/* Icon */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--c-border)] bg-white">
            {asset ? (
                <img
                    src={asset}
                    alt={method.label}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = DEFAULT_PORTAL_ICON;
                    }}
                />
            ) : MethodIcon ? (
                <MethodIcon className="h-4 w-4 text-[var(--c-muted)]" />
            ) : (
                <Zap className="h-4 w-4 text-[var(--c-muted)]" />
            )}
        </div>

            {/* Label */}
            <span className={`flex-1 text-xs font-semibold ${isSelected ? 'text-[var(--c-text)]' : 'text-[var(--c-muted)]'}`}>
                {method.label}
                {isCustom && (
                    <span className="ml-1.5 rounded-full bg-[var(--c-accent)]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-[var(--c-accent)]">
                        custom
                    </span>
                )}
            </span>

            {/* Toggle checkbox */}
            <button
                type="button"
                onClick={onToggle}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                    isSelected
                        ? 'border-[var(--c-accent)] bg-[var(--c-accent)] text-white'
                        : 'border-[var(--c-border)] bg-transparent text-transparent hover:border-[var(--c-accent)]/50'
                }`}
                aria-label={isSelected ? `Disable ${method.label}` : `Enable ${method.label}`}
            >
                <Check className="h-3 w-3" strokeWidth={3} />
            </button>

            {/* Remove for custom only */}
            {isCustom && onRemove && (
                <button
                    type="button"
                    onClick={onRemove}
                    className="ml-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[var(--c-muted)] opacity-0 transition hover:text-rose-400 group-hover:opacity-100"
                    aria-label={`Remove ${method.label}`}
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            )}
        </div>
    );
};

/** Status banner */
const StatusBanner = ({ message, type }) => {
    if (!message) return null;
    const styles = {
        error: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
        success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
        info: 'border-[var(--c-border)] bg-[var(--c-panel)] text-[var(--c-muted)]',
    };
    return (
        <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${styles[type] || styles.info}`}>
            {message}
        </div>
    );
};

/* ─── Main Page ───────────────────────────────────────────────── */
const PortalFormPage = ({ embedded = false }) => {
    const { portalId } = useParams();
    const navigate = useNavigate();
    const { tenantId } = useTenant();
    const { user } = useAuth();
    const isEdit = !!portalId;

    // Loading / saving
    const [isLoading, setIsLoading] = useState(isEdit);
    const [isSaving, setIsSaving] = useState(false);
    const [status, setStatus] = useState({ message: '', type: 'info' });
    const [confirmDialog, setConfirmDialog] = useState({ open: false });

    // Existing portal data (edit mode)
    const [existingPortal, setExistingPortal] = useState(null);

    // Form fields
    const [form, setForm] = useState({
        name: '',
        balance: '',
        balanceType: 'positive',
        type: DEFAULT_PORTAL_CATEGORIES[0].id,
        methods: resolveCategoryMethodIds(DEFAULT_PORTAL_CATEGORIES[0].id, []),
        customCategories: [],
        customMethods: [],
        portalLogoId: '',
    });

    // Logo (uploaded image) — goes through ImageStudio
    const [logoRawUrl, setLogoRawUrl] = useState('');       // blob URL for crop
    const [logoCroppedArea, setLogoCroppedArea] = useState(null);
    const [logoZoom, setLogoZoom] = useState(1);
    const [logoRotation, setLogoRotation] = useState(0);
    const [isLogoStudioOpen, setIsLogoStudioOpen] = useState(false);
    const [logoPreviewUrl, setLogoPreviewUrl] = useState(''); // existing saved logo
    const logoFileRef = useRef(null);

    const [firestoreIconMap, setFirestoreIconMap] = useState({});
    const [logoRemoved, setLogoRemoved] = useState(false);
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);
    const [draftPortalId, setDraftPortalId] = useState(portalId || '');
    const [systemAssets, setSystemAssets] = useState(() => getCachedSystemAssetsSnapshot());
    const [globalPortalLogos, setGlobalPortalLogos] = useState([]);
    const [isPortalLogoLoading, setIsPortalLogoLoading] = useState(false);

    useEffect(() => {
        getSystemAssets().then(setSystemAssets).catch(() => {});
    }, []);

    // Add custom category
    const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');

    // Add custom method
    const [isAddMethodOpen, setIsAddMethodOpen] = useState(false);
    const [newMethodName, setNewMethodName] = useState('');
    const openConfirm = (options) => setConfirmDialog({ open: true, isDangerous: false, ...options });
    const closeConfirm = () => setConfirmDialog((prev) => ({ ...prev, open: false }));

    /* ── Load existing portal (edit mode) ─────── */
    useEffect(() => {
        if (!tenantId || !portalId) return;
        fetchTenantPortals(tenantId).then((res) => {
            if (res.ok) {
                const p = res.rows.find((item) => item.id === portalId);
                if (p) {
                    setExistingPortal(p);
                    setForm({
                        name: p.name || '',
                        balance: Number(p.balance || 0),
                        balanceType: p.balanceType || 'positive',
                        type: p.type || DEFAULT_PORTAL_CATEGORIES[0].id,
                        methods: Array.isArray(p.methods) ? p.methods : [],
                        customCategories: Array.isArray(p.customCategories) ? p.customCategories : [],
                        customMethods: Array.isArray(p.customMethods) ? p.customMethods : [],
                        portalLogoId: String(p.portalLogoId || ''),
                    });
                    setLogoPreviewUrl(p.logoUrl || '');
                    setLogoRemoved(false);
                    setDraftPortalId(p.id || portalId || '');
                }
            }
            setIsLoading(false);
        });
    }, [tenantId, portalId]);

    /* ── Load icon library ─────────────────────── */
    const loadIconLibrary = useCallback(async () => {
        if (!tenantId) return;
        const res = await fetchApplicationIconLibrary(tenantId);
        if (res.ok) {
            const rows = res.rows || [];
            setFirestoreIconMap(buildMethodIconMap(rows));
        }
    }, [tenantId]);

    useEffect(() => {
        loadIconLibrary();
    }, [loadIconLibrary]);

    const loadGlobalPortalLogos = useCallback(async () => {
        if (!tenantId) return;
        setIsPortalLogoLoading(true);
        const res = await fetchAllGlobalPortalLogos();
        if (res.ok) {
            setGlobalPortalLogos(res.rows || []);
        } else {
            setGlobalPortalLogos([]);
        }
        setIsPortalLogoLoading(false);
    }, [tenantId]);

    useEffect(() => {
        loadGlobalPortalLogos();
    }, [loadGlobalPortalLogos]);

    /* ── Derived values ────────────────────────── */
    const allCategories = resolvePortalCategories(form.customCategories);
    const activeCategory = resolvePortalCategory(form.type, form.customCategories);
    const allMethodDefs = resolvePortalMethodDefinitions(form.customMethods);
    // Which methods are relevant to this category?
    const categoryDefaultMethodIds = resolveCategoryMethodIds(form.type, form.customCategories);
    const visibleMethodDefs = allMethodDefs.filter((m) => {
        if (m.isCustom) return true; // always show custom
        return categoryDefaultMethodIds.includes(m.id);
    });

    const cloudCategoryIcon = CATEGORY_ASSET_MAP[activeCategory?.label] || CATEGORY_ASSET_MAP[form.type];
    const categoryIcon = systemAssets[cloudCategoryIcon]?.iconUrl || activeCategory?.icon || fallbackTypeIcon(form.type);
    const selectedPortalLogo = globalPortalLogos.find((item) => item.logoId === form.portalLogoId) || null;
    const selectedPortalLogoUrl = String(selectedPortalLogo?.logoUrl || '').trim();
    const portalIconPreview = logoPreviewUrl || selectedPortalLogoUrl || categoryIcon || existingPortal?.iconUrl;
    const previewSourceLabel = logoPreviewUrl
        ? 'Custom uploaded logo'
        : selectedPortalLogoUrl
            ? 'Universal portal logo'
            : 'Category default icon';

    /* ── Category change ───────────────────────── */
    const handleCategoryChange = (newType) => {
        const defaults = resolveCategoryMethodIds(newType, form.customCategories);
        setForm((prev) => ({
            ...prev,
            type: newType,
            // carry over custom method ids, reset default methods to this category's defaults
            methods: [
                ...defaults,
                ...prev.customMethods.map((m) => m.id),
            ],
        }));
    };

    const handleAddCustomCategory = () => {
        const label = sanitizePortalEntityName(newCategoryName, '');
        if (!label) {
            setStatus({ message: 'Category name is required.', type: 'error' });
            return;
        }

        const categoryId = toSafeIconId(label, 'portal_category');
        const alreadyExists = resolvePortalCategories(form.customCategories).some((category) => category.id === categoryId);
        if (alreadyExists) {
            setStatus({ message: 'A category with this name already exists.', type: 'error' });
            return;
        }

        const defaultMethodIds = Array.isArray(categoryDefaultMethodIds) && categoryDefaultMethodIds.length > 0
            ? categoryDefaultMethodIds
            : resolveCategoryMethodIds('Portals', []);

        const newCategory = createCustomCategoryDefinition({
            id: categoryId,
            label,
            iconUrl: DEFAULT_PORTAL_ICON,
            methodIds: defaultMethodIds,
        });

        setForm((prev) => ({
            ...prev,
            type: newCategory.id,
            methods: [
                ...defaultMethodIds,
                ...prev.customMethods.map((method) => method.id),
            ],
            customCategories: [...prev.customCategories, newCategory],
        }));
        setNewCategoryName('');
        setIsAddCategoryOpen(false);
        setStatus({ message: '', type: 'info' });
    };

    const handleRemoveCustomCategory = (categoryId) => {
        const fallbackCategoryId = DEFAULT_PORTAL_CATEGORIES[0].id;
        const fallbackMethodIds = resolveCategoryMethodIds(fallbackCategoryId, []);

        setForm((prev) => {
            const remainingCategories = prev.customCategories.filter((category) => category.id !== categoryId);
            const isRemovingActive = prev.type === categoryId;

            return {
                ...prev,
                type: isRemovingActive ? fallbackCategoryId : prev.type,
                methods: isRemovingActive
                    ? [...fallbackMethodIds, ...prev.customMethods.map((method) => method.id)]
                    : prev.methods,
                customCategories: remainingCategories,
            };
        });
    };

    /* ── Toggle method on/off ──────────────────── */
    const handleToggleMethod = (methodId) => {
        setForm((prev) => ({
            ...prev,
            methods: prev.methods.includes(methodId)
                ? prev.methods.filter((id) => id !== methodId)
                : [...prev.methods, methodId],
        }));
    };

    /* ── Add custom method ─────────────────────── */
    const handleAddCustomMethod = () => {
        const label = sanitizePortalEntityName(newMethodName, '');
        if (!label) {
            setStatus({ message: 'Method name is required.', type: 'error' });
            return;
        }
        const methodId = toSafeIconId(label, 'portal_method');
        const alreadyExists = resolvePortalMethodDefinitions(form.customMethods).some((m) => m.id === methodId);
        if (alreadyExists) {
            setStatus({ message: 'A method with this name already exists.', type: 'error' });
            return;
        }
        const newMethod = createCustomMethodDefinition({ id: methodId, label, iconUrl: '' });
        setForm((prev) => ({
            ...prev,
            customMethods: [...prev.customMethods, newMethod],
            methods: [...prev.methods, methodId],
        }));
        setNewMethodName('');
        setIsAddMethodOpen(false);
        setStatus({ message: '', type: 'info' });
    };

    /* ── Remove custom method ──────────────────── */
    const handleRemoveCustomMethod = (methodId) => {
        setForm((prev) => ({
            ...prev,
            customMethods: prev.customMethods.filter((m) => m.id !== methodId),
            methods: prev.methods.filter((id) => id !== methodId),
        }));
    };

    /* ── Logo upload ───────────────────────────── */
    const handleLogoFileSelect = (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        // If user uploads a custom logo, switch away from universal logo mode.
        setForm((prev) => ({ ...prev, portalLogoId: '' }));
        const url = URL.createObjectURL(file);
        setLogoRawUrl(url);
        setLogoCroppedArea(null);
        setLogoZoom(1);
        setLogoRotation(0);
        setIsLogoStudioOpen(true);
    };

    const handleOpenLogoStudio = () => {
        if (logoPreviewUrl) {
            setLogoRawUrl(logoPreviewUrl);
            setLogoCroppedArea(null);
            setLogoZoom(1);
            setLogoRotation(0);
            setIsLogoStudioOpen(true);
            return;
        }
        logoFileRef.current?.click();
    };

    const handleLogoClear = () => {
        setLogoRawUrl('');
        setLogoCroppedArea(null);
        setLogoPreviewUrl('');
        setLogoRemoved(true);
        setIsLogoStudioOpen(false);
    };

    const handleCancelLogoStudio = () => {
        setLogoRawUrl('');
        setLogoCroppedArea(null);
        setLogoZoom(1);
        setLogoRotation(0);
        setIsLogoStudioOpen(false);
    };

    const handleSelectUniversalLogo = (logoId) => {
        const normalizedId = String(logoId || '');
        setForm((prev) => ({
            ...prev,
            portalLogoId: prev.portalLogoId === normalizedId ? '' : normalizedId,
        }));
        if (normalizedId) {
            setLogoRawUrl('');
            setLogoCroppedArea(null);
            setLogoZoom(1);
            setLogoRotation(0);
            setIsLogoStudioOpen(false);
            setLogoPreviewUrl('');
            setLogoRemoved(true);
        }
    };

    const handleApplyLogo = async () => {
        if (!tenantId || !logoRawUrl || !logoCroppedArea) {
            setStatus({ message: 'Select and crop the logo before saving it.', type: 'error' });
            return;
        }

        setIsUploadingLogo(true);
        setStatus({ message: '', type: 'info' });

        try {
            const targetPortalId = draftPortalId || portalId || await generateDisplayPortalId(tenantId);
            if (!draftPortalId) setDraftPortalId(targetPortalId);

            const blob = await getCroppedImg(
                logoRawUrl,
                logoCroppedArea,
                logoRotation,
                'natural',
                ICON_OUTPUT_SIZE,
                ICON_MAX_BYTES,
            );

            const uploadRes = await uploadPortalIcon({
                tenantId,
                portalId: targetPortalId,
                fileBlob: blob,
                oldIconUrl: logoRemoved ? '' : (logoPreviewUrl || existingPortal?.logoUrl || ''),
            });

            if (!uploadRes.ok) {
                throw new Error(uploadRes.error || 'Logo upload failed.');
            }

            setLogoPreviewUrl(uploadRes.iconUrl);
            setForm((prev) => ({ ...prev, portalLogoId: '' }));
            setLogoRawUrl('');
            setLogoCroppedArea(null);
            setLogoZoom(1);
            setLogoRotation(0);
            setLogoRemoved(false);
            setIsLogoStudioOpen(false);
            setStatus({ message: 'Logo cropped and saved.', type: 'success' });
        } catch (error) {
            setStatus({ message: error?.message || 'Logo upload failed.', type: 'error' });
        } finally {
            setIsUploadingLogo(false);
        }
    };

    /* ── Save ──────────────────────────────────── */
    const performSave = async () => {
        const name = form.name.trim();
        if (!name) {
            setStatus({ message: 'Portal name is required.', type: 'error' });
            return;
        }

        if (!isEdit && !canUserPerformAction(tenantId, user, 'createPortal')) {
            setStatus({ message: "You don't have permission to create portals.", type: 'error' });
            return;
        }

        setIsSaving(true);
        setStatus({ message: '', type: 'info' });

        const targetPortalId = portalId || draftPortalId || (await generateDisplayPortalId(tenantId));
        if (!draftPortalId) {
            setDraftPortalId(targetPortalId);
        }

        if (logoRawUrl && logoCroppedArea && !logoPreviewUrl) {
            setStatus({ message: 'Use Crop & Save for the logo before creating the portal.', type: 'error' });
            setIsSaving(false);
            return;
        }

        const logoUrl = logoRemoved ? '' : (logoPreviewUrl || existingPortal?.logoUrl || '');
        const hasCustomLogo = Boolean(String(logoUrl || '').trim());
        const portalLogoId = hasCustomLogo ? '' : String(form.portalLogoId || '').trim();
        const iconUrl = hasCustomLogo ? logoUrl : (activeCategory?.icon || fallbackTypeIcon(form.type));
        const openingAmount = isEdit ? 0 : Number(form.balance) || 0;
        const openingSignedBalance = openingAmount * (form.balanceType === 'negative' ? -1 : 1);

        // Filter arrays for empty placeholders and ensure only populated objects are persisted
        const nextMethods = (form.methods || []).filter(m => m);
        const nextCustomCategories = (form.customCategories || []).filter(c => {
            if (c && typeof c === 'object' && Object.keys(c).length === 0) return false;
            return !!c;
        });
        const nextCustomMethods = (form.customMethods || []).filter(m => {
            if (m && typeof m === 'object' && Object.keys(m).length === 0) return false;
            return !!m;
        });

        const payload = {
            name,
            type: form.type,
            methods: nextMethods,
            customCategories: nextCustomCategories,
            customMethods: nextCustomMethods,
            iconUrl,
            logoUrl: hasCustomLogo ? logoUrl : '',
            portalLogoId,
            status: existingPortal?.status || 'active',
            // Ensure createdBy only stores the uid string
            createdBy: String(existingPortal?.createdBy || user.uid || '').trim(),
            ...(isEdit
                ? { updatedBy: user.uid } // Only include updatedBy on edit operations
                : { balance: openingSignedBalance, balanceType: form.balanceType }),
        };

        const res = await upsertTenantPortal(tenantId, targetPortalId, payload);
        if (!res.ok) {
            setStatus({ message: res.error || 'Failed to save portal.', type: 'error' });
            setIsSaving(false);
            return;
        }

        if (logoRemoved && existingPortal?.logoUrl && !logoPreviewUrl) {
            await deletePortalIconByUrl(existingPortal.logoUrl);
        }

        // Opening balance transaction
        if (!isEdit && openingAmount > 0) {
            const displayTxId = await generateDisplayTxId(tenantId, 'POR');
            await upsertTenantPortalTransaction(
                tenantId,
                toSafeDocId(displayTxId, 'portal_tx'),
                {
                    portalId: targetPortalId,
                    displayTransactionId: displayTxId,
                    amount: openingSignedBalance,
                    type: 'Opening Balance',
                    date: new Date().toISOString(),
                    createdBy: user.uid,
                },
            );
        }

        // Notification (create only)
        if (!isEdit) {
            const routePath = `/t/${tenantId}/portal-management/${targetPortalId}`;
            await sendUniversalNotification({
                tenantId,
                notificationId: generateNotificationId({ topic: 'finance', subTopic: 'portal' }),
                topic: 'finance',
                subTopic: 'portal',
                type: 'create',
                title: 'Portal Created',
                message: `${name} was created successfully.`,
                createdBy: user.uid,
                routePath,
                actionPresets: ['view'],
                eventType: 'create',
                entityType: 'portal',
                entityId: targetPortalId,
                entityLabel: name,
                pageKey: 'portalManagement',
                sectionKey: 'portalSetup',
                quickView: {
                    badge: 'Portal',
                    title: name,
                    subtitle: activeCategory?.label || form.type,
                    imageUrl: iconUrl,
                    description: 'Portal created and ready for operational use.',
                    fields: [
                        { label: 'Portal ID', value: targetPortalId },
                        { label: 'Category', value: activeCategory?.label || form.type },
                        { label: 'Opening Balance', value: String(openingSignedBalance) },
                    ],
                },
            });
        }

        // Sync event
        await createSyncEvent({
            tenantId,
            eventType: isEdit ? 'update' : 'create',
            entityType: 'portal',
            entityId: targetPortalId,
            changedFields: Object.keys(payload),
            createdBy: user.uid,
        });

        setStatus({ message: isEdit ? 'Portal updated.' : 'Portal created successfully!', type: 'success' });
        setTimeout(() => navigate(`/t/${tenantId}/portal-management`), 1200);
    };

    const handleSave = () => {
        const name = form.name.trim();
        if (!name) {
            setStatus({ message: 'Portal name is required.', type: 'error' });
            return;
        }
        if (!isEdit && !canUserPerformAction(tenantId, user, 'createPortal')) {
            setStatus({ message: "You don't have permission to create portals.", type: 'error' });
            return;
        }
        openConfirm({
            title: isEdit ? 'Update Portal?' : 'Create Portal?',
            message: isEdit
                ? `Confirm updating "${name}" with current settings.`
                : `Confirm creating "${name}" as a new portal.`,
            confirmText: isEdit ? 'Update' : 'Create',
            onConfirm: async () => {
                closeConfirm();
                await performSave();
            },
        });
    };

    /* ── Guard ─────────────────────────────────── */
    if (!user || isLoading) return null;

    /* ── Render ────────────────────────────────── */
    const content = (
        <>
            <div className="grid w-full gap-5 pb-20 xl:grid-cols-12">

                {/* ── Section 1 · Basic Info ─────────────────────── */}
                <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-5 shadow-sm xl:col-span-7 2xl:col-span-7">
                    <SectionHeading icon={Building2} label="Portal Information" />
                    <div className="mt-4 grid gap-4">
                        {/* Name */}
                        <div className="xl:max-w-[38rem] 2xl:max-w-[42rem]">
                            <FieldLabel>Portal Name</FieldLabel>
                            <input
                                id="portal-name"
                                type="text"
                                value={form.name}
                                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                                placeholder="e.g. Main Operating Bank"
                                className="mt-1.5 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-4 py-2.5 text-sm font-medium text-[var(--c-text)] outline-none transition focus:border-[var(--c-accent)] focus:ring-2 focus:ring-[var(--c-accent)]/20"
                            />
                        </div>

                        {/* Opening Balance — create only */}
                        {!isEdit && (
                            <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,28rem)] lg:items-start">
                                <div className="max-w-[18rem]">
                                    <FieldLabel>Opening Balance <span className="normal-case font-normal text-[var(--c-muted)]">(optional)</span></FieldLabel>
                                    <div className="relative mt-1.5">
                                        <DirhamIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--c-muted)]" />
                                        <input
                                            id="portal-opening-balance"
                                            type="number"
                                            min="0"
                                            value={form.balance}
                                            onChange={(e) => setForm((p) => ({ ...p, balance: e.target.value }))}
                                            placeholder="0"
                                            className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] pl-9 pr-4 py-2.5 text-sm font-medium text-[var(--c-text)] outline-none transition focus:border-[var(--c-accent)] focus:ring-2 focus:ring-[var(--c-accent)]/20"
                                        />
                                    </div>
                                </div>
                                {Number(form.balance) > 0 && (
                                    <div className="max-w-[28rem]">
                                        <FieldLabel>Balance Direction</FieldLabel>
                                        <div className="mt-1.5 space-y-2">
                                            <button
                                                id="portal-balance-type"
                                                type="button"
                                                role="switch"
                                                aria-checked={form.balanceType === 'negative'}
                                                onClick={() =>
                                                    setForm((p) => ({
                                                        ...p,
                                                        balanceType: p.balanceType === 'negative' ? 'positive' : 'negative',
                                                    }))
                                                }
                                                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
                                                    form.balanceType === 'negative'
                                                        ? 'border-rose-400/45 bg-rose-500/10 text-rose-500'
                                                        : 'border-emerald-400/45 bg-emerald-500/10 text-emerald-600'
                                                }`}
                                            >
                                                <span>{form.balanceType === 'negative' ? 'Negative Balance' : 'Positive Balance'}</span>
                                                <span
                                                    className={`relative flex h-7 w-13 items-center rounded-full px-1 transition ${
                                                        form.balanceType === 'negative'
                                                            ? 'bg-rose-500/25 justify-end'
                                                            : 'bg-emerald-500/25 justify-start'
                                                    }`}
                                                >
                                                    <span className="h-5 w-5 rounded-full bg-white shadow-sm" />
                                                </span>
                                            </button>
                                            <div className="flex items-center justify-between rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2 text-xs font-semibold">
                                                <span className="text-[var(--c-muted)]">Signed preview</span>
                                                <span className={form.balanceType === 'negative' ? 'text-rose-500' : 'text-emerald-600'}>
                                                    {form.balanceType === 'negative' ? '-' : ''}
                                                    {Number(form.balance || 0).toLocaleString(undefined, {
                                                        minimumFractionDigits: 2,
                                                        maximumFractionDigits: 2,
                                                    })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Current balance display — edit mode */}
                        {isEdit && (
                            <div className="max-w-[24rem]">
                                <FieldLabel>Current Balance</FieldLabel>
                                <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-4 py-2.5">
                                    <DirhamIcon className="h-4 w-4 text-[var(--c-muted)]" />
                                    <span className={`text-sm font-bold ${Number(existingPortal?.balance || 0) < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                        {Number(existingPortal?.balance || 0).toLocaleString()}
                                    </span>
                                    <span className="ml-auto text-xs text-[var(--c-muted)]">Dhs · read-only</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Section 2 · Logo ───────────────────────────── */}
                <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-5 shadow-sm xl:col-span-5 2xl:col-span-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                        <div className="flex-1">
                            <SectionHeading icon={ImagePlus} label="Portal Logo" />
                            <p className="mt-1 text-xs text-[var(--c-muted)]">
                                Optional. Upload a custom logo image for this portal (displayed in portal detail).
                            </p>
                            <div className="mt-4">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--c-muted)]">Universal Portal Logos</p>
                                <p className="mt-1 text-[11px] text-[var(--c-muted)]">Select one from developer library. It will sync by UID.</p>
                                <div className="mt-2 rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] p-3">
                                    {isPortalLogoLoading ? (
                                        <p className="py-3 text-center text-xs font-semibold text-[var(--c-muted)]">Loading portal logos...</p>
                                    ) : globalPortalLogos.length === 0 ? (
                                        <p className="py-3 text-center text-xs font-semibold text-[var(--c-muted)]">No universal portal logos available.</p>
                                    ) : (
                                        <div className="grid max-h-64 grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4">
                                            {globalPortalLogos.map((item) => {
                                                const isSelected = String(form.portalLogoId || '') === String(item.logoId || '');
                                                return (
                                                    <button
                                                        key={item.logoId}
                                                        type="button"
                                                        onClick={() => handleSelectUniversalLogo(item.logoId)}
                                                        className={`rounded-xl border p-2 transition ${isSelected ? 'border-[var(--c-accent)] bg-[color:color-mix(in_srgb,var(--c-accent)_10%,transparent)] shadow-sm' : 'border-[var(--c-border)] bg-[var(--c-surface)] hover:border-[var(--c-accent)]/40'}`}
                                                        title={item.logoName || item.logoId}
                                                    >
                                                        <div className="flex h-16 w-full items-center justify-center overflow-hidden rounded-lg border border-[var(--c-border)] bg-white p-1">
                                                            <img src={item.logoUrl} alt={item.logoName || item.logoId} className="h-full w-full object-contain" />
                                                        </div>
                                                        <p className="mt-2 truncate text-[11px] font-semibold text-[var(--c-muted)]">
                                                            {item.logoName || item.logoId}
                                                        </p>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="mt-4 flex flex-wrap items-center gap-3">
                                <input
                                    ref={logoFileRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    onChange={handleLogoFileSelect}
                                    className="hidden"
                                    id="logo-upload-input"
                                />
                                <button
                                    type="button"
                                    onClick={handleOpenLogoStudio}
                                    className="flex items-center gap-2 rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-4 py-2.5 text-xs font-bold text-[var(--c-text)] transition hover:border-[var(--c-accent)] hover:text-[var(--c-accent)]"
                                >
                                    <ImagePlus className="h-4 w-4" />
                                    {logoPreviewUrl ? 'Adjust Logo' : 'Upload Logo'}
                                </button>
                                {logoPreviewUrl && (
                                    <button
                                        type="button"
                                        onClick={handleLogoClear}
                                        className="flex items-center gap-1.5 rounded-xl border border-rose-500/30 px-3 py-2.5 text-xs font-bold text-rose-400 transition hover:bg-rose-500/10"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                        Remove
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Logo preview + Portal icon side by side */}
                        <div className="flex shrink-0 flex-col items-center gap-2 self-start rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] p-3">
                            {logoPreviewUrl ? (
                                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-[var(--c-border)] bg-white p-1.5 shadow-sm">
                                    <img
                                        src={logoPreviewUrl}
                                        alt="Logo preview"
                                        className="h-full w-full rounded-xl object-contain"
                                    />
                                </div>
                            ) : (
                                <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-dashed border-[var(--c-border)] bg-[var(--c-surface)]">
                                    <ImagePlus className="h-8 w-8 text-[var(--c-muted)]/50" />
                                </div>
                            )}
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--c-muted)]">Logo Preview</span>
                        </div>
                    </div>

                    {logoPreviewUrl ? (
                        <p className="mt-2 text-[11px] font-medium text-[var(--c-muted)]">
                            This logo is saved separately for this portal and will appear automatically on portal cards.
                        </p>
                    ) : null}

                    {/* ── Portal Display Icon (auto) ─── */}
                    <div className="mt-5 border-t border-[var(--c-border)] pt-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">Portal Display Icon</p>
                                <p className="mt-0.5 text-[11px] text-[var(--c-muted)]">
                                    If you upload a custom logo, it is used first. Otherwise selected universal logo, then category icon.
                                </p>
                            </div>
                            <div className="flex items-center gap-3 rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-3">
                                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-[var(--c-border)] bg-white p-1.5 shadow-sm">
                                    <img
                                        src={portalIconPreview}
                                        alt="Portal icon"
                                        className="h-full w-full rounded-xl object-contain"
                                        onError={(e) => {
                                            e.currentTarget.onerror = null;
                                            e.currentTarget.src = fallbackTypeIcon(form.type);
                                        }}
                                    />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--c-muted)]">Preview Source</p>
                                    <p className="mt-1 text-xs font-semibold text-[var(--c-text)]">
                                        {previewSourceLabel}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Section 3 · Category ───────────────────────── */}
                <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-5 shadow-sm xl:col-span-12">
                    <div className="flex items-center justify-between gap-3">
                        <SectionHeading icon={Layers} label="Portal Category" />
                        <button
                            type="button"
                            onClick={() => setIsAddCategoryOpen((value) => !value)}
                            className="flex items-center gap-1.5 rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2 text-xs font-bold text-[var(--c-text)] transition hover:border-[var(--c-accent)] hover:text-[var(--c-accent)]"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Add Custom Category
                        </button>
                    </div>
                    <p className="mt-1 text-xs text-[var(--c-muted)]">
                        The category determines the default transaction methods for this portal. If you need a new one, add a custom category and it will start with a safe default icon.
                    </p>
                    {isAddCategoryOpen && (
                        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] p-3">
                            <input
                                id="new-category-name"
                                type="text"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomCategory()}
                                placeholder="New category name..."
                                autoFocus
                                className="min-w-[220px] flex-1 rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 text-xs font-medium text-[var(--c-text)] outline-none focus:border-[var(--c-accent)]"
                            />
                            <button
                                type="button"
                                onClick={handleAddCustomCategory}
                                className="rounded-lg bg-[var(--c-accent)] px-3 py-2 text-xs font-bold text-white transition hover:opacity-90"
                            >
                                Add
                            </button>
                            <button
                                type="button"
                                onClick={() => { setIsAddCategoryOpen(false); setNewCategoryName(''); }}
                                className="rounded-lg p-2 text-[var(--c-muted)] transition hover:text-[var(--c-text)]"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    )}
                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6 2xl:grid-cols-7">
                        {allCategories.map((cat) => (
                            <div key={cat.id} className="relative">
                                <CategoryTile
                                    category={cat}
                                    isActive={form.type === cat.id}
                                    onClick={() => handleCategoryChange(cat.id)}
                                    systemAssets={systemAssets}
                                />
                                {cat.isCustom ? (
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveCustomCategory(cat.id)}
                                        className="absolute right-1.5 top-1.5 z-[2] flex h-6 w-6 items-center justify-center rounded-full border border-rose-500/30 bg-[var(--c-surface)] text-rose-400 transition hover:bg-rose-500/10"
                                        aria-label={`Remove ${cat.label}`}
                                        title={`Remove ${cat.label}`}
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                ) : null}
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Section 4 · Transaction Methods ───────────── */}
                <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-5 shadow-sm xl:col-span-12">
                    <div className="flex items-center justify-between gap-3">
                        <SectionHeading icon={Zap} label="Transaction Methods" />
                        <button
                            type="button"
                            onClick={() => setIsAddMethodOpen((v) => !v)}
                            className="flex items-center gap-1.5 rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-2 text-xs font-bold text-[var(--c-text)] transition hover:border-[var(--c-accent)] hover:text-[var(--c-accent)]"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Add Custom
                        </button>
                    </div>
                    <p className="mt-1 text-xs text-[var(--c-muted)]">
                        Default methods are pre-set for this category. Toggle them on or off. Add custom methods if needed.
                    </p>

                    {/* Add custom method inline form */}
                    {isAddMethodOpen && (
                        <div className="mt-3 flex items-center gap-2 rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] p-3">
                            <input
                                id="new-method-name"
                                type="text"
                                value={newMethodName}
                                onChange={(e) => setNewMethodName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomMethod()}
                                placeholder="New method name…"
                                autoFocus
                                className="flex-1 rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 text-xs font-medium text-[var(--c-text)] outline-none focus:border-[var(--c-accent)]"
                            />
                            <button
                                type="button"
                                onClick={handleAddCustomMethod}
                                className="rounded-lg bg-[var(--c-accent)] px-3 py-2 text-xs font-bold text-white transition hover:opacity-90"
                            >
                                Add
                            </button>
                            <button
                                type="button"
                                onClick={() => { setIsAddMethodOpen(false); setNewMethodName(''); }}
                                className="rounded-lg p-2 text-[var(--c-muted)] transition hover:text-[var(--c-text)]"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    )}

                    {/* Method list */}
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {visibleMethodDefs.length === 0 ? (
                            <p className="col-span-full text-xs text-[var(--c-muted)]">No methods for this category.</p>
                        ) : (
                            visibleMethodDefs.map((method) => (
                                <MethodPill
                                    key={method.id}
                                    method={method}
                                    isSelected={form.methods.includes(method.id)}
                                    isCustom={!!method.isCustom}
                                    onToggle={() => handleToggleMethod(method.id)}
                                    onRemove={method.isCustom ? () => handleRemoveCustomMethod(method.id) : null}
                                    firestoreIconMap={firestoreIconMap}
                                    systemAssets={systemAssets}
                                />
                            ))
                        )}
                    </div>
                </div>

                {/* ── Status banner ──────────────────────────────── */}
                <div className="xl:col-span-12">
                    <StatusBanner message={status.message} type={status.type} />
                </div>

                {/* ── Action bar ───────────────────────────────────── */}
                <div className="flex items-center gap-3 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4 shadow-sm xl:col-span-12">
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="rounded-xl bg-[var(--c-accent)] px-8 py-3 text-sm font-bold text-white shadow-lg shadow-[var(--c-accent)]/20 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isSaving ? 'Saving…' : isEdit ? 'Update Portal' : 'Create Portal'}
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate(`/t/${tenantId}/portal-management`)}
                        className="flex items-center gap-2 rounded-xl border border-[var(--c-border)] px-6 py-3 text-sm font-bold text-[var(--c-text)] transition hover:bg-[var(--c-panel)]"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Cancel
                    </button>
                </div>
            </div>

            {isLogoStudioOpen && logoRawUrl && typeof document !== 'undefined'
                ? createPortal(
                    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[rgba(7,11,20,0.62)] px-4 py-6 backdrop-blur-[6px]">
                        <div className="w-full max-w-2xl overflow-hidden rounded-[1.75rem] bg-[var(--c-surface)] shadow-[0_36px_120px_-40px_rgba(15,23,42,0.65)] ring-1 ring-[var(--c-border)]">
                            <div className="flex items-center justify-between border-b border-[var(--c-border)] bg-[color:color-mix(in_srgb,var(--c-panel)_88%,transparent)] px-5 py-3">
                                <div>
                                    <p className="text-sm font-black text-[var(--c-text)]">Adjust Portal Logo</p>
                                    <p className="text-[11px] font-medium text-[var(--c-muted)]">Crop the corners neatly, then save this logo for the portal.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleCancelLogoStudio}
                                    className="rounded-lg p-1.5 text-[var(--c-muted)] transition hover:text-[var(--c-text)]"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="p-4">
                                <ImageStudio
                                    sourceUrl={logoRawUrl}
                                    onReset={handleCancelLogoStudio}
                                    onFileChange={handleLogoFileSelect}
                                    zoom={logoZoom}
                                    rotation={logoRotation}
                                    setZoom={setLogoZoom}
                                    setRotation={setLogoRotation}
                                    onCropComplete={(_, area) => { setLogoCroppedArea(area); }}
                                    aspect={1}
                                    cropShape="rect"
                                    showFilters={false}
                                    title="Portal Logo Crop"
                                    workspaceHeightClass="h-[200px] sm:h-[240px]"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 border-t border-[var(--c-border)] bg-[var(--c-surface)] px-5 py-4">
                                <button
                                    type="button"
                                    onClick={handleCancelLogoStudio}
                                    className="rounded-xl border border-[var(--c-border)] px-4 py-2 text-xs font-bold text-[var(--c-text)] transition hover:bg-[var(--c-panel)]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleApplyLogo}
                                    disabled={isUploadingLogo}
                                    className="rounded-xl bg-[var(--c-accent)] px-4 py-2 text-xs font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {isUploadingLogo ? 'Saving Logo…' : 'Crop & Save'}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body,
                )
                : null}

            <ProgressVideoOverlay
                open={!isEdit && isSaving}
                dismissible={false}
                minimal
                title="Your portal creation is going on"
                subtitle="Please wait while we complete the setup."
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
        </>
    );

    if (embedded) {
        return content;
    }

    return (
        <PageShell
            title={isEdit ? 'Edit Portal' : 'New Portal'}
            subtitle={
                isEdit
                    ? `Editing "${existingPortal?.name || portalId}"`
                    : 'Configure your new operational portal below.'
            }
            maxWidthClass="max-w-[min(120rem,calc(100vw-1.5rem))]"
        >
            {content}
        </PageShell>
    );
};

/* ─── Tiny layout helpers ────────────────────────────────────── */
const SectionHeading = ({ icon: IconComponent, label }) => {
    return (
        <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-[var(--c-accent)]/30 bg-[color:color-mix(in_srgb,var(--c-accent)_14%,transparent)] text-[var(--c-accent)]">
                {IconComponent ? <IconComponent className="h-3.5 w-3.5" /> : null}
            </span>
            <p className="text-xs font-black uppercase tracking-wider text-[var(--c-text)]">{label}</p>
        </div>
    );
};

const FieldLabel = ({ children }) => (
    <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--c-muted)]">
        {children}
    </label>
);

export default PortalFormPage;
