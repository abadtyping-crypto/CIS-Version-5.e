import { collection, getDocs } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from './firebaseConfig';

const CACHE_KEY = 'acis-system-assets-cache-v1';
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;

let memoryCache = null;
let memoryExpiry = 0;
let inFlightPromise = null;

const isBrowser = typeof window !== 'undefined';

const normalizeSnapshot = (snapshot) => {
  const map = {};
  snapshot.docs.forEach((docSnap) => {
    map[docSnap.id] = docSnap.data();
  });
  return map;
};

const readStorageCache = () => {
  if (!isBrowser) return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.expiresAt || parsed.expiresAt < Date.now()) return null;
    if (!parsed.data || typeof parsed.data !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeStorageCache = (data) => {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        data,
        expiresAt: Date.now() + CACHE_TTL_MS,
      }),
    );
  } catch {
    // Ignore storage write errors silently.
  }
};

export const getCachedSystemAssetsSnapshot = () => {
  if (memoryCache && memoryExpiry > Date.now()) return memoryCache;
  const stored = readStorageCache();
  if (!stored) return {};
  memoryCache = stored.data;
  memoryExpiry = stored.expiresAt;
  return memoryCache;
};

export const getSystemAssets = async ({ forceRefresh = false } = {}) => {
  if (!forceRefresh) {
    const cached = getCachedSystemAssetsSnapshot();
    if (Object.keys(cached).length) return cached;
    if (inFlightPromise) return inFlightPromise;
  }

  inFlightPromise = getDocs(collection(db, 'acis_system_assets'))
    .then((snapshot) => {
      const normalized = normalizeSnapshot(snapshot);
      memoryCache = normalized;
      memoryExpiry = Date.now() + CACHE_TTL_MS;
      writeStorageCache(normalized);
      return normalized;
    })
    .finally(() => {
      inFlightPromise = null;
    });

  return inFlightPromise;
};

export const useSystemAssets = () => {
  const [assets, setAssets] = useState(() => getCachedSystemAssetsSnapshot());

  useEffect(() => {
    let active = true;
    getSystemAssets().then((snapshot) => {
      if (active) setAssets(snapshot);
    });
    return () => { active = false; };
  }, []);

  return assets;
};

export const resolveAssetWithVariation = (systemAssets = {}, assetId = '') => {
  if (!assetId) return '';
  
  // Check for global seasonal variation in electron_controller
  const variation = (systemAssets['electron_controller']?.systemIconVariation || 'default').toLowerCase();
  
  if (variation !== 'default') {
    const variationAssetId = `${assetId}_${variation}`;
    const variationUrl = String(systemAssets?.[variationAssetId]?.iconUrl || '').trim();
    if (variationUrl) return variationUrl;
  }

  // Fallback to default assetId
  return String(systemAssets?.[assetId]?.iconUrl || '').trim();
};
