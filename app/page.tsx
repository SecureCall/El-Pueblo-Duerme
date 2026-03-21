'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { ShoppingBag, LogOut } from 'lucide-react';
import { auth } from '@/lib/firebase/config';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { JoinByCodeModal } from '@/components/JoinByCodeModal';

export default function HomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [showJoinModal, setShowJoinModal] = useState(false);

  const handleLogout = async () => {
    await signOut(auth);
    router.refresh();
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden">
      <Image
        src="/noche.png"
        alt="Bosque oscuro y misterioso"
        fill
        className="object-cover z-0"
        priority
      />
      <div className="absolute inset-0 bg-background/65 z-[1]" />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-6 py-4">
        <div />
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="text-white/60 text-sm hidden sm:block">{user.displayName || user.email}</span>
              <button onClick={handleLogout} className="text-white/60 hover:text-white text-sm flex items-center gap-1 transition-colors">
                <LogOut className="h-4 w-4" /> Salir
              </button>
            </>
          ) : (
            <Link href="/login" className="text-white/70 hover:text-white text-sm transition-colors">
              Iniciar Sesión
            </Link>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center text-center px-4">
        {/* Logo */}
        <Image
          src="/logo.png"
          alt="El Pueblo Duerme"
          width={160}
          height={160}
          className="drop-shadow-2xl mb-6 rounded-full"
          priority
        />

        {/* Title */}
        <h1 className="font-headline text-7xl md:text-8xl lg:text-9xl font-bold text-white leading-none tracking-tight mb-6" style={{ textShadow: '0 4px 30px rgba(0,0,0,0.8)' }}>
          El Pueblo<br />Duerme
        </h1>

        {/* Subtitle */}
        <p className="text-white/80 text-base md:text-lg max-w-md mb-10 leading-relaxed">
          Una noche más cae sobre el pueblo. Entre vosotros se esconden lobos. ¿Podréis descubrirlos antes de que sea tarde?
        </p>

        {/* Navigation buttons */}
        <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4">
          <Link
            href="/create"
            className="bg-white text-black font-bold px-6 py-3 rounded-md hover:bg-white/90 transition-all text-sm md:text-base"
          >
            Crear Partida
          </Link>
          <Link
            href="/public-rooms"
            className="text-white/90 hover:text-white font-medium px-6 py-3 transition-colors text-sm md:text-base"
          >
            Salas Públicas
          </Link>
          <Link
            href="/how-to-play"
            className="text-white/90 hover:text-white font-medium px-6 py-3 transition-colors text-sm md:text-base"
          >
            Cómo Jugar
          </Link>
          <Link
            href={user ? '/profile' : '/login'}
            className="text-white/90 hover:text-white font-medium px-6 py-3 transition-colors text-sm md:text-base"
          >
            Mi Perfil
          </Link>
          <Link
            href="/store"
            className="text-yellow-400 hover:text-yellow-300 font-medium px-6 py-3 transition-colors text-sm md:text-base flex items-center gap-1"
          >
            <ShoppingBag className="h-4 w-4" /> Tienda
          </Link>
        </div>

        {/* Join by code */}
        <button
          onClick={() => setShowJoinModal(true)}
          className="mt-8 text-white/50 hover:text-white/80 text-sm transition-colors underline underline-offset-4"
        >
          O únete con un código
        </button>
      </div>

      {showJoinModal && <JoinByCodeModal onClose={() => setShowJoinModal(false)} />}
    </div>
  );
}
