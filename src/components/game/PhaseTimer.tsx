
"use client";

import { useState, useEffect, useRef } from 'react';
import { Progress } from '../ui/progress';
import type { Game } from '@/types';
import { Timestamp } from 'firebase/firestore';

interface PhaseTimerProps {
    game: Game;
    isCreator: boolean;
}

export function PhaseTimer({ game, isCreator }: PhaseTimerProps) {
    const getDuration = () => {
        if (!game.phaseEndsAt) return 0;
        // The timestamp can be a Firebase Timestamp or a plain object after serialization
        const phaseEndMillis = game.phaseEndsAt instanceof Timestamp 
            ? game.phaseEndsAt.toMillis()
            : (game.phaseEndsAt.seconds * 1000 + game.phaseEndsAt.nanoseconds / 1000000);
            
        const now = Date.now();
        const durationSeconds = Math.max(0, Math.ceil((phaseEndMillis - now) / 1000));
        
        return durationSeconds;
    };

    const [duration, setDuration] = useState(getDuration);
    const [timeLeft, setTimeLeft] = useState(duration);

    useEffect(() => {
        const initialDuration = getDuration();
        setDuration(initialDuration);
        setTimeLeft(initialDuration);
        
        if (initialDuration <= 0) return;

        const interval = setInterval(() => {
            setTimeLeft(prev => Math.max(0, prev - 1));
        }, 1000);

        return () => clearInterval(interval);
    }, [game.phase, game.currentRound, game.phaseEndsAt]); // Depend on phaseEndsAt

    if (duration <= 0) return null;

    const progress = (timeLeft / duration) * 100;

    return (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-3/4 max-w-sm">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-center text-muted-foreground mt-1">{timeLeft}s</p>
        </div>
    );
}
