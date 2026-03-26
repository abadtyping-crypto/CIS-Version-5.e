import {
  collection,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebaseConfig';

const toSafeError = (error) => {
  if (!error) return 'unknown';
  if (typeof error === 'string') return error;
  if (error.message) return error.message;
  return 'unknown';
};

/**
 * Writes a new support ticket to /supportTickets
 * Called by Ayman Bot when a user reports an issue.
 */
export const submitSupportTicket = async ({
  tenantId,
  uid,
  displayName,
  category,
  description,
  priorityLevel = 'medium',
}) => {
  try {
    const docRef = await addDoc(collection(db, 'supportTickets'), {
      tenantId: String(tenantId || ''),
      uid: String(uid || ''),
      displayName: String(displayName || 'Unknown User'),
      category: String(category || 'other'),
      description: String(description || ''),
      priorityLevel: String(priorityLevel || 'medium'),
      status: 'open',
      screenshotUrls: [],
      source: 'ayman_bot',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { ok: true, ticketId: docRef.id };
  } catch (error) {
    const message = toSafeError(error);
    console.warn('[ticketStore] submitSupportTicket failed:', message);
    return { ok: false, error: message };
  }
};
