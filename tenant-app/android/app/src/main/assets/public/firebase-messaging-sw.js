self.importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
self.importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');

// Required configuration for background messages
const firebaseConfig = {
    apiKey: "AIzaSyCVXoR6OaNFxj2T7FKBhrD1W9dLp7BoRFY",
    authDomain: "acis-typingapplication.firebaseapp.com",
    projectId: "acis-typingapplication",
    storageBucket: "acis-typingapplication.firebasestorage.app",
    messagingSenderId: "970490976925",
    appId: "1:970490976925:web:c4a88d1f87437314b59274",
    measurementId: "G-6XNS139DR6"
};

try {
    const firebaseApp = self.firebase;
    firebaseApp.initializeApp(firebaseConfig);
    const messaging = firebaseApp.messaging();

    messaging.onBackgroundMessage((payload) => {
        console.log('[firebase-messaging-sw.js] Received background message ', payload);
        const notificationTitle = payload.notification?.title || 'New Notification';
        const notificationOptions = {
            body: payload.notification?.body || '',
            icon: '/pwa-192x192.png'
        };

        self.registration.showNotification(notificationTitle, notificationOptions);
    });
} catch (e) {
    console.error('[firebase-messaging-sw.js] Error initializing Firebase:', e);
}
