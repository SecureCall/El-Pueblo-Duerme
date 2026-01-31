
// IMPORTANT: This file is server-only and should not be imported on the client.
import 'server-only';
import { initializeApp, getApps, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

let app: App;

if (getApps().length === 0) {
  app = initializeApp();
} else {
  app = getApps()[0];
}

const db: Firestore = getFirestore(app);
const auth: Auth = getAuth(app);


// Export functions that ensure initialization before returning the service.
export function getAdminDb(): Firestore {
  return db;
}

export function getAdminAuth(): Auth {
  return auth;
}
