'use client';

import type { Metadata } from 'next';
import { Playfair_Display, PT_Sans } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseProvider } from './firebase/provider';
import { cn } from './lib/utils';
import { useEffect } from 'react';

const ptSans = PT_Sans({ 
  subsets: ['latin'], 
  weight: ['400', '700'],
  variable: '--font-sans' 
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-headline',
});

// Metadata can't be exported from a client component.
// We can either move it to a parent layout or handle it differently if needed.
// For now, we comment it out to fix the immediate issue.
/*
export const metadata: Metadata = {
  title: 'El Pueblo Duerme',
  description: 'Un juego de misterio, engaño y supervivencia.',
};
*/

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  
  return (
    <html lang="es" className="dark">
      <body className={cn(ptSans.variable, playfair.variable, "font-sans")}>
        <FirebaseProvider>
          {children}
          <Toaster />
        </FirebaseProvider>
      </body>
    </html>
  );
}
