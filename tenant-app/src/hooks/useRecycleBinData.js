import { useState, useCallback, useEffect } from 'react';
import { fetchDeletedEntities, restoreEntity as restoreBackend, permanentlyDeleteEntity as deleteBackend } from '../lib/backendStore';
import { createSyncEvent } from '../lib/syncEvents';

export const useRecycleBinData = (tenantId, domain, createdBy) => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const refresh = useCallback(async () => {
        if (!tenantId || !domain) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetchDeletedEntities(tenantId, domain);
            if (res.ok) {
                setData(res.rows);
            } else {
                setError(res.error);
            }
        } finally {
            setLoading(false);
        }
    }, [tenantId, domain]);

    useEffect(() => {
        let isMounted = true;
        const load = async () => {
            if (isMounted) await refresh();
        };
        load();
        return () => { isMounted = false; };
    }, [refresh]);

    const restoreItem = async (itemId) => {
        const res = await restoreBackend(tenantId, domain, itemId, createdBy || 'system');
        if (res.ok) {
            await createSyncEvent({
                tenantId,
                eventType: 'restore',
                entityType: domain,
                entityId: itemId,
                changedFields: ['deletedAt', 'deletedBy'],
                createdBy: createdBy || 'system',
            });
        }
        if (res.ok) await refresh();
        return res;
    };

    const deleteItemPermanently = async (itemId) => {
        const res = await deleteBackend(tenantId, domain, itemId);
        if (res.ok) {
            await createSyncEvent({
                tenantId,
                eventType: 'deletePermanent',
                entityType: domain,
                entityId: itemId,
                changedFields: [],
                createdBy: createdBy || 'system',
            });
        }
        if (res.ok) await refresh();
        return res;
    };

    return { data, loading, error, refresh, restoreItem, deleteItemPermanently };
};
