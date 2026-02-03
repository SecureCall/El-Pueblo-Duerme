'use client';

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from '@/lib/firebase-config';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

// This file is for CLIENT-SIDE initialization only.

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let appCheckInitialized = false;

// This function should be called from a client component's useEffect hook.
export function initializeClientAppCheck() {
    if (appCheckInitialized || typeof window === 'undefined') {
        return;
    }

    // For development, allow debug token.
    // Ensure you have `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;` in your local dev environment.
    if (process.env.NODE_ENV === 'development') {
      // @ts-ignore
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    
    // Use a test key for development or if the production key isn't set.
    // The key '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI' is a public test key provided by Google.
    const siteKey = process.env.NODE_ENV === 'production' 
      ? process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI'
      : '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';

    try {
        initializeAppCheck(app, {
          provider: new ReCaptchaV3Provider(siteKey),
          isTokenAutoRefreshEnabled: true,
        });
        appCheckInitialized = true;
        console.log('✅ Firebase App Check inicializado.');
    } catch (error) {
        console.error('❌ Error al inicializar Firebase App Check:', error);
    }
}


export { app, auth, db };
