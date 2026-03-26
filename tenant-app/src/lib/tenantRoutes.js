export const resolveTenantRoute = (tenantId, routePath = '') => {
  const raw = String(routePath || '').trim();
  if (!raw) return '';
  if (raw.startsWith(`/t/${tenantId}/`)) return raw;
  if (raw.startsWith('/t/')) return raw;
  if (raw.startsWith('/')) return `/t/${tenantId}${raw}`;
  return `/t/${tenantId}/${raw}`;
};
