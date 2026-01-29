
import Image from 'next/image';
import Link from 'next/link';
import { Button } from './components/ui/button';
import { JoinGameForm } from './components/JoinGameForm';
import { GameMusic } from './components/game/GameMusic';
import { PlaceHolderImages } from './lib/placeholder-images';
import { Card, CardContent } from './components/ui/card';

export default function HomePage() {
  const bgImage = PlaceHolderImages.find((img) => img.id === 'home-background');

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
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />

        <main className="relative z-10 flex flex-col items-center text-center text-white space-y-8 w-full max-w-md">
          <div className="space-y-2">
            <h1 className="font-headline text-6xl md:text-8xl font-bold tracking-tight text-shadow-lg shadow-black/50">
              El Pueblo Duerme
            </h1>
            <p className="text-lg md:text-xl text-white/80">
              Un juego de misterio, engaño y supervivencia.
            </p>
          </div>
          
          <div className="w-full space-y-4">
              <JoinGameForm />
              <div className="relative flex items-center">
                  <div className="flex-grow border-t border-border/50"></div>
                  <span className="flex-shrink mx-4 text-muted-foreground">O</span>
                  <div className="flex-grow border-t border-border/50"></div>
              </div>
              <Button asChild className="w-full font-bold text-lg" variant="default">
                <Link href="/create">Crear una Nueva Partida</Link>
              </Button>
          </div>

           <div className="absolute bottom-4 right-4 space-x-4">
              <Button asChild variant="link">
                  <Link href="/public-games">Partidas Públicas</Link>
              </Button>
              <Button asChild variant="link">
                  <Link href="/how-to-play">Cómo Jugar</Link>
              </Button>
               <Button asChild variant="link">
                  <Link href="/profile">Mi Perfil</Link>
              </Button>
          </div>

        </main>
      </div>
    </>
  );
}
