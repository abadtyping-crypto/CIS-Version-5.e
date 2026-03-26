// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCVXoR6OaNFxj2T7FKBhrD1W9dLp7BoRFY",
    authDomain: "acis-typingapplication.firebaseapp.com",
    projectId: "acis-typingapplication",
    storageBucket: "acis-typingapplication.firebasestorage.app",
    messagingSenderId: "970490976925",
    appId: "1:970490976925:web:04654c57c6341e1cb59274",
    measurementId: "G-HJ7MSMQLHC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export const checkDeveloperAccess = async (uid) => {
    try {
        const docRef = doc(db, "acisDev", uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().status === 'active') {
            return { granted: true, data: docSnap.data() };
        }
        return { granted: false, reason: 'Not registered or inactive developer' };
    } catch (error) {
        console.error("Error checking developer access:", error);
        return { granted: false, reason: 'System error verifying access' };
    }
};

export const signInWithGoogle = async () => {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        return result.user;
    } catch (error) {
        console.error("Google sign in failed:", error);
        throw error;
    }
};
