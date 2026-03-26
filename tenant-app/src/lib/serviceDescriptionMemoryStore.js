const STORE_KEY = 'acis_service_description_memory_v1';

const normalizeDescription = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ');

const normalizeStore = (raw) => {
  if (!raw || typeof raw !== 'object') return {};
  return raw;
};

const readStore = () => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    return normalizeStore(JSON.parse(raw));
  } catch {
    return {};
  }
};

const writeStore = (store) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORE_KEY, JSON.stringify(normalizeStore(store)));
};

const tenantNode = (store, tenantId) => {
  const key = String(tenantId || '').trim();
  if (!key) {
    return {
      rememberEnabled: true,
      byServiceId: {},
    };
  }
  const current = store[key];
  if (current && typeof current === 'object') {
    return {
      rememberEnabled: current.rememberEnabled !== false,
      byServiceId: current.byServiceId && typeof current.byServiceId === 'object' ? current.byServiceId : {},
    };
  }
  return {
    rememberEnabled: true,
    byServiceId: {},
  };
};

export const getRememberDescriptionPreference = (tenantId) => {
  const store = readStore();
  const node = tenantNode(store, tenantId);
  return node.rememberEnabled !== false;
};

export const setRememberDescriptionPreference = (tenantId, enabled) => {
  const key = String(tenantId || '').trim();
  if (!key) return;
  const store = readStore();
  const node = tenantNode(store, key);
  store[key] = {
    ...node,
    rememberEnabled: Boolean(enabled),
  };
  writeStore(store);
};

export const getRememberedServiceDescription = (tenantId, serviceId) => {
  const key = String(serviceId || '').trim();
  if (!key) return '';
  const store = readStore();
  const node = tenantNode(store, tenantId);
  return normalizeDescription(node.byServiceId[key] || '');
};

export const saveRememberedServiceDescription = (tenantId, serviceId, description) => {
  const tenantKey = String(tenantId || '').trim();
  const serviceKey = String(serviceId || '').trim();
  if (!tenantKey || !serviceKey) return;

  const nextDescription = normalizeDescription(description);
  const store = readStore();
  const node = tenantNode(store, tenantKey);
  const nextByServiceId = { ...(node.byServiceId || {}) };
  if (nextDescription) {
    nextByServiceId[serviceKey] = nextDescription;
  } else {
    delete nextByServiceId[serviceKey];
  }
  store[tenantKey] = {
    ...node,
    byServiceId: nextByServiceId,
  };
  writeStore(store);
};
