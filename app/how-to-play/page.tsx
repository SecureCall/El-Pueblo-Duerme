'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';

type Team = 'Aldeanos' | 'Lobos' | 'Neutral';

interface Role {
  name: string;
  team: Team;
  image: string;
  desc: string;
}

const ROLES: Role[] = [
  {
    name: 'Alborotadora',
    team: 'Aldeanos',
    image: '/roles/Troublemaker.png',
    desc: 'Una vez por partida, durante el día, puedes elegir a dos jugadores para que luchen entre sí. Ambos morirán instantáneamente al final de la fase de votación.',
  },
  {
    name: 'Aldeano',
    team: 'Aldeanos',
    image: '/roles/villager.png',
    desc: 'No tienes poderes especiales. Tu única misión es observar, debatir y votar para linchar a los Hombres Lobo y salvar al pueblo.',
  },
  {
    name: 'Anciana Líder',
    team: 'Aldeanos',
    image: '/roles/Leader Crone.png',
    desc: 'Cada noche, eliges a un jugador para exiliarlo. Ese jugador no podrá usar ninguna habilidad nocturna durante esa noche.',
  },
  {
    name: 'Ángel Resucitador',
    team: 'Aldeanos',
    image: '/roles/angel resucitador.png',
    desc: 'Una vez por partida, durante la noche, puedes elegir a un jugador muerto para devolverlo a la vida. El jugador resucitado volverá al juego con su rol original.',
  },
  {
    name: 'Aprendiz de Vidente',
    team: 'Aldeanos',
    image: '/roles/Apprentice Seer.png',
    desc: 'Eres un aldeano normal, pero si la Vidente muere, heredas su poder y te conviertes en la nueva Vidente a partir de la noche siguiente.',
  },
  {
    name: 'Banshee',
    team: 'Neutral',
    image: '/roles/Banshee.png',
    desc: 'Cada noche, predices la muerte de un jugador. Si ese jugador muere esa misma noche (por cualquier causa), ganas un punto. Ganas la partida si acumulas 2 puntos.',
  },
  {
    name: 'Bruja',
    team: 'Lobos',
    image: '/roles/Witch.png',
    desc: 'Eres aliada de los lobos. Cada noche, eliges a un jugador. Si eliges a la Vidente, la descubrirás y los lobos serán informados. Desde ese momento, los lobos no podrán matarte.',
  },
  {
    name: 'Cambiaformas',
    team: 'Neutral',
    image: '/roles/Shapeshifter.png',
    desc: 'En la primera noche, eliges a un jugador. Si esa persona muere, adoptarás su rol y su equipo, transformándote completamente. Tu lealtad es incierta.',
  },
  {
    name: 'Cazador',
    team: 'Aldeanos',
    image: '/roles/hunter.png',
    desc: 'Si mueres, ya sea de noche o linchado de día, tendrás un último disparo. Deberás elegir a otro jugador para que muera contigo. Tu disparo es ineludible.',
  },
  {
    name: 'Cría de Lobo',
    team: 'Lobos',
    image: '/roles/wolf_cub.png',
    desc: 'Eres un lobo joven. Si mueres, la manada se enfurecerá y podrá realizar dos asesinatos en la noche siguiente a tu muerte.',
  },
  {
    name: 'Cupido',
    team: 'Neutral',
    image: '/roles/cupid.png',
    desc: 'Solo en la primera noche, eliges a dos jugadores para que se enamoren. Si uno de ellos muere, el otro morirá también. Su objetivo es sobrevivir juntos, por encima de todo.',
  },
  {
    name: 'Doctor',
    team: 'Aldeanos',
    image: '/roles/Doctor.png',
    desc: 'Cada noche, eliges a un jugador (o a ti mismo) para protegerlo del ataque de los lobos. No puedes proteger a la misma persona dos noches seguidas.',
  },
  {
    name: 'Fantasma',
    team: 'Aldeanos',
    image: '/roles/Ghost.png',
    desc: 'Si mueres, podrás enviar un único mensaje anónimo de 280 caracteres a un jugador vivo de tu elección para intentar guiar al pueblo desde el más allá.',
  },
  {
    name: 'Gemela',
    team: 'Aldeanos',
    image: '/roles/twin.png',
    desc: 'En la primera noche, tú y tu gemelo/a os reconoceréis. A partir de entonces, podréis hablar en un chat privado. Si uno muere, el otro morirá de pena al instante.',
  },
  {
    name: 'Guardián',
    team: 'Aldeanos',
    image: '/roles/Guardian.png',
    desc: 'Cada noche, eliges a un jugador para protegerlo del ataque de los lobos. No puedes proteger a la misma persona dos noches seguidas, y solo puedes protegerte a ti mismo una vez por partida.',
  },
  {
    name: 'Hada Buscadora',
    team: 'Lobos',
    image: '/roles/Seeker Faerie.png',
    desc: 'Equipo de los Lobos. Cada noche, buscas al Hada Durmiente. Si la encuentras, ambas despertáis un poder de un solo uso para matar a un jugador.',
  },
  {
    name: 'Hada Durmiente',
    team: 'Neutral',
    image: '/roles/Sleeping Faerie.png',
    desc: 'Empiezas como Neutral. Si el Hada Buscadora (del equipo de los lobos) te encuentra, os unís. Vuestro objetivo es ser las últimas en pie.',
  },
  {
    name: 'Hechicera',
    team: 'Aldeanos',
    image: '/roles/Enchantress.png',
    desc: 'Posees dos pociones de un solo uso: una de veneno para eliminar a un jugador durante la noche, y una de vida para salvar al objetivo de los lobos. No puedes salvarte a ti misma.',
  },
  {
    name: 'Hombre Ebrio',
    team: 'Neutral',
    image: '/roles/Drunken Man.png',
    desc: 'Ganas la partida en solitario si consigues que el pueblo te linche. No tienes acciones nocturnas; tu habilidad es la manipulación social.',
  },
  {
    name: 'Hombre Lobo',
    team: 'Lobos',
    image: '/roles/werewolf.png',
    desc: 'Cada noche, te despiertas con tu manada para elegir a una víctima. Tu objetivo es eliminar a los aldeanos hasta que vuestro número sea igual o superior.',
  },
  {
    name: 'Leprosa',
    team: 'Aldeanos',
    image: '/roles/Leper.png',
    desc: 'Si los lobos te matan durante la noche, tu enfermedad se propaga a la manada, impidiéndoles atacar en la noche siguiente.',
  },
  {
    name: 'Licántropo',
    team: 'Aldeanos',
    image: '/roles/lycanthrope.png',
    desc: 'Perteneces al equipo del pueblo, pero tienes sangre de lobo. Si la Vidente te investiga, te verá como si fueras un Hombre Lobo, sembrando la confusión.',
  },
  {
    name: 'Líder del Culto',
    team: 'Neutral',
    image: '/roles/Cult Leader.png',
    desc: 'Cada noche, conviertes a un jugador a tu culto. Ganas si todos los jugadores vivos se han unido a tu culto. Juegas solo contra todos.',
  },
  {
    name: 'Maldito',
    team: 'Lobos',
    image: '/roles/cursed.png',
    desc: 'Empiezas como un aldeano. Sin embargo, si eres atacado por los lobos, no mueres; en su lugar, te transformas en un Hombre Lobo y te unes a ellos.',
  },
  {
    name: 'Pescador',
    team: 'Neutral',
    image: '/roles/Fisherman.png',
    desc: 'Cada noche, subes a un jugador a tu barco. Ganas si logras tener a todos los aldeanos vivos en tu barco. Pero si pescas a un lobo, mueres.',
  },
  {
    name: 'Príncipe',
    team: 'Aldeanos',
    image: '/roles/Prince.png',
    desc: 'Si el pueblo vota para lincharte, revelarás tu identidad y sobrevivirás, anulando la votación. Esta habilidad solo se puede usar una vez por partida.',
  },
  {
    name: 'Sacerdote',
    team: 'Aldeanos',
    image: '/roles/priest.png',
    desc: 'Cada noche, otorgas una bendición a un jugador, protegiéndolo de cualquier ataque nocturno (lobos, venenos, etc.). Puedes bendecirte a ti mismo una sola vez por partida.',
  },
  {
    name: 'Silenciadora',
    team: 'Aldeanos',
    image: '/roles/Silencer.png',
    desc: 'Cada noche, eliges a un jugador. Esa persona no podrá hablar (enviar mensajes en el chat) durante todo el día siguiente.',
  },
  {
    name: 'Sirena del Río',
    team: 'Aldeanos',
    image: '/roles/River Siren.png',
    desc: 'En la primera noche, hechizas a un jugador. A partir de entonces, esa persona está obligada a votar por el mismo objetivo que tú durante el día.',
  },
  {
    name: 'Vampiro',
    team: 'Neutral',
    image: '/roles/Vampire.png',
    desc: 'Juegas solo. Cada noche, muerdes a un jugador. Un jugador mordido 3 veces, muere. Si consigues 3 muertes por mordisco, ganas la partida.',
  },
  {
    name: 'Verdugo',
    team: 'Neutral',
    image: '/roles/verdugo.png',
    desc: 'Al inicio se te asigna un objetivo secreto. Tu única misión es convencer al pueblo para que lo linchen. Si lo consigues, ganas la partida en solitario.',
  },
  {
    name: 'Vidente',
    team: 'Aldeanos',
    image: '/roles/seer.png',
    desc: 'Cada noche, eliges a un jugador para investigar. Se te revelará si es un Hombre Lobo o no. (Los Licántropos también son vistos como lobos).',
  },
  {
    name: 'Vigía',
    team: 'Aldeanos',
    image: '/roles/Watcher.png',
    desc: 'Una vez por partida, en la noche, puedes arriesgarte a espiar a los lobos. Si tienes éxito, los conocerás. Si fallas (si los lobos te atacan esa noche), morirás.',
  },
  {
    name: 'Virginia Woolf',
    team: 'Aldeanos',
    image: '/roles/Virginia Woolf.png',
    desc: 'En la primera noche, eliges a un jugador para vincular tu destino. Si tú mueres en cualquier momento de la partida, la persona que elegiste también morirá automáticamente contigo.',
  },
];

