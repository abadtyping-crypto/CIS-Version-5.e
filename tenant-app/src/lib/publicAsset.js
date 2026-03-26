const normalizeBase = (base) => {
  const raw = String(base || '/');
  if (!raw) return '/';
  return raw.endsWith('/') ? raw : `${raw}/`;
};

export const getPublicAssetUrl = (path) => {
  const cleanPath = String(path || '').replace(/^\/+/, '');
  const base = normalizeBase(import.meta.env.BASE_URL || '/');
  return `${base}${cleanPath}`;
};

