'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Users, Lock, Globe, Loader2, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Room {
  id: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  status: string;
  isPublic: boolean;
  createdAt: any;
}

export default function PublicRoomsPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'games'),
      where('isPublic', '==', true),
      where('status', '==', 'lobby'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const unsub = onSnapshot(q, snap => {
      setRooms(snap.docs.map(d => ({ id: d.id, ...d.data() } as Room)));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  return (
    <div className="relative min-h-screen w-full text-white" style={{ backgroundImage: 'url(/noche.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(5, 10, 20, 0.85)' }} />
      <div className="relative z-10 max-w-4xl mx-auto px-4 py-12">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="text-white/50 hover:text-white text-sm transition-colors">← Volver al Inicio</Link>
          <Link href="/create" className="flex items-center gap-2 bg-white text-black font-bold px-4 py-2 rounded-lg hover:bg-white/90 transition-all text-sm">
            <Plus className="h-4 w-4" /> Crear Sala
          </Link>
        </div>

        <h1 className="font-headline text-5xl font-bold text-center mb-2">Salas Públicas</h1>
        <p className="text-white/50 text-center mb-10">Únete a una partida en curso</p>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-white/50" />
          </div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-6xl mb-4">🌙</p>
            <p className="text-white/50 text-lg">No hay salas públicas en este momento</p>
            <p className="text-white/30 text-sm mt-2">¡Sé el primero en crear una!</p>
            <Link href="/create" className="inline-block mt-6 bg-white text-black font-bold px-6 py-3 rounded-xl hover:bg-white/90 transition-all">
              Crear Partida
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {rooms.map(room => (
              <button
                key={room.id}
                onClick={() => router.push(`/game/${room.id}`)}
                className="w-full text-left bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 rounded-xl p-5 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-white/10 rounded-lg p-3">
                    <Globe className="h-5 w-5 text-white/60" />
                  </div>
                  <div>
                    <p className="font-bold text-white">Sala de {room.hostName ?? 'Anónimo'}</p>
                    <p className="text-white/40 text-sm font-mono">{room.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-white/60">
                    <Users className="h-4 w-4" />
                    <span className="text-sm">{room.playerCount ?? 1}/{room.maxPlayers ?? 8}</span>
                  </div>
                  <span className="bg-green-500/20 text-green-400 text-xs px-3 py-1 rounded-full border border-green-500/30">
                    Abierta
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
