
import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import * as adminFirestore from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// Validar variables de entorno
const validateEnv = () => {
  const missing: string[] = [];
  
  if (!process.env.FIREBASE_PROJECT_ID) missing.push('FIREBASE_PROJECT_ID');
  if (!process.env.FIREBASE_CLIENT_EMAIL) missing.push('FIREBASE_CLIENT_EMAIL');
  if (!process.env.FIREBASE_PRIVATE_KEY) missing.push('FIREBASE_PRIVATE_KEY');
  
  if (missing.length > 0) {
    throw new Error(`❌ Missing environment variables: ${missing.join(', ')}`);
  }
};

// Configuración
const getAdminConfig = () => {
  validateEnv();
  
  // La clave privada viene con \n literales que deben convertirse
  const privateKey = process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n');
  
  return {
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: privateKey,
    }),
  };
};

// Inicialización
let adminApp: App;
let adminDb: adminFirestore.Firestore;

try {
  if (getApps().length === 0) {
    adminApp = initializeApp(getAdminConfig());
    console.log(`✅ Firebase Admin initialized for project: ${process.env.FIREBASE_PROJECT_ID}`);
  } else {
    adminApp = getApps()[0];
  }
  
  adminDb = adminFirestore.getFirestore(adminApp);
} catch (error: any) {
  console.error('❌ Firebase Admin initialization failed:', error.message);
  
  if (error.message.includes('private key')) {
    console.error('💡 TIP: Asegúrate que FIREBASE_PRIVATE_KEY en .env tenga \\n en lugar de saltos de línea reales');
  }
  
  throw error;
}

const adminAuth: Auth = getAuth(adminApp);

const ai = genkit({
  plugins: [googleAI()],
});

export { adminDb, adminAuth, ai, adminFirestore };
