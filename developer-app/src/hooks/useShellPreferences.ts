import { useEffect } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export const useShellPreferences = (tenantId: string) => {
    useEffect(() => {
        const initPrefs = async () => {
            if (!tenantId) return;
            
            const prefRef = doc(db, 'tenants_shell_preferences', tenantId);
            const snap = await getDoc(prefRef);
            
            if (!snap.exists()) {
                // Rule 4.3 (Strict Creation): Upon first initialization, write ONLY createdAt and createdBy.
                // Rule 4.3 (Verification): ensure updatedAt is EXCLUDED from initial doc creation.
                await setDoc(prefRef, {
                    createdAt: serverTimestamp(),
                    createdBy: auth.currentUser?.uid || 'system'
                });
            }
        };

        initPrefs();
    }, [tenantId]);
};
