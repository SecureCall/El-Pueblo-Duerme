
'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import { PlaceHolderImages } from './lib/placeholder-images';

export default function NotFound() {
  const bgImage = PlaceHolderImages.find((img) => img.id === 'game-bg-night');
  
  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 text-white text-center">
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
      <div className="relative z-10">
        <h1 className="text-9xl font-bold text-destructive">404</h1>
        <h2 className="mt-4 text-4xl font-headline">Página No Encontrada</h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Lo sentimos, no hemos podido encontrar la página que buscas.
        </p>
        <Button asChild className="mt-8">
          <Link href="/">Volver al Inicio</Link>
        </Button>
      </div>
    </div>
  );
}
