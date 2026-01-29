import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'El Pueblo Duerme',
  description: 'Un juego de misterio y deducción social.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
