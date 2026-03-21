'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2 } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

interface Props {
  onClose: () => void;
}

export function JoinByCodeModal({ onClose }: Props) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const gameId = code.trim().toUpperCase();
    if (!gameId) return;
    setLoading(true);
    setError('');
    try {
      const snap = await getDoc(doc(db, 'games', gameId));
      if (snap.exists()) {
        router.push(`/game/${gameId}`);
      } else {
        setError('No se encontró ninguna partida con ese código.');
      }
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-[#0d1117] border border-white/20 rounded-2xl p-8 w-full max-w-sm shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors">
          <X className="h-5 w-5" />
        </button>
        <h2 className="text-white font-headline text-2xl font-bold mb-2">Unirse con código</h2>
        <p className="text-white/50 text-sm mb-6">Introduce el código de la sala</p>
        <form onSubmit={handleJoin} className="space-y-4">
          <input
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="ABCDE"
            maxLength={10}
            className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white text-center text-2xl tracking-widest font-mono focus:outline-none focus:border-white/50 placeholder:text-white/20"
          />
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading || code.trim().length < 3}
            className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-white/90 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Unirse
          </button>
        </form>
      </div>
    </div>
  );
}
