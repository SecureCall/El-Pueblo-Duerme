'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from '@/lib/firebase-config';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

// This file is for CLIENT-SIDE initialization only.

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Initialize App Check
if (typeof window !== 'undefined') {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider('6LcBdPUpAAAAAGTxQZqzvC8bXzUZ8e6Q8GmzR7XH'),
    isTokenAutoRefreshEnabled: true,
  });
}

export { app, auth, db };
