"use client";

import { useEffect, useRef, useState } from 'react';
import { playNarration } from '@/lib/sounds';

export function YouAreDeadOverlay() {
    const hasPlayedSound = useRef(false);
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        if (isVisible && !hasPlayedSound.current) {
            playNarration('muerto.mp3');
            hasPlayedSound.current = true;
        }
    }, [isVisible]);

    if (!isVisible) {
        return null;
    }

    return (
        <div 
            className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in"
            onClick={() => setIsVisible(false)}
        >
            <div className="relative h-64 w-64 md:h-80 md:w-80 mb-4">
                <img
                    src="/zarpa.png"
                    alt="Zarpazo"
                    className="h-full w-full object-contain"
                />
            </div>
            <h1 className="font-headline text-5xl md:text-7xl font-bold text-destructive text-shadow-lg shadow-black/50 mt-8">
                HAS SIDO DEVORADO
            </h1>
            <p className="text-lg text-primary-foreground/70 mt-4">
                Ahora eres un espectador. (Toca para espectar)
            </p>
        </div>
    );
}
