import { collection, doc, getDocs, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { toSafeError } from './workflowStore'; // reuse error helper

/**
 * Universal Library Metadata Service
 * Records document metadata for both Cloud (Sync) and Local (Electron OCR) files.
 */

export const recordDocumentMetadata = async (tenantId, documentId, payload) => {
  try {
    const ref = doc(db, 'tenants', tenantId, 'library', documentId);
    await setDoc(ref, {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return { ok: true, documentId };
  } catch (error) {
    return { ok: false, error: toSafeError(error) };
  }
};

export const fetchClientDocuments = async (tenantId, clientId) => {
  try {
    const q = query(
      collection(db, 'tenants', tenantId, 'library'),
      where('clientId', '==', clientId),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return { ok: true, rows: snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) };
  } catch (error) {
    return { ok: false, error: toSafeError(error), rows: [] };
  }
};

/**
 * Electron Bridge Interface for Local Library Handling
 */
export const openLocalFile = async (localPath) => {
  if (window.electron?.shell?.openPath) {
    try {
      await window.electron.shell.openPath(localPath);
      return { ok: true };
    } catch (error) {
       return { ok: false, error: error.message };
    }
  }
  return { ok: false, error: 'Electron shell bridge not available.' };
};
