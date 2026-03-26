import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export const useLedger = (tenantId: string) => {
    const [balance, setBalance] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        if (!tenantId) {
            setBalance(0);
            setLoading(false);
            return;
        }

        const ledgerRef = doc(db, 'ledgers', tenantId);

        const unsubscribe = onSnapshot(ledgerRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                // Rule 4: Must use lowercase key balance
                setBalance(data.balance || 0);
            } else {
                // Logic: If no document exists, return a 0 balance
                setBalance(0);
            }
            setLoading(false);
        }, (error) => {
            console.error('Error listening to ledger:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [tenantId]);

    // Rule 2: All displayed values must append AED (handled in UI, but maybe a helper here?)
    const formattedBalance = `${balance.toLocaleString()} AED`;

    return { balance, formattedBalance, loading };
};
