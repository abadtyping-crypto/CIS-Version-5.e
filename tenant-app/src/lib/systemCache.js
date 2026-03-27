import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { db } from './firebaseConfig';

const memoryCache = {
  clients: [],
};

const listeners = new Set();

export const subscribeToSystemCache = (tenantId, callback) => {
  if (!tenantId) return () => {};
  
  const q = query(
    collection(db, 'tenants', tenantId, 'clients'),
    where('deletedAt', '==', null)
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const clients = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    memoryCache.clients = clients;
    listeners.forEach(l => l(memoryCache));
    if (callback) callback(memoryCache);
  }, (error) => {
    console.warn(`[systemCache] sync failed for tenant ${tenantId}:`, error);
  });

  listeners.add(callback);
  return () => {
    listeners.delete(callback);
    unsubscribe();
  };
};


import { DEFAULT_PORTAL_ICON } from './transactionMethodConfig';

export const getSystemCacheSnapshot = () => memoryCache;

export const get = (key) => {
  if (key === 'default_portal_asset') return DEFAULT_PORTAL_ICON;
  return null;
};
