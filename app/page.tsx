import Image from 'next/image';
import Link from 'next/link';
import { Button } from './components/ui/button';
import { JoinGameForm } from './components/JoinGameForm';
import { GameMusic } from './components/game/GameMusic';
import { PlaceHolderImages } from './lib/placeholder-images';

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

        <main className="relative z-10 flex flex-col items-center text-center text-white space-y-8 w-full max-w-2xl">
          <div className="relative h-48 w-48 rounded-full overflow-hidden shadow-lg">
             <Image
                src="/logo.png"
                alt="El Pueblo Duerme Logo"
                fill
                className="object-contain"
                priority
              />
          </div>

          <div className="space-y-2">
            <h1 className="font-headline text-6xl md:text-8xl font-bold tracking-tight text-shadow-lg shadow-black/50">
              El Pueblo Duerme
            </h1>
            <p className="text-lg md:text-xl text-white/80 max-w-lg text-center">
              Una noche más cae sobre el pueblo. Entre vosotros se esconden lobos. ¿Podréis descubrirlos antes de que sea tarde?
            </p>
          </div>
          
          <div className="flex items-baseline justify-center gap-x-6">
            <Button asChild variant="secondary" size="lg">
              <Link href="/create">Crear Partida</Link>
            </Button>
            <Button asChild variant="link" className="text-white/80 hover:text-white hover:no-underline">
                <Link href="/public-games">Salas Públicas</Link>
            </Button>
            <Button asChild variant="link" className="text-white/80 hover:text-white hover:no-underline">
                <Link href="/how-to-play">Cómo Jugar</Link>
            </Button>
            <Button asChild variant="link" className="text-white/80 hover:text-white hover:no-underline">
                <Link href="/profile">Mi Perfil</Link>
            </Button>
          </div>

          <div className="w-full max-w-md pt-6">
            <div className="relative flex items-center py-4">
                <div className="flex-grow border-t border-border/50"></div>
                <span className="flex-shrink mx-4 text-muted-foreground">O únete con un código</span>
                <div className="flex-grow border-t border-border/50"></div>
            </div>
            <JoinGameForm />
          </div>

        </main>
      </div>
    </>
  );
}
