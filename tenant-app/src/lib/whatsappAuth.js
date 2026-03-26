import { fetchTenantWhatsAppConfig } from './whatsappStore';

/**
 * Sends a WhatsApp OTP using the tenant's configured WhatsApp API.
 * @param {string} tenantId - The tenant ID.
 * @param {string} phoneNumber - The recipient's phone number.
 * @param {string} otpCode - The OTP code to send.
 */
export const sendWhatsAppOTP = async (tenantId, phoneNumber, otpCode) => {
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
    
    // Using a template message for OTP. 
    // Usually, you'd have a specific template like 'auth_otp' which takes a parameter.
    // For this implementation, we'll try to use the configured templateName if possible, 
    // but ideally, the user should have a template that accepts the OTP as a variable.
    
    const body = {
      messaging_product: 'whatsapp',
      to: phoneNumber,
      type: 'template',
      template: {
        name: config.templateName || 'hello_world', // In a real app, this should be an OTP-specific template
        language: { code: config.templateLang || 'en_US' },
        components: [
          {
            type: 'body',
            parameters: [
              {
                type: 'text',
                text: otpCode
              }
            ]
          }
        ]
      },
    };

    // If the template is 'hello_world', it doesn't take parameters, so we'll adjust
    if (config.templateName === 'hello_world' || !config.templateName) {
        delete body.template.components;
    }

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
      return { ok: true, data };
    } else {
      return { ok: false, error: data.error?.message || 'Failed to send WhatsApp message.' };
    }
  } catch (err) {
    return { ok: false, error: err.message };
  }
};

/**
 * Generates a random 6-digit OTP.
 */
export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};
