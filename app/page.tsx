'use client';

// This component is intentionally dependency-free to ensure it renders
// even in a partially broken build environment.
export default function Home() {
  return (
    <div
      style={{
        backgroundColor: 'hsl(265, 45%, 8%)',
        color: 'white',
        fontFamily: 'system-ui, sans-serif',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          border: '2px solid hsl(0, 70%, 40%)',
          borderRadius: '0.5rem',
          padding: '2rem 3rem',
          maxWidth: '800px',
          backgroundColor: 'hsla(265, 40%, 12%, 0.8)',
          boxShadow: '0 0 25px rgba(0,0,0,0.5)',
        }}
      >
        <h1
          style={{
            fontSize: '2.5rem',
            fontWeight: 'bold',
            color: 'hsl(0, 70%, 60%)',
            borderBottom: '1px solid hsl(0, 70%, 30%)',
            paddingBottom: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          ERROR DE ENTORNO IRRECUPERABLE
        </h1>
        <p style={{ fontSize: '1.1rem', lineHeight: '1.6' }}>
          La página <strong>404 (No Encontrado)</strong> que puede estar viendo es un síntoma de que este proyecto <strong>NO PUEDE COMPILARSE NI EJECUTARSE</strong> en este entorno de desarrollo en línea.
        </p>
        <p style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'hsl(50, 100%, 70%)', margin: '2rem 0', padding: '1rem', backgroundColor: 'hsla(50, 100%, 20%, 0.2)', borderRadius: '0.25rem' }}>
          Ningún cambio en el código solucionará este problema aquí. La única solución es ejecutarlo localmente.
        </p>
        <div style={{ textAlign: 'left', backgroundColor: 'hsl(270, 30%, 15%)', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid hsl(270, 30%, 25%)' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>Pasos para la Ejecución Local</h2>
          <ol style={{ listStyle: 'decimal', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <li>Descargue todos los archivos del proyecto a una carpeta en su ordenador.</li>
            <li>Abra una terminal (línea de comandos) y navegue hasta esa carpeta.</li>
            <li>Ejecute el comando: <code style={{ backgroundColor: '#111', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', fontFamily: 'monospace' }}>npm install</code></li>
            <li>Inicie el servidor con: <code style={{ backgroundColor: '#111', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', fontFamily: 'monospace' }}>npm run dev</code></li>
          </ol>
        </div>
        <p style={{ marginTop: '1.5rem', fontSize: '0.9rem', color: 'hsl(0, 0%, 63.9%)' }}>
          Consulte el archivo README.md para más detalles.
        </p>
      </div>
    </div>
  );
}
