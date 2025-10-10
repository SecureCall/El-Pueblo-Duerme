
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { firebaseConfig, validateFirebaseConfig } from "./firebase-config";

let app;
let db;
let auth;

// Esta validación se ejecuta en el servidor cuando este archivo se carga por primera vez.
// Si las variables no están, el servidor fallará al arrancar, lo cual es bueno para detectar errores pronto.
if (typeof window === 'undefined') {
  try {
    validateFirebaseConfig();
  } catch (error) {
    console.error("FATAL: Missing Firebase server environment variables.", error);
    // Para evitar que la app crashee por completo, podemos usar un objeto 'dummy',
    // aunque las operaciones de Firebase fallarán. Esto es principalmente para que el build no se rompa.
    if (!getApps().length) {
      app = initializeApp({ projectId: "MISSING_CONFIG" });
    } else {
      app = getApp();
    }
  }
}

if (!app) {
    if (!getApps().length) {
        app = initializeApp(firebaseConfig);
    } else {
        app = getApp();
    }
}


db = getFirestore(app);
auth = getAuth(app);

export { app, db, auth };
