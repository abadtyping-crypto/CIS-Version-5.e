import { doc, setDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { db } from './firebase';

const EMIRATE_CODES = {
    'Dubai': 'DUB',
    'Abu Dhabi': 'AUH',
    'Sharjah': 'SHJ',
    'Ajman': 'AJM',
    'Umm Al Quwain': 'UAQ',
    'Ras Al Khaimah': 'RAK',
    'Fujairah': 'FUJ'
};

/**
 * Generates a unique Tenant UID based on user rules.
 * Format: [EmirateCode][DDMMYY][HHMMSS][LicenseNumber]
 */
const generateTenantUID = (emirate, licenseNumber) => {
    const code = EMIRATE_CODES[emirate] || 'UAE';

    // Get current date and time in local timezone
    const now = new Date();

    // Format DDMMYY
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yy = String(now.getFullYear()).slice(-2);

    // Format HHMMSS
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');

    // Clean license number (remove spaces, special chars)
    const cleanLicense = String(licenseNumber).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    return `${code}${dd}${mm}${yy}${hh}${min}${ss}${cleanLicense}`;
};

/**
 * Registers a new tenant in Firestore and triggers a welcome email.
 * @param {Object} tenantData 
 */
export const registerNewTenant = async (tenantData) => {
    try {
        const uid = generateTenantUID(tenantData.emirate, tenantData.licenseNumber);

        const payload = {
            id: uid, // Store the generated ID inside the document too
            ...tenantData,
            status: 'Active',
            createdAt: serverTimestamp(),
            // Ensure array or specific structures if needed later
        };

        // 1. Save the Tenant Profile
        const docRef = doc(db, 'tenants', uid);
        await setDoc(docRef, payload);

        // 2. Trigger Welcome Email (Firestore Trigger Email Extension)
        // This creates a document in the 'mail' collection which the extension listens to.
        const mailCollection = collection(db, 'mail');
        await addDoc(mailCollection, {
            to: tenantData.email,
            message: {
                subject: 'Welcome to ACIS - Your Tenant Portal is Ready!',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
                        <h2 style="color: #2563eb;">Welcome to ACIS Core!</h2>
                        <p>Dear ${tenantData.ownerName},</p>
                        <p>Your tenant profile for <strong>${tenantData.companyName}</strong> has been successfully initialized in our system.</p>
                        
                        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
                            <h3 style="margin-top: 0; color: #0f172a; font-size: 16px;">Your Access Details:</h3>
                            <ul style="list-style-type: none; padding: 0; margin: 0;">
                                <li style="margin-bottom: 8px;"><strong>System ID:</strong> <span style="font-family: monospace; background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${uid}</span></li>
                                <li style="margin-bottom: 8px;"><strong>Plan Level:</strong> ${tenantData.tenantType}</li>
                                <li style="margin-bottom: 0;"><strong>Allowed Users:</strong> ${tenantData.allowedUsers}</li>
                            </ul>
                        </div>

                        <p>You can access your dedicated tenant portal backend using your registered mobile number (<strong>${tenantData.phone}</strong>).</p>
                        
                        <a href="https://abadtyping.com/${tenantData.backendPath}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 10px;">Access Your Portal</a>

                        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
                        <p style="font-size: 12px; color: #64748b;">If you have any questions or did not request this, please contact support.</p>
                    </div>
                `
            }
        });

        return { success: true, uid };
    } catch (error) {
        console.error("Error registering tenant:", error);
        throw error;
    }
};
