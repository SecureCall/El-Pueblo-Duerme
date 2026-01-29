// IMPORTANT: This file is server-only and should not be imported on the client.
import 'server-only';
import { initializeApp, getApps, credential, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

let app: App | undefined;

function initializeAdmin() {
  if (getApps().length === 0) {
    try {
      const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (!serviceAccount) {
        throw new Error("FIREBASE_SERVICE_ACCOUNT environment variable is not set.");
      }
      
      app = initializeApp({
        credential: credential.cert(JSON.parse(serviceAccount)),
      });
      console.log("Firebase Admin SDK initialized successfully.");

    } catch (e: any) {
        console.error("CRITICAL: Failed to initialize Firebase Admin SDK.", e.message);
        // In a real production environment, you might want to exit the process
        // or have a more robust error handling mechanism.
        // For this context, we throw an error to make the failure obvious.
        throw new Error("Could not initialize Firebase Admin SDK. Ensure server environment is set up correctly.");
    }
  } else {
    app = getApps()[0];
  }
}

// Immediately initialize on module load in the server environment.
initializeAdmin();

// Function to get the initialized Firestore instance.
export function getAdminDb(): Firestore {
  if (!app) {
    // This should theoretically not be reached if initialization is correct.
    throw new Error("Firebase Admin App is not initialized.");
  }
  return getFirestore(app);
}

// Function to get the initialized Auth instance.
export function getAdminAuth(): Auth {
  if (!app) {
     throw new Error("Firebase Admin App is not initialized.");
  }
  return getAuth(app);
}
