
'use server';

import { initializeApp, getApps, getApp, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

const firebaseAdminConfig = {
  // credential: cert(process.env.FIREBASE_SERVICE_ACCOUNT_KEY ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY) : {}),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

let adminApp: App;
let adminDb: Firestore;

try {
    if (!getApps().length) {
        adminApp = initializeApp(firebaseAdminConfig);
    } else {
        adminApp = getApp();
    }
    adminDb = getFirestore(adminApp);
} catch (error: any) {
    console.error("Error initializing Firebase Admin SDK:", error);
    // Handle the error appropriately
    // For example, you might throw the error or log it and exit
}

export { adminDb };
