
"use client";

import { useState, useEffect, useRef } from 'react';
import { Progress } from '../ui/progress';
import { useGameSession } from '@/hooks/use-game-session';
import type { Game } from '@/types';

interface PhaseTimerProps {
    game: Game;
    onTimerEnd: () => void;
    // Add key to force re-mount
    timerKey: string;
    isCreator: boolean;
}

export function PhaseTimer({ game, onTimerEnd, timerKey, isCreator }: PhaseTimerProps) {
    const { userId } = useGameSession();
    const duration = (game.phase === 'day' ? 90 : (game.phase === 'night' ? 60 : 0));

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
                    // ANY player can now trigger this. The backend (e.g., processVotes)
                    // will handle making sure the action only runs once.
                    if (isCreator) {
                        onTimerEndRef.current();
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        // Cleanup function to clear the interval when the component unmounts or the key changes.
        return () => clearInterval(interval);
    }, [timerKey, duration, isCreator]); 

    if (duration <= 0) return null;

    const progress = (timeLeft / duration) * 100;

    return (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-3/4 max-w-sm">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-center text-muted-foreground mt-1">{timeLeft}s</p>
        </div>
    );
}
