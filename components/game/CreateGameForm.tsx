'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers/AuthProvider';
import { db } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2, Copy } from 'lucide-react';
import Image from 'next/image';

const SPECIAL_ROLES = [
  { id: 'vidente', name: 'Vidente', image: '/roles/seer.png', team: 'aldeanos' },
  { id: 'doctor', name: 'Doctor', image: '/roles/Doctor.png', team: 'aldeanos' },
  { id: 'cazador', name: 'Cazador', image: '/roles/hunter.png', team: 'aldeanos' },
  { id: 'cupido', name: 'Cupido', image: '/roles/cupid.png', team: 'neutral' },
  { id: 'guardian', name: 'Guardián', image: '/roles/Guardian.png', team: 'aldeanos' },
  { id: 'sacerdote', name: 'Sacerdote', image: '/roles/priest.png', team: 'aldeanos' },
  { id: 'principe', name: 'Príncipe', image: '/roles/Prince.png', team: 'aldeanos' },
  { id: 'licántropo', name: 'Licántropo', image: '/roles/lycanthrope.png', team: 'aldeanos' },
  { id: 'gemela', name: 'Gemela', image: '/roles/twin.png', team: 'aldeanos' },
  { id: 'hechicera', name: 'Hechicera', image: '/roles/Enchantress.png', team: 'aldeanos' },
  { id: 'cria_lobo', name: 'Cría de Lobo', image: '/roles/wolf_cub.png', team: 'lobos' },
  { id: 'maldito', name: 'Maldito', image: '/roles/cursed.png', team: 'lobos' },
  { id: 'lider_culto', name: 'Líder del Culto', image: '/roles/Cult Leader.png', team: 'neutral' },
  { id: 'pescador', name: 'Pescador', image: '/roles/Fisherman.png', team: 'neutral' },
  { id: 'vampiro', name: 'Vampiro', image: '/roles/Vampire.png', team: 'neutral' },
  { id: 'fantasma', name: 'Fantasma', image: '/roles/Ghost.png', team: 'aldeanos' },
  { id: 'virginia_woolf', name: 'Virginia Woolf', image: '/roles/Virginia Woolf.png', team: 'aldeanos' },
  { id: 'leprosa', name: 'Leprosa', image: '/roles/Leper.png', team: 'aldeanos' },
  { id: 'sirena_rio', name: 'Sirena del Río', image: '/roles/River Siren.png', team: 'aldeanos' },
  { id: 'vigia', name: 'Vigía', image: '/roles/Watcher.png', team: 'aldeanos' },
  { id: 'alborotadora', name: 'Alborotadora', image: '/roles/Troublemaker.png', team: 'aldeanos' },
  { id: 'silenciadora', name: 'Silenciadora', image: '/roles/Silencer.png', team: 'aldeanos' },
  { id: 'aprendiz_vidente', name: 'Aprendiz de Vidente', image: '/roles/Apprentice Seer.png', team: 'aldeanos' },
  { id: 'anciana_lider', name: 'Anciana Líder', image: '/roles/Leader Crone.png', team: 'aldeanos' },
  { id: 'angel_resucitador', name: 'Ángel Resucitador', image: '/roles/angel resucitador.png', team: 'aldeanos' },
  { id: 'bruja', name: 'Bruja', image: '/roles/Witch.png', team: 'lobos' },
  { id: 'hada_buscadora', name: 'Hada Buscadora', image: '/roles/Seeker Faerie.png', team: 'lobos' },
  { id: 'cambiaformas', name: 'Cambiaformas', image: '/roles/Shapeshifter.png', team: 'neutral' },
  { id: 'hombre_ebrio', name: 'Hombre Ebrio', image: '/roles/Drunken Man.png', team: 'neutral' },
  { id: 'hada_durmiente', name: 'Hada Durmiente', image: '/roles/Sleeping Faerie.png', team: 'neutral' },
  { id: 'verdugo', name: 'Verdugo', image: '/roles/verdugo.png', team: 'neutral' },
  { id: 'banshee', name: 'Banshee', image: '/roles/Banshee.png', team: 'neutral' },
];

const TEAM_COLOR: Record<string, string> = {
  aldeanos: 'text-yellow-400',
  lobos: 'text-red-400',
  neutral: 'text-cyan-400',
};

