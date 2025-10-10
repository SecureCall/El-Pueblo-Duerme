
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Verificación en tiempo de ejecución para el lado del servidor
export const validateFirebaseConfig = () => {
  if (typeof window !== 'undefined') {
    return true; // No validar en el cliente
  }

  const required = ['apiKey', 'projectId', 'appId'];
  const missing = required.filter(key => !firebaseConfig[key as keyof typeof firebaseConfig]);
  
  if (missing.length > 0) {
    // Este error será visible en los logs del servidor
    const errorMessage = `Missing Firebase environment variables: ${missing.join(', ')}. Ensure they are set in your .env.local file and prefixed with NEXT_PUBLIC_`;
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
  
  return true;
};
