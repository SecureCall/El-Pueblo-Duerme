
'use server';

import { initializeApp, getApps, getApp, type App, credential, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import 'server-only';

let adminApp: App;

const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!getApps().length) {
  if (!serviceAccountString) {
    // This error will be thrown during server-side rendering if the environment variable is not set.
    // This is a critical failure, as the server cannot operate without credentials.
    throw new Error('La variable de entorno FIREBASE_SERVICE_ACCOUNT no está definida. Esta es necesaria para las operaciones del servidor. Por favor, siga las instrucciones para configurar su serviceAccountKey.json.');
  }

  let serviceAccount: ServiceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountString);
  } catch (e) {
    throw new Error('No se pudo parsear el contenido de FIREBASE_SERVICE_ACCOUNT. Asegúrese de que es un JSON válido.');
  }

  adminApp = initializeApp({
    credential: credential.cert(serviceAccount),
  });

} else {
  adminApp = getApp();
}

export const adminDb: Firestore = getFirestore(adminApp);
export const adminAuth: Auth = getAuth(adminApp);
