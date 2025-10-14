
"use client";

import { useEffect, useRef, useState } from 'react';
import { playNarration } from '@/lib/sounds';
import { Gavel } from 'lucide-react';

export function BanishedOverlay() {
    const hasPlayedSound = useRef(false);
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        if (isVisible && !hasPlayedSound.current) {
            playNarration('desterrado por el pueblo.mp3');
            hasPlayedSound.current = true;
        }
    }, [isVisible]);

    useEffect(() => {
        if(isVisible) {
            const timer = setTimeout(() => setIsVisible(false), 5000);
            return () => clearTimeout(timer);
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
            <div className="relative h-64 w-64 md:h-80 md:w-80 mb-4 flex items-center justify-center">
                <Gavel
                    className="h-full w-full object-contain text-amber-700"
                />
            </div>
            <h1 className="font-headline text-5xl md:text-7xl font-bold text-amber-500 text-shadow-lg shadow-black/50 mt-8 text-center">
                ¡Has sido desterrado por el pueblo!
            </h1>
            <p className="text-lg text-primary-foreground/70 mt-4">
                Ahora eres un espectador. (Toca para continuar)
            </p>
        </div>
    );
}
