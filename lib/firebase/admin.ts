/**
 * Firebase Admin SDK initializer.
 * Safely called multiple times — only initializes once.
 *
 * Credential priority:
 *  1. GOOGLE_APPLICATION_CREDENTIALS_JSON  (full JSON string, preferred on Replit/Vercel)
 *  2. FIREBASE_PRIVATE_KEY + NEXT_PUBLIC_FIREBASE_PROJECT_ID  (split key approach)
 */
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';

let adminApp: App | null = null;

export function initAdminApp(): App {
  if (adminApp) return adminApp;
  if (getApps().length > 0) {
    adminApp = getApps()[0];
    return adminApp;
  }

  const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (credsJson) {
    const serviceAccount = JSON.parse(credsJson);
    adminApp = initializeApp({ credential: cert(serviceAccount) });
  } else if (privateKey && projectId) {
    adminApp = initializeApp({
      credential: cert({
        projectId,
        privateKey: privateKey.replace(/\\n/g, '\n'),
        clientEmail: `firebase-adminsdk@${projectId}.iam.gserviceaccount.com`,
      }),
    });
  } else {
    throw new Error(
      '[Firebase Admin] No credentials found. Set GOOGLE_APPLICATION_CREDENTIALS_JSON or FIREBASE_PRIVATE_KEY.'
    );
  }

  return adminApp;
}
