import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import SectionCard from './SectionCard';
import { useTenant } from '../../context/useTenant';
import { useAuth } from '../../context/useAuth';
import { fetchTenantPortals, deleteTenantPortal } from '../../lib/backendStore';
import { canUserPerformAction } from '../../lib/userControlPreferences';
import CurrencyValue from '../common/CurrencyValue';
import ConfirmDialog from '../common/ConfirmDialog';
import { getCachedSystemAssetsSnapshot, getSystemAssets } from '../../lib/systemAssetsCache';
import { DEFAULT_PORTAL_ICON, resolvePortalTypeIcon } from '../../lib/transactionMethodConfig';

/* ─── Fallback icon helper ────────────────────────────────────── */
const CATEGORY_ASSET_MAP = {
    Bank: 'icon_portal_bank',
    'Card Payment': 'icon_portal_card',
    'Petty Cash': 'icon_portal_cash',
    Portals: 'icon_portal_portals',
    Terminal: 'icon_portal_terminal',
};

const fallbackTypeIcon = (type, systemAssets) => {
    const systemKey = CATEGORY_ASSET_MAP[String(type || '').trim()];
    return (systemKey && systemAssets?.[systemKey]?.iconUrl) || resolvePortalTypeIcon(type);
};

/* ─── Portal List Item ────────────────────────────────────────── */
const PortalListItem = ({ portal, onEdit, onDelete, onOpen, systemAssets }) => {
    const balance = Number(portal.balance || 0);
    const isNegative = balance < 0;

    return (
        <div className="group flex min-h-[56px] items-stretch overflow-hidden rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] transition hover:bg-[var(--c-surface)]">
            {/* Signature Icon Slot */}
            <div className="flex w-20 shrink-0 items-center justify-center overflow-hidden border-r border-[var(--c-border)] bg-white shadow-sm">
                <img
                    src={portal.logoUrl || portal.iconUrl || fallbackTypeIcon(portal.type, systemAssets)}
                    alt={portal.name}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = DEFAULT_PORTAL_ICON;
                    }}
                />
            </div>

            {/* Info */}
            <div className="flex min-w-0 flex-1 flex-col justify-center px-4 py-3">
                <div className="flex items-baseline gap-2">
                    <p className="truncate text-sm font-black text-[var(--c-text)]">{portal.name}</p>
                    <span className="truncate text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--c-muted)]">
                        {portal.type}
                    </span>
                </div>
                <p className={`mt-0.5 text-xs font-bold ${isNegative ? 'text-rose-500' : 'text-emerald-500'}`}>
                    <CurrencyValue value={balance} iconSize="h-3 w-3" />
                </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 px-3">
                <ActionBtn
                    onClick={onOpen}
                    actionLabel="Open portal detail"
                    className="hover:text-[var(--c-accent)]"
                >
                    <ExternalLink strokeWidth={1.6} className="h-4 w-4" />
                </ActionBtn>
                <ActionBtn
                    onClick={onEdit}
                    actionLabel="Edit portal"
                    className="hover:text-[var(--c-accent)]"
                >
                    <Pencil strokeWidth={1.6} className="h-4 w-4" />
                </ActionBtn>
                <ActionBtn
                    onClick={onDelete}
                    actionLabel="Delete portal"
                    className="hover:text-rose-400"
                >
                    <Trash2 strokeWidth={1.6} className="h-4 w-4" />
                </ActionBtn>
            </div>
        </div>
    );
};

const ActionBtn = ({ onClick, actionLabel, className = '', children }) => (
    <button
        type="button"
        onClick={onClick}
        aria-label={actionLabel}
        className={`rounded-lg bg-[var(--c-panel)] p-2 text-[var(--c-muted)] transition ${className}`}
    >
        {children}
    </button>
);

