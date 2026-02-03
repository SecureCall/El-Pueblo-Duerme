'use client';

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from '@/lib/firebase-config';

// This file is for CLIENT-SIDE initialization only.

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// App Check initialization has been temporarily removed to resolve a blocking
// environment configuration issue. To re-enable it for production, you will need to
// restore the initializeAppCheck logic and ensure your reCAPTCHA keys and
// authorized domains are correctly set up in the Firebase Console.
// import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';


export { app, auth, db };
