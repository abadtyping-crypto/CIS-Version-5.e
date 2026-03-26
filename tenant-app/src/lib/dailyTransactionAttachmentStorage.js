import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from './firebaseConfig';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PDF_TYPE = 'application/pdf';
const ALLOWED_TYPES = new Set([...IMAGE_TYPES, PDF_TYPE]);
const MAX_IMAGE_UPLOAD_BYTES = 6 * 1024 * 1024;
const MAX_PDF_UPLOAD_BYTES = 20 * 1024 * 1024;
const TARGET_IMAGE_BYTES = 120 * 1024;

export const DAILY_TX_ATTACHMENT_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';

const sanitizeFilename = (value, fallback = 'attachment') => {
  const base = String(value || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '');
  return base || fallback;
};

const makeAttachmentId = () => `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const extractStoragePathFromUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    const marker = '/o/';
    const index = parsed.pathname.indexOf(marker);
    if (index < 0) return null;
    return decodeURIComponent(parsed.pathname.slice(index + marker.length));
  } catch {
    return null;
  }
};

const imageFromBlob = (blob) =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Unable to read image file.'));
    };
    image.src = objectUrl;
  });

const canvasToBlob = (canvas, quality = 0.84) =>
  new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/webp', quality);
  });

const compressImageIfNeeded = async (file) => {
  if (!IMAGE_TYPES.has(file.type)) {
    return {
      ok: true,
      blob: file,
      mimeType: file.type,
      filename: file.name,
      compressed: false,
    };
  }

  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    return { ok: false, error: 'Image is too large. Use an image under 6 MB.' };
  }

  const image = await imageFromBlob(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return { ok: false, error: 'Unable to prepare image compression.' };

  const maxSide = 1800;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  let bestBlob = null;
  const qualities = [0.9, 0.84, 0.76, 0.68, 0.6, 0.52];
  for (const quality of qualities) {
    const maybeBlob = await canvasToBlob(canvas, quality);
    if (!maybeBlob) continue;
    bestBlob = maybeBlob;
    if (maybeBlob.size <= TARGET_IMAGE_BYTES) break;
  }

  if (!bestBlob) {
    return { ok: false, error: 'Failed to compress image.' };
  }

  const rootName = sanitizeFilename(file.name.replace(/\.[^.]+$/, ''), 'image');
  return {
    ok: true,
    blob: bestBlob,
    mimeType: 'image/webp',
    filename: `${rootName}.webp`,
    compressed: true,
  };
};

const passthroughFile = (file) => ({
  ok: true,
  blob: file,
  mimeType: file.type || 'application/octet-stream',
  filename: sanitizeFilename(file.name, 'attachment'),
  compressed: false,
});

export const validateDailyTransactionAttachmentFile = (file) => {
  if (!file) return 'No file selected.';
  if (!ALLOWED_TYPES.has(file.type)) {
    return 'Unsupported file type. Only JPG, PNG, WEBP, and PDF are allowed in this pass.';
  }
  if (IMAGE_TYPES.has(file.type) && file.size > MAX_IMAGE_UPLOAD_BYTES) {
    return 'Image is too large. Use an image under 6 MB.';
  }
  if (file.type === PDF_TYPE && file.size > MAX_PDF_UPLOAD_BYTES) {
    return 'PDF is too large. Use a PDF under 20 MB.';
  }
  return '';
};

export const prepareDailyTransactionAttachment = async (file) => {
  if (!file) return { ok: false, error: 'No file selected.' };
  const validationError = validateDailyTransactionAttachmentFile(file);
  if (validationError) return { ok: false, error: validationError };
  if (file.type === PDF_TYPE) return passthroughFile(file);
  if (IMAGE_TYPES.has(file.type)) return compressImageIfNeeded(file);
  return { ok: false, error: 'Unsupported file type.' };
};

export const uploadDailyTransactionAttachment = async ({
  tenantId,
  transactionId,
  file,
  documentType = 'general',
}) => {
  try {
    if (!tenantId || !transactionId || !file) {
      return { ok: false, error: 'Missing upload context.' };
    }

    const prepared = await prepareDailyTransactionAttachment(file);
    if (!prepared.ok) return prepared;

    const attachmentId = makeAttachmentId();
    const safeName = sanitizeFilename(prepared.filename || file.name, 'attachment');
    const path = `tenants/${tenantId}/dailyTransactionAttachments/${transactionId}/${attachmentId}_${safeName}`;
    const storageRef = ref(storage, path);

    await uploadBytes(storageRef, prepared.blob, {
      contentType: prepared.mimeType,
      customMetadata: {
        tenantId: String(tenantId),
        transactionId: String(transactionId),
        documentType: String(documentType || 'general'),
      },
    });

    const downloadUrl = await getDownloadURL(storageRef);

    return {
      ok: true,
      metadata: {
        attachmentId,
        name: safeName,
        originalName: String(file.name || safeName),
        mimeType: prepared.mimeType,
        size: Number(prepared.blob.size || file.size || 0),
        storagePath: path,
        downloadUrl,
        uploadStatus: 'uploaded',
        documentType: String(documentType || 'general'),
        parseStatus: 'pending',
        parsedFields: {},
        ocrRequired: prepared.mimeType.startsWith('image/') || prepared.mimeType === PDF_TYPE,
      },
    };
  } catch (error) {
    return { ok: false, error: error?.message || 'Attachment upload failed.' };
  }
};

export const deleteDailyTransactionAttachmentByPath = async (storagePath) => {
  try {
    if (!storagePath) return { ok: true };
    await deleteObject(ref(storage, storagePath));
    return { ok: true };
  } catch {
    return { ok: false };
  }
};

export const deleteDailyTransactionAttachmentByUrl = async (downloadUrl) => {
  const path = extractStoragePathFromUrl(downloadUrl);
  if (!path) return { ok: false };
  return deleteDailyTransactionAttachmentByPath(path);
};

export const rollbackDailyTransactionAttachments = async (attachments = []) => {
  const normalized = Array.isArray(attachments) ? attachments : [];
  if (!normalized.length) return;
  await Promise.allSettled(
    normalized.map((item) => {
      const storagePath = String(item?.storagePath || '').trim();
      if (storagePath) return deleteDailyTransactionAttachmentByPath(storagePath);
      const downloadUrl = String(item?.downloadUrl || '').trim();
      return deleteDailyTransactionAttachmentByUrl(downloadUrl);
    }),
  );
};
