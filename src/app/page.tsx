
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { JoinGameForm } from '@/components/JoinGameForm';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import Image from 'next/image';
import { BookOpen, Users } from 'lucide-react';
import { GameMusic } from '@/components/game/GameMusic';
import { useEffect } from 'react';
import { playNarration } from '@/lib/sounds';

export default function Home() {
  const bgImage = PlaceHolderImages.find((img) => img.id === 'game-bg-night');
  
  useEffect(() => {
    playNarration('Que comience el juego..mp3');
  }, []);

  return (
    <>
      <GameMusic src="/audio/menu-theme.mp3" />
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-lg">
            <Button asChild size="lg" className="w-full font-bold text-lg">
              <Link href="/create">Crear Partida</Link>
            </Button>
             <Button asChild size="lg" variant="secondary" className="w-full font-bold text-lg text-foreground">
              <Link href="/public-games"><Users className="mr-2 h-5 w-5"/> Salas Públicas</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full text-foreground">
               <Link href="/how-to-play"><BookOpen className="mr-2 h-5 w-5"/> Cómo Jugar</Link>
            </Button>
          </div>
          
          <div className="w-full max-w-md pt-8">
            <p className="mb-4 text-lg font-semibold">O únete con un código:</p>
            <JoinGameForm />
          </div>
        </main>
      </div>
    </>
  );
}
