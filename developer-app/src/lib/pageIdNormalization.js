const PAGE_ID_ALIASES = Object.freeze({
  'portal-management': 'portal-mgmt',
  'portal-mgmt': 'portal-mgmt',
});

export const normalizePageID = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const trimmed = raw.replace(/^\/+/, '').replace(/\/+$/, '');
  const normalized = trimmed
    .replace(/\s+/g, '-')
    .toLowerCase();

  return PAGE_ID_ALIASES[normalized] || normalized;
};

