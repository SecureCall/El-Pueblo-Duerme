
'use server';

import 'server-only';
import { initializeApp, getApps, getApp, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY 
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY) 
  : undefined;

const firebaseAdminConfig = {
  credential: serviceAccount ? cert(serviceAccount) : undefined,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

let adminApp: App;
if (!getApps().length) {
    adminApp = initializeApp(firebaseAdminConfig);
} else {
    adminApp = getApp();
}

export const adminDb: Firestore = getFirestore(adminApp);
export const adminAuth: Auth = getAuth(adminApp);
