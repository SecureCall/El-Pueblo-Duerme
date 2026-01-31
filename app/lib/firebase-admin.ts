
// IMPORTANT: This file is server-only and should not be imported on the client.
import 'server-only';
import { initializeApp, getApps, type App, getApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

let app: App;

if (getApps().length) {
  app = getApp();
} else {
  // Initialize without any parameters to use Application Default Credentials.
  // This is the standard and most robust way for Google Cloud environments.
  app = initializeApp();
}

const db: Firestore = getFirestore(app);
const auth: Auth = getAuth(app);

// Export the initialized instances directly.
export function getAdminDb(): Firestore {
  return db;
}

export function getAdminAuth(): Auth {
  return auth;
}
