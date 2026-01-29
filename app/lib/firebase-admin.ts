
'use server';
import { initializeApp, getApps, getApp, type App, credential } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

let app: App;
let db: Firestore;
let auth: Auth;

function initializeAdmin() {
  if (!getApps().length) {
    try {
      // Use Application Default Credentials, which is the standard for Google Cloud environments.
      // This will automatically find the credentials in the environment.
      app = initializeApp({
        credential: credential.applicationDefault(),
      });
    } catch (e) {
      console.error("Error initializing firebase-admin:", e);
      // Provide a more helpful error message.
      throw new Error("Could not initialize Firebase Admin SDK. Ensure your service account credentials are set up correctly in your environment.");
    }
  } else {
    app = getApp();
  }
  db = getFirestore(app);
  auth = getAuth(app);
}

// Function to get the initialized Firestore instance.
export function getAdminDb(): Firestore {
  if (!db) {
    initializeAdmin();
  }
  return db;
}

// Function to get the initialized Auth instance.
export function getAdminAuth(): Auth {
  if (!auth) {
    initializeAdmin();
  }
  return auth;
}
