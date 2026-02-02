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
  // Pass your reCAPTCHA v3 site key (public key) to activate(). Make sure this
  // key is a secret in your environment variables.
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider('6LcBdPUpAAAAAGTxQZqzvC8bXzUZ8e6Q8GmzR7XH'),

    // Optional argument. If true, the SDK automatically refreshes App Check
    // tokens as needed.
    isTokenAutoRefreshEnabled: true
  });
}

export { app, auth, db };
