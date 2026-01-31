// IMPORTANT: This file is server-only and should not be imported on the client.
import 'server-only';
import { initializeApp, getApps, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

let app: App | undefined;
let db: Firestore | undefined;
let auth: Auth | undefined;

function ensureAdminInitialized() {
  if (!app) { // Only initialize if the app instance doesn't exist
    if (getApps().length === 0) {
      app = initializeApp();
    } else {
      app = getApps()[0];
    }
    db = getFirestore(app);
    auth = getAuth(app);
  }
}

// Export functions that ensure initialization before returning the service.
// This "lazy loading" pattern is crucial to prevent race conditions
// with other Google Cloud libraries (like Genkit) during server startup.
export function getAdminDb(): Firestore {
  ensureAdminInitialized();
  return db!;
}

export function getAdminAuth(): Auth {
  ensureAdminInitialized();
  return auth!;
}