/* ─── Main Section ────────────────────────────────────────────── */
const PortalSetupSection = ({ isOpen, onToggle, refreshKey }) => {
    const navigate = useNavigate();
    const { tenantId } = useTenant();
    const { user } = useAuth();

    const [portals, setPortals] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [deleteStatus, setDeleteStatus] = useState('');
    const [localRefresh, setLocalRefresh] = useState(0);
    const [confirmDialog, setConfirmDialog] = useState({ open: false });
    const [systemAssets, setSystemAssets] = useState(() => getCachedSystemAssetsSnapshot());

    const openConfirm = (options) => setConfirmDialog({ open: true, isDangerous: false, ...options });
    const closeConfirm = () => setConfirmDialog((prev) => ({ ...prev, open: false }));

    useEffect(() => {
        getSystemAssets().then(setSystemAssets).catch(() => { });
    }, []);

    useEffect(() => {
        if (!tenantId || !isOpen) return;
        let active = true;
        fetchTenantPortals(tenantId).then((res) => {
            if (!active) return;
            if (res.ok) setPortals(res.rows || []);
            setIsLoading(false);
        });
        return () => { active = false; };
    }, [tenantId, isOpen, refreshKey, localRefresh]);

    const handleAddNew = () => {
        if (!canUserPerformAction(tenantId, user, 'createPortal')) {
            setDeleteStatus("You don't have permission to create portals.");
            return;
        }
        navigate(`/t/${tenantId}/portal-management/new`);
    };

    const handleEdit = (portalId) => {
        navigate(`/t/${tenantId}/portal-management/edit/${portalId}`);
    };

    const handleOpen = (portalId) => {
        navigate(`/t/${tenantId}/portal-management/${portalId}`);
    };

    const performDelete = async (portal) => {
        const res = await deleteTenantPortal(tenantId, portal.id, user.uid);
        if (res.ok) {
            setDeleteStatus('Portal moved to Recycle Bin.');
            setLocalRefresh((n) => n + 1);
            setTimeout(() => setDeleteStatus(''), 2500);
        } else {
            setDeleteStatus(res.error || 'Delete failed.');
        }
    };

    const handleDelete = (portal) => {
        openConfirm({
            title: 'Delete Portal?',
            message: `Delete "${portal.name}"? It can be recovered from the Recycle Bin.`,
            confirmText: 'Delete',
            isDangerous: true,
            onConfirm: async () => {
                closeConfirm();
                await performDelete(portal);
            },
        });
    };

    const primaryAction = (
        <button
            type="button"
            onClick={handleAddNew}
            className="compact-action flex items-center gap-1.5 rounded-xl bg-[var(--c-accent)] px-3 text-xs font-semibold text-white shadow-sm transition hover:opacity-90"
        >
            <Plus strokeWidth={1.5} className="h-3.5 w-3.5" />
            Add New Portal
        </button>
    );

    return (
        <SectionCard
            title="Portal Setup & Configuration"
            subtitle="Manage portal names, categories, and transaction methods."
            defaultOpen={isOpen}
            onToggle={onToggle}
            primaryAction={primaryAction}
            titleIcon={Building2}
        >
            <div className="space-y-3">
                {isLoading ? (
                    <div className="flex justify-center py-8">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--c-accent)] border-t-transparent" />
                    </div>
                ) : portals.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[var(--c-border)] bg-[var(--c-panel)] py-8">
                        <Building2 strokeWidth={1.5} className="h-8 w-8 text-[var(--c-muted)]/40" />
                        <p className="text-xs text-[var(--c-muted)]">No portals configured yet.</p>
                        <button
                            type="button"
                            onClick={handleAddNew}
                            className="compact-action flex items-center gap-1.5 rounded-xl border border-[var(--c-accent)]/40 px-4 text-xs font-semibold text-[var(--c-accent)] transition hover:bg-[var(--c-accent)]/10"
                        >
                            <Plus strokeWidth={1.5} className="h-3.5 w-3.5" />
                            Create your first portal
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                        {portals.map((p) => (
                            <PortalListItem
                                key={p.id}
                                portal={p}
                                tenantId={tenantId}
                                onOpen={() => handleOpen(p.id)}
                                onEdit={() => handleEdit(p.id)}
                                onDelete={() => handleDelete(p)}
                                systemAssets={systemAssets}
                            />
                        ))}
                    </div>
                )}

                {deleteStatus && (
                    <p className="rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-4 py-2 text-xs text-[var(--c-muted)]">
                        {deleteStatus}
                    </p>
                )}
            </div>
            <ConfirmDialog
                isOpen={confirmDialog.open}
                onCancel={closeConfirm}
                onConfirm={confirmDialog.onConfirm}
                title={confirmDialog.title}
                message={confirmDialog.message}
                confirmText={confirmDialog.confirmText}
                isDangerous={confirmDialog.isDangerous}
            />
        </SectionCard>
    );
};

export default PortalSetupSection;
