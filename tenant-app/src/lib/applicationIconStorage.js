import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from './firebaseConfig';

const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 120 * 1024;
const OUTPUT_SIZE = 256;
const ICON_IMAGE_TYPES = new Set(['image/png', 'image/svg+xml', 'image/jpeg', 'image/webp']);

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

const safeDeleteByUrl = async (url) => {
  const path = extractStoragePathFromUrl(url);
  if (!path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch {
    // Ignore delete failures to keep flow resilient.
  }
};

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
      reject(new Error('Invalid icon image file.'));
    };
    image.src = objectUrl;
  });

const canvasToWebpBlob = (canvas, quality) =>
  new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/webp', quality);
  });

const compressToIconWebp = async (fileBlob) => {
  const image = await loadImageFromBlob(fileBlob);
  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to process icon image.');

  ctx.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  const fitScale = Math.min(OUTPUT_SIZE / image.width, OUTPUT_SIZE / image.height);
  const drawWidth = Math.max(1, Math.round(image.width * fitScale));
  const drawHeight = Math.max(1, Math.round(image.height * fitScale));
  const drawX = Math.round((OUTPUT_SIZE - drawWidth) / 2);
  const drawY = Math.round((OUTPUT_SIZE - drawHeight) / 2);
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);

  let bestBlob = null;
  const qualities = [0.82, 0.72, 0.6, 0.5, 0.42];
  for (const quality of qualities) {
    const blob = await canvasToWebpBlob(canvas, quality);
    if (!blob) continue;
    bestBlob = blob;
    if (blob.size <= MAX_OUTPUT_BYTES) break;
  }

  if (!bestBlob) throw new Error('Unable to compress icon image.');
  return bestBlob;
};

export const validateApplicationIconFile = (fileBlob) => {
  if (!fileBlob) return 'Select an icon image.';
  if (!ICON_IMAGE_TYPES.has(fileBlob.type)) return 'Only PNG, SVG, JPG, and WEBP are supported.';
  if (fileBlob.size > MAX_UPLOAD_BYTES) return 'File is too large. Maximum size is 3 MB.';
  return '';
};

export const uploadApplicationIconAsset = async ({ tenantId, iconId, fileBlob, oldUrl }) => {
  try {
    if (!tenantId || !iconId || !fileBlob) {
      return { ok: false, error: 'Missing icon upload data.' };
    }

    const validationError = validateApplicationIconFile(fileBlob);
    if (validationError) return { ok: false, error: validationError };

    const compressedBlob = await compressToIconWebp(fileBlob);
    const iconPath = `tenants/${tenantId}/application-icons/${iconId}_${Date.now()}.webp`;
    const iconRef = ref(storage, iconPath);
    await uploadBytes(iconRef, compressedBlob, { contentType: 'image/webp' });
    const iconUrl = await getDownloadURL(iconRef);

    if (oldUrl && oldUrl.startsWith('https://firebasestorage.googleapis.com/')) {
      await safeDeleteByUrl(oldUrl);
    }

    return { ok: true, iconUrl };
  } catch (error) {
    return { ok: false, error: error?.message || 'Icon upload failed.' };
  }
};

export const deleteApplicationIconAssetByUrl = async (url) => {
  await safeDeleteByUrl(url);
};
