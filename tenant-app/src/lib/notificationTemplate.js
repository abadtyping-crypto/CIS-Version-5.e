const toIsoNow = () => new Date().toISOString();

const DEFAULT_ACTION_PRESETS = {
  view: { label: 'View', actionType: 'link' },
  confirm: { label: 'Confirm', actionType: 'api' },
  delete: { label: 'Delete', actionType: 'api' },
  retrieve: { label: 'Retrieve', actionType: 'api' },
};

const normalizeArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

const toCode3 = (value, fallback = 'GEN') => {
  const clean = String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (!clean) return fallback;
  return `${clean}XXX`.slice(0, 3);
};

// Format: [TOPIC3][SUB3][LAST8_OF_TIMESTAMP]
// Example: settings + brand => SETBRA12345678
export const generateNotificationId = ({ topic = '', subTopic = '', at = Date.now() } = {}) => {
  const top = toCode3(topic, 'NTF');
  const sub = toCode3(subTopic, 'GEN');
  const stamp = String(Number(at) || Date.now()).replace(/\D/g, '').slice(-8).padStart(8, '0');
  return `${top}${sub}${stamp}`;
};

export const buildNotificationActions = ({ routePath = '', presets = [], actions = [] } = {}) => {
  const presetActions = normalizeArray(presets).map((presetKey) => {
    const key = String(presetKey || '').trim().toLowerCase();
    const preset = DEFAULT_ACTION_PRESETS[key];
    if (!preset) return null;
    return {
      ...preset,
      ...(preset.actionType === 'link' && routePath ? { route: routePath } : {}),
    };
  }).filter(Boolean);

  const customActions = normalizeArray(actions).map((action) => {
    if (!action || typeof action !== 'object') return null;
    const label = String(action.label || '').trim();
    const actionType = String(action.actionType || '').trim();
    if (!label || !actionType) return null;
    const normalized = { ...action, label, actionType };
    if (actionType === 'link' && !normalized.route && routePath) normalized.route = routePath;
    return normalized;
  }).filter(Boolean);

  return [...presetActions, ...customActions];
};

export const buildNotificationPayload = ({
  topic = 'system',
  subTopic = '',
  type = 'info',
  title = '',
  message = '',
  detail = '',
  createdBy = '',
  routePath = '',
  actionPresets = [],
  actions = [],
  extra = {},
} = {}) => {
  const resolvedMessage = String(message || detail || '').trim();
  const resolvedDetail = String(detail || message || '').trim();
  const payload = {
    topic: String(topic || '').trim() || 'system',
    subTopic: String(subTopic || '').trim(),
    type: String(type || '').trim() || 'info',
    title: String(title || '').trim() || 'Notification',
    message: resolvedMessage,
    detail: resolvedDetail,
    createdBy: String(createdBy || '').trim(),
    createdAt: toIsoNow(),
    ...extra,
  };

  const cleanRoutePath = String(routePath || '').trim();
  if (cleanRoutePath) payload.routePath = cleanRoutePath;

  const mergedActions = buildNotificationActions({
    routePath: cleanRoutePath,
    presets: actionPresets,
    actions,
  });
  if (mergedActions.length) payload.actions = mergedActions;

  return payload;
};
