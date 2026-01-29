
// IMPORTANT: This file is server-only and should not be imported on the client.
import 'server-only';
import { initializeApp, getApps, credential, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

let app: App | undefined;

function initializeAdmin() {
  if (getApps().length === 0) {
    try {
      // Standard for Google Cloud environments (like Cloud Run, App Engine).
      app = initializeApp({
        credential: credential.applicationDefault(),
      });
       console.log("Firebase Admin SDK initialized successfully with Application Default Credentials.");
    } catch (e: any) {
        console.error("CRITICAL: Failed to initialize Firebase Admin SDK.", e.message);
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
