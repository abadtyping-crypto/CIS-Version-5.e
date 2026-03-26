import {
    collection,
    deleteDoc,
    doc,
    getDocs,
    query,
    where,
    setDoc,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { toSafeDocId } from './idUtils';

const toSafeError = (error) => {
    if (!error) return 'unknown';
    if (typeof error === 'string') return error;
    if (error.message) return error.message;
    return 'unknown';
};

/**
 * Fetches all service templates for a tenant.
 * Templates include: name, govCharge, clientCharge, iconUrl, etc.
 */
export const fetchServiceTemplates = async (tenantId) => {
    try {
        if (!tenantId) return { ok: false, error: 'Missing tenantId', rows: [] };
        const [servicesSnap, legacySnap] = await Promise.all([
            getDocs(collection(db, 'tenants', tenantId, 'services')),
            getDocs(collection(db, 'tenants', tenantId, 'serviceTemplates')),
        ]);
        const byId = {};
        servicesSnap.docs.forEach((item) => {
            byId[item.id] = { id: item.id, ...item.data() };
        });
        legacySnap.docs.forEach((item) => {
            if (!byId[item.id]) byId[item.id] = { id: item.id, ...item.data() };
        });
        const rows = Object.values(byId);
        return { ok: true, rows };
    } catch (error) {
        const message = toSafeError(error);
        console.warn(`[serviceTemplateStore] read failed tenants/${tenantId}/services: ${message}`);
        return { ok: false, error: message, rows: [] };
    }
};

/**
 * Fetches all global applications that are active.
 */
export const fetchAllGlobalApplications = async () => {
    try {
        const [appsSnap, iconsSnap] = await Promise.all([
            getDocs(query(collection(db, 'acis_global_applications'), where('isActive', '==', true))),
            getDocs(collection(db, 'acis_global_icons')),
        ]);

        const iconMap = {};
        iconsSnap.forEach((item) => {
            iconMap[item.id] = { id: item.id, ...item.data() };
        });

        const rows = appsSnap.docs.map((item) => {
            const data = item.data() || {};
            const resolvedIconId = String(data.iconId || data.globalIconId || data.linkedIconId || '').trim();
            const resolvedIcon = iconMap[resolvedIconId] || null;
            return {
                id: item.id,
                ...data,
                iconId: resolvedIconId,
                globalIconId: resolvedIconId,
                iconName: resolvedIcon?.iconName || String(data.iconName || ''),
                iconUrl: resolvedIcon?.iconUrl || '',
            };
        });
        return { ok: true, rows };
    } catch (error) {
        const message = toSafeError(error);
        console.warn(`[serviceTemplateStore] fetch global apps failed: ${message}`);
        return { ok: false, error: message, rows: [] };
    }
};

/**
 * Fetches tenant service templates merged with live data from Universal Library.
 */
export const fetchMergedServiceTemplates = async (tenantId) => {
    try {
        const baseRes = await fetchServiceTemplates(tenantId);
        if (!baseRes.ok) return baseRes;

        const hasUniversal = baseRes.rows.some((r) => r.source === 'universal');
        if (!hasUniversal) return baseRes;

        const [globalAppsSnap, globalIconsSnap] = await Promise.all([
            getDocs(query(collection(db, 'acis_global_applications'), where('isActive', '==', true))),
            getDocs(collection(db, 'acis_global_icons')),
        ]);

        const appsMap = {};
        globalAppsSnap.forEach(item => appsMap[item.id] = { id: item.id, ...item.data() });
        const normalizeNameKey = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const appsByNameKey = {};
        Object.values(appsMap).forEach((app) => {
            const key = normalizeNameKey(app.appName || app.name || app.id);
            if (key && !appsByNameKey[key]) appsByNameKey[key] = app;
        });

        const iconsMap = {};
        globalIconsSnap.forEach(item => iconsMap[item.id] = { id: item.id, ...item.data() });

        const finalRows = [];
        const universalIndexByKey = {};
        for (const row of baseRes.rows) {
            if (row.source === 'universal') {
                const rowNameKey = normalizeNameKey(row.name || row.appName || row.id);
                const globalApp = appsMap[row.globalAppId] || appsByNameKey[rowNameKey];
                if (!globalApp) continue; // Skip if disabled globally or deleted

                const resolvedIconId = String(row.globalIconId || globalApp.iconId || globalApp.globalIconId || globalApp.linkedIconId || '').trim();
                const globalIcon = iconsMap[resolvedIconId] || {};
                const preferredId = toSafeDocId(String(globalApp.appName || globalApp.name || row.name || row.id || ''), 'svc_tpl');
                const mergedRow = {
                    ...row,
                    globalAppId: globalApp.id || row.globalAppId || '',
                    appName: globalApp.appName, 
                    name: globalApp.appName, // mapped alias to display on tenant UI
                    iconId: resolvedIconId || String(row.iconId || '').trim(),
                    globalIconId: resolvedIconId,
                    iconUrl: globalIcon.iconUrl,
                    iconName: globalIcon.iconName,
                    // Tenant-owned only: do not inherit description from global app library.
                    description: row.description || '',
                    _isUniversal: true,
                };

                const dedupeKey = row.globalAppId || normalizeNameKey(globalApp.appName || row.name || row.id);
                const existingIndex = universalIndexByKey[dedupeKey];
                if (existingIndex === undefined) {
                    universalIndexByKey[dedupeKey] = finalRows.length;
                    finalRows.push(mergedRow);
                } else {
                    const existingRow = finalRows[existingIndex];
                    const shouldReplace =
                        String(mergedRow.id || '') === preferredId ||
                        (!existingRow?.id && Boolean(mergedRow.id));
                    if (shouldReplace) finalRows[existingIndex] = mergedRow;
                }
            } else {
                finalRows.push(row);
            }
        }

        return { ok: true, rows: finalRows };
    } catch (error) {
        const message = toSafeError(error);
        return { ok: false, error: message, rows: [] };
    }
};

/**
 * Upserts a service template.
 */
export const upsertServiceTemplate = async (tenantId, templateId, payload) => {
    try {
        if (!tenantId || !templateId) return { ok: false, error: 'Missing tenantId or templateId' };
        await setDoc(doc(db, 'tenants', tenantId, 'services', templateId), {
            ...payload,
        }, { merge: true });
        return { ok: true };
    } catch (error) {
        const message = toSafeError(error);
        console.warn(`[serviceTemplateStore] upsert failed tenants/${tenantId}/services/${templateId}: ${message}`);
        return { ok: false, error: message };
    }
};

/**
 * Deletes a service template.
 */
export const deleteServiceTemplate = async (tenantId, templateId) => {
    try {
        if (!tenantId || !templateId) return { ok: false, error: 'Missing tenantId or templateId' };
        await deleteDoc(doc(db, 'tenants', tenantId, 'services', templateId));
        return { ok: true };
    } catch (error) {
        const message = toSafeError(error);
        console.warn(`[serviceTemplateStore] delete failed tenants/${tenantId}/services/${templateId}: ${message}`);
        return { ok: false, error: message };
    }
};
