export const PUBLIC_SITE_CONFIG_DOC = {
  collection: 'acis_system_assets',
  id: 'public_site_controller',
};

export const PUBLIC_SITE_DEFAULTS = {
  badgeText: 'UAE Based Documents Clearance',
  heroTitleLine1: 'Abad Commercial',
  heroTitleLine2: 'Information Services',
  heroDescription: 'Your trusted agent for reliable, fast, and comprehensive document clearance and typing services across the United Arab Emirates.',
  whatsappUrl: 'https://wa.me/971551012119',
  websiteUrl: 'https://abadtyping.com',
  contactPhone: '+971 55 101 2119',
  contactEmail: 'info@abadtyping.com',
  mapUrl: 'https://maps.app.goo.gl/N18juGGC9Y9K1YQX6',
  addressLine1: 'Shop 01, Ammar Bin Yasir St',
  addressLine2: 'Al Rashidiya 2, Ajman, UAE',
  facebookUrl: 'https://www.facebook.com/abadtyping',
  instagramUrl: 'https://www.instagram.com/abadtyping/',
};

const normalizeString = (value, fallback) => {
  const next = String(value ?? '').trim();
  return next || fallback;
};

export const normalizePublicSiteConfig = (raw = {}) => ({
  badgeText: normalizeString(raw.badgeText, PUBLIC_SITE_DEFAULTS.badgeText),
  heroTitleLine1: normalizeString(raw.heroTitleLine1, PUBLIC_SITE_DEFAULTS.heroTitleLine1),
  heroTitleLine2: normalizeString(raw.heroTitleLine2, PUBLIC_SITE_DEFAULTS.heroTitleLine2),
  heroDescription: normalizeString(raw.heroDescription, PUBLIC_SITE_DEFAULTS.heroDescription),
  whatsappUrl: normalizeString(raw.whatsappUrl, PUBLIC_SITE_DEFAULTS.whatsappUrl),
  websiteUrl: normalizeString(raw.websiteUrl, PUBLIC_SITE_DEFAULTS.websiteUrl),
  contactPhone: normalizeString(raw.contactPhone, PUBLIC_SITE_DEFAULTS.contactPhone),
  contactEmail: normalizeString(raw.contactEmail, PUBLIC_SITE_DEFAULTS.contactEmail),
  mapUrl: normalizeString(raw.mapUrl, PUBLIC_SITE_DEFAULTS.mapUrl),
  addressLine1: normalizeString(raw.addressLine1, PUBLIC_SITE_DEFAULTS.addressLine1),
  addressLine2: normalizeString(raw.addressLine2, PUBLIC_SITE_DEFAULTS.addressLine2),
  facebookUrl: normalizeString(raw.facebookUrl, PUBLIC_SITE_DEFAULTS.facebookUrl),
  instagramUrl: normalizeString(raw.instagramUrl, PUBLIC_SITE_DEFAULTS.instagramUrl),
});
