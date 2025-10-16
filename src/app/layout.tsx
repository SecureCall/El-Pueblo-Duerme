import './globals.css'

export const metadata = {
  title: 'El Pueblo Duerme',
  description: 'Juego de roles',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  )
}
