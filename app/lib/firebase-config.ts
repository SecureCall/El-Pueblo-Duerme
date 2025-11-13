// --- AUDITORÍA DE CONFIGURACIÓN DE FIREBASE ---
console.log("--- AUDITORÍA DE CONFIGURACIÓN DE FIREBASE ---");
console.log("API Key Cargada:", process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? "Sí" : "¡NO!");
console.log("Project ID Cargado:", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? "Sí" : "¡NO!");
console.log("Auth Domain Cargado:", process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? "Sí" : "¡NO!");
console.log("------------------------------------------");
// --- FIN DEL BLOQUE ---

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
