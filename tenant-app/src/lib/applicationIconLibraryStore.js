import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';

const toSafeError = (error) => {
  if (!error) return 'unknown';
  if (typeof error === 'string') return error;
  if (error.message) return error.message;
  return 'unknown';
};

const toIconsCollection = (tenantId) =>
  collection(db, 'tenants', tenantId, 'IconLibrary');

const toIconDoc = (tenantId, iconId) =>
  doc(db, 'tenants', tenantId, 'IconLibrary', iconId);

export const fetchApplicationIconLibrary = async (tenantId) => {
  try {
    const snap = await getDocs(toIconsCollection(tenantId));
    const rows = snap.docs
      .map((item) => ({ iconId: item.id, ...item.data() }))
      .sort((a, b) => String(a.iconName || '').localeCompare(String(b.iconName || ''), undefined, { sensitivity: 'base' }));
    return { ok: true, rows };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[applicationIconLibraryStore] read failed tenants/${tenantId}/IconLibrary: ${message}`);
    return { ok: false, error: message, rows: [] };
  }
};

export const fetchAllGlobalIcons = async () => {
    try {
        const snap = await getDocs(collection(db, 'acis_global_icons'));
        const rows = snap.docs.map((doc) => ({ iconId: doc.id, ...doc.data() }));
        return { ok: true, rows };
    } catch (error) {
        const message = toSafeError(error);
        console.warn(`[applicationIconLibraryStore] fetch global icons failed: ${message}`);
        return { ok: false, error: message, rows: [] };
    }
};

export const fetchMergedApplicationIconLibrary = async (tenantId) => {
    try {
        const baseRes = await fetchApplicationIconLibrary(tenantId);
        if (!baseRes.ok) return baseRes;

        const hasUniversal = baseRes.rows.some((r) => r.source === 'universal');
        if (!hasUniversal) return baseRes;

        const globalRes = await fetchAllGlobalIcons();
        if (!globalRes.ok) return baseRes;

        const globalMap = {};
        globalRes.rows.forEach(item => { globalMap[item.iconId] = item; });

        const finalRows = [];
        const universalIndexByKey = {};
        for (const row of baseRes.rows) {
            if (row.source === 'universal') {
                const resolvedGlobalIconId = String(row.globalIconId || row.iconId || '').trim();
                const globalIcon = globalMap[resolvedGlobalIconId];
                if (!globalIcon) continue; // Global icon was deleted

                const mergedRow = {
                    ...row,
                    iconId: String(row.iconId || resolvedGlobalIconId || '').trim(),
                    globalIconId: resolvedGlobalIconId,
                    iconName: globalIcon.iconName,
                    iconUrl: globalIcon.iconUrl,
                    _isUniversal: true,
                };

                const existingIndex = universalIndexByKey[resolvedGlobalIconId];
                if (existingIndex === undefined) {
                    universalIndexByKey[resolvedGlobalIconId] = finalRows.length;
                    finalRows.push(mergedRow);
                } else {
                    const existingRow = finalRows[existingIndex];
                    const shouldReplace =
                        String(mergedRow.iconId || '') === resolvedGlobalIconId
                        || (!existingRow?.iconId && Boolean(mergedRow.iconId));
                    if (shouldReplace) finalRows[existingIndex] = mergedRow;
                }
            } else {
                finalRows.push(row);
            }
        }
        
        finalRows.sort((a, b) => String(a.iconName || '').localeCompare(String(b.iconName || ''), undefined, { sensitivity: 'base' }));
        return { ok: true, rows: finalRows };
    } catch (error) {
        const message = toSafeError(error);
        console.warn(`[applicationIconLibraryStore] merge failed: ${message}`);
        return { ok: false, error: message, rows: [] };
    }
};

export const getApplicationIconById = async (tenantId, iconId) => {
  try {
    const snap = await getDoc(toIconDoc(tenantId, iconId));
    return { ok: true, exists: snap.exists(), data: snap.exists() ? { iconId: snap.id, ...snap.data() } : null };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[applicationIconLibraryStore] get failed tenants/${tenantId}/IconLibrary/${iconId}: ${message}`);
    return { ok: false, exists: false, error: message, data: null };
  }
};

export const upsertApplicationIcon = async (tenantId, iconId, payload, options = {}) => {
  try {
    const data = { ...payload };
    if (options.isCreate) {
      data.createdAt = serverTimestamp();
      delete data.updatedAt;
      delete data.updatedBy;
    } else {
      data.updatedAt = serverTimestamp();
    }
    await setDoc(toIconDoc(tenantId, iconId), data, { merge: true });
    return { ok: true };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[applicationIconLibraryStore] upsert failed tenants/${tenantId}/IconLibrary/${iconId}: ${message}`);
    return { ok: false, error: message };
  }
};

export const deleteApplicationIcon = async (tenantId, iconId) => {
  try {
    await deleteDoc(toIconDoc(tenantId, iconId));
    return { ok: true };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[applicationIconLibraryStore] delete failed tenants/${tenantId}/IconLibrary/${iconId}: ${message}`);
    return { ok: false, error: message };
  }
};