const TEAM_COLOR: Record<Team, string> = {
  Aldeanos: 'text-yellow-400',
  Lobos: 'text-red-400',
  Neutral: 'text-cyan-400',
};

const TEAM_BORDER: Record<Team, string> = {
  Aldeanos: 'border-yellow-700/30',
  Lobos: 'border-red-700/30',
  Neutral: 'border-cyan-700/30',
};

type Filter = 'Todos los Roles' | Team;
const FILTERS: Filter[] = ['Todos los Roles', 'Aldeanos', 'Lobos', 'Neutral'];

export default function HowToPlayPage() {
  const [active, setActive] = useState<Filter>('Todos los Roles');

  const shown = active === 'Todos los Roles'
    ? ROLES
    : ROLES.filter(r => r.team === active);

  return (
    <div
      className="relative min-h-screen w-full text-white"
      style={{ backgroundImage: 'url(/noche.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(5, 10, 20, 0.87)' }} />

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-12">
        <div className="mb-10">
          <Link href="/" className="text-white/50 hover:text-white text-sm transition-colors">
            ← Volver al Inicio
          </Link>
        </div>

        <h1 className="font-headline text-5xl font-bold text-center mb-2">Manual de Roles</h1>
        <p className="text-white/50 text-center mb-10 text-sm">
          Explora las habilidades y alianzas de los habitantes de Pueblo Duerme.
        </p>

        <div className="flex justify-center gap-2 mb-10 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setActive(f)}
              className={`px-5 py-2 rounded-lg text-sm font-medium border transition-all ${
                active === f
                  ? 'bg-white text-black border-white'
                  : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10 hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shown.map(role => (
            <div
              key={role.name}
              className={`flex gap-4 bg-white/5 border ${TEAM_BORDER[role.team]} rounded-xl p-4 hover:bg-white/8 transition-colors`}
            >
              <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-black/30">
                <Image
                  src={role.image}
                  alt={role.name}
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`font-bold text-base leading-tight mb-0.5 ${TEAM_COLOR[role.team]}`}>
                  {role.name}
                </h3>
                <p className={`text-xs mb-2 ${TEAM_COLOR[role.team]} opacity-70`}>
                  Equipo: {role.team}
                </p>
                <p className="text-white/60 text-xs leading-relaxed">{role.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white font-medium px-8 py-3 rounded-xl hover:bg-white/20 transition-all"
          >
            🏠 Volver al Inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
