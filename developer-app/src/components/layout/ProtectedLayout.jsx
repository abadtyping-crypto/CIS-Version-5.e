import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Ticket, LogOut, Code2, Menu, X, LibraryBig, Clapperboard, LayoutPanelTop } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { DevHeader } from './DevHeader';

const Sidebar = ({ isOpen, setIsOpen }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const userString = localStorage.getItem('acisDevUser');
    const user = userString ? JSON.parse(userString) : null;

    const handleLogout = async () => {
        await auth.signOut();
        localStorage.removeItem('acisDevUser');
        navigate('/login');
    };

    const menuItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
        { icon: Users, label: 'Tenant Management', path: '/tenants' },
        { icon: Ticket, label: 'Support Tickets', path: '/tickets' },
        { icon: LibraryBig, label: 'Global Libraries', path: '/libraries' },
        { icon: Clapperboard, label: 'Instructions Library', path: '/instructions-library' },
        { icon: LayoutPanelTop, label: 'Header Control Center', path: '/header-control-center' },
        { icon: Code2, label: 'Platform Settings', path: '/platform-settings' },
    ];

    return (
        <>
            {/* Mobile Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Sidebar Container */}
            <aside className={`fixed top-0 left-0 z-50 h-screen w-64 bg-[var(--c-surface)] text-[var(--c-muted)] flex flex-col border-r border-[var(--c-border)] transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>

                {/* Brand Header */}
                <div className="h-20 flex items-center justify-between px-6 border-b border-[var(--c-border)]">
                    <div className="flex items-center gap-3 text-[var(--c-text)]">
                        <div className="w-8 h-8 rounded-lg bg-[var(--c-accent)] flex items-center justify-center text-white">
                            <Code2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="font-black tracking-wide text-sm leading-tight">ACIS Core</h1>
                            <p className="text-[10px] text-[var(--c-muted)] font-bold uppercase tracking-widest">Dev Portal</p>
                        </div>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="lg:hidden text-[var(--c-muted)] hover:text-[var(--c-text)]">
                        <X size={20} />
                    </button>
                </div>

                {/* Navigation */}
                <div className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
                    {menuItems.map((item) => {
                        const isActive = location.pathname === item.path
                            || (item.path === '/libraries' && location.pathname === '/portal-logo-library');
                        return (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                onClick={() => setIsOpen(false)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-bold ${isActive
                                        ? 'bg-[var(--c-accent)] text-white shadow-lg shadow-[color:color-mix(in_srgb,var(--c-accent)_26%,transparent)]'
                                        : 'hover:bg-[var(--c-panel)] hover:text-[var(--c-text)]'
                                    }`}
                            >
                                <item.icon className="w-5 h-5" />
                                {item.label}
                            </NavLink>
                        )
                    })}
                </div>

                {/* User Profile & Logout */}
                <div className="p-4 border-t border-[var(--c-border)]">
                    <div className="flex items-center justify-between px-2 py-3">
                        <div className="truncate pr-4">
                            <p className="text-sm font-bold text-[var(--c-text)] truncate">{user?.telegram || 'Developer'}</p>
                            <p className="text-[10px] uppercase tracking-widest text-[var(--c-muted)]">{user?.role || 'Admin'}</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            title="Sign Out"
                            className="w-10 h-10 rounded-xl bg-[var(--c-panel)] hover:bg-rose-500/10 hover:text-rose-500 flex items-center justify-center transition-colors flex-shrink-0"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
};

export const ProtectedLayout = ({ children, fullWidth = false }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="min-h-screen bg-[var(--c-bg)] flex flex-col lg:flex-row font-sans selection:bg-[color:color-mix(in_srgb,var(--c-accent)_28%,white)]">
            <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

            <main className="flex-1 lg:ml-64 p-4 md:p-6 lg:p-8 overflow-y-auto">
                <div className={fullWidth ? 'w-full' : 'max-w-6xl mx-auto'}>
                    <DevHeader onOpenSidebar={() => setSidebarOpen(true)} />
                    <div className="dev-slate-theme">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
};
