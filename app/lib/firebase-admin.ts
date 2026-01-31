// IMPORTANT: This file is server-only and should not be imported on the client.
import 'server-only';
import { initializeApp, getApps, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

let app: App;

// This is the standard, robust way to initialize on the server.
// It relies on Application Default Credentials in the production environment.
if (getApps().length === 0) {
  app = initializeApp();
} else {
  app = getApps()[0];
}

const db: Firestore = getFirestore(app);
const auth: Auth = getAuth(app);


// Export simple getter functions.
export function getAdminDb(): Firestore {
  return db;
}

export function getAdminAuth(): Auth {
  return auth;
}
