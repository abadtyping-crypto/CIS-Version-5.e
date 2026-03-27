import { Copy, Laptop, LayoutTemplate, Minus, MonitorSmartphone, MonitorUp, Smartphone, Square, Tablet, X, Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useElectronLayoutMode from '../../hooks/useElectronLayoutMode';
import { useTheme } from '../../context/useTheme';
import { EMIRATE_OPTIONS } from '../../lib/emirateData';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebaseConfig';

const TitleBar = () => {
    const isElectron = typeof window !== 'undefined' && !!window.electron && !!window.electron.windowControls;
    const [isWindowMaximized, setIsWindowMaximized] = useState(false);
    const [globalConfig, setGlobalConfig] = useState({});

    // Use a real-time socket (onSnapshot) to completely bypass the 6-hour systemAssets cache.
    // The moment the developer clicks "Save" in their portal, the Electron App globally updates in milliseconds.
    useEffect(() => {
        const docRef = doc(db, 'acis_system_assets', 'electron_controller');
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                setGlobalConfig(docSnap.data());
            }
        });
        return () => unsubscribe();
    }, []);

    const appLogoUrl = globalConfig.headerIcon || '/ACIS Icon/appIconx64.png';
    const appName = globalConfig.title || 'ACIS';
    const appSubtitle = globalConfig.subtitle || 'Desktop Workspace';
    const { setMode, overrideMode } = useElectronLayoutMode();
    const { theme, toggleTheme, appearance, updateAppearance, DESKTOP_WALLPAPERS, DESKTOP_FONT_FAMILIES, DESKTOP_FONT_SCALES } = useTheme();
    const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
    const layoutMenuButtonRef = useRef(null);
    const layoutMenuPopoverRef = useRef(null);
    const [layoutMenuPos, setLayoutMenuPos] = useState({ top: 0, left: 0 });

    // Menu Bar States
    const [viewMenuOpen, setViewMenuOpen] = useState(false);
    const viewMenuButtonRef = useRef(null);
    const viewMenuPopoverRef = useRef(null);
    const [viewMenuPos, setViewMenuPos] = useState({ top: 0, left: 0 });

    const [editMenuOpen, setEditMenuOpen] = useState(false);
    const editMenuButtonRef = useRef(null);
    const editMenuPopoverRef = useRef(null);
    const [editMenuPos, setEditMenuPos] = useState({ top: 0, left: 0 });
    const [defaultEmirate, setDefaultEmirate] = useState(() => typeof window !== 'undefined' ? localStorage.getItem('acis-default-emirate') || '' : '');

    useEffect(() => {
        if (!isElectron || !window.electron?.windowControls) return;
        let active = true;

        window.electron.windowControls.getIsMaximized?.().then((value) => {
            if (!active) return;
            setIsWindowMaximized(Boolean(value));
        });

        const unsubscribe = window.electron.windowControls.onMaximizedChange?.((value) => {
            setIsWindowMaximized(Boolean(value));
        });

        return () => {
            active = false;
            if (typeof unsubscribe === 'function') unsubscribe();
        };
    }, [isElectron]);

    const computeLayoutMenuPos = () => {
        if (typeof window === 'undefined') return;
        const anchor = layoutMenuButtonRef.current;
        if (!anchor || typeof anchor.getBoundingClientRect !== 'function') return;
        const rect = anchor.getBoundingClientRect();
        const menuWidth = 208; // `w-52`
        const gutter = 8;
        const left = Math.min(
            Math.max(gutter, rect.right - menuWidth),
            window.innerWidth - menuWidth - gutter,
        );
        const top = rect.bottom + 6;
        setLayoutMenuPos({ top, left });
    };

    const computeViewMenuPos = () => {
        if (typeof window === 'undefined') return;
        const anchor = viewMenuButtonRef.current;
        if (!anchor) return;
        const rect = anchor.getBoundingClientRect();
        setViewMenuPos({ top: rect.bottom + 6, left: rect.left });
    };

    const computeEditMenuPos = () => {
        if (typeof window === 'undefined') return;
        const anchor = editMenuButtonRef.current;
        if (!anchor) return;
        const rect = anchor.getBoundingClientRect();
        setEditMenuPos({ top: rect.bottom + 6, left: rect.left });
    };

    const handleSetDefaultEmirate = (id) => {
        if (typeof window !== 'undefined') {
            if (id) {
                localStorage.setItem('acis-default-emirate', id);
            } else {
                localStorage.removeItem('acis-default-emirate');
            }
        }
        setDefaultEmirate(id || '');
    };

    const handleZoomIn = () => {
        if (isElectron && window.electron.windowControls.zoomIn) {
            window.electron.windowControls.zoomIn();
        }
        setViewMenuOpen(false);
    };

    const handleZoomOut = () => {
        if (isElectron && window.electron.windowControls.zoomOut) {
            window.electron.windowControls.zoomOut();
        }
        setViewMenuOpen(false);
    };

    const resetZoom = () => {
        if (isElectron && window.electron.windowControls.zoomReset) {
            window.electron.windowControls.zoomReset();
        }
        setViewMenuOpen(false);
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey) {
                if (e.key === '=' || e.key === '+') {
                    if (isElectron && window.electron.windowControls.zoomIn) {
                        e.preventDefault();
                        window.electron.windowControls.zoomIn();
                    }
                } else if (e.key === '-') {
                    if (isElectron && window.electron.windowControls.zoomOut) {
                        e.preventDefault();
                        window.electron.windowControls.zoomOut();
                    }
                } else if (e.key === '0') {
                    if (isElectron && window.electron.windowControls.zoomReset) {
                        e.preventDefault();
                        window.electron.windowControls.zoomReset();
                    }
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isElectron]);

    const layoutMenuPortal = layoutMenuOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
                ref={layoutMenuPopoverRef}
                style={{
                    position: 'fixed',
                    top: layoutMenuPos.top,
                    left: layoutMenuPos.left,
                    zIndex: 20000,
                    WebkitAppRegion: 'no-drag',
                }}
                className="glass w-52 rounded-xl border border-[var(--c-border)] p-1.5 shadow-xl"
                role="menu"
                aria-label="Layout Mode"
            >
                <div className="mb-1.5 px-2.5 pt-1 pb-0.5">
                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[var(--c-text)]">Layout Mode</p>
                </div>
                {[
                    { id: null, label: 'Auto (Responsive)', icon: MonitorSmartphone },
                    { id: 'wide', label: 'Wide Workspace', icon: MonitorUp },
                    { id: 'standard', label: 'Standard Desktop', icon: Laptop },
                    { id: 'compact', label: 'Compact Tablet', icon: Tablet },
                    { id: 'mini', label: 'Mini Mobile', icon: Smartphone },
                ].map((item) => {
                    const isActive = overrideMode === item.id || (item.id === null && overrideMode === null);
                    return (
                        <button
                            key={item.id || 'auto'}
                            type="button"
                            onClick={() => {
                                setMode?.(item.id);
                                setLayoutMenuOpen(false);
                            }}
                            className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-semibold transition ${isActive
                                    ? 'bg-[color:color-mix(in_srgb,var(--c-panel)_80%,transparent)] text-[var(--c-accent)] ring-1 ring-[var(--c-border)]'
                                    : 'text-[var(--c-muted)] hover:bg-[color:color-mix(in_srgb,var(--c-panel)_60%,transparent)] hover:text-[var(--c-text)]'
                                }`}
                        >
                            <item.icon size={13} />
                            {item.label}
                        </button>
                    );
                })}
            </div>,
            document.body,
        )
        : null;

    const submenuClasses = "absolute left-[95%] top-[-0.2rem] ml-1 invisible w-44 -translate-y-1 opacity-0 transition-all duration-150 delay-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-hover:delay-75 rounded-xl border border-[var(--c-border)] bg-[var(--c-panel)] p-1.5 shadow-xl glass";
    const submenuClassesWide = submenuClasses.replace('w-44', 'w-48');

    const viewMenuPortal = viewMenuOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
                ref={viewMenuPopoverRef}
                style={{
                    position: 'fixed',
                    top: viewMenuPos.top,
                    left: viewMenuPos.left,
                    zIndex: 20000,
                    WebkitAppRegion: 'no-drag',
                }}
                className="glass w-48 rounded-xl border border-[var(--c-border)] py-1.5 shadow-xl"
                role="menu"
            >
                {/* Theme Mode sub-menu */}
                <div className="group relative px-1.5">
                    <button className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[11px] font-semibold text-[var(--c-text)] hover:bg-[color:color-mix(in_srgb,var(--c-panel)_60%,transparent)] transition">
                        <span>Theme (Mode)</span>
                        <span className="text-[9px] opacity-60">▶</span>
                    </button>
                    <div className={submenuClasses}>
                        <button onClick={toggleTheme} className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-semibold text-[var(--c-text)] hover:bg-[color:color-mix(in_srgb,var(--c-surface)_60%,transparent)] transition">
                            <span>Toggle Dark/Light</span>
                            {theme !== 'system' && <Check strokeWidth={1.5} size={10} />}
                        </button>
                        <button onClick={() => toggleTheme('system')} className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-semibold text-[var(--c-text)] hover:bg-[color:color-mix(in_srgb,var(--c-surface)_60%,transparent)] transition">
                            <span>System Settings</span>
                            {theme === 'system' && <Check strokeWidth={1.5} size={10} />}
                        </button>
                    </div>
                </div>

                {/* Wallpaper/Color sub-menu */}
                <div className="group relative px-1.5">
                    <button className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[11px] font-semibold text-[var(--c-text)] hover:bg-[color:color-mix(in_srgb,var(--c-panel)_60%,transparent)] transition">
                        <span>Background</span>
                        <span className="text-[9px] opacity-60">▶</span>
                    </button>
                    <div className={submenuClasses}>
                        {DESKTOP_WALLPAPERS && DESKTOP_WALLPAPERS.map(wp => (
                            <button key={wp.id} onClick={() => updateAppearance({ wallpaper: wp.id })} className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-semibold text-[var(--c-text)] hover:bg-[color:color-mix(in_srgb,var(--c-surface)_60%,transparent)] transition">
                                <span className="truncate">{wp.label}</span>
                                {appearance?.wallpaper === wp.id && <Check strokeWidth={1.5} size={10} className="shrink-0" />}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Font Family sub-menu */}
                <div className="group relative px-1.5">
                    <button className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[11px] font-semibold text-[var(--c-text)] hover:bg-[color:color-mix(in_srgb,var(--c-panel)_60%,transparent)] transition">
                        <span>Font Design</span>
                        <span className="text-[9px] opacity-60">▶</span>
                    </button>
                    <div className={submenuClasses}>
                        {DESKTOP_FONT_FAMILIES && DESKTOP_FONT_FAMILIES.map(ff => (
                            <button key={ff.id} onClick={() => updateAppearance({ fontFamily: ff.id })} className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-semibold text-[var(--c-text)] hover:bg-[color:color-mix(in_srgb,var(--c-surface)_60%,transparent)] transition">
                                <span>{ff.label}</span>
                                {appearance?.fontFamily === ff.id && <Check strokeWidth={1.5} size={10} />}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Font Size sub-menu */}
                <div className="group relative px-1.5">
                    <button className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[11px] font-semibold text-[var(--c-text)] hover:bg-[color:color-mix(in_srgb,var(--c-panel)_60%,transparent)] transition">
                        <span>Font Size</span>
                        <span className="text-[9px] opacity-60">▶</span>
                    </button>
                    <div className={submenuClasses}>
                        {DESKTOP_FONT_SCALES && DESKTOP_FONT_SCALES.map(fs => (
                            <button key={fs.id} onClick={() => updateAppearance({ fontScale: fs.id })} className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-semibold text-[var(--c-text)] hover:bg-[color:color-mix(in_srgb,var(--c-surface)_60%,transparent)] transition">
                                <span>{fs.label}</span>
                                {appearance?.fontScale === fs.id && <Check strokeWidth={1.5} size={10} />}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="my-1 border-t border-[var(--c-border)] mx-2" />

                {/* Toggle Glass Effect directly in Menu */}
                <div className="px-1.5">
                    <button onClick={() => updateAppearance({ glassEnabled: !(appearance?.glassEnabled !== false) })} className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-semibold text-[var(--c-text)] hover:bg-[color:color-mix(in_srgb,var(--c-panel)_60%,transparent)] transition">
                        <span>Glass Effect</span>
                        {appearance?.glassEnabled !== false && <Check strokeWidth={1.5} size={10} />}
                    </button>
                </div>

                <div className="my-1 border-t border-[var(--c-border)] mx-2" />

                <div className="group relative px-1.5">
                    <button className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[11px] font-semibold text-[var(--c-text)] hover:bg-[color:color-mix(in_srgb,var(--c-panel)_60%,transparent)] transition">
                        <span>Appearance Zoom</span>
                        <span className="text-[9px] opacity-60">▶</span>
                    </button>
                    {/* The nested Appearance Sub-menu */}
                    <div className={submenuClassesWide}>
                        <button
                            onClick={handleZoomIn}
                            className="flex w-full items-center justify-between gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-semibold text-[var(--c-text)] hover:bg-[color:color-mix(in_srgb,var(--c-surface)_60%,transparent)] transition"
                        >
                            <span>Zoom In</span>
                            <span className="text-[9px] font-bold tracking-widest text-[var(--c-muted)]">CTRL+</span>
                        </button>
                        <button
                            onClick={handleZoomOut}
                            className="flex w-full items-center justify-between gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-semibold text-[var(--c-text)] hover:bg-[color:color-mix(in_srgb,var(--c-surface)_60%,transparent)] transition"
                        >
                            <span>Zoom Out</span>
                            <span className="text-[9px] font-bold tracking-widest text-[var(--c-muted)]">CTRL-</span>
                        </button>
                        <div className="my-1 border-t border-[var(--c-border)]" />
                        <button
                            onClick={resetZoom}
                            className="flex w-full items-center justify-between gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-semibold text-[var(--c-text)] hover:bg-[color:color-mix(in_srgb,var(--c-surface)_60%,transparent)] transition"
                        >
                            <span>Reset Zoom</span>
                            <span className="text-[9px] font-bold tracking-widest text-[var(--c-muted)]">CTRL0</span>
                        </button>
                    </div>
                </div>
            </div>,
            document.body
        ) : null;

    const editMenuPortal = editMenuOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
                ref={editMenuPopoverRef}
                style={{
                    position: 'fixed',
                    top: editMenuPos.top,
                    left: editMenuPos.left,
                    zIndex: 20000,
                    WebkitAppRegion: 'no-drag',
                }}
                className="glass w-48 rounded-xl border border-[var(--c-border)] py-1.5 shadow-xl"
                role="menu"
            >
                <div className="group relative px-1.5">
                    <button className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[11px] font-semibold text-[var(--c-text)] hover:bg-[color:color-mix(in_srgb,var(--c-panel)_60%,transparent)] transition">
                        <span>Default Emirate</span>
                        <span className="text-[9px] opacity-60">▶</span>
                    </button>
                    <div className={submenuClasses}>
                        <button
                            type="button"
                            onClick={() => handleSetDefaultEmirate('')}
                            className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-semibold text-[var(--c-text)] hover:bg-[color:color-mix(in_srgb,var(--c-surface)_60%,transparent)] transition"
                        >
                            <span>No Default (Normal)</span>
                            {!defaultEmirate && <Check strokeWidth={1.5} size={10} />}
                        </button>
                        <div className="my-1 border-t border-[var(--c-border)]" />
                        {EMIRATE_OPTIONS.map(em => (
                            <button key={em.value} onClick={() => handleSetDefaultEmirate(em.value)} className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-semibold text-[var(--c-text)] hover:bg-[color:color-mix(in_srgb,var(--c-surface)_60%,transparent)] transition">
                                <span>{em.label}</span>
                                {defaultEmirate === em.value && <Check strokeWidth={1.5} size={10} />}
                            </button>
                        ))}
                    </div>
                </div>
            </div>,
            document.body
        ) : null;

    useEffect(() => {
        if (!isElectron) return;
        if (!layoutMenuOpen && !viewMenuOpen && !editMenuOpen) return;

        if (layoutMenuOpen) computeLayoutMenuPos();
        if (viewMenuOpen) computeViewMenuPos();
        if (editMenuOpen) computeEditMenuPos();

        const onPointerDown = (event) => {
            const target = event.target;
            if (layoutMenuOpen && !layoutMenuButtonRef.current?.contains(target) && !layoutMenuPopoverRef.current?.contains(target)) {
                setLayoutMenuOpen(false);
            }
            if (viewMenuOpen && !viewMenuButtonRef.current?.contains(target) && !viewMenuPopoverRef.current?.contains(target)) {
                setViewMenuOpen(false);
            }
            if (editMenuOpen && !editMenuButtonRef.current?.contains(target) && !editMenuPopoverRef.current?.contains(target)) {
                setEditMenuOpen(false);
            }
        };

        const onResize = () => {
            if (layoutMenuOpen) computeLayoutMenuPos();
            if (viewMenuOpen) computeViewMenuPos();
            if (editMenuOpen) computeEditMenuPos();
        };

        window.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('resize', onResize);

        return () => {
            window.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('resize', onResize);
        };
    }, [layoutMenuOpen, viewMenuOpen, editMenuOpen, isElectron]);

    if (!isElectron) return null;

    return (
        <>
            <div
                style={{
                    WebkitAppRegion: 'drag',
                    minHeight: '34px',
                    height: '34px',
                    position: 'relative',
                    zIndex: 9999,
                    fontSize: '16px',
                }}
                className="flex w-full select-none items-center justify-between border-b border-[var(--c-border)] bg-[color:color-mix(in_srgb,var(--glass-bg)_88%,transparent)] px-2.5 backdrop-blur-xl"
            >
                <div className="flex flex-1 min-w-0 items-center gap-3 truncate">
                    {/* APP LOGO & TITLES */}
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[var(--glass-border)] bg-[color:color-mix(in_srgb,white_86%,var(--c-surface)_14%)] shadow-sm">
                        <img src={appLogoUrl} alt={appName} className="h-full w-full object-cover" />
                    </div>
                    <div className="shrink-0 leading-none mr-2">
                        <p className="truncate text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--c-text)]">
                            {appName}
                        </p>
                        <p className="truncate text-[10px] text-[var(--c-muted)]">
                            {appSubtitle}
                        </p>
                    </div>

                    {/* MENUS (File, Edit, View, Help) */}
                    <div style={{ WebkitAppRegion: 'no-drag' }} className="flex h-full items-center border-l border-[var(--c-border)] pl-3 gap-0.5">
                        <button className="flex items-center justify-center rounded-md px-2 py-1 text-[11px] font-medium text-[var(--c-text)] hover:bg-[color:color-mix(in_srgb,var(--c-surface)_60%,transparent)] transition">
                            File
                        </button>
                        <button
                            ref={editMenuButtonRef}
                            onClick={() => {
                                setEditMenuOpen((prev) => {
                                    const next = !prev;
                                    if (next) computeEditMenuPos();
                                    return next;
                                });
                            }}
                            className={`flex items-center justify-center rounded-md px-2 py-1 text-[11px] font-medium transition ${editMenuOpen
                                    ? 'bg-[var(--c-surface)] text-[var(--c-accent)] shadow-sm'
                                    : 'text-[var(--c-text)] hover:bg-[color:color-mix(in_srgb,var(--c-surface)_60%,transparent)]'
                                }`}
                        >
                            Edit
                        </button>
                        <button
                            ref={viewMenuButtonRef}
                            onClick={() => {
                                setViewMenuOpen((prev) => {
                                    const next = !prev;
                                    if (next) computeViewMenuPos();
                                    return next;
                                });
                            }}
                            className={`flex items-center justify-center rounded-md px-2 py-1 text-[11px] font-medium transition ${viewMenuOpen
                                    ? 'bg-[var(--c-surface)] text-[var(--c-accent)] shadow-sm'
                                    : 'text-[var(--c-text)] hover:bg-[color:color-mix(in_srgb,var(--c-surface)_60%,transparent)]'
                                }`}
                        >
                            View
                        </button>
                        <button className="flex items-center justify-center rounded-md px-2 py-1 text-[11px] font-medium text-[var(--c-text)] hover:bg-[color:color-mix(in_srgb,var(--c-surface)_60%,transparent)] transition">
                            Help
                        </button>
                    </div>
                </div>

                <div style={{ WebkitAppRegion: 'no-drag' }} className="flex h-full items-center">
                    <button
                        type="button"
                        onClick={() => {
                            const next = !globalConfig.isAlwaysOnTop;
                            setGlobalConfig(prev => ({ ...prev, isAlwaysOnTop: next }));
                            if (isElectron) {
                                window.electron.windowControls.setAlwaysOnTop(next);
                            }
                        }}
                        className={`flex h-6 items-center justify-center gap-1.5 rounded-md px-2 text-[10px] font-bold uppercase tracking-wider transition border shadow-sm ${globalConfig.isAlwaysOnTop
                                ? 'border-[var(--c-accent)] bg-[var(--c-accent)]/10 text-[var(--c-accent)]'
                                : 'border-[var(--glass-border)] bg-[var(--c-surface)]/50 text-[var(--c-muted)] hover:border-[var(--c-border)] hover:bg-[var(--c-surface)] hover:text-[var(--c-text)]'
                            }`}
                        title="Always on Top (AOD)"
                        aria-label="Always on Top (AOD)"
                    >
                        <MonitorUp strokeWidth={1.5} size={12} className={globalConfig.isAlwaysOnTop ? 'animate-pulse' : ''} />
                        <span className="hidden sm:inline-block">AOD</span>
                    </button>

                    <div className="h-4 w-px bg-[var(--c-border)] mx-1" />

                    <button
                        type="button"
                        ref={layoutMenuButtonRef}
                        onClick={() => {
                            setLayoutMenuOpen((prev) => {
                                const next = !prev;
                                if (!prev && next) computeLayoutMenuPos();
                                return next;
                            });
                        }}
                        className={`flex h-6 items-center justify-center gap-1.5 rounded-md px-2 text-[10px] font-bold uppercase tracking-wider transition border shadow-sm ${layoutMenuOpen
                                ? 'border-[var(--c-accent)] bg-[var(--c-accent)]/10 text-[var(--c-accent)]'
                                : 'border-[var(--glass-border)] bg-[var(--c-surface)]/50 text-[var(--c-muted)] hover:border-[var(--c-border)] hover:bg-[var(--c-surface)] hover:text-[var(--c-text)]'
                            }`}
                        aria-label="Layout Mode"
                        aria-expanded={layoutMenuOpen}
                        aria-haspopup="menu"
                    >
                        <LayoutTemplate strokeWidth={1.5} size={12} />
                        <span className="hidden sm:inline-block">Layout</span>
                    </button>

                    <div className="h-4 w-px bg-[var(--c-border)] mx-1.5" />

                    <button
                        onClick={() => window.electron.windowControls.minimize()}
                        className="flex h-full w-10 items-center justify-center text-[var(--c-muted)] transition hover:bg-[var(--c-panel)] hover:text-[var(--c-text)]"
                    >
                        <Minus strokeWidth={1.5} size={14} />
                    </button>
                    <button
                        onClick={() => window.electron.windowControls.maximize()}
                        className="flex h-full w-10 items-center justify-center text-[var(--c-muted)] transition hover:bg-[var(--c-panel)] hover:text-[var(--c-text)]"
                    >
                        {isWindowMaximized ? <Copy strokeWidth={1.5} size={12} /> : <Square strokeWidth={1.5} size={12} />}
                    </button>
                    <button
                        onClick={() => window.electron.windowControls.close()}
                        className="flex h-full w-10 items-center justify-center text-[var(--c-muted)] transition hover:bg-[var(--c-danger)] hover:text-white"
                    >
                        <X strokeWidth={1.5} size={14} />
                    </button>
                </div>
            </div>
            {layoutMenuPortal}
            {viewMenuPortal}
            {editMenuPortal}
        </>
    );
};

export default TitleBar;
