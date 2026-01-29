
import type { Metadata } from 'next';
import { Inter, Uncial_Antiqua } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseProvider } from './firebase/provider';
import { cn } from './lib/utils';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const uncial = Uncial_Antiqua({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-headline',
});

export const metadata: Metadata = {
  title: 'El Pueblo Duerme',
  description: 'Un juego de misterio, engaño y supervivencia.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <body className={cn(inter.variable, uncial.variable, "font-sans")}>
        <FirebaseProvider>
          {children}
          <Toaster />
        </FirebaseProvider>
      </body>
    </html>
  );
}
