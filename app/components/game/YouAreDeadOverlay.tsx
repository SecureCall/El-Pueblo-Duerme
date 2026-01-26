
"use client";

import { useEffect, useRef, useState } from 'react';
import { playNarration } from '../../lib/sounds';
import { Skull, HeartCrack } from 'lucide-react';

interface YouAreDeadOverlayProps {
    angelInPlay: boolean;
    isWolfKill?: boolean;
    cause?: string;
}

export function YouAreDeadOverlay({ angelInPlay, isWolfKill = false, cause }: YouAreDeadOverlayProps) {
    const hasPlayedSound = useRef(false);
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        if (isVisible && !hasPlayedSound.current) {
            playNarration('muerto.mp3');
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

    let title = "HAS SIDO ELIMINADO";
    let icon = <Skull className="h-full w-full object-contain text-destructive" />;

    if (isWolfKill) {
        title = "HAS SIDO DEVORADO";
        icon = <img src="/zarpazo.svg" alt="Zarpazo" className="h-full w-full object-contain filter-destructive" />;
    } else if (cause === 'lover_death') {
        title = "MUERTO DE AMOR";
        icon = <HeartCrack className="h-full w-full object-contain text-pink-400" />;
    } else if (cause === 'troublemaker_duel') {
        title = "HAS CAÍDO EN COMBATE";
        icon = <Skull className="h-full w-full object-contain text-amber-600" />;
    }


    return (
        <div 
            className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in"
            onClick={() => setIsVisible(false)}
        >
            <div className="relative h-64 w-64 md:h-80 md:w-80 mb-4 flex items-center justify-center">
                 {icon}
            </div>
            <h1 className="font-headline text-5xl md:text-7xl font-bold text-destructive text-shadow-lg shadow-black/50 mt-8">
                {title}
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
