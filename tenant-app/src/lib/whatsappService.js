import { fetchTenantWhatsAppConfig } from './whatsappStore';

/**
 * Sends a PDF/Document via WhatsApp using the tenant's configured WhatsApp API.
 * @param {string} tenantId - The tenant ID.
 * @param {string} phoneNumber - The recipient's phone number.
 * @param {string} mediaUrl - The public URL of the PDF document.
 * @param {string} filename - The name of the file (e.g. 'Proforma_123.pdf').
 */
export const sendWhatsAppDocument = async (tenantId, phoneNumber, mediaUrl, filename) => {
  const configRes = await fetchTenantWhatsAppConfig(tenantId);
  if (!configRes.ok || !configRes.data) {
    return { ok: false, error: 'WhatsApp is not configured for this tenant.' };
  }

  const config = configRes.data;
  if (!config.accessToken || !config.phoneNumberId) {
    return { ok: false, error: 'WhatsApp API credentials are missing.' };
  }

  try {
    const url = `https://graph.facebook.com/${config.apiVersion || 'v22.0'}/${config.phoneNumberId}/messages`;
    
    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phoneNumber,
      type: 'document',
      document: {
        link: mediaUrl,
        filename: filename || 'document.pdf',
        caption: `Here is your document: ${filename}`
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    if (response.ok) {
      return { ok: true, messageId: data.messages?.[0]?.id };
    } else {
      return { ok: false, error: data.error?.message || 'Failed to send WhatsApp document.' };
    }
  } catch (err) {
    return { ok: false, error: err.message };
  }
};
