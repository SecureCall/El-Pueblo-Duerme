'use server';

import { initializeApp, getApps, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// Initialize Firebase Admin
let app: App;
if (getApps().length === 0) {
  app = initializeApp();
} else {
  app = getApps()[0]!;
}
const adminDb: Firestore = getFirestore(app);
const adminAuth: Auth = getAuth(app);

// Initialize Genkit
const ai = genkit({
  plugins: [googleAI()],
});

// Export the initialized instances
export { adminDb, adminAuth, ai };
