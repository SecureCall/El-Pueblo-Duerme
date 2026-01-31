// IMPORTANT: This file is server-only and should not be imported on the client.
import 'server-only';
import { initializeApp, getApps, type App, type AppOptions } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

let app: App | undefined;

function initializeAdmin() {
  if (getApps().length > 0) {
    app = getApps()[0];
    return;
  }
  
  const options: AppOptions = {};
  // When running in a Google Cloud environment, the project ID is available in an env var.
  // Explicitly setting it can resolve authentication issues in some cases.
  if (process.env.GCLOUD_PROJECT) {
      options.projectId = process.env.GCLOUD_PROJECT;
  }

  try {
    app = initializeApp(options);
    if(options.projectId) {
        console.log(`Firebase Admin SDK initialized successfully for project: ${options.projectId}`);
    } else {
        console.log("Firebase Admin SDK initialized successfully with implicit credentials.");
    }
  } catch (e: any) {
      console.error("CRITICAL: Failed to initialize Firebase Admin SDK.", e.message);
      // For this context, we throw an error to make the failure obvious.
      throw new Error(`Could not initialize Firebase Admin SDK. Error: ${e.message}`);
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
