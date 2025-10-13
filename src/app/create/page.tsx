import { CreateGameForm } from '@/components/game/CreateGameForm';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { GameMusic } from '@/components/game/GameMusic';
import Image from 'next/image';

export default function CreateGamePage() {
    const bgImage = PlaceHolderImages.find((img) => img.id === 'game-bg-night');
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

                <main className="relative z-10 flex flex-col items-center text-center text-primary-foreground space-y-6 w-full max-w-md">
                    <h1 className="font-headline text-5xl md:text-6xl font-bold tracking-tight text-shadow-lg shadow-black/50">
                        Crear Partida
                    </h1>
                    <p className="text-lg text-primary-foreground/80">
                        Configura las reglas de tu nueva partida y reúne a tus amigos.
                    </p>
                    <CreateGameForm />
                </main>
            </div>
        </>
    );
}
