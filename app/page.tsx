import Link from 'next/link';

export default function HomePage() {
  return (
    <div style={{ padding: '50px', textAlign: 'center', background: '#0f172a', color: 'white', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '4rem', marginBottom: '1rem' }}>EL PUEBLO DUERME</h1>
      <p style={{ fontSize: '1.5rem', marginBottom: '3rem' }}>Juego multijugador para 32 jugadores</p>
      
      <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link href="/game" style={{ textDecoration: 'none' }}>
          <button style={{ padding: '15px 30px', fontSize: '1.2rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px' }}>
            🎮 ENTRAR AL JUEGO
          </button>
        </Link>
        
        <Link href="/create" style={{ textDecoration: 'none' }}>
          <button style={{ padding: '15px 30px', fontSize: '1.2rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px' }}>
            🏠 CREAR PARTIDA
          </button>
        </Link>
        
        <Link href="/login" style={{ textDecoration: 'none' }}>
          <button style={{ padding: '15px 30px', fontSize: '1.2rem', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '8px' }}>
            🔐 INICIAR SESIÓN
          </button>
        </Link>
      </div>
      
      <div style={{ marginTop: '50px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', maxWidth: '900px', margin: '50px auto' }}>
        <div style={{ padding: '20px', backgroundColor: '#1e293b', borderRadius: '10px' }}>
          <h3>👥 32 JUGADORES</h3>
          <p>Partidas masivas con estrategia compleja</p>
        </div>
        <div style={{ padding: '20px', backgroundColor: '#1e293b', borderRadius: '10px' }}>
          <h3>🌙 7 ROLES ÚNICOS</h3>
          <p>Lobos, Videntes, Curanderos, Cazadores</p>
        </div>
        <div style={{ padding: '20px', backgroundColor: '#1e293b', borderRadius: '10px' }}>
          <h3>⚡ TIEMPO REAL</h3>
          <p>Firebase para conexiones instantáneas</p>
        </div>
      </div>
    </div>
  );
}