function wolfCount(players: number) {
  return Math.max(1, Math.floor(players / 5));
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 border ${checked ? 'bg-white border-white' : 'bg-transparent border-white/40'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform ${checked ? 'translate-x-6 bg-black' : 'translate-x-0 bg-white/50'}`} />
    </button>
  );
}

export function CreateGameForm() {
  const router = useRouter();
  const { user } = useAuth();

  const [gameName, setGameName] = useState('Partida de Pueblo Duerme');
  const [playerName, setPlayerName] = useState(user?.displayName ?? '');
  const [playerCount, setPlayerCount] = useState(10);
  const [isPublic, setIsPublic] = useState(false);
  const [fillWithAI, setFillWithAI] = useState(false);
  const [juryVote, setJuryVote] = useState(true);
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<{ code: string } | null>(null);

  const toggleRole = (id: string) => {
    setSelectedRoles(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedRoles(new Set(SPECIAL_ROLES.map(r => r.id)));
  const deselectAll = () => setSelectedRoles(new Set());

  const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { setError('Debes iniciar sesión para crear una partida.'); return; }
    setLoading(true);
    setError('');
    try {
      const code = generateCode();
      const docRef = await addDoc(collection(db, 'games'), {
        name: gameName,
        hostUid: user.uid,
        hostName: playerName || user.displayName || 'Jugador',
        code,
        maxPlayers: playerCount,
        wolves: wolfCount(playerCount),
        isPublic,
        fillWithAI,
        juryVote,
        specialRoles: Array.from(selectedRoles),
        playerCount: 1,
        status: 'lobby',
        phase: 'lobby',
        players: [{
          uid: user.uid,
          name: playerName || user.displayName || 'Jugador',
          photoURL: user.photoURL ?? '',
          isHost: true,
          isAlive: true,
          role: null,
        }],
        createdAt: serverTimestamp(),
      });
      router.push(`/game/${docRef.id}`);
    } catch (err) {
      console.error('Error creating game:', err);
      setError('Error al crear la partida. Inténtalo de nuevo.');
      setLoading(false);
    }
  };

  if (created) {
    return (
      <div className="bg-black/40 border border-white/10 rounded-2xl p-8 text-center space-y-6">
        <div className="text-6xl">🎉</div>
        <h2 className="text-2xl font-bold font-headline">¡Partida creada!</h2>
        <p className="text-white/50 text-sm">Comparte este código con tus amigos</p>
        <div className="bg-black/50 border border-white/20 rounded-xl p-6">
          <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Código de sala</p>
          <div className="flex items-center justify-center gap-3">
            <span className="text-5xl font-mono font-bold tracking-widest">{created.code}</span>
            <button
              onClick={() => navigator.clipboard.writeText(created.code)}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              <Copy className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => router.push('/public-rooms')} className="flex-1 bg-white/10 border border-white/20 py-3 rounded-xl hover:bg-white/20 transition-all">
            Ver salas
          </button>
          <button onClick={() => router.push('/')} className="flex-1 bg-white text-black font-bold py-3 rounded-xl hover:bg-white/90 transition-all">
            Inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleCreate} className="space-y-4 max-w-lg mx-auto">
      <div className="bg-black/40 border border-white/10 rounded-xl p-5 space-y-4">
        <div>
          <label className="block text-sm text-white/60 mb-1">Nombre de la Partida</label>
          <input
            type="text"
            value={gameName}
            onChange={e => setGameName(e.target.value)}
            maxLength={50}
            className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-white/40 transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm text-white/60 mb-1">Tu Nombre</label>
          <input
            type="text"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            placeholder={user?.displayName ?? 'Jugador'}
            maxLength={30}
            className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-white/40 transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm text-white/60 mb-1">
            Número de Jugadores ({playerCount})
          </label>
          <input
            type="range"
            min={4}
            max={32}
            value={playerCount}
            onChange={e => setPlayerCount(Number(e.target.value))}
            className="w-full accent-white"
          />
          <p className="text-white/40 text-xs mt-1">
            Esto incluirá {wolfCount(playerCount)} Hombre(s) Lobo.
          </p>
        </div>
      </div>

      <div className="bg-black/40 border border-white/10 rounded-xl p-5 space-y-4">
        <h3 className="font-semibold text-white/80">Ajustes de la Partida</h3>
        {[
          { label: 'Partida Pública', desc: 'Permite que tu partida aparezca en la lista de salas públicas.', value: isPublic, onChange: setIsPublic },
          { label: 'Rellenar con IA', desc: 'Completa los puestos vacíos con jugadores IA al empezar.', value: fillWithAI, onChange: setFillWithAI },
          { label: 'Voto del Jurado', desc: 'Permite a los jugadores muertos votar para desempatar.', value: juryVote, onChange: setJuryVote },
        ].map(item => (
          <div key={item.label} className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-white/40 text-xs mt-0.5">{item.desc}</p>
            </div>
            <Toggle checked={item.value} onChange={item.onChange} />
          </div>
        ))}
      </div>

      <div className="bg-black/40 border border-white/10 rounded-xl p-5 space-y-4">
        <div>
          <h3 className="font-semibold text-white/80">Roles Especiales</h3>
          <p className="text-white/40 text-xs mt-0.5">Selecciona los roles que quieres incluir en la partida.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={selectAll} className="text-xs border border-white/20 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors">
            Seleccionar Todos
          </button>
          <button type="button" onClick={deselectAll} className="text-xs border border-white/20 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors">
            Deseleccionar Todos
          </button>
        </div>
        <div className="grid grid-cols-3 gap-x-3 gap-y-3">
          {SPECIAL_ROLES.map(role => (
            <label key={role.id} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={selectedRoles.has(role.id)}
                onChange={() => toggleRole(role.id)}
                className="sr-only"
              />
              <div className={`w-4 h-4 flex-shrink-0 rounded border transition-colors ${selectedRoles.has(role.id) ? 'bg-white border-white' : 'border-white/30 group-hover:border-white/60'}`}>
                {selectedRoles.has(role.id) && (
                  <svg viewBox="0 0 12 12" className="w-full h-full text-black fill-current">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-5 h-5 flex-shrink-0 rounded overflow-hidden bg-black/30">
                  <Image src={role.image} alt={role.name} width={20} height={20} className="w-full h-full object-cover" />
                </div>
                <span className={`text-xs truncate ${TEAM_COLOR[role.team]}`}>{role.name}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-red-400 text-sm text-center">{error}</p>}

      <button
        type="submit"
        disabled={loading || !user}
        className="w-full flex items-center justify-center gap-2 bg-white/10 border border-white/20 text-white font-semibold py-3 rounded-xl hover:bg-white/20 disabled:opacity-50 transition-all"
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <span>👥</span>}
        {loading ? 'Creando...' : 'Crear Partida'}
      </button>

      {!user && (
        <p className="text-center text-white/40 text-sm">
          <a href="/login" className="text-white underline">Inicia sesión</a> para crear una partida
        </p>
      )}
    </form>
  );
}
