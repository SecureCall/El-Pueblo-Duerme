import type { Metadata } from 'next';
import { Playfair_Display, PT_Sans } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from './providers/AuthProvider';
import { AudioProvider } from './providers/AudioProvider';
import { ClientShell } from '@/components/friends/ClientShell';
import { cn } from '@/lib/utils';

const ptSans = PT_Sans({ 
  subsets: ['latin'], 
  weight: ['400', '700'],
  variable: '--font-sans' 
});

const playfair = Playfair_Display({
  subsets: ['latin'],
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
      <head>
        {/* Google AdSense — verificación y monetización */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4807272408824742"
          crossOrigin="anonymous"
        />
      </head>
      <body className={cn(ptSans.variable, playfair.variable, "font-sans")}>
        <AuthProvider>
          <AudioProvider>
            <ClientShell>
              {children}
              <Toaster />
            </ClientShell>
          </AudioProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
