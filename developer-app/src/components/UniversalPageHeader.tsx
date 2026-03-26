import React from 'react';
import { useTenantLookup } from '../hooks/useTenantLookup';
import { useLedger } from '../hooks/useLedger';
import { Wallet, Building2, LayoutDashboard, Globe } from 'lucide-react';

interface UniversalPageHeaderProps {
    tenantId: string;
}

export const UniversalPageHeader: React.FC<UniversalPageHeaderProps> = ({ tenantId }) => {
    const { data, loading } = useTenantLookup(tenantId);
    const { balance } = useLedger(tenantId);
    const hasIcon = Boolean(data?.iconUrl);

    // Law of Currency: Ensure it is formatted as AED {balance} (hardcoded)
    // Rule: balance key is lowercase
    const formattedBalance = balance !== undefined ? balance.toLocaleString() : '0';

    if (loading) {
        // Law of UIDs: Show a "Loading..." skeleton rather than requesting a string from page level
        return (
            <div className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-4 flex justify-between items-center animate-pulse">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-200 rounded-xl" />
                    <div className="space-y-2">
                        <div className="w-32 h-6 bg-slate-200 rounded" />
                        <div className="w-24 h-4 bg-slate-200 rounded" />
                    </div>
                </div>
                <div className="w-40 h-16 bg-slate-200 rounded-2xl" />
            </div>
        );
    }

    return (
        <header className="sticky top-0 z-50 w-full bg-white/90 backdrop-blur-md border-b border-slate-200/60 shadow-sm px-8 py-5 flex justify-between items-center transition-all">
            <div className="flex items-center gap-5">
                {/* Icon Logic: iconUrl resolved from tenant document. If null, use system-default */}
                <div
                    className={`relative w-14 h-14 rounded-2xl flex items-center justify-center overflow-hidden flex-shrink-0 group transition-colors ${hasIcon
                        ? 'bg-transparent border-0 shadow-none'
                        : 'bg-slate-100 border border-slate-200 shadow-inner hover:border-blue-200'
                        }`}
                >
                    {hasIcon ? (
                        <img
                            src={data?.iconUrl || ''}
                            alt="Logo"
                            className="absolute -inset-[8px] h-auto w-auto min-h-[calc(100%+16px)] min-w-[calc(100%+16px)] transform-gpu object-cover scale-[1.22]"
                            loading="lazy"
                        />
                    ) : (
                        <Building2 className="w-7 h-7 text-slate-400 group-hover:text-blue-500 transition-colors" />
                    )}
                </div>
                <div>
                    <div className="flex items-center gap-2 mb-0.5">
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                            {data?.displayName || 'Unknown Tenant'}
                        </h1>
                        <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-lg text-[10px] uppercase font-black tracking-widest border border-blue-100">
                            Active Shell
                        </span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-400">
                        <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest">
                            <LayoutDashboard size={12} className="text-slate-300" />
                            Overview
                        </div>
                        <div className="w-1 h-1 rounded-full bg-slate-300" />
                        <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest font-mono">
                            <Globe size={12} className="text-slate-300" />
                            {tenantId}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-6">
                <div className="flex flex-col items-end">
                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1 select-none">Tenant Available Funds</p>
                    <div className="flex items-center gap-3 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-800 ring-1 ring-white/5 group hover:scale-105 transition-all cursor-pointer">
                        <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-blue-400">
                            <Wallet className="w-4 h-4" />
                        </div>
                        <span className="text-xl font-black tracking-tighter">
                            AED {formattedBalance}
                        </span>
                    </div>
                </div>
            </div>
        </header>
    );
};
