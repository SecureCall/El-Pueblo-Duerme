'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers/AuthProvider';
import { db } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2, Users, Lock, Globe, Copy } from 'lucide-react';

const ROLE_PRESETS = [
  { id: 'clasico', label: '🐺 Clásico', desc: 'Lobos, Aldeanos, Vidente, Doctor', min: 6, max: 12 },
  { id: 'social', label: '🎭 Social', desc: 'Añade Cupido, Cazador y Bruja', min: 8, max: 16 },
  { id: 'experto', label: '⚔️ Experto', desc: 'Todos los roles disponibles', min: 10, max: 20 },
  { id: 'personalizado', label: '🔧 Personalizado', desc: 'Configura tu propia partida', min: 4, max: 20 },
];

export function CreateGameForm() {
  const router = useRouter();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [preset, setPreset] = useState('clasico');
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<{ code: string; id: string } | null>(null);

  const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { setError('Debes iniciar sesión para crear una partida.'); return; }
    setLoading(true);
    setError('');

    try {
      const code = generateCode();
      const selectedPreset = ROLE_PRESETS.find(p => p.id === preset)!;

      const docRef = await addDoc(collection(db, 'publicGames'), {
        name: name || `Partida de ${user.displayName ?? 'Jugador'}`,
        hostUid: user.uid,
        hostName: user.displayName ?? 'Jugador',
        code,
        preset,
        presetLabel: selectedPreset.label,
        maxPlayers,
        currentPlayers: 1,
        isPublic,
        status: 'waiting',
        createdAt: serverTimestamp(),
      });

      setCreated({ code, id: docRef.id });
    } catch {
      setError('Error al crear la partida. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    if (created) navigator.clipboard.writeText(created.code);
  };

  if (created) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center space-y-6">
        <div className="text-6xl">🎉</div>
        <div>
          <h2 className="text-2xl font-bold font-headline mb-2">¡Partida creada!</h2>
          <p className="text-white/50 text-sm">Comparte este código con tus amigos para que se unan</p>
        </div>
        <div className="bg-black/40 border border-white/20 rounded-xl p-6">
          <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Código de sala</p>
          <div className="flex items-center justify-center gap-3">
            <span className="text-5xl font-mono font-bold tracking-widest text-white">{created.code}</span>
            <button
              onClick={copyCode}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              title="Copiar código"
            >
              <Copy className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/public-rooms')}
            className="flex-1 bg-white/10 border border-white/20 text-white font-medium py-3 rounded-xl hover:bg-white/20 transition-all"
          >
            Ver salas públicas
          </button>
          <button
            onClick={() => router.push('/')}
            className="flex-1 bg-white text-black font-bold py-3 rounded-xl hover:bg-white/90 transition-all"
          >
            Ir al inicio
          </button>
        </div>
      </div>
    );
  }

  const selectedPreset = ROLE_PRESETS.find(p => p.id === preset)!;

  return (
    <form onSubmit={handleCreate} className="space-y-6">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">Nombre de la partida</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={`Partida de ${user?.displayName ?? 'Jugador'}`}
            maxLength={40}
            className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-white/50 transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">Modo de juego</label>
          <div className="grid grid-cols-2 gap-2">
            {ROLE_PRESETS.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => { setPreset(p.id); setMaxPlayers(Math.min(maxPlayers, p.max)); }}
                className={`text-left p-3 rounded-xl border transition-all ${
                  preset === p.id
                    ? 'bg-white/15 border-white/40'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                <p className="font-medium text-sm">{p.label}</p>
                <p className="text-white/40 text-xs mt-0.5">{p.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">
            Jugadores máximos: <span className="text-white font-bold">{maxPlayers}</span>
          </label>
          <input
            type="range"
            min={selectedPreset.min}
            max={selectedPreset.max}
            value={maxPlayers}
            onChange={e => setMaxPlayers(Number(e.target.value))}
            className="w-full accent-white"
          />
          <div className="flex justify-between text-white/30 text-xs mt-1">
            <span>{selectedPreset.min} min</span>
            <span>{selectedPreset.max} max</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">Visibilidad</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsPublic(true)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                isPublic ? 'bg-white/15 border-white/40' : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
            >
              <Globe className="h-4 w-4" /> Pública
            </button>
            <button
              type="button"
              onClick={() => setIsPublic(false)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                !isPublic ? 'bg-white/15 border-white/40' : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
            >
              <Lock className="h-4 w-4" /> Privada
            </button>
          </div>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm text-center">{error}</p>}

      <button
        type="submit"
        disabled={loading || !user}
        className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-white/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 text-lg"
      >
        {loading && <Loader2 className="h-5 w-5 animate-spin" />}
        {loading ? 'Creando partida...' : '🎮 Crear Partida'}
      </button>

      {!user && (
        <p className="text-center text-white/40 text-sm">
          <a href="/login" className="text-white underline">Inicia sesión</a> para crear una partida
        </p>
      )}
    </form>
  );
}
