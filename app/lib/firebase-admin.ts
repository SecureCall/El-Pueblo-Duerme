
'use server-only';

import { initializeApp, getApps, getApp, type App, credential, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

let app: App;
let db: Firestore;
let auth: Auth;

function initializeAdmin() {
  if (!getApps().length) {
    try {
      app = initializeApp({
        credential: credential.applicationDefault(),
      });
    } catch (e) {
      console.error("Error initializing firebase-admin:", e);
      throw new Error("Could not initialize Firebase Admin SDK. Check server logs for details.");
    }
  } else {
    app = getApp();
  }
  db = getFirestore(app);
  auth = getAuth(app);
}

export function getAdminDb(): Firestore {
  if (!db) {
    initializeAdmin();
  }
  return db;
}

export function getAdminAuth(): Auth {
  if (!auth) {
    initializeAdmin();
  }
  return auth;
}
