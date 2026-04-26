import {
  fetchTenantUserControlMap,
  upsertTenantUserControlMap,
} from './backendStore';
const STORE_KEY = 'acis_user_control_prefs_v1';

const ACTION_KEYS = [
  'createClient',
  'notifyCreateClient',
  'createPortal',
  'notifyCreatePortal',
  'extendQuotation',
  'cancelQuotation',
  'directBalanceAdjust',
  'notifyDirectBalanceAdjust',
  'loanManagement',
  'notifyLoanManagement',
  'internalTransfer',
  'notifyInternalTransfer',
  'pdfStudioView',
  'pdfStudioEdit',
  'softDeleteTransaction',
  'notifySoftDeleteTransaction',
  'hardDeleteTransaction',
  'recordDailyTransaction',
];

const defaultRolePermissions = {
  'super admin': {
    createClient: true,
    notifyCreateClient: true,
    createPortal: true,
    notifyCreatePortal: true,
    extendQuotation: true,
    cancelQuotation: true,
    directBalanceAdjust: true,
    notifyDirectBalanceAdjust: true,
    loanManagement: true,
    notifyLoanManagement: true,
    internalTransfer: true,
    notifyInternalTransfer: true,
    pdfStudioView: true,
    pdfStudioEdit: true,
    softDeleteTransaction: true,
    notifySoftDeleteTransaction: true,
    hardDeleteTransaction: true,
    recordDailyTransaction: true,
  },
  staff: {
    createClient: true,
    notifyCreateClient: true,
    createPortal: false,
    notifyCreatePortal: false,
    extendQuotation: true,
    cancelQuotation: true,
    directBalanceAdjust: false,
    notifyDirectBalanceAdjust: false,
    loanManagement: false,
    notifyLoanManagement: false,
    internalTransfer: true,
    notifyInternalTransfer: true,
    pdfStudioView: false,
    pdfStudioEdit: false,
    softDeleteTransaction: true,
    notifySoftDeleteTransaction: true,
    hardDeleteTransaction: false,
    recordDailyTransaction: true,
  },
  accountant: {
    createClient: true,
    notifyCreateClient: true,
    createPortal: false,
    notifyCreatePortal: true,
    extendQuotation: true,
    cancelQuotation: true,
    directBalanceAdjust: true,
    notifyDirectBalanceAdjust: true,
    loanManagement: true,
    notifyLoanManagement: true,
    internalTransfer: true,
    notifyInternalTransfer: true,
    pdfStudioView: false,
    pdfStudioEdit: false,
    softDeleteTransaction: true,
    notifySoftDeleteTransaction: true,
    hardDeleteTransaction: false,
    recordDailyTransaction: true,
  },
  manager: {
    createClient: true,
    notifyCreateClient: true,
    createPortal: false,
    notifyCreatePortal: true,
    extendQuotation: true,
    cancelQuotation: true,
    directBalanceAdjust: false,
    notifyDirectBalanceAdjust: true,
    loanManagement: true,
    notifyLoanManagement: true,
    internalTransfer: true,
    notifyInternalTransfer: true,
    pdfStudioView: true,
    pdfStudioEdit: true,
    softDeleteTransaction: true,
    notifySoftDeleteTransaction: true,
    hardDeleteTransaction: true,
    recordDailyTransaction: true,
  },
  admin: {
    createClient: true,
    notifyCreateClient: true,
    createPortal: true,
    notifyCreatePortal: true,
    extendQuotation: true,
    cancelQuotation: true,
    directBalanceAdjust: true,
    notifyDirectBalanceAdjust: true,
    loanManagement: true,
    notifyLoanManagement: true,
    internalTransfer: true,
    notifyInternalTransfer: true,
    pdfStudioView: true,
    pdfStudioEdit: true,
    softDeleteTransaction: true,
    notifySoftDeleteTransaction: true,
    hardDeleteTransaction: true,
    recordDailyTransaction: true,
  },
};

const defaultNotificationRules = {
  inApp: true,
  email: false,
  flash: true,
  events: {
    createClient: true,
    createPortal: true,
    directBalanceAdjust: true,
    loanManagement: true,
    internalTransfer: true,
    softDeleteTransaction: true,
    negativeClientBalance: true,
  },
  quietHoursEnabled: false,
  quietFrom: '22:00',
  quietTo: '07:00',
};

const readStore = () => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeStore = (store) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
};

const tenantNode = (store, tenantId) => {
  const current = store[tenantId];
  if (current && typeof current === 'object') return current;
  return {
    accessOverridesByUid: {},
    notificationRulesByUid: {},
  };
};

const roleKey = (role) => String(role || '').trim().toLowerCase();
export const getRoleDefaultPermissions = (role) => {
  const defaults = defaultRolePermissions[roleKey(role)] || defaultRolePermissions.staff;
  return { ...defaults };
};

export const getUserAccessOverrides = (tenantId, uid) => {
  const store = readStore();
  const node = tenantNode(store, tenantId);
  const overrides = node.accessOverridesByUid?.[uid];
  return overrides && typeof overrides === 'object' ? { ...overrides } : {};
};

