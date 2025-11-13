'use client';

import './globals.css';
import { Inter } from 'next/font/google';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { firebaseConfig } from '@/lib/firebase-config';
import { initializeApp } from 'firebase/app';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

// app can be initialized here because layout is a client component
const app = initializeApp(firebaseConfig);

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  useEffect(() => {
    const auth = getAuth(app);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("--- VIGILANTE GLOBAL EN LAYOUT.TSX ---");
      if (user) {
        console.log("SEÑAL RECIBIDA: ¡Usuario AUTENTICADO!", user.uid);
      } else {
        console.log("SEÑAL RECIBIDA: No hay usuario.");
      }
      console.log("------------------------------------");
    });

    // Limpia el listener cuando el componente se desmonta
    return () => unsubscribe();
  }, []);


  return (
    <html lang="es">
      <body className={inter.className}>
        <FirebaseClientProvider>
          {children}
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
