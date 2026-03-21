import Image from 'next/image';
import Link from 'next/link';

const ROLES = [
  { icon: '🐺', name: 'El Lobo', color: 'from-red-900/40 to-red-800/20', border: 'border-red-700/40', desc: 'Cada noche, los lobos eligen a una víctima para eliminar. Durante el día, deben ocultarse entre los aldeanos y evitar ser descubiertos.' },
  { icon: '👁️', name: 'El Vidente', color: 'from-purple-900/40 to-purple-800/20', border: 'border-purple-700/40', desc: 'Cada noche puede investigar a un jugador y descubrir si es lobo o aldeano. Debe usar su conocimiento con sabiduría.' },
  { icon: '👨‍⚕️', name: 'El Médico', color: 'from-green-900/40 to-green-800/20', border: 'border-green-700/40', desc: 'Cada noche puede proteger a un jugador de los ataques de los lobos. Puede protegerse a sí mismo.' },
  { icon: '🧑‍🌾', name: 'Aldeano', color: 'from-amber-900/40 to-amber-800/20', border: 'border-amber-700/40', desc: 'No tiene poderes especiales, pero su voto es fundamental. Debe observar, debatir y descubrir a los lobos ocultos.' },
  { icon: '🎭', name: 'El Bufón', color: 'from-pink-900/40 to-pink-800/20', border: 'border-pink-700/40', desc: 'Gana si consigue que el pueblo lo vote para ser eliminado. Un rol de engaño puro.' },
  { icon: '🔫', name: 'El Cazador', color: 'from-orange-900/40 to-orange-800/20', border: 'border-orange-700/40', desc: 'Al ser eliminado, puede llevarse a otro jugador con él. Un poder de último recurso.' },
];

const PHASES = [
  { num: '1', title: 'El Pueblo se presenta', desc: 'Todos los jugadores reciben su rol en secreto. El narrador explica las reglas.' },
  { num: '2', title: 'Cae la noche', desc: 'Todos "duermen". Los lobos eligen una víctima. El médico protege. El vidente investiga.' },
  { num: '3', title: 'Amanece', desc: 'Se revela quién fue atacado durante la noche (si no fue protegido).' },
  { num: '4', title: 'Debate y votación', desc: 'El pueblo debate y vota para eliminar a quien crean que es el lobo.' },
  { num: '5', title: '¿Quién gana?', desc: 'Los aldeanos ganan si eliminan a todos los lobos. Los lobos ganan si son mayoría.' },
];

export default function HowToPlayPage() {
  return (
    <div className="relative min-h-screen w-full text-white">
      <Image src="/noche.png" alt="Fondo" fill className="object-cover z-0 brightness-40" priority />
      <div className="absolute inset-0 bg-background/80 z-[1]" />
      <div className="relative z-10 max-w-4xl mx-auto px-4 py-12">
        <div className="mb-8">
          <Link href="/" className="text-white/50 hover:text-white text-sm transition-colors">← Volver al Inicio</Link>
        </div>
        <h1 className="font-headline text-5xl font-bold text-center mb-2">Cómo Jugar</h1>
        <p className="text-white/50 text-center mb-12">Aprende las reglas de El Pueblo Duerme</p>

        <div className="mb-14">
          <h2 className="text-2xl font-bold font-headline mb-6">El objetivo</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <p className="text-3xl mb-3">🧑‍🌾</p>
              <h3 className="font-bold text-lg mb-2">Aldeanos</h3>
              <p className="text-white/60 text-sm">Descubrir y eliminar a todos los lobos antes de que sean mayoría en el pueblo.</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <p className="text-3xl mb-3">🐺</p>
              <h3 className="font-bold text-lg mb-2">Lobos</h3>
              <p className="text-white/60 text-sm">Pasar desapercibidos y eliminar suficientes aldeanos hasta ser mayoría.</p>
            </div>
          </div>
        </div>

        <div className="mb-14">
          <h2 className="text-2xl font-bold font-headline mb-6">Fases del juego</h2>
          <div className="space-y-3">
            {PHASES.map(p => (
              <div key={p.num} className="flex gap-4 bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex-shrink-0 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center font-bold text-lg">{p.num}</div>
                <div>
                  <h3 className="font-bold">{p.title}</h3>
                  <p className="text-white/60 text-sm mt-1">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-14">
          <h2 className="text-2xl font-bold font-headline mb-6">Roles disponibles</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {ROLES.map(r => (
              <div key={r.name} className={`bg-gradient-to-br ${r.color} border ${r.border} rounded-xl p-5`}>
                <p className="text-4xl mb-3">{r.icon}</p>
                <h3 className="font-bold mb-2">{r.name}</h3>
                <p className="text-white/60 text-sm">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center">
          <Link href="/create" className="inline-block bg-white text-black font-bold px-8 py-4 rounded-xl hover:bg-white/90 transition-all text-lg">
            ¡Crear una Partida!
          </Link>
        </div>
      </div>
    </div>
  );
}
