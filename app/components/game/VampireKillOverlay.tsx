
"use client";

import { useEffect, useRef, useState } from 'react';
import { playNarration } from '../../lib/sounds';
import { VampireIcon } from '../icons';

interface VampireKillOverlayProps {
    angelInPlay: boolean;
}

export function VampireKillOverlay({ angelInPlay }: VampireKillOverlayProps) {
    const hasPlayedSound = useRef(false);
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        if (isVisible && !hasPlayedSound.current) {
            playNarration('muerte vampiro.mp3');
            hasPlayedSound.current = true;
        }
    }, [isVisible]);

    useEffect(() => {
        if(isVisible) {
            const timer = setTimeout(() => setIsVisible(false), 8000);
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
                <VampireIcon
                    className="h-full w-full object-contain text-red-900"
                />
            </div>
            <h1 className="font-headline text-5xl md:text-7xl font-bold text-red-700 text-shadow-lg shadow-black/50 mt-8 text-center">
                El vampiro te ha desangrado
            </h1>
            {angelInPlay && (
                 <p className="text-lg text-yellow-300 mt-4 animate-pulse">
                    Pero no pierdas la esperanza... un Ángel Resucitador podría devolverte a la vida.
                </p>
            )}
            <p className="text-lg text-primary-foreground/70 mt-4">
                Ahora eres un espectador. (Toca para continuar)
            </p>
        </div>
    );
}
