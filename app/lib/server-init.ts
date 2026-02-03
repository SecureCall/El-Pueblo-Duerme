import { initializeApp, getApps, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

let app: App;
if (getApps().length === 0) {
  // Explicitly providing the projectId to fix environment detection issues.
  app = initializeApp({
    projectId: "studio-9015007721-ac536",
  });
} else {
  app = getApps()[0]!;
}

const adminDb: Firestore = getFirestore(app);
const adminAuth: Auth = getAuth(app);

const ai = genkit({
  plugins: [googleAI()],
});

export { adminDb, adminAuth, ai };
