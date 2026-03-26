import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebaseConfig';

const toSafeError = (error) => {
  if (!error) return 'unknown';
  if (typeof error === 'string') return error;
  if (error.message) return error.message;
  return 'unknown';
};

const GLOBAL_CACHE_TTL_MS = 60 * 1000;
let globalPortalLogoCache = {
  updatedAt: 0,
  rows: [],
};

export const fetchAllGlobalPortalLogos = async ({ includeInactive = false, force = false } = {}) => {
  try {
    const isCacheFresh = Date.now() - globalPortalLogoCache.updatedAt < GLOBAL_CACHE_TTL_MS;
    if (!force && isCacheFresh && Array.isArray(globalPortalLogoCache.rows)) {
      const cachedRows = includeInactive
        ? globalPortalLogoCache.rows
        : globalPortalLogoCache.rows.filter((row) => row.isActive !== false);
      return { ok: true, rows: cachedRows };
    }

    const snap = await getDocs(collection(db, 'acis_global_portal_logos'));
    const rows = snap.docs
      .map((item) => ({ logoId: item.id, ...item.data() }))
      .sort((a, b) => String(a.logoName || '').localeCompare(String(b.logoName || ''), undefined, { sensitivity: 'base' }));

    globalPortalLogoCache = {
      updatedAt: Date.now(),
      rows,
    };

    const filteredRows = includeInactive ? rows : rows.filter((row) => row.isActive !== false);
    return { ok: true, rows: filteredRows };
  } catch (error) {
    const message = toSafeError(error);
    console.warn(`[portalLogoLibraryStore] fetch global portal logos failed: ${message}`);
    return { ok: false, error: message, rows: [] };
  }
};

export const fetchGlobalPortalLogoMap = async ({ includeInactive = true, force = false } = {}) => {
  const res = await fetchAllGlobalPortalLogos({ includeInactive, force });
  if (!res.ok) return { ok: false, error: res.error, map: {} };

  const map = {};
  (res.rows || []).forEach((item) => {
    if (!item?.logoId) return;
    map[item.logoId] = item;
  });
  return { ok: true, map };
};

