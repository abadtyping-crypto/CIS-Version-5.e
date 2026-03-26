import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from './firebaseConfig';

const MAX_INPUT_BYTES = 5 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 450 * 1024;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

const loadImageFromBlob = (fileBlob) =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(fileBlob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Invalid image attachment.'));
    };
    image.src = objectUrl;
  });

const canvasToWebpBlob = (canvas, quality) =>
  new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/webp', quality);
  });

const compressToAttachmentWebp = async (fileBlob) => {
  const image = await loadImageFromBlob(fileBlob);
  const maxDim = 1600;
  const scale = Math.min(1, maxDim / Math.max(image.width || 1, image.height || 1));
  const width = Math.max(1, Math.round((image.width || 1) * scale));
  const height = Math.max(1, Math.round((image.height || 1) * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to process attachment image.');
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  let bestBlob = null;
  const qualities = [0.82, 0.72, 0.6, 0.52, 0.45];
  for (const quality of qualities) {
    const blob = await canvasToWebpBlob(canvas, quality);
    if (!blob) continue;
    bestBlob = blob;
    if (blob.size <= MAX_OUTPUT_BYTES) break;
  }

  if (!bestBlob) throw new Error('Unable to compress attachment image.');
  return bestBlob;
};

export const validateOperationExpenseAttachment = (fileBlob) => {
  if (!fileBlob) return '';
  if (!IMAGE_TYPES.has(String(fileBlob.type || '').toLowerCase())) {
    return 'Only PNG, JPG, and WEBP image attachments are supported in this phase.';
  }
  if (fileBlob.size > MAX_INPUT_BYTES) {
    return 'Attachment is too large. Maximum size is 5 MB.';
  }
  return '';
};

export const uploadOperationExpenseAttachment = async ({ tenantId, expenseId, fileBlob }) => {
  try {
    if (!tenantId || !expenseId || !fileBlob) {
      return { ok: false, error: 'Missing attachment upload data.' };
    }

    const validationError = validateOperationExpenseAttachment(fileBlob);
    if (validationError) return { ok: false, error: validationError };

    const compressedBlob = await compressToAttachmentWebp(fileBlob);
    const attachmentPath = `tenants/${tenantId}/operation-expenses/${expenseId}/attachments/${Date.now()}.webp`;
    const attachmentRef = ref(storage, attachmentPath);
    await uploadBytes(attachmentRef, compressedBlob, { contentType: 'image/webp' });
    const attachmentUrl = await getDownloadURL(attachmentRef);

    return {
      ok: true,
      attachment: {
        name: `${String(fileBlob.name || 'attachment').replace(/\.[^.]+$/, '')}.webp`,
        originalName: String(fileBlob.name || ''),
        type: 'image/webp',
        size: compressedBlob.size,
        path: attachmentPath,
        url: attachmentUrl,
      },
    };
  } catch (error) {
    return { ok: false, error: error?.message || 'Attachment upload failed.' };
  }
};
