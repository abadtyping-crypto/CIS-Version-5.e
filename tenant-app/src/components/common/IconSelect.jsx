import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSystemAssets, resolveAssetWithVariation } from '../../lib/systemAssetsCache';

const IconSelect = ({
    value,
    onChange,
    options = [],
    placeholder = 'Select',
    disabled = false,
    searchable = false,
    searchValue = '',
    onSearchChange,
    searchPlaceholder = 'Search...',
    className = '',
    hideLabel = false,
    leftIconSlot = false,
    defaultIconId = '',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [panelPlacement, setPanelPlacement] = useState('bottom');
    const [panelMaxHeight, setPanelMaxHeight] = useState(256);
    const [panelStyle, setPanelStyle] = useState({});
    const rootRef = useRef(null);
    const panelRef = useRef(null);
    const selected = options.find((opt) => opt.value === value) || null;
    const systemAssets = useSystemAssets();
    
    const triggerClass = [
        'compact-field flex h-14 w-full items-center justify-between rounded-2xl',
        'border border-[var(--c-border)] bg-[var(--c-panel)]',
        leftIconSlot ? 'text-left text-sm font-semibold shadow-sm outline-none transition' : 'px-4 text-left text-sm font-semibold shadow-sm outline-none transition',
        'text-[var(--c-text)]',
        'shadow-[0_10px_24px_-18px_rgba(15,23,42,0.38)]',
        'focus:border-[var(--c-accent)] focus:ring-4 focus:ring-[var(--c-accent)]/10',
        'disabled:opacity-50',
    ].join(' ');
    
    const panelClass = [
        'compact-popover absolute z-50 mt-1.5 w-full overflow-auto rounded-[1.25rem]',
        'border border-[var(--c-border)] bg-[var(--c-surface)]',
        'p-2 shadow-2xl',
        'shadow-[0_22px_48px_-28px_rgba(15,23,42,0.55)]',
        'backdrop-blur-sm',
    ].join(' ');

    useEffect(() => {
        const onDocumentClick = (event) => {
            const target = event.target;
            if (!rootRef.current) return;
            if (rootRef.current.contains(target)) return;
            if (panelRef.current?.contains(target)) return;
            setIsOpen(false);
        };
        document.addEventListener('mousedown', onDocumentClick);
        return () => document.removeEventListener('mousedown', onDocumentClick);
    }, []);

    useEffect(() => {
        if (!isOpen) return undefined;

        const updatePanelLayout = () => {
            if (!rootRef.current) return;
            const rect = rootRef.current.getBoundingClientRect();
            const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
            const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
            const preferredHeight = Math.min(panelRef.current?.scrollHeight || 256, 320);
            const gap = 12;
            const bottomSpace = Math.max(120, Math.floor(viewportHeight - rect.bottom - gap - 8));
            const topSpace = Math.max(120, Math.floor(rect.top - gap - 8));
            const shouldOpenUp = bottomSpace < preferredHeight && topSpace > bottomSpace;
            const width = Math.max(rect.width, 240);
            const left = Math.min(
                Math.max(12, rect.left),
                Math.max(12, viewportWidth - width - 12),
            );
            const top = shouldOpenUp
                ? Math.max(12, rect.top - Math.min(preferredHeight, topSpace) - gap)
                : Math.min(viewportHeight - Math.min(preferredHeight, bottomSpace) - 12, rect.bottom + gap);

            setPanelPlacement(shouldOpenUp ? 'top' : 'bottom');
            setPanelMaxHeight(shouldOpenUp ? topSpace : bottomSpace);
            setPanelStyle({
                position: 'fixed',
                top: `${top}px`,
                left: `${left}px`,
                width: `${width}px`,
                maxHeight: `${shouldOpenUp ? topSpace : bottomSpace}px`,
            });
        };

        updatePanelLayout();
        window.addEventListener('resize', updatePanelLayout);
        window.addEventListener('scroll', updatePanelLayout, true);

        return () => {
            window.removeEventListener('resize', updatePanelLayout);
            window.removeEventListener('scroll', updatePanelLayout, true);
        };
    }, [isOpen, options.length, searchable]);

    const defaultIconUrl = defaultIconId ? resolveAssetWithVariation(systemAssets, defaultIconId) : '';

    return (
        <div ref={rootRef} className={`relative ${className}`.trim()}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => setIsOpen((prev) => !prev)}
                className={triggerClass}
            >
                {leftIconSlot ? (
                    <span className="min-w-0 flex-1 flex items-center">
                        <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden border-r border-[var(--c-border)] bg-[var(--c-panel)] p-0.5">
                            <span className="flex h-full w-full items-center justify-center overflow-hidden">
                                {selected?.icon || defaultIconUrl ? (
                                    typeof (selected?.icon || defaultIconUrl) === 'string' ? (
                                        <img src={selected?.icon || defaultIconUrl} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center overflow-visible">
                                            <selected.icon className="h-5 w-5 text-[var(--c-accent)]" />
                                        </span>
                                    )
                                ) : null}
                            </span>
                        </span>
                        {!hideLabel ? (
                            <span className={`truncate px-4 text-sm font-black tracking-tight ${selected ? 'text-[var(--c-text)]' : 'text-[var(--c-muted)]'}`}>
                                {selected ? selected.label : placeholder}
                            </span>
                        ) : null}
                    </span>
                ) : selected ? (
                    <span className="flex min-w-0 items-center gap-2">
                        {selected.icon && (
                            typeof selected.icon === 'string' ? (
                                <img src={selected.icon} alt="" className="h-6 w-6 shrink-0 object-contain" />
                            ) : (
                                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-visible">
                                    <selected.icon className="h-5 w-5 text-[var(--c-accent)]" />
                                </span>
                            )
                        )}
                        {!hideLabel && <span className="truncate text-[var(--c-text)]">{selected.label}</span>}
                    </span>
                ) : (
                    <span className="text-[var(--c-muted)]">{placeholder}</span>
                )}
                <span className={leftIconSlot ? 'pr-4 text-[10px] text-[var(--c-muted)]' : 'ml-3 text-[10px] text-[var(--c-muted)]'}>▼</span>
            </button>

            {isOpen && !disabled && (
                createPortal(
                <div
                    ref={panelRef}
                    className={`${panelClass} ${panelPlacement === 'top' ? 'origin-bottom' : 'origin-top'}`}
                    style={{
                        ...panelStyle,
                        zIndex: 9999,
                        maxHeight: `${panelMaxHeight}px`,
                        marginTop: 0,
                    }}
                >
                    {searchable ? (
                        <div className="sticky top-0 z-10 mb-1 rounded-xl bg-[var(--c-surface)] p-1">
                            <input
                                type="text"
                                value={searchValue}
                                onChange={(event) => onSearchChange?.(event.target.value)}
                                placeholder={searchPlaceholder}
                                className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] px-3 py-1.5 text-xs font-semibold text-[var(--c-text)] outline-none transition shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] focus:border-[var(--c-accent)] focus:ring-2 focus:ring-[var(--c-accent)]/10"
                            />
                        </div>
                    ) : null}
                    {options.length === 0 ? (
                        <div className="px-3 py-2 text-xs font-semibold text-[var(--c-muted)]">No options available</div>
                    ) : (
                        options.map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                    onChange(opt.value);
                                    setIsOpen(false);
                                }}
                                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition ${
                                    opt.value === value
                                        ? 'border border-[var(--c-accent)]/20 bg-[color:color-mix(in_srgb,var(--c-accent)_14%,var(--c-surface))] text-[var(--c-accent)]'
                                        : 'border border-transparent text-[var(--c-text)] hover:border-[var(--c-border)] hover:bg-[var(--c-panel)]'
                                }`}
                            >
                                {opt.icon && (
                                    typeof opt.icon === 'string' ? (
                                        <img src={opt.icon} alt="" className="h-6 w-6 shrink-0 object-contain" />
                                    ) : (
                                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-visible">
                                            <opt.icon className="h-5 w-5" />
                                        </span>
                                    )
                                )}
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-bold">{opt.label}</span>
                                    {opt.meta ? <span className="block truncate text-[10px] font-semibold opacity-70">{opt.meta}</span> : null}
                                </span>
                            </button>
                        ))
                    )}
                </div>,
                document.body,
                )
            )}
        </div>
    );
};

export default IconSelect;
