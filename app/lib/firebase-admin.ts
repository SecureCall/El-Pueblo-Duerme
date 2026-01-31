// IMPORTANT: This file is server-only and should not be imported on the client.
import 'server-only';
import { initializeApp, getApps, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

let app: App | undefined;

function initializeAdmin() {
  if (getApps().length === 0) {
    try {
      // In a managed environment like Firebase App Hosting,
      // the Admin SDK is automatically configured via Application Default Credentials.
      // Calling initializeApp() without arguments lets it use this automatic config.
      app = initializeApp();
      console.log("Firebase Admin SDK initialized successfully using default credentials.");

    } catch (e: any) {
        console.error("CRITICAL: Failed to initialize Firebase Admin SDK.", e.message);
        // For this context, we throw an error to make the failure obvious.
        throw new Error(`Could not initialize Firebase Admin SDK. Error: ${e.message}`);
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
