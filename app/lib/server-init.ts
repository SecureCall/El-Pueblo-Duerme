
import { initializeApp, getApps, type App, cert } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

let app: App;

if (getApps().length === 0) {
  const requiredEnvVars = [
    'FIREBASE_PROJECT_ID',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_PRIVATE_KEY',
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.warn(`Firebase Admin Init Warning: Missing environment variable: ${envVar}. Attempting default initialization.`);
      break; 
    }
  }

  if (requiredEnvVars.every(envVar => process.env[envVar])) {
    const adminConfig = {
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
      }),
    };
    app = initializeApp(adminConfig);
  } else {
    // Fallback for environments where GOOGLE_APPLICATION_CREDENTIALS might be set (like App Hosting)
    app = initializeApp();
  }

} else {
  app = getApps()[0]!;
}

const adminDb: Firestore = getFirestore(app);
const adminAuth: Auth = getAuth(app);

const ai = genkit({
  plugins: [googleAI()],
});

export { adminDb, adminAuth, ai };
