// IMPORTANT: This file is server-only and should not be imported on the client.
import 'server-only';
import { initializeApp, getApps, credential, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

let app: App;
let adminDb: Firestore;
let adminAuth: Auth;

function initializeAdmin() {
  if (getApps().length > 0) {
    app = getApps()[0];
  } else {
    try {
      // Use Application Default Credentials, standard for Google Cloud environments.
      app = initializeApp({
        credential: credential.applicationDefault(),
      });
    } catch (e) {
        console.error("Could not initialize Firebase Admin SDK with Application Default Credentials.", e);
        throw new Error("Could not initialize Firebase Admin SDK. Ensure your service account credentials are set up correctly in your environment (e.g., GOOGLE_APPLICATION_CREDENTIALS).");
    }
  }
  adminDb = getFirestore(app);
  adminAuth = getAuth(app);
}

// Function to get the initialized Firestore instance.
export function getAdminDb(): Firestore {
  if (!adminDb) {
    initializeAdmin();
  }
  return adminDb;
}

// Function to get the initialized Auth instance.
export function getAdminAuth(): Auth {
  if (!adminAuth) {
    initializeAdmin();
  }
  return adminAuth;
}
