import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export interface TenantData {
    uid: string;
    displayName: string;
    iconUrl?: string;
}

const tenantCache: Record<string, TenantData> = {};

export const useTenantLookup = (tenantId: string) => {
    const [data, setData] = useState<TenantData | null>(tenantCache[tenantId] || null);
    const [loading, setLoading] = useState<boolean>(!tenantCache[tenantId]);

    useEffect(() => {
        const fetchTenant = async () => {
            if (!tenantId) {
                setLoading(false);
                return;
            }
            if (tenantCache[tenantId]) {
                setData(tenantCache[tenantId]);
                setLoading(false);
                return;
            }

            try {
                // Rule: Resolve names via UID lookups instead of storing them at page level
                const snap = await getDoc(doc(db, 'tenants', tenantId));
                if (snap.exists()) {
                    const snapData = snap.data();
                    const resolved: TenantData = {
                        uid: tenantId,
                        displayName: snapData.name || tenantId,
                        iconUrl: snapData.logoUrl || null
                    };
                    tenantCache[tenantId] = resolved;
                    setData(resolved);
                } else {
                    setData({ uid: tenantId, displayName: tenantId });
                }
            } catch (err) {
                console.error('Error resolving tenant lookup:', err);
                setData({ uid: tenantId, displayName: tenantId });
            } finally {
                setLoading(false);
            }
        };

        fetchTenant();
    }, [tenantId]);

    return { data, loading };
};
