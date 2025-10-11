import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { JoinGameForm } from '@/components/JoinGameForm';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import Image from 'next/image';
import { BookOpen } from 'lucide-react';
import { StaticMusic } from '@/components/StaticMusic';

export default function Home() {
  const bgImage = PlaceHolderImages.find((img) => img.id === 'game-bg-night');

  return (
    <>
      <StaticMusic src="/audio/voz/Que comience el juego..mp3" />
      <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 overflow-hidden">
        {bgImage && (
          <Image
            src={bgImage.imageUrl}
            alt={bgImage.description}
            fill
            className="object-cover z-0"
            data-ai-hint={bgImage.imageHint}
            priority
          />
        )}
        <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
        <main className="relative z-10 flex flex-col items-center justify-center text-center text-primary-foreground space-y-8">
          {/* Usando una etiqueta <img> estándar para forzar la carga del logo */}
          <img
            src="/logo.png"
            alt="El Pueblo Duerme Logo"
            width={250}
            height={250}
            className="rounded-full"
          />
          <h1 className="font-headline text-6xl md:text-8xl font-bold tracking-tight text-shadow-lg shadow-black/50">
            El Pueblo Duerme
          </h1>
          <p className="max-w-2xl text-lg md:text-xl text-primary-foreground/80">
            Una noche más cae sobre el pueblo. Entre vosotros se esconden lobos. ¿Podréis descubrirlos antes de que sea tarde?
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-md">
            <Button asChild size="lg" className="w-full sm:w-auto flex-1 font-bold text-lg">
              <Link href="/create">Crear Nueva Partida</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto text-foreground">
               <Link href="/how-to-play"><BookOpen className="mr-2 h-5 w-5"/> Cómo Jugar</Link>
            </Button>
          </div>
          
          <div className="w-full max-w-md pt-8">
            <p className="mb-4 text-lg font-semibold">O únete a una partida existente:</p>
            <JoinGameForm />
          </div>
        </main>
      </div>
    </>
  );
}
