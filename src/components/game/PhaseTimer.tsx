
"use client";

import { useState, useEffect, useRef } from 'react';
import { Progress } from '../ui/progress';
import type { Game } from '@/types';

interface PhaseTimerProps {
    game: Game;
    onTimerEnd: () => void;
    // Add key to force re-mount
    timerKey: string;
}

export function PhaseTimer({ game, onTimerEnd, timerKey }: PhaseTimerProps) {
    // The day timer is now longer, but the phase will advance as soon as everyone votes.
    // The night timer is a fallback for AFK players.
    const duration = (game.phase === 'day' ? 120 : (game.phase === 'night' ? 45 : 0));

    const [timeLeft, setTimeLeft] = useState(duration);
    const onTimerEndRef = useRef(onTimerEnd);

    // Keep the onTimerEnd callback fresh without causing re-renders.
    useEffect(() => {
        onTimerEndRef.current = onTimerEnd;
    }, [onTimerEnd]);

    useEffect(() => {
        // Reset timeLeft when the key changes (new phase/round starts)
        setTimeLeft(duration);
        
        if (duration <= 0) return;

        const interval = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    // Any player can now trigger the end-of-phase logic.
                    // The backend function will have a lock to prevent race conditions.
                    onTimerEndRef.current();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        // Cleanup function to clear the interval when the component unmounts or the key changes.
        return () => clearInterval(interval);
    }, [timerKey, duration]); 

    if (duration <= 0) return null;

    const progress = (timeLeft / duration) * 100;

    return (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-3/4 max-w-sm">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-center text-muted-foreground mt-1">{timeLeft}s</p>
        </div>
    );
}
