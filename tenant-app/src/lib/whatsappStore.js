import { getTenantSettingDoc, upsertTenantSettingDoc, db, doc, getDoc } from './backendStore';

export const fetchTenantWhatsAppConfig = async (tenantId) => {
  const localRes = await getTenantSettingDoc(tenantId, 'whatsappConfiguration');
  
  // If the tenant has a local config and it's NOT explicitly using the master, or if they have their own credentials
  if (localRes.ok && localRes.data && !localRes.data.useMasterConfig) {
    return localRes;
  }

  // Fallback to Master System configuration
  try {
    const masterRef = doc(db, 'system_configs', 'whatsapp_master');
    const masterSnap = await getDoc(masterRef);
    
    if (masterSnap.exists()) {
      const masterData = masterSnap.data();
      // Only allow fallback if the tenant is subscribed or master allows all
      if (localRes.ok && localRes.data?.isServiceEnabled) {
         return { ok: true, data: { ...masterData, ...localRes.data, isMasterFallback: true } };
      }
    }
  } catch (e) {
    console.error('Failed to fetch master WhatsApp config:', e);
  }

  return localRes; // Return whatever local config we have (might be disabled)
};

export const upsertTenantWhatsAppConfig = async (tenantId, payload) => {
  return upsertTenantSettingDoc(tenantId, 'whatsappConfiguration', payload);
};

export const fetchMasterWhatsAppConfig = async () => {
    try {
        const snap = await getDoc(doc(db, 'system_configs', 'whatsapp_master'));
        return { ok: snap.exists(), data: snap.data() };
    } catch (e) {
        return { ok: false, error: e.message };
    }
};
