'server-only';

import { initializeApp, getApps, getApp, type App, type ServiceAccount, credential } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import 'server-only';

// This configuration is now handled securely through environment variables,
// which is the standard practice for server-side code.
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : undefined;

let adminApp: App;

// Initialize Firebase Admin SDK
// This must only be done once per server instance.
if (!getApps().length) {
  adminApp = initializeApp({
    credential: serviceAccount ? credential.cert(serviceAccount) : undefined,
    databaseURL: `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseio.com`
  });
} else {
  adminApp = getApp();
}

export const adminDb: Firestore = getFirestore(adminApp);
export const adminAuth: Auth = getAuth(adminApp);
