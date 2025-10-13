
"use client";

import Image from 'next/image';
import { useEffect, useRef } from 'react';
import { playNarration } from '@/lib/sounds';

export function YouAreDeadOverlay() {
    const hasPlayedSound = useRef(false);

    useEffect(() => {
        if (!hasPlayedSound.current) {
            playNarration('muerto.mp3');
            hasPlayedSound.current = true;
        }
    }, []);

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in">
            <div className="relative h-64 w-64 md:h-80 md:w-80">
                <Image
                    src="/zapa.svg"
                    alt="Has sido eliminado"
                    fill
                    className="object-contain"
                    unoptimized
                />
            </div>
            <h1 className="font-headline text-5xl md:text-7xl font-bold text-destructive text-shadow-lg shadow-black/50 mt-8">
                HAS SIDO DEVORADO
            </h1>
            <p className="text-lg text-primary-foreground/70 mt-4">
                Ahora eres un espectador.
            </p>
        </div>
    );
}
