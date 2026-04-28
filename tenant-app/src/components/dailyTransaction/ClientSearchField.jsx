import { memo, useEffect, useRef, useState } from 'react';
import { Search, ChevronRight, Plus } from 'lucide-react';
import { fetchTenantClients } from '../../lib/backendStore';
import { useTenant } from '../../context/useTenant';
import { resolveClientTypeIcon } from '../../lib/clientIcons';
import CurrencyValue from '../common/CurrencyValue';
import QuickAddClientModal from './QuickAddClientModal';
import InputActionField from '../common/InputActionField';
import IdentityCardSelector from '../common/IdentityCardSelector';
import { getCachedSystemAssetsSnapshot, getSystemAssets } from '../../lib/systemAssetsCache';

/**
 * Reusable Client Search Component
 * Supports searching both root clients and dependents.
 * Optimized with local filtering after initial fetch.
 */
const ClientSearchField = ({ onSelect, selectedId, placeholder = 'Search Client...', filterType, parentId }) => {
    const { tenantId } = useTenant();
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [rows, setRows] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [systemAssets, setSystemAssets] = useState(() => getCachedSystemAssetsSnapshot());
    const wrapperRef = useRef(null);

    useEffect(() => {
        getSystemAssets().then(setSystemAssets).catch(() => {});
    }, []);

    useEffect(() => {
        let isMounted = true;
        const load = async () => {
            if (!tenantId) return;
            setIsLoading(true);
            try {
                const res = await fetchTenantClients(tenantId);
                if (isMounted && res.ok) {
                    let data = res.rows;
                    if (filterType === 'parent') {
                        data = data.filter(c => c.type === 'company' || c.type === 'individual');
                    }
                    if (filterType === 'dependent') {
                        data = data.filter(c => String(c.type || '').toLowerCase() === 'dependent');
                    }
                    if (parentId) {
                        data = data.filter(
                            (c) => String(c.type || '').toLowerCase() === 'dependent' && String(c.parentId) === String(parentId),
                        );
                    }
                    setRows(data);
                }
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };
        load();
        return () => { isMounted = false; };
    }, [tenantId, filterType, parentId, refreshKey]);

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

    const filtered = rows.filter((item) => {
        const fields = [
            item.fullName,
            item.tradeName,
            item.displayClientId,
            item.primaryMobile,
            item.emiratesId,
            item.tradeLicenseNumber,
            item.passportNumber,
            item.unifiedNumber,
            item.email
        ];
        const searchStr = fields.filter(Boolean).join(' ').toLowerCase();
        return searchStr.includes(query.toLowerCase());
    });

    const handleSelect = (client) => {
        onSelect?.(client);
        setIsOpen(false);
        setQuery('');
    };

    const getClientIcon = (client) => {
        const iconSrc = resolveClientTypeIcon(client, null, systemAssets);
        return <img src={iconSrc} alt="" className="h-full w-full object-cover opacity-90" />;
    };

    const getBalanceValue = (client) => Number(client.balance ?? client.openingBalance ?? 0) || 0;

    const selectedClient = rows.find(c => c.id === selectedId);

    return (
        <div className="relative w-full" ref={wrapperRef}>
            <div 
                className={`flex h-14 items-center gap-2 rounded-2xl border px-3 transition-all ${
                    isOpen ? 'border-[var(--c-accent)] ring-4 ring-[var(--c-accent)]/5' : 'border-[var(--c-border)] bg-[var(--c-panel)]'
                }`}
                onClick={() => setIsOpen(true)}
            >
                <Search strokeWidth={1.5} size={16} className="text-[var(--c-muted)]" />
                <div className="flex-1 overflow-hidden">
                    {selectedClient ? (
                        <div className="flex items-center gap-2">
                             <span className="text-[10px] font-black uppercase text-[var(--c-accent)] bg-[var(--c-accent)]/10 px-1.5 py-0.5 rounded leading-none">
                                {selectedClient.displayClientId}
                             </span>
                             <span className="truncate text-sm font-bold text-[var(--c-text)]">
                                {selectedClient.fullName || selectedClient.tradeName}
                             </span>
                        </div>
                    ) : (
                        <InputActionField
                            value={query}
                            onValueChange={(val) => {
                                setQuery(val);
                                if (!isOpen) setIsOpen(true);
                            }}
                            placeholder={placeholder}
                            className="w-full bg-transparent p-0 border-none shadow-none focus-within:ring-0 min-h-0 h-10"
                            inputClassName="p-0 text-sm font-bold text-[var(--c-text)]"
                            showPasteButton={false}
                        />
                    )}
                </div>
                {selectedId && (
                    <button 
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onSelect?.(null);
                            setQuery('');
                        }}
                        className="p-1 text-[var(--c-muted)] hover:text-rose-500"
                    >
                        <ChevronRight strokeWidth={1.5} size={14} className="rotate-90" />
                    </button>
                )}
            </div>

            {isOpen && (
                <div className="absolute left-0 right-0 z-[100] mt-2 overflow-visible rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                    <div className="border-b border-[var(--c-border)] bg-[var(--c-panel)] p-2">
                        <InputActionField
                            autoFocus
                            value={query}
                            onValueChange={setQuery}
                            placeholder="Type to filter..."
                            className="w-full h-10 min-h-0"
                            inputClassName="text-[11px] font-black uppercase tracking-widest text-[var(--c-text)]"
                            showPasteButton={false}
                        />
                    </div>

                    <div className="max-h-[300px] overflow-y-auto scrollbar-hide py-2">
                        {isLoading && rows.length === 0 ? (
                            <p className="p-8 text-center text-xs text-[var(--c-muted)] italic">Fetching clients...</p>
                        ) : (
                            <>
                                {filtered.length === 0 ? (
                                    <div className="p-8 text-center space-y-3">
                                        <p className="text-xs font-bold text-[var(--c-muted)] uppercase tracking-widest">No matching results found</p>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setIsCreateModalOpen(true);
                                            }}
                                            className="compact-action flex items-center gap-2 mx-auto rounded-xl bg-[var(--c-accent)] px-4 text-[10px] font-semibold text-white uppercase shadow-lg shadow-[var(--c-accent)]/20"
                                        >
                                            <Plus strokeWidth={1.5} size={12} /> Create New Client
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        {filtered.map((item) => {
                                            const isDependent = String(item.type || '').toLowerCase() === 'dependent';
                                            return (
                                                <div key={item.id} className="px-2 py-1">
                                                    <div className="flex items-center gap-2">
                                                        <IdentityCardSelector
                                                            entity={item}
                                                            tenantId={tenantId}
                                                            clientId={isDependent ? item.parentId : item.id}
                                                            dependentId={isDependent ? item.id : ''}
                                                            isDependent={isDependent}
                                                            mode="button"
                                                            onSelect={handleSelect}
                                                            size="sm"
                                                            imageOverride={getClientIcon(item)}
                                                            className={`min-w-0 flex-1 ${selectedId === item.id ? 'border-[var(--c-accent)] bg-[var(--c-accent)]/10' : ''}`}
                                                            tooltipClassName="left-0"
                                                        />
                                                        <div className="w-20 shrink-0 text-right">
                                                            <p className={`text-[10px] font-semibold ${getBalanceValue(item) < 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                                                                <CurrencyValue value={getBalanceValue(item)} iconSize="h-2.5 w-2.5" />
                                                            </p>
                                                        </div>
                                                        {selectedId === item.id && (
                                                            <div className="h-2 w-2 shrink-0 rounded-full bg-[var(--c-accent)]" />
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <div className="border-t border-[var(--c-border)] mt-2 px-2 py-2">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setIsCreateModalOpen(true);
                                                }}
                                                className="flex w-full items-center gap-2 rounded-xl border border-dashed border-[var(--c-border)] bg-[var(--c-panel)]/50 px-3 py-2 text-[10px] font-black uppercase text-[var(--c-muted)] hover:border-[var(--c-accent)] hover:text-[var(--c-accent)] transition-all"
                                            >
                                                <Plus strokeWidth={1.5} size={12} /> Not in list? Create New
                                            </button>
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            <QuickAddClientModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={(client) => {
                    setRefreshKey(prev => prev + 1);
                    onSelect(client);
                    setIsOpen(false);
                }}
            />
        </div>
    );
};

export default memo(ClientSearchField);
