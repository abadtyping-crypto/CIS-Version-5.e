import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
};

const requiredConfigKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
const missingConfigKeys = requiredConfigKeys.filter((key) => !firebaseConfig[key]);

if (missingConfigKeys.length > 0) {
  throw new Error(
    `Missing Firebase config env vars: ${missingConfigKeys
      .map((key) => `VITE_FIREBASE_${key.replace(/[A-Z]/g, (match) => `_${match}`).toUpperCase()}`)
      .join(', ')}`
  );
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);

let messaging = null;

// Initialize Firebase Cloud Messaging and get a reference to the service
const initializeMessaging = async () => {
  try {
    const isSupportedBrowser = await isSupported();
    if (isSupportedBrowser) {
      messaging = getMessaging(app);
      console.log('Firebase Messaging is supported and initialized.');
    }
  } catch (error) {
    console.error('Firebase Messaging not supported:', error);
  }
};

// Fire and forget
initializeMessaging();

export { messaging };
