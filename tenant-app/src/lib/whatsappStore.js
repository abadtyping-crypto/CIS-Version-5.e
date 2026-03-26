import { getTenantSettingDoc, upsertTenantSettingDoc } from './backendStore';

export const fetchTenantWhatsAppConfig = async (tenantId) => {
  return getTenantSettingDoc(tenantId, 'whatsappConfiguration');
};

export const upsertTenantWhatsAppConfig = async (tenantId, payload) => {
  return upsertTenantSettingDoc(tenantId, 'whatsappConfiguration', payload);
};
