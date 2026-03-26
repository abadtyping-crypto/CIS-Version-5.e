export const TENANTS = [
  {
    id: 'acis',
    name: 'ACISAjman',
    brandColor: '#e67e22',
    locale: 'en-AE',
    currency: 'AED',
    logoUrl: '/logo.png',
  },
  {
    id: 'testTenants',
    name: 'Test Tenants',
    brandColor: '#e67e22',
    locale: 'en-AE',
    currency: 'AED',
    logoUrl: '/logo.png',
  },
  {
    id: 'nexus',
    name: 'Nexus Advisory',
    brandColor: '#d97706',
    locale: 'en-AE',
    currency: 'AED',
    logoUrl: '/logo.png',
  },
  {
    id: 'orbit',
    name: 'Orbit Corporate',
    brandColor: '#c2410c',
    locale: 'en-GB',
    currency: 'GBP',
    logoUrl: '/logo.png',
  },
];

export const DEFAULT_TENANT_ID = 'acis';

export const findTenantById = (tenantId) => TENANTS.find((tenant) => tenant.id === tenantId) || null;
