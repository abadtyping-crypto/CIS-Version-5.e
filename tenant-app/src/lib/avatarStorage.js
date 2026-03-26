import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from './firebaseConfig';

const extractStoragePathFromUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    const marker = '/o/';
    const index = parsed.pathname.indexOf(marker);
    if (index < 0) return null;
    const encodedPath = parsed.pathname.slice(index + marker.length);
    return decodeURIComponent(encodedPath);
  } catch {
    return null;
  }
};

const safeDeleteByUrl = async (url) => {
  const path = extractStoragePathFromUrl(url);
  if (!path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch {
    // Ignore delete failures so avatar replace flow can continue.
  }
};

export const replaceTenantAvatar = async ({ tenantId, uid, oldPhotoUrl, fileBlob }) => {
  try {
    if (!tenantId || !uid || !fileBlob) {
      return { ok: false, error: 'Missing avatar upload data.' };
    }

    if (oldPhotoUrl && oldPhotoUrl.startsWith('https://firebasestorage.googleapis.com/')) {
      await safeDeleteByUrl(oldPhotoUrl);
    }

    const avatarPath = `tenants/${tenantId}/avatars/${uid}_${Date.now()}.webp`;
    const avatarRef = ref(storage, avatarPath);
    await uploadBytes(avatarRef, fileBlob, { contentType: 'image/webp' });
    const photoURL = await getDownloadURL(avatarRef);
    return { ok: true, photoURL };
  } catch (error) {
    return { ok: false, error: error?.message || 'Avatar upload failed.' };
  }
};
