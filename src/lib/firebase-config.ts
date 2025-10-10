
export const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

// Verificación en tiempo de ejecución
export const validateFirebaseConfig = () => {
  const required = ['apiKey', 'projectId', 'appId'];
  const missing = required.filter(key => !firebaseConfig[key as keyof typeof firebaseConfig]);
  
  if (missing.length > 0) {
    // En el lado del servidor, esto será visible en los logs.
    console.error(`Missing Firebase environment variables: ${missing.join(', ')}`);
    throw new Error(`Missing Firebase environment variables: ${missing.join(', ')}`);
  }
  
  return true;
};
