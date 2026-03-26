import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from './firebaseConfig';

const MAX_ASSET_SIZE_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/png', 'image/svg+xml', 'image/jpeg', 'image/webp']);

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
    // Ignore delete failures so upload flow can continue.
  }
};

const fileExtFromName = (fileName) => {
  const parts = String(fileName || '').split('.');
  const ext = parts.length > 1 ? parts.pop() : '';
  return String(ext || 'bin').toLowerCase();
};

export const validatePdfTemplateAsset = (fileBlob) => {
  if (!fileBlob) return 'No file selected.';
  if (!IMAGE_TYPES.has(fileBlob.type)) return 'Only PNG, SVG, JPG, and WEBP are supported.';
  if (fileBlob.size > MAX_ASSET_SIZE_BYTES) return 'File is too large. Maximum size is 2 MB.';
  return '';
};

export const uploadPdfTemplateAsset = async ({
  tenantId,
  documentType,
  templateId,
  assetType,
  oldUrl,
  fileBlob,
}) => {
  try {
    if (!tenantId || !documentType || !templateId || !assetType || !fileBlob) {
      return { ok: false, error: 'Missing asset upload data.' };
    }

    const validationError = validatePdfTemplateAsset(fileBlob);
    if (validationError) return { ok: false, error: validationError };

    if (oldUrl && oldUrl.startsWith('https://firebasestorage.googleapis.com/')) {
      await safeDeleteByUrl(oldUrl);
    }

    const ext = fileExtFromName(fileBlob.name);
    const safeDocType = String(documentType).replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
    const safeTemplateId = String(templateId).replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
    const assetPath = `tenants/${tenantId}/pdfTemplates/${safeDocType}/${safeTemplateId}/${assetType}_${Date.now()}.${ext}`;
    const assetRef = ref(storage, assetPath);
    await uploadBytes(assetRef, fileBlob, { contentType: fileBlob.type || 'application/octet-stream' });
    const url = await getDownloadURL(assetRef);
    return { ok: true, url };
  } catch (error) {
    return { ok: false, error: error?.message || 'Asset upload failed.' };
  }
};

