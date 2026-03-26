import { upsertTenantNotification } from './backendStore';
import { buildNotificationPayload, generateNotificationId } from './notificationTemplate';

const toCleanText = (value) => String(value || '').trim();

const normalizeQuickViewFields = (fields = []) =>
  (Array.isArray(fields) ? fields : [])
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const label = toCleanText(item.label);
      const value = toCleanText(item.value);
      if (!label && !value) return null;
      return { label, value };
    })
    .filter(Boolean);

const normalizeQuickViewSections = (sections = []) =>
  (Array.isArray(sections) ? sections : [])
    .map((section) => {
      if (!section || typeof section !== 'object') return null;
      const title = toCleanText(section.title);
      const description = toCleanText(section.description);
      const fields = normalizeQuickViewFields(section.fields);
      if (!title && !description && !fields.length) return null;
      return { title, description, fields };
    })
    .filter(Boolean);

export const buildQuickViewPayload = ({
  title = '',
  subtitle = '',
  description = '',
  imageUrl = '',
  badge = '',
  fields = [],
  sections = [],
} = {}) => {
  const payload = {
    title: toCleanText(title),
    subtitle: toCleanText(subtitle),
    description: toCleanText(description),
    imageUrl: toCleanText(imageUrl),
    badge: toCleanText(badge),
    fields: normalizeQuickViewFields(fields),
    sections: normalizeQuickViewSections(sections),
  };

  return {
    ...payload,
    hasContent: Boolean(
      payload.title ||
      payload.subtitle ||
      payload.description ||
      payload.imageUrl ||
      payload.badge ||
      payload.fields.length ||
      payload.sections.length
    ),
  };
};

export const buildUniversalNotificationDraft = ({
  topic = 'system',
  subTopic = '',
  type = 'info',
  title = '',
  message = '',
  detail = '',
  createdBy = '',
  routePath = '',
  entityType = '',
  entityId = '',
  entityLabel = '',
  pageKey = '',
  sectionKey = '',
  eventType = 'info',
  actionPresets = [],
  actions = [],
  quickView = null,
  extra = {},
} = {}) => {
  const normalizedQuickView = quickView ? buildQuickViewPayload(quickView) : null;
  const nextActions = Array.isArray(actions) ? [...actions] : [];

  if (normalizedQuickView?.hasContent && !nextActions.some((item) => String(item?.actionType || '').trim() === 'quickView')) {
    nextActions.unshift({ label: 'View Details', actionType: 'quickView' });
  }

  return {
    ...buildNotificationPayload({
      topic,
      subTopic,
      type,
      title,
      message,
      detail,
      createdBy,
      routePath,
      actionPresets,
      actions: nextActions,
      extra,
    }),
    eventType: toCleanText(eventType) || 'info',
    entityType: toCleanText(entityType),
    entityId: toCleanText(entityId),
    entityLabel: toCleanText(entityLabel),
    pageKey: toCleanText(pageKey),
    sectionKey: toCleanText(sectionKey),
    ...(normalizedQuickView?.hasContent ? { quickView: normalizedQuickView } : {}),
  };
};

export const sendUniversalNotification = async ({
  tenantId,
  notificationId,
  topic = 'system',
  subTopic = '',
  type = 'info',
  title = '',
  message = '',
  detail = '',
  createdBy = '',
  routePath = '',
  entityType = '',
  entityId = '',
  entityLabel = '',
  pageKey = '',
  sectionKey = '',
  eventType = 'info',
  actionPresets = [],
  actions = [],
  quickView = null,
  extra = {},
} = {}) => {
  if (!tenantId) return { ok: false, error: 'Missing tenantId.' };

  const finalNotificationId = toCleanText(notificationId) || generateNotificationId({ topic, subTopic });
  const payload = buildUniversalNotificationDraft({
    topic,
    subTopic,
    type,
    title,
    message,
    detail,
    createdBy,
    routePath,
    entityType,
    entityId,
    entityLabel,
    pageKey,
    sectionKey,
    eventType,
    actionPresets,
    actions,
    quickView,
    extra,
  });

  const writeRes = await upsertTenantNotification(tenantId, finalNotificationId, payload);
  if (!writeRes?.ok) return writeRes;

  return { ok: true, id: finalNotificationId, payload };
};
