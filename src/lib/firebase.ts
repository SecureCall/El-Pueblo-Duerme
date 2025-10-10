
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { firebaseConfig, validateFirebaseConfig } from "./firebase-config";

let app;
let db;
let auth;

try {
  // Validar la configuración solo en el servidor para evitar exponer errores en el cliente
  if (typeof window === 'undefined') {
    validateFirebaseConfig();
  }
  
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  db = getFirestore(app);
  auth = getAuth(app);
  
} catch (error) {
  console.error("Firebase initialization error:", error);
  // Un fallback muy básico para evitar que la app crashee en el cliente si la config falla
  if (typeof window !== 'undefined' && !getApps().length) {
      app = initializeApp({ projectId: 'fallback-project-id' });
  } else {
      app = getApp();
  }
  db = getFirestore(app);
  auth = getAuth(app);
}

export { app, db, auth };
