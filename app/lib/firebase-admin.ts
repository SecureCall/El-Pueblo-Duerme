
// IMPORTANT: This file is server-only and should not be imported on the client.
import 'server-only';
import { applicationDefault, initializeApp, getApps, type App, getApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

let db: Firestore | undefined;
let auth: Auth | undefined;
let app: App | undefined;

function ensureAdminInitialized() {
  if (getApps().length === 0) {
    app = initializeApp({
      credential: applicationDefault(),
    });
  } else {
    app = getApp();
  }
  db = getFirestore(app);
  auth = getAuth(app);
}

// Export functions that ensure initialization before returning the service.
// This "lazy loading" pattern prevents race conditions between different Google Cloud libraries.
export function getAdminDb(): Firestore {
  if (!db) {
    ensureAdminInitialized();
  }
  return db!;
}

export function getAdminAuth(): Auth {
  if (!auth) {
    ensureAdminInitialized();
  }
  return auth!;
}
