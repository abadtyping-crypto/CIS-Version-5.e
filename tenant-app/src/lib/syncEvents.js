import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebaseConfig';

const toSafeString = (value) => String(value || '').trim();

export const createSyncEvent = async (payload) => {
  try {
    const tenantId = toSafeString(payload?.tenantId);
    const createdBy = toSafeString(payload?.createdBy);
    const eventType = toSafeString(payload?.eventType);
    const entityType = toSafeString(payload?.entityType);
    const entityId = toSafeString(payload?.entityId);
    const changedFields = Array.isArray(payload?.changedFields)
      ? payload.changedFields.map(toSafeString).filter(Boolean)
      : [];

    if (!tenantId || !createdBy || !eventType || !entityType || !entityId) {
      return { ok: false, error: 'Missing required sync event fields.' };
    }

    const eventRef = await addDoc(collection(db, 'tenants', tenantId, 'syncEvents'), {
      tenantId,
      eventType,
      entityType,
      entityId,
      changedFields,
      createdAt: serverTimestamp(),
      createdBy,
      syncStatus: 'pending',
    });

    return { ok: true, eventId: eventRef.id };
  } catch (error) {
    const message = error?.message || 'Sync event write failed.';
    console.warn(`[syncEvents] create failed: ${message}`);
    return { ok: false, error: message };
  }
};

export const getSyncEventsByTenant = () => [];
