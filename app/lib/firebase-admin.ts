// IMPORTANT: This file is server-only and should not be imported on the client.
import 'server-only';
import { initializeApp, getApps, type App, getApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { firebaseConfig } from './firebase-config';

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
    // Explicitly providing the projectId to avoid auto-detection conflicts.
    app = initializeApp({
      projectId: firebaseConfig.projectId,
    });
    console.log("Firebase Admin SDK initialized on-demand with explicit projectId.");
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
