import React, { useState, useEffect } from 'react';
import { NavLink, useParams, Outlet, useNavigate } from 'react-router-dom';
import { Users, LibraryBig, Settings, Code2, Menu, X, Globe, Bell } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useShellPreferences } from '../hooks/useShellPreferences';

const HeaderControlCenter = () => {
    const { tenantId } = useParams<{ tenantId: string }>();
    const [tenantName, setTenantName] = useState<string>('Loading...');

    useEffect(() => {
        const resolveTenant = async () => {
            if (!tenantId) {
                setTenantName('No Tenant Selected');
                return;
            }
            try {
                // Rule: Resolve names via UID lookups instead of storing them
                const tenantDoc = await getDoc(doc(db, 'tenants', tenantId));
                if (tenantDoc.exists()) {
                    setTenantName(tenantDoc.data().name || tenantId);
                } else {
                    setTenantName(tenantId);
                }
            } catch (error) {
                console.error('Error resolving tenant:', error);
                setTenantName(tenantId || 'Unknown');
            }
        };

        resolveTenant();
    }, [tenantId]);

    return (
        <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-20">
            <div className="flex items-center gap-4">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Active Tenant</span>
                    <span className="text-sm font-bold text-slate-800">{tenantName}</span>
                </div>
                <div className="h-8 w-px bg-slate-200 mx-2" />
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{tenantId}</span>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <button 
                    aria-label="Notifications"
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                    <Bell className="w-5 h-5" />
                </button>
                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200 font-black text-xs text-slate-500">
                    AD
                </div>
            </div>
        </header>
    );
};

export const ElectronMain = () => {
    const { tenantId } = useParams<{ tenantId: string }>();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // Rule 4.3 (Strict Creation): Initialize shell preferences upon entry
    useShellPreferences(tenantId || '');

    const navItems = [
        { icon: Users, label: 'Tenant Management', path: `/t/${tenantId}/dashboard` },
        { icon: LibraryBig, label: 'Application Library', path: `/t/${tenantId}/apps` },
        { icon: Settings, label: 'System Settings', path: `/t/${tenantId}/settings` },
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex overflow-hidden font-sans">
            {/* Sidebar */}
            <aside className={`bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
                {/* Brand */}
                <div className="h-16 flex items-center px-6 gap-3 border-b border-slate-800">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                        <Code2 className="w-5 h-5 text-white" />
                    </div>
                    {isSidebarOpen && (
                        <div className="min-w-0">
                            <h1 className="text-white font-black text-sm tracking-tight truncate">ACIS Version 5.0</h1>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Dev Shell</p>
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto overflow-x-hidden">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => `
                                flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-sm font-bold
                                ${isActive 
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                                    : 'hover:bg-slate-800 hover:text-white'
                                }
                                ${!isSidebarOpen && 'justify-center'}
                            `}
                        >
                            <item.icon className="w-5 h-5 flex-shrink-0" />
                            {isSidebarOpen && <span className="truncate">{item.label}</span>}
                        </NavLink>
                    ))}
                </nav>

                {/* Collapse Toggle */}
                <div className="p-4 border-t border-slate-800">
                    <button 
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        aria-label={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
                        className="w-full flex items-center justify-center p-2 rounded-xl border border-slate-800 hover:border-slate-600 transition-all text-slate-500 hover:text-white"
                    >
                        {isSidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
                <HeaderControlCenter />
                <main className="flex-1 overflow-y-auto p-6 lg:p-10">
                    <div className="max-w-7xl mx-auto">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

