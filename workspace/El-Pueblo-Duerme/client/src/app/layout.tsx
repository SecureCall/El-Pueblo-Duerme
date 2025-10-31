import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import { SocketManager } from '@/components/SocketManager';
import { AudioConsent } from '@/components/AudioConsent';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'El Pueblo Duerme',
  description: 'Un juego de misterio, engaño y supervivencia.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <SocketManager />
        <AudioConsent />
        <main className="relative min-h-screen w-full flex flex-col items-center justify-center bg-gray-900 text-white p-4 overflow-hidden">
          {children}
        </main>
        <Toaster
          position="bottom-center"
          toastOptions={{
            style: {
              background: '#333',
              color: '#fff',
            },
          }}
        />
      </body>
    </html>
  );
}
