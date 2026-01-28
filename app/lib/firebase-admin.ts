
import { initializeApp, getApps, getApp, type App, credential } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import 'server-only';

let adminApp: App;

// Initialize Firebase Admin SDK using Application Default Credentials.
// This is the standard practice for server-side environments like Google Cloud Run (used by App Hosting).
if (!getApps().length) {
  adminApp = initializeApp({
    credential: credential.applicationDefault(),
  });
} else {
  adminApp = getApp();
}

export const adminDb: Firestore = getFirestore(adminApp);
export const adminAuth: Auth = getAuth(adminApp);
