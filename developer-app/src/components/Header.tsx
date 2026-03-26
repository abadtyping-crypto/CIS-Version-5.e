import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useLedger } from '../hooks/useLedger';
import { Wallet } from 'lucide-react';

interface HeaderProps {
    tenantId: string;
}

export const Header: React.FC<HeaderProps> = ({ tenantId }) => {
    const [tenantName, setTenantName] = useState<string>('Loading...');
    const { balance } = useLedger(tenantId);

    useEffect(() => {
        const resolveTenantName = async () => {
            if (!tenantId) {
                setTenantName('No Tenant selected');
                return;
            }
            try {
                // Task 1 Resolution: Resolve names via UID lookups instead of storing them
                const tenantDoc = await getDoc(doc(db, 'tenants', tenantId));
                if (tenantDoc.exists()) {
                    setTenantName(tenantDoc.data().name || tenantId);
                } else {
                    setTenantName(tenantId);
                }
            } catch (error) {
                console.error('Error resolving tenant name:', error);
                setTenantName(tenantId || 'Unknown');
            }
        };

        resolveTenantName();
    }, [tenantId]);

    // Law of Currency: Ensure it is formatted as AED {balance} (hardcoded)
    // Task 2: Default to AED 0 if balance is undefined
    const displayBalance = balance !== undefined ? balance.toLocaleString() : '0';

    return (
        <div className="flex justify-between items-end pb-4 border-b border-slate-200 mb-6">
            <div>
                <h1 className="text-3xl font-black text-slate-800 tracking-tight">
                    {tenantName}
                </h1>
                <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">
                    Tenant Dashboard • {tenantId}
                </p>
            </div>

            <div className="flex items-center gap-4 bg-white border border-slate-100 shadow-sm px-5 py-3 rounded-2xl">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                    <Wallet className="w-5 h-5" />
                </div>
                <div>
                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Available Ledger</p>
                    <p className="text-lg font-black text-slate-800">
                        AED {displayBalance}
                    </p>
                </div>
            </div>
        </div>
    );
};
