
/* ==========================================
   RemindMe - Firebase Configuration
   Google Authentication + Realtime Database
   File: js/firebase.js
========================================== */

import {
    initializeApp,
    getApps,
    getApp
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";

import {
    getAuth,
    GoogleAuthProvider,
    setPersistence,
    browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

import {
    getDatabase
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyB_3NSK-Ax4xX7NrRdDuP8moThHbkhrmew",
  authDomain: "remindme-smart-calendar.firebaseapp.com",
  databaseURL: "https://remindme-smart-calendar-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "remindme-smart-calendar",
  storageBucket: "remindme-smart-calendar.firebasestorage.app",
  messagingSenderId: "877820567961",
  appId: "1:877820567961:web:4f644d78f8c08a4cbbf308",
  measurementId: "G-BJJ8P5H7QW"
};

export const app = getApps().length
    ? getApp()
    : initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const rtdb = getDatabase(app);

export const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
    prompt: "select_account"
});

export const authPersistenceReady = setPersistence(
    auth,
    browserLocalPersistence
).catch((error) => {
    // A persistence failure should not prevent guest/local mode from loading.
    console.error("Firebase persistence setup failed; guest mode remains available.", error);
    return false;
});

export function isFirebaseConfigured() {
    return Boolean(
        firebaseConfig.apiKey &&
        firebaseConfig.apiKey !== "YOUR_FIREBASE_API_KEY" &&
        firebaseConfig.projectId &&
        firebaseConfig.databaseURL
    );
}

console.info("RemindMe Firebase module loaded.");
