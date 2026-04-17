import type { Metadata, Viewport } from 'next';
import { Playfair_Display, PT_Sans } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from './providers/AuthProvider';
import { AudioProvider } from './providers/AudioProvider';
import { ClientShell } from '@/components/friends/ClientShell';
import { RegisterSW } from '@/components/pwa/RegisterSW';
import { WindowControlsOverlay } from '@/components/pwa/WindowControlsOverlay';
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
  title: 'El Pueblo Duerme — Juego de Lobos Multijugador',
  description: 'Un juego multijugador de misterio, engaño y supervivencia. 35 roles, narrador IA, chat de voz y eventos de caos. ¡Descubre a los lobos antes de que sea tarde!',
  keywords: ['juego lobos', 'mafia game', 'werewolf', 'juego multijugador', 'el pueblo duerme', 'deducción social', 'juego navegador', 'lobos hombre'],
  authors: [{ name: 'El Pueblo Duerme' }],
  metadataBase: new URL('https://elpuebloduerme.vercel.app'),
  openGraph: {
    title: 'El Pueblo Duerme — Juego de Lobos Multijugador',
    description: 'Un juego multijugador de misterio, engaño y supervivencia. 35 roles, narrador IA, chat de voz y eventos de caos.',
    url: 'https://elpuebloduerme.vercel.app',
    siteName: 'El Pueblo Duerme',
    locale: 'es_ES',
    type: 'website',
    images: [{ url: '/icons/512.png', width: 512, height: 512, alt: 'El Pueblo Duerme' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'El Pueblo Duerme — Juego de Lobos Multijugador',
    description: 'Juego de deducción social en español. ¡Descubre a los lobos antes de que sea tarde!',
    images: ['/icons/512.png'],
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'El Pueblo Duerme',
    startupImage: '/icons/512.png',
  },
  icons: {
    icon: [
      { url: '/icons/16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/72.png', sizes: '72x72', type: 'image/png' },
      { url: '/icons/192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/180.png', sizes: '180x180', type: 'image/png' },
      { url: '/icons/152.png', sizes: '152x152', type: 'image/png' },
      { url: '/icons/120.png', sizes: '120x120', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'msapplication-TileColor': '#1c1917',
    'msapplication-TileImage': '/icons/144.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#1c1917',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <head>
        {/* Google AdSense */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4807272408824742"
          crossOrigin="anonymous"
        />
      </head>
      <body className={cn(ptSans.variable, playfair.variable, "font-sans")}>
        <AuthProvider>
          <RegisterSW />
          <WindowControlsOverlay />
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
