
'use server';

import { firebaseConfig } from "./firebase-config";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import 'server-only';

let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const auth = getAuth(app);
const firestore = getFirestore(app);

export function getAuthenticatedSdks() {
  return { auth, firestore, app };
}