export const fetchUserControlFromBackend = async (tenantId) => {
  const backend = await fetchTenantUserControlMap(tenantId);
  if (!backend.ok) return;
  const store = readStore();
  const node = tenantNode(store, tenantId);

  const accessOverridesByUid = {};
  const notificationRulesByUid = {};

  for (const row of backend.rows) {
    if (!row.uid) continue;
    accessOverridesByUid[row.uid] = row.accessOverrides || {};
    notificationRulesByUid[row.uid] = {
      ...defaultNotificationRules,
      ...(row.notificationRules || {}),
      events: {
        ...defaultNotificationRules.events,
        ...((row.notificationRules && row.notificationRules.events) || {}),
      },
    };
  }

  node.accessOverridesByUid = accessOverridesByUid;
  node.notificationRulesByUid = notificationRulesByUid;
  store[tenantId] = node;
  writeStore(store);
};

export const setUserAccessOverride = (tenantId, uid, actionKey, enabled) => {
  if (!ACTION_KEYS.includes(actionKey)) return getUserAccessOverrides(tenantId, uid);
  const store = readStore();
  const node = tenantNode(store, tenantId);
  const current = node.accessOverridesByUid?.[uid] || {};
  const next = { ...current, [actionKey]: Boolean(enabled) };
  node.accessOverridesByUid = { ...(node.accessOverridesByUid || {}), [uid]: next };
  store[tenantId] = node;
  writeStore(store);
  void upsertTenantUserControlMap(tenantId, uid, {
    accessOverrides: next,
    notificationRules: node.notificationRulesByUid?.[uid] || defaultNotificationRules,
  });
  return next;
};

export const clearUserAccessOverrides = (tenantId, uid) => {
  const store = readStore();
  const node = tenantNode(store, tenantId);
  const nextMap = { ...(node.accessOverridesByUid || {}) };
  delete nextMap[uid];
  node.accessOverridesByUid = nextMap;
  store[tenantId] = node;
  writeStore(store);
  void upsertTenantUserControlMap(tenantId, uid, {
    accessOverrides: {},
    notificationRules: node.notificationRulesByUid?.[uid] || defaultNotificationRules,
  });
  return {};
};

export const getEffectiveUserPermissions = (tenantId, user) => {
  const roleDefaults = getRoleDefaultPermissions(user?.role);
  const overrides = getUserAccessOverrides(tenantId, user?.uid);
  return { ...roleDefaults, ...overrides };
};

export const canUserPerformAction = (tenantId, user, actionKey) => {
  const effective = getEffectiveUserPermissions(tenantId, user);
  return effective[actionKey] === true;
};

export const getUserNotificationRules = (tenantId, uid) => {
  const store = readStore();
  const node = tenantNode(store, tenantId);
  const existing = node.notificationRulesByUid?.[uid];
  if (!existing || typeof existing !== 'object') return { ...defaultNotificationRules };
  return {
    ...defaultNotificationRules,
    ...existing,
    events: {
      ...defaultNotificationRules.events,
      ...(existing.events || {}),
    },
  };
};

export const saveUserNotificationRules = (tenantId, uid, rules) => {
  const store = readStore();
  const node = tenantNode(store, tenantId);
  const payload = {
    ...defaultNotificationRules,
    ...(rules || {}),
    events: {
      ...defaultNotificationRules.events,
      ...((rules && rules.events) || {}),
    },
  };
  node.notificationRulesByUid = { ...(node.notificationRulesByUid || {}), [uid]: payload };
  store[tenantId] = node;
  writeStore(store);
  void upsertTenantUserControlMap(tenantId, uid, {
    accessOverrides: node.accessOverridesByUid?.[uid] || {},
    notificationRules: payload,
  });
  return payload;
};

export const USER_ACCESS_ACTIONS = [
  { key: 'createClient', label: 'Create New Client' },
  { key: 'notifyCreateClient', label: 'Create New Client Notification' },
  { key: 'createPortal', label: 'Create New Portal' },
  { key: 'notifyCreatePortal', label: 'Create New Portal Notification' },
  { key: 'extendQuotation', label: 'Extend Quotation' },
  { key: 'cancelQuotation', label: 'Cancel Quotation' },
  { key: 'directBalanceAdjust', label: 'Direct Balance Adjustment' },
  { key: 'notifyDirectBalanceAdjust', label: 'Direct Balance Adjustment Notification' },
  { key: 'loanManagement', label: 'Loan Management' },
  { key: 'notifyLoanManagement', label: 'Loan Management Notification' },
  { key: 'internalTransfer', label: 'Internal Transfer' },
  { key: 'notifyInternalTransfer', label: 'Internal Transfer Notification' },
  { key: 'pdfStudioView', label: 'PDF Studio View Access' },
  { key: 'pdfStudioEdit', label: 'PDF Studio Edit Access' },
  { key: 'softDeleteTransaction', label: 'Soft Delete (Recycle Bin)' },
  { key: 'notifySoftDeleteTransaction', label: 'Soft Delete Notification' },
  { key: 'hardDeleteTransaction', label: 'Hard Delete (Permanent)' },
  { key: 'recordDailyTransaction', label: 'Record Daily Transaction' },
];

export const USER_NOTIFICATION_EVENTS = [
  { key: 'createClient', label: 'Create Client' },
  { key: 'createPortal', label: 'Create Portal' },
  { key: 'directBalanceAdjust', label: 'Direct Balance Adjustment' },
  { key: 'loanManagement', label: 'Loan Management' },
  { key: 'internalTransfer', label: 'Internal Transfer' },
  { key: 'softDeleteTransaction', label: 'Soft Delete Transaction' },
  { key: 'negativeClientBalance', label: 'Negative Client Balance Alert' },
];
