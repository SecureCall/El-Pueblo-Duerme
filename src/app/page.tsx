import Link from 'next/link';

export default function HomePage() {
  return (
    <main>
      <h1>El Pueblo Duerme</h1>
      <p>Bienvenido. El proyecto está en reconstrucción.</p>
      <Link href="/game/test">Ir a una partida de prueba</Link>
    </main>
  );
}
