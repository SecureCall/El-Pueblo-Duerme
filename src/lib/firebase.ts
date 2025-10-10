
import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { firebaseConfig, validateFirebaseConfig } from "./firebase-config";

// Valida la configuración solo en el lado del servidor.
if (typeof window === 'undefined') {
  try {
    validateFirebaseConfig();
  } catch(error) {
     console.error("CRITICAL: FIREBASE CONFIG VALIDATION FAILED.", error);
  }
}

// Inicializa la app de Firebase
const app = !getApps().length ? initializeApp(firebaseConfig as FirebaseOptions) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
