
'use server';

import { firebaseConfig } from "./firebase-config";

export async function getAuthenticatedSdks() {
  const { initializeApp, getApps, getApp } = require("firebase/app");
  const { getAuth } = require("firebase/auth");
  const { getFirestore } = require("firebase/firestore");
  
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  const auth = getAuth(app);
  const firestore = getFirestore(app);
  return { auth, firestore, app };
}
