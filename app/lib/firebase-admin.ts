import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getFirestore, FieldValue, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

let adminDb: Firestore;
let adminAuth: Auth;
let ai: any;

// This pattern ensures that Firebase Admin is initialized only once.
if (getApps().length === 0) {
  const validateEnv = () => {
    const missing: string[] = [];
    if (!process.env.FIREBASE_PROJECT_ID) missing.push('FIREBASE_PROJECT_ID');
    if (!process.env.FIREBASE_CLIENT_EMAIL) missing.push('FIREBASE_CLIENT_EMAIL');
    if (!process.env.FIREBASE_PRIVATE_KEY) missing.push('FIREBASE_PRIVATE_KEY');
    if (missing.length > 0) {
      throw new Error(`❌ Missing environment variables: ${missing.join(', ')}`);
    }
  };

  const getAdminConfig = () => {
    validateEnv();
    const privateKey = process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n');
    return {
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: privateKey,
      }),
    };
  };
  
  try {
    const app = initializeApp(getAdminConfig());
    console.log(`✅ Firebase Admin initialized for project: ${process.env.FIREBASE_PROJECT_ID}`);
    adminDb = getFirestore(app);
    adminAuth = getAuth(app);
  } catch (error: any) {
    console.error('❌ Firebase Admin initialization failed:', error.message);
    if (error.message.includes('private key')) {
      console.error('💡 TIP: Asegúrate que FIREBASE_PRIVATE_KEY en .env tenga \\n en lugar de saltos de línea reales');
    }
    throw error;
  }
} else {
  const app = getApps()[0];
  adminDb = getFirestore(app);
  adminAuth = getAuth(app);
}

// Initialize Genkit
ai = genkit({
  plugins: [googleAI()],
});


export { adminDb, adminAuth, ai, FieldValue };
