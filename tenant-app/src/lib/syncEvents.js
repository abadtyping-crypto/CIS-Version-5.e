const toIsoNow = () => new Date().toISOString();

export const createSyncEvent = async (payload) => ({
  eventId: null,
  tenantId: String(payload?.tenantId || '').trim(),
  eventType: String(payload?.eventType || '').trim(),
  entityType: String(payload?.entityType || '').trim(),
  entityId: String(payload?.entityId || '').trim(),
  changedFields: Array.isArray(payload?.changedFields) ? payload.changedFields : [],
  createdAt: toIsoNow(),
  createdBy: String(payload?.createdBy || '').trim(),
  syncStatus: 'disabled',
  backendSynced: false,
  backendError: null,
});

export const getSyncEventsByTenant = () => [];
