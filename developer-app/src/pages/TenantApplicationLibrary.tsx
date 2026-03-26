import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { PackageOpen, AlertCircle } from 'lucide-react';

export const TenantApplicationLibrary = () => {
    const { tenantId } = useParams<{ tenantId: string }>();
    const [apps, setApps] = useState<any[] | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        const fetchApps = async () => {
            if (!tenantId) {
                setLoading(false);
                return;
            }
            try {
                // Rule 4.1: UID Only - shell must only pass the tenantId.
                const tenantDoc = await getDoc(doc(db, 'tenants', tenantId));
                if (tenantDoc.exists()) {
                    const data = tenantDoc.data();
                    // Rule 4.2: No Placeholders - check if apps exist. 
                    // Do NOT write [] to Firestore if empty, just handle it in UI as "Null State".
                    setApps(data.activeApps || null);
                } else {
                    setApps(null);
                }
            } catch (err) {
                console.error('Error loading apps:', err);
                setApps(null);
            } finally {
                setLoading(false);
            }
        };

        fetchApps();
    }, [tenantId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20 animate-pulse">
                <div className="text-sm font-black uppercase tracking-widest text-slate-400">Loading Library...</div>
            </div>
        );
    }

    if (!apps || apps.length === 0) {
        // Rule 4.2: Null State UI
        return (
            <div className="flex flex-col items-center justify-center p-20 border-2 border-dashed border-slate-200 rounded-[2.5rem] bg-slate-50">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 mb-4 animate-bounce duration-[3s]">
                    <PackageOpen className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Library Empty</h3>
                <p className="text-sm font-medium text-slate-500 mt-1 max-w-xs text-center">
                    This tenant currently has no active applications initialized in their library.
                </p>
                <div className="mt-8 flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-100 rounded-xl">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-700">Null State Enforcement Active</span>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Active Applications</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {apps.map((appId) => (
                    <div key={appId} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                        <div className="h-12 w-12 rounded-2xl bg-slate-50 mb-4" />
                        <p className="font-black text-slate-800 uppercase tracking-widest text-xs">App ID</p>
                        <p className="text-sm font-bold text-slate-500 mt-1">{appId}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};
