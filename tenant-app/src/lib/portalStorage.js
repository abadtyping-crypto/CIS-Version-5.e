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
        // Ignore delete failures
    }
};

export const deletePortalIconByUrl = async (url) => {
    await safeDeleteByUrl(url);
};

export const uploadPortalIcon = async ({ tenantId, portalId, fileBlob, oldIconUrl }) => {
    try {
        if (!tenantId || !portalId || !fileBlob) {
            return { ok: false, error: 'Missing portal upload data.' };
        }

        if (oldIconUrl && oldIconUrl.startsWith('https://firebasestorage.googleapis.com/')) {
            await safeDeleteByUrl(oldIconUrl);
        }

        const iconPath = `tenants/${tenantId}/portals/icons/${portalId}_${Date.now()}.webp`;
        const iconRef = ref(storage, iconPath);
        await uploadBytes(iconRef, fileBlob, { contentType: 'image/webp' });
        const iconUrl = await getDownloadURL(iconRef);
        return { ok: true, iconUrl };
    } catch (error) {
        return { ok: false, error: error?.message || 'Portal icon upload failed.' };
    }
};
