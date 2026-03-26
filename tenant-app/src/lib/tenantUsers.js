import {
  deleteTenantUserMap,
  fetchTenantUsersMap,
  upsertTenantUserMap,
} from './backendStore';
const TENANT_USERS_KEY = 'acis_tenant_users_v1';

const readStore = () => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(TENANT_USERS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeStore = (store) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TENANT_USERS_KEY, JSON.stringify(store));
};

const toUidFromEmail = (email) => {
  const base = String(email || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 18);
  return `usr_${base}_${Date.now().toString(36)}`;
};

export const getTenantUsers = (tenantId) => {
  const store = readStore();
  const users = store[tenantId];
  return Array.isArray(users) ? users : [];
};

export const fetchTenantUsersFromBackend = async (tenantId) => {
  const backend = await fetchTenantUsersMap(tenantId);
  if (!backend.ok) return getTenantUsers(tenantId);
  const normalized = backend.rows.map((item) => ({
    uid: item.uid,
    displayName: item.displayName,
    email: item.email,
    photoURL: item.photoURL || '',
    mobile: item.mobile || '',
    role: item.role || 'Staff',
    status: item.status || 'Invited',
    createdBy: item.createdBy || '',
    createdAt: item.createdAt || null,
  }));
  const store = readStore();
  store[tenantId] = normalized;
  writeStore(store);
  return normalized;
};

export const addTenantUser = (tenantId, payload) => {
  const store = readStore();
  const current = Array.isArray(store[tenantId]) ? store[tenantId] : [];
  const nextUser = {
    uid: toUidFromEmail(payload.email),
    displayName: payload.displayName,
    email: payload.email,
    photoURL: payload.photoURL || '',
    mobile: payload.mobile || '',
    role: payload.role,
    status: payload.status || 'Invited',
    createdBy: payload.createdBy,
    createdAt: new Date().toISOString(),
  };
  const next = [nextUser, ...current];
  store[tenantId] = next;
  writeStore(store);
  void upsertTenantUserMap(tenantId, nextUser.uid, nextUser);
  return next;
};

export const toggleTenantUserFreeze = (tenantId, uid) => {
  const store = readStore();
  const current = Array.isArray(store[tenantId]) ? store[tenantId] : [];
  const next = current.map((item) =>
    item.uid === uid
      ? {
          ...item,
          status: String(item.status || '').toLowerCase() === 'frozen' ? 'Active' : 'Frozen',
          updatedAt: new Date().toISOString(),
        }
      : item,
  );
  store[tenantId] = next;
  writeStore(store);
  const changed = next.find((item) => item.uid === uid);
  if (changed) {
    void upsertTenantUserMap(tenantId, uid, changed);
  }
  return next;
};

export const deleteTenantUser = (tenantId, uid) => {
  const store = readStore();
  const current = Array.isArray(store[tenantId]) ? store[tenantId] : [];
  const next = current.filter((item) => item.uid !== uid);
  store[tenantId] = next;
  writeStore(store);
  void deleteTenantUserMap(tenantId, uid);
  return next;
};
