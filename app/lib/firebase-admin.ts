
'use server';

import { initializeApp, getApps, getApp, type App, type ServiceAccount, credential } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import 'server-only';

// This configuration is now handled securely through environment variables,
// which is the standard practice for server-side code.
const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!serviceAccountString) {
  throw new Error('La variable de entorno FIREBASE_SERVICE_ACCOUNT no está definida. Esta es necesaria para las operaciones del servidor. Por favor, siga las instrucciones para configurar su serviceAccountKey.json.');
}

let serviceAccount: ServiceAccount;
try {
  serviceAccount = JSON.parse(serviceAccountString);
} catch (e) {
    throw new Error('Failed to parse FIREBASE_SERVICE_ACCOUNT. Make sure it is a valid JSON string.');
}


let adminApp: App;

// Initialize Firebase Admin SDK
// This must only be done once per server instance.
if (!getApps().length) {
  adminApp = initializeApp({
    credential: credential.cert(serviceAccount),
  });
} else {
  adminApp = getApp();
}

export const adminDb: Firestore = getFirestore(adminApp);
export const adminAuth: Auth = getAuth(adminApp);
