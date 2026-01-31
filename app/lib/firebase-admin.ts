// IMPORTANT: This file is server-only and should not be imported on the client.
import 'server-only';
import { initializeApp, getApps, type App, getApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

let app: App | undefined;

// This function ensures the app is initialized, but does it lazily.
function ensureAdminInitialized(): App {
  if (app) {
    return app;
  }
  
  if (getApps().length > 0) {
    app = getApp();
    return app;
  }

  try {
    // In a managed environment like App Hosting, initializeApp() with no arguments
    // should automatically discover credentials. This prevents conflicts with other
    // libraries (like Genkit) that also rely on Application Default Credentials.
    app = initializeApp();
    console.log("Firebase Admin SDK initialized on-demand with implicit credentials.");
    return app;
  } catch (e: any) {
      console.error("CRITICAL: Failed to initialize Firebase Admin SDK.", e.message);
      // For this context, we throw an error to make the failure obvious.
      throw new Error(`Could not initialize Firebase Admin SDK. Error: ${e.message}`);
  }
}

// Function to get the initialized Firestore instance.
export function getAdminDb(): Firestore {
  const adminApp = ensureAdminInitialized();
  return getFirestore(adminApp);
}

// Function to get the initialized Auth instance.
export function getAdminAuth(): Auth {
  const adminApp = ensureAdminInitialized();
  return getAuth(adminApp);
}
