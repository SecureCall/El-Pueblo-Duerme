
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Users, LogIn } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 overflow-hidden">
      <Image
        src="/noche.png"
        alt="Un misterioso y oscuro bosque brumoso por la noche."
        fill
        className="object-cover z-0 brightness-75"
        priority
      />
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center text-center text-white space-y-8">
        <h1 className="font-headline text-6xl md:text-8xl font-bold tracking-tight text-shadow-lg shadow-black/50">
          El Pueblo Duerme
        </h1>
        <p className="text-lg md:text-xl text-white/80 max-w-3xl">
          Un juego de misterio, engaño y supervivencia. ¿Tienes lo necesario para descubrir la verdad antes de que sea demasiado tarde?
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="text-lg font-bold px-8 py-6">
                <Link href="/create-game">
                    <Users className="mr-2 h-6 w-6" />
                    Crear Partida
                </Link>
            </Button>
            <Button asChild size="lg" variant="secondary" className="text-lg font-bold px-8 py-6">
                 <Link href="/join-game">
                    <LogIn className="mr-2 h-6 w-6" />
                    Unirse a Partida
                </Link>
            </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto pt-10">
          <div className="bg-black/30 p-6 rounded-xl border border-white/10 backdrop-blur-md">
            <h3 className="text-2xl font-bold font-headline mb-3 text-accent">Roles Dinámicos</h3>
            <p className="text-white/80">Descubre docenas de roles especiales que aseguran que no haya dos partidas iguales.</p>
          </div>
          <div className="bg-black/30 p-6 rounded-xl border border-white/10 backdrop-blur-md">
            <h3 className="text-2xl font-bold font-headline mb-3 text-accent">Juego Masivo</h3>
            <p className="text-white/80">Participa en intensas batallas sociales con hasta 32 jugadores en una sola partida.</p>
          </div>
          <div className="bg-black/30 p-6 rounded-xl border border-white/10 backdrop-blur-md">
            <h3 className="text-2xl font-bold font-headline mb-3 text-accent">Acción en Vivo</h3>
            <p className="text-white/80">Vive la tensión con actualizaciones en tiempo real gracias a la potencia de Firebase.</p>
          </div>
        </div>
      </main>
      
      <footer className="relative z-10 py-8 text-center text-white/60 text-sm">
        <p>&copy; {new Date().getFullYear()} El Pueblo Duerme. Todos los derechos reservados.</p>
         <div className="flex justify-center gap-4 mt-2">
            <Link href="/terms" className="hover:text-white">Términos de Servicio</Link>
            <span>|</span>
            <Link href="/privacy" className="hover:text-white">Política de Privacidad</Link>
        </div>
      </footer>
    </div>
  );
}
