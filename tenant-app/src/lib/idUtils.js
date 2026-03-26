export const toSafeDocId = (rawId, fallbackPrefix = 'doc') => {
  const cleaned = String(rawId || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (cleaned) return cleaned;
  return `${fallbackPrefix}_${Date.now()}`;
};
