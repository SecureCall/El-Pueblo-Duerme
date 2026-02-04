export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <body style={{margin: 0, padding: 0}}>
        <main>{children}</main>
      </body>
    </html>
  );
}
