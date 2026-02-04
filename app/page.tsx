
"use client";

import { useAuth } from '@/app/providers/AuthProvider';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';

export default function HomePage() {
  const { user, isLoading } = useAuth();

  const renderContent = () => {
    if (isLoading) {
      return (
          <div className="flex flex-col items-center gap-4 text-white">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            <p className="text-xl text-primary-foreground/80">Cargando...</p>
          </div>
      );
    }

    if (user) {
      return (
        <>
          <h1 className="text-4xl md:text-6xl font-bold mb-4 tracking-tight">
            Bienvenido, <span className="text-primary">{user.displayName || 'jugador'}</span>
          </h1>
          <p className="text-lg md:text-xl mb-12 text-gray-300 max-w-2xl mx-auto">
            El pueblo te espera. ¿Estás listo para descubrir la verdad?
          </p>
          <div className="flex flex-col md:flex-row gap-6 justify-center">
            <Button asChild size="lg" className="text-xl font-bold">
              <Link href="/create">🎮 CREAR PARTIDA</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="text-xl font-bold">
                <Link href="/join">🔗 UNIRSE A PARTIDA</Link>
            </Button>
          </div>
        </>
      );
    }

    return (
      <>
        <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight">
          EL PUEBLO DUERME
        </h1>
        <p className="text-xl mb-12 text-gray-300 max-w-2xl mx-auto">
          Un juego de misterio, engaño y supervivencia.
        </p>
        <div className="flex justify-center">
            <Button asChild size="lg" className="text-xl font-bold">
              <Link href="/login">🔗 INICIAR SESIÓN PARA JUGAR</Link>
            </Button>
        </div>
      </>
    );
  };
  
  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 overflow-hidden text-white">
      <Image
          src="/noche.png"
          alt="A mysterious, dark, misty forest at night."
          fill
          className="object-cover z-0"
          priority
        />
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      <main className="relative z-10 container mx-auto px-4 py-16 text-center">
        {renderContent()}
      </main>
        <footer className="absolute bottom-4 text-center w-full z-10 text-xs text-white/50">
            <p>El Pueblo Duerme &copy; {new Date().getFullYear()}. Todos los derechos reservados.</p>
            <p className="mt-1">
                <Link href="/terms" className="underline hover:text-white">Términos de Servicio</Link> | <Link href="/privacy" className="underline hover:text-white">Política de Privacidad</Link>
            </p>
      </footer>
    </div>
  );
}
