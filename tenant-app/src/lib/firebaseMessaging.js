import { getToken, onMessage } from 'firebase/messaging';
import { messaging } from './firebaseConfig'; // We need to add messaging to firebaseConfig

// You will need to replace this with your actual VAPID key from Firebase project settings
const VAPID_KEY = 'REPLACE_WITH_YOUR_VAPID_KEY';

export const requestNotificationPermission = async () => {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted.');

            if (!messaging) return null;

            const token = await getToken(messaging, { vapidKey: VAPID_KEY });
            if (token) {
                console.log('FCM Token:', token);
                // Here you would typically send this token to your backend/database
                // to associate it with the current user
                return token;
            } else {
                console.warn('No registration token available. Request permission to generate one.');
                return null;
            }
        } else {
            console.log('Unable to get permission to notify.');
            return null;
        }
    } catch (err) {
        console.error('An error occurred while retrieving token. ', err);
        return null;
    }
};

export const setupForegroundListener = (callback) => {
    if (!messaging) return;

    return onMessage(messaging, (payload) => {
        console.log('Message received in foreground: ', payload);
        if (callback) {
            callback(payload);
        }
    });
};
