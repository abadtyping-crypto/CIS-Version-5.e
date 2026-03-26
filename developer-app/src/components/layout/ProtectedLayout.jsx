import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Ticket, LogOut, Code2, Menu, X, LibraryBig, ImagePlus, Clapperboard, LayoutPanelTop } from 'lucide-react';
import { auth } from '../../lib/firebase';

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
        { icon: ImagePlus, label: 'Portal Logo Library', path: '/portal-logo-library' },
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
            <aside className={`fixed top-0 left-0 z-50 h-screen w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>

                {/* Brand Header */}
                <div className="h-20 flex items-center justify-between px-6 border-b border-slate-800">
                    <div className="flex items-center gap-3 text-white">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                            <Code2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="font-black tracking-wide text-sm leading-tight">ACIS Core</h1>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Dev Portal</p>
                        </div>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                {/* Navigation */}
                <div className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
                    {menuItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                onClick={() => setIsOpen(false)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-bold ${isActive
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                        : 'hover:bg-slate-800 hover:text-white'
                                    }`}
                            >
                                <item.icon className="w-5 h-5" />
                                {item.label}
                            </NavLink>
                        )
                    })}
                </div>

                {/* User Profile & Logout */}
                <div className="p-4 border-t border-slate-800">
                    <div className="flex items-center justify-between px-2 py-3">
                        <div className="truncate pr-4">
                            <p className="text-sm font-bold text-white truncate">{user?.telegram || 'Developer'}</p>
                            <p className="text-[10px] uppercase tracking-widest text-slate-500">{user?.role || 'Admin'}</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            title="Sign Out"
                            className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-rose-500/10 hover:text-rose-500 flex items-center justify-center transition-colors flex-shrink-0"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
};

export const ProtectedLayout = ({ children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row font-sans selection:bg-blue-200">
            {/* Mobile Top Navbar */}
            <div className="lg:hidden h-16 bg-slate-900 flex items-center px-4 justify-between sticky top-0 z-30 shadow-md">
                <div className="flex items-center gap-2 text-white">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                        <Code2 className="w-5 h-5" />
                    </div>
                    <h1 className="font-black text-sm tracking-widest">ACIS DEV</h1>
                </div>
                <button
                    onClick={() => setSidebarOpen(true)}
                    className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
                >
                    <Menu size={24} />
                </button>
            </div>

            <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

            <main className="flex-1 lg:ml-64 p-4 md:p-6 lg:p-8 overflow-y-auto">
                <div className="max-w-6xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
};
