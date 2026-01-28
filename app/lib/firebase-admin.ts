
import 'server-only';
import { initializeApp, getApps, getApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

let adminApp: App;

// In a managed Google Cloud environment like App Hosting, initializeApp() 
// can auto-discover credentials. This avoids parsing environment variables 
// which can be formatted incorrectly and cause crashes.
if (!getApps().length) {
    adminApp = initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
} else {
    adminApp = getApp();
}

export const adminDb: Firestore = getFirestore(adminApp);
export const adminAuth: Auth = getAuth(adminApp);
