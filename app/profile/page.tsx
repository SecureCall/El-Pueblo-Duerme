'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { Coins, LogOut, ShoppingBag, User, Trophy, Loader2 } from 'lucide-react';

interface UserData {
  displayName: string;
  email: string;
  photoURL: string;
  coins: number;
  createdAt: any;
}

export default function ProfilePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) { router.push('/login'); return; }
    if (!user) return;
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      if (snap.exists()) setUserData(snap.data() as UserData);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user, isLoading, router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/');
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-white/50" />
      </div>
    );
  }

  const displayName = userData?.displayName ?? user?.displayName ?? 'Jugador';
  const coins = userData?.coins ?? 0;
  const avatar = userData?.photoURL ?? user?.photoURL ?? '';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="relative min-h-screen w-full text-white">
      <Image src="/noche.png" alt="Fondo" fill className="object-cover z-0 brightness-40" priority />
      <div className="absolute inset-0 bg-background/80 z-[1]" />
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-12">
        <div className="mb-8">
          <Link href="/" className="text-white/50 hover:text-white text-sm transition-colors">← Volver al Inicio</Link>
        </div>

        {/* Profile card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-6">
          <div className="flex items-center gap-6 mb-8">
            {avatar ? (
              <img src={avatar} alt={displayName} className="w-20 h-20 rounded-full object-cover border-2 border-white/20" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center text-3xl font-bold border-2 border-white/20">
                {initial}
              </div>
            )}
            <div>
              <h1 className="font-headline text-3xl font-bold">{displayName}</h1>
              <p className="text-white/40 text-sm mt-1">{user?.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-center gap-3">
              <Coins className="h-6 w-6 text-yellow-400" />
              <div>
                <p className="text-yellow-300 font-bold text-2xl">{coins.toLocaleString()}</p>
                <p className="text-yellow-400/60 text-xs">monedas</p>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-3">
              <Trophy className="h-6 w-6 text-white/40" />
              <div>
                <p className="text-white font-bold text-2xl">—</p>
                <p className="text-white/40 text-xs">partidas jugadas</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Link href="/store" className="flex items-center justify-center gap-2 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 text-yellow-300 font-bold py-3 rounded-xl transition-all">
              <ShoppingBag className="h-4 w-4" />
              Ir a la Tienda
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white font-medium py-3 rounded-xl transition-all"
            >
              <LogOut className="h-4 w-4" />
              Cerrar Sesión
            </button>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            <User className="h-4 w-4 text-white/40" /> Historial de partidas
          </h2>
          <p className="text-white/30 text-sm text-center py-8">No has jugado ninguna partida todavía.<br />¡Crea o únete a una!</p>
          <Link href="/" className="block text-center bg-white text-black font-bold py-3 rounded-xl hover:bg-white/90 transition-all">
            Jugar ahora
          </Link>
        </div>
      </div>
    </div>
  );
}
